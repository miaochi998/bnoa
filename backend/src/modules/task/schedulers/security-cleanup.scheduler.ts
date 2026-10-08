import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';
import { TaskService } from '../task.service';

/**
 * 安全日志清理定时任务
 * 每周一凌晨4点执行，删除超过保留天数的已解决安全事件
 */
@Injectable()
export class SecurityCleanupScheduler implements OnModuleInit {
    private readonly logger =
        new Logger(SecurityCleanupScheduler.name);
    private readonly enabled: boolean;
    private readonly retentionDays: number;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly taskService: TaskService,
    ) {
        this.enabled = this.config.get('TASK_SECURITY_CLEANUP_ENABLED', 'true') !== 'false';
        this.retentionDays = this.config.get<number>(
            'SECURITY_LOG_RETENTION_DAYS', 180,
        );
    }

    onModuleInit() {
        this.taskService.registerScheduler('security-cleanup', {
            enabled: this.enabled,
            cron: '0 0 4 * * 1',
            description: '安全日志清理',
            handler: () => this.handleCleanup(),
        });
    }

    @Cron('0 0 4 * * 1')
    async handleCleanup(): Promise<void> {
        if (!this.enabled) {
            this.logger.debug('安全日志清理已禁用，跳过');
            return;
        }

        this.logger.log(
            `开始清理超过 ${this.retentionDays} 天的已解决安全事件`,
        );

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(
                cutoffDate.getDate() - this.retentionDays,
            );

            const result =
                await this.prisma.securityLog.deleteMany({
                    where: {
                        status: {
                            in: ['RESOLVED', 'FALSE_POSITIVE'],
                        },
                        createdAt: { lt: cutoffDate },
                    },
                });

            this.logger.log(
                `已清理 ${result.count} 条安全日志`,
            );
            this.taskService.recordLastRun('security-cleanup');
        } catch (error) {
            this.logger.error('安全日志清理失败', error);
        }
    }
}

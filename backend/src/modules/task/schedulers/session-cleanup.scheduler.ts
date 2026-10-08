import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';
import { TaskService } from '../task.service';

/**
 * 上传会话清理定时任务
 * 每天凌晨3点执行，将过期的上传会话标记为 EXPIRED
 */
@Injectable()
export class SessionCleanupScheduler implements OnModuleInit {
    private readonly logger =
        new Logger(SessionCleanupScheduler.name);
    private readonly enabled: boolean;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly taskService: TaskService,
    ) {
        this.enabled = this.config.get('TASK_SESSION_CLEANUP_ENABLED', 'true') !== 'false';
    }

    onModuleInit() {
        this.taskService.registerScheduler('session-cleanup', {
            enabled: this.enabled,
            cron: '0 0 3 * * *',
            description: '上传会话过期清理',
            handler: () => this.handleCleanup(),
        });
    }

    @Cron('0 0 3 * * *')
    async handleCleanup(): Promise<void> {
        if (!this.enabled) {
            this.logger.debug('上传会话清理已禁用，跳过');
            return;
        }

        this.logger.log('开始清理过期上传会话');

        try {
            const result =
                await this.prisma.uploadSession.updateMany({
                    where: {
                        status: {
                            in: ['PENDING', 'UPLOADING'],
                        },
                        expiresAt: { lt: new Date() },
                    },
                    data: { status: 'EXPIRED' },
                });

            if (result.count > 0) {
                this.logger.log(
                    `已清理 ${result.count} 个过期上传会话`,
                );
            }

            this.taskService.recordLastRun('session-cleanup');
        } catch (error) {
            this.logger.error('清理过期上传会话失败', error);
        }
    }
}

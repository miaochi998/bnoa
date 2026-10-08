import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';
import { TaskService } from '../task.service';

/**
 * 审计日志归档定时任务
 * 每周日凌晨4点执行，删除超过保留天数的审计日志
 */
@Injectable()
export class AuditArchiveScheduler implements OnModuleInit {
    private readonly logger =
        new Logger(AuditArchiveScheduler.name);
    private readonly enabled: boolean;
    private readonly retentionDays: number;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly taskService: TaskService,
    ) {
        this.enabled = this.config.get('TASK_AUDIT_ARCHIVE_ENABLED', 'true') !== 'false';
        this.retentionDays = this.config.get<number>(
            'AUDIT_RETENTION_DAYS', 90,
        );
    }

    onModuleInit() {
        this.taskService.registerScheduler('audit-archive', {
            enabled: this.enabled,
            cron: '0 0 4 * * 0',
            description: '审计日志归档清理',
            handler: () => this.handleArchive(),
        });
    }

    @Cron('0 0 4 * * 0')
    async handleArchive(): Promise<void> {
        if (!this.enabled) {
            this.logger.debug('审计日志归档已禁用，跳过');
            return;
        }

        this.logger.log(
            `开始归档超过 ${this.retentionDays} 天的审计日志`,
        );

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(
                cutoffDate.getDate() - this.retentionDays,
            );

            const result = await this.prisma.auditLog.deleteMany({
                where: { createdAt: { lt: cutoffDate } },
            });

            this.logger.log(
                `已归档 ${result.count} 条审计日志`,
            );
            this.taskService.recordLastRun('audit-archive');
        } catch (error) {
            this.logger.error('审计日志归档失败', error);
        }
    }
}

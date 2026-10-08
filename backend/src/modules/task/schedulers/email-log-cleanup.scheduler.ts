import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';

@Injectable()
export class EmailLogCleanupScheduler {
    private readonly logger = new Logger(
        EmailLogCleanupScheduler.name,
    );

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {}

    /** 每周日凌晨 5:00 执行 */
    @Cron('0 0 5 * * 0')
    async handleCleanup(): Promise<void> {
        const enabled = this.config.get(
            'TASK_EMAIL_LOG_CLEANUP_ENABLED', 'true',
        );
        if (enabled === 'false') {
            return;
        }

        const retentionDays = this.config.get<number>(
            'EMAIL_LOG_RETENTION_DAYS', 30,
        );

        this.logger.log(
            `开始清理 ${retentionDays} 天前的邮件日志`,
        );

        try {
            const cutoff = new Date();
            cutoff.setDate(
                cutoff.getDate() - retentionDays,
            );

            // 仅清理成功记录，失败记录保留更久
            const result =
                await this.prisma.emailLog.updateMany({
                    where: {
                        status: 'SUCCESS',
                        createdAt: { lt: cutoff },
                        deletedAt: null,
                    },
                    data: { deletedAt: new Date() },
                });

            this.logger.log(
                `邮件日志清理完成: ${result.count} 条`,
            );
        } catch (error) {
            this.logger.error(
                `邮件日志清理失败: ${(error as Error).message}`,
            );
        }
    }
}

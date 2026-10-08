import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.service';
import { TaskService } from '../task.service';

/**
 * 分享过期清理定时任务
 * 每小时第30分钟执行，清理已过期的分享链接
 */
@Injectable()
export class ShareCleanupScheduler implements OnModuleInit {
    private readonly logger =
        new Logger(ShareCleanupScheduler.name);
    private readonly enabled: boolean;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly taskService: TaskService,
    ) {
        this.enabled = this.config.get('TASK_SHARE_CLEANUP_ENABLED', 'true') !== 'false';
    }

    onModuleInit() {
        this.taskService.registerScheduler('share-cleanup', {
            enabled: this.enabled,
            cron: '0 30 * * * *',
            description: '分享过期清理',
            handler: () => this.handleCleanup(),
        });
    }

    @Cron('0 30 * * * *')
    async handleCleanup(): Promise<void> {
        if (!this.enabled) {
            this.logger.debug('分享过期清理已禁用，跳过');
            return;
        }

        this.logger.log('开始清理过期分享');

        try {
            const result = await this.prisma.file.updateMany({
                where: {
                    shareCode: { not: null },
                    shareExpireAt: { lt: new Date() },
                },
                data: {
                    shareCode: null,
                    shareExpireAt: null,
                    sharePassword: null,
                    shareAccess: null,
                },
            });

            if (result.count > 0) {
                this.logger.log(
                    `已清理 ${result.count} 个过期分享`,
                );
            }

            this.taskService.recordLastRun('share-cleanup');
        } catch (error) {
            this.logger.error('清理过期分享失败', error);
        }
    }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../config/prisma.service';

@Injectable()
export class NotificationCleanupScheduler {
    private readonly logger =
        new Logger(
            NotificationCleanupScheduler.name,
        );

    constructor(
        private readonly prisma: PrismaService,
    ) {}

    /** 每天凌晨 03:00 — 清理过期通知 */
    @Cron('0 0 3 * * *')
    async cleanupExpiredNotifications() {
        this.logger.log('开始清理过期通知...');

        const retentionConfig =
            await this.prisma.config.findUnique({
                where: {
                    key: 'notification.retention.days',
                },
            });
        const days = parseInt(
            retentionConfig?.value || '90', 10,
        );

        const cutoff = new Date(
            Date.now() - days * 24 * 60 * 60 * 1000,
        );

        const result =
            await this.prisma.notification.deleteMany({
                where: {
                    OR: [
                        {
                            deletedAt: { not: null },
                            createdAt: { lt: cutoff },
                        },
                        {
                            isRead: true,
                            createdAt: { lt: cutoff },
                        },
                    ],
                },
            });

        this.logger.log(
            `清理过期通知完成，删除: ${result.count} 条`,
        );
    }

    /** 每周一凌晨 03:30 — 清理孤立广播 */
    @Cron('0 30 3 * * 1')
    async cleanupOrphanBroadcasts() {
        this.logger.log('开始清理孤立广播...');

        const orphanBroadcasts =
            await this.prisma.notificationBroadcast
                .findMany({
                    where: {
                        status: 'CANCELLED',
                        notifications: { none: {} },
                    },
                    select: { id: true },
                });

        if (orphanBroadcasts.length > 0) {
            const ids = orphanBroadcasts.map(
                (b) => b.id,
            );
            await this.prisma.notificationBroadcast
                .deleteMany({
                    where: { id: { in: ids } },
                });
        }

        this.logger.log(
            `清理孤立广播完成，` +
            `删除: ${orphanBroadcasts.length} 条`,
        );
    }
}

import {
    Injectable, Logger, NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import {
    QueryNotificationDto,
    QueryAdminNotificationDto,
} from '../dto/query-notification.dto';
import {
    NOTIFICATION_TEMPLATES,
} from '../constants/notification-templates';
import {
    NotificationStats,
} from '../interfaces/notification.interfaces';

@Injectable()
export class NotificationService {
    private readonly logger =
        new Logger(NotificationService.name);

    constructor(
        private readonly prisma: PrismaService,
    ) {}

    /** 获取用户通知列表 */
    async getUserNotifications(
        userId: string,
        query: QueryNotificationDto,
    ) {
        const pageSize = await this.getPageSize();
        const size = query.pageSize || pageSize;
        const page = query.page || 1;
        const skip = (page - 1) * size;

        const where: any = {
            userId,
            deletedAt: null,
        };

        if (query.type) {
            where.OR = [
                { type: query.type },
                {
                    notificationBroadcast: { type: query.type },
                },
            ];
        }
        if (query.priority) {
            where.priority = query.priority;
        }
        if (query.isRead !== undefined) {
            where.isRead = query.isRead;
        }
        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) {
                where.createdAt.gte =
                    new Date(query.startDate);
            }
            if (query.endDate) {
                where.createdAt.lte =
                    new Date(query.endDate);
            }
        }

        const [list, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                skip,
                take: size,
                orderBy: { createdAt: 'desc' },
                include: { notificationBroadcast: true },
            }),
            this.prisma.notification.count({ where }),
        ]);

        const unreadCount =
            await this.prisma.notification.count({
                where: {
                    userId,
                    isRead: false,
                    deletedAt: null,
                },
            });

        const merged = list.map((n) =>
            this.mergeNotification(n),
        );

        return {
            list: merged,
            pagination: {
                page,
                pageSize: size,
                total,
                totalPages: Math.ceil(total / size),
            },
            unreadCount,
        };
    }

    /** 获取未读数量 */
    async getUnreadCount(
        userId: string,
    ): Promise<number> {
        return this.prisma.notification.count({
            where: {
                userId,
                isRead: false,
                deletedAt: null,
            },
        });
    }

    /** 获取通知统计 */
    async getNotificationStats(
        userId: string,
    ): Promise<NotificationStats> {
        const where = {
            userId, deletedAt: null,
        };

        const [total, unread] = await Promise.all([
            this.prisma.notification.count({ where }),
            this.prisma.notification.count({
                where: { ...where, isRead: false },
            }),
        ]);

        const byType =
            await this.prisma.notification.groupBy({
                by: ['type'],
                where,
                _count: { id: true },
            });

        const byPriority =
            await this.prisma.notification.groupBy({
                by: ['priority'],
                where,
                _count: { id: true },
            });

        return {
            total,
            unread,
            read: total - unread,
            byType: byType.map((t) => ({
                type: t.type || 'notificationBroadcast',
                count: t._count.id,
            })),
            byPriority: byPriority.map((p) => ({
                priority: p.priority || 'NORMAL',
                count: p._count.id,
            })),
        };
    }

    /** 获取通知详情 */
    async getNotificationById(
        id: string, userId: string,
    ) {
        const notification =
            await this.prisma.notification.findUnique({
                where: { id },
                include: { notificationBroadcast: true },
            });

        if (!notification) {
            throw new NotFoundException('通知不存在');
        }
        if (notification.userId !== userId) {
            throw new ForbiddenException('无权访问');
        }

        return this.mergeNotification(notification);
    }

    /** 标记单条已读 */
    async markAsRead(id: string, userId: string) {
        const notification =
            await this.prisma.notification.findUnique({
                where: { id },
            });

        if (!notification) {
            throw new NotFoundException('通知不存在');
        }
        if (notification.userId !== userId) {
            throw new ForbiddenException('无权操作');
        }

        if (notification.isRead) return notification;

        const updated =
            await this.prisma.notification.update({
                where: { id },
                data: {
                    isRead: true,
                    readAt: new Date(),
                },
            });

        if (notification.broadcastId) {
            await this.prisma
                .notificationBroadcast.update({
                    where: {
                        id: notification.broadcastId,
                    },
                    data: {
                        readCount: { increment: 1 },
                    },
                });
        }

        return updated;
    }

    /** 批量标记已读 */
    async batchMarkAsRead(
        ids: string[], userId: string,
    ) {
        const notifications =
            await this.prisma.notification.findMany({
                where: {
                    id: { in: ids },
                    userId,
                    isRead: false,
                    deletedAt: null,
                },
            });

        const validIds =
            notifications.map((n) => n.id);

        if (validIds.length === 0) {
            return {
                updatedCount: 0,
                successIds: [],
                failedIds: ids,
            };
        }

        await this.prisma.notification.updateMany({
            where: { id: { in: validIds } },
            data: {
                isRead: true, readAt: new Date(),
            },
        });

        const broadcastIds = notifications
            .filter((n) => n.broadcastId)
            .map((n) => n.broadcastId!);

        for (const bId of [...new Set(broadcastIds)]) {
            const count = broadcastIds.filter(
                (id) => id === bId,
            ).length;
            await this.prisma
                .notificationBroadcast.update({
                    where: { id: bId },
                    data: {
                        readCount: { increment: count },
                    },
                });
        }

        return {
            updatedCount: validIds.length,
            successIds: validIds,
            failedIds: ids.filter(
                (id) => !validIds.includes(id),
            ),
        };
    }

    /** 全部标记已读 */
    async markAllAsRead(
        userId: string,
        filter?: { type?: string },
    ) {
        const where: any = {
            userId,
            isRead: false,
            deletedAt: null,
        };

        if (filter?.type) {
            where.OR = [
                { type: filter.type },
                {
                    notificationBroadcast: { type: filter.type },
                },
            ];
        }

        const unreadNotifications =
            await this.prisma.notification.findMany({
                where,
                select: {
                    id: true, broadcastId: true,
                },
            });

        const result =
            await this.prisma.notification.updateMany({
                where: {
                    id: {
                        in: unreadNotifications.map(
                            (n) => n.id,
                        ),
                    },
                },
                data: {
                    isRead: true, readAt: new Date(),
                },
            });

        const broadcastIds = unreadNotifications
            .filter((n) => n.broadcastId)
            .map((n) => n.broadcastId!);
        const uniqueBroadcastIds =
            [...new Set(broadcastIds)];

        for (const bId of uniqueBroadcastIds) {
            const count = broadcastIds.filter(
                (id) => id === bId,
            ).length;
            await this.prisma
                .notificationBroadcast.update({
                    where: { id: bId },
                    data: {
                        readCount: { increment: count },
                    },
                });
        }

        return { updatedCount: result.count };
    }

    /** 删除通知（软删除） */
    async deleteNotification(
        id: string, userId: string,
    ) {
        const notification =
            await this.prisma.notification.findUnique({
                where: { id },
            });

        if (!notification) {
            throw new NotFoundException('通知不存在');
        }
        if (notification.userId !== userId) {
            throw new ForbiddenException('无权操作');
        }

        return this.prisma.notification.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }

    /** 批量删除 */
    async batchDelete(
        ids: string[], userId: string,
    ) {
        const notifications =
            await this.prisma.notification.findMany({
                where: {
                    id: { in: ids },
                    userId,
                    deletedAt: null,
                },
                select: { id: true },
            });

        const validIds =
            notifications.map((n) => n.id);

        const result =
            await this.prisma.notification.updateMany({
                where: { id: { in: validIds } },
                data: { deletedAt: new Date() },
            });

        return {
            deletedCount: result.count,
            successIds: validIds,
            failedIds: ids.filter(
                (id) => !validIds.includes(id),
            ),
        };
    }

    /** 获取用户通知设置 */
    async getUserSettings(userId: string) {
        const settings =
            await this.prisma.notificationSetting.findMany({
                where: { userId },
            });

        const settingsMap = new Map(
            settings.map((s) => [s.type, s.enabled]),
        );

        return Object.entries(
            NOTIFICATION_TEMPLATES,
        ).map(([type, template]) => ({
            type,
            enabled: settingsMap.has(type)
                ? settingsMap.get(type) : true,
            canDisable: template.canDisable,
            category: template.category,
        }));
    }

    /** 更新用户通知设置 */
    async updateUserSettings(
        userId: string,
        settings: { type: string; enabled: boolean }[],
    ) {
        let updatedCount = 0;

        for (const setting of settings) {
            const template =
                NOTIFICATION_TEMPLATES[setting.type];
            if (template && !template.canDisable) {
                continue;
            }

            await this.prisma
                .notificationSetting.upsert({
                    where: {
                        userId_type: {
                            userId,
                            type: setting.type,
                        },
                    },
                    update: {
                        enabled: setting.enabled,
                    },
                    create: {
                        userId,
                        type: setting.type,
                        enabled: setting.enabled,
                    },
                });
            updatedCount++;
        }

        return { updatedCount };
    }

    /** 系统维护操作 */
    async performMaintenance(
        operation: string,
        params?: { days?: number },
    ) {
        const now = new Date();

        if (operation === 'cleanup_expired') {
            const retentionConfig =
                await this.prisma.config.findUnique({
                    where: {
                        key:
                            'notification.retention.days',
                    },
                });
            const days = params?.days
                || parseInt(
                    retentionConfig?.value || '90',
                    10,
                );
            const cutoff = new Date(
                now.getTime() -
                days * 24 * 60 * 60 * 1000,
            );

            const result =
                await this.prisma.notification
                    .deleteMany({
                        where: {
                            OR: [
                                {
                                    deletedAt: {
                                        not: null,
                                    },
                                    createdAt: {
                                        lt: cutoff,
                                    },
                                },
                                {
                                    isRead: true,
                                    createdAt: {
                                        lt: cutoff,
                                    },
                                },
                            ],
                        },
                    });

            return {
                operation,
                affectedCount: result.count,
                executedAt: now,
            };
        }

        if (operation === 'reset_unread') {
            const result =
                await this.prisma.notification
                    .updateMany({
                        where: { isRead: false },
                        data: {
                            isRead: true,
                            readAt: now,
                        },
                    });

            return {
                operation,
                affectedCount: result.count,
                executedAt: now,
            };
        }

        return {
            operation,
            affectedCount: 0,
            executedAt: now,
        };
    }

    /** 管理端：获取通知记录 */
    async getAdminNotifications(
        query: QueryAdminNotificationDto,
    ) {
        const size = query.pageSize || 20;
        const page = query.page || 1;
        const skip = (page - 1) * size;

        const where: any = { deletedAt: null };

        if (query.userId) where.userId = query.userId;
        if (query.type) {
            where.OR = [
                { type: query.type },
                {
                    notificationBroadcast: { type: query.type },
                },
            ];
        }
        if (query.priority) {
            where.priority = query.priority;
        }
        if (query.isRead !== undefined) {
            where.isRead = query.isRead;
        }

        const [list, total, unreadCount] =
            await Promise.all([
                this.prisma.notification.findMany({
                    where,
                    skip,
                    take: size,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        notificationBroadcast: true,
                        users: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                            },
                        },
                    },
                }),
                this.prisma.notification.count({
                    where,
                }),
                this.prisma.notification.count({
                    where: {
                        ...where, isRead: false,
                    },
                }),
            ]);

        const merged = list.map((n) =>
            this.mergeNotification(n),
        );

        return {
            list: merged,
            pagination: {
                page,
                pageSize: size,
                total,
                totalPages: Math.ceil(total / size),
            },
            statistics: {
                total,
                unreadCount,
                readCount: total - unreadCount,
                readRate: total > 0
                    ? Math.round(
                        (total - unreadCount) /
                        total * 100,
                    )
                    : 0,
            },
        };
    }

    /** 获取全局配置 */
    async getGlobalConfig() {
        const configs =
            await this.prisma.config.findMany({
                where: { category: 'notification' },
            });

        const configMap = new Map(
            configs.map((c) => [c.key, c.value]),
        );

        const typeConfigs = Object.entries(
            NOTIFICATION_TEMPLATES,
        ).map(([type, template]) => {
            const key =
                `notification.type.${type}.enabled`;
            return {
                type,
                enabled:
                    configMap.get(key) !== 'false',
                label: template.defaultTitle,
                category: template.category,
            };
        });

        return {
            retentionDays: parseInt(
                configMap.get(
                    'notification.retention.days',
                ) || '90',
                10,
            ),
            pageSize: parseInt(
                configMap.get(
                    'notification.page.size',
                ) || '20',
                10,
            ),
            emailEnabled:
                configMap.get(
                    'notification.email.enabled',
                ) === 'true',
            typeConfigs,
        };
    }

    /** 更新全局配置 */
    async updateGlobalConfig(data: {
        retentionDays?: number;
        pageSize?: number;
        emailEnabled?: boolean;
        typeConfigs?: {
            type: string; enabled: boolean;
        }[];
    }) {
        if (data.retentionDays !== undefined) {
            await this.upsertConfig(
                'notification.retention.days',
                String(data.retentionDays),
            );
        }
        if (data.pageSize !== undefined) {
            await this.upsertConfig(
                'notification.page.size',
                String(data.pageSize),
            );
        }
        if (data.emailEnabled !== undefined) {
            await this.upsertConfig(
                'notification.email.enabled',
                String(data.emailEnabled),
            );
        }
        if (data.typeConfigs) {
            for (const tc of data.typeConfigs) {
                const key =
                    `notification.type.${tc.type}.enabled`;
                await this.upsertConfig(
                    key, String(tc.enabled),
                );
            }
        }
    }

    /** 合并广播内容到通知 */
    private mergeNotification(n: any) {
        if (n.notificationBroadcast) {
            return {
                id: n.id,
                userId: n.userId,
                type: n.notificationBroadcast.type,
                priority: n.notificationBroadcast.priority,
                title: n.notificationBroadcast.title,
                content: n.notificationBroadcast.content,
                actionUrl: n.notificationBroadcast.actionUrl,
                broadcastId: n.broadcastId,
                broadcastNo: n.notificationBroadcast.notificationBroadcastNo,
                relatedType: n.relatedType,
                relatedId: n.relatedId,
                isRead: n.isRead,
                readAt: n.readAt,
                createdAt: n.createdAt,
                user: n.user,
            };
        }
        return {
            id: n.id,
            userId: n.userId,
            type: n.type,
            priority: n.priority,
            title: n.title,
            content: n.content,
            actionUrl: n.actionUrl,
            broadcastId: null,
            broadcastNo: null,
            relatedType: n.relatedType,
            relatedId: n.relatedId,
            isRead: n.isRead,
            readAt: n.readAt,
            createdAt: n.createdAt,
            user: n.user,
        };
    }

    /** 获取配置的每页数量 */
    private async getPageSize(): Promise<number> {
        const config =
            await this.prisma.config.findUnique({
                where: {
                    key: 'notification.page.size',
                },
            });
        return config
            ? parseInt(config.value, 10)
            : 20;
    }

    /** 更新或创建配置 */
    private async upsertConfig(
        key: string, value: string,
    ) {
        await this.prisma.config.upsert({
            where: { key },
            update: { value },
            create: {
                key,
                value,
                type: 'STRING',
                category: 'notification',
                description: key,
                isSystem: true,
            },
        });
    }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { EmailService } from '../../email/email.service';
import {
    EmailCategory,
} from '../../email/interfaces/email.interfaces';
import {
    CreateNotificationParams,
} from '../interfaces/notification.interfaces';
import {
    NOTIFICATION_TEMPLATES,
} from '../constants/notification-templates';
import { Notification } from '@prisma/client';

@Injectable()
export class NotificationHelperService {
    private readonly logger =
        new Logger(NotificationHelperService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
    ) {}

    /** 创建单条通知 */
    async createNotification(
        params: CreateNotificationParams,
    ): Promise<Notification | null> {
        const typeEnabled =
            await this.isTypeEnabled(params.type);
        if (!typeEnabled) {
            this.logger.debug(
                `通知类型 ${params.type} 全局已禁用`,
            );
            return null;
        }

        const userDisabled =
            await this.isUserDisabled(
                params.userId, params.type,
            );
        if (userDisabled) {
            this.logger.debug(
                `用户 ${params.userId} 已禁用通知类型 ${params.type}`,
            );
            return null;
        }

        const notification =
            await this.prisma.notification.create({
                data: {
                    userId: params.userId,
                    type: params.type,
                    title: params.title,
                    content: params.content,
                    priority: params.priority || 'NORMAL',
                    relatedType: params.relatedType,
                    relatedId: params.relatedId,
                    actionUrl: params.actionUrl,
                },
            });

        await this.trySendEmail(params);
        return notification;
    }

    /** 批量创建通知（用于广播） */
    async batchCreateNotifications(
        userIds: string[],
        params: Omit<CreateNotificationParams, 'userId'>,
        broadcastId?: string,
    ): Promise<{ created: number; skipped: number }> {
        const typeEnabled =
            await this.isTypeEnabled(params.type);
        if (!typeEnabled) {
            return {
                created: 0, skipped: userIds.length,
            };
        }

        const disabledSettings =
            await this.prisma.notificationSetting.findMany({
                where: {
                    userId: { in: userIds },
                    type: params.type,
                    enabled: false,
                },
                select: { userId: true },
            });

        const disabledUserIds = new Set(
            disabledSettings.map((s) => s.userId),
        );
        const template =
            NOTIFICATION_TEMPLATES[params.type];
        const canDisable = template?.canDisable ?? true;

        const filteredIds = canDisable
            ? userIds.filter(
                (id) => !disabledUserIds.has(id),
            )
            : userIds;

        if (filteredIds.length === 0) {
            return {
                created: 0,
                skipped: userIds.length,
            };
        }

        const data = filteredIds.map((userId) => ({
            userId,
            broadcastId: broadcastId || null,
            type: broadcastId ? null : params.type,
            priority: broadcastId
                ? null
                : (params.priority || 'NORMAL'),
            title: broadcastId ? null : params.title,
            content: broadcastId ? null : params.content,
            actionUrl: broadcastId
                ? null : params.actionUrl,
        }));

        const result =
            await this.prisma.notification.createMany({
                data: data as any,
            });

        await this.trySendBroadcastEmail(
            filteredIds, params,
        );

        return {
            created: result.count,
            skipped: userIds.length - filteredIds.length,
        };
    }

    /** 给所有管理员发通知 */
    async notifyAdmins(
        params: Omit<CreateNotificationParams, 'userId'>,
    ): Promise<number> {
        const adminUsers = await this.prisma.user.findMany({
            where: {
                status: 'ACTIVE',
                deletedAt: null,
                userRoles: {
                    some: {
                        role: { code: 'super_admin' },
                    },
                },
            },
            select: { id: true },
        });

        const ids = adminUsers.map((u) => u.id);
        const result =
            await this.batchCreateNotifications(
                ids, params,
            );
        return result.created;
    }

    /** 检查通知类型全局开关 */
    private async isTypeEnabled(
        type: string,
    ): Promise<boolean> {
        const key =
            `notification.type.${type}.enabled`;
        const config = await this.prisma.config.findUnique({
            where: { key },
        });
        if (!config) return true;
        return config.value !== 'false';
    }

    /** 检查用户是否禁用该类型 */
    private async isUserDisabled(
        userId: string, type: string,
    ): Promise<boolean> {
        const template =
            NOTIFICATION_TEMPLATES[type];
        if (template && !template.canDisable) {
            return false;
        }
        const setting =
            await this.prisma.notificationSetting.findUnique({
                where: {
                    userId_type: { userId, type },
                },
            });
        return setting?.enabled === false;
    }

    /** 尝试发送邮件通知 */
    private async trySendEmail(
        params: CreateNotificationParams,
    ): Promise<void> {
        try {
            if (!await this.shouldSendEmail(
                params.type,
                params.priority || 'NORMAL',
            )) return;

            const user =
                await this.prisma.user.findUnique({
                    where: { id: params.userId },
                    select: { email: true, name: true },
                });
            if (!user?.email) return;

            await this.emailService.send({
                to: user.email,
                subject: `【BNOA】${params.title}`,
                template: 'notification',
                data: {
                    title: params.title,
                    content: params.content,
                    type: params.type,
                    priority: params.priority,
                    actionUrl: params.actionUrl,
                    userName: user.name,
                },
                category: EmailCategory.NOTIFICATION,
            });
        } catch (err) {
            this.logger.error(
                `通知邮件发送失败: ${err.message}`,
            );
        }
    }

    /** 广播邮件发送（分批） */
    async trySendBroadcastEmail(
        userIds: string[],
        params: Omit<CreateNotificationParams, 'userId'>,
    ): Promise<void> {
        try {
            if (!await this.shouldSendEmail(
                params.type,
                params.priority || 'NORMAL',
            )) return;

            const users =
                await this.prisma.user.findMany({
                    where: {
                        id: { in: userIds },
                        email: { not: '' },
                    },
                    select: {
                        email: true, name: true,
                    },
                });

            const batchSize = 50;
            for (
                let i = 0; i < users.length;
                i += batchSize
            ) {
                const batch = users.slice(
                    i, i + batchSize,
                );
                for (const user of batch) {
                    await this.emailService.send({
                        to: user.email,
                        subject:
                            `【BNOA】${params.title}`,
                        template: 'notification',
                        data: {
                            title: params.title,
                            content: params.content,
                            type: params.type,
                            priority: params.priority,
                            userName: user.name,
                            actionUrl: params.actionUrl,
                        },
                        category: EmailCategory.NOTIFICATION,
                        delay: i > 0
                            ? (i / batchSize) * 2000
                            : undefined,
                    });
                }
            }
        } catch (err) {
            this.logger.error(
                `批量邮件发送失败: ${err.message}`,
            );
        }
    }

    /** 检查是否需要发送邮件 */
    private async shouldSendEmail(
        type: string, priority: string,
    ): Promise<boolean> {
        const emailConfig =
            await this.prisma.config.findUnique({
                where: {
                    key: 'notification.email.enabled',
                },
            });
        if (
            !emailConfig ||
            emailConfig.value !== 'true'
        ) return false;

        if (
            priority !== 'HIGH' &&
            priority !== 'URGENT'
        ) return false;

        const template =
            NOTIFICATION_TEMPLATES[type];
        if (template && !template.emailEnabled) {
            return false;
        }

        return true;
    }
}

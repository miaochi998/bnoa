import {
    Injectable, Logger, NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import {
    NotificationHelperService,
} from './notification-helper.service';
import { CreateBroadcastDto } from '../dto/broadcast.dto';
import {
    QueryBroadcastDto,
} from '../dto/query-notification.dto';

@Injectable()
export class BroadcastService {
    private readonly logger =
        new Logger(BroadcastService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly helper:
            NotificationHelperService,
    ) {}

    /** 创建广播 */
    async createBroadcast(
        data: CreateBroadcastDto,
        creatorId: string,
    ) {
        const broadcastNo = this.generateNo();

        const userIds =
            await this.resolveTargetUsers(data);

        if (userIds.length === 0) {
            throw new BadRequestException(
                '目标用户列表为空',
            );
        }

        const result = await this.prisma.$transaction(
            async (tx) => {
                const broadcast =
                    await tx.notificationBroadcast.create({
                        data: {
                            broadcastNo,
                            type: data.type,
                            priority: data.priority,
                            title: data.title,
                            content: data.content,
                            actionUrl: data.actionUrl,
                            targetType: data.targetType,
                            targetConfig:
                                this.buildTargetConfig(
                                    data,
                                ),
                            targetCount: userIds.length,
                            createdBy: creatorId,
                            status: 'SENT',
                            sentAt: new Date(),
                        },
                    });

                const notificationData = userIds.map(
                    (userId) => ({
                        userId,
                        broadcastId: broadcast.id,
                    }),
                );

                const createResult =
                    await tx.notification.createMany({
                        data: notificationData,
                    });

                await tx.notificationBroadcast.update({
                    where: { id: broadcast.id },
                    data: {
                        sentCount: createResult.count,
                    },
                });

                return {
                    ...broadcast,
                    sentCount: createResult.count,
                };
            },
        );

        this.helper.trySendBroadcastEmail(
            userIds,
            {
                type: data.type,
                title: data.title,
                content: data.content || '',
                priority: data.priority,
                actionUrl: data.actionUrl,
            },
        ).catch((err) => {
            this.logger.error(
                `广播邮件发送失败: ${err.message}`,
            );
        });

        return {
            broadcastId: result.id,
            broadcastNo: result.broadcastNo,
            targetCount: result.targetCount,
            sentCount: result.sentCount,
        };
    }

    /** 获取广播列表 */
    async getBroadcasts(query: QueryBroadcastDto) {
        const size = query.pageSize || 20;
        const page = query.page || 1;
        const skip = (page - 1) * size;

        const where: any = { deletedAt: null };
        if (query.type) where.type = query.type;
        if (query.status) where.status = query.status;

        const [list, total] = await Promise.all([
            this.prisma.notificationBroadcast.findMany({
                where,
                skip,
                take: size,
                orderBy: { createdAt: 'desc' },
                include: { confirmedByUser: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                        },
                    },
                },
            }),
            this.prisma.notificationBroadcast.count({
                where,
            }),
        ]);

        const enriched = list.map((b) => ({
            ...b,
            readRate: b.sentCount > 0
                ? Math.round(
                    b.readCount / b.sentCount * 100,
                )
                : 0,
        }));

        return {
            list: enriched,
            pagination: {
                page,
                pageSize: size,
                total,
                totalPages: Math.ceil(total / size),
            },
        };
    }

    /** 获取广播详情 */
    async getBroadcastById(id: string) {
        const broadcast =
            await this.prisma.notificationBroadcast
                .findUnique({
                    where: { id },
                    include: { confirmedByUser: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                            },
                        },
                    },
                });

        if (
            !broadcast || broadcast.deletedAt
        ) {
            throw new NotFoundException(
                '广播不存在',
            );
        }

        return {
            ...broadcast,
            readRate: broadcast.sentCount > 0
                ? Math.round(
                    broadcast.readCount /
                    broadcast.sentCount * 100,
                )
                : 0,
        };
    }

    /** 取消广播 */
    async cancelBroadcast(id: string) {
        const broadcast =
            await this.prisma.notificationBroadcast
                .findUnique({ where: { id } });

        if (!broadcast) {
            throw new NotFoundException(
                '广播不存在',
            );
        }
        if (broadcast.status !== 'PENDING') {
            throw new BadRequestException(
                '只能取消待发送状态的广播',
            );
        }

        return this.prisma.notificationBroadcast
            .update({
                where: { id },
                data: { status: 'CANCELLED' },
            });
    }

    /** 删除广播（软删除） */
    async deleteBroadcast(id: string) {
        const broadcast =
            await this.prisma.notificationBroadcast
                .findUnique({ where: { id } });

        if (!broadcast) {
            throw new NotFoundException(
                '广播不存在',
            );
        }

        const now = new Date();
        await this.prisma.$transaction([
            this.prisma.notification.updateMany({
                where: { broadcastId: id },
                data: { deletedAt: now },
            }),
            this.prisma.notificationBroadcast.update({
                where: { id },
                data: { deletedAt: now },
            }),
        ]);

        return { id, deletedAt: now };
    }

    /** 生成广播编号 */
    private generateNo(): string {
        const now = new Date();
        const ts = now.toISOString()
            .replace(/[-T:.Z]/g, '')
            .slice(0, 14);
        const rand = String(
            Math.floor(Math.random() * 1000),
        ).padStart(3, '0');
        return `BC-${ts}-${rand}`;
    }

    /** 解析目标用户 */
    private async resolveTargetUsers(
        data: CreateBroadcastDto,
    ): Promise<string[]> {
        if (data.targetType === 'all') {
            const users =
                await this.prisma.user.findMany({
                    where: {
                        status: 'ACTIVE',
                        deletedAt: null,
                    },
                    select: { id: true },
                });
            return users.map((u) => u.id);
        }

        if (data.targetType === 'role') {
            if (
                !data.targetRoles?.length
            ) return [];
            const users =
                await this.prisma.user.findMany({
                    where: {
                        status: 'ACTIVE',
                        deletedAt: null,
                        userRoles: {
                            some: {
                                roleId: {
                                    in: data.targetRoles,
                                },
                            },
                        },
                    },
                    select: { id: true },
                });
            return users.map((u) => u.id);
        }

        if (data.targetType === 'users') {
            return data.targetUserIds || [];
        }

        return [];
    }

    /** 构建目标配置 JSON */
    private buildTargetConfig(
        data: CreateBroadcastDto,
    ): any {
        if (data.targetType === 'role') {
            return { roleIds: data.targetRoles };
        }
        if (data.targetType === 'users') {
            return { userIds: data.targetUserIds };
        }
        return null;
    }
}

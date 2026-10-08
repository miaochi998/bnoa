import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BaseExportAdapter } from './base.adapter';
import {
    ColumnDef,
    AdapterQueryResult,
} from '../interfaces/export-import.interfaces';

@Injectable()
export class NotificationAdapter
    extends BaseExportAdapter
{
    readonly moduleName = 'notification';
    readonly displayName = '通知记录';
    readonly columns: ColumnDef[] = [
        { field: 'type', header: '类型', width: 15 },
        { field: 'title', header: '标题', width: 25 },
        { field: 'content', header: '内容', width: 35 },
        {
            field: 'priority', header: '优先级', width: 10,
        },
        {
            field: 'isRead', header: '已读', width: 8,
            formatter: (v) => v ? '是' : '否',
        },
        {
            field: 'userName', header: '接收人', width: 12,
            formatter: (_, row) =>
                row.user?.name || '',
        },
        { field: 'actionUrl', header: '跳转链接', width: 25 },
        {
            field: 'createdAt', header: '创建时间', width: 20,
            formatter: (v) =>
                v ? new Date(v).toLocaleString('zh-CN')
                    : '',
        },
    ];

    constructor(private readonly prisma: PrismaService) {
        super();
    }

    async queryData(
        params: any,
        page: number,
        pageSize: number,
    ): Promise<AdapterQueryResult> {
        const where: any = { deletedAt: null };
        if (params?.type) where.type = params.type;
        if (params?.userId) where.userId = params.userId;
        if (params?.isRead !== undefined) {
            where.isRead = params.isRead === 'true'
                || params.isRead === true;
        }
        const [data, total] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                include: { users: {
                        select: { name: true },
                    },
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.notification.count({ where }),
        ]);
        return { data, total };
    }
}

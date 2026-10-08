import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BaseExportAdapter } from './base.adapter';
import {
    ColumnDef,
    AdapterQueryResult,
} from '../interfaces/export-import.interfaces';

@Injectable()
export class EmailLogAdapter extends BaseExportAdapter {
    readonly moduleName = 'email_log';
    readonly displayName = '邮件日志';
    readonly columns: ColumnDef[] = [
        { field: 'to', header: '收件人', width: 25 },
        { field: 'subject', header: '主题', width: 30 },
        { field: 'template', header: '模板', width: 15 },
        { field: 'category', header: '类别', width: 12 },
        { field: 'status', header: '状态', width: 10 },
        {
            field: 'errorMessage', header: '错误信息',
            width: 30,
        },
        { field: 'retryCount', header: '重试次数', width: 10 },
        {
            field: 'sentAt', header: '发送时间', width: 20,
            formatter: (v) =>
                v ? new Date(v).toLocaleString('zh-CN')
                    : '',
        },
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
        if (params?.status) where.status = params.status;
        if (params?.category) {
            where.category = params.category;
        }
        if (params?.keyword) {
            where.OR = [
                {
                    to: {
                        contains: params.keyword,
                        mode: 'insensitive',
                    },
                },
                {
                    subject: {
                        contains: params.keyword,
                        mode: 'insensitive',
                    },
                },
            ];
        }
        const [data, total] = await Promise.all([
            this.prisma.emailLog.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.emailLog.count({ where }),
        ]);
        return { data, total };
    }
}

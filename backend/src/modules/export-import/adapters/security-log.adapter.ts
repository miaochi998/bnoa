import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BaseExportAdapter } from './base.adapter';
import {
    ColumnDef,
    AdapterQueryResult,
} from '../interfaces/export-import.interfaces';

@Injectable()
export class SecurityLogAdapter extends BaseExportAdapter {
    readonly moduleName = 'security_log';
    readonly displayName = '安全事件';
    readonly columns: ColumnDef[] = [
        { field: 'type', header: '事件类型', width: 18 },
        { field: 'severity', header: '严重程度', width: 10 },
        { field: 'status', header: '状态', width: 12 },
        { field: 'details', header: '详情', width: 30 },
        { field: 'ipAddress', header: 'IP地址', width: 15 },
        { field: 'location', header: '位置', width: 15 },
        { field: 'fileName', header: '关联文件', width: 20 },
        {
            field: 'actionTaken', header: '处理措施',
            width: 20,
        },
        {
            field: 'acknowledgedBy', header: '处理人',
            width: 12,
        },
        {
            field: 'createdAt', header: '发生时间', width: 20,
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
        const where: any = {};
        if (params?.type) where.type = params.type;
        if (params?.severity) {
            where.severity = params.severity;
        }
        if (params?.status) where.status = params.status;
        if (params?.startDate || params?.endDate) {
            where.createdAt = {};
            if (params.startDate) {
                where.createdAt.gte =
                    new Date(params.startDate);
            }
            if (params.endDate) {
                where.createdAt.lte =
                    new Date(params.endDate);
            }
        }
        const [data, total] = await Promise.all([
            this.prisma.securityLog.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.securityLog.count({ where }),
        ]);
        return { data, total };
    }
}

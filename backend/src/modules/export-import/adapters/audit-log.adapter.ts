import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BaseExportAdapter } from './base.adapter';
import {
    ColumnDef,
    AdapterQueryResult,
} from '../interfaces/export-import.interfaces';

@Injectable()
export class AuditLogAdapter extends BaseExportAdapter {
    readonly moduleName = 'audit_log';
    readonly displayName = '审计日志';
    readonly columns: ColumnDef[] = [
        {
            field: 'action', header: '操作类型', width: 12,
        },
        { field: 'module', header: '模块', width: 12 },
        { field: 'resource', header: '资源', width: 15 },
        {
            field: 'description', header: '描述', width: 30,
        },
        { field: 'username', header: '操作人', width: 12 },
        { field: 'realName', header: '真实姓名', width: 12 },
        { field: 'ip', header: 'IP地址', width: 15 },
        {
            field: 'requestMethod', header: '请求方式',
            width: 10,
        },
        { field: 'requestUrl', header: '请求地址', width: 30 },
        { field: 'status', header: '状态', width: 10 },
        {
            field: 'executionTime', header: '耗时(ms)',
            width: 10,
        },
        {
            field: 'createdAt', header: '操作时间', width: 20,
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
        if (params?.action) where.action = params.action;
        if (params?.module) where.module = params.module;
        if (params?.status) where.status = params.status;
        if (params?.username) {
            where.username = {
                contains: params.username,
                mode: 'insensitive',
            };
        }
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
            this.prisma.auditLog.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.auditLog.count({ where }),
        ]);
        return { data, total };
    }
}

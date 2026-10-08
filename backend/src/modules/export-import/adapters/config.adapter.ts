import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BaseExportAdapter } from './base.adapter';
import {
    ColumnDef,
    AdapterQueryResult,
} from '../interfaces/export-import.interfaces';

@Injectable()
export class ConfigAdapter extends BaseExportAdapter {
    readonly moduleName = 'config';
    readonly displayName = '系统配置';
    supportsImport = true;
    supportedFormats = ['json'];
    maxSyncRows = 10000;
    readonly columns: ColumnDef[] = [
        { field: 'key', header: '配置键', width: 30 },
        { field: 'value', header: '配置值', width: 30 },
        { field: 'type', header: '类型', width: 10 },
        { field: 'category', header: '分类', width: 15 },
        {
            field: 'description', header: '描述', width: 25,
        },
        {
            field: 'isSystem', header: '系统配置', width: 10,
            formatter: (v) => v ? '是' : '否',
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
        if (params?.category) {
            where.category = params.category;
        }
        const [data, total] = await Promise.all([
            this.prisma.config.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: [
                    { category: 'asc' },
                    { sortOrder: 'asc' },
                ],
            }),
            this.prisma.config.count({ where }),
        ]);
        return { data, total };
    }

    async validateRow(
        row: Record<string, any>,
    ): Promise<string | null> {
        if (!row['配置键']) return '配置键不能为空';
        if (!row['配置值'] && row['配置值'] !== '') {
            return '配置值不能为空';
        }
        const existing =
            await this.prisma.config.findFirst({
                where: {
                    key: row['配置键'],
                    deletedAt: null,
                },
            });
        if (existing) {
            return `配置键 ${row['配置键']} 已存在`;
        }
        return null;
    }

    async importRow(
        row: Record<string, any>,
        userId: string,
    ): Promise<void> {
        await this.prisma.config.create({
            data: {
                key: row['配置键'],
                value: row['配置值'],
                type: row['类型'] || 'STRING',
                category: row['分类'] || 'general',
                description: row['描述'] || null,
                isSystem: false,
                createdBy: userId,
            },
        });
    }
}

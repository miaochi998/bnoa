import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BaseExportAdapter } from './base.adapter';
import {
    ColumnDef,
    AdapterQueryResult,
} from '../interfaces/export-import.interfaces';

@Injectable()
export class DictionaryAdapter extends BaseExportAdapter {
    readonly moduleName = 'dictionary';
    readonly displayName = '数据字典';
    supportsImport = true;
    supportedFormats = ['xlsx', 'json'];
    maxSyncRows = 10000;
    readonly columns: ColumnDef[] = [
        { field: 'typeCode', header: '类型编码', width: 18 },
        { field: 'typeName', header: '类型名称', width: 18 },
        { field: 'itemCode', header: '项编码', width: 15 },
        { field: 'itemName', header: '项名称', width: 15 },
        { field: 'itemValue', header: '项值', width: 15 },
        { field: 'sortOrder', header: '排序', width: 8 },
        {
            field: 'isDefault', header: '默认', width: 8,
            formatter: (v) => v ? '是' : '否',
        },
        {
            field: 'isActive', header: '启用', width: 8,
            formatter: (v) => v ? '是' : '否',
        },
        { field: 'color', header: '颜色', width: 10 },
        {
            field: 'description', header: '描述', width: 25,
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
        if (params?.typeCode) {
            where.typeCode = params.typeCode;
        }
        const [data, total] = await Promise.all([
            this.prisma.dictionary.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: [
                    { typeCode: 'asc' },
                    { sortOrder: 'asc' },
                ],
            }),
            this.prisma.dictionary.count({ where }),
        ]);
        return { data, total };
    }

    async validateRow(
        row: Record<string, any>,
    ): Promise<string | null> {
        if (!row['类型编码']) return '类型编码不能为空';
        if (!row['类型名称']) return '类型名称不能为空';
        if (!row['项编码']) return '项编码不能为空';
        if (!row['项名称']) return '项名称不能为空';
        const existing =
            await this.prisma.dictionary.findFirst({
                where: {
                    typeCode: row['类型编码'],
                    itemCode: row['项编码'],
                    deletedAt: null,
                },
            });
        if (existing) {
            return `字典条目 ${row['类型编码']}.${row['项编码']} 已存在`;
        }
        return null;
    }

    async importRow(
        row: Record<string, any>,
    ): Promise<void> {
        await this.prisma.dictionary.create({
            data: {
                typeCode: row['类型编码'],
                typeName: row['类型名称'],
                itemCode: row['项编码'],
                itemName: row['项名称'],
                itemValue: row['项值'] || row['项编码'],
                sortOrder: parseInt(
                    row['排序'] || '0', 10,
                ),
                isDefault: row['默认'] === '是',
                isActive: row['启用'] !== '否',
                color: row['颜色'] || null,
                description: row['描述'] || null,
            },
        });
    }
}

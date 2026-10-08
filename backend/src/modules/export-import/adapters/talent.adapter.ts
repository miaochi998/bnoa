import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BaseExportAdapter } from './base.adapter';
import {
    ColumnDef,
    AdapterQueryResult,
} from '../interfaces/export-import.interfaces';
import { TalentStatus, TalentLevel } from '@prisma/client';

const STATUS_MAP: Record<string, string> = {
    PENDING: '待建联',
    COMMUNICATING: '沟通中',
    SAMPLE_SENT: '已寄样',
    COOPERATING: '已合作',
    ORDER_PLACED: '已出单',
    REJECTED: '不合作',
    BLACKLISTED: '黑名单',
};

const LEVEL_MAP: Record<string, string> = {
    LV1: 'LV1', LV2: 'LV2', LV3: 'LV3',
    LV4: 'LV4', LV5: 'LV5',
};

const STATUS_REVERSE = Object.fromEntries(
    Object.entries(STATUS_MAP).map(([k, v]) => [v, k]),
);

const LEVEL_REVERSE = Object.fromEntries(
    Object.entries(LEVEL_MAP).map(([k, v]) => [v, k]),
);

@Injectable()
export class TalentAdapter extends BaseExportAdapter {
    readonly moduleName = 'talent';
    readonly displayName = '达人管理';
    supportsImport = true;
    readonly columns: ColumnDef[] = [
        { field: 'name', header: '达人名称', width: 15 },
        { field: 'wechat', header: '微信号', width: 15 },
        { field: 'phone', header: '手机号', width: 15 },
        {
            field: 'status', header: '状态', width: 10,
            formatter: (v) => STATUS_MAP[v] || v,
        },
        {
            field: 'level', header: '等级', width: 8,
            formatter: (v) => LEVEL_MAP[v] || v,
        },
        {
            field: 'platforms', header: '平台账号',
            width: 25,
            formatter: (_, row) =>
                row.platforms
                    ?.filter((p: any) => !p.deletedAt)
                    .map(
                        (p: any) =>
                            `${p.platforms}${p.nickname ? ':' + p.nickname : ''}`,
                    )
                    .join('; ') || '',
        },
        {
            field: 'manager', header: '负责人', width: 12,
            formatter: (_, row) =>
                row.manager?.name || '',
        },
        { field: 'remark', header: '备注', width: 20 },
        {
            field: 'createdAt', header: '创建时间',
            width: 20,
            formatter: (v) =>
                v
                    ? new Date(v).toLocaleString('zh-CN')
                    : '',
        },
    ];

    constructor(
        private readonly prisma: PrismaService,
    ) {
        super();
    }

    async queryData(
        params: any,
        page: number,
        pageSize: number,
    ): Promise<AdapterQueryResult> {
        const where: any = { deletedAt: null };
        if (params?.status) where.status = params.status;
        if (params?.level) where.level = params.level;
        if (params?.managerId) {
            where.managerId = params.managerId;
        }
        if (params?.keyword) {
            where.OR = [
                {
                    name: {
                        contains: params.keyword,
                        mode: 'insensitive',
                    },
                },
                {
                    wechat: {
                        contains: params.keyword,
                        mode: 'insensitive',
                    },
                },
                {
                    phone: {
                        contains: params.keyword,
                        mode: 'insensitive',
                    },
                },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.talent.findMany({
                where,
                include: { manager: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    talentPlatforms: {
                        where: { deletedAt: null },
                    },
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.talent.count({ where }),
        ]);

        return { data, total };
    }

    async validateRow(
        row: Record<string, any>,
    ): Promise<string | null> {
        if (!row['达人名称']) {
            return '达人名称不能为空';
        }
        return null;
    }

    async importRow(
        row: Record<string, any>,
        userId: string,
    ): Promise<void> {
        const statusKey =
            STATUS_REVERSE[row['状态']] || 'PENDING';
        const levelKey =
            LEVEL_REVERSE[row['等级']] || 'LV1';

        await this.prisma.talent.create({
            data: {
                name: row['达人名称'],
                wechat: row['微信号'] || null,
                phone: row['手机号'] || null,
                status: statusKey as TalentStatus,
                level: levelKey as TalentLevel,
                remark: row['备注'] || null,
                managerId: userId,
                createdBy: userId,
            },
        });
    }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { CryptoUtil } from '../../../common/utils/crypto.util';
import { BaseExportAdapter } from './base.adapter';
import {
    ColumnDef,
    AdapterQueryResult,
} from '../interfaces/export-import.interfaces';

@Injectable()
export class UserAdapter extends BaseExportAdapter {
    readonly moduleName = 'user';
    readonly displayName = '用户管理';
    supportsImport = true;
    readonly columns: ColumnDef[] = [
        { field: 'username', header: '用户名', width: 15 },
        { field: 'name', header: '姓名', width: 15 },
        { field: 'email', header: '邮箱', width: 25 },
        { field: 'phone', header: '手机号', width: 15 },
        {
            field: 'status', header: '状态', width: 10,
            formatter: (v) => {
                const map: Record<string, string> = {
                    ACTIVE: '正常',
                    INACTIVE: '禁用',
                    SUSPENDED: '锁定',
                };
                return map[v] || v;
            },
        },
        {
            field: 'roles', header: '角色', width: 20,
            formatter: (_, row) =>
                row.userRoles
                    ?.map(
                        (ur: any) => ur.role?.name,
                    )
                    .join(', ') || '',
        },
        { field: 'loginCount', header: '登录次数', width: 10 },
        {
            field: 'lastLoginAt', header: '最后登录', width: 20,
            formatter: (v) =>
                v ? new Date(v).toLocaleString('zh-CN') : '',
        },
        {
            field: 'createdAt', header: '创建时间', width: 20,
            formatter: (v) =>
                v ? new Date(v).toLocaleString('zh-CN') : '',
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
        if (params?.keyword) {
            where.OR = [
                {
                    username: {
                        contains: params.keyword,
                        mode: 'insensitive',
                    },
                },
                {
                    name: {
                        contains: params.keyword,
                        mode: 'insensitive',
                    },
                },
                {
                    email: {
                        contains: params.keyword,
                        mode: 'insensitive',
                    },
                },
            ];
        }
        const [data, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                include: {
                    userRoles: {
                        include: { role: true },
                    },
                },
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
        ]);
        return { data, total };
    }

    async validateRow(
        row: Record<string, any>,
    ): Promise<string | null> {
        if (!row['用户名']) return '用户名不能为空';
        if (!row['姓名']) return '姓名不能为空';
        if (!row['邮箱']) return '邮箱不能为空';
        const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailReg.test(row['邮箱'])) {
            return '邮箱格式不正确';
        }
        const existing =
            await this.prisma.user.findFirst({
                where: {
                    OR: [
                        { username: row['用户名'] },
                        { email: row['邮箱'] },
                    ],
                    deletedAt: null,
                },
            });
        if (existing) return '用户名或邮箱已存在';
        return null;
    }

    async importRow(
        row: Record<string, any>,
        _userId: string,
    ): Promise<void> {
        const password =
            await CryptoUtil.hashPassword('123456');
        await this.prisma.user.create({
            data: {
                username: row['用户名'],
                name: row['姓名'],
                email: row['邮箱'],
                phone: row['手机号'] || null,
                password,
                status: 'ACTIVE',
            },
        });
    }
}

import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateNotebookDto } from './dto/create-notebook.dto';
import { UpdateNotebookDto } from './dto/update-notebook.dto';
import { NotebookFilterDto } from './dto/notebook-filter.dto';

@Injectable()
export class NotebookService {
    constructor(private prisma: PrismaService) {}

    async findAll(
        userId: string,
        isSuperAdmin: boolean,
        filter: NotebookFilterDto,
    ) {
        const { keyword, userId: filterUserId, page = 1, pageSize = 10 } = filter;

        const where: any = { deletedAt: null };

        // 普通用户只能看自己的
        if (!isSuperAdmin) {
            where.userId = userId;
        }

        // 超管可以按用户筛选
        if (filterUserId) {
            where.userId = filterUserId;
        }

        // 关键词搜索
        if (keyword) {
            where.title = { contains: keyword };
        }

        const [list, total] = await Promise.all([
            this.prisma.notebook.findMany({
                where,
                include: { user: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.notebook.count({ where }),
        ]);

        return {
            list,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    async findById(id: string, userId: string, isSuperAdmin: boolean) {
        const notebook = await this.prisma.notebook.findUnique({
            where: { id },
            include: { user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                    },
                },
            },
        });

        if (!notebook || notebook.deletedAt) {
            throw new NotFoundException('记事本不存在');
        }

        // 普通用户只能看自己的
        if (!isSuperAdmin && notebook.userId !== userId) {
            throw new ForbiddenException('无权访问此记事本');
        }

        return notebook;
    }

    async create(userId: string, data: CreateNotebookDto) {
        return this.prisma.notebook.create({
            data: {
                ...data,
                userId,
            },
            include: { user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                    },
                },
            },
        });
    }

    async update(
        id: string,
        userId: string,
        isSuperAdmin: boolean,
        data: UpdateNotebookDto,
    ) {
        const notebook = await this.findById(id, userId, isSuperAdmin);

        // 普通用户只能改自己的
        if (!isSuperAdmin && notebook.userId !== userId) {
            throw new ForbiddenException('无权编辑此记事本');
        }

        return this.prisma.notebook.update({
            where: { id },
            data,
            include: { user: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                    },
                },
            },
        });
    }

    async delete(id: string, userId: string, isSuperAdmin: boolean) {
        const notebook = await this.findById(id, userId, isSuperAdmin);

        // 普通用户只能删自己的
        if (!isSuperAdmin && notebook.userId !== userId) {
            throw new ForbiddenException('无权删除此记事本');
        }

        // 软删除
        return this.prisma.notebook.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}

import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    CreatePlatformDto,
    UpdatePlatformDto,
    QueryPlatformDto,
} from './dto/platform.dto';

@Injectable()
export class PlatformService {
    private readonly logger = new Logger(PlatformService.name);

    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreatePlatformDto, userId: string) {
        const existing = await this.prisma.platform.findFirst({
            where: { code: dto.code, deletedAt: null },
        });
        if (existing) {
            throw new ConflictException(
                `平台编码 ${dto.code} 已存在`,
            );
        }

        const platform = await this.prisma.platform.create({
            data: {
                ...dto,
                createdBy: userId,
                updatedBy: userId,
            },
        });

        this.logger.log(`平台创建成功: ${platform.name}`);
        return platform;
    }

    async update(
        id: string,
        dto: UpdatePlatformDto,
        userId: string,
    ) {
        const platform = await this.prisma.platform.findFirst({
            where: { id, deletedAt: null },
        });
        if (!platform) {
            throw new NotFoundException('平台不存在');
        }

        if (dto.code && dto.code !== platform.code) {
            const codeExists =
                await this.prisma.platform.findFirst({
                    where: { code: dto.code, deletedAt: null },
                });
            if (codeExists) {
                throw new ConflictException(
                    `平台编码 ${dto.code} 已存在`,
                );
            }
        }

        const updated = await this.prisma.platform.update({
            where: { id },
            data: { ...dto, updatedBy: userId },
        });

        this.logger.log(`平台更新成功: ${updated.name}`);
        return updated;
    }

    async delete(id: string, userId: string) {
        const platform = await this.prisma.platform.findFirst({
            where: { id, deletedAt: null },
        });
        if (!platform) {
            throw new NotFoundException('平台不存在');
        }

        const shopCount = await this.prisma.shop.count({
            where: { platformId: id, deletedAt: null },
        });
        if (shopCount > 0) {
            throw new ConflictException(
                '该平台下存在关联店铺，无法删除',
            );
        }

        await this.prisma.platform.update({
            where: { id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });

        this.logger.log(`平台删除成功: ${platform.name}`);
    }

    async findById(id: string) {
        const platform = await this.prisma.platform.findFirst({
            where: { id, deletedAt: null },
        });
        if (!platform) {
            throw new NotFoundException('平台不存在');
        }
        return platform;
    }

    async findAll(query: QueryPlatformDto) {
        const { keyword, type, status } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;

        const where: any = { deletedAt: null };

        if (keyword) {
            where.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { code: { contains: keyword, mode: 'insensitive' } },
            ];
        }

        if (type) {
            where.type = type;
        }

        if (status) {
            where.status = status;
        }

        const skip = (page - 1) * pageSize;

        const [list, total] = await Promise.all([
            this.prisma.platform.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            this.prisma.platform.count({ where }),
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

    async findActive() {
        return this.prisma.platform.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            orderBy: { name: 'asc' },
        });
    }

    // ========== 排序管理 ==========

    async reorderPlatforms(ids: string[]) {
        const maxOrder = await this.prisma.platform.aggregate({
            _max: { sortOrder: true },
        });
        const baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.platform.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }
}

import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    QueryProductLinkDto,
    CreateProductLinkDto,
    UpdateProductLinkDto,
} from './dto/product-link.dto';

const LINK_INCLUDE = {
    shop: {
        select: {
            id: true,
            name: true,
            platform: {
                select: { id: true, name: true, code: true },
            },
        },
    },
    skus: {
        where: { deletedAt: null },
        select: {
            id: true,
            status: true,
        },
    },
};

@Injectable()
export class ProductLinkService {
    private readonly logger =
        new Logger(ProductLinkService.name);

    constructor(
        private readonly prisma: PrismaService,
    ) {}

    // ==================== CRUD ====================

    async findAll(query: QueryProductLinkDto) {
        const { keyword, shopId, status } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;

        const where: any = { deletedAt: null };

        if (keyword) {
            where.name = {
                contains: keyword,
                mode: 'insensitive',
            };
        }

        if (shopId) {
            where.shopId = shopId;
        }

        if (status) {
            where.status = status;
        }

        const skip = (page - 1) * pageSize;

        const [list, total] = await Promise.all([
            this.prisma.productLink.findMany({
                where,
                skip,
                take: pageSize,
                include: LINK_INCLUDE,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            this.prisma.productLink.count({ where }),
        ]);

        // 计算每个链接的SKU统计
        const listWithSkuStats = list.map((link) => {
            const skus = link.skus || [];
            const skuStats = {
                total: skus.length,
                enabled: skus.filter((s) => s.status === 'ENABLED').length,
                disabled: skus.filter((s) => s.status === 'DISABLED').length,
            };
            const { skus: _, ...rest } = link;
            return {
                ...rest,
                skuStats,
            };
        });

        return {
            list: listWithSkuStats,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    async findById(id: string) {
        const link = await this.prisma.productLink
            .findFirst({
                where: { id, deletedAt: null },
                include: LINK_INCLUDE,
            });
        if (!link) {
            throw new NotFoundException('链接不存在');
        }

        // 计算SKU统计
        const skus = link.skus || [];
        const skuStats = {
            total: skus.length,
            enabled: skus.filter((s) => s.status === 'ENABLED').length,
            disabled: skus.filter((s) => s.status === 'DISABLED').length,
        };
        const { skus: _, ...rest } = link;
        return {
            ...rest,
            skuStats,
        };
    }

    async create(
        dto: CreateProductLinkDto,
        userId: string,
    ) {
        // 校验店铺存在
        const shop = await this.prisma.shop.findFirst({
            where: {
                id: dto.shopId,
                deletedAt: null,
            },
        });
        if (!shop) {
            throw new NotFoundException('店铺不存在');
        }

        const link = await this.prisma.productLink
            .create({
                data: {
                    ...dto,
                    createdBy: userId,
                    updatedBy: userId,
                },
                include: LINK_INCLUDE,
            });

        this.logger.log(`链接创建成功: ${link.name}`);
        return link;
    }

    async update(
        id: string,
        dto: UpdateProductLinkDto,
        userId: string,
    ) {
        await this.findById(id);

        // 如果更换店铺，校验新店铺存在
        if (dto.shopId) {
            const shop = await this.prisma.shop
                .findFirst({
                    where: {
                        id: dto.shopId,
                        deletedAt: null,
                    },
                });
            if (!shop) {
                throw new NotFoundException(
                    '店铺不存在',
                );
            }
        }

        const link = await this.prisma.productLink
            .update({
                where: { id },
                data: { ...dto, updatedBy: userId },
                include: LINK_INCLUDE,
            });

        this.logger.log(`链接更新成功: ${link.name}`);
        return link;
    }

    async delete(id: string, userId: string) {
        const link = await this.findById(id);

        const skuCount = await this.prisma.sku.count({
            where: { linkId: id, deletedAt: null },
        });
        if (skuCount > 0) {
            throw new ConflictException(
                '该链接下存在关联SKU，无法删除',
            );
        }

        await this.prisma.productLink.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedBy: userId,
            },
        });

        this.logger.log(`链接删除成功: ${link.name}`);
    }

    // ==================== 辅助接口 ====================

    async getShopsForSelect() {
        return this.prisma.shop.findMany({
            where: {
                status: 'ACTIVE',
                deletedAt: null,
            },
            select: {
                id: true,
                name: true,
                platform: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async reorderProductLinks(ids: string[]) {
        const maxOrder = await this.prisma.productLink.aggregate({
            _max: { sortOrder: true },
        });
        let baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.productLink.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }
}

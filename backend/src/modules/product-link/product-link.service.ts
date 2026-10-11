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

    /**
     * 链接列表
     * @param allowedShopIds 数据范围限定：非空时只看这些店铺的链接
     */
    async findAll(query: QueryProductLinkDto, allowedShopIds?: string[]) {
        const { keyword, shopId, status } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;

        const where: any = { deletedAt: null };

        // 数据范围限定：运营只能看到自己负责店铺的链接
        if (allowedShopIds) {
            where.shopId = { in: allowedShopIds };
        }

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

    async findById(id: string, allowedShopIds?: string[]) {
        const link = await this.prisma.productLink
            .findFirst({
                where: {
                    AND: [
                        { id, deletedAt: null },
                        // 数据范围限定：越权等同不存在（404，不泄露存在性）
                        ...(allowedShopIds ? [{ shopId: { in: allowedShopIds } }] : []),
                    ],
                },
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

    /**
     * 创建链接
     * @param allowedShopIds 数据范围限定：非空时只能建在可见店铺下
     */
    async create(
        dto: CreateProductLinkDto,
        userId: string,
        allowedShopIds?: string[],
    ) {
        // 校验店铺存在（数据范围限定时还要求店铺可见）
        // ⚠️ 用 AND 组合，避免与上面的 id 条件互相覆盖
        const shop = await this.prisma.shop.findFirst({
            where: {
                AND: [
                    { id: dto.shopId, deletedAt: null },
                    ...(allowedShopIds ? [{ id: { in: allowedShopIds } }] : []),
                ],
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
        allowedShopIds?: string[],
    ) {
        // 数据范围：链接不在可见范围内时等同不存在
        await this.findById(id, allowedShopIds);

        // 如果更换店铺，校验新店铺存在（且必须在可见范围内）
        if (dto.shopId) {
            const shop = await this.prisma.shop
                .findFirst({
                    where: {
                        AND: [
                            { id: dto.shopId, deletedAt: null },
                            ...(allowedShopIds ? [{ id: { in: allowedShopIds } }] : []),
                        ],
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

    async delete(id: string, userId: string, allowedShopIds?: string[]) {
        // 数据范围：链接不在可见范围内时等同不存在
        const link = await this.findById(id, allowedShopIds);

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

    /**
     * 店铺下拉
     * @param allowedShopIds 数据范围限定：非空时只返回可见店铺
     */
    async getShopsForSelect(allowedShopIds?: string[]) {
        return this.prisma.shop.findMany({
            where: {
                status: 'ACTIVE',
                deletedAt: null,
                ...(allowedShopIds ? { id: { in: allowedShopIds } } : {}),
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

    /**
     * 批量更新排序
     * @param allowedShopIds 数据范围限定：非空时全部目标链接都必须可见（否则整体拒绝）
     */
    async reorderProductLinks(ids: string[], allowedShopIds?: string[]) {
        if (allowedShopIds) {
            const owned = await this.prisma.productLink.count({
                where: {
                    id: { in: ids },
                    deletedAt: null,
                    shopId: { in: allowedShopIds },
                },
            });
            if (owned !== ids.length) {
                throw new NotFoundException('链接不存在');
            }
        }

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

import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ExpressService } from '../express/express.service';
import {
    CreateSkuDto,
    UpdateSkuDto,
    SkuQueryDto,
} from './dto/sku.dto';

const SKU_INCLUDE = {
    productLink: {
        select: {
            id: true,
            name: true,
            status: true,
            shop: {
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
            },
        },
    },
    expressCompany: {
        select: { id: true, name: true, code: true },
    },
    skuFinishedProducts: {
        include: {
            finishedProduct: {
                select: {
                    id: true,
                    code: true,
                    name: true,
                    weight: true,
                    totalCost: true,
                },
            },
        },
    },
};

@Injectable()
export class SkuService {
    private readonly logger = new Logger(SkuService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly expressService: ExpressService,
    ) {}

    // ==================== 成本计算 ====================

    async calculateAndUpdateCost(
        skuId: string,
    ): Promise<void> {
        const sku = await this.prisma.sku.findFirst({
            where: { id: skuId, deletedAt: null },
            include: {
                skuFinishedProducts: {
                    include: {
                        finishedProduct: {
                            select: {
                                totalCost: true,
                                weight: true,
                            },
                        },
                    },
                },
            },
        });
        if (!sku) return;

        // 1. 成品总成本
        let productCost = 0;
        for (const item of sku.skuFinishedProducts) {
            const fpCost =
                Number(item.finishedProduct.totalCost || 0);
            productCost += fpCost * item.quantity;
        }

        // 2. 快递费
        let expressCost = 0;
        if (sku.defaultExpressCompanyId && sku.weight > 0) {
            try {
                const result =
                    await this.expressService.calculateCost({
                        companyId:
                            sku.defaultExpressCompanyId,
                        province: '浙江省',
                        weight: sku.weight,
                    });
                expressCost = result.totalPrice;
            } catch {
                expressCost = 0;
            }
        }

        // 3. 总成本
        const totalCost = productCost
            + Number(sku.comboPackageFee)
            + expressCost
            + Number(sku.miscFee);

        await this.prisma.sku.update({
            where: { id: skuId },
            data: {
                productCost: Math.round(
                    productCost * 10000,
                ) / 10000,
                expressCost: Math.round(
                    expressCost * 10000,
                ) / 10000,
                totalCost: Math.round(
                    totalCost * 10000,
                ) / 10000,
            },
        });
    }

    // ==================== CRUD ====================

    /**
     * 创建 SKU
     * @param allowedShopIds 数据范围限定：非空时目标链接必须属于可见店铺
     */
    async create(
        dto: CreateSkuDto,
        userId: string,
        allowedShopIds?: string[],
    ) {
        const link =
            await this.prisma.productLink.findFirst({
                where: {
                    AND: [
                        { id: dto.linkId, deletedAt: null },
                        ...(allowedShopIds
                            ? [{ shopId: { in: allowedShopIds } }]
                            : []),
                    ],
                },
            });
        if (!link) {
            throw new NotFoundException('链接不存在');
        }

        if (
            !dto.finishedProductItems
            || dto.finishedProductItems.length === 0
        ) {
            throw new BadRequestException(
                '至少选择一个成品',
            );
        }

        const sku =
            await this.prisma.$transaction(async (tx) => {
                const created = await tx.sku.create({
                    data: {
                        name: dto.name,
                        linkId: dto.linkId,
                        type: dto.type,
                        weight: dto.weight,
                        miscFee: dto.miscFee ?? 0,
                        comboPackageFee:
                            dto.comboPackageFee ?? 0,
                        defaultExpressCompanyId:
                            dto.defaultExpressCompanyId,
                        status: dto.status,
                        remark: dto.remark,
                        createdBy: userId,
                        updatedBy: userId,
                    },
                });

                await tx.skuFinishedProduct.createMany({
                    data: dto.finishedProductItems.map(
                        (item) => ({
                            skuId: created.id,
                            finishedProductId:
                                item.finishedProductId,
                            quantity: item.quantity,
                        }),
                    ),
                });

                return created;
            });

        await this.calculateAndUpdateCost(sku.id);

        this.logger.log(`SKU创建成功: ${sku.name}`);
        return this.findById(sku.id, allowedShopIds);
    }

    async update(
        id: string,
        dto: UpdateSkuDto,
        userId: string,
        allowedShopIds?: string[],
    ) {
        const existing = await this.prisma.sku.findFirst({
            where: {
                AND: [
                    { id, deletedAt: null },
                    // 数据范围限定（经 链接→店铺）：越权等同不存在
                    ...(allowedShopIds
                        ? [{ productLink: { shopId: { in: allowedShopIds } } }]
                        : []),
                ],
            },
        });
        if (!existing) {
            throw new NotFoundException('SKU不存在');
        }

        await this.prisma.$transaction(async (tx) => {
            const updateData: any = {
                updatedBy: userId,
            };
            if (dto.type !== undefined) {
                updateData.type = dto.type;
            }
            if (dto.name !== undefined) {
                updateData.name = dto.name;
            }
            if (dto.weight !== undefined) {
                updateData.weight = dto.weight;
            }
            if (dto.miscFee !== undefined) {
                updateData.miscFee = dto.miscFee;
            }
            if (dto.comboPackageFee !== undefined) {
                updateData.comboPackageFee =
                    dto.comboPackageFee;
            }
            if (
                dto.defaultExpressCompanyId !== undefined
            ) {
                updateData.defaultExpressCompanyId =
                    dto.defaultExpressCompanyId;
            }
            if (dto.status !== undefined) {
                updateData.status = dto.status;
            }
            if (dto.remark !== undefined) {
                updateData.remark = dto.remark;
            }

            await tx.sku.update({
                where: { id },
                data: updateData,
            });

            // 全量替换成品关联
            if (dto.finishedProductItems !== undefined) {
                await tx.skuFinishedProduct.deleteMany({
                    where: { skuId: id },
                });
                if (dto.finishedProductItems.length) {
                    await tx.skuFinishedProduct
                        .createMany({
                            data: dto.finishedProductItems
                                .map((item) => ({
                                    skuId: id,
                                    finishedProductId:
                                        item.finishedProductId,
                                    quantity:
                                        item.quantity,
                                })),
                        });
                }
            }
        });

        await this.calculateAndUpdateCost(id);

        this.logger.log(`SKU更新成功: ${existing.name}`);
        return this.findById(id, allowedShopIds);
    }

    /**
     * 删除 SKU
     * @param allowedShopIds 数据范围限定：越权等同不存在（404）
     */
    async delete(id: string, userId: string, allowedShopIds?: string[]) {
        const sku = await this.prisma.sku.findFirst({
            where: {
                AND: [
                    { id, deletedAt: null },
                    ...(allowedShopIds
                        ? [{ productLink: { shopId: { in: allowedShopIds } } }]
                        : []),
                ],
            },
        });
        if (!sku) {
            throw new NotFoundException('SKU不存在');
        }

        await this.prisma.sku.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedBy: userId,
            },
        });

        this.logger.log(`SKU删除成功: ${sku.name}`);
    }

    async findById(id: string, allowedShopIds?: string[]) {
        const sku = await this.prisma.sku.findFirst({
            where: {
                AND: [
                    { id, deletedAt: null },
                    // 数据范围限定（经 链接→店铺）：越权等同不存在（404）
                    ...(allowedShopIds
                        ? [{ productLink: { shopId: { in: allowedShopIds } } }]
                        : []),
                ],
            },
            include: SKU_INCLUDE,
        });
        if (!sku) {
            throw new NotFoundException('SKU不存在');
        }
        return this.mapSku(sku);
    }

    /**
     * SKU 成本组成明细：SKU 汇总 + 每个成品的完整组成
     * 支持已删除 SKU（历史方案引用场景），但仍做店铺数据范围校验。
     */
    async getComposition(
        id: string,
        allowedShopIds?: string[],
    ) {
        const sku = await this.prisma.sku.findFirst({
            where: {
                AND: [
                    { id },
                    ...(allowedShopIds
                        ? [
                            {
                                productLink: {
                                    shopId: {
                                        in: allowedShopIds,
                                    },
                                },
                            },
                        ]
                        : []),
                ],
            },
            include: {
                productLink: {
                    include: {
                        shop: {
                            include: { platform: true },
                        },
                    },
                },
                expressCompany: true,
                skuFinishedProducts: {
                    include: {
                        finishedProduct: {
                            include: {
                                product: true,
                                supplierProduct: {
                                    include: {
                                        supplier: true,
                                    },
                                },
                                finishedProductConsumables:
                                {
                                    include: {
                                        consumable: {
                                            include: {
                                                consumablePrices:
                                                {
                                                    where: {
                                                        isCurrent:
                                                            true,
                                                    },
                                                    orderBy: {
                                                        effectDate:
                                                            'desc',
                                                    },
                                                    include: {
                                                        consumableSupplier:
                                                            true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                                finishedProductLabor: {
                                    include: {
                                        laborType: {
                                            include: {
                                                laborRates: {
                                                    where: {
                                                        isCurrent:
                                                            true,
                                                    },
                                                    orderBy: {
                                                        effectDate:
                                                            'desc',
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!sku) {
            throw new NotFoundException('SKU不存在');
        }

        const round4 = (v: number) =>
            Math.round(v * 10000) / 10000;

        const fpItems = sku.skuFinishedProducts.map(
            (item) => {
                const fp = item.finishedProduct as any;
                const unitCost = Number(
                    fp.totalCost || 0,
                );
                return {
                    quantity: item.quantity,
                    unitCost,
                    amount: round4(
                        unitCost * item.quantity,
                    ),
                    finishedProduct:
                        this.buildFpComposition(fp),
                };
            },
        );

        let computedProductCost = 0;
        for (const item of fpItems) {
            computedProductCost +=
                item.unitCost * item.quantity;
        }

        let computedExpressCost = 0;
        if (
            sku.defaultExpressCompanyId &&
            sku.weight > 0
        ) {
            try {
                const result =
                    await this.expressService.calculateCost(
                        {
                            companyId:
                                sku.defaultExpressCompanyId,
                            province: '浙江省',
                            weight: sku.weight,
                        },
                    );
                computedExpressCost = result.totalPrice;
            } catch {
                computedExpressCost = 0;
            }
        }

        const cachedTotal = Number(
            sku.totalCost || 0,
        );
        const computedTotal =
            computedProductCost +
            Number(sku.comboPackageFee || 0) +
            computedExpressCost +
            Number(sku.miscFee || 0);

        return {
            sku: {
                id: sku.id,
                name: sku.name,
                type: sku.type,
                status: sku.status,
                weight: sku.weight,
                updatedAt: sku.updatedAt,
                link: sku.productLink
                    ? {
                        id: sku.productLink.id,
                        name: sku.productLink.name,
                        shop: sku.productLink.shop
                            ? {
                                id: sku.productLink.shop
                                    .id,
                                name: sku.productLink.shop
                                    .name,
                                platform: sku
                                    .productLink.shop
                                    .platform
                                    ? {
                                        id: sku
                                            .productLink
                                            .shop
                                            .platform.id,
                                        name: sku
                                            .productLink
                                            .shop
                                            .platform.name,
                                    }
                                    : null,
                            }
                            : null,
                    }
                    : null,
                express: {
                    companyId:
                        sku.defaultExpressCompanyId,
                    companyName:
                        sku.expressCompany?.name ??
                        null,
                    weight: sku.weight,
                    cost: Number(sku.expressCost || 0),
                },
            },
            costs: {
                productCost: Number(
                    sku.productCost || 0,
                ),
                comboPackageFee: Number(
                    sku.comboPackageFee || 0,
                ),
                expressCost: Number(
                    sku.expressCost || 0,
                ),
                miscFee: Number(sku.miscFee || 0),
                totalCost: cachedTotal,
            },
            finishedProducts: fpItems,
            computed: {
                productCost: round4(
                    computedProductCost,
                ),
                totalCost: round4(computedTotal),
                matchesCached:
                    round4(cachedTotal) ===
                    round4(computedTotal),
                diff: round4(
                    computedTotal - cachedTotal,
                ),
            },
        };
    }

    /** 成品组成结构（与成品 composition 接口保持一致） */
    private buildFpComposition(fp: any) {
        const round4 = (v: number) =>
            Math.round(v * 10000) / 10000;

        const consumableItems = (
            fp.finishedProductConsumables || []
        ).map((item: any) => {
            const prices =
                item.consumable?.consumablePrices || [];
            const currentPrice = prices[0];
            const unitPrice = currentPrice
                ? Number(currentPrice.unitPrice)
                : null;
            return {
                id: item.id,
                consumableId: item.consumableId,
                code: item.consumable?.code,
                name: item.consumable?.name,
                image: item.consumable?.image,
                quantity: item.quantity,
                unitPrice,
                amount:
                    unitPrice != null
                        ? round4(
                            unitPrice * item.quantity,
                        )
                        : 0,
                supplierName:
                    currentPrice?.consumableSupplier
                        ?.name ?? null,
                supplierCount: prices.length,
                hasCurrentPrice: !!currentPrice,
            };
        });

        const laborItems = (
            fp.finishedProductLabor || []
        ).map((item: any) => {
            const rates =
                item.laborType?.laborRates || [];
            const currentRate = rates[0];
            const unitPrice = currentRate
                ? Number(currentRate.unitPrice)
                : null;
            const qty = item.quantity ?? 1;
            return {
                id: item.id,
                laborTypeId: item.laborTypeId,
                code: item.laborType?.code,
                name: item.laborType?.name,
                image: item.laborType?.image,
                billingType: item.laborType?.billingType,
                quantity: qty,
                unitPrice,
                amount:
                    unitPrice != null
                        ? round4(unitPrice * qty)
                        : 0,
                hasCurrentRate: !!currentRate,
            };
        });

        return {
            finishedProduct: {
                id: fp.id,
                code: fp.code,
                name: fp.name,
                image: fp.image,
                status: fp.status,
                weight: fp.weight,
                packageType: fp.packageType,
                packageQuantity: fp.packageQuantity,
                packageUnit: fp.packageUnit,
                updatedAt: fp.updatedAt,
            },
            product: fp.product
                ? {
                    id: fp.product.id,
                    code: fp.product.code,
                    name: fp.product.name,
                    mainImage: fp.product.mainImage,
                    pricingMode: fp.product.pricingMode,
                }
                : null,
            supplierProduct: fp.supplierProduct
                ? {
                    id: fp.supplierProduct.id,
                    styleName:
                        fp.supplierProduct.styleName,
                    supplyPrice:
                        fp.supplierProduct.supplyPrice,
                    priceUnit:
                        fp.supplierProduct.priceUnit,
                    priceUnitCustom:
                        fp.supplierProduct
                            .priceUnitCustom,
                    supplier:
                        fp.supplierProduct.supplier
                            ? {
                                id: fp.supplierProduct
                                    .supplier.id,
                                name: fp.supplierProduct
                                    .supplier.name,
                            }
                            : null,
                }
                : null,
            cut: {
                length: fp.cutLength,
                width: fp.cutWidth,
                height: fp.cutHeight,
                unitWeight: fp.unitWeight,
            },
            costs: {
                materialCost: Number(
                    fp.materialCost || 0,
                ),
                consumableCost: Number(
                    fp.consumableCost || 0,
                ),
                laborCost: Number(fp.laborCost || 0),
                totalCost: Number(fp.totalCost || 0),
            },
            consumableItems,
            laborItems,
        };
    }

    /**
     * SKU 列表
     * @param allowedShopIds 数据范围限定：非空时只看这些店铺下的 SKU（经 链接→店铺 归属）
     */
    async findAll(query: SkuQueryDto, allowedShopIds?: string[]) {
        const { keyword, linkId, status } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;

        const where: any = { deletedAt: null };

        // 数据范围限定：运营只能看到自己负责店铺的 SKU
        if (allowedShopIds) {
            where.productLink = { shopId: { in: allowedShopIds } };
        }

        if (linkId) where.linkId = linkId;
        if (status) where.status = status;

        if (keyword) {
            where.name = {
                contains: keyword,
                mode: 'insensitive',
            };
        }

        const skip = (page - 1) * pageSize;

        const [list, total] = await Promise.all([
            this.prisma.sku.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
                include: SKU_INCLUDE,
            }),
            this.prisma.sku.count({ where }),
        ]);

        return {
            list: list.map((s: any) => this.mapSku(s)),
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    /**
     * 重算 SKU 成本
     * @param allowedShopIds 数据范围限定：越权等同不存在（404）
     */
    async recalculate(id: string, userId: string, allowedShopIds?: string[]) {
        const sku = await this.prisma.sku.findFirst({
            where: {
                AND: [
                    { id, deletedAt: null },
                    ...(allowedShopIds
                        ? [{ productLink: { shopId: { in: allowedShopIds } } }]
                        : []),
                ],
            },
        });
        if (!sku) {
            throw new NotFoundException('SKU不存在');
        }

        await this.calculateAndUpdateCost(id);
        return this.findById(id, allowedShopIds);
    }

    // ==================== 辅助接口 ====================

    /**
     * 链接下拉
     * @param allowedShopIds 数据范围限定：非空时只返回可见店铺下的链接
     */
    async getLinksForSelect(allowedShopIds?: string[]) {
        return this.prisma.productLink.findMany({
            where: {
                deletedAt: null,
                status: { in: ['DRAFT', 'ON_SALE'] },
                ...(allowedShopIds ? { shopId: { in: allowedShopIds } } : {}),
            },
            select: {
                id: true,
                name: true,
                status: true,
                shop: {
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
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getFinishedProductsForSelect() {
        return this.prisma.finishedProduct.findMany({
            where: {
                deletedAt: null,
                status: 'ENABLED',
            },
            select: {
                id: true,
                code: true,
                name: true,
                weight: true,
                totalCost: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    private mapSku(sku: any) {
        const { productLink, skuFinishedProducts, ...rest } = sku;
        return {
            ...rest,
            link: productLink || null,
            finishedProducts: skuFinishedProducts || [],
        };
    }

    /**
     * 批量更新排序
     * @param allowedShopIds 数据范围限定：非空时全部目标 SKU 都必须可见（否则整体拒绝）
     */
    async reorderSkus(ids: string[], allowedShopIds?: string[]) {
        if (allowedShopIds) {
            const owned = await this.prisma.sku.count({
                where: {
                    id: { in: ids },
                    deletedAt: null,
                    productLink: { shopId: { in: allowedShopIds } },
                },
            });
            if (owned !== ids.length) {
                throw new NotFoundException('SKU不存在');
            }
        }

        const maxOrder = await this.prisma.sku.aggregate({
            _max: { sortOrder: true },
        });
        let baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.sku.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }
}

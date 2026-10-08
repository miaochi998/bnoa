import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    QueryFinishedProductDto,
    CreateFinishedProductDto,
    UpdateFinishedProductDto,
} from './dto/finished-product.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class FinishedProductService {
    private readonly logger =
        new Logger(FinishedProductService.name);

    constructor(
        private readonly prisma: PrismaService,
    ) {}

    // ==================== 编码生成 ====================

    private async generateCode(): Promise<string> {
        const today = new Date();
        const dateStr = today.toISOString()
            .slice(0, 10).replace(/-/g, '');
        const pattern = `FP${dateStr}`;

        const last =
            await this.prisma.finishedProduct.findFirst({
                where: { code: { startsWith: pattern } },
                orderBy: { code: 'desc' },
                select: { code: true },
            });

        const seq = last
            ? parseInt(last.code.slice(-3), 10) + 1
            : 1;
        return `${pattern}${String(seq).padStart(3, '0')}`;
    }

    // ==================== 成本计算 ====================

    async calculateCost(
        fpId: string,
    ): Promise<{
        materialCost: number;
        consumableCost: number;
        laborCost: number;
        totalCost: number;
    }> {
        const fp =
            await this.prisma.finishedProduct.findFirst({
                where: { id: fpId, deletedAt: null },
                include: {
                    product: true,
                    supplierProduct: true,
                    finishedProductConsumables: {
                        include: {
                            consumable: {
                                include: { consumablePrices: {
                                        where: {
                                            isCurrent: true,
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
                                            isCurrent: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

        if (!fp) {
            throw new NotFoundException('成品不存在');
        }

        // 1. 原料成本
        let materialCost = 0;
        const supplyPrice =
            Number(fp.supplierProduct.supplyPrice);
        const mode = fp.product.pricingMode;
        const l = Number(fp.cutLength || 0);
        const w = Number(fp.cutWidth || 0);
        const h = Number(fp.cutHeight || 0);
        const uw = Number(fp.unitWeight || 0);
        const qty = fp.packageQuantity;

        switch (mode) {
            case 'VOLUME':
                if (l > 0 && w > 0 && h > 0) {
                    const volumeM3 =
                        (l * w * h) / 1_000_000;
                    materialCost =
                        supplyPrice * volumeM3 * qty;
                }
                break;
            case 'WEIGHT':
                if (uw > 0) {
                    const weightTon =
                        uw / 1_000_000;
                    materialCost =
                        supplyPrice * weightTon * qty;
                }
                break;
            case 'AREA':
                if (l > 0 && w > 0) {
                    const areaM2 =
                        (l * w) / 10_000;
                    materialCost =
                        supplyPrice * areaM2 * qty;
                }
                break;
            case 'LENGTH':
                if (l > 0) {
                    const lengthM = l / 100;
                    materialCost =
                        supplyPrice * lengthM * qty;
                }
                break;
            case 'UNIT':
            default:
                materialCost = supplyPrice * qty;
                break;
        }

        // 2. 耗材成本
        let consumableCost = 0;
        for (const item of fp.finishedProductConsumables) {
            const currentPrice =
                item.consumable.consumablePrices[0];
            if (currentPrice) {
                consumableCost +=
                    Number(currentPrice.unitPrice)
                    * item.quantity;
            }
        }

        // 3. 工费成本
        let laborCost = 0;
        for (const item of fp.finishedProductLabor) {
            const currentRate =
                item.laborType.laborRates[0];
            if (currentRate) {
                laborCost +=
                    Number(currentRate.unitPrice);
            }
        }

        const totalCost =
            materialCost + consumableCost + laborCost;

        return {
            materialCost: Math.round(
                materialCost * 10000,
            ) / 10000,
            consumableCost: Math.round(
                consumableCost * 10000,
            ) / 10000,
            laborCost: Math.round(
                laborCost * 10000,
            ) / 10000,
            totalCost: Math.round(
                totalCost * 10000,
            ) / 10000,
        };
    }

    private async updateCostCache(
        fpId: string,
    ): Promise<void> {
        const cost = await this.calculateCost(fpId);
        await this.prisma.finishedProduct.update({
            where: { id: fpId },
            data: {
                materialCost: cost.materialCost,
                consumableCost: cost.consumableCost,
                laborCost: cost.laborCost,
                totalCost: cost.totalCost,
            },
        });
    }

    // ==================== CRUD ====================

    async findAll(query: QueryFinishedProductDto) {
        const {
            keyword,
            status,
            page = 1,
            pageSize = 10,
        } = query;

        const where: any = { deletedAt: null };
        if (keyword) {
            where.OR = [
                {
                    name: {
                        contains: keyword,
                        mode: 'insensitive',
                    },
                },
                {
                    code: {
                        contains: keyword,
                        mode: 'insensitive',
                    },
                },
            ];
        }
        if (status) where.status = status;

        const [list, total] = await Promise.all([
            this.prisma.finishedProduct.findMany({
                where,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    product: {
                    select: {
                            id: true,
                            name: true,
                            code: true,
                            pricingMode: true,
                        },
                    },
                    supplierProduct: {
                        select: {
                            id: true,
                            styleName: true,
                            supplyPrice: true,
                            priceUnit: true,
                            priceUnitCustom: true,
                            supplier: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    finishedProductConsumables: {
                        include: {
                            consumable: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                },
                            },
                        },
                    },
                    finishedProductLabor: {
                        include: {
                            laborType: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.finishedProduct.count({ where }),
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

    async findById(id: string) {
        const item =
            await this.prisma.finishedProduct.findFirst({
                where: { id, deletedAt: null },
                include: {
                    product: {
                    select: {
                            id: true,
                            name: true,
                            code: true,
                            pricingMode: true,
                        },
                    },
                    supplierProduct: {
                        select: {
                            id: true,
                            styleName: true,
                            supplyPrice: true,
                            priceUnit: true,
                            priceUnitCustom: true,
                            supplier: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    finishedProductConsumables: {
                        include: {
                            consumable: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                },
                            },
                        },
                    },
                    finishedProductLabor: {
                        include: {
                            laborType: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true,
                                },
                            },
                        },
                    },
                },
            });

        if (!item) {
            throw new NotFoundException('成品不存在');
        }
        return item;
    }

    async create(
        dto: CreateFinishedProductDto,
        userId: string,
    ) {
        // 校验产品存在
        const product =
            await this.prisma.product.findFirst({
                where: {
                    id: dto.productId,
                    deletedAt: null,
                },
            });
        if (!product) {
            throw new NotFoundException('产品不存在');
        }

        // 校验供应商价格存在
        const sp =
            await this.prisma.supplierProduct.findFirst({
                where: {
                    id: dto.supplierProductId,
                    deletedAt: null,
                },
            });
        if (!sp) {
            throw new NotFoundException(
                '供应商价格记录不存在',
            );
        }

        // 按计价方式校验必填字段
        const mode = product.pricingMode;
        if (mode === 'VOLUME') {
            if (!dto.cutLength || !dto.cutWidth
                || !dto.cutHeight) {
                throw new BadRequestException(
                    '按体积计价必须填写切割长/宽/高',
                );
            }
        } else if (mode === 'WEIGHT') {
            if (!dto.unitWeight) {
                throw new BadRequestException(
                    '按重量计价必须填写每份重量',
                );
            }
        } else if (mode === 'AREA') {
            if (!dto.cutLength || !dto.cutWidth) {
                throw new BadRequestException(
                    '按面积计价必须填写切割长/宽',
                );
            }
        } else if (mode === 'LENGTH') {
            if (!dto.cutLength) {
                throw new BadRequestException(
                    '按长度计价必须填写切割长度',
                );
            }
        }

        const code = await this.generateCode();

        // 事务：创建成品 + 关联耗材/工费
        const fp =
            await this.prisma.$transaction(async (tx) => {
                const created =
                    await tx.finishedProduct.create({
                        data: {
                            code,
                            name: dto.name,
                            productId: dto.productId,
                            supplierProductId:
                                dto.supplierProductId,
                            cutLength: dto.cutLength,
                            cutWidth: dto.cutWidth,
                            cutHeight: dto.cutHeight,
                            unitWeight: dto.unitWeight,
                            packageType: dto.packageType,
                            packageQuantity:
                                dto.packageQuantity,
                            packageUnit: dto.packageUnit,
                            weight: dto.weight,
                            status: dto.status,
                            remark: dto.remark,
                            createdBy: userId,
                            updatedBy: userId,
                        },
                    });

                // 创建耗材关联
                if (dto.consumableItems?.length) {
                    await tx
                        .finishedProductConsumable
                        .createMany({
                            data: dto.consumableItems
                                .map((item) => ({
                                    finishedProductId:
                                        created.id,
                                    consumableId:
                                        item.consumableId,
                                    quantity:
                                        item.quantity,
                                })),
                        });
                }

                // 创建工费关联
                if (dto.laborItems?.length) {
                    await tx
                        .finishedProductLabor
                        .createMany({
                            data: dto.laborItems
                                .map((item) => ({
                                    finishedProductId:
                                        created.id,
                                    laborTypeId:
                                        item.laborTypeId,
                                })),
                        });
                }

                return created;
            });

        // 计算并缓存成本
        await this.updateCostCache(fp.id);

        return this.findById(fp.id);
    }

    async update(
        id: string,
        dto: UpdateFinishedProductDto,
        userId: string,
    ) {
        const existing =
            await this.prisma.finishedProduct.findFirst({
                where: { id, deletedAt: null },
                include: { product: true },
            });
        if (!existing) {
            throw new NotFoundException('成品不存在');
        }

        // 如果更新了供应商价格，校验存在
        if (dto.supplierProductId) {
            const sp =
                await this.prisma.supplierProduct
                    .findFirst({
                        where: {
                            id: dto.supplierProductId,
                            deletedAt: null,
                        },
                    });
            if (!sp) {
                throw new NotFoundException(
                    '供应商价格记录不存在',
                );
            }
        }

        await this.prisma.$transaction(async (tx) => {
            // 更新基本信息
            const updateData: any = {
                updatedBy: userId,
            };
            if (dto.name !== undefined) {
                updateData.name = dto.name;
            }
            if (dto.supplierProductId !== undefined) {
                updateData.supplierProductId =
                    dto.supplierProductId;
            }
            if (dto.cutLength !== undefined) {
                updateData.cutLength = dto.cutLength;
            }
            if (dto.cutWidth !== undefined) {
                updateData.cutWidth = dto.cutWidth;
            }
            if (dto.cutHeight !== undefined) {
                updateData.cutHeight = dto.cutHeight;
            }
            if (dto.unitWeight !== undefined) {
                updateData.unitWeight = dto.unitWeight;
            }
            if (dto.packageType !== undefined) {
                updateData.packageType = dto.packageType;
            }
            if (dto.packageQuantity !== undefined) {
                updateData.packageQuantity =
                    dto.packageQuantity;
            }
            if (dto.packageUnit !== undefined) {
                updateData.packageUnit = dto.packageUnit;
            }
            if (dto.weight !== undefined) {
                updateData.weight = dto.weight;
            }
            if (dto.status !== undefined) {
                updateData.status = dto.status;
            }
            if (dto.remark !== undefined) {
                updateData.remark = dto.remark;
            }

            await tx.finishedProduct.update({
                where: { id },
                data: updateData,
            });

            // 更新耗材关联（全量替换）
            if (dto.consumableItems !== undefined) {
                await tx
                    .finishedProductConsumable
                    .deleteMany({
                        where: {
                            finishedProductId: id,
                        },
                    });
                if (dto.consumableItems.length) {
                    await tx
                        .finishedProductConsumable
                        .createMany({
                            data: dto.consumableItems
                                .map((item) => ({
                                    finishedProductId: id,
                                    consumableId:
                                        item.consumableId,
                                    quantity:
                                        item.quantity,
                                })),
                        });
                }
            }

            // 更新工费关联（全量替换）
            if (dto.laborItems !== undefined) {
                await tx
                    .finishedProductLabor
                    .deleteMany({
                        where: {
                            finishedProductId: id,
                        },
                    });
                if (dto.laborItems.length) {
                    await tx
                        .finishedProductLabor
                        .createMany({
                            data: dto.laborItems
                                .map((item) => ({
                                    finishedProductId: id,
                                    laborTypeId:
                                        item.laborTypeId,
                                })),
                        });
                }
            }
        });

        // 重算成本
        await this.updateCostCache(id);

        return this.findById(id);
    }

    async delete(id: string, userId: string) {
        const item =
            await this.prisma.finishedProduct.findFirst({
                where: { id, deletedAt: null },
            });
        if (!item) {
            throw new NotFoundException('成品不存在');
        }

        const skuRefs = await this.prisma.skuFinishedProduct.findMany({
            where: { finishedProductId: id },
            include: { sku: true },
        });
        const activeSkuCount = skuRefs.filter(r => r.sku.deletedAt === null).length;
        if (activeSkuCount > 0) {
            throw new ConflictException(
                '该成品被SKU引用，无法删除',
            );
        }

        return this.prisma.finishedProduct.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedBy: userId,
            },
        });
    }

    async recalculate(id: string, userId: string) {
        const item =
            await this.prisma.finishedProduct.findFirst({
                where: { id, deletedAt: null },
            });
        if (!item) {
            throw new NotFoundException('成品不存在');
        }

        await this.updateCostCache(id);
        return this.findById(id);
    }

    // ==================== 辅助接口 ====================

    async getProductsForSelect() {
        return this.prisma.product.findMany({
            where: { deletedAt: null },
            select: {
                id: true,
                name: true,
                code: true,
                pricingMode: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    async getSupplierProductsByProduct(
        productId: string,
    ) {
        return this.prisma.supplierProduct.findMany({
            where: {
                productId,
                deletedAt: null,
            },
            select: {
                id: true,
                styleName: true,
                supplyPrice: true,
                priceUnit: true,
                priceUnitCustom: true,
                supplier: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getConsumablesForSelect() {
        return this.prisma.consumable.findMany({
            where: {
                deletedAt: null,
                status: 'ENABLED',
            },
            select: {
                id: true,
                name: true,
                code: true,
                consumablePrices: {
                    where: { isCurrent: true },
                    select: { unitPrice: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    async getLaborTypesForSelect() {
        return this.prisma.laborType.findMany({
            where: {
                deletedAt: null,
                status: 'ENABLED',
            },
            select: {
                id: true,
                name: true,
                code: true,
                billingType: true,
                laborRates: {
                    where: { isCurrent: true },
                    select: {
                        unitPrice: true,
                        unit: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    async reorderFinishedProducts(ids: string[]) {
        if (ids.length === 0) return;

        const current = await this.prisma.finishedProduct.findMany({
            where: { id: { in: ids } },
            select: { sortOrder: true },
        });
        const minOrder = Math.min(...current.map((r) => r.sortOrder));

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.finishedProduct.update({
                    where: { id },
                    data: { sortOrder: minOrder + index },
                }),
            ),
        );
    }
}

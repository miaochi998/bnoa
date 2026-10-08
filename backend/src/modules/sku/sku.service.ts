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

    async create(dto: CreateSkuDto, userId: string) {
        const link =
            await this.prisma.productLink.findFirst({
                where: { id: dto.linkId, deletedAt: null },
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
        return this.findById(sku.id);
    }

    async update(
        id: string,
        dto: UpdateSkuDto,
        userId: string,
    ) {
        const existing = await this.prisma.sku.findFirst({
            where: { id, deletedAt: null },
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
        return this.findById(id);
    }

    async delete(id: string, userId: string) {
        const sku = await this.prisma.sku.findFirst({
            where: { id, deletedAt: null },
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

    async findById(id: string) {
        const sku = await this.prisma.sku.findFirst({
            where: { id, deletedAt: null },
            include: SKU_INCLUDE,
        });
        if (!sku) {
            throw new NotFoundException('SKU不存在');
        }
        return this.mapSku(sku);
    }

    async findAll(query: SkuQueryDto) {
        const { keyword, linkId, status } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;

        const where: any = { deletedAt: null };

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

    async recalculate(id: string, userId: string) {
        const sku = await this.prisma.sku.findFirst({
            where: { id, deletedAt: null },
        });
        if (!sku) {
            throw new NotFoundException('SKU不存在');
        }

        await this.calculateAndUpdateCost(id);
        return this.findById(id);
    }

    // ==================== 辅助接口 ====================

    async getLinksForSelect() {
        return this.prisma.productLink.findMany({
            where: {
                deletedAt: null,
                status: { in: ['DRAFT', 'ON_SALE'] },
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

    async reorderSkus(ids: string[]) {
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

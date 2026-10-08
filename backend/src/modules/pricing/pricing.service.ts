import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    CalculatePricingDto,
    CommissionAnalysisDto,
    SavePricingPlanDto,
    UpdatePricingPlanDto,
    PricingPlanQueryDto,
} from './dto/pricing.dto';

const PLAN_INCLUDE = {
    productLink: {
        select: {
            id: true,
            name: true,
            shop: {
                select: {
                    id: true,
                    name: true,
                    platform: {
                        select: { id: true, name: true },
                    },
                },
            },
        },
    },
};

@Injectable()
export class PricingService {
    private readonly logger =
        new Logger(PricingService.name);

    constructor(
        private readonly prisma: PrismaService,
    ) {}

    // ==================== 计算引擎 ====================

    async calculateMatrix(dto: CalculatePricingDto) {
        const taxRate = dto.taxRate ?? 0;
        const divisor =
            1 - dto.commissionRate - taxRate;
        if (divisor <= 0) {
            throw new BadRequestException(
                '佣金率+税费率之和不能 >= 100%',
            );
        }

        const skus = await this.getSkusByLink(
            dto.linkId,
        );

        return {
            link: skus.length > 0
                ? skus[0].productLink : null,
            skus: skus.map((sku) => {
                const cost = Number(sku.totalCost || 0);
                return {
                    skuId: sku.id,
                    skuName: sku.name,
                    skuType: sku.type,
                    skuCost: this.round4(cost),
                    prices: dto.profitRates.map(
                        (rate) => {
                            const sp = cost
                                * (1 + rate)
                                / divisor;
                            const gp = sp * divisor
                                - cost;
                            return {
                                profitRate: rate,
                                sellingPrice:
                                    this.round2(sp),
                                grossProfit:
                                    this.round2(gp),
                                netProfitRate:
                                    sp > 0
                                        ? this.round4(
                                            gp / sp,
                                        ) : 0,
                            };
                        },
                    ),
                };
            }),
        };
    }

    async analyzeCommission(
        dto: CommissionAnalysisDto,
    ) {
        const skus = await this.getSkusByLink(
            dto.linkId,
        );
        const skuMap = new Map(
            skus.map((s) => [s.id, s]),
        );

        return dto.sellingPrices.map((item) => {
            const sku = skuMap.get(item.skuId);
            if (!sku) return null;

            const cost = Number(sku.totalCost || 0);
            const sp = item.price;
            const grossProfit = sp - cost;
            const breakEven = sp > 0
                ? this.round4(1 - cost / sp)
                : 0;

            return {
                skuId: sku.id,
                skuName: sku.name,
                skuCost: this.round4(cost),
                sellingPrice: sp,
                grossProfit: this.round2(grossProfit),
                grossProfitRate: sp > 0
                    ? this.round4(grossProfit / sp)
                    : 0,
                breakEvenCommission: breakEven,
            };
        }).filter(Boolean);
    }

    // ==================== 方案 CRUD ====================

    async savePlan(
        dto: SavePricingPlanDto,
        userId: string,
    ) {
        await this.validateLink(dto.linkId);

        const plan =
            await this.prisma.pricingPlan.create({
                data: {
                    linkId: dto.linkId,
                    name: dto.name,
                    profitRates: dto.profitRates,
                    commissionRate: dto.commissionRate,
                    taxRate: dto.taxRate ?? 0,
                    selectedPrices:
                        dto.selectedPrices ?? undefined,
                    talentCommissionRate:
                        dto.talentCommissionRate
                            ?? undefined,
                    remark: dto.remark,
                    createdBy: userId,
                    updatedBy: userId,
                },
                include: PLAN_INCLUDE,
            });

        this.logger.log(
            `定价方案创建: ${plan.name}`,
        );
        return plan;
    }

    async updatePlan(
        id: string,
        dto: UpdatePricingPlanDto,
        userId: string,
    ) {
        await this.findPlanById(id);

        const updateData: any = {
            updatedBy: userId,
        };
        if (dto.name !== undefined) {
            updateData.name = dto.name;
        }
        if (dto.selectedPrices !== undefined) {
            updateData.selectedPrices =
                dto.selectedPrices;
        }
        if (dto.talentCommissionRate !== undefined) {
            updateData.talentCommissionRate =
                dto.talentCommissionRate;
        }
        if (dto.remark !== undefined) {
            updateData.remark = dto.remark;
        }

        const plan =
            await this.prisma.pricingPlan.update({
                where: { id },
                data: updateData,
                include: PLAN_INCLUDE,
            });

        this.logger.log(
            `定价方案更新: ${plan.name}`,
        );
        return plan;
    }

    async deletePlan(id: string, userId: string) {
        const plan = await this.findPlanById(id);

        await this.prisma.pricingPlan.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedBy: userId,
            },
        });

        this.logger.log(
            `定价方案删除: ${plan.name}`,
        );
    }

    async findPlanById(id: string) {
        const plan =
            await this.prisma.pricingPlan.findFirst({
                where: { id, deletedAt: null },
                include: PLAN_INCLUDE,
            });
        if (!plan) {
            throw new NotFoundException(
                '定价方案不存在',
            );
        }
        return plan;
    }

    async findAllPlans(query: PricingPlanQueryDto) {
        const { keyword, linkId } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;
        const withSummary = query.withSummary ?? false;

        const where: any = { deletedAt: null };

        if (linkId) where.linkId = linkId;
        if (keyword) {
            where.name = {
                contains: keyword,
                mode: 'insensitive',
            };
        }

        const skip = (page - 1) * pageSize;

        const [list, total] = await Promise.all([
            this.prisma.pricingPlan.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                include: PLAN_INCLUDE,
            }),
            this.prisma.pricingPlan.count({ where }),
        ]);

        let enrichedList = list as any[];
        if (withSummary) {
            enrichedList =
                await this.enrichPlansWithSummary(list);
        }

        return {
            list: enrichedList,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(
                    total / pageSize,
                ),
            },
        };
    }

    private async enrichPlansWithSummary(
        plans: any[],
    ) {
        const linkIds = [
            ...new Set(plans.map((p) => p.linkId)),
        ];
        if (linkIds.length === 0) return plans;

        const allSkus =
            await this.prisma.sku.findMany({
                where: {
                    linkId: { in: linkIds },
                    deletedAt: null,
                    status: 'ENABLED',
                },
                select: {
                    id: true,
                    name: true,
                    type: true,
                    totalCost: true,
                    linkId: true,
                },
            });

        const skusByLink = new Map<string, typeof allSkus>();
        for (const sku of allSkus) {
            const arr = skusByLink.get(sku.linkId) || [];
            arr.push(sku);
            skusByLink.set(sku.linkId, arr);
        }

        return plans.map((plan) => {
            const skus = skusByLink.get(plan.linkId) || [];
            const commRate = Number(plan.commissionRate);
            const tax = Number(plan.taxRate || 0);
            const divisor = 1 - commRate - tax;
            const selectedPrices =
                (plan.selectedPrices as Record<string, number>) || {};
            const profitRates =
                (plan.profitRates || []).map(Number);
            const defaultRate =
                profitRates.length > 0 ? profitRates[0] : 0;

            const skuSummaries = skus.map((sku) => {
                const cost = Number(sku.totalCost || 0);
                const rate = selectedPrices[sku.id] != null
                    ? Number(selectedPrices[sku.id])
                    : defaultRate;
                const sp = divisor > 0
                    ? cost * (1 + rate) / divisor : 0;
                const gp = sp * divisor - cost;
                const commission = sp * commRate;
                return {
                    skuId: sku.id,
                    skuName: sku.name,
                    skuType: sku.type,
                    cost: this.round2(cost),
                    sellingPrice: this.round2(sp),
                    grossProfit: this.round2(gp),
                    profitRate: sp > 0
                        ? this.round4(gp / sp) : 0,
                    commission: this.round2(commission),
                };
            });

            return { ...plan, skuSummaries };
        });
    }

    // ==================== 辅助 ====================

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

    // ==================== 私有方法 ====================

    private async getSkusByLink(linkId: string) {
        await this.validateLink(linkId);

        return this.prisma.sku.findMany({
            where: {
                linkId,
                deletedAt: null,
                status: 'ENABLED',
            },
            select: {
                id: true,
                name: true,
                type: true,
                totalCost: true,
                productLink: {
                    select: {
                        id: true,
                        name: true,
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
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    private async validateLink(linkId: string) {
        const link =
            await this.prisma.productLink.findFirst({
                where: {
                    id: linkId,
                    deletedAt: null,
                },
            });
        if (!link) {
            throw new NotFoundException(
                '链接不存在',
            );
        }
        return link;
    }

    private round2(v: number): number {
        return Math.round(v * 100) / 100;
    }

    private round4(v: number): number {
        return Math.round(v * 10000) / 10000;
    }
}

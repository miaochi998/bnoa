import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
    CreateExpressCompanyDto,
    UpdateExpressCompanyDto,
    QueryExpressCompanyDto,
    UpdateZoneDto,
    BatchUpdateZonesDto,
    UpdateWeightRangeDto,
    BatchUpdatePricesDto,
    CopyPricesDto,
    CreateSurchargeDto,
    UpdateSurchargeDto,
    CalculateExpressCostDto,
} from './dto/express.dto';

@Injectable()
export class ExpressService {
    private readonly logger = new Logger(ExpressService.name);

    constructor(private readonly prisma: PrismaService) {}

    // ========== 快递公司管理 ==========

    async findAllCompanies(query: QueryExpressCompanyDto) {
        const { keyword, status } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const where: any = { deletedAt: null };

        if (keyword) {
            where.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { code: { contains: keyword, mode: 'insensitive' } },
            ];
        }

        if (status) {
            where.status = status;
        }

        const skip = (page - 1) * pageSize;

        const [list, total] = await Promise.all([
            this.prisma.expressCompany.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
            }),
            this.prisma.expressCompany.count({ where }),
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

    async findAllCompaniesForSelect() {
        return this.prisma.expressCompany.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        });
    }

    async findCompanyById(id: string) {
        const company = await this.prisma.expressCompany.findFirst({
            where: { id, deletedAt: null },
        });
        if (!company) {
            throw new NotFoundException('快递公司不存在');
        }
        return company;
    }

    async createCompany(
        dto: CreateExpressCompanyDto,
        userId: string,
    ) {
        const existing = await this.prisma.expressCompany.findFirst({
            where: { code: dto.code, deletedAt: null },
        });
        if (existing) {
            throw new ConflictException(
                `快递公司编码 ${dto.code} 已存在`,
            );
        }

        const company = await this.prisma.expressCompany.create({
            data: {
                ...dto,
                status: dto.status || 'ACTIVE',
                createdBy: userId,
                updatedBy: userId,
            },
        });

        await this.initializeCompanyDefaults(company.id);

        this.logger.log(`快递公司创建成功: ${company.name}`);
        return company;
    }

    /**
     * 初始化快递公司默认配置
     */
    private async initializeCompanyDefaults(companyId: string) {
        // 创建默认区域
        const defaultZones = [
            { name: '省内', sortOrder: 1, provinces: ['浙江省'] },
            { name: '二区', sortOrder: 2, provinces: ['江苏省', '安徽省', '上海市'] },
            { name: '三区', sortOrder: 3, provinces: ['北京市', '天津市', '河北省', '山西省', '山东省', '河南省', '湖北省', '湖南省', '江西省', '福建省', '广东省'] },
            { name: '四区', sortOrder: 4, provinces: ['广西壮族自治区', '贵州省', '云南省', '吉林省', '黑龙江省', '辽宁省'] },
            { name: '偏远', sortOrder: 5, provinces: ['海南省', '甘肃省', '宁夏回族自治区', '内蒙古自治区', '青海省'] },
            { name: '超远', sortOrder: 6, provinces: ['新疆维吾尔自治区', '西藏自治区'] },
        ];

        for (const zone of defaultZones) {
            await this.prisma.expressZone.create({
                data: {
                    companyId,
                    name: zone.name,
                    sortOrder: zone.sortOrder,
                    provinces: zone.provinces,
                },
            });
        }

        // 创建默认重量段
        const defaultWeightRanges = [
            { label: '0-0.3kg', minWeight: 0, maxWeight: 0.3, sortOrder: 1 },
            { label: '0.3-0.5kg', minWeight: 0.3, maxWeight: 0.5, sortOrder: 2 },
            { label: '0.5-1kg', minWeight: 0.5, maxWeight: 1, sortOrder: 3 },
            { label: '1-2kg', minWeight: 1, maxWeight: 2, sortOrder: 4 },
            { label: '2-3kg', minWeight: 2, maxWeight: 3, sortOrder: 5 },
        ];

        for (const range of defaultWeightRanges) {
            await this.prisma.expressWeightRange.create({
                data: {
                    companyId,
                    label: range.label,
                    minWeight: range.minWeight,
                    maxWeight: range.maxWeight,
                    sortOrder: range.sortOrder,
                },
            });
        }

        this.logger.log(`快递公司默认配置初始化完成: ${companyId}`);
    }

    async updateCompany(
        id: string,
        dto: UpdateExpressCompanyDto,
        userId: string,
    ) {
        const existing = await this.findCompanyById(id);

        if (dto.code && dto.code !== existing.code) {
            const codeExists =
                await this.prisma.expressCompany.findFirst({
                    where: {
                        code: dto.code,
                        deletedAt: null,
                    },
                });
            if (codeExists) {
                throw new ConflictException(
                    `快递公司编码 ${dto.code} 已存在`,
                );
            }
        }

        const company = await this.prisma.expressCompany.update({
            where: { id },
            data: { ...dto, updatedBy: userId },
        });

        this.logger.log(`快递公司更新成功: ${company.name}`);
        return company;
    }

    async deleteCompany(id: string, userId: string) {
        const company = await this.findCompanyById(id);

        const skuCount = await this.prisma.sku.count({
            where: {
                defaultExpressCompanyId: id,
                deletedAt: null,
            },
        });
        if (skuCount > 0) {
            throw new ConflictException(
                '该快递公司被SKU引用，无法删除',
            );
        }

        await this.prisma.expressCompany.update({
            where: { id },
            data: { deletedAt: new Date(), updatedBy: userId },
        });

        this.logger.log(
            `快递公司删除成功: ${company.name}`,
        );
    }

    async reorderExpressCompanies(ids: string[]) {
        const maxOrder = await this.prisma.expressCompany.aggregate({
            _max: { sortOrder: true },
        });
        const baseOrder = (maxOrder._max.sortOrder ?? 0) + 1;

        await this.prisma.$transaction(
            ids.map((id, index) =>
                this.prisma.expressCompany.update({
                    where: { id },
                    data: { sortOrder: baseOrder + index },
                }),
            ),
        );
    }

    // ==================== 区域配置管理 ====================

    /**
     * 获取区域列表
     */
    async findZonesByCompanyId(companyId: string) {
        await this.findCompanyById(companyId);

        return this.prisma.expressZone.findMany({
            where: { companyId },
            orderBy: { sortOrder: 'asc' },
        });
    }

    /**
     * 更新区域省份配置
     */
    async updateZone(id: string, dto: UpdateZoneDto) {
        const zone = await this.prisma.expressZone.findUnique({
            where: { id },
        });

        if (!zone) {
            throw new NotFoundException(`区域不存在: ${id}`);
        }

        return this.prisma.expressZone.update({
            where: { id },
            data: {
                provinces: dto.provinces,
            },
        });
    }

    /**
     * 批量更新区域配置
     */
    async batchUpdateZones(companyId: string, dto: BatchUpdateZonesDto) {
        await this.findCompanyById(companyId);

        const results = [];
        for (const zone of dto.zones) {
            const updated = await this.prisma.expressZone.update({
                where: { id: zone.id },
                data: { provinces: zone.provinces },
            });
            results.push(updated);
        }

        this.logger.log(`批量更新区域配置完成: ${companyId}`);
        return results;
    }

    // ==================== 重量段管理 ====================

    /**
     * 获取重量段列表
     */
    async findWeightRangesByCompanyId(companyId: string) {
        await this.findCompanyById(companyId);

        return this.prisma.expressWeightRange.findMany({
            where: { companyId },
            orderBy: { sortOrder: 'asc' },
        });
    }

    /**
     * 更新重量段
     */
    async updateWeightRange(id: string, dto: UpdateWeightRangeDto) {
        const weightRange = await this.prisma.expressWeightRange.findUnique({
            where: { id },
        });

        if (!weightRange) {
            throw new NotFoundException(`重量段不存在: ${id}`);
        }

        return this.prisma.expressWeightRange.update({
            where: { id },
            data: dto,
        });
    }

    // ==================== 价格矩阵管理 ====================

    /**
     * 获取价格矩阵
     */
    async findPriceMatrix(companyId: string) {
        await this.findCompanyById(companyId);

        const [zones, weightRanges, prices] = await Promise.all([
            this.prisma.expressZone.findMany({
                where: { companyId },
                orderBy: { sortOrder: 'asc' },
            }),
            this.prisma.expressWeightRange.findMany({
                where: { companyId },
                orderBy: { sortOrder: 'asc' },
            }),
            this.prisma.expressPrice.findMany({
                where: { companyId },
            }),
        ]);

        // 构建价格矩阵
        const matrix: Record<string, Record<string, number>> = {};
        for (const zone of zones) {
            matrix[zone.id] = {};
            for (const weightRange of weightRanges) {
                const price = prices.find(
                    p => p.zoneId === zone.id && p.weightRangeId === weightRange.id
                );
                matrix[zone.id][weightRange.id] = price ? Number(price.price) : 0;
            }
        }

        return {
            zones,
            weightRanges,
            matrix,
        };
    }

    /**
     * 批量更新价格
     */
    async batchUpdatePrices(companyId: string, dto: BatchUpdatePricesDto) {
        await this.findCompanyById(companyId);

        const results = [];
        for (const item of dto.prices) {
            const upserted = await this.prisma.expressPrice.upsert({
                where: {
                    companyId_zoneId_weightRangeId: {
                        companyId,
                        zoneId: item.zoneId,
                        weightRangeId: item.weightRangeId,
                    },
                },
                update: {
                    price: item.price,
                },
                create: {
                    companyId,
                    zoneId: item.zoneId,
                    weightRangeId: item.weightRangeId,
                    price: item.price,
                },
            });
            results.push(upserted);
        }

        this.logger.log(`批量更新价格完成: ${companyId}, 共${results.length}条`);
        return results;
    }

    /**
     * 复制价格配置
     */
    async copyPrices(targetCompanyId: string, dto: CopyPricesDto) {
        const { sourceCompanyId } = dto;

        // 检查两家公司是否存在
        await this.findCompanyById(sourceCompanyId);
        await this.findCompanyById(targetCompanyId);

        // 获取源公司的价格矩阵
        const sourceData = await this.findPriceMatrix(sourceCompanyId);

        // 获取目标公司的区域和重量段
        const targetZones = await this.prisma.expressZone.findMany({
            where: { companyId: targetCompanyId },
            orderBy: { sortOrder: 'asc' },
        });
        const targetWeightRanges = await this.prisma.expressWeightRange.findMany({
            where: { companyId: targetCompanyId },
            orderBy: { sortOrder: 'asc' },
        });

        // 按sortOrder映射区域和重量段
        const zoneMap = new Map<number, string>();
        sourceData.zones.forEach((z, i) => {
            if (targetZones[i]) {
                zoneMap.set(z.sortOrder, targetZones[i].id);
            }
        });

        const weightRangeMap = new Map<number, string>();
        const sourceWeightRanges = await this.prisma.expressWeightRange.findMany({
            where: { companyId: sourceCompanyId },
            orderBy: { sortOrder: 'asc' },
        });
        sourceWeightRanges.forEach((wr, i) => {
            if (targetWeightRanges[i]) {
                weightRangeMap.set(wr.sortOrder, targetWeightRanges[i].id);
            }
        });

        // 复制价格
        const pricesToCopy: { zoneId: string; weightRangeId: string; price: number }[] = [];
        for (const sourceZone of sourceData.zones) {
            const targetZoneId = zoneMap.get(sourceZone.sortOrder);
            if (!targetZoneId) continue;

            for (const sourceWeightRange of sourceWeightRanges) {
                const targetWeightRangeId = weightRangeMap.get(sourceWeightRange.sortOrder);
                if (!targetWeightRangeId) continue;

                const price = sourceData.matrix[sourceZone.id]?.[sourceWeightRange.id];
                if (price !== undefined && price > 0) {
                    pricesToCopy.push({
                        zoneId: targetZoneId,
                        weightRangeId: targetWeightRangeId,
                        price,
                    });
                }
            }
        }

        // 批量更新目标公司价格
        const results = await this.batchUpdatePrices(targetCompanyId, {
            prices: pricesToCopy,
        });

        this.logger.log(`复制价格配置完成: ${sourceCompanyId} -> ${targetCompanyId}`);
        return results;
    }

    // ==================== 附加费管理 ====================

    /**
     * 获取附加费列表
     */
    async findSurchargesByCompanyId(companyId: string) {
        await this.findCompanyById(companyId);

        return this.prisma.expressSurcharge.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * 创建附加费
     */
    async createSurcharge(companyId: string, dto: CreateSurchargeDto) {
        await this.findCompanyById(companyId);

        return this.prisma.expressSurcharge.create({
            data: {
                companyId,
                name: dto.name,
                provinces: dto.provinces,
                weightFrom: dto.weightFrom,
                weightTo: dto.weightTo,
                amount: dto.amount,
            },
        });
    }

    /**
     * 更新附加费
     */
    async updateSurcharge(id: string, dto: UpdateSurchargeDto) {
        const surcharge = await this.prisma.expressSurcharge.findUnique({
            where: { id },
        });

        if (!surcharge) {
            throw new NotFoundException(`附加费规则不存在: ${id}`);
        }

        return this.prisma.expressSurcharge.update({
            where: { id },
            data: dto,
        });
    }

    /**
     * 删除附加费
     */
    async deleteSurcharge(id: string) {
        const surcharge = await this.prisma.expressSurcharge.findUnique({
            where: { id },
        });

        if (!surcharge) {
            throw new NotFoundException(`附加费规则不存在: ${id}`);
        }

        await this.prisma.expressSurcharge.delete({
            where: { id },
        });

        this.logger.log(`附加费规则删除成功: ${id}`);
    }

    // ==================== 快递成本计算 ====================

    /**
     * 计算快递成本
     */
    async calculateCost(dto: CalculateExpressCostDto) {
        const { companyId, province, weight } = dto;

        // 获取快递公司配置
        const company = await this.findCompanyById(companyId);

        // 查找省份所属区域
        const zones = await this.prisma.expressZone.findMany({
            where: { companyId },
        });

        const zone = zones.find(z => z.provinces.includes(province));
        if (!zone) {
            throw new NotFoundException(`未找到省份 ${province} 对应的区域配置`);
        }

        // 查找重量段
        const weightRanges = await this.prisma.expressWeightRange.findMany({
            where: { companyId },
            orderBy: { sortOrder: 'asc' },
        });

        const weightRange = weightRanges.find(
            wr => weight >= Number(wr.minWeight) && weight <= Number(wr.maxWeight)
        );

        if (!weightRange) {
            throw new NotFoundException(`未找到重量 ${weight}kg 对应的价格配置`);
        }

        // 获取基础价格
        const price = await this.prisma.expressPrice.findUnique({
            where: {
                companyId_zoneId_weightRangeId: {
                    companyId,
                    zoneId: zone.id,
                    weightRangeId: weightRange.id,
                },
            },
        });

        const basePrice = price ? Number(price.price) : 0;

        // 查找适用的附加费
        const surcharges = await this.prisma.expressSurcharge.findMany({
            where: {
                companyId,
                provinces: { has: province },
            },
        });

        // 筛选满足重量条件的附加费
        const applicableSurcharges = surcharges.filter(s => {
            if (s.weightFrom !== null && weight < Number(s.weightFrom)) return false;
            if (s.weightTo !== null && weight > Number(s.weightTo)) return false;
            return true;
        });

        // 多个附加费时取最高
        const totalSurcharge = applicableSurcharges.length > 0
            ? Math.max(...applicableSurcharges.map(s => Number(s.amount)))
            : 0;

        const totalPrice = basePrice + totalSurcharge;

        return {
            companyId,
            companyName: company.name,
            province,
            weight,
            zone: zone.name,
            weightRange: weightRange.label,
            basePrice,
            surcharges: applicableSurcharges.map(s => ({
                name: s.name,
                amount: Number(s.amount),
            })),
            totalSurcharge,
            totalPrice,
        };
    }
}

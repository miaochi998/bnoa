import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
    BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { UserPayload } from '../../common/decorators/current-user.decorator';
import {
    CreateProfitReportDto,
    UpdateProfitReportDto,
    QueryProfitReportDto,
    SaveEntriesDto,
    SaveShippingCostsDto,
    SaveStoreExpensesDto,
    SaveAllocationCategoriesDto,
    SaveAllocationsDto,
    SaveCompanyExpensesDto,
    SaveNonExpensesDto,
    QueryProfitAnalysisDto,
    QueryMonthlyTrendDto,
} from './dto/profit.dto';

@Injectable()
export class ProfitService {
    private readonly logger = new Logger(ProfitService.name);

    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateProfitReportDto, user: UserPayload) {
        const userId = this.getUserId(user);

        // 检查是否已存在
        const existing = await this.prisma.profitReport.findFirst({
            where: {
                year: dto.year,
                month: dto.month,
                deletedAt: null,
            },
        });

        if (existing) {
            throw new ConflictException(`${dto.year}年${dto.month}月的利润表已存在`);
        }

        // 获取所有活跃店铺
        const shops = await this.prisma.shop.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            orderBy: { createdAt: 'asc' },
        });

        if (shops.length === 0) {
            throw new BadRequestException('没有活跃的店铺');
        }

        // 计算上月
        const prevMonth = dto.month === 1 ? 12 : dto.month - 1;
        const prevYear = dto.month === 1 ? dto.year - 1 : dto.year;

        // 查询上月报表（用于复制配置）
        const prevReport = await this.prisma.profitReport.findFirst({
            where: {
                year: prevYear,
                month: prevMonth,
                deletedAt: null,
            },
            include: {
                profitAllocationCategories: {
                    orderBy: { sortOrder: 'asc' },
                },
                profitReportEntries: {
                    include: {
                        profitShippingCosts: {
                            orderBy: { sortOrder: 'asc' },
                        },
                        profitStoreExpenses: {
                            orderBy: { sortOrder: 'asc' },
                        },
                    },
                },
                profitCompanyExpenses: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        // 创建报表 + 店铺条目 + 复制上月配置
        const report = await this.prisma.$transaction(async (tx) => {
            const created = await tx.profitReport.create({
                data: {
                    year: dto.year,
                    month: dto.month,
                    remark: dto.remark,
                    createdBy: userId,
                    updatedBy: userId,
                    profitReportEntries: {
                        create: shops.map((shop, index) => ({
                            shopId: shop.id,
                            sortOrder: index,
                        })),
                    },
                },
            });

            // 复制上月的分摊类别
            if (prevReport?.profitAllocationCategories?.length) {
                for (const cat of prevReport.profitAllocationCategories) {
                    await tx.profitAllocationCategory.create({
                        data: {
                            reportId: created.id,
                            name: cat.name,
                            sortOrder: cat.sortOrder,
                        },
                    });
                }
            }

            // 复制上月的公司费用
            if (prevReport?.profitCompanyExpenses?.length) {
                await tx.profitCompanyExpense.createMany({
                    data: prevReport.profitCompanyExpenses.map((e) => ({
                        reportId: created.id,
                        name: e.name,
                        amount: 0,
                        isAllocatable: e.isAllocatable,
                        sortOrder: e.sortOrder,
                    })),
                });
            }

            // 复制上月的运费和店铺费用配置
            if (prevReport?.profitReportEntries?.length) {
                const newEntries = await tx.profitReportEntry.findMany({
                    where: { reportId: created.id },
                });

                const shopEntryMap = new Map(
                    newEntries.map((e) => [e.shopId, e.id]),
                );

                for (const prevEntry of prevReport.profitReportEntries) {
                    const newEntryId = shopEntryMap.get(prevEntry.shopId);
                    if (!newEntryId) continue;

                    // 复制运费配置
                    if (prevEntry.profitShippingCosts?.length) {
                        await tx.profitShippingCost.createMany({
                            data: prevEntry.profitShippingCosts.map((s) => ({
                                entryId: newEntryId,
                                expressCompanyId: s.expressCompanyId,
                                amount: 0,
                                sortOrder: s.sortOrder,
                            })),
                        });
                    }

                    // 复制店铺费用配置
                    if (prevEntry.profitStoreExpenses?.length) {
                        await tx.profitStoreExpense.createMany({
                            data: prevEntry.profitStoreExpenses.map((e) => ({
                                entryId: newEntryId,
                                name: e.name,
                                amount: 0,
                                sortOrder: e.sortOrder,
                            })),
                        });
                    }
                }
            }

            return created;
        });

        this.logger.log(`利润表创建成功: ${dto.year}年${dto.month}月`);
        return this.findById(report.id, user);
    }

    async getAvailablePeriods(): Promise<{ year: number; months: number[] }[]> {
        const reports = await this.prisma.profitReport.findMany({
            where: { deletedAt: null },
            select: { year: true, month: true },
            orderBy: [{ year: 'desc' }, { month: 'asc' }],
        });

        const yearMap = new Map<number, Set<number>>();
        for (const r of reports) {
            if (!yearMap.has(r.year)) {
                yearMap.set(r.year, new Set());
            }
            yearMap.get(r.year)!.add(r.month);
        }

        return Array.from(yearMap.entries())
            .sort((a, b) => b[0] - a[0])
            .map(([year, months]) => ({
                year,
                months: Array.from(months).sort((a, b) => a - b),
            }));
    }

    async findAll(query: QueryProfitReportDto) {
        const { year } = query;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const where: any = { deletedAt: null };
        if (year) {
            where.year = year;
        }

        const [list, total] = await Promise.all([
            this.prisma.profitReport.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                orderBy: [
                    { year: 'desc' },
                    { month: 'desc' },
                ],
                include: {
                    _count: { select: { profitReportEntries: true } },
                    profitReportEntries: {
                        select: {
                            netProfit: true,
                            profitStoreExpenses: { select: { amount: true } },
                            profitAllocationItems: { select: { amount: true } },
                        },
                    },
                },
            }),
            this.prisma.profitReport.count({ where }),
        ]);

        const summaryList = list.map((report) => {
            const entries = report.profitReportEntries || [];

            let totalExpense = 0;
            let totalNetProfit = 0;

            for (const entry of entries) {
                totalNetProfit += Number(entry.netProfit) || 0;
                // 费用合计 = 平台费用 + 分摊费用
                for (const se of entry.profitStoreExpenses) {
                    totalExpense += Number(se.amount) || 0;
                }
                for (const ai of entry.profitAllocationItems) {
                    totalExpense += Number(ai.amount) || 0;
                }
            }

            const { profitReportEntries, ...rest } = report;
            return {
                ...rest,
                totalExpense: Math.round(totalExpense * 1000) / 1000,
                totalNetProfit: Math.round(totalNetProfit * 1000) / 1000,
            };
        });

        return {
            list: summaryList,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    async findById(id: string, user?: UserPayload | string) {
        const report = await this.prisma.profitReport.findFirst({
            where: { id, deletedAt: null },
            include: {
                profitReportEntries: {
                    orderBy: { sortOrder: 'asc' },
                    include: {
                        shop: {
                            include: {
                                platform: {
                                    select: {
                                        id: true,
                                        name: true,
                                        code: true,
                                    },
                                },
                                creator: {
                                    select: {
                                        id: true,
                                        name: true,
                                        username: true,
                                    },
                                },
                            },
                        },
                        profitShippingCosts: {
                            orderBy: { sortOrder: 'asc' },
                            include: {
                                expressCompany: {
                                    select: {
                                        id: true,
                                        name: true,
                                        code: true,
                                    },
                                },
                            },
                        },
                        profitStoreExpenses: {
                            orderBy: { sortOrder: 'asc' },
                        },
                        profitAllocationItems: {
                            include: {
                                profitAllocationCategory: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                },
                profitAllocationCategories: {
                    orderBy: { sortOrder: 'asc' },
                },
                profitCompanyExpenses: {
                    orderBy: { sortOrder: 'asc' },
                },
                profitNonExpenses: {
                    orderBy: { sortOrder: 'asc' },
                },
            },
        });

        if (!report) {
            throw new NotFoundException('利润表不存在');
        }

        // 映射 Prisma 关系名为前端期望的简短名
        const { profitReportEntries, profitAllocationCategories, profitCompanyExpenses, profitNonExpenses, ...rest } = report as any;
        return {
            ...rest,
            entries: (profitReportEntries || []).map((entry: any) => {
                const { profitShippingCosts, profitStoreExpenses, profitAllocationItems, ...entryRest } = entry;
                return {
                    ...entryRest,
                    shippingCosts: profitShippingCosts || [],
                    storeExpenses: profitStoreExpenses || [],
                    allocations: (profitAllocationItems || []).map((a: any) => ({
                        ...a,
                        categoryId: a.categoryId || a.profitAllocationCategory?.id,
                    })),
                };
            }),
            allocationCategories: profitAllocationCategories || [],
            companyExpenses: profitCompanyExpenses || [],
            nonExpenses: profitNonExpenses || [],
        };
    }

    async update(id: string, dto: UpdateProfitReportDto, user: UserPayload) {
        await this.ensureExists(id);
        const userId = this.getUserId(user);

        const updated = await this.prisma.profitReport.update({
            where: { id },
            data: {
                remark: dto.remark,
                updatedBy: userId,
            },
        });

        this.logger.log(`利润表更新成功: ${id}`);
        return this.findById(id, user);
    }

    async delete(id: string, user: UserPayload) {
        await this.ensureExists(id);
        const userId = this.getUserId(user);

        await this.prisma.profitReport.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                updatedBy: userId,
            },
        });

        this.logger.log(`利润表删除成功: ${id}`);
    }

    async confirm(id: string, user: UserPayload) {
        await this.ensureDraft(id);
        const userId = this.getUserId(user);

        const updated = await this.prisma.profitReport.update({
            where: { id },
            data: {
                status: 'CONFIRMED',
                confirmedBy: userId,
                confirmedAt: new Date(),
                updatedBy: userId,
            },
        });

        this.logger.log(`利润表确认成功: ${id}`);
        return this.findById(id, user);
    }

    async revoke(id: string, user: UserPayload) {
        const report = await this.prisma.profitReport.findFirst({
            where: { id, deletedAt: null },
        });

        if (!report) {
            throw new NotFoundException('利润表不存在');
        }

        if (report.status !== 'CONFIRMED') {
            throw new BadRequestException('只能撤销已确认的利润表');
        }

        const userId = this.getUserId(user);

        const updated = await this.prisma.profitReport.update({
            where: { id },
            data: {
                status: 'DRAFT',
                confirmedBy: null,
                confirmedAt: null,
                updatedBy: userId,
            },
        });

        this.logger.log(`利润表撤销成功: ${id}`);
        return this.findById(id, user);
    }

    async saveEntries(id: string, dto: SaveEntriesDto, user: UserPayload) {
        await this.ensureExists(id);
        const userId = this.getUserId(user);

        // 批量更新条目
        await this.prisma.$transaction(
            dto.entries.map((entry) =>
                this.prisma.profitReportEntry.update({
                    where: { id: entry.entryId },
                    data: {
                        salesAmount: entry.salesAmount,
                        rawMaterialCost: entry.rawMaterialCost,
                        packagingCost: entry.packagingCost,
                        laborCost: entry.laborCost,
                    },
                }),
            ),
        );

        await this.prisma.profitReport.update({
            where: { id },
            data: { updatedBy: userId },
        });

        this.logger.log(`利润表条目保存成功: ${id}`);
        return this.findById(id, user);
    }

    async saveShippingCosts(
        reportId: string,
        entryId: string,
        dto: SaveShippingCostsDto,
        user: UserPayload,
    ) {
        await this.ensureExists(reportId);
        await this.ensureEntryBelongs(entryId, reportId);
        const userId = this.getUserId(user);

        // 删除旧的运费记录
        await this.prisma.profitShippingCost.deleteMany({
            where: { entryId },
        });

        // 创建新的运费记录
        if (dto.items?.length) {
            await this.prisma.profitShippingCost.createMany({
                data: dto.items.map((cost, index) => ({
                    entryId,
                    expressCompanyId: cost.expressCompanyId,
                    amount: cost.amount,
                    sortOrder: index,
                })),
            });
        }

        await this.prisma.profitReport.update({
            where: { id: reportId },
            data: { updatedBy: userId },
        });

        this.logger.log(`运费保存成功: ${entryId}`);
        return this.findById(reportId, user);
    }

    async saveStoreExpenses(
        reportId: string,
        entryId: string,
        dto: SaveStoreExpensesDto,
        user: UserPayload,
    ) {
        await this.ensureExists(reportId);
        await this.ensureEntryBelongs(entryId, reportId);
        const userId = this.getUserId(user);

        // 删除旧的店铺费用记录
        await this.prisma.profitStoreExpense.deleteMany({
            where: { entryId },
        });

        // 创建新的店铺费用记录
        if (dto.items?.length) {
            await this.prisma.profitStoreExpense.createMany({
                data: dto.items.map((expense, index) => ({
                    entryId,
                    name: expense.name,
                    amount: expense.amount,
                    sortOrder: index,
                })),
            });
        }

        await this.prisma.profitReport.update({
            where: { id: reportId },
            data: { updatedBy: userId },
        });

        this.logger.log(`店铺费用保存成功: ${entryId}`);
        return this.findById(reportId, user);
    }

    async saveAllocationCategories(
        id: string,
        dto: SaveAllocationCategoriesDto,
        user: UserPayload,
    ) {
        await this.ensureExists(id);
        const userId = this.getUserId(user);

        // 删除旧的分摊类别
        await this.prisma.profitAllocationCategory.deleteMany({
            where: { reportId: id },
        });

        // 创建新的分摊类别
        if (dto.categories?.length) {
            await this.prisma.profitAllocationCategory.createMany({
                data: dto.categories.map((cat, index) => ({
                    reportId: id,
                    name: cat.name,
                    sortOrder: index,
                })),
            });
        }

        await this.prisma.profitReport.update({
            where: { id },
            data: { updatedBy: userId },
        });

        this.logger.log(`分摊类别保存成功: ${id}`);
        return this.findById(id, user);
    }

    async saveAllocations(
        id: string,
        dto: SaveAllocationsDto,
        user: UserPayload,
    ) {
        await this.ensureExists(id);
        const userId = this.getUserId(user);

        // 删除旧的分摊记录
        await this.prisma.profitAllocationItem.deleteMany({
            where: {
                profitReportEntry: {
                    reportId: id,
                },
            },
        });

        // 创建新的分摊记录
        if (dto.items?.length) {
            await this.prisma.profitAllocationItem.createMany({
                data: dto.items.map((alloc) => ({
                    entryId: alloc.entryId,
                    categoryId: alloc.categoryId,
                    amount: alloc.amount,
                })),
            });
        }

        await this.prisma.profitReport.update({
            where: { id },
            data: { updatedBy: userId },
        });

        this.logger.log(`分摊保存成功: ${id}`);
        return this.findById(id, user);
    }

    async saveCompanyExpenses(
        id: string,
        dto: SaveCompanyExpensesDto,
        user: UserPayload,
    ) {
        await this.ensureExists(id);
        const userId = this.getUserId(user);

        // 删除旧的公司费用
        await this.prisma.profitCompanyExpense.deleteMany({
            where: { reportId: id },
        });

        // 创建新的公司费用
        if (dto.items?.length) {
            await this.prisma.profitCompanyExpense.createMany({
                data: dto.items.map((expense, index) => ({
                    reportId: id,
                    name: expense.name,
                    amount: expense.amount,
                    isAllocatable: expense.isAllocatable ?? false,
                    sortOrder: index,
                })),
            });
        }

        await this.prisma.profitReport.update({
            where: { id },
            data: { updatedBy: userId },
        });

        this.logger.log(`公司费用保存成功: ${id}`);
        return this.findById(id, user);
    }

    async saveNonExpenses(
        id: string,
        dto: SaveNonExpensesDto,
        user: UserPayload,
    ) {
        await this.ensureExists(id);
        const userId = this.getUserId(user);

        // 删除旧的非费用项
        await this.prisma.profitNonExpense.deleteMany({
            where: { reportId: id },
        });

        // 创建新的非费用项
        if (dto.items?.length) {
            await this.prisma.profitNonExpense.createMany({
                data: dto.items.map((item, index) => ({
                    reportId: id,
                    name: item.name,
                    amount: item.amount,
                    sortOrder: index,
                })),
            });
        }

        await this.prisma.profitReport.update({
            where: { id },
            data: { updatedBy: userId },
        });

        this.logger.log(`非费用项保存成功: ${id}`);
        return this.findById(id, user);
    }

    async getAnalysis(query: QueryProfitAnalysisDto, user?: UserPayload) {
        const { year, month } = query;

        // 构建当前期间查询条件
        const where: any = { year, deletedAt: null };
        if (month) where.month = month;

        // 查询当前期间的报表
        const reports = await this.prisma.profitReport.findMany({
            where,
            include: {
                profitReportEntries: {
                    include: {
                        shop: {
                            include: {
                                platform: { select: { id: true, name: true, code: true } },
                            },
                        },
                        profitShippingCosts: true,
                        profitStoreExpenses: true,
                        profitAllocationItems: true,
                    },
                },
                profitCompanyExpenses: true,
            },
        });

        // 计算当前期间数据
        const result = this.buildAnalysisFromReports(reports);

        // 计算上一期间数据（环比）
        let prevOverview: any = null;
        if (month) {
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? year - 1 : year;
            const prevReports = await this.prisma.profitReport.findMany({
                where: { year: prevYear, month: prevMonth, deletedAt: null },
                include: {
                    profitReportEntries: {
                        include: {
                            profitShippingCosts: true,
                            profitStoreExpenses: true,
                            profitAllocationItems: true,
                        },
                    },
                    profitCompanyExpenses: true,
                },
            });
            if (prevReports.length > 0) {
                prevOverview = this.buildAnalysisFromReports(prevReports).overview;
            }
        } else {
            // 全年汇总时，环比为上一年
            const prevReports = await this.prisma.profitReport.findMany({
                where: { year: year - 1, deletedAt: null },
                include: {
                    profitReportEntries: {
                        include: {
                            profitShippingCosts: true,
                            profitStoreExpenses: true,
                            profitAllocationItems: true,
                        },
                    },
                    profitCompanyExpenses: true,
                },
            });
            if (prevReports.length > 0) {
                prevOverview = this.buildAnalysisFromReports(prevReports).overview;
            }
        }

        return {
            ...result,
            prevOverview,
        };
    }

    /**
     * 月度趋势API — 为分析模块4个Tab提供数据
     * 返回指定年份（及对比年份）每月逐月数据，支持权限过滤和单店铺筛选
     */
    async getMonthlyTrend(query: QueryMonthlyTrendDto, user: UserPayload) {
        const { year, compareYears, shopId } = query;
        const n = (v: any) => Number(v) || 0;

        // 解析所有需要查询的年份
        const years = [year];
        if (compareYears) {
            for (const y of compareYears.split(',')) {
                const parsed = parseInt(y.trim(), 10);
                if (parsed && !years.includes(parsed)) years.push(parsed);
            }
        }

        // 权限过滤：非管理员只能看自己管理的店铺
        const admin = this.isAdmin(user);
        const userId = this.getUserId(user);
        let allowedShopIds: string[] | null = null;
        if (!admin) {
            const myShops = await this.prisma.shop.findMany({
                where: { managerId: userId, deletedAt: null },
                select: { id: true },
            });
            allowedShopIds = myShops.map(s => s.id);
        }

        // 查询所有年份的报表（含完整关联数据）
        const reports = await this.prisma.profitReport.findMany({
            where: {
                year: { in: years },
                deletedAt: null,
            },
            include: {
                profitReportEntries: {
                    include: {
                        shop: {
                            include: {
                                platform: { select: { id: true, name: true } },
                            },
                        },
                        profitShippingCosts: {
                            include: { expressCompany: { select: { id: true, name: true } } },
                        },
                        profitStoreExpenses: true,
                        profitAllocationItems: true,
                    },
                },
                profitCompanyExpenses: true,
            },
        });

        // 获取所有可见店铺列表（用于前端下拉选择）
        const shopListMap = new Map<string, { shopId: string; shopName: string; platformName: string }>();

        // 按 year-month 聚合
        const monthlyMap = new Map<string, any>();

        for (const report of reports) {
            const key = `${report.year}-${report.month}`;

            if (!monthlyMap.has(key)) {
                monthlyMap.set(key, {
                    year: report.year,
                    month: report.month,
                    shops: new Map<string, any>(),
                    companyExpenses: [],
                    totalCompanyExpense: 0,
                });
            }
            const md = monthlyMap.get(key);

            // 公司费用（仅管理员可见，不受shopId筛选影响）
            if (admin && !shopId) {
                for (const ce of report.profitCompanyExpenses || []) {
                    md.companyExpenses.push({
                        name: ce.name,
                        amount: n(ce.amount),
                    });
                    md.totalCompanyExpense += n(ce.amount);
                }
            }

            for (const entry of report.profitReportEntries || []) {
                const sid = entry.shopId;

                // 权限过滤
                if (allowedShopIds && !allowedShopIds.includes(sid)) continue;
                // 单店铺筛选
                if (shopId && sid !== shopId) continue;

                // 记录可见店铺
                if (!shopListMap.has(sid)) {
                    shopListMap.set(sid, {
                        shopId: sid,
                        shopName: entry.shop?.name || '未知店铺',
                        platformName: entry.shop?.platform?.name || '未知平台',
                    });
                }

                const existing = md.shops.get(sid) || {
                    shopId: sid,
                    shopName: entry.shop?.name || '未知店铺',
                    platformName: entry.shop?.platform?.name || '未知平台',
                    salesAmount: 0,
                    rawMaterialCost: 0,
                    packagingCost: 0,
                    laborCost: 0,
                    shippingCost: 0,
                    platformFee: 0,
                    allocationCost: 0,
                    grossProfit: 0,
                    netProfit: 0,
                    hasGrossProfit: true,
                    hasNetProfit: true,
                    // 快递费按公司明细
                    shippingByCompany: new Map<string, { name: string; amount: number }>(),
                };

                existing.salesAmount += n(entry.salesAmount);
                existing.rawMaterialCost += n(entry.rawMaterialCost);
                existing.packagingCost += n(entry.packagingCost);
                existing.laborCost += n(entry.laborCost);

                for (const sc of entry.profitShippingCosts || []) {
                    existing.shippingCost += n(sc.amount);
                    const compName = sc.expressCompany?.name || '其他';
                    const compEntry = existing.shippingByCompany.get(compName) || { name: compName, amount: 0 };
                    compEntry.amount += n(sc.amount);
                    existing.shippingByCompany.set(compName, compEntry);
                }
                for (const se of entry.profitStoreExpenses || []) {
                    existing.platformFee += n(se.amount);
                }
                for (const ai of entry.profitAllocationItems || []) {
                    existing.allocationCost += n(ai.amount);
                }

                if (entry.grossProfit != null) {
                    existing.grossProfit += n(entry.grossProfit);
                } else {
                    existing.hasGrossProfit = false;
                }
                if (entry.netProfit != null) {
                    existing.netProfit += n(entry.netProfit);
                } else {
                    existing.hasNetProfit = false;
                }

                md.shops.set(sid, existing);
            }
        }

        // 组装返回数据
        const monthly: any[] = [];

        for (const md of monthlyMap.values()) {
            let mSales = 0, mRaw = 0, mPkg = 0, mLabor = 0, mShip = 0;
            let mPlatform = 0, mAlloc = 0, mGross = 0, mNet = 0;
            const mShipByCompany = new Map<string, number>();
            const shopDetails: any[] = [];

            for (const s of md.shops.values()) {
                const grossCalc = s.salesAmount - s.rawMaterialCost - s.packagingCost - s.laborCost - s.shippingCost;
                const gross = s.hasGrossProfit ? s.grossProfit : grossCalc;
                const netCalc = gross - s.platformFee - s.allocationCost;
                const net = s.hasNetProfit ? s.netProfit : netCalc;

                const shopItem: any = {
                    shopId: s.shopId,
                    shopName: s.shopName,
                    platformName: s.platformName,
                    salesAmount: +s.salesAmount.toFixed(3),
                    rawMaterialCost: +s.rawMaterialCost.toFixed(3),
                    packagingCost: +s.packagingCost.toFixed(3),
                    laborCost: +s.laborCost.toFixed(3),
                    shippingCost: +s.shippingCost.toFixed(3),
                    platformFee: +s.platformFee.toFixed(3),
                    allocationCost: +s.allocationCost.toFixed(3),
                    grossProfit: +gross.toFixed(3),
                    netProfit: +net.toFixed(3),
                    grossMargin: s.salesAmount > 0 ? +((gross / s.salesAmount) * 100).toFixed(2) : 0,
                    netMargin: s.salesAmount > 0 ? +((net / s.salesAmount) * 100).toFixed(2) : 0,
                    rawMaterialRate: s.salesAmount > 0 ? +((s.rawMaterialCost / s.salesAmount) * 100).toFixed(2) : 0,
                    shippingRate: s.salesAmount > 0 ? +((s.shippingCost / s.salesAmount) * 100).toFixed(2) : 0,
                    platformFeeRate: s.salesAmount > 0 ? +((s.platformFee / s.salesAmount) * 100).toFixed(2) : 0,
                    allocationRate: s.salesAmount > 0 ? +((s.allocationCost / s.salesAmount) * 100).toFixed(2) : 0,
                    shippingByCompany: [...s.shippingByCompany.values()].map(c => ({
                        name: c.name,
                        amount: +c.amount.toFixed(3),
                    })),
                };
                shopDetails.push(shopItem);

                mSales += s.salesAmount;
                mRaw += s.rawMaterialCost;
                mPkg += s.packagingCost;
                mLabor += s.laborCost;
                mShip += s.shippingCost;
                mPlatform += s.platformFee;
                mAlloc += s.allocationCost;
                mGross += gross;
                mNet += net;

                for (const [cn, cv] of s.shippingByCompany) {
                    mShipByCompany.set(cn, (mShipByCompany.get(cn) || 0) + cv.amount);
                }
            }

            // 费用合计 = 平台费用 + 分摊费用
            const expenseTotal = mPlatform + mAlloc;

            monthly.push({
                year: md.year,
                month: md.month,
                // 汇总指标
                totalSales: +mSales.toFixed(3),
                totalRawMaterial: +mRaw.toFixed(3),
                totalPackaging: +mPkg.toFixed(3),
                totalLabor: +mLabor.toFixed(3),
                totalShipping: +mShip.toFixed(3),
                totalPlatformFee: +mPlatform.toFixed(3),
                totalAllocation: +mAlloc.toFixed(3),
                totalExpense: +expenseTotal.toFixed(3),
                totalGross: +mGross.toFixed(3),
                totalNet: +mNet.toFixed(3),
                grossMargin: mSales > 0 ? +((mGross / mSales) * 100).toFixed(2) : 0,
                netMargin: mSales > 0 ? +((mNet / mSales) * 100).toFixed(2) : 0,
                rawMaterialRate: mSales > 0 ? +((mRaw / mSales) * 100).toFixed(2) : 0,
                shippingRate: mSales > 0 ? +((mShip / mSales) * 100).toFixed(2) : 0,
                platformFeeRate: mSales > 0 ? +((mPlatform / mSales) * 100).toFixed(2) : 0,
                allocationRate: mSales > 0 ? +((mAlloc / mSales) * 100).toFixed(2) : 0,
                // 公司费用
                totalCompanyExpense: +md.totalCompanyExpense.toFixed(3),
                companyExpenses: md.companyExpenses,
                // 快递费按公司分布
                shippingByCompany: [...mShipByCompany.entries()].map(([name, amount]) => ({
                    name,
                    amount: +amount.toFixed(3),
                })),
                // 店铺明细
                shops: shopDetails,
            });
        }

        // 按年月排序
        monthly.sort((a, b) => a.year - b.year || a.month - b.month);

        // 计算年度汇总（按年分组）
        const yearlyMap = new Map<number, any>();
        for (const m of monthly) {
            if (!yearlyMap.has(m.year)) {
                yearlyMap.set(m.year, {
                    year: m.year,
                    totalSales: 0, totalRawMaterial: 0, totalPackaging: 0,
                    totalLabor: 0, totalShipping: 0, totalPlatformFee: 0,
                    totalAllocation: 0, totalGross: 0, totalNet: 0,
                    totalCompanyExpense: 0, monthCount: 0,
                });
            }
            const yd = yearlyMap.get(m.year);
            yd.totalSales += m.totalSales;
            yd.totalRawMaterial += m.totalRawMaterial;
            yd.totalPackaging += m.totalPackaging;
            yd.totalLabor += m.totalLabor;
            yd.totalShipping += m.totalShipping;
            yd.totalPlatformFee += m.totalPlatformFee;
            yd.totalAllocation += m.totalAllocation;
            yd.totalGross += m.totalGross;
            yd.totalNet += m.totalNet;
            yd.totalCompanyExpense += m.totalCompanyExpense;
            yd.monthCount += 1;
        }

        const yearlySummary = [...yearlyMap.values()].map(yd => ({
            year: yd.year,
            totalSales: +yd.totalSales.toFixed(3),
            totalRawMaterial: +yd.totalRawMaterial.toFixed(3),
            totalPackaging: +yd.totalPackaging.toFixed(3),
            totalLabor: +yd.totalLabor.toFixed(3),
            totalShipping: +yd.totalShipping.toFixed(3),
            totalPlatformFee: +yd.totalPlatformFee.toFixed(3),
            totalAllocation: +yd.totalAllocation.toFixed(3),
            totalExpense: +(yd.totalPlatformFee + yd.totalAllocation).toFixed(3),
            totalGross: +yd.totalGross.toFixed(3),
            totalNet: +yd.totalNet.toFixed(3),
            totalCompanyExpense: +yd.totalCompanyExpense.toFixed(3),
            grossMargin: yd.totalSales > 0 ? +((yd.totalGross / yd.totalSales) * 100).toFixed(2) : 0,
            netMargin: yd.totalSales > 0 ? +((yd.totalNet / yd.totalSales) * 100).toFixed(2) : 0,
            monthCount: yd.monthCount,
        }));

        return {
            years,
            monthly,
            yearlySummary,
            shops: [...shopListMap.values()],
        };
    }

    private buildAnalysisFromReports(reports: any[]) {
        const n = (v: any) => Number(v) || 0;
        const reportCount = reports.length;

        // 按店铺聚合数据
        const shopMap = new Map<string, any>();
        let totalCompanyExpense = 0;

        for (const report of reports) {
            // 累计公司费用
            for (const ce of report.profitCompanyExpenses || []) {
                totalCompanyExpense += n(ce.amount);
            }

            for (const entry of report.profitReportEntries || []) {
                const shopId = entry.shopId;
                const existing = shopMap.get(shopId) || {
                    shopId,
                    shopName: entry.shop?.name || '未知店铺',
                    platformName: entry.shop?.platform?.name || '未知平台',
                    totalSales: 0,
                    totalRawMaterial: 0,
                    totalPackaging: 0,
                    totalLabor: 0,
                    totalShipping: 0,
                    totalPlatformFee: 0,
                    totalAllocation: 0,
                    totalGrossProfit: 0,
                    totalNetProfit: 0,
                    hasGrossProfit: true,
                    hasNetProfit: true,
                };

                existing.totalSales += n(entry.salesAmount);
                existing.totalRawMaterial += n(entry.rawMaterialCost);
                existing.totalPackaging += n(entry.packagingCost);
                existing.totalLabor += n(entry.laborCost);

                for (const sc of entry.profitShippingCosts || []) {
                    existing.totalShipping += n(sc.amount);
                }
                for (const se of entry.profitStoreExpenses || []) {
                    existing.totalPlatformFee += n(se.amount);
                }
                for (const ai of entry.profitAllocationItems || []) {
                    existing.totalAllocation += n(ai.amount);
                }

                // 累加数据库中存储的精确毛利/净利润值
                if (entry.grossProfit != null) {
                    existing.totalGrossProfit += n(entry.grossProfit);
                } else {
                    existing.hasGrossProfit = false;
                }
                if (entry.netProfit != null) {
                    existing.totalNetProfit += n(entry.netProfit);
                } else {
                    existing.hasNetProfit = false;
                }

                shopMap.set(shopId, existing);
            }
        }

        // 计算每个店铺的毛利、净利、各项费率
        const shopComparison: any[] = [];
        let gTotalSales = 0, gTotalGross = 0, gTotalNet = 0;
        let gTotalRawMaterial = 0, gTotalPackaging = 0, gTotalLabor = 0;
        let gTotalShipping = 0, gTotalPlatformExpense = 0, gTotalAllocation = 0;

        for (const s of shopMap.values()) {
            // 优先使用数据库中存储的精确毛利/净利润值（来自Excel公式），仅在无值时fallback
            const grossCalc = s.totalSales - s.totalRawMaterial - s.totalPackaging - s.totalLabor - s.totalShipping;
            const gross = s.hasGrossProfit ? s.totalGrossProfit : grossCalc;
            const netCalc = gross - s.totalPlatformFee - s.totalAllocation;
            const net = s.hasNetProfit ? s.totalNetProfit : netCalc;
            const grossMargin = s.totalSales > 0 ? +((gross / s.totalSales) * 100).toFixed(1) : 0;
            const netMargin = s.totalSales > 0 ? +((net / s.totalSales) * 100).toFixed(1) : 0;
            const shippingCostRate = s.totalSales > 0 ? +((s.totalShipping / s.totalSales) * 100).toFixed(1) : 0;
            const platformFeeRate = s.totalSales > 0 ? +((s.totalPlatformFee / s.totalSales) * 100).toFixed(1) : 0;
            const rawMaterialRate = s.totalSales > 0 ? +((s.totalRawMaterial / s.totalSales) * 100).toFixed(1) : 0;
            const allocationRate = s.totalSales > 0 ? +((s.totalAllocation / s.totalSales) * 100).toFixed(1) : 0;

            shopComparison.push({
                shopId: s.shopId,
                shopName: s.shopName,
                platformName: s.platformName,
                totalSales: +s.totalSales.toFixed(2),
                totalGross: +gross.toFixed(2),
                totalNet: +net.toFixed(2),
                grossMargin,
                netMargin,
                totalShipping: +s.totalShipping.toFixed(2),
                totalPlatformFee: +s.totalPlatformFee.toFixed(2),
                totalRawMaterial: +s.totalRawMaterial.toFixed(2),
                totalAllocation: +s.totalAllocation.toFixed(2),
                shippingCostRate,
                platformFeeRate,
                rawMaterialRate,
                allocationRate,
            });

            gTotalSales += s.totalSales;
            gTotalGross += gross;
            gTotalNet += net;
            gTotalRawMaterial += s.totalRawMaterial;
            gTotalPackaging += s.totalPackaging;
            gTotalLabor += s.totalLabor;
            gTotalShipping += s.totalShipping;
            gTotalPlatformExpense += s.totalPlatformFee;
            gTotalAllocation += s.totalAllocation;
        }

        // 平台汇总
        const platMap = new Map<string, any>();
        for (const s of shopComparison) {
            const existing = platMap.get(s.platformName) || {
                platformName: s.platformName,
                totalSales: 0,
                totalGross: 0,
                totalNet: 0,
                shopCount: 0,
            };
            existing.totalSales += s.totalSales;
            existing.totalGross += s.totalGross;
            existing.totalNet += s.totalNet;
            existing.shopCount += 1;
            platMap.set(s.platformName, existing);
        }

        const platformSummary = [...platMap.values()].map((p) => ({
            ...p,
            totalSales: +p.totalSales.toFixed(2),
            totalGross: +p.totalGross.toFixed(2),
            totalNet: +p.totalNet.toFixed(2),
            grossMargin: p.totalSales > 0 ? +((p.totalGross / p.totalSales) * 100).toFixed(1) : 0,
            netMargin: p.totalSales > 0 ? +((p.totalNet / p.totalSales) * 100).toFixed(1) : 0,
        }));

        return {
            shopComparison,
            platformSummary,
            costStructure: {
                totalRawMaterial: +gTotalRawMaterial.toFixed(2),
                totalPackaging: +gTotalPackaging.toFixed(2),
                totalLabor: +gTotalLabor.toFixed(2),
                totalShipping: +gTotalShipping.toFixed(2),
                totalPlatformExpense: +gTotalPlatformExpense.toFixed(2),
                totalAllocation: +gTotalAllocation.toFixed(2),
                totalCompanyExpense: +totalCompanyExpense.toFixed(2),
            },
            overview: {
                totalSales: +gTotalSales.toFixed(2),
                totalGross: +gTotalGross.toFixed(2),
                totalNet: +gTotalNet.toFixed(2),
                grossMargin: gTotalSales > 0 ? +((gTotalGross / gTotalSales) * 100).toFixed(1) : 0,
                netMargin: gTotalSales > 0 ? +((gTotalNet / gTotalSales) * 100).toFixed(1) : 0,
                reportCount,
            },
        };
    }

    // ========== 私有方法 ==========

    private isAdmin(user: UserPayload): boolean {
        const adminCodes = ['admin', 'super_admin'];
        return user.roles?.some((r: any) => {
            const code = typeof r === 'string' ? r : r.code;
            return adminCodes.includes(code);
        }) ?? false;
    }

    private getUserId(user: UserPayload | string): string {
        return typeof user === 'string' ? user : (user.userId || user.sub);
    }

    private getUserRoles(user: UserPayload) {
        return user.roles ?? [];
    }

    private async ensureExists(id: string) {
        const report = await this.prisma.profitReport.findFirst({
            where: { id, deletedAt: null },
        });

        if (!report) {
            throw new NotFoundException('利润表不存在');
        }
    }

    private async ensureDraft(id: string) {
        const report = await this.prisma.profitReport.findFirst({
            where: { id, deletedAt: null },
        });

        if (!report) {
            throw new NotFoundException('利润表不存在');
        }

        if (report.status !== 'DRAFT') {
            throw new BadRequestException('只能编辑草稿状态的利润表');
        }
    }

    private async ensureEntryBelongs(entryId: string, reportId: string) {
        const entry = await this.prisma.profitReportEntry.findFirst({
            where: { id: entryId },
        });

        if (!entry || entry.reportId !== reportId) {
            throw new BadRequestException('条目不属于该利润表');
        }
    }

    private async ensureEntryAccess(entryId: string, user: UserPayload) {
        // TODO: 实现权限检查
    }
}

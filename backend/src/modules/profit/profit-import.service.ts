import {
    Injectable,
    Logger,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { UserPayload } from '../../common/decorators/current-user.decorator';
import * as ExcelJS from 'exceljs';
import { JsonImportProfitReportDto } from './dto/profit.dto';

// 快递公司关键字 → 系统名称映射
const EXPRESS_KEYWORDS: Record<string, string> = {
    '圆通': '圆通快递',
    '韵达': '韵达快递',
    '申通': '申通快递',
    '中通快运': '中通快运',
    '顺心': '中通快运',
    '中通快递': '中通快递',
    '中通': '中通快递', // 兜底：纯"中通"匹配中通快递
    '极兔': '极兔快递',
    '邮政': '邮政快递',
};

// 店铺别名映射在运行时从数据库shop_aliases表加载

interface ShopColumnMapping {
    colIndex: number; // 1-based
    colLetter: string;
    excelName: string;
    shopId: string | null;
    shopName: string | null;
    matched: boolean;
}

interface ParsedEntryData {
    shopMapping: ShopColumnMapping;
    salesAmount: number;
    rawMaterialCost: number;
    packagingCost: number;
    laborCost: number;
    shippingCosts: { expressCompanyName: string; expressCompanyId: string | null; amount: number }[];
    shippingTotal: number;
    storeExpenses: { name: string; amount: number }[];
    storeExpenseTotal: number;
    allocations: { categoryName: string; amount: number }[];
    grossProfit: number;
    netProfit: number;
}

interface ParsedCompanyExpense {
    name: string;
    amount: number;
}

interface ParsedNonExpense {
    name: string;
    amount: number;
}

export interface ImportPreviewResult {
    year: number;
    month: number;
    existingReportId: string | null;
    existingReportStatus: string | null;
    entries: {
        excelName: string;
        shopName: string | null;
        shopId: string | null;
        matched: boolean;
        salesAmount: number;
        rawMaterialCost: number;
        packagingCost: number;
        laborCost: number;
        shippingCosts: { expressCompanyName: string; expressCompanyId: string | null; amount: number; matched: boolean }[];
        storeExpenses: { name: string; amount: number }[];
        shippingTotal: number;
        storeExpenseTotal: number;
        allocations: { categoryName: string; amount: number }[];
        grossProfit: number;
        netProfit: number;
    }[];
    allocationCategories: string[];
    companyExpenses: ParsedCompanyExpense[];
    nonExpenses: ParsedNonExpense[];
    warnings: string[];
}

@Injectable()
export class ProfitImportService {
    private readonly logger = new Logger(ProfitImportService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * 预览解析Excel文件，返回解析结果供用户确认
     */
    async preview(buffer: Buffer): Promise<ImportPreviewResult> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const ws = workbook.worksheets[0];
        if (!ws) throw new BadRequestException('Excel文件中没有工作表');

        const warnings: string[] = [];

        // 1. 解析标题获取年月
        const { year, month } = this.parseYearMonth(ws, warnings);

        // 2. 检查是否已存在该月报表
        const existing = await this.prisma.profitReport.findFirst({
            where: { year, month, deletedAt: null },
        });

        // 3. 获取系统中的店铺、别名和快递公司
        const shops = await this.prisma.shop.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
        });
        const shopAliases = await this.prisma.shopAlias.findMany({
            select: { alias: true, shopId: true },
        });
        const aliasMap: Record<string, string> = {};
        for (const a of shopAliases) {
            aliasMap[a.alias] = a.shopId;
        }
        const expressCompanies = await this.prisma.expressCompany.findMany({
            where: { deletedAt: null },
        });

        // 4. 解析列头，映射店铺
        const shopMappings = this.parseShopColumns(ws, shops, aliasMap, warnings);

        // 5. 定位汇总区的各数据行
        const rowMap = this.locateSummaryRows(ws, warnings);

        // 6. 解析每个店铺的基础数据
        const entries: ParsedEntryData[] = [];
        for (const mapping of shopMappings) {
            const entry = this.parseEntryData(
                ws, mapping, rowMap, expressCompanies, warnings,
            );
            entries.push(entry);
        }

        // 7. 解析分摊类别和金额
        const allocationCategories = rowMap.allocationRows.map(r => r.label);

        // 8. 解析各店铺费用明细区块
        this.parseStoreExpenseBlocks(ws, entries, shops, aliasMap, warnings, rowMap.storeExpenseRow);

        // 9. 解析公司费用
        const companyExpenses = this.parseCompanyExpenses(ws, warnings);

        // 10. 解析不计入费用
        const nonExpenses = this.parseNonExpenses(ws, warnings);

        return {
            year,
            month,
            existingReportId: existing?.id ?? null,
            existingReportStatus: existing?.status ?? null,
            entries: entries.map(e => ({
                excelName: e.shopMapping.excelName,
                shopName: e.shopMapping.shopName,
                shopId: e.shopMapping.shopId,
                matched: e.shopMapping.matched,
                salesAmount: e.salesAmount,
                rawMaterialCost: e.rawMaterialCost,
                packagingCost: e.packagingCost,
                laborCost: e.laborCost,
                shippingCosts: e.shippingCosts.map(sc => ({
                    ...sc,
                    matched: sc.expressCompanyId !== null,
                })),
                storeExpenses: e.storeExpenses,
                shippingTotal: e.shippingTotal,
                storeExpenseTotal: e.storeExpenseTotal,
                allocations: e.allocations,
                grossProfit: e.grossProfit,
                netProfit: e.netProfit,
            })),
            allocationCategories,
            companyExpenses,
            nonExpenses,
            warnings,
        };
    }

    /**
     * 确认导入，将解析结果写入数据库
     */
    async confirmImport(buffer: Buffer, user: UserPayload): Promise<{ reportId: string }> {
        const preview = await this.preview(buffer);
        const userId = typeof user === 'string' ? user : (user.userId || user.sub);

        // 校验所有店铺都已匹配
        const unmatchedShops = preview.entries.filter(e => !e.matched);
        if (unmatchedShops.length > 0) {
            throw new BadRequestException(
                `以下店铺未匹配: ${unmatchedShops.map(e => e.excelName).join(', ')}`,
            );
        }

        // 校验所有快递公司都已匹配
        for (const entry of preview.entries) {
            const unmatchedExpress = entry.shippingCosts.filter(sc => !sc.matched && sc.amount > 0);
            if (unmatchedExpress.length > 0) {
                throw new BadRequestException(
                    `店铺"${entry.excelName}"中以下快递公司未匹配: ${unmatchedExpress.map(sc => sc.expressCompanyName).join(', ')}`,
                );
            }
        }

        // 事务写入
        return await this.prisma.$transaction(async (tx) => {
            let reportId: string;

            if (preview.existingReportId) {
                // 已存在的报表，必须是草稿状态才能覆盖
                if (preview.existingReportStatus !== 'DRAFT') {
                    throw new BadRequestException(
                        `${preview.year}年${preview.month}月的利润表已确认，不能覆盖导入`,
                    );
                }
                reportId = preview.existingReportId;

                // 删除旧数据（级联删除会处理子表）
                await tx.profitAllocationItem.deleteMany({
                    where: { profitReportEntry: { reportId } },
                });
                await tx.profitShippingCost.deleteMany({
                    where: { profitReportEntry: { reportId } },
                });
                await tx.profitStoreExpense.deleteMany({
                    where: { profitReportEntry: { reportId } },
                });
                await tx.profitReportEntry.deleteMany({ where: { reportId } });
                await tx.profitAllocationCategory.deleteMany({ where: { reportId } });
                await tx.profitCompanyExpense.deleteMany({ where: { reportId } });
                await tx.profitNonExpense.deleteMany({ where: { reportId } });

                await tx.profitReport.update({
                    where: { id: reportId },
                    data: { updatedBy: userId },
                });
            } else {
                // 创建新报表
                const report = await tx.profitReport.create({
                    data: {
                        year: preview.year,
                        month: preview.month,
                        status: 'DRAFT',
                        createdBy: userId,
                        updatedBy: userId,
                    },
                });
                reportId = report.id;
            }

            // 创建分摊类别
            const categoryMap = new Map<string, string>();
            for (let i = 0; i < preview.allocationCategories.length; i++) {
                const cat = await tx.profitAllocationCategory.create({
                    data: {
                        reportId,
                        name: preview.allocationCategories[i],
                        sortOrder: i,
                    },
                });
                categoryMap.set(preview.allocationCategories[i], cat.id);
            }

            // 创建各店铺条目
            for (let i = 0; i < preview.entries.length; i++) {
                const e = preview.entries[i];
                const entry = await tx.profitReportEntry.create({
                    data: {
                        reportId,
                        shopId: e.shopId!,
                        salesAmount: e.salesAmount,
                        rawMaterialCost: e.rawMaterialCost,
                        packagingCost: e.packagingCost,
                        laborCost: e.laborCost,
                        grossProfit: e.grossProfit,
                        netProfit: e.netProfit,
                        sortOrder: i,
                    },
                });

                // 快递费
                if (e.shippingCosts.length > 0) {
                    await tx.profitShippingCost.createMany({
                        data: e.shippingCosts
                            .filter(sc => sc.amount !== 0)
                            .map((sc, idx) => ({
                                entryId: entry.id,
                                expressCompanyId: sc.expressCompanyId!,
                                amount: sc.amount,
                                sortOrder: idx,
                            })),
                    });
                }

                // 店铺费用
                if (e.storeExpenses.length > 0) {
                    await tx.profitStoreExpense.createMany({
                        data: e.storeExpenses.map((se, idx) => ({
                            entryId: entry.id,
                            name: se.name,
                            amount: se.amount,
                            sortOrder: idx,
                        })),
                    });
                }

                // 分摊金额
                if (e.allocations.length > 0) {
                    await tx.profitAllocationItem.createMany({
                        data: e.allocations
                            .filter(a => a.amount !== 0 && categoryMap.has(a.categoryName))
                            .map(a => ({
                                entryId: entry.id,
                                categoryId: categoryMap.get(a.categoryName)!,
                                amount: a.amount,
                            })),
                    });
                }
            }

            // 公司费用
            if (preview.companyExpenses.length > 0) {
                await tx.profitCompanyExpense.createMany({
                    data: preview.companyExpenses.map((ce, idx) => ({
                        reportId,
                        name: ce.name,
                        amount: ce.amount,
                        isAllocatable: true,
                        sortOrder: idx,
                    })),
                });
            }

            // 不计入费用
            if (preview.nonExpenses.length > 0) {
                await tx.profitNonExpense.createMany({
                    data: preview.nonExpenses.map((ne, idx) => ({
                        reportId,
                        name: ne.name,
                        amount: ne.amount,
                        sortOrder: idx,
                    })),
                });
            }

            this.logger.log(
                `利润表Excel导入成功: ${preview.year}年${preview.month}月, reportId=${reportId}`,
            );

            return { reportId };
        });
    }

    /**
     * 从 JSON 数据导入利润表（AI Skill 专用）
     * 接收已结构化的数据，直接写入数据库
     */
    async importFromJson(dto: JsonImportProfitReportDto, user: UserPayload): Promise<{ reportId: string }> {
        const userId = typeof user === 'string' ? user : (user.userId || user.sub);

        // 校验店铺存在
        const shopIds = dto.entries.map(e => e.shopId);
        const shops = await this.prisma.shop.findMany({
            where: { id: { in: shopIds }, status: 'ACTIVE', deletedAt: null },
        });
        const validShopIds = new Set(shops.map(s => s.id));
        const invalidShops = shopIds.filter(id => !validShopIds.has(id));
        if (invalidShops.length > 0) {
            throw new BadRequestException(`以下店铺ID无效: ${invalidShops.join(', ')}`);
        }

        // 校验快递公司存在
        const allExpressIds = new Set<string>();
        for (const entry of dto.entries) {
            for (const sc of entry.shippingCosts || []) {
                if (sc.amount !== 0) allExpressIds.add(sc.expressCompanyId);
            }
        }
        if (allExpressIds.size > 0) {
            const companies = await this.prisma.expressCompany.findMany({
                where: { id: { in: [...allExpressIds] }, deletedAt: null },
            });
            const validIds = new Set(companies.map(c => c.id));
            const invalid = [...allExpressIds].filter(id => !validIds.has(id));
            if (invalid.length > 0) {
                throw new BadRequestException(`以下快递公司ID无效: ${invalid.join(', ')}`);
            }
        }

        // 检查已存在的报表
        const existing = await this.prisma.profitReport.findFirst({
            where: { year: dto.year, month: dto.month, deletedAt: null },
        });

        return await this.prisma.$transaction(async (tx) => {
            let reportId: string;

            if (existing) {
                if (existing.status !== 'DRAFT') {
                    throw new BadRequestException(
                        `${dto.year}年${dto.month}月的利润表已确认，不能覆盖导入`,
                    );
                }
                reportId = existing.id;

                // 清除旧数据
                await tx.profitAllocationItem.deleteMany({
                    where: { profitReportEntry: { reportId } },
                });
                await tx.profitShippingCost.deleteMany({
                    where: { profitReportEntry: { reportId } },
                });
                await tx.profitStoreExpense.deleteMany({
                    where: { profitReportEntry: { reportId } },
                });
                await tx.profitReportEntry.deleteMany({ where: { reportId } });
                await tx.profitAllocationCategory.deleteMany({ where: { reportId } });
                await tx.profitCompanyExpense.deleteMany({ where: { reportId } });
                await tx.profitNonExpense.deleteMany({ where: { reportId } });

                await tx.profitReport.update({
                    where: { id: reportId },
                    data: { updatedBy: userId },
                });
            } else {
                const report = await tx.profitReport.create({
                    data: {
                        year: dto.year,
                        month: dto.month,
                        status: 'DRAFT',
                        createdBy: userId,
                        updatedBy: userId,
                    },
                });
                reportId = report.id;
            }

            // 创建分摊类别
            const categoryMap = new Map<string, string>();
            const categories = dto.allocationCategories || [];
            for (let i = 0; i < categories.length; i++) {
                const cat = await tx.profitAllocationCategory.create({
                    data: {
                        reportId,
                        name: categories[i],
                        sortOrder: i,
                    },
                });
                categoryMap.set(categories[i], cat.id);
            }

            // 创建店铺条目
            for (let i = 0; i < dto.entries.length; i++) {
                const e = dto.entries[i];
                const entry = await tx.profitReportEntry.create({
                    data: {
                        reportId,
                        shopId: e.shopId,
                        salesAmount: e.salesAmount,
                        rawMaterialCost: e.rawMaterialCost,
                        packagingCost: e.packagingCost,
                        laborCost: e.laborCost,
                        grossProfit: e.grossProfit ?? null,
                        netProfit: e.netProfit ?? null,
                        sortOrder: i,
                    },
                });

                // 快递费
                const shippingCosts = (e.shippingCosts || []).filter(sc => sc.amount !== 0);
                if (shippingCosts.length > 0) {
                    await tx.profitShippingCost.createMany({
                        data: shippingCosts.map((sc, idx) => ({
                            entryId: entry.id,
                            expressCompanyId: sc.expressCompanyId,
                            amount: sc.amount,
                            sortOrder: idx,
                        })),
                    });
                }

                // 店铺费用
                const storeExpenses = e.storeExpenses || [];
                if (storeExpenses.length > 0) {
                    await tx.profitStoreExpense.createMany({
                        data: storeExpenses.map((se, idx) => ({
                            entryId: entry.id,
                            name: se.name,
                            amount: se.amount,
                            sortOrder: idx,
                        })),
                    });
                }

                // 分摊金额
                const allocations = (e.allocations || []).filter(
                    a => a.amount !== 0 && categoryMap.has(a.categoryName),
                );
                if (allocations.length > 0) {
                    await tx.profitAllocationItem.createMany({
                        data: allocations.map(a => ({
                            entryId: entry.id,
                            categoryId: categoryMap.get(a.categoryName)!,
                            amount: a.amount,
                        })),
                    });
                }
            }

            // 公司费用
            const companyExpenses = dto.companyExpenses || [];
            if (companyExpenses.length > 0) {
                await tx.profitCompanyExpense.createMany({
                    data: companyExpenses.map((ce, idx) => ({
                        reportId,
                        name: ce.name,
                        amount: ce.amount,
                        isAllocatable: ce.isAllocatable ?? true,
                        sortOrder: idx,
                    })),
                });
            }

            // 不计入费用
            const nonExpenses = dto.nonExpenses || [];
            if (nonExpenses.length > 0) {
                await tx.profitNonExpense.createMany({
                    data: nonExpenses.map((ne, idx) => ({
                        reportId,
                        name: ne.name,
                        amount: ne.amount,
                        sortOrder: idx,
                    })),
                });
            }

            this.logger.log(
                `利润表JSON导入成功: ${dto.year}年${dto.month}月, reportId=${reportId}`,
            );

            return { reportId };
        });
    }

    // ========== 私有解析方法 ==========

    /**
     * 从标题行解析年月（如 "2026.1月利润表" 或 "2025.12月利润表"）
     */
    private parseYearMonth(ws: ExcelJS.Worksheet, warnings: string[]): { year: number; month: number } {
        const title = this.getCellValue(ws, 1, 1);
        if (!title || typeof title !== 'string') {
            throw new BadRequestException('无法读取Excel标题行(A1)，请确认文件格式');
        }

        // 匹配 "YYYY.M月利润表" 格式
        const match = title.match(/(\d{4})\.(\d{1,2})月?.*利润表/);
        if (!match) {
            throw new BadRequestException(`无法从标题"${title}"中解析年月，期望格式如"2026.1月利润表"`);
        }

        return { year: parseInt(match[1]), month: parseInt(match[2]) };
    }

    /**
     * 解析行2的列头，匹配系统店铺
     */
    private parseShopColumns(
        ws: ExcelJS.Worksheet,
        shops: any[],
        aliasMap: Record<string, string>,
        warnings: string[],
    ): ShopColumnMapping[] {
        const mappings: ShopColumnMapping[] = [];
        const row2 = ws.getRow(2);

        for (let col = 2; col <= 50; col++) {
            const val = this.getRowCellValue(row2, col);
            if (!val || typeof val !== 'string') continue;

            const name = val.trim();
            if (name === '本月合计' || name === '备注' || name === '合计') break;

            // 尝试匹配系统店铺
            const { shopId, shopName } = this.matchShop(name, shops, aliasMap);

            mappings.push({
                colIndex: col,
                colLetter: this.colToLetter(col),
                excelName: name,
                shopId,
                shopName,
                matched: shopId !== null,
            });

            if (!shopId) {
                warnings.push(`列${this.colToLetter(col)} 店铺"${name}"未匹配到系统店铺`);
            }
        }

        if (mappings.length === 0) {
            throw new BadRequestException('未在行2中找到任何店铺列头');
        }

        return mappings;
    }

    /**
     * 匹配店铺名
     */
    private matchShop(
        excelName: string,
        shops: any[],
        aliasMap: Record<string, string>,
    ): { shopId: string | null; shopName: string | null } {
        // 1. 精确匹配
        const exact = shops.find(s => s.name === excelName);
        if (exact) return { shopId: exact.id, shopName: exact.name };

        // 2. 别名匹配（从数据库shop_aliases表加载）
        const aliasShopId = aliasMap[excelName];
        if (aliasShopId) {
            const aliasShop = shops.find(s => s.id === aliasShopId);
            if (aliasShop) return { shopId: aliasShop.id, shopName: aliasShop.name };
        }

        // 3. 包含匹配（系统名包含Excel名，或Excel名包含系统名）
        const containsMatch = shops.find(
            s => s.name.includes(excelName) || excelName.includes(s.name),
        );
        if (containsMatch) return { shopId: containsMatch.id, shopName: containsMatch.name };

        return { shopId: null, shopName: null };
    }

    /**
     * 定位汇总区各数据行
     */
    private locateSummaryRows(
        ws: ExcelJS.Worksheet,
        warnings: string[],
    ): {
        salesRow: number;
        rawMaterialRow: number;
        packagingRow: number;
        laborRow: number;
        shippingRows: { row: number; label: string }[];
        shippingTotalRow: number;
        storeExpenseRow: number;
        allocationRows: { row: number; label: string }[];
        grossRow: number;
        netProfitRow: number;
        expenseTotalRow: number;
    } {
        let salesRow = 0;
        let rawMaterialRow = 0;
        let packagingRow = 0;
        let laborRow = 0;
        const shippingRows: { row: number; label: string }[] = [];
        let shippingTotalRow = 0;
        let storeExpenseRow = 0;
        const allocationRows: { row: number; label: string }[] = [];
        let grossRow = 0;
        let netProfitRow = 0;
        let expenseTotalRow = 0;
        let inAllocationZone = false;

        // 扫描A列(行3~50)识别各区域
        for (let r = 3; r <= 50; r++) {
            const label = this.getCellStringValue(ws, r, 1);
            if (!label) continue;

            const trimmed = label.trim();

            if (trimmed === '销售额') {
                salesRow = r;
            } else if (trimmed.includes('原料成本')) {
                rawMaterialRow = r;
            } else if (trimmed.includes('包装成本')) {
                packagingRow = r;
            } else if (trimmed.includes('人工成本')) {
                laborRow = r;
            } else if (this.isShippingRow(trimmed)) {
                shippingRows.push({ row: r, label: trimmed });
            } else if (trimmed === '快递费合计') {
                shippingTotalRow = r;
            } else if (trimmed.startsWith('等于') && trimmed.includes('毛利')) {
                grossRow = r;
            } else if (trimmed === '净利润') {
                netProfitRow = r;
            } else if (trimmed === '各店铺费用') {
                storeExpenseRow = r;
                inAllocationZone = true;
            } else if (trimmed === '费用合计') {
                expenseTotalRow = r;
                inAllocationZone = false;
            } else if (inAllocationZone && trimmed !== '毛利率') {
                // 分摊项
                allocationRows.push({ row: r, label: trimmed });
            }

            // 到"净利润"或"费用合计"之后就不再往下了
            if (trimmed === '净利润' && expenseTotalRow > 0) break;
        }

        if (!salesRow) warnings.push('未找到"销售额"行');
        if (!rawMaterialRow) warnings.push('未找到"原料成本"行');
        if (!packagingRow) warnings.push('未找到"包装成本"行');
        if (!laborRow) warnings.push('未找到"人工成本"行');

        return {
            salesRow,
            rawMaterialRow,
            packagingRow,
            laborRow,
            shippingRows,
            shippingTotalRow,
            storeExpenseRow,
            allocationRows,
            grossRow,
            netProfitRow,
            expenseTotalRow,
        };
    }

    /**
     * 判断是否是快递费行
     */
    private isShippingRow(label: string): boolean {
        const keywords = ['快递费', '快运', '物流', '圆通', '中通', '韵达', '申通', '顺心', '极兔', '邮政'];
        return keywords.some(k => label.includes(k)) && !label.includes('合计');
    }

    /**
     * 匹配快递公司
     */
    private matchExpressCompany(
        label: string,
        companies: any[],
    ): { expressCompanyId: string | null; expressCompanyName: string } {
        const cleanLabel = label.replace(/^减\s*/, '').trim();

        // 按关键字长度从长到短排序匹配（优先匹配更精确的）
        const sortedKeys = Object.keys(EXPRESS_KEYWORDS).sort(
            (a, b) => b.length - a.length,
        );

        for (const keyword of sortedKeys) {
            if (cleanLabel.includes(keyword)) {
                const systemName = EXPRESS_KEYWORDS[keyword];
                const company = companies.find(c => c.name === systemName);
                if (company) {
                    return { expressCompanyId: company.id, expressCompanyName: systemName };
                }
            }
        }

        return { expressCompanyId: null, expressCompanyName: cleanLabel };
    }

    /**
     * 解析单个店铺的基础数据
     */
    private parseEntryData(
        ws: ExcelJS.Worksheet,
        mapping: ShopColumnMapping,
        rowMap: ReturnType<typeof this.locateSummaryRows>,
        expressCompanies: any[],
        warnings: string[],
    ): ParsedEntryData {
        const col = mapping.colIndex;

        const salesAmount = this.getNumericValue(ws, rowMap.salesRow, col);

        // 检测原料/包装/人工三行是否为合并单元格
        let rawMaterialCost: number;
        let packagingCost: number;
        let laborCost: number;

        const isCostMerged = this.isCellMergedVertically(
            ws, col, rowMap.rawMaterialRow, rowMap.laborRow,
        );

        if (isCostMerged) {
            // 合并单元格：值是三项合计，仅存入rawMaterialCost
            rawMaterialCost = this.getNumericValue(ws, rowMap.rawMaterialRow, col);
            packagingCost = 0;
            laborCost = 0;
        } else {
            // 分开填写：正常读取
            rawMaterialCost = this.getNumericValue(ws, rowMap.rawMaterialRow, col);
            packagingCost = this.getNumericValue(ws, rowMap.packagingRow, col);
            laborCost = this.getNumericValue(ws, rowMap.laborRow, col);
        }

        // 快递费
        const shippingCosts = rowMap.shippingRows.map(sr => {
            const amount = this.getNumericValue(ws, sr.row, col);
            const { expressCompanyId, expressCompanyName } = this.matchExpressCompany(
                sr.label, expressCompanies,
            );
            return { expressCompanyName, expressCompanyId, amount };
        });

        // 分摊项
        const allocations = rowMap.allocationRows.map(ar => {
            const amount = this.getNumericValue(ws, ar.row, col);
            return { categoryName: ar.label, amount };
        });

        // 从汇总行读取精确值（避免浮点累加误差）
        const shippingTotal = rowMap.shippingTotalRow
            ? this.getNumericValue(ws, rowMap.shippingTotalRow, col) : 0;
        const storeExpenseTotal = rowMap.storeExpenseRow
            ? this.getNumericValue(ws, rowMap.storeExpenseRow, col) : 0;
        const grossProfit = rowMap.grossRow
            ? this.getNumericValue(ws, rowMap.grossRow, col) : 0;
        const netProfit = rowMap.netProfitRow
            ? this.getNumericValue(ws, rowMap.netProfitRow, col) : 0;

        return {
            shopMapping: mapping,
            salesAmount,
            rawMaterialCost,
            packagingCost,
            laborCost,
            shippingCosts,
            shippingTotal,
            storeExpenses: [], // 后面单独解析
            storeExpenseTotal,
            allocations,
            grossProfit,
            netProfit,
        };
    }

    /**
     * 解析各店铺费用明细区块
     */
    private parseStoreExpenseBlocks(
        ws: ExcelJS.Worksheet,
        entries: ParsedEntryData[],
        shops: any[],
        aliasMap: Record<string, string>,
        warnings: string[],
        storeExpenseRow: number,
    ): void {
        const maxRow = ws.rowCount;

        // 扫描所有行，找费用区块标题
        // 格式如: "天猫2026.1月费用", "觅洁费用2026.1月", "2026.1pdd帮你旗舰店费用"
        const blocks: { startRow: number; shopName: string }[] = [];

        for (let r = 28; r <= maxRow; r++) {
            const a = this.getCellStringValue(ws, r, 1);
            if (!a) continue;

            const trimmed = a.trim();
            // 费用区块标题：包含"费用"和年月，排除公司费用
            if (trimmed.includes('费用') && /\d{4}\.\d{1,2}/.test(trimmed) && !trimmed.includes('公司费用')) {
                // B列可能为空，也可能因合并单元格包含与A列相同的标题文本
                const bStr = this.getCellStringValue(ws, r, 2);
                const bNum = this.getNumericValue(ws, r, 2);
                const isTitle = !bStr || bStr === trimmed || bNum === 0;
                if (isTitle) {
                    // 解析标题中的店铺名
                    const shopName = this.extractShopNameFromExpenseTitle(trimmed, shops, aliasMap);
                    if (shopName) {
                        blocks.push({ startRow: r, shopName });
                    } else {
                        warnings.push(`行${r}: 费用区块标题"${trimmed}"无法匹配店铺`);
                    }
                }
            }
        }

        // 解析每个区块的费用明细
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            const endRow = i < blocks.length - 1
                ? blocks[i + 1].startRow - 1
                : this.findCompanyExpenseStart(ws) - 1;

            const expenses: { name: string; amount: number }[] = [];
            for (let r = block.startRow + 1; r <= endRow && r <= maxRow; r++) {
                const name = this.getCellStringValue(ws, r, 1);
                const amount = this.getNumericValue(ws, r, 2);
                if (!name) continue;
                if (name.trim() === '合计') break;
                if (amount === 0 && !name) continue;
                expenses.push({ name: name.trim(), amount });
            }

            // 匹配到对应的entry
            const entry = entries.find(e =>
                e.shopMapping.shopName === block.shopName
                || e.shopMapping.excelName === block.shopName,
            );
            if (entry) {
                entry.storeExpenses = expenses;
            } else {
                warnings.push(`费用区块"${block.shopName}"未匹配到任何店铺条目`);
            }
        }

        // 对没有独立费用区块的店铺，从汇总行读取费用总额作为单条"店铺费用"
        if (storeExpenseRow > 0) {
            for (const entry of entries) {
                if (entry.storeExpenses.length === 0) {
                    const totalExpense = this.getNumericValue(ws, storeExpenseRow, entry.shopMapping.colIndex);
                    if (totalExpense > 0) {
                        entry.storeExpenses = [{ name: '店铺费用', amount: totalExpense }];
                    }
                }
            }
        }
    }

    /**
     * 从费用区块标题中提取店铺名
     */
    private extractShopNameFromExpenseTitle(title: string, shops: any[], aliasMap: Record<string, string>): string | null {
        // 去掉年月和"费用"/"月费用"
        const cleaned = title
            .replace(/\d{4}\.\d{1,2}月?/g, '')
            .replace(/费用/g, '')
            .replace(/户外/g, '')
            .trim();

        if (!cleaned) return null;

        // 1. 精确匹配店铺名
        const exactShop = shops.find(s => s.name === cleaned);
        if (exactShop) return exactShop.name;

        // 2. 精确匹配数据库别名
        if (aliasMap[cleaned]) {
            const shop = shops.find(s => s.id === aliasMap[cleaned]);
            if (shop) return shop.name;
        }

        // 3. 模糊匹配别名（别名包含或被包含，按长度降序确保长别名优先）
        const sortedAliases = Object.entries(aliasMap).sort((a, b) => b[0].length - a[0].length);
        for (const [alias, shopId] of sortedAliases) {
            if (cleaned.includes(alias) || alias.includes(cleaned)) {
                const shop = shops.find(s => s.id === shopId);
                if (shop) return shop.name;
            }
        }

        // 4. 模糊匹配店铺名
        const containsMatch = shops.find(
            s => s.name.includes(cleaned) || cleaned.includes(s.name),
        );
        if (containsMatch) return containsMatch.name;

        return null;
    }

    /**
     * 查找公司费用区块的起始行
     */
    private findCompanyExpenseStart(ws: ExcelJS.Worksheet): number {
        const maxRow = ws.rowCount;
        for (let r = 30; r <= maxRow; r++) {
            const a = this.getCellStringValue(ws, r, 1);
            if (a && a.includes('公司费用') && /\d{4}/.test(a)) {
                return r;
            }
        }
        return maxRow;
    }

    /**
     * 解析公司费用区块
     */
    private parseCompanyExpenses(ws: ExcelJS.Worksheet, warnings: string[]): ParsedCompanyExpense[] {
        const startRow = this.findCompanyExpenseStart(ws);
        if (startRow >= ws.rowCount) {
            warnings.push('未找到公司费用区块');
            return [];
        }

        const expenses: ParsedCompanyExpense[] = [];
        for (let r = startRow + 1; r <= ws.rowCount; r++) {
            const name = this.getCellStringValue(ws, r, 1);
            const amount = this.getNumericValue(ws, r, 2);
            if (!name) continue;
            if (name.trim() === '合计') break;
            if (name.trim() && amount !== 0) {
                expenses.push({ name: name.trim(), amount });
            }
        }

        return expenses;
    }

    /**
     * 解析不计入费用区块
     */
    private parseNonExpenses(ws: ExcelJS.Worksheet, warnings: string[]): ParsedNonExpense[] {
        const maxRow = ws.rowCount;
        // 找到公司费用合计行之后的区域
        const companyStart = this.findCompanyExpenseStart(ws);
        let companyEnd = companyStart;

        for (let r = companyStart + 1; r <= maxRow; r++) {
            const name = this.getCellStringValue(ws, r, 1);
            if (name && name.trim() === '合计') {
                companyEnd = r;
                break;
            }
        }

        // 从公司费用合计行之后扫描不计入费用
        const expenses: ParsedNonExpense[] = [];
        for (let r = companyEnd + 1; r <= maxRow; r++) {
            const a = this.getCellStringValue(ws, r, 1);
            const b = this.getNumericValue(ws, r, 2);
            const c = this.getCellStringValue(ws, r, 3);

            if (a && a.trim() === '合计') break;

            // 不计入费用项格式: A列=日期或名称, B列=金额, C列=名称（有时）
            // 或者 A列=名称, B列=金额
            if (b !== 0) {
                let name = '';
                if (c && c.trim()) {
                    name = c.trim(); // C列有内容时，名称在C列
                } else if (a && a.trim()) {
                    // A列是日期格式(如 2026.1)则跳过用C列，否则A列就是名称
                    const trimmedA = a.trim();
                    if (/^\d{4}\.\d{1,2}$/.test(trimmedA)) {
                        // 日期格式，名称需要从C列获取，但C列为空就用A列
                        continue; // 这行数据不完整，跳过
                    }
                    name = trimmedA;
                }

                if (name && name !== '不计入费用') {
                    expenses.push({ name, amount: b });
                }
            }
        }

        return expenses;
    }

    // ========== 工具方法 ==========

    private getCellValue(ws: ExcelJS.Worksheet, row: number, col: number): any {
        if (row <= 0) return null;
        const cell = ws.getCell(row, col);
        if (!cell) return null;
        const val = cell.value;
        if (val === null || val === undefined) return null;
        // 处理ExcelJS的富文本和公式
        if (typeof val === 'object') {
            if ('result' in val) return val.result; // 公式结果
            if ('richText' in val) {
                return (val as any).richText.map((t: any) => t.text).join('');
            }
        }
        return val;
    }

    private getCellStringValue(ws: ExcelJS.Worksheet, row: number, col: number): string | null {
        const val = this.getCellValue(ws, row, col);
        if (val === null || val === undefined) return null;
        return String(val);
    }

    private getNumericValue(ws: ExcelJS.Worksheet, row: number, col: number): number {
        if (row <= 0) return 0;
        const val = this.getCellValue(ws, row, col);
        if (val === null || val === undefined) return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : Math.round(num * 100) / 100;
    }

    private getRowCellValue(row: ExcelJS.Row, col: number): any {
        const cell = row.getCell(col);
        if (!cell) return null;
        const val = cell.value;
        if (val === null || val === undefined) return null;
        if (typeof val === 'object') {
            if ('result' in val) return val.result;
            if ('richText' in val) {
                return (val as any).richText.map((t: any) => t.text).join('');
            }
        }
        return val;
    }

    private colToLetter(col: number): string {
        let result = '';
        let c = col;
        while (c > 0) {
            c--;
            result = String.fromCharCode(65 + (c % 26)) + result;
            c = Math.floor(c / 26);
        }
        return result;
    }

    /**
     * 检测指定列的某些行是否被纵向合并
     * 例如: 原料(row4)、包装(row5)、人工(row6)三行在某列被合并
     */
    private isCellMergedVertically(
        ws: ExcelJS.Worksheet,
        col: number,
        startRow: number,
        endRow: number,
    ): boolean {
        if (startRow <= 0 || endRow <= 0) return false;
        const colLetter = this.colToLetter(col);
        // 检查worksheet的合并单元格列表
        const merges = (ws as any).model?.merges || [];
        for (const merge of merges) {
            // merge格式: "B4:B6" 或 "B4:C6"
            const match = merge.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
            if (!match) continue;
            const mColStart = match[1];
            const mRowStart = parseInt(match[2]);
            const mColEnd = match[3];
            const mRowEnd = parseInt(match[4]);
            // 同一列的纵向合并，且覆盖了startRow到endRow的范围
            if (mColStart === colLetter && mColEnd === colLetter
                && mRowStart <= startRow && mRowEnd >= endRow) {
                return true;
            }
        }
        return false;
    }
}

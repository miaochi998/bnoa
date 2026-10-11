import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProfitService } from './profit.service';
import { PrismaService } from '../../config/prisma.service';
import {
  DataScope,
  FieldKeyMapping,
  FieldPermissionService,
  FieldPermissionState,
} from '../role/field-permission.service';
import { ProfitImportService } from './profit-import.service';
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
    JsonImportProfitReportDto,
} from './dto/profit.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator';

/**
 * 利润报表字段映射：用于「信息权限」的读取脱敏与写入过滤
 * ⚠️ 金额散落在多张子表：
 *   - entries 明细：销售额 / 原料成本 / 包装成本 / 人工成本 / 毛利 / 净利；
 *   - 公司费用 / 店铺费用 / 非费用 / 快递费 / 分摊项：统一用 `amount`；
 *   - 列表与分析接口的汇总：totalExpense / totalNetProfit。
 */
const PROFIT_FIELD_MAP: FieldKeyMapping[] = [
    { field: 'year', key: 'year' },
    { field: 'month', key: 'month' },
    { field: 'status', key: 'status' },
    { field: 'remark', key: 'remark' },
    { field: 'summary.totalExpense', key: 'totalExpense' },
    { field: 'summary.totalNetProfit', key: 'totalNetProfit' },
    { field: 'entry.salesAmount', key: 'salesAmount' },
    { field: 'entry.rawMaterialCost', key: 'rawMaterialCost' },
    { field: 'entry.packagingCost', key: 'packagingCost' },
    { field: 'entry.laborCost', key: 'laborCost' },
    { field: 'entry.grossProfit', key: 'grossProfit' },
    { field: 'entry.netProfit', key: 'netProfit' },
    { field: 'amount', key: 'amount' },
    // ---- 分析 / 月度趋势接口的派生汇总 ----
    // 这些接口（getAnalysis / getMonthlyTrend）返回的键名与详情接口不同
    // （totalNet / totalGross / totalSales …），若只映射详情键名，
    // 受限角色仍能从分析页读到全部毛利润/净利润。
    { field: 'entry.salesAmount', key: 'totalSales' },
    { field: 'entry.grossProfit', key: 'totalGross' },
    { field: 'entry.netProfit', key: 'totalNet' },
    { field: 'entry.rawMaterialCost', key: 'totalRawMaterial' },
    { field: 'entry.packagingCost', key: 'totalPackaging' },
    { field: 'entry.laborCost', key: 'totalLabor' },
];

/**
 * 需要递归脱敏/过滤的嵌套数组字段（利润报表的明细与费用都挂在数组里）
 * ⚠️ 同一个概念在不同接口里的字段名不同：
 *   数据库关系名 profitShippingCosts / profitStoreExpenses / profitAllocationItems
 *   vs 详情接口返回的 shippingCosts / storeExpenses / allocations；
 *   写接口则统一是 items。三套都要列进来，否则嵌套脱敏会漏。
 */
const PROFIT_NESTED_ARRAYS = [
    'profitReportEntries',
    'entries',
    'profitCompanyExpenses',
    'companyExpenses',
    'profitNonExpenses',
    'nonExpenses',
    'profitAllocationCategories',
    'allocationCategories',
    'profitShippingCosts',
    'shippingCosts',
    'profitStoreExpenses',
    'storeExpenses',
    'profitAllocationItems',
    'allocations',
    'items',
];

@ApiTags('利润表管理')
@Controller('profit-reports')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ProfitController {    constructor(
        private readonly profitService: ProfitService,
        private readonly fieldPermissionService: FieldPermissionService,
        private readonly prisma: PrismaService,
        private readonly profitImportService: ProfitImportService,
    ) {}

    @Post()
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async create(
        @Body() dto: CreateProfitReportDto,
        @CurrentUser() user: UserPayload,
    ) {
        const shopIds = await this.resolveShopIds(user);
        const report = await this.profitService.create(dto, user, shopIds);
        const state = await this.resolveFields(user);
        return this.stripReportDeep(report, state);
    }

    @Get()
    @Permissions('profit:view')
    async findAll(
        @Query() query: QueryProfitReportDto,
        @CurrentUser() user: UserPayload,
    ) {
        const shopIds = await this.resolveShopIds(user);
        const result = await this.profitService.findAll(query, shopIds);
        const state = await this.resolveFields(user);
        return {
            ...result,
            list: this.stripReportListDeep(result.list as any[], state),
        };
    }

    @Get('available-periods')
    @Permissions('profit:view')
    async getAvailablePeriods() {
        return this.profitService.getAvailablePeriods();
    }

    @Get('analysis')
    @Permissions('profit:analysis')
    async getAnalysis(
        @Query() query: QueryProfitAnalysisDto,
        @CurrentUser() user: UserPayload,
    ) {
        const shopIds = await this.resolveShopIds(user);
        const data = await this.profitService.getAnalysis(query, user, shopIds);
        const state = await this.resolveFields(user);
        return this.stripReportDeep(data, state);
    }

    @Get('analysis/monthly-trend')
    @Permissions('profit:analysis')
    async getMonthlyTrend(
        @Query() query: QueryMonthlyTrendDto,
        @CurrentUser() user: UserPayload,
    ) {
        const shopIds = await this.resolveShopIds(user);
        const data = await this.profitService.getMonthlyTrend(query, user, shopIds);
        const state = await this.resolveFields(user);
        return this.stripReportDeep(data, state);
    }

    // ========== Excel 导入（必须在 :id 路由之前） ==========

    @Post('import/preview')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (!file.originalname.match(/\.xlsx?$/i)) {
                return cb(new BadRequestException('仅支持 .xlsx 格式文件'), false);
            }
            cb(null, true);
        },
    }))
    async importPreview(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: UserPayload,
    ) {
        if (!file) throw new BadRequestException('请上传Excel文件');
        const shopIds = await this.resolveShopIds(user);
        return this.profitImportService.preview(file.buffer, shopIds);
    }

    @Post('import/confirm')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file', {
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
            if (!file.originalname.match(/\.xlsx?$/i)) {
                return cb(new BadRequestException('仅支持 .xlsx 格式文件'), false);
            }
            cb(null, true);
        },
    }))
    async importConfirm(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: UserPayload,
    ) {
        if (!file) throw new BadRequestException('请上传Excel文件');
        const shopIds = await this.resolveShopIds(user);
        const { reportId } = await this.profitImportService.confirmImport(
            file.buffer,
            user,
            shopIds,
        );
        // 导入接口同样做读脱敏（原来直接把完整报表返回给前端）
        const report = await this.profitService.findById(reportId, user, shopIds);
        const state = await this.resolveFields(user);
        return this.stripReportDeep(report, state);
    }

    @Post('import/json')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async importJson(
        @Body() dto: JsonImportProfitReportDto,
        @CurrentUser() user: UserPayload,
    ) {
        const shopIds = await this.resolveShopIds(user);
        const { reportId } = await this.profitImportService.importFromJson(
            dto,
            user,
            shopIds,
        );
        // 导入接口同样做读脱敏（原来直接把完整报表返回给前端）
        const report = await this.profitService.findById(reportId, user, shopIds);
        const state = await this.resolveFields(user);
        return this.stripReportDeep(report, state);
    }

    @Get(':id')
    @Permissions('profit:view')
    async findById(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const shopIds = await this.resolveShopIds(user);
        const report = await this.profitService.findById(id, user, shopIds);
        const state = await this.resolveFields(user);
        return this.stripReportDeep(report, state);
    }

    @Patch(':id')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateProfitReportDto,
        @CurrentUser() user: UserPayload,
    ) {
        // 数据范围由 service 内部统一校验（越权 404）
        const state = await this.resolveFields(user);
        const safe = this.fieldPermissionService.stripUneditableFields(
            dto as any,
            PROFIT_FIELD_MAP,
            state,
        );
        if (Object.keys(safe).length === 0) {
            throw new ForbiddenException('没有利润报表字段的编辑权限');
        }
        const report = await this.profitService.update(
            id,
            safe as UpdateProfitReportDto,
            user,
        );
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(report, state);
    }

    @Delete(':id')
    @Permissions('profit:delete')
    @HttpCode(HttpStatus.OK)
    async delete(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const result = await this.profitService.delete(id, user);
        const state = await this.resolveFields(user);
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(result, state);
    }

    // ========== 确认/撤销 ==========

    @Post(':id/confirm')
    @Permissions('profit:confirm')
    @HttpCode(HttpStatus.OK)
    async confirm(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const report = await this.profitService.confirm(id, user);
        const state = await this.resolveFields(user);
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(report, state);
    }

    @Post(':id/revoke')
    @Permissions('profit:confirm')
    @HttpCode(HttpStatus.OK)
    async revoke(
        @Param('id') id: string,
        @CurrentUser() user: UserPayload,
    ) {
        const report = await this.profitService.revoke(id, user);
        const state = await this.resolveFields(user);
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(report, state);
    }

    // ========== 数据保存 ==========

    @Put(':id/entries')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveEntries(
        @Param('id') id: string,
        @Body() dto: SaveEntriesDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditableItems(dto, state);
        const report = await this.profitService.saveEntries(
            id,
            safe as SaveEntriesDto,
            user,
        );
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(report, state);
    }

    @Put(':reportId/entries/:entryId/shipping-costs')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveShippingCosts(
        @Param('reportId') reportId: string,
        @Param('entryId') entryId: string,
        @Body() dto: SaveShippingCostsDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditableItems(dto, state);
        const report = await this.profitService.saveShippingCosts(
            reportId, entryId, safe as SaveShippingCostsDto, user,
        );
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(report, state);
    }

    @Put(':reportId/entries/:entryId/store-expenses')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveStoreExpenses(
        @Param('reportId') reportId: string,
        @Param('entryId') entryId: string,
        @Body() dto: SaveStoreExpensesDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditableItems(dto, state);
        const report = await this.profitService.saveStoreExpenses(
            reportId, entryId, safe as SaveStoreExpensesDto, user,
        );
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(report, state);
    }

    @Put(':id/allocation-categories')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveAllocationCategories(
        @Param('id') id: string,
        @Body() dto: SaveAllocationCategoriesDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const report = await this.profitService.saveAllocationCategories(
            id, dto, user,
        );
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(report, state);
    }

    @Put(':id/allocations')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveAllocations(
        @Param('id') id: string,
        @Body() dto: SaveAllocationsDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditableItems(dto, state);
        const report = await this.profitService.saveAllocations(
            id, safe as SaveAllocationsDto, user,
        );
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(report, state);
    }

    @Put(':id/company-expenses')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveCompanyExpenses(
        @Param('id') id: string,
        @Body() dto: SaveCompanyExpensesDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditableItems(dto, state);
        const report = await this.profitService.saveCompanyExpenses(
            id, safe as SaveCompanyExpensesDto, user,
        );
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(report, state);
    }

    @Put(':id/non-expenses')
    @Permissions('profit:edit')
    @HttpCode(HttpStatus.OK)
    async saveNonExpenses(
        @Param('id') id: string,
        @Body() dto: SaveNonExpensesDto,
        @CurrentUser() user: UserPayload,
    ) {
        const state = await this.resolveFields(user);
        const safe = this.stripUneditableItems(dto, state);
        const report = await this.profitService.saveNonExpenses(
            id, safe as SaveNonExpensesDto, user,
        );
        // 写接口响应与读接口一致地脱敏
        return this.stripReportDeep(report, state);
    }


  /** 当前用户在本模块的字段权限 */
  private resolveFields(user: UserPayload) {
    return this.fieldPermissionService.resolve(
      user.sub,
      'profit',
      user.roles ?? [],
    );
  }

  /**
   * 利润报表读脱敏（支持多层嵌套：明细 → 快递费/店铺费用/分摊项）
   */
  private stripReportDeep(report: any, state: FieldPermissionState): any {
    return this.fieldPermissionService.stripHiddenFieldsDeep(
      report,
      PROFIT_FIELD_MAP,
      state,
    );
  }

  /** 批量列表的读脱敏 */
  private stripReportListDeep(rows: any[], state: FieldPermissionState): any[] {
    if (!Array.isArray(rows)) return rows;
    return rows.map((r) => this.stripReportDeep(r, state));
  }

  /**
   * 写过滤：请求体里的数组逐项剔除「不可编辑」字段
   * （返回剔除后的 dto；若数组里所有字段都被剔除，交给 service/DB 层自然处理）
   */
  private stripUneditableItems(dto: any, state: FieldPermissionState): any {
    const out: any = { ...(dto ?? {}) };
    for (const key of PROFIT_NESTED_ARRAYS) {
      if (Array.isArray(out[key])) {
        const original: any[] = out[key];
        const filtered = original.map((item: any) =>
          this.fieldPermissionService.stripUneditableFields(
            item,
            PROFIT_FIELD_MAP,
            state,
          ),
        );
        // ⚠️ 关键保护：某元素「原本传了 amount、但被字段权限剔除」时直接拒绝请求。
        // 因为 service 的保存语义是「删除旧记录 + 新建」，amount 变成 undefined
        // 会落库为 schema 默认值 0 —— 等于把历史金额静默清零且不可恢复。
        const amountStripped = original.some(
          (item: any, index: number) =>
            item &&
            item.amount !== undefined &&
            filtered[index] &&
            filtered[index].amount === undefined,
        );
        if (amountStripped) {
          throw new ForbiddenException(
            '没有「费用金额」的编辑权限，已阻止保存（避免历史金额被清零）',
          );
        }
        out[key] = filtered;
      }
    }
    return out;
  }

  /**
   * 解析当前用户在利润报表模块的数据范围
   *
   * ⚠️ 这里刻意保留「自己解析」的写法（与列表接口一致）：
   * 数据范围为「全部」或未配置 → 返回 undefined = 不过滤（与改造前完全一致）；
   * 其余范围 → 只保留自己负责的店铺（可能为空数组 = 一个都看不到，fail-closed）。
   *
   * @returns 限定店铺 ID 列表；返回 undefined 表示「全部店铺」
   */
  private async resolveShopIds(user: UserPayload): Promise<string[] | undefined> {
    const scope = await this.fieldPermissionService.resolveDataScope(
      user.sub,
      'profit',
      user.roles ?? [],
    );
    if (scope === DataScope.ALL) return undefined;
    // OWN_SHOP / OWN_CREATED：只保留自己负责的店铺
    const shops = await this.prisma.shop.findMany({
      where: { managerId: user.sub, deletedAt: null },
      select: { id: true },
    });
    return shops.map((item) => item.id);
  }

}

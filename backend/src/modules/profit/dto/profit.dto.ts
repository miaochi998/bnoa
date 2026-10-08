import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsInt,
    IsNumber,
    IsArray,
    IsBoolean,
    IsUUID,
    Min,
    Max,
    ValidateNested,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ========== 分析查询 ==========

export class QueryProfitAnalysisDto {
    @ApiProperty({ description: '年份' })
    @Type(() => Number)
    @IsInt()
    year: number;

    @ApiPropertyOptional({ description: '单月筛选（1-12）' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number;

    @ApiPropertyOptional({ description: '月份列表（逗号分隔）' })
    @IsOptional()
    @IsString()
    months?: string;
}

// ========== 月度趋势查询（新分析模块） ==========

export class QueryMonthlyTrendDto {
    @ApiProperty({ description: '年份（主年份）' })
    @Type(() => Number)
    @IsInt()
    year: number;

    @ApiPropertyOptional({ description: '对比年份（跨年对比，逗号分隔，如 2024,2023）' })
    @IsOptional()
    @IsString()
    compareYears?: string;

    @ApiPropertyOptional({ description: '店铺ID（单店铺分析时传）' })
    @IsOptional()
    @IsUUID()
    shopId?: string;
}

// ========== 查询 ==========

export class QueryProfitReportDto {
    @ApiPropertyOptional({ description: '年份筛选' })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    year?: number;

    @ApiPropertyOptional({ description: '页码', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ description: '每页条数', default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pageSize?: number;
}

// ========== 创建月报 ==========

export class CreateProfitReportDto {
    @ApiProperty({ description: '年份' })
    @IsInt()
    @Min(2020)
    @Max(2100)
    year: number;

    @ApiProperty({ description: '月份 1-12' })
    @IsInt()
    @Min(1)
    @Max(12)
    month: number;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

// ========== 更新月报基础信息 ==========

export class UpdateProfitReportDto {
    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

// ========== 批量保存店铺基础数据 ==========

export class EntryBaseDataDto {
    @ApiProperty({ description: '条目ID' })
    @IsUUID()
    entryId: string;

    @ApiProperty({ description: '销售额' })
    @IsNumber()
    salesAmount: number;

    @ApiProperty({ description: '原料成本' })
    @IsNumber()
    rawMaterialCost: number;

    @ApiProperty({ description: '包装成本' })
    @IsNumber()
    packagingCost: number;

    @ApiProperty({ description: '人工成本' })
    @IsNumber()
    laborCost: number;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class SaveEntriesDto {
    @ApiProperty({ description: '店铺条目列表', type: [EntryBaseDataDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => EntryBaseDataDto)
    entries: EntryBaseDataDto[];
}

// ========== 快递费用明细 ==========

export class ShippingCostItemDto {
    @ApiPropertyOptional({ description: '记录ID（更新时传）' })
    @IsOptional()
    @IsUUID()
    id?: string;

    @ApiProperty({ description: '快递公司ID' })
    @IsUUID()
    expressCompanyId: string;

    @ApiProperty({ description: '金额' })
    @IsNumber()
    amount: number;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;

    @ApiPropertyOptional({ description: '排序' })
    @IsOptional()
    @IsInt()
    sortOrder?: number;
}

export class SaveShippingCostsDto {
    @ApiProperty({ type: [ShippingCostItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ShippingCostItemDto)
    items: ShippingCostItemDto[];
}

// ========== 平台费用明细 ==========

export class StoreExpenseItemDto {
    @ApiPropertyOptional({ description: '记录ID（更新时传）' })
    @IsOptional()
    @IsUUID()
    id?: string;

    @ApiProperty({ description: '费用项名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({ description: '金额' })
    @IsNumber()
    amount: number;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;

    @ApiPropertyOptional({ description: '排序' })
    @IsOptional()
    @IsInt()
    sortOrder?: number;
}

export class SaveStoreExpensesDto {
    @ApiProperty({ type: [StoreExpenseItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StoreExpenseItemDto)
    items: StoreExpenseItemDto[];
}

// ========== 分摊类别 ==========

export class AllocationCategoryDto {
    @ApiPropertyOptional({ description: '类别ID（更新时传）' })
    @IsOptional()
    @IsUUID()
    id?: string;

    @ApiProperty({ description: '类别名称' })
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({ description: '排序' })
    @IsOptional()
    @IsInt()
    sortOrder?: number;
}

export class SaveAllocationCategoriesDto {
    @ApiProperty({ type: [AllocationCategoryDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AllocationCategoryDto)
    categories: AllocationCategoryDto[];
}

// ========== 分摊金额 ==========

export class AllocationItemDto {
    @ApiProperty({ description: '条目ID' })
    @IsUUID()
    entryId: string;

    @ApiProperty({ description: '分摊类别ID' })
    @IsUUID()
    categoryId: string;

    @ApiProperty({ description: '金额' })
    @IsNumber()
    amount: number;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class SaveAllocationsDto {
    @ApiProperty({ type: [AllocationItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AllocationItemDto)
    items: AllocationItemDto[];
}

// ========== 公司费用 ==========

export class CompanyExpenseItemDto {
    @ApiPropertyOptional({ description: '记录ID（更新时传）' })
    @IsOptional()
    @IsUUID()
    id?: string;

    @ApiProperty({ description: '费用项名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({ description: '金额' })
    @IsNumber()
    amount: number;

    @ApiPropertyOptional({ description: '是否可分摊' })
    @IsOptional()
    @IsBoolean()
    isAllocatable?: boolean;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;

    @ApiPropertyOptional({ description: '排序' })
    @IsOptional()
    @IsInt()
    sortOrder?: number;
}

export class SaveCompanyExpensesDto {
    @ApiProperty({ type: [CompanyExpenseItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CompanyExpenseItemDto)
    items: CompanyExpenseItemDto[];
}

// ========== 不计入费用 ==========

export class NonExpenseItemDto {
    @ApiPropertyOptional({ description: '记录ID（更新时传）' })
    @IsOptional()
    @IsUUID()
    id?: string;

    @ApiProperty({ description: '费用项名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({ description: '金额' })
    @IsNumber()
    amount: number;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;

    @ApiPropertyOptional({ description: '排序' })
    @IsOptional()
    @IsInt()
    sortOrder?: number;
}

export class SaveNonExpensesDto {
    @ApiProperty({ type: [NonExpenseItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => NonExpenseItemDto)
    items: NonExpenseItemDto[];
}

// ========== JSON 导入（AI Skill 专用） ==========

export class JsonImportShippingCostDto {
    @ApiProperty({ description: '快递公司ID' })
    @IsUUID()
    expressCompanyId: string;

    @ApiProperty({ description: '金额' })
    @IsNumber()
    amount: number;
}

export class JsonImportStoreExpenseDto {
    @ApiProperty({ description: '费用项名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({ description: '金额' })
    @IsNumber()
    amount: number;
}

export class JsonImportAllocationDto {
    @ApiProperty({ description: '分摊类别名称' })
    @IsString()
    @MaxLength(100)
    categoryName: string;

    @ApiProperty({ description: '金额' })
    @IsNumber()
    amount: number;
}

export class JsonImportEntryDto {
    @ApiProperty({ description: '店铺ID' })
    @IsUUID()
    shopId: string;

    @ApiProperty({ description: '销售额' })
    @IsNumber()
    salesAmount: number;

    @ApiProperty({ description: '原料成本' })
    @IsNumber()
    rawMaterialCost: number;

    @ApiProperty({ description: '包装成本' })
    @IsNumber()
    packagingCost: number;

    @ApiProperty({ description: '人工成本' })
    @IsNumber()
    laborCost: number;

    @ApiPropertyOptional({ description: '毛利（Excel公式结果）' })
    @IsOptional()
    @IsNumber()
    grossProfit?: number;

    @ApiPropertyOptional({ description: '净利润（Excel公式结果）' })
    @IsOptional()
    @IsNumber()
    netProfit?: number;

    @ApiPropertyOptional({ description: '快递费明细', type: [JsonImportShippingCostDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => JsonImportShippingCostDto)
    shippingCosts?: JsonImportShippingCostDto[];

    @ApiPropertyOptional({ description: '店铺费用明细', type: [JsonImportStoreExpenseDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => JsonImportStoreExpenseDto)
    storeExpenses?: JsonImportStoreExpenseDto[];

    @ApiPropertyOptional({ description: '分摊项', type: [JsonImportAllocationDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => JsonImportAllocationDto)
    allocations?: JsonImportAllocationDto[];
}

export class JsonImportCompanyExpenseDto {
    @ApiProperty({ description: '费用项名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({ description: '金额' })
    @IsNumber()
    amount: number;

    @ApiPropertyOptional({ description: '是否可分摊', default: true })
    @IsOptional()
    @IsBoolean()
    isAllocatable?: boolean;
}

export class JsonImportNonExpenseDto {
    @ApiProperty({ description: '费用项名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({ description: '金额' })
    @IsNumber()
    amount: number;
}

export class JsonImportProfitReportDto {
    @ApiProperty({ description: '年份' })
    @IsInt()
    @Min(2020)
    @Max(2100)
    year: number;

    @ApiProperty({ description: '月份 1-12' })
    @IsInt()
    @Min(1)
    @Max(12)
    month: number;

    @ApiProperty({ description: '店铺数据', type: [JsonImportEntryDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => JsonImportEntryDto)
    entries: JsonImportEntryDto[];

    @ApiPropertyOptional({ description: '分摊类别名称列表' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allocationCategories?: string[];

    @ApiPropertyOptional({ description: '公司费用', type: [JsonImportCompanyExpenseDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => JsonImportCompanyExpenseDto)
    companyExpenses?: JsonImportCompanyExpenseDto[];

    @ApiPropertyOptional({ description: '不计入费用', type: [JsonImportNonExpenseDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => JsonImportNonExpenseDto)
    nonExpenses?: JsonImportNonExpenseDto[];
}

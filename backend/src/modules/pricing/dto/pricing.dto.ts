import {
    IsString,
    IsUUID,
    IsNumber,
    IsArray,
    IsOptional,
    IsBoolean,
    Min,
    Max,
    MaxLength,
    ArrayMinSize,
    ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
    ApiProperty,
    ApiPropertyOptional,
} from '@nestjs/swagger';

// ==================== 实时计算 ====================

export class CalculatePricingDto {
    @ApiProperty({ description: '链接ID' })
    @IsUUID()
    linkId: string;

    @ApiProperty({
        description: '利润率列表',
        example: [0, 0.1, 0.2, 0.3, 0.5],
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsNumber({}, { each: true })
    profitRates: number[];

    @ApiProperty({
        description: '平台佣金率',
        example: 0.05,
    })
    @IsNumber()
    @Min(0)
    @Max(1)
    commissionRate: number;

    @ApiPropertyOptional({
        description: '税费率',
        example: 0,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    taxRate?: number;
}

// ==================== 佣金分析 ====================

class SkuSellingPrice {
    @ApiProperty({ description: 'SKU ID' })
    @IsUUID()
    skuId: string;

    @ApiProperty({ description: '暂定售价' })
    @IsNumber()
    @Min(0)
    price: number;
}

export class CommissionAnalysisDto {
    @ApiProperty({ description: '链接ID' })
    @IsUUID()
    linkId: string;

    @ApiProperty({
        description: 'SKU暂定售价列表',
        type: [SkuSellingPrice],
    })
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => SkuSellingPrice)
    sellingPrices: SkuSellingPrice[];
}

// ==================== 方案 CRUD ====================

export class SavePricingPlanDto {
    @ApiProperty({ description: '链接ID' })
    @IsUUID()
    linkId: string;

    @ApiProperty({ description: '方案名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({ description: '利润率列表' })
    @IsArray()
    @ArrayMinSize(1)
    @IsNumber({}, { each: true })
    profitRates: number[];

    @ApiProperty({ description: '平台佣金率' })
    @IsNumber()
    @Min(0)
    @Max(1)
    commissionRate: number;

    @ApiPropertyOptional({ description: '税费率' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    taxRate?: number;

    @ApiPropertyOptional({
        description: '选定售价（{ skuId: profitRate }）',
    })
    @IsOptional()
    selectedPrices?: Record<string, number>;

    @ApiPropertyOptional({
        description: '达人佣金率',
        example: 0.1,
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    talentCommissionRate?: number;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class UpdatePricingPlanDto {
    @ApiPropertyOptional({ description: '方案名称' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({
        description: '选定售价（{ skuId: profitRate }）',
    })
    @IsOptional()
    selectedPrices?: Record<string, number>;

    @ApiPropertyOptional({
        description: '达人佣金率',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    talentCommissionRate?: number;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class PricingPlanQueryDto {
    @ApiPropertyOptional({ description: '关键词' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '链接ID' })
    @IsOptional()
    @IsUUID()
    linkId?: string;

    @ApiPropertyOptional({ description: '页码' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ description: '每页条数' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    pageSize?: number;

    @ApiPropertyOptional({ description: '是否返回SKU摘要信息' })
    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    withSummary?: boolean;
}

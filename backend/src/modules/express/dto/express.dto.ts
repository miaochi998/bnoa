import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsEnum,
    IsUUID,
    MaxLength,
    IsBoolean,
    IsNumber,
    Min,
    IsArray,
    IsDecimal,
} from 'class-validator';

import { ExpressCompanyStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateExpressCompanyDto {
    @ApiProperty({ description: '快递公司名称' })
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiProperty({ description: '快递公司编码' })
    @IsString()
    @MaxLength(50)
    code: string;

    @ApiPropertyOptional({ description: '联系人' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    contactName?: string;

    @ApiPropertyOptional({ description: '联系电话' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    contactPhone?: string;

    @ApiPropertyOptional({ description: '状态', enum: ExpressCompanyStatus })
    @IsOptional()
    @IsEnum(ExpressCompanyStatus)
    status?: ExpressCompanyStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class UpdateExpressCompanyDto {
    @ApiPropertyOptional({ description: '快递公司名称' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ description: '快递公司编码' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    code?: string;

    @ApiPropertyOptional({ description: '联系人' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    contactName?: string;

    @ApiPropertyOptional({ description: '联系电话' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    contactPhone?: string;

    @ApiPropertyOptional({ description: '状态', enum: ExpressCompanyStatus })
    @IsOptional()
    @IsEnum(ExpressCompanyStatus)
    status?: ExpressCompanyStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class QueryExpressCompanyDto {
    @ApiPropertyOptional({ description: '搜索关键词（名称或编码）' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({
        description: '状态筛选',
        enum: ExpressCompanyStatus,
    })
    @IsOptional()
    @IsEnum(ExpressCompanyStatus)
    status?: ExpressCompanyStatus;

    @ApiPropertyOptional({ description: '页码', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({
        description: '每页条数',
        default: 20,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    pageSize?: number;
}

// ==================== 区域配置DTO ====================

/**
 * 更新区域省份配置DTO
 */
export class UpdateZoneDto {
    @ApiProperty({ description: '省份列表', type: [String] })
    @IsArray()
    @IsString({ each: true })
    provinces: string[];
}

/**
 * 批量更新区域配置DTO
 */
export class BatchUpdateZonesDto {
    @ApiProperty({ description: '区域配置列表', type: [Object] })
    @IsArray()
    zones: {
        id: string;
        provinces: string[];
    }[];
}

// ==================== 重量段配置DTO ====================

/**
 * 更新重量段DTO
 */
export class UpdateWeightRangeDto {
    @ApiPropertyOptional({ description: '显示标签' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    label?: string;

    @ApiPropertyOptional({ description: '最小重量(kg)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    minWeight?: number;

    @ApiPropertyOptional({ description: '最大重量(kg)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    maxWeight?: number;
}

// ==================== 价格矩阵DTO ====================

/**
 * 价格项DTO
 */
export class PriceItemDto {
    @ApiProperty({ description: '区域ID' })
    @IsUUID()
    zoneId: string;

    @ApiProperty({ description: '重量段ID' })
    @IsUUID()
    weightRangeId: string;

    @ApiProperty({ description: '价格（元/票）' })
    @IsNumber()
    @Min(0)
    price: number;
}

/**
 * 批量更新价格DTO
 */
export class BatchUpdatePricesDto {
    @ApiProperty({ description: '价格列表', type: [PriceItemDto] })
    @IsArray()
    prices: PriceItemDto[];
}

/**
 * 复制价格配置DTO
 */
export class CopyPricesDto {
    @ApiProperty({ description: '源快递公司ID' })
    @IsUUID()
    sourceCompanyId: string;
}

// ==================== 附加费DTO ====================

/**
 * 创建附加费DTO
 */
export class CreateSurchargeDto {
    @ApiProperty({ description: '附加费名称' })
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiProperty({ description: '适用省份列表', type: [String] })
    @IsArray()
    @IsString({ each: true })
    provinces: string[];

    @ApiPropertyOptional({ description: '起始重量(kg)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    weightFrom?: number;

    @ApiPropertyOptional({ description: '结束重量(kg)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    weightTo?: number;

    @ApiProperty({ description: '加收金额' })
    @IsNumber()
    @Min(0)
    amount: number;
}

/**
 * 更新附加费DTO
 */
export class UpdateSurchargeDto {
    @ApiPropertyOptional({ description: '附加费名称' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ description: '适用省份列表', type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    provinces?: string[];

    @ApiPropertyOptional({ description: '起始重量(kg)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    weightFrom?: number;

    @ApiPropertyOptional({ description: '结束重量(kg)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    weightTo?: number;

    @ApiPropertyOptional({ description: '加收金额' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    amount?: number;
}

// ==================== 快递成本计算DTO ====================

/**
 * 计算快递成本DTO
 */
export class CalculateExpressCostDto {
    @ApiProperty({ description: '快递公司ID' })
    @IsUUID()
    companyId: string;

    @ApiProperty({ description: '省份' })
    @IsString()
    province: string;

    @ApiProperty({ description: '重量(kg)' })
    @IsNumber()
    @Min(0)
    weight: number;
}

/**
 * 快递成本计算结果DTO
 */
export class ExpressCostResultDto {
    @ApiProperty({ description: '区域名称' })
    zone: string;

    @ApiProperty({ description: '重量段标签' })
    weightRange: string;

    @ApiProperty({ description: '基础价格' })
    basePrice: number;

    @ApiProperty({ description: '附加费列表', type: [Object] })
    surcharges: {
        name: string;
        amount: number;
    }[];

    @ApiProperty({ description: '附加费合计' })
    totalSurcharge: number;

    @ApiProperty({ description: '总价' })
    totalPrice: number;
}

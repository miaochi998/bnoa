import {
    IsString,
    IsOptional,
    IsEnum,
    IsNumber,
    IsDateString,
    MaxLength,
    Min,
    IsInt,
} from 'class-validator';
import {
    ApiProperty,
    ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    LaborBillingType,
    ConsumableStatus,
} from '@prisma/client';

// ==================== 工种 DTO ====================

export class QueryLaborTypeDto {
    @ApiPropertyOptional({ description: '搜索关键词' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '计费方式' })
    @IsOptional()
    @IsEnum(LaborBillingType)
    billingType?: LaborBillingType;

    @ApiPropertyOptional({ description: '状态' })
    @IsOptional()
    @IsEnum(ConsumableStatus)
    status?: ConsumableStatus;

    @ApiPropertyOptional({ description: '页码', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: '每页条数',
        default: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pageSize?: number = 10;
}

export class CreateLaborTypeDto {
    @ApiProperty({ description: '工种名称' })
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: '计费方式',
        enum: LaborBillingType,
    })
    @IsEnum(LaborBillingType)
    billingType: LaborBillingType;
}

export class UpdateLaborTypeDto {
    @ApiPropertyOptional({ description: '工种名称' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({
        description: '计费方式',
        enum: LaborBillingType,
    })
    @IsOptional()
    @IsEnum(LaborBillingType)
    billingType?: LaborBillingType;

    @ApiPropertyOptional({
        description: '状态',
        enum: ConsumableStatus,
    })
    @IsOptional()
    @IsEnum(ConsumableStatus)
    status?: ConsumableStatus;
}

// ==================== 工费标准 DTO ====================

export class CreateLaborRateDto {
    @ApiProperty({ description: '单价' })
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ description: '计费单位（件/kg/包/箱）' })
    @IsString()
    @MaxLength(20)
    unit: string;

    @ApiProperty({ description: '生效日期' })
    @IsDateString()
    effectDate: string;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    remark?: string;
}

export class UpdateLaborRateDto {
    @ApiPropertyOptional({ description: '单价' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    unitPrice?: number;

    @ApiPropertyOptional({ description: '计费单位（件/kg/包/箱）' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    unit?: string;

    @ApiPropertyOptional({ description: '生效日期' })
    @IsOptional()
    @IsDateString()
    effectDate?: string;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    remark?: string;
}

import {
    IsString,
    IsOptional,
    IsEnum,
    IsNumber,
    IsUUID,
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
    ConsumableCategory,
    ConsumableStatus,
    SupplierStatus,
} from '@prisma/client';

// ==================== 耗材 DTO ====================

export class QueryConsumableDto {
    @ApiPropertyOptional({ description: '搜索关键词' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '耗材分类' })
    @IsOptional()
    @IsEnum(ConsumableCategory)
    category?: ConsumableCategory;

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

    @ApiPropertyOptional({ description: '每页条数', default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pageSize?: number = 10;
}

export class CreateConsumableDto {
    @ApiProperty({ description: '耗材名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({
        description: '耗材分类',
        enum: ConsumableCategory,
    })
    @IsEnum(ConsumableCategory)
    category: ConsumableCategory;

    @ApiPropertyOptional({ description: '规格描述' })
    @IsOptional()
    @IsString()
    specDesc?: string;

    @ApiPropertyOptional({ description: '图片文件ID' })
    @IsOptional()
    @IsUUID()
    image?: string;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class UpdateConsumableDto {
    @ApiPropertyOptional({ description: '耗材名称' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({
        description: '耗材分类',
        enum: ConsumableCategory,
    })
    @IsOptional()
    @IsEnum(ConsumableCategory)
    category?: ConsumableCategory;

    @ApiPropertyOptional({ description: '规格描述' })
    @IsOptional()
    @IsString()
    specDesc?: string;

    @ApiPropertyOptional({ description: '图片文件ID' })
    @IsOptional()
    @IsString()
    image?: string;

    @ApiPropertyOptional({
        description: '状态',
        enum: ConsumableStatus,
    })
    @IsOptional()
    @IsEnum(ConsumableStatus)
    status?: ConsumableStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

// ==================== 耗材供应商 DTO ====================

export class QueryConsumableSupplierDto {
    @ApiPropertyOptional({ description: '搜索关键词' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '状态' })
    @IsOptional()
    @IsEnum(SupplierStatus)
    status?: SupplierStatus;

    @ApiPropertyOptional({ description: '页码', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: '每页条数', default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pageSize?: number = 10;
}

export class CreateConsumableSupplierDto {
    @ApiProperty({ description: '供应商名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiPropertyOptional({ description: '联系人' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    contact?: string;

    @ApiPropertyOptional({ description: '联系电话' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    phone?: string;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class UpdateConsumableSupplierDto {
    @ApiPropertyOptional({ description: '供应商名称' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({ description: '联系人' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    contact?: string;

    @ApiPropertyOptional({ description: '联系电话' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    phone?: string;

    @ApiPropertyOptional({
        description: '状态',
        enum: SupplierStatus,
    })
    @IsOptional()
    @IsEnum(SupplierStatus)
    status?: SupplierStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

// ==================== 耗材价格 DTO ====================

export class CreateConsumablePriceDto {
    @ApiProperty({ description: '耗材供应商ID' })
    @IsUUID()
    supplierId: string;

    @ApiProperty({ description: '单价' })
    @IsNumber()
    @Min(0)
    unitPrice: number;

    @ApiProperty({ description: '生效日期' })
    @IsDateString()
    effectDate: string;

    @ApiPropertyOptional({ description: '批次备注' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    batchNote?: string;
}

export class UpdateConsumablePriceDto {
    @ApiPropertyOptional({ description: '耗材供应商ID' })
    @IsOptional()
    @IsUUID()
    supplierId?: string;

    @ApiPropertyOptional({ description: '单价' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    unitPrice?: number;

    @ApiPropertyOptional({ description: '生效日期' })
    @IsOptional()
    @IsDateString()
    effectDate?: string;

    @ApiPropertyOptional({ description: '批次备注' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    batchNote?: string;
}

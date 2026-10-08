import {
    IsString,
    IsOptional,
    IsEnum,
    IsUUID,
    IsNumber,
    IsInt,
    IsObject,
    MaxLength,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierStatus, PriceUnit } from '@prisma/client';

export class CreateSupplierProductDto {
    @ApiProperty({ description: '供应商ID' })
    @IsUUID()
    supplierId: string;

    @ApiProperty({ description: '产品ID' })
    @IsUUID()
    productId: string;

    @ApiPropertyOptional({ description: '款式名称' })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    styleName?: string;

    @ApiPropertyOptional({ description: '款式参数（JSON）' })
    @IsObject()
    @IsOptional()
    styleParams?: Record<string, any>;

    @ApiProperty({ description: '供货价格' })
    @IsNumber()
    @Min(0)
    supplyPrice: number;

    @ApiPropertyOptional({
        description: '价格单位',
        enum: PriceUnit,
        default: PriceUnit.PER_PIECE,
    })
    @IsEnum(PriceUnit)
    @IsOptional()
    priceUnit?: PriceUnit;

    @ApiPropertyOptional({ description: '自定义单位名称' })
    @IsString()
    @MaxLength(50)
    @IsOptional()
    priceUnitCustom?: string;

    @ApiPropertyOptional({
        description: '状态',
        enum: SupplierStatus,
    })
    @IsEnum(SupplierStatus)
    @IsOptional()
    status?: SupplierStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsString()
    @IsOptional()
    remark?: string;
}

export class UpdateSupplierProductDto {
    @ApiPropertyOptional({ description: '款式名称' })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    styleName?: string;

    @ApiPropertyOptional({ description: '款式参数（JSON）' })
    @IsObject()
    @IsOptional()
    styleParams?: Record<string, any>;

    @ApiPropertyOptional({ description: '供货价格' })
    @IsNumber()
    @IsOptional()
    @Min(0)
    supplyPrice?: number;

    @ApiPropertyOptional({
        description: '价格单位',
        enum: PriceUnit,
    })
    @IsEnum(PriceUnit)
    @IsOptional()
    priceUnit?: PriceUnit;

    @ApiPropertyOptional({ description: '自定义单位名称' })
    @IsString()
    @MaxLength(50)
    @IsOptional()
    priceUnitCustom?: string;

    @ApiPropertyOptional({
        description: '状态',
        enum: SupplierStatus,
    })
    @IsEnum(SupplierStatus)
    @IsOptional()
    status?: SupplierStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsString()
    @IsOptional()
    remark?: string;
}

export class SupplierProductQueryDto {
    @ApiPropertyOptional({ description: '按供应商筛选' })
    @IsUUID()
    @IsOptional()
    supplierId?: string;

    @ApiPropertyOptional({ description: '按产品筛选' })
    @IsUUID()
    @IsOptional()
    productId?: string;

    @ApiPropertyOptional({
        description: '按状态筛选',
        enum: SupplierStatus,
    })
    @IsEnum(SupplierStatus)
    @IsOptional()
    status?: SupplierStatus;

    @ApiPropertyOptional({ description: '页码', default: 1 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number;

    @ApiPropertyOptional({
        description: '每页条数',
        default: 10,
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @IsOptional()
    pageSize?: number;
}

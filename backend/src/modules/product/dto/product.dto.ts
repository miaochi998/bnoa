import {
    IsString,
    IsOptional,
    IsEnum,
    IsUUID,
    IsNumber,
    MaxLength,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductStatus, PricingMode } from '@prisma/client';

export class CreateProductDto {
    @ApiProperty({ description: '产品名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiPropertyOptional({ description: '产品编码，不传则系统自动生成' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    code?: string;

    @ApiPropertyOptional({ description: '品牌' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    brand?: string;

    @ApiPropertyOptional({
        description: '计价方式',
        enum: PricingMode,
    })
    @IsOptional()
    @IsEnum(PricingMode)
    pricingMode?: PricingMode;

    @ApiPropertyOptional({ description: '状态', enum: ProductStatus })
    @IsOptional()
    @IsEnum(ProductStatus)
    status?: ProductStatus;

    @ApiPropertyOptional({ description: '主图文件ID' })
    @IsOptional()
    @IsUUID()
    mainImage?: string;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class UpdateProductDto {
    @ApiPropertyOptional({ description: '产品名称' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({ description: '品牌' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    brand?: string;

    @ApiPropertyOptional({
        description: '计价方式',
        enum: PricingMode,
    })
    @IsOptional()
    @IsEnum(PricingMode)
    pricingMode?: PricingMode;

    @ApiPropertyOptional({ description: '状态', enum: ProductStatus })
    @IsOptional()
    @IsEnum(ProductStatus)
    status?: ProductStatus;

    @ApiPropertyOptional({ description: '主图文件ID' })
    @IsOptional()
    @IsUUID()
    mainImage?: string;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class ProductQueryDto {
    @ApiPropertyOptional({ description: '搜索关键词（名称/编码）' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '状态', enum: ProductStatus })
    @IsOptional()
    @IsEnum(ProductStatus)
    status?: ProductStatus;

    @ApiPropertyOptional({ description: '品牌' })
    @IsOptional()
    @IsString()
    brand?: string;

    @ApiPropertyOptional({ description: '页码', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ description: '每页数量', default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    pageSize?: number;
}

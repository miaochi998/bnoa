import {
    IsString,
    IsOptional,
    IsEnum,
    IsUUID,
    IsInt,
    MaxLength,
    Min,
} from 'class-validator';
import {
    ApiProperty,
    ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ProductLinkStatus } from '@prisma/client';

// ==================== 查询 DTO ====================

export class QueryProductLinkDto {
    @ApiPropertyOptional({ description: '搜索关键词' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '店铺ID' })
    @IsOptional()
    @IsUUID()
    shopId?: string;

    @ApiPropertyOptional({ description: '状态' })
    @IsOptional()
    @IsEnum(ProductLinkStatus)
    status?: ProductLinkStatus;

    @ApiPropertyOptional({
        description: '页码', default: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: '每页条数', default: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pageSize?: number = 10;
}

// ==================== 创建 DTO ====================

export class CreateProductLinkDto {
    @ApiProperty({ description: '链接名称/商品标题' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({ description: '所属店铺ID' })
    @IsUUID()
    shopId: string;

    @ApiPropertyOptional({ description: '平台链接URL' })
    @IsOptional()
    @IsString()
    platformUrl?: string;

    @ApiPropertyOptional({
        description: '平台商品ID',
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    platformItemId?: string;

    @ApiPropertyOptional({
        description: '状态', enum: ProductLinkStatus,
    })
    @IsOptional()
    @IsEnum(ProductLinkStatus)
    status?: ProductLinkStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

// ==================== 更新 DTO ====================

export class UpdateProductLinkDto {
    @ApiPropertyOptional({
        description: '链接名称/商品标题',
    })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({ description: '所属店铺ID' })
    @IsOptional()
    @IsUUID()
    shopId?: string;

    @ApiPropertyOptional({ description: '平台链接URL' })
    @IsOptional()
    @IsString()
    platformUrl?: string;

    @ApiPropertyOptional({
        description: '平台商品ID',
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    platformItemId?: string;

    @ApiPropertyOptional({
        description: '状态', enum: ProductLinkStatus,
    })
    @IsOptional()
    @IsEnum(ProductLinkStatus)
    status?: ProductLinkStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

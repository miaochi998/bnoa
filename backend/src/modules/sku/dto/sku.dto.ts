import {
    IsString,
    IsOptional,
    IsEnum,
    IsUUID,
    IsNumber,
    IsArray,
    IsInt,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
    ApiProperty,
    ApiPropertyOptional,
} from '@nestjs/swagger';
import { SkuStatus, SkuType } from '@prisma/client';

export class FinishedProductItemDto {
    @ApiProperty({ description: '成品ID' })
    @IsUUID()
    finishedProductId: string;

    @ApiProperty({ description: '数量' })
    @IsInt()
    @Min(1)
    quantity: number;
}

export class CreateSkuDto {
    @ApiProperty({ description: '所属链接ID' })
    @IsUUID()
    linkId: string;

    @ApiProperty({
        description: 'SKU类型',
        enum: SkuType,
    })
    @IsEnum(SkuType)
    type: SkuType;

    @ApiProperty({ description: 'SKU名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({ description: '重量(kg)' })
    @IsNumber()
    @Min(0)
    weight: number;

    @ApiPropertyOptional({ description: '综合费用' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    miscFee?: number;

    @ApiPropertyOptional({ description: '组合包装费' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    comboPackageFee?: number;

    @ApiPropertyOptional({ description: '默认快递公司ID' })
    @IsOptional()
    @IsUUID()
    defaultExpressCompanyId?: string;

    @ApiProperty({
        description: '成品列表',
        type: [FinishedProductItemDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FinishedProductItemDto)
    finishedProductItems: FinishedProductItemDto[];

    @ApiPropertyOptional({
        description: '状态',
        enum: SkuStatus,
    })
    @IsOptional()
    @IsEnum(SkuStatus)
    status?: SkuStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class UpdateSkuDto {
    @ApiPropertyOptional({
        description: 'SKU类型',
        enum: SkuType,
    })
    @IsOptional()
    @IsEnum(SkuType)
    type?: SkuType;

    @ApiPropertyOptional({ description: 'SKU名称' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({ description: '重量(kg)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    weight?: number;

    @ApiPropertyOptional({ description: '综合费用' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    miscFee?: number;

    @ApiPropertyOptional({ description: '组合包装费' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    comboPackageFee?: number;

    @ApiPropertyOptional({ description: '默认快递公司ID' })
    @IsOptional()
    @IsUUID()
    defaultExpressCompanyId?: string;

    @ApiPropertyOptional({
        description: '成品列表（传则全量替换）',
        type: [FinishedProductItemDto],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FinishedProductItemDto)
    finishedProductItems?: FinishedProductItemDto[];

    @ApiPropertyOptional({
        description: '状态',
        enum: SkuStatus,
    })
    @IsOptional()
    @IsEnum(SkuStatus)
    status?: SkuStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class SkuQueryDto {
    @ApiPropertyOptional({ description: '搜索关键词' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '链接ID' })
    @IsOptional()
    @IsUUID()
    linkId?: string;

    @ApiPropertyOptional({
        description: '状态',
        enum: SkuStatus,
    })
    @IsOptional()
    @IsEnum(SkuStatus)
    status?: SkuStatus;

    @ApiPropertyOptional({
        description: '页码',
        default: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({
        description: '每页数量',
        default: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    pageSize?: number;
}

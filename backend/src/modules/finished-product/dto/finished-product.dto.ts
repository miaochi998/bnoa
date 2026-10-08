import {
    IsString,
    IsOptional,
    IsEnum,
    IsNumber,
    IsUUID,
    IsArray,
    IsInt,
    MaxLength,
    Min,
    ValidateNested,
} from 'class-validator';
import {
    ApiProperty,
    ApiPropertyOptional,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    FinishedProductStatus,
    PackageType,
} from '@prisma/client';

// ==================== 子项 DTO ====================

export class ConsumableItemDto {
    @ApiProperty({ description: '耗材ID' })
    @IsUUID()
    consumableId: string;

    @ApiProperty({ description: '用量' })
    @IsInt()
    @Min(1)
    quantity: number;
}

export class LaborItemDto {
    @ApiProperty({ description: '工种ID' })
    @IsUUID()
    laborTypeId: string;
}

// ==================== 查询 DTO ====================

export class QueryFinishedProductDto {
    @ApiPropertyOptional({ description: '搜索关键词' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '状态' })
    @IsOptional()
    @IsEnum(FinishedProductStatus)
    status?: FinishedProductStatus;

    @ApiPropertyOptional({ description: '页码', default: 1 })
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

export class CreateFinishedProductDto {
    @ApiProperty({ description: '成品名称' })
    @IsString()
    @MaxLength(200)
    name: string;

    @ApiProperty({ description: '产品ID' })
    @IsUUID()
    productId: string;

    @ApiProperty({ description: '供应商价格ID' })
    @IsUUID()
    supplierProductId: string;

    @ApiPropertyOptional({ description: '切割长度(cm)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cutLength?: number;

    @ApiPropertyOptional({ description: '切割宽度(cm)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cutWidth?: number;

    @ApiPropertyOptional({ description: '切割高度(cm)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cutHeight?: number;

    @ApiPropertyOptional({
        description: '每份重量(克)，按重量计价时必填',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    unitWeight?: number;

    @ApiProperty({
        description: '包装类型', enum: PackageType,
    })
    @IsEnum(PackageType)
    packageType: PackageType;

    @ApiProperty({ description: '每包数量' })
    @IsInt()
    @Min(1)
    packageQuantity: number;

    @ApiProperty({ description: '包装单位' })
    @IsString()
    @MaxLength(20)
    packageUnit: string;

    @ApiProperty({ description: '成品重量(kg)' })
    @IsNumber()
    @Min(0)
    weight: number;

    @ApiPropertyOptional({ description: '状态' })
    @IsOptional()
    @IsEnum(FinishedProductStatus)
    status?: FinishedProductStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;

    @ApiPropertyOptional({ description: '耗材清单' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ConsumableItemDto)
    consumableItems?: ConsumableItemDto[];

    @ApiPropertyOptional({ description: '工费清单' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LaborItemDto)
    laborItems?: LaborItemDto[];
}

// ==================== 更新 DTO ====================

export class UpdateFinishedProductDto {
    @ApiPropertyOptional({ description: '成品名称' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @ApiPropertyOptional({ description: '供应商价格ID' })
    @IsOptional()
    @IsUUID()
    supplierProductId?: string;

    @ApiPropertyOptional({ description: '切割长度(cm)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cutLength?: number;

    @ApiPropertyOptional({ description: '切割宽度(cm)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cutWidth?: number;

    @ApiPropertyOptional({ description: '切割高度(cm)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    cutHeight?: number;

    @ApiPropertyOptional({
        description: '每份重量(克)，按重量计价时必填',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    unitWeight?: number;

    @ApiPropertyOptional({
        description: '包装类型', enum: PackageType,
    })
    @IsOptional()
    @IsEnum(PackageType)
    packageType?: PackageType;

    @ApiPropertyOptional({ description: '每包数量' })
    @IsOptional()
    @IsInt()
    @Min(1)
    packageQuantity?: number;

    @ApiPropertyOptional({ description: '包装单位' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    packageUnit?: string;

    @ApiPropertyOptional({ description: '成品重量(kg)' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    weight?: number;

    @ApiPropertyOptional({ description: '状态' })
    @IsOptional()
    @IsEnum(FinishedProductStatus)
    status?: FinishedProductStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;

    @ApiPropertyOptional({ description: '耗材清单' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ConsumableItemDto)
    consumableItems?: ConsumableItemDto[];

    @ApiPropertyOptional({ description: '工费清单' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LaborItemDto)
    laborItems?: LaborItemDto[];
}

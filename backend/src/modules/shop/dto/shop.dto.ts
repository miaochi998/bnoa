import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsEnum,
    IsUUID,
    IsInt,
    Min,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ShopStatus } from '@prisma/client';

export class CreateShopDto {
    @ApiProperty({ description: '店铺名称' })
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiProperty({ description: '所属平台ID' })
    @IsUUID()
    platformId: string;

    @ApiPropertyOptional({ description: '店铺状态', enum: ShopStatus })
    @IsOptional()
    @IsEnum(ShopStatus)
    status?: ShopStatus;

    @ApiProperty({ description: '负责人ID' })
    @IsUUID()
    managerId: string;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class UpdateShopDto {
    @ApiPropertyOptional({ description: '店铺名称' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiPropertyOptional({ description: '所属平台ID' })
    @IsOptional()
    @IsUUID()
    platformId?: string;

    @ApiPropertyOptional({ description: '店铺状态', enum: ShopStatus })
    @IsOptional()
    @IsEnum(ShopStatus)
    status?: ShopStatus;

    @ApiPropertyOptional({ description: '负责人ID' })
    @IsOptional()
    @IsUUID()
    managerId?: string;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class QueryShopDto {
    @ApiPropertyOptional({ description: '搜索关键词（店铺名称）' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '平台ID筛选' })
    @IsOptional()
    @IsUUID()
    platformId?: string;

    @ApiPropertyOptional({ description: '负责人ID筛选' })
    @IsOptional()
    @IsUUID()
    managerId?: string;

    @ApiPropertyOptional({ description: '店铺状态', enum: ShopStatus })
    @IsOptional()
    @IsEnum(ShopStatus)
    status?: ShopStatus;

    @ApiPropertyOptional({ description: '页码', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({
        description: '每页条数',
        default: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    pageSize?: number;
}

import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    Min,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlatformType, PlatformStatus } from '@prisma/client';

export class CreatePlatformDto {
    @ApiProperty({ description: '平台名称' })
    @IsString()
    @MaxLength(50)
    name: string;

    @ApiProperty({ description: '平台编码' })
    @IsString()
    @MaxLength(50)
    code: string;

    @ApiPropertyOptional({ description: '平台类型', enum: PlatformType })
    @IsOptional()
    @IsEnum(PlatformType)
    type?: PlatformType;

    @ApiPropertyOptional({ description: '平台Logo' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    logo?: string;

    @ApiPropertyOptional({ description: '平台官网' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    website?: string;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class UpdatePlatformDto {
    @ApiPropertyOptional({ description: '平台名称' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    name?: string;

    @ApiPropertyOptional({ description: '平台编码' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    code?: string;

    @ApiPropertyOptional({ description: '平台类型', enum: PlatformType })
    @IsOptional()
    @IsEnum(PlatformType)
    type?: PlatformType;

    @ApiPropertyOptional({ description: '平台Logo' })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    logo?: string;

    @ApiPropertyOptional({ description: '平台官网' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    website?: string;

    @ApiPropertyOptional({ description: '状态', enum: PlatformStatus })
    @IsOptional()
    @IsEnum(PlatformStatus)
    status?: PlatformStatus;

    @ApiPropertyOptional({ description: '备注' })
    @IsOptional()
    @IsString()
    remark?: string;
}

export class QueryPlatformDto {
    @ApiPropertyOptional({ description: '搜索关键词（名称/编码）' })
    @IsOptional()
    @IsString()
    keyword?: string;

    @ApiPropertyOptional({ description: '平台类型', enum: PlatformType })
    @IsOptional()
    @IsEnum(PlatformType)
    type?: PlatformType;

    @ApiPropertyOptional({ description: '状态', enum: PlatformStatus })
    @IsOptional()
    @IsEnum(PlatformStatus)
    status?: PlatformStatus;

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

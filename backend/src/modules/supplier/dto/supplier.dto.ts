import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierStatus } from '@prisma/client';

export class CreateSupplierDto {
    @ApiProperty({ description: '供应商名称' })
    @IsString()
    name: string;

    @ApiPropertyOptional({ description: '联系人' })
    @IsString()
    @IsOptional()
    contact?: string;

    @ApiPropertyOptional({ description: '联系电话' })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({ description: '地址' })
    @IsString()
    @IsOptional()
    address?: string;

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

export class UpdateSupplierDto {
    @ApiPropertyOptional({ description: '供应商名称' })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ description: '联系人' })
    @IsString()
    @IsOptional()
    contact?: string;

    @ApiPropertyOptional({ description: '联系电话' })
    @IsString()
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({ description: '地址' })
    @IsString()
    @IsOptional()
    address?: string;

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

export class SupplierQueryDto {
    @ApiPropertyOptional({ description: '关键词搜索' })
    @IsString()
    @IsOptional()
    keyword?: string;

    @ApiPropertyOptional({
        description: '状态筛选',
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

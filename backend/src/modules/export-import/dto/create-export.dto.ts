import {
    IsString,
    IsOptional,
    IsObject,
    IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExportDto {
    @ApiProperty({ description: '模块名称' })
    @IsString()
    module: string;

    @ApiProperty({ description: '导出格式' })
    @IsString()
    @IsIn(['xlsx', 'csv', 'json'])
    format: string;

    @ApiPropertyOptional({ description: '筛选参数' })
    @IsOptional()
    @IsObject()
    params?: Record<string, any>;
}

export class QueryTaskDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    module?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    type?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional()
    @IsOptional()
    page?: number;

    @ApiPropertyOptional()
    @IsOptional()
    pageSize?: number;
}

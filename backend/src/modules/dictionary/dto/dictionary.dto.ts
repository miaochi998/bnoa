import {
    IsString,
    IsOptional,
    IsBoolean,
    IsInt,
    Min,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDictionaryDto {
    @ApiProperty({ description: '字典类型编码' })
    @IsString()
    @MaxLength(50)
    typeCode: string;

    @ApiProperty({ description: '字典类型名称' })
    @IsString()
    @MaxLength(100)
    typeName: string;

    @ApiProperty({ description: '条目编码' })
    @IsString()
    @MaxLength(50)
    itemCode: string;

    @ApiProperty({ description: '条目名称' })
    @IsString()
    @MaxLength(100)
    itemName: string;

    @ApiProperty({ description: '条目值' })
    @IsString()
    @MaxLength(255)
    itemValue: string;

    @ApiPropertyOptional({ description: '排序' })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    sortOrder?: number;

    @ApiPropertyOptional({ description: '是否默认' })
    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;

    @ApiPropertyOptional({ description: '描述' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;

    @ApiPropertyOptional({ description: '颜色' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    color?: string;

    @ApiPropertyOptional({ description: '图标' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    icon?: string;
}

export class UpdateDictionaryDto {
    @ApiPropertyOptional({ description: '条目名称' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    itemName?: string;

    @ApiPropertyOptional({ description: '条目值' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    itemValue?: string;

    @ApiPropertyOptional({ description: '排序' })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    sortOrder?: number;

    @ApiPropertyOptional({ description: '是否默认' })
    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;

    @ApiPropertyOptional({ description: '是否启用' })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ description: '描述' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;

    @ApiPropertyOptional({ description: '颜色' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    color?: string;

    @ApiPropertyOptional({ description: '图标' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    icon?: string;
}

export class QueryDictionaryDto {
    @ApiPropertyOptional({ description: '字典类型编码' })
    @IsOptional()
    @IsString()
    typeCode?: string;

    @ApiPropertyOptional({ description: '批量类型编码(逗号分隔)' })
    @IsOptional()
    @IsString()
    typeCodes?: string;
}

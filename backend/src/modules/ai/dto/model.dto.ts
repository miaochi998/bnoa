import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsInt,
    IsObject,
    Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModelDto {
    @ApiProperty({ description: '模型唯一标识' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: '显示名称' })
    @IsString()
    @IsNotEmpty()
    displayName: string;

    @ApiProperty({ description: '服务提供商' })
    @IsString()
    @IsNotEmpty()
    provider: string;

    @ApiProperty({ description: '模型ID' })
    @IsString()
    @IsNotEmpty()
    modelId: string;

    @ApiPropertyOptional({ description: 'API端点' })
    @IsOptional()
    @IsString()
    apiEndpoint?: string;

    @ApiPropertyOptional({ description: '描述' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: '是否启用', default: true })
    @IsOptional()
    @IsBoolean()
    isEnabled?: boolean;

    @ApiPropertyOptional({ description: '是否默认', default: false })
    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;

    @ApiPropertyOptional({ description: '是否免费', default: false })
    @IsOptional()
    @IsBoolean()
    isFree?: boolean;

    @ApiPropertyOptional({ description: '排序', default: 0 })
    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;

    @ApiPropertyOptional({ description: 'JSON配置（含apiKey等）' })
    @IsOptional()
    @IsObject()
    config?: Record<string, any>;
}

export class UpdateModelDto {
    @ApiPropertyOptional({ description: '显示名称' })
    @IsOptional()
    @IsString()
    displayName?: string;

    @ApiPropertyOptional({ description: '服务提供商' })
    @IsOptional()
    @IsString()
    provider?: string;

    @ApiPropertyOptional({ description: '模型ID' })
    @IsOptional()
    @IsString()
    modelId?: string;

    @ApiPropertyOptional({ description: 'API端点' })
    @IsOptional()
    @IsString()
    apiEndpoint?: string;

    @ApiPropertyOptional({ description: '描述' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: '是否启用' })
    @IsOptional()
    @IsBoolean()
    isEnabled?: boolean;

    @ApiPropertyOptional({ description: '是否默认' })
    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;

    @ApiPropertyOptional({ description: '是否免费' })
    @IsOptional()
    @IsBoolean()
    isFree?: boolean;

    @ApiPropertyOptional({ description: '排序' })
    @IsOptional()
    @IsInt()
    @Min(0)
    sortOrder?: number;

    @ApiPropertyOptional({ description: 'JSON配置（含apiKey等）' })
    @IsOptional()
    @IsObject()
    config?: Record<string, any>;
}

export class ToggleModelDto {
    @ApiProperty({ description: '是否启用' })
    @IsBoolean()
    isEnabled: boolean;
}

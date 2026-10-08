import {
    IsArray, IsString, IsOptional,
    IsBoolean, ValidateNested, IsEnum,
    IsNumber, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BatchIdsDto {
    @ApiProperty({ description: 'ID列表', type: [String] })
    @IsArray()
    @IsString({ each: true })
    ids: string[];
}

export class MarkAllReadDto {
    @ApiPropertyOptional({ description: '通知类型' })
    @IsOptional()
    @IsString()
    type?: string;
}

class SettingItem {
    @ApiProperty({ description: '通知类型' })
    @IsString()
    type: string;

    @ApiProperty({ description: '是否启用' })
    @IsBoolean()
    enabled: boolean;
}

export class UpdateSettingsDto {
    @ApiProperty({
        description: '设置列表',
        type: [SettingItem],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SettingItem)
    settings: SettingItem[];
}

export class MaintenanceDto {
    @ApiProperty({
        description: '操作类型',
        enum: ['cleanup_expired', 'reset_unread'],
    })
    @IsEnum(['cleanup_expired', 'reset_unread'])
    operation: 'cleanup_expired' | 'reset_unread';

    @ApiPropertyOptional({ description: '操作参数' })
    @IsOptional()
    params?: { days?: number };
}

export class UpdateConfigDto {
    @ApiPropertyOptional({ description: '通知保留天数' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(365)
    retentionDays?: number;

    @ApiPropertyOptional({ description: '每页显示数量' })
    @IsOptional()
    @IsNumber()
    @Min(5)
    @Max(100)
    pageSize?: number;

    @ApiPropertyOptional({ description: '邮件联动开关' })
    @IsOptional()
    @IsBoolean()
    emailEnabled?: boolean;

    @ApiPropertyOptional({
        description: '通知类型配置',
        type: [SettingItem],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SettingItem)
    typeConfigs?: SettingItem[];
}

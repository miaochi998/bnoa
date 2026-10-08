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
import {
    TalentStatus,
    TalentLevel,
    TalentFlagColor,
} from '@prisma/client';

export class CreateTalentDto {
    @ApiProperty({ description: '达人名称' })
    @IsString()
    @MaxLength(100)
    name: string;

    @ApiPropertyOptional({ description: '微信号' })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    wechat?: string;

    @ApiPropertyOptional({ description: '手机号' })
    @IsString()
    @MaxLength(50)
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({
        description: '状态',
        enum: TalentStatus,
    })
    @IsEnum(TalentStatus)
    @IsOptional()
    status?: TalentStatus;

    @ApiPropertyOptional({
        description: '等级',
        enum: TalentLevel,
    })
    @IsEnum(TalentLevel)
    @IsOptional()
    level?: TalentLevel;

    @ApiPropertyOptional({ description: '备注' })
    @IsString()
    @IsOptional()
    remark?: string;
}

export class UpdateTalentDto {
    @ApiPropertyOptional({ description: '达人名称' })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    name?: string;

    @ApiPropertyOptional({ description: '微信号' })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    wechat?: string;

    @ApiPropertyOptional({ description: '手机号' })
    @IsString()
    @MaxLength(50)
    @IsOptional()
    phone?: string;

    @ApiPropertyOptional({
        description: '状态',
        enum: TalentStatus,
    })
    @IsEnum(TalentStatus)
    @IsOptional()
    status?: TalentStatus;

    @ApiPropertyOptional({
        description: '等级',
        enum: TalentLevel,
    })
    @IsEnum(TalentLevel)
    @IsOptional()
    level?: TalentLevel;

    @ApiPropertyOptional({ description: '备注' })
    @IsString()
    @IsOptional()
    remark?: string;
}

export class TalentQueryDto {
    @ApiPropertyOptional({
        description: '关键词搜索（名称/微信/手机）',
    })
    @IsString()
    @IsOptional()
    keyword?: string;

    @ApiPropertyOptional({
        description: '状态筛选',
        enum: TalentStatus,
    })
    @IsEnum(TalentStatus)
    @IsOptional()
    status?: TalentStatus;

    @ApiPropertyOptional({
        description: '等级筛选',
        enum: TalentLevel,
    })
    @IsEnum(TalentLevel)
    @IsOptional()
    level?: TalentLevel;

    @ApiPropertyOptional({
        description: '标旗颜色筛选（个人标旗）',
        enum: TalentFlagColor,
    })
    @IsEnum(TalentFlagColor)
    @IsOptional()
    flagColor?: TalentFlagColor;

    @ApiPropertyOptional({
        description: '负责人ID（管理员筛选）',
    })
    @IsString()
    @IsOptional()
    managerId?: string;

    @ApiPropertyOptional({ description: '平台筛选' })
    @IsString()
    @IsOptional()
    platform?: string;

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

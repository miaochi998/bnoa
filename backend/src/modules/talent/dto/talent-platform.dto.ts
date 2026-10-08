import {
    IsString,
    IsOptional,
    IsArray,
    MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTalentPlatformDto {
    @ApiProperty({ description: '平台名称' })
    @IsString()
    @MaxLength(50)
    platform: string;

    @ApiPropertyOptional({ description: '平台昵称' })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    nickname?: string;

    @ApiPropertyOptional({ description: '平台账号ID/UID' })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    accountId?: string;

    @ApiPropertyOptional({ description: '主页链接' })
    @IsString()
    @IsOptional()
    homeUrl?: string;

    @ApiPropertyOptional({
        description: '经营类目',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    categories?: string[];

    @ApiPropertyOptional({
        description: '内容形式',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    contentForms?: string[];
}

export class UpdateTalentPlatformDto {
    @ApiPropertyOptional({ description: '平台名称' })
    @IsString()
    @MaxLength(50)
    @IsOptional()
    platform?: string;

    @ApiPropertyOptional({ description: '平台昵称' })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    nickname?: string;

    @ApiPropertyOptional({ description: '平台账号ID/UID' })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    accountId?: string;

    @ApiPropertyOptional({ description: '主页链接' })
    @IsString()
    @IsOptional()
    homeUrl?: string;

    @ApiPropertyOptional({
        description: '经营类目',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    categories?: string[];

    @ApiPropertyOptional({
        description: '内容形式',
        type: [String],
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    contentForms?: string[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEmail,
    IsNumber,
    IsEnum,
    IsBoolean,
    Min,
    Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryEmailLogDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    pageSize?: number = 20;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    status?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    category?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    to?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    startDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    endDate?: string;
}

export class SendTestEmailDto {
    @ApiProperty({ description: '收件人邮箱' })
    @IsEmail({}, { message: '请输入有效的邮箱地址' })
    @IsNotEmpty({ message: '收件人邮箱不能为空' })
    to: string;
}

export class UpdateEmailConfigDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    senderEmail?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    senderName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    smtpHost?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    smtpPort?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    smtpUser?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    smtpPass?: string;

    @ApiPropertyOptional({ enum: ['none', 'ssl', 'tls'] })
    @IsOptional()
    @IsEnum(['none', 'ssl', 'tls'])
    encryption?: 'none' | 'ssl' | 'tls';

    @ApiPropertyOptional({
        enum: ['qq', 'netease163', 'gmail', 'custom'],
    })
    @IsOptional()
    @IsString()
    provider?: string;

    @ApiPropertyOptional({ description: '通知开关' })
    @IsOptional()
    notifications?: Record<string, boolean>;
}

export class UpdateTemplateDto {
    @ApiProperty({ description: '邮件标题' })
    @IsString()
    @IsNotEmpty({ message: '邮件标题不能为空' })
    subject: string;

    @ApiProperty({ description: '邮件正文 HTML' })
    @IsString()
    @IsNotEmpty({ message: '邮件内容不能为空' })
    content: string;
}

export class TestTemplateDto {
    @ApiProperty({ description: '收件人邮箱' })
    @IsEmail({}, { message: '请输入有效的邮箱地址' })
    @IsNotEmpty({ message: '收件人邮箱不能为空' })
    to: string;
}

export class CleanupLogsDto {
    @ApiProperty({ description: '清理天数（30/60/90）' })
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    beforeDays: number;
}

export class SendResetCodeDto {
    @ApiProperty({ description: '邮箱地址' })
    @IsEmail({}, { message: '请输入有效的邮箱地址' })
    @IsNotEmpty({ message: '邮箱不能为空' })
    email: string;
}

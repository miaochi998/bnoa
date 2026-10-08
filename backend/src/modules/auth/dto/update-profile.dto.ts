import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsString,
    IsOptional,
    MinLength,
    MaxLength,
    Matches,
    ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
    @ApiProperty({ description: '显示名称', required: false })
    @IsOptional()
    @IsString()
    @MinLength(2, { message: '姓名至少2个字符' })
    @MaxLength(50, { message: '姓名最多50个字符' })
    name?: string;

    @ApiProperty({ description: '邮箱', required: false })
    @IsOptional()
    @IsEmail({}, { message: '邮箱格式不正确' })
    email?: string;

    @ApiProperty({ description: '手机号', required: false })
    @IsOptional()
    @IsString()
    @ValidateIf((o) => o.phone !== '')
    @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
    phone?: string;

    @ApiProperty({ description: '个人简介', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(200, { message: '个人简介最多200个字符' })
    description?: string;
}

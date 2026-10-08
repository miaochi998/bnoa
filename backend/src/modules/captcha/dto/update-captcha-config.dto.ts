import { ApiProperty } from '@nestjs/swagger';
import {
    IsOptional,
    IsBoolean,
    IsString,
    IsInt,
    Min,
    Max,
} from 'class-validator';

export class UpdateCaptchaConfigDto {
    @ApiProperty({ description: '验证码全局开关', required: false })
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @ApiProperty({ description: '验证码类型', required: false })
    @IsOptional()
    @IsString()
    type?: string;

    @ApiProperty({ description: '过期时间(秒)', required: false })
    @IsOptional()
    @IsInt()
    @Min(60)
    @Max(600)
    expireTime?: number;

    @ApiProperty({ description: '验证容差(像素)', required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(20)
    tolerance?: number;

    @ApiProperty({ description: '最大尝试次数', required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10)
    maxAttempts?: number;

    @ApiProperty({ description: '启用轨迹验证', required: false })
    @IsOptional()
    @IsBoolean()
    enableTrailVerify?: boolean;

    @ApiProperty({ description: '背景图文件夹ID', required: false })
    @IsOptional()
    @IsString()
    backgroundFolderId?: string;

    @ApiProperty({ description: '登录需要验证码', required: false })
    @IsOptional()
    @IsBoolean()
    loginRequired?: boolean;

    @ApiProperty({ description: '注册需要验证码', required: false })
    @IsOptional()
    @IsBoolean()
    registerRequired?: boolean;

    @ApiProperty({ description: '重置密码需要验证码', required: false })
    @IsOptional()
    @IsBoolean()
    resetPasswordRequired?: boolean;

    @ApiProperty({ description: '背景图最大数量', required: false })
    @IsOptional()
    @IsInt()
    @Min(10)
    @Max(500)
    maxBackgrounds?: number;

    @ApiProperty({ description: '背景图最小数量', required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    minBackgrounds?: number;

    @ApiProperty({ description: '背景图存储方式 rustfs|local', required: false })
    @IsOptional()
    @IsString()
    storageMode?: string;
}

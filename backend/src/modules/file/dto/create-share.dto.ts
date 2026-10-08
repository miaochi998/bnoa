import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 分享访问权限
 */
export enum ShareAccess {
  VIEW = 'VIEW', // 仅查看
  DOWNLOAD = 'DOWNLOAD', // 可下载
}

/**
 * 创建分享 DTO
 */
export class CreateShareDto {
  @ApiProperty({
    description: '文件ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty({ message: '文件ID不能为空' })
  fileId: string;

  @ApiProperty({
    description: '访问权限',
    enum: ShareAccess,
    example: ShareAccess.VIEW,
    required: false,
  })
  @IsEnum(ShareAccess)
  @IsOptional()
  access?: ShareAccess = ShareAccess.DOWNLOAD;

  @ApiProperty({
    description: '密码（为空表示无密码）',
    example: '123456',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({
    description: '过期天数（0表示永不过期）',
    example: 7,
    required: false,
  })
  @IsInt()
  @Min(0)
  @Max(365)
  @IsOptional()
  expireDays?: number = 7;
}

/**
 * 访问分享 DTO
 */
export class AccessShareDto {
  @ApiProperty({
    description: '访问密码',
    example: '123456',
    required: false,
  })
  @IsString()
  @IsOptional()
  password?: string;
}


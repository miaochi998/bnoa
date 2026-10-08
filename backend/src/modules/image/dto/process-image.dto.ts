import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsBoolean,
} from 'class-validator';

/**
 * 图片格式
 */
export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
  AVIF = 'avif',
  GIF = 'gif',
}

/**
 * 缩略图尺寸
 */
export enum ThumbnailSize {
  SMALL = 'small', // 150x150
  MEDIUM = 'medium', // 300x300
  LARGE = 'large', // 600x600
}

/**
 * 处理图片 DTO
 */
export class ProcessImageDto {
  @ApiProperty({
    description: '目标格式',
    enum: ImageFormat,
    example: ImageFormat.WEBP,
    required: false,
  })
  @IsEnum(ImageFormat)
  @IsOptional()
  format?: ImageFormat;

  @ApiProperty({
    description: '宽度（像素）',
    example: 800,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  width?: number;

  @ApiProperty({
    description: '高度（像素）',
    example: 600,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  height?: number;

  @ApiProperty({
    description: '质量（1-100）',
    example: 80,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  quality?: number = 80;

  @ApiProperty({
    description: '是否保持宽高比',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  fit?: boolean = true;
}

/**
 * 生成缩略图 DTO
 */
export class GenerateThumbnailDto {
  @ApiProperty({
    description: '缩略图尺寸',
    enum: ThumbnailSize,
    example: ThumbnailSize.MEDIUM,
    required: false,
  })
  @IsEnum(ThumbnailSize)
  @IsOptional()
  size?: ThumbnailSize = ThumbnailSize.MEDIUM;

  @ApiProperty({
    description: '质量（1-100）',
    example: 80,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  quality?: number = 80;
}

/**
 * 压缩图片 DTO
 */
export class CompressImageDto {
  @ApiProperty({
    description: '质量（1-100）',
    example: 70,
  })
  @IsInt()
  @Min(1)
  @Max(100)
  quality: number = 70;

  @ApiProperty({
    description: '最大宽度（像素）',
    example: 1920,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  maxWidth?: number;

  @ApiProperty({
    description: '最大高度（像素）',
    example: 1080,
    required: false,
  })
  @IsInt()
  @Min(1)
  @Max(10000)
  @IsOptional()
  maxHeight?: number;

  @ApiProperty({
    description: '是否将PNG/GIF等格式转换为WebP以获得更好的压缩效果',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  convertToWebP?: boolean = true;
}

/**
 * 图片信息
 */
export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  size: number;
  colorSpace: string;
  hasAlpha: boolean;
}

/**
 * 处理结果
 */
export interface ProcessResult {
  buffer: Buffer;
  format: ImageFormat;
  width: number;
  height: number;
  size: number;
}

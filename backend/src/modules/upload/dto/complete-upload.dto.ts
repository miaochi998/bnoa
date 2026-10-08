import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * 完成上传 DTO
 */
export class CompleteUploadDto {
  @ApiProperty({
    description: '上传会话ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  sessionId?: string;

  @ApiProperty({
    description: '文件名（可选，用于重命名）',
    example: 'my-document.pdf',
    required: false,
  })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiProperty({
    description: '是否压缩图片',
    example: true,
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  compress?: boolean = true;

  @ApiProperty({
    description: '是否生成缩略图',
    example: true,
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  generateThumbnail?: boolean = true;
}

/**
 * 完成上传结果
 */
export class CompleteUploadResult {
  @ApiProperty({ description: '文件ID' })
  fileId: string;

  @ApiProperty({ description: '文件名' })
  fileName: string;

  @ApiProperty({ description: '文件URL' })
  url: string;

  @ApiProperty({ description: '文件大小（字节）' })
  size: number;

  @ApiProperty({ description: 'MIME类型' })
  mimeType: string;

  @ApiProperty({ description: '上传时间' })
  uploadedAt: Date;
}

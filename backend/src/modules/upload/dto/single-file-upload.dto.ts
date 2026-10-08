import { ApiProperty } from '@nestjs/swagger';

/**
 * 单文件上传 DTO
 * 用于 Swagger 文档，实际使用 Multer 处理文件
 */
export class SingleFileUploadDto {
  @ApiProperty({
    description: '文件',
    type: 'string',
    format: 'binary',
  })
  file: any;

  @ApiProperty({
    description: '文件夹ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  folderId?: string;

  @ApiProperty({
    description: '是否压缩图片',
    example: true,
    required: false,
    default: true,
  })
  compress?: string;

  @ApiProperty({
    description: '是否生成缩略图',
    example: true,
    required: false,
    default: true,
  })
  generateThumbnail?: string;
}

/**
 * 单文件上传结果
 */
export class SingleFileUploadResult {
  @ApiProperty({ description: '文件ID' })
  fileId: string;

  @ApiProperty({ description: '文件名' })
  fileName: string;

  @ApiProperty({ description: '原始文件名' })
  originalName: string;

  @ApiProperty({ description: '文件URL' })
  url: string;

  @ApiProperty({ description: '文件大小（字节）' })
  size: number;

  @ApiProperty({ description: 'MIME类型' })
  mimeType: string;

  @ApiProperty({ description: '文件扩展名' })
  extension: string;

  @ApiProperty({ description: '是否秒传' })
  isRapidUpload: boolean;

  @ApiProperty({ description: '上传时间' })
  uploadedAt: Date;
}

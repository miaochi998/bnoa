import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 初始化上传会话 DTO
 */
export class InitUploadDto {
  @ApiProperty({
    description: '文件名',
    example: 'large-video.mp4',
  })
  @IsString()
  @IsNotEmpty({ message: '文件名不能为空' })
  fileName: string;

  @ApiProperty({
    description: '文件大小（字节）',
    example: 104857600,
  })
  @IsNumber()
  @Min(1, { message: '文件大小必须大于0' })
  fileSize: number;

  @ApiProperty({
    description: '文件MD5哈希值',
    example: 'd41d8cd98f00b204e9800998ecf8427e',
  })
  @IsString()
  @IsOptional()
  md5?: string;

  @ApiProperty({
    description: '文件MD5哈希值（别名）',
    example: 'd41d8cd98f00b204e9800998ecf8427e',
  })
  @IsString()
  @IsOptional()
  fileMd5?: string;

  @ApiProperty({
    description: 'MIME类型',
    example: 'video/mp4',
  })
  @IsString()
  @IsNotEmpty({ message: 'MIME类型不能为空' })
  mimeType: string;

  @ApiProperty({
    description: '文件扩展名',
    example: 'mp4',
    required: false,
  })
  @IsString()
  @IsOptional()
  extension?: string;

  @ApiProperty({
    description: '分片大小（字节），默认5MB',
    example: 5242880,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  @Min(1024, { message: '分片大小不能小于1KB' })
  @Max(104857600, { message: '分片大小不能超过100MB' })
  chunkSize?: number;

  @ApiProperty({
    description: '文件夹ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  folderId?: string;

  @ApiProperty({
    description: '存储模式',
    example: 'rustfs',
    enum: ['rustfs', 'local'],
    required: false,
  })
  @IsString()
  @IsOptional()
  storageMode?: 'rustfs' | 'local';
}

/**
 * 初始化上传会话结果
 */
export class InitUploadResult {
  @ApiProperty({ description: '上传会话ID' })
  sessionId: string;

  @ApiProperty({ description: '分片大小（字节）' })
  chunkSize: number;

  @ApiProperty({ description: '总分片数' })
  chunkCount: number;

  @ApiProperty({ description: '已上传的分片索引列表', type: [Number] })
  uploadedChunks: number[];

  @ApiProperty({ description: '上传状态' })
  status: string;

  @ApiProperty({ description: '文件是否已存在（秒传）', required: false })
  exists?: boolean;

  @ApiProperty({ description: '已存在文件的ID（秒传时返回）', required: false })
  fileId?: string;

  @ApiProperty({ description: '已存在文件的URL（秒传时返回）', required: false })
  fileUrl?: string;
}

import {
  IsString,
  IsOptional,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 秒传检查DTO
 */
export class CheckFileExistsDto {
  @ApiProperty({ description: '文件MD5' })
  @IsString()
  @MaxLength(32)
  md5: string;

  @ApiPropertyOptional({ description: '文件夹ID' })
  @IsOptional()
  @IsUUID()
  folderId?: string;
}

/**
 * 初始化上传DTO
 */
export class InitUploadDto {
  @ApiProperty({ description: '文件名' })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ description: '文件大小(字节)' })
  @IsInt()
  @Min(1)
  fileSize: number;

  @ApiProperty({ description: '文件MD5' })
  @IsString()
  @MaxLength(32)
  fileMd5: string;

  @ApiProperty({ description: '文件扩展名' })
  @IsString()
  @MaxLength(20)
  fileExtension: string;

  @ApiProperty({ description: 'MIME类型' })
  @IsString()
  @MaxLength(100)
  mimeType: string;

  @ApiPropertyOptional({ description: '文件夹ID' })
  @IsOptional()
  @IsUUID()
  folderId?: string;

  // 向后兼容，后续版本移除
  @ApiPropertyOptional({ description: '虚拟文件夹ID（已废弃，请使用 folderId）' })
  @IsOptional()
  @IsUUID()
  virtualFolderId?: string;

  @ApiPropertyOptional({ description: '分片大小(可选)' })
  @IsOptional()
  @IsInt()
  @Min(1024 * 1024) // 最小1MB
  @Max(100 * 1024 * 1024) // 最大100MB
  chunkSize?: number;
}

/**
 * 生成预签名URL DTO
 */
export class GeneratePresignedUrlsDto {
  @ApiProperty({ description: '会话ID' })
  @IsUUID()
  sessionId: string;

  @ApiProperty({ description: '分片编号列表' })
  @IsArray()
  @IsInt({ each: true })
  partNumbers: number[];
}

/**
 * 完成上传DTO
 */
export class CompleteUploadDto {
  @ApiProperty({ description: '会话ID' })
  @IsUUID()
  sessionId: string;

  @ApiProperty({ description: '已上传分片列表' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UploadPartDto)
  parts: UploadPartDto[];
}

/**
 * 上传分片信息
 */
export class UploadPartDto {
  @ApiProperty({ description: '分片编号' })
  @IsInt()
  @Min(1)
  partNumber: number;

  @ApiProperty({ description: '分片ETag' })
  @IsString()
  etag: string;
}

/**
 * 取消上传DTO
 */
export class AbortUploadDto {
  @ApiProperty({ description: '会话ID' })
  @IsUUID()
  sessionId: string;
}

/**
 * 秒传检查响应
 */
export class FileExistsResponse {
  @ApiProperty({ description: '文件是否存在' })
  exists: boolean;

  @ApiPropertyOptional({ description: '已存在的文件ID' })
  fileId?: string;

  @ApiPropertyOptional({ description: '文件URL' })
  url?: string;

  @ApiProperty({ description: '消息' })
  message: string;
}

/**
 * 初始化上传响应
 */
export class InitUploadResponse {
  @ApiProperty({ description: '会话ID' })
  sessionId: string;

  @ApiPropertyOptional({ description: 'S3 uploadId' })
  uploadId?: string;

  @ApiPropertyOptional({ description: '存储桶' })
  bucket?: string;

  @ApiPropertyOptional({ description: '对象键' })
  key?: string;

  @ApiProperty({ description: '分片大小' })
  partSize: number;

  @ApiProperty({ description: '分片数量' })
  partCount: number;

  @ApiProperty({ description: '过期时间' })
  expiresAt: Date;

  @ApiPropertyOptional({ description: '是否秒传' })
  isInstant?: boolean;

  @ApiPropertyOptional({ description: '秒传时的现有文件ID' })
  existingFileId?: string;

  @ApiPropertyOptional({ description: '秒传时的文件URL' })
  existingFileUrl?: string;
}

/**
 * 预签名URL响应
 */
export class PresignedUrlResponse {
  @ApiProperty({ description: '分片编号' })
  partNumber: number;

  @ApiProperty({ description: '默认URL(代理)' })
  url: string;

  @ApiProperty({ description: '直连URL(S3)' })
  directUrl: string;

  @ApiProperty({ description: '代理URL' })
  proxyUrl: string;

  @ApiProperty({ description: '过期时间' })
  expiresAt: Date;
}

/**
 * 预签名URL列表响应
 */
export class PresignedUrlsResponse {
  @ApiProperty({ description: '会话ID' })
  sessionId: string;

  @ApiProperty({ description: 'S3 uploadId' })
  uploadId: string;

  @ApiProperty({ type: [PresignedUrlResponse] })
  presignedUrls: PresignedUrlResponse[];

  @ApiProperty({ description: '是否支持智能选择' })
  smartMode: boolean;
}

/**
 * 完成上传响应
 */
export class CompleteUploadResponse {
  @ApiProperty({ description: '文件ID' })
  fileId: string;

  @ApiProperty({ description: '文件URL' })
  url: string;

  @ApiPropertyOptional({ description: '缩略图URL' })
  thumbnailUrl?: string;

  @ApiProperty({ description: '消息' })
  message: string;
}

/**
 * 上传会话状态响应
 */
export class UploadSessionResponse {
  @ApiProperty({ description: '会话ID' })
  sessionId: string;

  @ApiProperty({ description: '状态' })
  status: string;

  @ApiProperty({ description: '文件名' })
  fileName: string;

  @ApiProperty({ description: '文件大小' })
  fileSize: string;

  @ApiProperty({ description: '分片数量' })
  partCount: number;

  @ApiProperty({ description: '已上传分片数量' })
  uploadedParts: number;

  @ApiProperty({ description: '进度(0-100)' })
  progress: number;

  @ApiProperty({ description: '过期时间' })
  expiresAt: Date;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;
}

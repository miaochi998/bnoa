import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 上传分片 DTO
 */
export class UploadChunkDto {
  @ApiProperty({
    description: '分片索引（从0开始）',
    example: 0,
  })
  @IsNumber()
  @Min(0, { message: '分片索引不能小于0' })
  chunkIndex: number;

  @ApiProperty({
    description: '分片MD5哈希值（用于校验）',
    example: 'e99a18c428cb38d5f260853678922e03',
  })
  @IsString()
  @IsNotEmpty({ message: '分片MD5不能为空' })
  chunkMd5: string;
}

/**
 * 上传分片结果
 */
export class UploadChunkResult {
  @ApiProperty({ description: '分片索引' })
  chunkIndex: number;

  @ApiProperty({ description: '是否上传成功' })
  success: boolean;

  @ApiProperty({ description: '已上传分片数' })
  uploadedChunks: number;

  @ApiProperty({ description: '总分片数' })
  totalChunks: number;

  @ApiProperty({ description: '提示信息' })
  message: string;
}

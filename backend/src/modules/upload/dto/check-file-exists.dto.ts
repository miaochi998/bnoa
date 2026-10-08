import { IsString, IsNotEmpty, Length, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 检查文件是否存在 DTO（秒传检查）
 */
export class CheckFileExistsDto {
  @ApiProperty({
    description: '文件MD5哈希值',
    example: 'd41d8cd98f00b204e9800998ecf8427e',
  })
  @IsString()
  @IsNotEmpty({ message: '文件MD5不能为空' })
  @Length(32, 32, { message: 'MD5必须是32位字符串' })
  md5: string;

  @ApiProperty({
    description: '文件名',
    example: 'document.pdf',
    required: false,
  })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiProperty({
    description: '文件夹ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  folderId?: string;
}

/**
 * 文件存在检查结果
 */
export class FileExistsResult {
  @ApiProperty({ description: '文件是否存在' })
  exists: boolean;

  @ApiProperty({ description: '文件ID', required: false })
  fileId?: string;

  @ApiProperty({ description: '文件URL', required: false })
  url?: string;

  @ApiProperty({ description: '提示信息' })
  message: string;
}

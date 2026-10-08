import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class NumberCheckConfigDto {
  @ApiPropertyOptional({ description: '上传文件大小限制(MB)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxSize?: number;

  @ApiPropertyOptional({ description: '上传存储位置(real_folders.id)' })
  @IsOptional()
  @IsString()
  realFolderId?: string;

  @ApiPropertyOptional({
    description: '上传存储模式 local/rustfs',
    enum: ['local', 'rustfs'],
  })
  @IsOptional()
  @IsIn(['local', 'rustfs'])
  storageMode?: 'local' | 'rustfs';
}

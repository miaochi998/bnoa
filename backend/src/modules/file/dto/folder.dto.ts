import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 创建真实文件夹DTO
 */
export class CreateRealFolderDto {
  @ApiProperty({ description: '英文路径名（支持多级目录，如 resources/covers）' })
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*$/, {
    message: '路径名每级目录只能包含英文字母、数字、下划线和短横线，多级目录用 / 分隔',
  })
  pathName: string;

  @ApiProperty({ description: '中文显示名' })
  @IsString()
  @MaxLength(100)
  displayName: string;

  @ApiPropertyOptional({ description: '备注说明' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '排序权重', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

}

/**
 * 更新真实文件夹DTO
 */
export class UpdateRealFolderDto {
  @ApiPropertyOptional({ description: '中文显示名' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: '备注说明' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

}

/**
 * 真实文件夹响应
 */
export class RealFolderResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  pathName: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  sortOrder: number;

  @ApiProperty()
  isSystem: boolean;

  @ApiProperty()
  fileCount: number;

  @ApiProperty()
  totalSize: string;

  @ApiProperty()
  folderCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

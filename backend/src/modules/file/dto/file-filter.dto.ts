import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 文件排序字段
 */
export enum FileSortField {
  NAME = 'name',
  SIZE = 'size',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

/**
 * 文件排序方向
 */
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * 存储模式
 */
export enum StorageMode {
  RUSTFS = 'rustfs',
  LOCAL = 'local',
}

/**
 * 文件夹范围
 */
export enum FolderScope {
  PERSONAL = 'personal',
  SHARED_WITH_ME = 'sharedWithMe',
  SYSTEM_SHARED = 'systemShared',
}

/**
 * 文件筛选 DTO
 */
export class FileFilterDto {
  @ApiProperty({
    description: '文件夹ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  folderId?: string;

  @ApiProperty({
    description: '搜索关键字',
    example: 'document',
    required: false,
  })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiProperty({
    description: '文件类型',
    example: 'pdf',
    required: false,
  })
  @IsString()
  @IsOptional()
  extension?: string;

  @ApiProperty({
    description: '排序字段',
    enum: FileSortField,
    example: FileSortField.CREATED_AT,
    required: false,
  })
  @IsEnum(FileSortField)
  @IsOptional()
  sortBy?: FileSortField = FileSortField.CREATED_AT;

  @ApiProperty({
    description: '排序方向',
    enum: SortDirection,
    example: SortDirection.DESC,
    required: false,
  })
  @IsEnum(SortDirection)
  @IsOptional()
  sortOrder?: SortDirection = SortDirection.DESC;

  @ApiProperty({
    description: '页码',
    example: 1,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: '每页数量',
    example: 20,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;

  @ApiProperty({
    description: '存储模式筛选',
    enum: StorageMode,
    example: StorageMode.RUSTFS,
    required: false,
  })
  @IsEnum(StorageMode)
  @IsOptional()
  storageMode?: StorageMode;

  @ApiProperty({
    description: '文件夹范围筛选（个人/共享给我/系统共享）',
    enum: FolderScope,
    required: false,
  })
  @IsEnum(FolderScope)
  @IsOptional()
  folderScope?: FolderScope;
}

/**
 * 分页响应元数据
 */
export class PaginationMeta {
  @ApiProperty({ description: '当前页码' })
  page: number;

  @ApiProperty({ description: '每页数量' })
  pageSize: number;

  @ApiProperty({ description: '总记录数' })
  total: number;

  @ApiProperty({ description: '总页数' })
  totalPages: number;

  @ApiProperty({ description: '是否有下一页' })
  hasNextPage: boolean;

  @ApiProperty({ description: '是否有上一页' })
  hasPreviousPage: boolean;
}

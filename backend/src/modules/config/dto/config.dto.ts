import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';

/**
 * 配置值类型
 */
export enum ConfigType {
  STRING = 'STRING',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  JSON = 'JSON',
}

/**
 * 配置状态
 */
export enum ConfigStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/**
 * 创建配置 DTO
 */
export class CreateConfigDto {
  @ApiProperty({
    description: '配置键',
    example: 'site.name',
  })
  @IsString()
  key: string;

  @ApiProperty({
    description: '配置值',
    example: 'BNOA 系统',
  })
  @IsString()
  value: string;

  @ApiProperty({
    description: '配置类型',
    enum: ConfigType,
    example: ConfigType.STRING,
  })
  @IsEnum(ConfigType)
  type: ConfigType;

  @ApiProperty({
    description: '配置描述',
    example: '站点名称',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: '配置分组',
    example: 'site',
  })
  @IsString()
  category: string;

  @ApiProperty({
    description: '排序号',
    example: 0,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

/**
 * 更新配置 DTO
 */
export class UpdateConfigDto {
  @ApiProperty({
    description: '配置值',
    example: 'BNOA 系统',
    required: false,
  })
  @IsString()
  @IsOptional()
  value?: string;

  @ApiProperty({
    description: '配置描述',
    example: '站点名称',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: '排序号',
    example: 0,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({
    description: '状态',
    enum: ConfigStatus,
    example: ConfigStatus.ACTIVE,
    required: false,
  })
  @IsEnum(ConfigStatus)
  @IsOptional()
  status?: ConfigStatus;
}

/**
 * 查询配置 DTO
 */
export class QueryConfigDto {
  @ApiProperty({
    description: '关键词搜索',
    example: 'site',
    required: false,
  })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiProperty({
    description: '配置分组',
    example: 'site',
    required: false,
  })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({
    description: '状态',
    enum: ConfigStatus,
    example: ConfigStatus.ACTIVE,
    required: false,
  })
  @IsEnum(ConfigStatus)
  @IsOptional()
  status?: ConfigStatus;

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
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}

/**
 * 批量更新配置 DTO
 */
export class BatchUpdateConfigDto {
  @ApiProperty({
    description: '配置项列表',
    example: [{ key: 'site.name', value: '新名称' }],
  })
  configs: { key: string; value: string }[];
}

/**
 * 配置信息
 */
export interface ConfigInfo {
  id: string;
  key: string;
  value: string;
  type: ConfigType;
  description?: string;
  category: string;
  sortOrder: number;
  status: ConfigStatus;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 配置分组信息
 */
export interface ConfigCategory {
  name: string;
  label: string;
  count: number;
}

/**
 * 分页元数据
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

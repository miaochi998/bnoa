import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';

/**
 * 权限类型
 */
export enum PermissionType {
  MENU = 'MENU',
  BUTTON = 'BUTTON',
  API = 'API',
  DATA = 'DATA',
}

/**
 * 创建权限 DTO
 */
export class CreatePermissionDto {
  @ApiProperty({
    description: '权限名称',
    example: '用户管理',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: '权限编码',
    example: 'user:manage',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: '权限类型',
    enum: PermissionType,
    example: PermissionType.MENU,
  })
  @IsEnum(PermissionType)
  type: PermissionType;

  @ApiProperty({
    description: '父权限ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiProperty({
    description: '权限描述',
    example: '管理用户相关操作',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: '排序顺序',
    example: 1,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number = 0;
}

/**
 * 更新权限 DTO
 */
export class UpdatePermissionDto {
  @ApiProperty({
    description: '权限名称',
    example: '用户管理',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: '权限描述',
    example: '管理用户相关操作',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: '排序顺序',
    example: 1,
    required: false,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

/**
 * 权限查询 DTO
 */
export class QueryPermissionDto {
  @ApiProperty({
    description: '搜索关键字',
    example: 'user',
    required: false,
  })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiProperty({
    description: '权限类型',
    enum: PermissionType,
    example: PermissionType.MENU,
    required: false,
  })
  @IsEnum(PermissionType)
  @IsOptional()
  type?: PermissionType;
}

/**
 * 权限信息
 */
export interface PermissionInfo {
  id: string;
  name: string;
  code: string;
  type: PermissionType;
  parentId?: string;
  description?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 权限树节点
 */
export interface PermissionTreeNode extends PermissionInfo {
  children: PermissionTreeNode[];
}

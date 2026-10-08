import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * 角色状态
 */
export enum RoleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/**
 * 创建角色 DTO
 */
export class CreateRoleDto {
  @ApiProperty({
    description: '角色名称',
    example: '管理员',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: '角色编码',
    example: 'admin',
  })
  @IsString()
  code: string;

  @ApiProperty({
    description: '角色描述',
    example: '系统管理员角色',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: '角色状态',
    enum: RoleStatus,
    example: RoleStatus.ACTIVE,
    required: false,
  })
  @IsEnum(RoleStatus)
  @IsOptional()
  status?: RoleStatus = RoleStatus.ACTIVE;

  @ApiProperty({
    description: '权限ID列表',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionIds?: string[];
}

/**
 * 更新角色 DTO
 */
export class UpdateRoleDto {
  @ApiProperty({
    description: '角色名称',
    example: '管理员',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: '角色描述',
    example: '系统管理员角色',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: '角色状态',
    enum: RoleStatus,
    example: RoleStatus.ACTIVE,
    required: false,
  })
  @IsEnum(RoleStatus)
  @IsOptional()
  status?: RoleStatus;

  @ApiProperty({
    description: '权限ID列表',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
    required: false,
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissionIds?: string[];
}

/**
 * 角色查询 DTO
 */
export class QueryRoleDto {
  @ApiProperty({
    description: '搜索关键字',
    example: 'admin',
    required: false,
  })
  @IsString()
  @IsOptional()
  keyword?: string;

  @ApiProperty({
    description: '角色状态',
    enum: RoleStatus,
    example: RoleStatus.ACTIVE,
    required: false,
  })
  @IsEnum(RoleStatus)
  @IsOptional()
  status?: RoleStatus;

  @ApiProperty({
    description: '页码',
    example: 1,
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10) || 1)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    description: '每页数量',
    example: 20,
    required: false,
  })
  @Transform(({ value }) => parseInt(value, 10) || 20)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}

/**
 * 分配权限 DTO
 */
export class AssignPermissionsDto {
  @ApiProperty({
    description: '权限ID列表',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}

/**
 * 分配角色 DTO
 */
export class AssignRolesDto {
  @ApiProperty({
    description: '角色ID列表',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}

/**
 * 角色信息
 */
export interface RoleInfo {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: RoleStatus;
  permissionCount: number;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
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

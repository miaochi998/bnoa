import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';

/**
 * 审计操作类型
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  IMPORT = 'IMPORT',
  VIEW = 'VIEW',
}

/**
 * 审计日志状态
 */
export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAIL = 'FAIL',
}

/**
 * 创建审计日志 DTO
 */
export class CreateAuditLogDto {
  @ApiProperty({
    description: '操作类型',
    enum: AuditAction,
    example: AuditAction.CREATE,
  })
  @IsEnum(AuditAction)
  action: AuditAction;

  @ApiProperty({
    description: '模块名称',
    example: 'user',
  })
  @IsString()
  module: string;

  @ApiProperty({
    description: '资源名称',
    example: 'User',
  })
  @IsString()
  resource: string;

  @ApiProperty({
    description: '资源ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  resourceId?: string;

  @ApiProperty({
    description: '操作描述',
    example: '创建用户',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: '旧值（JSON格式）',
    example: '{}',
    required: false,
  })
  @IsString()
  @IsOptional()
  oldValue?: string;

  @ApiProperty({
    description: '新值（JSON格式）',
    example: '{"name":"张三"}',
    required: false,
  })
  @IsString()
  @IsOptional()
  newValue?: string;

  @ApiProperty({
    description: '差异（JSON格式）',
    example: '{"name":{"old":null,"new":"张三"}}',
    required: false,
  })
  @IsString()
  @IsOptional()
  diff?: string;

  @ApiProperty({
    description: '用户ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    description: '用户名',
    example: 'admin',
    required: false,
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({
    description: '真实姓名',
    example: '管理员',
    required: false,
  })
  @IsString()
  @IsOptional()
  realName?: string;

  @ApiProperty({
    description: 'IP地址',
    example: '192.168.1.1',
  })
  @IsString()
  ip: string;

  @ApiProperty({
    description: '用户代理',
    example: 'Mozilla/5.0...',
    required: false,
  })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiProperty({
    description: '请求URL',
    example: '/api/v1/users',
  })
  @IsString()
  requestUrl: string;

  @ApiProperty({
    description: '请求方法',
    example: 'POST',
  })
  @IsString()
  requestMethod: string;

  @ApiProperty({
    description: '请求参数（JSON格式）',
    example: '{"name":"张三"}',
    required: false,
  })
  @IsString()
  @IsOptional()
  requestParams?: string;

  @ApiProperty({
    description: '执行时间（毫秒）',
    example: 150,
  })
  @IsInt()
  @Min(0)
  executionTime: number;

  @ApiProperty({
    description: '状态',
    enum: AuditStatus,
    example: AuditStatus.SUCCESS,
  })
  @IsEnum(AuditStatus)
  status: AuditStatus;

  @ApiProperty({
    description: '错误信息',
    example: '',
    required: false,
  })
  @IsString()
  @IsOptional()
  errorMessage?: string;
}

/**
 * 查询审计日志 DTO
 */
export class QueryAuditLogDto {
  @ApiProperty({
    description: '操作类型',
    enum: AuditAction,
    example: AuditAction.CREATE,
    required: false,
  })
  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;

  @ApiProperty({
    description: '模块名称',
    example: 'user',
    required: false,
  })
  @IsString()
  @IsOptional()
  module?: string;

  @ApiProperty({
    description: '用户名',
    example: 'admin',
    required: false,
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiProperty({
    description: '状态',
    enum: AuditStatus,
    example: AuditStatus.SUCCESS,
    required: false,
  })
  @IsEnum(AuditStatus)
  @IsOptional()
  status?: AuditStatus;

  @ApiProperty({
    description: '开始时间',
    example: '2026-01-01',
    required: false,
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: '结束时间',
    example: '2026-12-31',
    required: false,
  })
  @IsString()
  @IsOptional()
  endDate?: string;

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
 * 审计日志信息
 */
export interface AuditLogInfo {
  id: string;
  action: AuditAction;
  module: string;
  resource: string;
  resourceId?: string;
  description?: string;
  oldValue?: string;
  newValue?: string;
  diff?: string;
  userId?: string;
  username?: string;
  realName?: string;
  ip: string;
  userAgent?: string;
  requestUrl: string;
  requestMethod: string;
  requestParams?: string;
  executionTime: number;
  status: AuditStatus;
  errorMessage?: string;
  createdAt: Date;
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

/**
 * 审计统计信息
 */
export interface AuditStatistics {
  totalCount: number;
  todayCount: number;
  successCount: number;
  failCount: number;
  actionStats: { action: string; count: number }[];
  moduleStats: { module: string; count: number }[];
}

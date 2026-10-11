import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './dto/audit.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { UserPayload } from '../../common/decorators/current-user.decorator';
import {
  FieldKeyMapping,
  FieldPermissionService,
} from '../role/field-permission.service';

/** 审计日志字段映射：用于「信息权限」读取脱敏（审计日志本身不可编辑） */
const AUDIT_FIELD_MAP: FieldKeyMapping[] = [
  { field: 'action', key: 'action' },
  { field: 'module', key: 'module' },
  { field: 'resource', key: 'resource' },
  { field: 'resourceId', key: 'resourceId' },
  { field: 'description', key: 'description' },
  { field: 'createdAt', key: 'createdAt' },
  { field: 'username', key: 'username' },
  { field: 'realName', key: 'realName' },
  { field: 'ip', key: 'ip' },
  { field: 'userAgent', key: 'userAgent' },
  { field: 'requestUrl', key: 'requestUrl' },
  { field: 'oldValue', key: 'oldValue' },
  { field: 'newValue', key: 'newValue' },
  { field: 'diff', key: 'diff' },
];

/**
 * 审计日志控制器
 * 提供审计日志的查询和统计接口
 */
@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly fieldPermissionService: FieldPermissionService,
  ) {}

  /** 当前用户在本模块的字段权限 */
  private resolveFields(user: UserPayload) {
    return this.fieldPermissionService.resolve(
      user.sub,
      'audit',
      user.roles ?? [],
    );
  }

  /** 递归脱敏 */
  private stripAuditDeep(node: any, state: any): any {
    return this.fieldPermissionService.stripHiddenFieldsDeep(
      node,
      AUDIT_FIELD_MAP,
      state,
    );
  }

  /**
   * 查询审计日志列表
   */
  @Get()
  @Permissions('audit:list')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '查询审计日志',
    description: '分页查询审计日志列表',
  })
  @ApiResponse({ status: 200, description: '查询成功' })
  async findAuditLogs(
    @Query() query: QueryAuditLogDto,
    @CurrentUser() user: UserPayload,
  ) {
    const result = await this.auditService.findAuditLogs(query);
    const state = await this.resolveFields(user);
    return {
      success: true,
      message: '查询审计日志成功',
      data: this.stripAuditDeep(result.items, state),
      meta: result.meta,
    };
  }

  /**
   * 获取审计统计信息
   */
  @Get('statistics')
  @Permissions('audit:statistics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '获取审计统计',
    description: '获取审计日志统计信息',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getStatistics(@CurrentUser() user: UserPayload) {
    const statistics = await this.auditService.getStatistics();
    const state = await this.resolveFields(user);
    return {
      success: true,
      message: '获取审计统计成功',
      data: this.stripAuditDeep(statistics, state),
    };
  }

  /**
   * 批量删除审计日志
   */
  @Post('batch-delete')
  @Permissions('audit:delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '批量删除审计日志',
    description: '批量删除指定的审计日志记录',
  })
  @ApiResponse({ status: 200, description: '删除成功' })
  async batchDeleteLogs(@Body() dto: { logIds: string[] }) {
    const result = await this.auditService.batchDeleteLogs(dto.logIds);
    return {
      success: true,
      message: '删除成功',
      data: result,
    };
  }

  /**
   * 获取当前用户的审计日志
   */
  @Get('my-logs')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '我的审计日志',
    description: '获取当前用户的审计日志',
  })
  @ApiResponse({ status: 200, description: '获取成功' })
  getMyAuditLogs(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 20,
  ) {
    // 注意：这里需要从请求中获取当前用户ID
    // 简化处理，实际应该使用 @CurrentUser() 装饰器
    return {
      success: true,
      message: '获取我的审计日志成功',
      data: [],
      meta: {
        page,
        pageSize,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }
}

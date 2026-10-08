import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  CreateAuditLogDto,
  QueryAuditLogDto,
  AuditLogInfo,
  AuditStatistics,
  AuditStatus,
  AuditAction,
  PaginationMeta,
} from './dto/audit.dto';

/**
 * Prisma 审计日志类型
 */
interface PrismaAuditLog {
  id: string;
  action: string;
  module: string;
  resource: string;
  resourceId: string | null;
  description: string | null;
  oldValue: string | null;
  newValue: string | null;
  diff: string | null;
  userId: string | null;
  username: string | null;
  realName: string | null;
  ip: string;
  userAgent: string | null;
  requestUrl: string;
  requestMethod: string;
  requestParams: string | null;
  executionTime: number;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
}

/**
 * 审计日志服务
 * 提供审计日志的记录、查询和统计功能
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== 审计日志记录 ====================

  /**
   * 创建审计日志
   * @param dto 创建审计日志DTO
   * @returns 审计日志信息
   */
  async createAuditLog(dto: CreateAuditLogDto): Promise<AuditLogInfo> {
    try {
      const auditLog = await this.prisma.auditLog.create({
        data: {
          action: dto.action,
          module: dto.module,
          resource: dto.resource,
          resourceId: dto.resourceId,
          description: dto.description,
          oldValue: dto.oldValue,
          newValue: dto.newValue,
          diff: dto.diff,
          userId: dto.userId,
          username: dto.username,
          realName: dto.realName,
          ip: dto.ip,
          userAgent: dto.userAgent,
          requestUrl: dto.requestUrl,
          requestMethod: dto.requestMethod,
          requestParams: dto.requestParams,
          executionTime: dto.executionTime,
          status: dto.status,
          errorMessage: dto.errorMessage,
        },
      });

      this.logger.debug(`审计日志记录成功: ${dto.action} - ${dto.module}`);

      return this.toAuditLogInfo(auditLog);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`创建审计日志失败: ${err.message}`, err.stack);
      throw error;
    }
  }

  /**
   * 批量创建审计日志
   * @param dtos 审计日志DTO列表
   */
  async batchCreateAuditLogs(dtos: CreateAuditLogDto[]): Promise<void> {
    try {
      await this.prisma.auditLog.createMany({
        data: dtos.map((dto) => ({
          action: dto.action,
          module: dto.module,
          resource: dto.resource,
          resourceId: dto.resourceId,
          description: dto.description,
          oldValue: dto.oldValue,
          newValue: dto.newValue,
          diff: dto.diff,
          userId: dto.userId,
          username: dto.username,
          realName: dto.realName,
          ip: dto.ip,
          userAgent: dto.userAgent,
          requestUrl: dto.requestUrl,
          requestMethod: dto.requestMethod,
          requestParams: dto.requestParams,
          executionTime: dto.executionTime,
          status: dto.status,
          errorMessage: dto.errorMessage,
        })),
      });

      this.logger.debug(`批量审计日志记录成功: ${dtos.length} 条`);
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`批量创建审计日志失败: ${err.message}`, err.stack);
      throw error;
    }
  }

  // ==================== 审计日志查询 ====================

  /**
   * 查询审计日志列表
   * @param query 查询条件
   * @returns 审计日志列表和分页信息
   */
  async findAuditLogs(
    query: QueryAuditLogDto,
  ): Promise<{ items: AuditLogInfo[]; meta: PaginationMeta }> {
    const {
      action,
      module,
      username,
      status,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = query;

    const where: any = {};

    if (action) {
      where.action = action;
    }

    if (module) {
      where.module = module;
    }

    if (username) {
      where.username = { contains: username, mode: 'insensitive' };
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [auditLogs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),

      this.prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: auditLogs.map((log) => this.toAuditLogInfo(log)),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * 获取审计日志详情
   * @param id 审计日志ID
   * @returns 审计日志信息
   */
  async getAuditLogById(id: string): Promise<AuditLogInfo | null> {
    const auditLog = await this.prisma.auditLog.findUnique({
      where: { id },
    });

    return auditLog ? this.toAuditLogInfo(auditLog) : null;
  }

  /**
   * 获取用户的审计日志
   * @param userId 用户ID
   * @param page 页码
   * @param pageSize 每页数量
   * @returns 审计日志列表和分页信息
   */
  async getAuditLogsByUser(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ items: AuditLogInfo[]; meta: PaginationMeta }> {
    const [auditLogs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where: { userId } }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: auditLogs.map((log) => this.toAuditLogInfo(log)),
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  // ==================== 审计统计 ====================

  /**
   * 获取审计统计信息
   * @returns 审计统计信息
   */
  async getStatistics(): Promise<AuditStatistics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalCount,
      todayCount,
      successCount,
      failCount,
      actionStats,
      moduleStats,
    ] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.auditLog.count({
        where: { status: AuditStatus.SUCCESS },
      }),
      this.prisma.auditLog.count({
        where: { status: AuditStatus.FAIL },
      }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        _count: { action: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['module'],
        _count: { module: true },
      }),
    ]);

    return {
      totalCount,
      todayCount,
      successCount,
      failCount,
      actionStats: actionStats.map((stat) => ({
        action: stat.action,
        count: stat._count.action,
      })),
      moduleStats: moduleStats.map((stat) => ({
        module: stat.module,
        count: stat._count.module,
      })),
    };
  }

  /**
   * 批量删除审计日志
   */
  async batchDeleteLogs(logIds: string[]): Promise<{ deletedCount: number }> {
    const result = await this.prisma.auditLog.deleteMany({
      where: { id: { in: logIds } },
    });
    this.logger.log(`批量删除审计日志: ${result.count} 条`);
    return { deletedCount: result.count };
  }

  // ==================== 私有方法 ====================

  private toAuditLogInfo(auditLog: PrismaAuditLog): AuditLogInfo {
    return {
      id: auditLog.id,
      action: auditLog.action as AuditAction,
      module: auditLog.module,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId ?? undefined,
      description: auditLog.description ?? undefined,
      oldValue: auditLog.oldValue ?? undefined,
      newValue: auditLog.newValue ?? undefined,
      diff: auditLog.diff ?? undefined,
      userId: auditLog.userId ?? undefined,
      username: auditLog.username ?? undefined,
      realName: auditLog.realName ?? undefined,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent ?? undefined,
      requestUrl: auditLog.requestUrl,
      requestMethod: auditLog.requestMethod,
      requestParams: auditLog.requestParams ?? undefined,
      executionTime: auditLog.executionTime,
      status: auditLog.status as AuditStatus,
      errorMessage: auditLog.errorMessage ?? undefined,
      createdAt: auditLog.createdAt,
    };
  }
}

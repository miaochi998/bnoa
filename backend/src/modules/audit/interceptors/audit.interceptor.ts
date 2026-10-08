import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../audit.service';
import { AuditAction, AuditStatus } from '../dto/audit.dto';
import { Request } from 'express';
import { UserPayload } from '../../../common/decorators/current-user.decorator';

// Extended request type with user
interface RequestWithUser extends Request {
  user?: UserPayload;
}

/**
 * 审计日志拦截器
 * 自动记录请求的操作日志
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const startTime = Date.now();

    // 获取请求信息
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { method, originalUrl, ip: _ip, headers, body, user } = request;

    const userAgent = headers['user-agent'] || '';

    // 解析操作类型和模块
    const { action, module, resource } = this.parseOperation(
      originalUrl,
      method,
    );

    // 如果不是需要记录的操作，直接放行
    if (!action) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        next: (_response) => {
          const executionTime = Date.now() - startTime;
          void this.recordAuditLog({
            action,
            module,
            resource,
            description: this.generateDescription(action, resource, body),
            requestUrl: originalUrl,
            requestMethod: method,
            requestParams: JSON.stringify(body),
            ip: this.getClientIp(request),
            userAgent,
            executionTime,
            status: AuditStatus.SUCCESS,
            user,
          });
        },
        error: (error: Error) => {
          const executionTime = Date.now() - startTime;
          void this.recordAuditLog({
            action,
            module,
            resource,
            description: this.generateDescription(action, resource, body),
            requestUrl: originalUrl,
            requestMethod: method,
            requestParams: JSON.stringify(body),
            ip: this.getClientIp(request),
            userAgent,
            executionTime,
            status: AuditStatus.FAIL,
            errorMessage: error.message,
            user,
          });
        },
      }),
    );
  }

  /**
   * 解析操作类型和模块
   */
  private parseOperation(
    url: string,
    method: string,
  ): { action: AuditAction | null; module: string; resource: string } {
    // 解析 URL 路径
    const pathParts = url.replace('/api/v1/', '').split('/');
    const module = pathParts[0] || 'unknown';
    const resource = pathParts[1] || module;

    // 根据 HTTP 方法确定操作类型
    let action: AuditAction | null = null;

    switch (method.toUpperCase()) {
      case 'POST':
        // 排除查询操作
        if (url.includes('/query') || url.includes('/search')) {
          action = AuditAction.VIEW;
        } else if (url.includes('/login')) {
          action = AuditAction.LOGIN;
        } else if (url.includes('/logout')) {
          action = AuditAction.LOGOUT;
        } else if (url.includes('/export')) {
          action = AuditAction.EXPORT;
        } else if (url.includes('/import')) {
          action = AuditAction.IMPORT;
        } else {
          action = AuditAction.CREATE;
        }
        break;
      case 'PUT':
      case 'PATCH':
        action = AuditAction.UPDATE;
        break;
      case 'DELETE':
        action = AuditAction.DELETE;
        break;
      case 'GET':
        action = AuditAction.VIEW;
        break;
      default:
        action = null;
    }

    return { action, module, resource };
  }

  /**
   * 生成操作描述
   */
  private generateDescription(
    action: AuditAction,
    resource: string,

    body: any,
  ): string {
    const actionMap: Record<string, string> = {
      CREATE: '创建',
      UPDATE: '更新',
      DELETE: '删除',
      LOGIN: '登录',
      LOGOUT: '登出',
      EXPORT: '导出',
      IMPORT: '导入',
      VIEW: '查看',
    };

    const resourceMap: Record<string, string> = {
      users: '用户',
      roles: '角色',
      permissions: '权限',
      files: '文件',
      folders: '文件夹',
      config: '配置',
      audit: '审计日志',
      storage: '存储',
      upload: '上传',
      image: '图片',
      auth: '认证',
    };

    const resourceName = resourceMap[resource] || resource;
    const actionName = actionMap[action] || action;

    if (body?.name) {
      return `${actionName}${resourceName}: ${body.name}`;
    }

    return `${actionName}${resourceName}`;
  }

  /**
   * 获取客户端 IP
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || 'unknown';
  }

  /**
   * 记录审计日志
   */
  private async recordAuditLog(data: {
    action: AuditAction;
    module: string;
    resource: string;
    description: string;
    requestUrl: string;
    requestMethod: string;
    requestParams: string;
    ip: string;
    userAgent: string;
    executionTime: number;
    status: AuditStatus;
    errorMessage?: string;
    user?: UserPayload;
  }): Promise<void> {
    try {
      await this.auditService.createAuditLog({
        action: data.action,
        module: data.module,
        resource: data.resource,
        description: data.description,
        requestUrl: data.requestUrl,
        requestMethod: data.requestMethod,
        requestParams: data.requestParams,
        ip: data.ip,
        userAgent: data.userAgent,
        executionTime: data.executionTime,
        status: data.status,
        errorMessage: data.errorMessage,
        userId: data.user?.sub,
        username: data.user?.username,
        realName: data.user?.username,
      });
    } catch (error: unknown) {
      // 审计日志记录失败不应影响主业务流程
      const err = error as Error;
      this.logger.error(`审计日志记录失败: ${err.message}`);
    }
  }
}

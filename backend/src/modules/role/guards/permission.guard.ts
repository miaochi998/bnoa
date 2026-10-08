import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserPayload } from '../../../common/decorators/current-user.decorator';
import { RoleService } from '../role.service';

/**
 * 权限守卫
 * 检查用户是否具有指定权限
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private roleService: RoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取需要的权限
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    // 如果没有指定权限要求，允许访问
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // 获取当前用户
    const { user } = context.switchToHttp().getRequest<{ user: UserPayload }>();

    if (!user || !user.sub) {
      throw new ForbiddenException('未登录');
    }

    // 获取用户的所有权限
    const userPermissions = await this.roleService.getUserPermissionCodes(
      user.sub,
    );

    // 检查是否具有所需权限
    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}

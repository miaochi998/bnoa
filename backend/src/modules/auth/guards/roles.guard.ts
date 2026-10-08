import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserPayload } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../config/prisma.service';

/**
 * 角色守卫
 * 检查用户是否具有指定角色
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取需要的角色
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    // 如果没有指定角色要求，允许访问
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 获取当前用户
    const { user } = context.switchToHttp().getRequest<{ user: UserPayload }>();

    if (!user || (!user.sub && !user.userId)) {
      throw new ForbiddenException('未登录');
    }

    // 获取用户的角色
    const userId = user.sub || user.userId;
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
      },
    });

    const userRoleCodes = userRoles.map((ur) => ur.role.code);

    // 检查是否具有所需角色
    const hasRole = requiredRoles.some((role) => userRoleCodes.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('权限不足，需要管理员角色');
    }

    return true;
  }
}

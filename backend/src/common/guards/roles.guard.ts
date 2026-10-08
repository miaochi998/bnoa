import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../config/prisma.service';
import { UserPayload } from '../decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as UserPayload;

    if (!user?.sub) {
      throw new ForbiddenException('未登录');
    }

    // 获取用户角色
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.sub },
      include: { role: true },
    });

    const roleCodes = userRoles.map(
      (ur: { role: { code: string } }) => ur.role.code,
    );

    // 检查是否拥有所需角色
    const hasRole = requiredRoles.some((role) => roleCodes.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../config/prisma.service';
import { UserPayload } from '../decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('未提供访问令牌');
    }

    let payload: UserPayload;
    try {
      payload = await this.jwtService.verifyAsync<UserPayload>(token);
    } catch {
      throw new UnauthorizedException('无效的访问令牌');
    }

    // 校验账号当前仍然有效（存在 / 未软删 / 未停用）。
    // 访问令牌本身最长 12 小时（configs.security.sessionTimeout=43200），
    // 若不查库，「禁用账号」「删除账号」在令牌过期前都不会生效。
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('用户不存在');
    }
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('用户已被禁用');
    }

    // 将 sub 映射为 userId，确保 @CurrentUser('userId') 正常工作
    request['user'] = { ...payload, userId: payload.sub };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token) return token;
    // 支持 query 参数传递 token（用于文件下载等场景）
    const queryToken = (request.query as Record<string, string>)?.token;
    return queryToken || undefined;
  }
}

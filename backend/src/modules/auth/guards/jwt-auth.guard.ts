import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT 认证守卫
 * 保护需要登录才能访问的接口
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _info: unknown,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('未授权，请先登录');
    }
    return user;
  }
}

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../config/prisma.service';

/**
 * JWT 载荷接口
 */
interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
}

/**
 * JWT 策略
 * 用于验证 JWT 令牌
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * 验证 JWT 载荷
   * @param payload JWT 载荷
   * @returns 用户信息
   */
  async validate(payload: JwtPayload) {
    // 检查用户是否存在且未禁用
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('用户已被禁用');
    }

    return {
      sub: user.id,
      userId: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      roles: payload.roles || [],
    };
  }
}

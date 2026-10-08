import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { PrismaService } from './config/prisma.service';
import { RedisService } from './common/services/redis.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiTags('系统')
  @ApiOperation({ summary: '健康检查' })
  async healthCheck() {
    const result: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'unknown',
      redis: 'unknown',
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      result.database = 'ok';
    } catch {
      result.database = 'error';
      result.status = 'degraded';
    }

    try {
      await this.redisService.set('health_check', 'ok', 10);
      const val = await this.redisService.get('health_check');
      result.redis = val === 'ok' ? 'ok' : 'error';
    } catch {
      result.redis = 'error';
      result.status = 'degraded';
    }

    return result;
  }
}

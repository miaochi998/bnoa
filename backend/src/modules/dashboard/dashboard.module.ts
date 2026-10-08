import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaModule } from '../../config/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * 仪表盘模块
 * 提供仪表盘统计数据功能
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}

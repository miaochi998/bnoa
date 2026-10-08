import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { PrismaModule } from '../../config/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * 审计日志模块
 * 提供审计日志的记录、查询和统计功能
 */
@Module({
  imports: [ConfigModule, PrismaModule, AuthModule],
  providers: [AuditService, AuditInterceptor],
  controllers: [AuditController],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}

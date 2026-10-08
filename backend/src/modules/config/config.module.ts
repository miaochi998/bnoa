import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { PrismaModule } from '../../config/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';

/**
 * 系统配置模块
 * 提供系统配置的管理和缓存功能
 */
@Module({
  imports: [NestConfigModule, PrismaModule, forwardRef(() => AuthModule), forwardRef(() => StorageModule)],
  providers: [ConfigService],
  controllers: [ConfigController],
  exports: [ConfigService],
})
export class ConfigModule implements OnModuleInit {
  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // 初始化配置缓存
    await this.configService.initCache();
  }
}

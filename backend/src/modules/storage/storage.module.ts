import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { ConfigModule as SystemConfigModule } from '../config/config.module';

/**
 * 存储服务模块
 * 提供文件存储相关功能，支持 RustFS/S3 兼容的对象存储和本地存储
 */
@Module({
  imports: [ConfigModule, forwardRef(() => SystemConfigModule)],
  providers: [StorageService, LocalStorageService],
  exports: [StorageService, LocalStorageService],
})
export class StorageModule {}

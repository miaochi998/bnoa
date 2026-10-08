import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { StorageModule } from '../storage/storage.module';
import { ImageModule } from '../image/image.module';
import { PrismaModule } from '../../config/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UploadSecurityService } from './security/upload-security.service';
import { VirusScanService } from './security/virus-scan.service';
import { VirusScannerService } from './security/virus-scanner.service';
import { ScanReviewService } from './security/scan-review.service';
import { UploadSecurityController } from './security/upload-security.controller';
import { SecurityCenterController } from './security/security-center.controller';
import { ConfigModule as SysConfigModule } from '../config/config.module';

/**
 * 上传服务模块
 * 提供文件上传相关功能，包括单文件上传、分片上传、秒传等
 * 安全功能：磁盘空间检查、上限保护、双开关控制、安全日志、文件隔离、病毒扫描
 */
@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, ImageModule, AuthModule, SysConfigModule],
  providers: [UploadService, UploadSecurityService, VirusScanService, VirusScannerService, ScanReviewService],
  controllers: [UploadController, UploadSecurityController, SecurityCenterController],
  exports: [UploadService, UploadSecurityService, VirusScanService, VirusScannerService, ScanReviewService],
})
export class UploadModule {}

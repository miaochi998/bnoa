import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../config/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { FolderService } from './folder.service';
import { FolderController } from './folder.controller';
import { FolderShareService } from './folder-share.service';
import { FolderPermissionService } from './folder-permission.service';
import { ShareService } from './share.service';
import { ShareController } from './share.controller';
import { RealFolderService } from './real-folder.service';
import { RealFolderController } from './media-folder.controller';
import { UploadSessionService } from './upload-session.service';
import { PublicFileController } from './public-file.controller';

/**
 * 文件管理模块
 * 提供文件、文件夹、分享、上传等管理功能
 */
@Module({
  imports: [ConfigModule, PrismaModule, StorageModule, AuthModule],
  providers: [
    FileService,
    FolderService,
    FolderShareService,
    FolderPermissionService,
    ShareService,
    RealFolderService,
    UploadSessionService,
  ],
  controllers: [
    FileController,
    RealFolderController,
    FolderController,
    ShareController,
    PublicFileController,
  ],
  exports: [
    FileService,
    FolderService,
    FolderShareService,
    FolderPermissionService,
    ShareService,
    RealFolderService,
    UploadSessionService,
  ],
})
export class FileModule {}

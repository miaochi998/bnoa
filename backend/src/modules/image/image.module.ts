import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ImageService } from './image.service';
import { ImageController } from './image.controller';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule as AppConfigModule } from '../config/config.module';

/**
 * 图片处理模块
 * 提供图片处理、压缩、格式转换等功能
 */
@Module({
  imports: [ConfigModule, AuthModule, forwardRef(() => AppConfigModule)],
  providers: [ImageService],
  controllers: [ImageController],
  exports: [ImageService],
})
export class ImageModule {}

import {
  Controller,
  Get,
  Param,
  Res,
  StreamableFile,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../config/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LocalStorageService } from '../storage/local-storage.service';

/**
 * 公共文件控制器
 * 提供无需认证的文件访问端点（仅限缩略图）
 */
@ApiTags('公共文件访问')
@Controller('public/files')
export class PublicFileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly localStorageService: LocalStorageService,
  ) {}

  /**
   * 预览缩略图（公共访问，无需认证）
   */
  @Get(':id/thumbnail')
  @ApiOperation({ summary: '预览缩略图（公共）' })
  async previewThumbnail(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    if (!file.thumbnailUrl) {
      throw new NotFoundException('缩略图不存在');
    }

    // 从文件路径生成缩略图路径（根目录 = 存储桶根目录）
    const thumbnailPath = file.path
      ? file.path.replace(/[^/]+$/, `${file.md5}_thumb.jpg`)
      : `${file.md5}_thumb.jpg`;

    // 根据存储类型选择下载方式
    let buffer: Buffer;
    if (file.storageType === 'LOCAL') {
      buffer = await this.localStorageService.downloadFile(thumbnailPath);
    } else {
      buffer = await this.storageService.download(thumbnailPath);
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': 'inline',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000',
    });

    return new StreamableFile(buffer);
  }

  /**
   * 预览文件（公共访问，无需认证）
   */
  @Get(':id/preview')
  @ApiOperation({ summary: '预览文件（公共）' })
  async previewFile(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.prisma.file.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!file) {
      throw new NotFoundException('文件不存在');
    }

    if (!file.path) {
      throw new NotFoundException('文件路径不存在');
    }

    // 根据存储类型选择下载方式
    let buffer: Buffer;
    if (file.storageType === 'LOCAL') {
      buffer = await this.localStorageService.downloadFile(file.path);
    } else {
      buffer = await this.storageService.download(file.path);
    }

    res.set({
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(file.name)}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'public, max-age=31536000',
      'X-Frame-Options': 'ALLOWALL',
      'Content-Security-Policy': "frame-ancestors 'self' http://localhost:6521",
    });

    return new StreamableFile(buffer);
  }
}

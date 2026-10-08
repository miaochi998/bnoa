import { Injectable, Logger, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import sharp from 'sharp';
import { ConfigService as AppConfigService } from '../config/config.service';
import {
  ImageFormat,
  ThumbnailSize,
  ProcessImageDto,
  GenerateThumbnailDto,
  CompressImageDto,
  ImageInfo,
  ProcessResult,
} from './dto/process-image.dto';

/**
 * 缩略图尺寸配置
 */
const THUMBNAIL_DIMENSIONS: Record<
  ThumbnailSize,
  { width: number; height: number }
> = {
  [ThumbnailSize.SMALL]: { width: 150, height: 150 },
  [ThumbnailSize.MEDIUM]: { width: 300, height: 300 },
  [ThumbnailSize.LARGE]: { width: 600, height: 600 },
};

/**
 * 支持的图片 MIME 类型
 */
const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/tiff',
  'image/svg+xml',
];

/**
 * 图片处理服务
 * 提供图片处理、压缩、格式转换等功能
 */
@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    @Inject(forwardRef(() => AppConfigService))
    private readonly appConfigService: AppConfigService,
  ) {}

  /**
   * 检查是否为支持的图片类型
   * @param mimeType MIME 类型
   * @returns 是否支持
   */
  isSupportedImageType(mimeType: string): boolean {
    return SUPPORTED_IMAGE_TYPES.includes(mimeType);
  }

  /**
   * 获取图片信息
   * @param buffer 图片 Buffer
   * @returns 图片信息
   */
  async getImageInfo(buffer: Buffer): Promise<ImageInfo> {
    try {
      const metadata = await sharp(buffer).metadata();

      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: buffer.length,
        colorSpace: metadata.space || 'unknown',
        hasAlpha: metadata.hasAlpha || false,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`获取图片信息失败: ${err.message}`);
      throw new BadRequestException('无法获取图片信息，请检查文件是否有效');
    }
  }

  /**
   * 处理图片
   * @param buffer 原始图片 Buffer
   * @param options 处理选项
   * @returns 处理结果
   */
  async processImage(
    buffer: Buffer,
    options: ProcessImageDto,
  ): Promise<ProcessResult> {
    try {
      let pipeline = sharp(buffer);

      // 调整尺寸
      if (options.width || options.height) {
        pipeline = pipeline.resize({
          width: options.width,
          height: options.height,
          fit: options.fit ? 'inside' : 'fill',
          withoutEnlargement: true,
        });
      }

      // 转换格式
      const targetFormat =
        options.format || (await this.getImageFormat(buffer));
      switch (targetFormat) {
        case ImageFormat.JPEG:
          pipeline = pipeline.jpeg({
            quality: options.quality,
            progressive: true,
          });
          break;
        case ImageFormat.PNG:
          pipeline = pipeline.png({
            quality: options.quality,
            progressive: true,
          });
          break;
        case ImageFormat.WEBP:
          pipeline = pipeline.webp({ quality: options.quality });
          break;
        case ImageFormat.AVIF:
          pipeline = pipeline.avif({ quality: options.quality });
          break;
        case ImageFormat.GIF:
          // GIF 不支持质量设置
          break;
      }

      const resultBuffer = await pipeline.toBuffer();
      const metadata = await sharp(resultBuffer).metadata();

      return {
        buffer: resultBuffer,
        format: targetFormat,
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: resultBuffer.length,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`处理图片失败: ${err.message}`);
      throw new BadRequestException('图片处理失败');
    }
  }

  /**
   * 生成缩略图（等比例缩放，不裁剪）
   * @param buffer 原始图片 Buffer
   * @param options 缩略图选项
   * @returns 处理结果
   */
  async generateThumbnail(
    buffer: Buffer,
    options: GenerateThumbnailDto,
  ): Promise<ProcessResult> {
    try {
      // 从系统配置中读取缩略图尺寸
      const thumbnailConfig = await this.appConfigService.getThumbnailConfig();
      const dimensions = {
        width: thumbnailConfig.width,
        height: thumbnailConfig.height,
      };
      const quality = options.quality || thumbnailConfig.quality;

      // 获取原始图片尺寸
      const originalMetadata = await sharp(buffer).metadata();
      const originalWidth = originalMetadata.width || 1;
      const originalHeight = originalMetadata.height || 1;

      // 计算等比例缩放后的尺寸
      // 如果原图宽度大于高度，则以宽度为基准缩放
      // 如果原图高度大于宽度，则以高度为基准缩放
      let targetWidth: number;
      let targetHeight: number;

      if (originalWidth >= originalHeight) {
        // 横向图片：宽度固定，高度等比例缩放
        targetWidth = dimensions.width;
        targetHeight = Math.round((originalHeight / originalWidth) * dimensions.width);
      } else {
        // 纵向图片：高度固定，宽度等比例缩放
        targetHeight = dimensions.height;
        targetWidth = Math.round((originalWidth / originalHeight) * dimensions.height);
      }

      const resultBuffer = await sharp(buffer)
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'fill', // 使用fill确保精确尺寸
          withoutEnlargement: true, // 不放大小图
        })
        .jpeg({ quality, progressive: true })
        .toBuffer();

      const metadata = await sharp(resultBuffer).metadata();

      return {
        buffer: resultBuffer,
        format: ImageFormat.JPEG,
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: resultBuffer.length,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`生成缩略图失败: ${err.message}`);
      throw new BadRequestException('生成缩略图失败');
    }
  }

  /**
   * 压缩图片
   * @param buffer 原始图片 Buffer
   * @param options 压缩选项
   * @returns 处理结果
   */
  async compressImage(
    buffer: Buffer,
    options: CompressImageDto,
  ): Promise<ProcessResult> {
    try {
      let pipeline = sharp(buffer);

      // 调整尺寸
      if (options.maxWidth || options.maxHeight) {
        pipeline = pipeline.resize({
          width: options.maxWidth,
          height: options.maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // 获取原始格式
      const metadata = await sharp(buffer).metadata();
      const originalFormat = metadata.format || 'jpeg';
      const convertToWebP = options.convertToWebP !== false; // 默认为true
      
      // 确定输出格式
      // 对于PNG、GIF等格式，如果启用了convertToWebP，则转换为WebP以获得更好的压缩效果
      // WebP支持透明通道，可以替代PNG
      let outputFormat: string;
      if (convertToWebP && (originalFormat === 'png' || originalFormat === 'gif' || originalFormat === 'tiff')) {
        outputFormat = 'webp';
        this.logger.log(`将 ${originalFormat.toUpperCase()} 转换为 WebP 以获得更好的压缩效果`);
      } else {
        outputFormat = originalFormat;
      }

      // 根据输出格式压缩
      switch (outputFormat) {
        case 'jpeg':
          pipeline = pipeline.jpeg({
            quality: options.quality,
            progressive: true,
            mozjpeg: true,
          });
          break;
        case 'png':
          pipeline = pipeline.png({
            quality: options.quality,
            progressive: true,
            compressionLevel: 9,
          });
          break;
        case 'webp':
          pipeline = pipeline.webp({ 
            quality: options.quality,
            // 如果原图有透明通道，保持透明
            alphaQuality: options.quality,
          });
          break;
        default:
          // 其他格式转换为 WebP
          pipeline = pipeline.webp({ quality: options.quality });
          outputFormat = 'webp';
          break;
      }

      const resultBuffer = await pipeline.toBuffer();
      const resultMetadata = await sharp(resultBuffer).metadata();

      this.logger.log(
        `图片压缩完成: ${originalFormat} -> ${outputFormat}, 原始大小: ${buffer.length}, 压缩后: ${resultBuffer.length}, 压缩率: ${Math.round((1 - resultBuffer.length / buffer.length) * 100)}%`
      );

      return {
        buffer: resultBuffer,
        format: outputFormat as ImageFormat,
        width: resultMetadata.width || 0,
        height: resultMetadata.height || 0,
        size: resultBuffer.length,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`压缩图片失败: ${err.message}`);
      throw new BadRequestException('图片压缩失败');
    }
  }

  /**
   * 转换图片格式
   * @param buffer 原始图片 Buffer
   * @param targetFormat 目标格式
   * @param quality 质量
   * @returns 处理结果
   */
  async convertFormat(
    buffer: Buffer,
    targetFormat: ImageFormat,
    quality?: number,
  ): Promise<ProcessResult> {
    try {
      let pipeline = sharp(buffer);

      switch (targetFormat) {
        case ImageFormat.JPEG:
          pipeline = pipeline.jpeg({ quality, progressive: true });
          break;
        case ImageFormat.PNG:
          pipeline = pipeline.png({ quality, progressive: true });
          break;
        case ImageFormat.WEBP:
          pipeline = pipeline.webp({ quality });
          break;
        case ImageFormat.AVIF:
          pipeline = pipeline.avif({ quality });
          break;
        default:
          throw new BadRequestException(`不支持的格式: ${targetFormat}`);
      }

      const resultBuffer = await pipeline.toBuffer();
      const metadata = await sharp(resultBuffer).metadata();

      return {
        buffer: resultBuffer,
        format: targetFormat,
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: resultBuffer.length,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`转换格式失败: ${err.message}`);
      throw new BadRequestException('格式转换失败');
    }
  }

  /**
   * 生成多尺寸缩略图
   * @param buffer 原始图片 Buffer
   * @returns 各尺寸缩略图
   */
  async generateMultipleThumbnails(
    buffer: Buffer,
  ): Promise<Record<string, ProcessResult>> {
    const results: Partial<Record<ThumbnailSize, ProcessResult>> = {};

    for (const size of Object.values(ThumbnailSize)) {
      results[size] = await this.generateThumbnail(buffer, {
        size,
        quality: 80,
      });
    }

    return results as Record<ThumbnailSize, ProcessResult>;
  }

  /**
   * 获取图片格式
   * @param buffer 图片 Buffer
   * @returns 图片格式
   */
  private async getImageFormat(buffer: Buffer): Promise<ImageFormat> {
    const metadata = await sharp(buffer).metadata();
    const format = metadata.format || 'jpeg';

    switch (format) {
      case 'jpeg':
        return ImageFormat.JPEG;
      case 'png':
        return ImageFormat.PNG;
      case 'webp':
        return ImageFormat.WEBP;
      case 'avif':
        return ImageFormat.AVIF;
      case 'gif':
        return ImageFormat.GIF;
      default:
        return ImageFormat.JPEG;
    }
  }
}

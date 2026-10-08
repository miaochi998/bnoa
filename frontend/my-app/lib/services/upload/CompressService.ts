/**
 * CompressService - 图片压缩服务
 * @module lib/services/upload/CompressService
 * 
 * 功能：
 * - 图片质量压缩
 * - 图片尺寸缩放
 * - 格式转换
 * 
 * 使用场景：
 * - 上传前自动压缩图片
 * - 节省存储空间和带宽
 */

/**
 * 压缩配置
 */
export interface CompressConfig {
  /** 压缩质量 (0-1)，默认0.6 */
  quality?: number;
  /** 最大宽度，默认1920 */
  maxWidth?: number;
  /** 最大高度，默认1080 */
  maxHeight?: number;
  /** 输出格式，默认'image/jpeg' */
  mimeType?: string;
  /** 压缩阈值（字节），小于此值不压缩，默认100KB */
  threshold?: number;
  /** 是否保持宽高比，默认true */
  keepAspectRatio?: boolean;
}

/**
 * 压缩结果
 */
export interface CompressResult {
  /** 压缩后的文件 */
  file: File;
  /** 原始大小（字节） */
  originalSize: number;
  /** 压缩后大小（字节） */
  compressedSize: number;
  /** 压缩比例 */
  ratio: number;
  /** 是否进行了压缩 */
  compressed: boolean;
}

/**
 * CompressService类 - 图片压缩服务
 */
export class CompressService {
  /** 默认压缩质量 */
  private readonly defaultQuality = 0.6;
  /** 默认最大宽度 */
  private readonly defaultMaxWidth = 1920;
  /** 默认最大高度 */
  private readonly defaultMaxHeight = 1080;
  /** 默认压缩阈值：100KB */
  private readonly defaultThreshold = 100 * 1024;

  /**
   * 压缩图片
   * @param file - 原始图片文件
   * @param config - 压缩配置
   * @returns 压缩后的文件
   */
  async compressImage(file: File, config?: CompressConfig): Promise<File> {
    const result = await this.compressImageWithResult(file, config);
    return result.file;
  }

  /**
   * 压缩图片并返回详细结果
   * @param file - 原始图片文件
   * @param config - 压缩配置
   * @returns 压缩结果
   */
  async compressImageWithResult(
    file: File,
    config?: CompressConfig
  ): Promise<CompressResult> {
    const {
      quality = this.defaultQuality,
      maxWidth = this.defaultMaxWidth,
      maxHeight = this.defaultMaxHeight,
      mimeType = 'image/jpeg',
      threshold = this.defaultThreshold,
      keepAspectRatio = true,
    } = config || {};

    const originalSize = file.size;

    // 检查是否需要压缩
    if (!this.shouldCompress(file, threshold)) {
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        compressed: false,
      };
    }

    // 检查是否为图片
    if (!this.isImageFile(file)) {
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        compressed: false,
      };
    }

    try {
      // 加载图片
      const image = await this.loadImage(file);
      
      // 计算目标尺寸
      const { width, height } = this.calculateDimensions(
        image.width,
        image.height,
        maxWidth,
        maxHeight,
        keepAspectRatio
      );

      // 创建Canvas并绘制
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建Canvas上下文');
      }

      // 绘制图片
      ctx.drawImage(image, 0, 0, width, height);

      // 转换为Blob
      const blob = await this.canvasToBlob(canvas, mimeType, quality);
      
      // 创建新文件
      const compressedFile = new File(
        [blob],
        this.getCompressedFileName(file.name, mimeType),
        { type: mimeType }
      );

      const compressedSize = compressedFile.size;

      // 如果压缩后更大，返回原文件
      if (compressedSize >= originalSize) {
        return {
          file,
          originalSize,
          compressedSize: originalSize,
          ratio: 1,
          compressed: false,
        };
      }

      return {
        file: compressedFile,
        originalSize,
        compressedSize,
        ratio: compressedSize / originalSize,
        compressed: true,
      };
    } catch (error) {
      console.error('图片压缩失败:', error);
      // 压缩失败时返回原文件
      return {
        file,
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        compressed: false,
      };
    }
  }

  /**
   * 判断是否需要压缩
   * @param file - 文件对象
   * @param threshold - 阈值（字节）
   * @returns 是否需要压缩
   */
  shouldCompress(file: File, threshold?: number): boolean {
    const t = threshold ?? this.defaultThreshold;
    return file.size > t && this.isImageFile(file);
  }

  /**
   * 判断是否为图片文件
   * @param file - 文件对象
   * @returns 是否为图片
   */
  isImageFile(file: File): boolean {
    const imageTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/bmp',
    ];
    return imageTypes.includes(file.type.toLowerCase());
  }

  /**
   * 判断是否为可压缩的图片格式
   * @param mimeType - MIME类型
   * @returns 是否可压缩
   */
  isCompressibleImage(mimeType: string): boolean {
    const compressibleTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/bmp',
    ];
    return compressibleTypes.includes(mimeType.toLowerCase());
  }

  /**
   * 加载图片
   */
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('加载图片失败'));
      };

      img.src = url;
    });
  }

  /**
   * 计算目标尺寸
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number,
    keepAspectRatio: boolean
  ): { width: number; height: number } {
    if (!keepAspectRatio) {
      return {
        width: Math.min(originalWidth, maxWidth),
        height: Math.min(originalHeight, maxHeight),
      };
    }

    let width = originalWidth;
    let height = originalHeight;

    // 如果宽度超过最大值
    if (width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }

    // 如果高度超过最大值
    if (height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }

    return { width, height };
  }

  /**
   * Canvas转Blob
   */
  private canvasToBlob(
    canvas: HTMLCanvasElement,
    mimeType: string,
    quality: number
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas转Blob失败'));
          }
        },
        mimeType,
        quality
      );
    });
  }

  /**
   * 获取压缩后的文件名
   */
  private getCompressedFileName(originalName: string, mimeType: string): string {
    const lastDotIndex = originalName.lastIndexOf('.');
    const baseName = lastDotIndex > 0 ? originalName.slice(0, lastDotIndex) : originalName;
    
    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    
    const ext = extMap[mimeType] || '.jpg';
    return baseName + ext;
  }
}

// 单例导出
export const compressService = new CompressService();

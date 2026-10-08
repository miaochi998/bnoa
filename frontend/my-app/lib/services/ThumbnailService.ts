import { apiClient } from '@/lib/api';

/**
 * ThumbnailService - 缩略图生成服务
 * 使用Canvas API在前端生成图片和视频缩略图
 * 复刻自7DL项目，不依赖FFmpeg，性能优秀
 */

/**
 * 缩略图配置接口
 */
interface ThumbnailConfig {
  width: number;
  height: number;
  quality: number;
}

/**
 * 生成缩略图选项
 */
export interface GenerateThumbnailOptions {
  /** 缩略图宽度，默认从配置读取 */
  width?: number;
  /** 缩略图高度，默认从配置读取 */
  height?: number;
  /** 图片质量 (0-1)，默认从配置读取 */
  quality?: number;
  /** 输出格式，默认'image/jpeg' */
  mimeType?: string;
}

/**
 * 视频缩略图选项
 */
export interface GenerateVideoThumbnailOptions {
  /** 缩略图宽度，默认从配置读取 */
  width?: number;
  /** 缩略图高度，默认从配置读取 */
  height?: number;
  /** 图片质量 (0-1)，默认从配置读取 */
  quality?: number;
  /** 捕获时间点（秒），默认0（第一帧） */
  seekTime?: number;
}

/**
 * ThumbnailService类
 * 提供缩略图生成功能，从系统配置中读取缩略图参数
 */
export class ThumbnailService {
  // 默认配置（当无法从API获取时使用）
  private defaultConfig: ThumbnailConfig = {
    width: 200,
    height: 200,
    quality: 80,
  };

  // 缓存的配置
  private cachedConfig: ThumbnailConfig | null = null;
  private configFetchPromise: Promise<ThumbnailConfig> | null = null;

  /**
   * 获取缩略图配置（带缓存）
   */
  private async getConfig(): Promise<ThumbnailConfig> {
    // 如果有缓存，直接返回
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    // 如果正在获取，等待获取完成
    if (this.configFetchPromise) {
      return this.configFetchPromise;
    }

    // 开始获取配置
    this.configFetchPromise = (async () => {
      try {
        const config = await apiClient.getThumbnailSettings();
        this.cachedConfig = config;
        return config;
      } catch (error) {
        console.warn('[ThumbnailService] 获取缩略图配置失败，使用默认配置:', error);
        return this.defaultConfig;
      } finally {
        this.configFetchPromise = null;
      }
    })();

    return this.configFetchPromise;
  }

  /**
   * 清除配置缓存（配置更新后调用）
   */
  clearConfigCache(): void {
    this.cachedConfig = null;
  }

  // 兼容旧代码的属性访问器
  private get defaultWidth(): number {
    return this.cachedConfig?.width ?? this.defaultConfig.width;
  }

  private get defaultHeight(): number {
    return this.cachedConfig?.height ?? this.defaultConfig.height;
  }

  private get defaultQuality(): number {
    return (this.cachedConfig?.quality ?? this.defaultConfig.quality) / 100;
  }

  /**
   * 生成图片缩略图（等比例缩放，不裁剪）
   * @param file - 图片文件
   * @param options - 生成选项
   * @returns 缩略图BlobURL
   */
  async generateThumbnail(
    file: File | Blob,
    options?: GenerateThumbnailOptions
  ): Promise<string> {
    // 先获取配置
    const config = await this.getConfig();
    const maxWidth = options?.width ?? config.width;
    const maxHeight = options?.height ?? config.height;
    const quality = options?.quality ?? (config.quality / 100);
    const mimeType = options?.mimeType ?? 'image/jpeg';

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();

        img.onload = () => {
          try {
            // 计算等比例缩放后的尺寸
            let targetWidth: number;
            let targetHeight: number;

            if (img.width >= img.height) {
              // 横向图片：宽度固定，高度等比例缩放
              targetWidth = maxWidth;
              targetHeight = Math.round((img.height / img.width) * maxWidth);
            } else {
              // 纵向图片：高度固定，宽度等比例缩放
              targetHeight = maxHeight;
              targetWidth = Math.round((img.width / img.height) * maxHeight);
            }

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('无法获取Canvas上下文'));
              return;
            }

            // 绘制缩略图（等比例缩放）
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            // 转换为Blob URL
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const url = URL.createObjectURL(blob);
                  resolve(url);
                } else {
                  reject(new Error('生成Blob失败'));
                }
              },
              mimeType,
              quality
            );
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => {
          reject(new Error('图片加载失败'));
        };

        img.src = e.target?.result as string;
      };

      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * 生成视频缩略图（等比例缩放，返回Blob URL）
   * @param file - 视频文件
   * @param options - 生成选项
   * @returns 缩略图BlobURL
   */
  async generateVideoThumbnail(
    file: File | Blob,
    options?: GenerateVideoThumbnailOptions
  ): Promise<string> {
    // 先获取配置
    const config = await this.getConfig();
    const maxWidth = options?.width ?? config.width;
    const maxHeight = options?.height ?? config.height;
    const quality = options?.quality ?? (config.quality / 100);
    const seekTime = options?.seekTime ?? 0;

    return new Promise<string>((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('无法获取Canvas上下文'));
        return;
      }

      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;

      let hasDrawn = false;

      const drawFrame = () => {
        if (hasDrawn) return;
        hasDrawn = true;

        // 计算等比例缩放后的尺寸
        let targetWidth: number;
        let targetHeight: number;

        if (video.videoWidth >= video.videoHeight) {
          // 横向视频：宽度固定，高度等比例缩放
          targetWidth = maxWidth;
          targetHeight = Math.round((video.videoHeight / video.videoWidth) * maxWidth);
        } else {
          // 纵向视频：高度固定，宽度等比例缩放
          targetHeight = maxHeight;
          targetWidth = Math.round((video.videoWidth / video.videoHeight) * maxHeight);
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              resolve(url);
            } else {
              reject(new Error('生成Blob失败'));
            }

            // 清理
            URL.revokeObjectURL(video.src);
            video.src = '';
          },
          'image/jpeg',
          quality
        );
      };

      video.onloadeddata = () => {
        if (seekTime > 0) {
          video.currentTime = seekTime;
        } else {
          drawFrame();
        }
      };

      video.onseeked = () => {
        if (!hasDrawn) {
          drawFrame();
        }
      };

      video.onerror = () => {
        reject(new Error('视频加载失败'));
      };

      if (file instanceof Blob) {
        video.src = URL.createObjectURL(file);
        video.load();
      } else {
        reject(new Error('无效的文件类型'));
      }
    });
  }

  /**
   * 生成视频缩略图并返回 Blob 对象（等比例缩放，用于后续上传到服务器）
   * @param file - 视频文件
   * @param options - 生成选项
   * @returns 缩略图 Blob 对象
   */
  async generateVideoThumbnailAsBlob(
    file: File | Blob,
    options?: GenerateVideoThumbnailOptions
  ): Promise<Blob> {
    // 先获取配置
    const config = await this.getConfig();
    const maxWidth = options?.width ?? config.width;
    const maxHeight = options?.height ?? config.height;
    const quality = options?.quality ?? (config.quality / 100);
    const seekTime = options?.seekTime ?? 0;

    return new Promise<Blob>((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('无法获取Canvas上下文'));
        return;
      }

      // 添加超时处理（10秒）
      const timeout = setTimeout(() => {
        console.error('[ThumbnailService] 视频缩略图生成超时');
        URL.revokeObjectURL(video.src);
        video.src = '';
        reject(new Error('视频缩略图生成超时（10秒）'));
      }, 10000);

      video.preload = 'auto';
      video.muted = true;
      video.playsInline = true;

      let hasDrawn = false;

      const drawFrame = () => {
        if (hasDrawn) return;
        hasDrawn = true;
        clearTimeout(timeout);

        console.log('[ThumbnailService] 开始绘制视频帧, 视频尺寸:', video.videoWidth, 'x', video.videoHeight);

        // 计算等比例缩放后的尺寸
        let targetWidth: number;
        let targetHeight: number;

        if (video.videoWidth >= video.videoHeight) {
          // 横向视频：宽度固定，高度等比例缩放
          targetWidth = maxWidth;
          targetHeight = Math.round((video.videoHeight / video.videoWidth) * maxWidth);
        } else {
          // 纵向视频：高度固定，宽度等比例缩放
          targetHeight = maxHeight;
          targetWidth = Math.round((video.videoWidth / video.videoHeight) * maxHeight);
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('[ThumbnailService] 视频缩略图 Blob 生成成功:', blob.size, 'bytes, 尺寸:', targetWidth, 'x', targetHeight);
              resolve(blob);
            } else {
              console.error('[ThumbnailService] canvas.toBlob 返回 null');
              reject(new Error('生成Blob失败'));
            }

            // 清理
            URL.revokeObjectURL(video.src);
            video.src = '';
          },
          'image/jpeg',
          quality
        );
      };

      video.onloadeddata = () => {
        console.log('[ThumbnailService] 视频数据加载完成, seekTime:', seekTime);
        if (seekTime > 0) {
          video.currentTime = seekTime;
        } else {
          drawFrame();
        }
      };

      video.onseeked = () => {
        console.log('[ThumbnailService] 视频 seek 完成');
        if (!hasDrawn) {
          drawFrame();
        }
      };

      video.onerror = (e) => {
        clearTimeout(timeout);
        console.error('[ThumbnailService] 视频加载失败:', e);
        reject(new Error('视频加载失败'));
      };

      if (file instanceof Blob) {
        const blobUrl = URL.createObjectURL(file);
        console.log('[ThumbnailService] 创建视频 Blob URL');
        video.src = blobUrl;
        video.load();
      } else {
        clearTimeout(timeout);
        reject(new Error('无效的文件类型'));
      }
    });
  }

  /**
   * 判断文件是否为图片
   */
  isImage(file: File | Blob): boolean {
    return file.type.startsWith('image/');
  }

  /**
   * 判断文件是否为视频
   */
  isVideo(file: File | Blob): boolean {
    return file.type.startsWith('video/');
  }

  /**
   * 自动生成缩略图（根据文件类型自动选择方法）
   * @param file - 文件对象
   * @param options - 生成选项
   * @returns 缩略图Blob URL
   */
  async generateAuto(
    file: File | Blob,
    options?: GenerateThumbnailOptions
  ): Promise<string> {
    if (this.isImage(file)) {
      return this.generateThumbnail(file, options);
    } else if (this.isVideo(file)) {
      return this.generateVideoThumbnail(file, options);
    } else {
      throw new Error('不支持的文件类型');
    }
  }
}

/**
 * 导出ThumbnailService单例
 */
export const thumbnailService = new ThumbnailService();

export default thumbnailService;

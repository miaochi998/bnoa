/**
 * UploadOrchestrator - 上传编排器
 * @module lib/services/upload/UploadOrchestrator
 * 
 * 功能：
 * - 统一上传接口
 * - 编排MD5计算、秒传检查、分片上传等流程
 * - 支持本地/S3双模式
 * - 支持图片压缩
 * 
 * 使用场景：
 * - 所有上传场景的统一入口
 */

import { getApiBaseUrl } from '@/lib/config';
import { md5Service } from './MD5Service';
import { secureCheckService } from './SecureCheckService';
import { sessionService, type StorageMode } from './SessionService';
import { chunkUploadService } from './ChunkUploadService';
import { s3UploadService } from './S3UploadService';
import { compressService, type CompressConfig } from './CompressService';
import { UPLOAD_CONSTANTS, UPLOAD_STAGE, type UploadStage } from '../../utils/upload';

/**
 * 上传配置
 */
export interface UploadConfig {
  /** 文件对象 */
  file: File;
  /** 目标文件夹ID */
  folderId?: string;
  /** 存储模式 */
  storageMode?: StorageMode;
  /** 是否压缩图片 */
  compress?: boolean;
  /** 压缩配置 */
  compressConfig?: CompressConfig;
  /** 进度回调 */
  onProgress?: (progress: UploadProgress) => void;
  /** 是否应该中止 */
  shouldAbort?: () => boolean;
}

/**
 * 上传进度
 */
export interface UploadProgress {
  /** 已上传字节数 */
  loaded: number;
  /** 总字节数 */
  total: number;
  /** 进度百分比 (0-100) */
  percentage: number;
  /** 当前阶段 */
  stage: UploadStage;
  /** 阶段提示文字 */
  stageHint: string;
  /** 上传速度（字节/秒） */
  speed?: number;
  /** 剩余时间（秒） */
  remainingTime?: number;
}

/**
 * 上传结果
 */
export interface UploadResult {
  /** 是否成功 */
  success: boolean;
  /** 文件URL */
  fileUrl?: string;
  /** 文件ID */
  fileId?: string;
  /** 文件MD5 */
  fileMd5?: string;
  /** 是否秒传 */
  isInstant?: boolean;
  /** 是否压缩 */
  isCompressed?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 阶段提示文字映射
 */
const STAGE_HINTS: Record<UploadStage, string> = {
  [UPLOAD_STAGE.MD5]: '计算文件指纹...',
  [UPLOAD_STAGE.CHECKING]: '检查文件...',
  [UPLOAD_STAGE.COMPRESSING]: '压缩图片...',
  [UPLOAD_STAGE.UPLOADING]: '上传中...',
  [UPLOAD_STAGE.MERGING]: '合并文件...',
  [UPLOAD_STAGE.COMPLETED]: '上传完成',
};

/**
 * UploadOrchestrator类 - 上传编排器
 */
export class UploadOrchestrator {
  /**
   * 上传文件（自动选择模式）
   * @param config - 上传配置
   * @returns 上传结果
   */
  async uploadFile(config: UploadConfig): Promise<UploadResult> {
    const storageMode = config.storageMode || 'rustfs';
    
    if (storageMode === 'rustfs') {
      return this.uploadFileS3(config);
    } else {
      return this.uploadFileLocal(config);
    }
  }

  /**
   * 上传文件（本地模式）
   * 流程：MD5 → 秒传检查 → 压缩 → 初始化会话 → 分片上传 → 合并
   */
  async uploadFileLocal(config: UploadConfig): Promise<UploadResult> {
    const {
      file,
      folderId,
      compress = false,
      compressConfig,
      onProgress,
      shouldAbort,
    } = config;

    let currentFile = file;
    let isCompressed = false;

    try {
      // 检查是否中止
      if (shouldAbort?.()) {
        return { success: false, error: '上传已取消' };
      }

      // 阶段1：计算MD5
      this.reportProgress(onProgress, UPLOAD_STAGE.MD5, 0, file.size);
      
      const md5Result = await md5Service.calculateFileMD5(file, {
        onProgress: (percentage) => {
          this.reportProgress(onProgress, UPLOAD_STAGE.MD5, 
            Math.round(file.size * percentage / 100), file.size);
        },
      });

      if (shouldAbort?.()) {
        return { success: false, error: '上传已取消' };
      }

      // 阶段2：秒传检查
      this.reportProgress(onProgress, UPLOAD_STAGE.CHECKING, 0, file.size);
      
      const checkResult = await secureCheckService.checkFileExists({
        fileMd5: md5Result.md5,
        fileSize: file.size,
        folderId,
        mimeType: file.type,
        fileName: file.name,
      });

      if (checkResult.exists) {
        this.reportProgress(onProgress, UPLOAD_STAGE.COMPLETED, file.size, file.size);
        return {
          success: true,
          fileUrl: checkResult.fileUrl,
          fileId: checkResult.fileId,
          fileMd5: md5Result.md5,
          isInstant: true,
        };
      }

      if (shouldAbort?.()) {
        return { success: false, error: '上传已取消' };
      }

      // 阶段3：压缩图片（可选）
      if (compress && compressService.isImageFile(file)) {
        this.reportProgress(onProgress, UPLOAD_STAGE.COMPRESSING, 0, file.size);
        
        const compressResult = await compressService.compressImageWithResult(
          file,
          compressConfig
        );
        
        if (compressResult.compressed) {
          currentFile = compressResult.file;
          isCompressed = true;
        }
      }

      if (shouldAbort?.()) {
        return { success: false, error: '上传已取消' };
      }

      // 判断是否需要分片上传
      const needsChunked = sessionService.needsChunkedUpload(
        currentFile.size,
        UPLOAD_CONSTANTS.SMALL_FILE_THRESHOLD
      );

      if (needsChunked) {
        // 大文件：分片上传
        return await this.uploadLargeFileLocal(
          currentFile,
          md5Result.md5,
          folderId,
          onProgress,
          shouldAbort,
          isCompressed
        );
      } else {
        // 小文件：直接上传
        return await this.uploadSmallFileLocal(
          currentFile,
          md5Result.md5,
          folderId,
          onProgress,
          isCompressed
        );
      }
    } catch (error) {
      console.error('上传失败:', error);
      return {
        success: false,
        error: (error as Error).message || '上传失败',
      };
    }
  }

  /**
   * 上传大文件（本地模式，分片）
   */
  private async uploadLargeFileLocal(
    file: File,
    fileMd5: string,
    folderId: string | undefined,
    onProgress: ((progress: UploadProgress) => void) | undefined,
    shouldAbort: (() => boolean) | undefined,
    isCompressed: boolean
  ): Promise<UploadResult> {
    // 初始化会话
    const sessionResult = await sessionService.initSession({
      fileName: file.name,
      fileSize: file.size,
      fileMd5,
      mimeType: file.type,
      folderId,
      storageMode: 'local',
    });

    // 秒传检查（会话初始化时也会检查）
    if (sessionResult.exists) {
      this.reportProgress(onProgress, UPLOAD_STAGE.COMPLETED, file.size, file.size);
      return {
        success: true,
        fileUrl: sessionResult.fileUrl,
        fileId: sessionResult.fileId,
        fileMd5,
        isInstant: true,
      };
    }

    // 分片上传
    this.reportProgress(onProgress, UPLOAD_STAGE.UPLOADING, 0, file.size);

    await chunkUploadService.uploadFile({
      file,
      sessionId: sessionResult.sessionId,
      chunkSize: sessionResult.chunkSize,
      uploadedChunks: sessionResult.uploadedChunks,
      onProgress: (progress) => {
        if (onProgress) {
          onProgress({
            loaded: progress.loaded,
            total: progress.total,
            percentage: progress.percentage,
            stage: UPLOAD_STAGE.UPLOADING,
            stageHint: STAGE_HINTS[UPLOAD_STAGE.UPLOADING],
            speed: progress.speed,
            remainingTime: progress.remainingTime,
          });
        }
      },
      shouldAbort,
    });

    // 合并文件
    this.reportProgress(onProgress, UPLOAD_STAGE.MERGING, file.size, file.size);

    const completeResult = await chunkUploadService.completeUpload(
      sessionResult.sessionId
    );

    this.reportProgress(onProgress, UPLOAD_STAGE.COMPLETED, file.size, file.size);

    return {
      success: true,
      fileUrl: completeResult.fileUrl,
      fileId: completeResult.fileId,
      fileMd5,
      isInstant: false,
      isCompressed,
    };
  }

  /**
   * 上传小文件（本地模式，直接上传）
   */
  private async uploadSmallFileLocal(
    file: File,
    fileMd5: string,
    folderId: string | undefined,
    onProgress: ((progress: UploadProgress) => void) | undefined,
    isCompressed: boolean
  ): Promise<UploadResult> {
    this.reportProgress(onProgress, UPLOAD_STAGE.UPLOADING, 0, file.size);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileMd5', fileMd5);
    if (folderId) {
      formData.append('folderId', folderId);
    }
    formData.append('storageMode', 'local');

    const API_BASE_URL = getApiBaseUrl();
    
    const response = await fetch(`${API_BASE_URL}/upload/single`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `上传失败: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(data.message || '上传失败');
    }

    this.reportProgress(onProgress, UPLOAD_STAGE.COMPLETED, file.size, file.size);

    return {
      success: true,
      fileUrl: data.data.fileUrl,
      fileId: data.data.fileId,
      fileMd5,
      isInstant: false,
      isCompressed,
    };
  }

  /**
   * 上传文件（S3模式）
   * 流程：MD5 → 秒传检查 → 压缩 → S3直传
   */
  async uploadFileS3(config: UploadConfig): Promise<UploadResult> {
    const {
      file,
      folderId,
      compress = false,
      compressConfig,
      onProgress,
      shouldAbort,
    } = config;

    let currentFile = file;
    let isCompressed = false;

    try {
      // 检查是否中止
      if (shouldAbort?.()) {
        return { success: false, error: '上传已取消' };
      }

      // 阶段1：计算MD5
      this.reportProgress(onProgress, UPLOAD_STAGE.MD5, 0, file.size);
      
      const md5Result = await md5Service.calculateFileMD5(file, {
        onProgress: (percentage) => {
          this.reportProgress(onProgress, UPLOAD_STAGE.MD5, 
            Math.round(file.size * percentage / 100), file.size);
        },
      });

      if (shouldAbort?.()) {
        return { success: false, error: '上传已取消' };
      }

      // 阶段2：秒传检查
      this.reportProgress(onProgress, UPLOAD_STAGE.CHECKING, 0, file.size);
      
      const checkResult = await secureCheckService.checkFileExists({
        fileMd5: md5Result.md5,
        fileSize: file.size,
        folderId,
        mimeType: file.type,
        fileName: file.name,
      });

      if (checkResult.exists) {
        this.reportProgress(onProgress, UPLOAD_STAGE.COMPLETED, file.size, file.size);
        return {
          success: true,
          fileUrl: checkResult.fileUrl,
          fileId: checkResult.fileId,
          fileMd5: md5Result.md5,
          isInstant: true,
        };
      }

      if (shouldAbort?.()) {
        return { success: false, error: '上传已取消' };
      }

      // 阶段3：压缩图片（可选）
      if (compress && compressService.isImageFile(file)) {
        this.reportProgress(onProgress, UPLOAD_STAGE.COMPRESSING, 0, file.size);
        
        const compressResult = await compressService.compressImageWithResult(
          file,
          compressConfig
        );
        
        if (compressResult.compressed) {
          currentFile = compressResult.file;
          isCompressed = true;
        }
      }

      if (shouldAbort?.()) {
        return { success: false, error: '上传已取消' };
      }

      // 阶段4：S3上传
      this.reportProgress(onProgress, UPLOAD_STAGE.UPLOADING, 0, currentFile.size);

      const s3Result = await s3UploadService.uploadFile({
        file: currentFile,
        folderId,
        fileMd5: md5Result.md5,
        onProgress: (progress) => {
          if (onProgress) {
            onProgress({
              loaded: progress.loaded,
              total: progress.total,
              percentage: progress.percentage,
              stage: UPLOAD_STAGE.UPLOADING,
              stageHint: STAGE_HINTS[UPLOAD_STAGE.UPLOADING],
            });
          }
        },
      });

      this.reportProgress(onProgress, UPLOAD_STAGE.COMPLETED, currentFile.size, currentFile.size);

      return {
        success: true,
        fileUrl: s3Result.fileUrl,
        fileId: s3Result.fileId,
        fileMd5: md5Result.md5,
        isInstant: false,
        isCompressed,
      };
    } catch (error) {
      console.error('S3上传失败:', error);
      return {
        success: false,
        error: (error as Error).message || 'S3上传失败',
      };
    }
  }

  /**
   * 批量上传文件
   * @param files - 文件列表
   * @param config - 通用配置
   * @param onFileProgress - 单文件进度回调
   * @returns 上传结果列表
   */
  async uploadFiles(
    files: File[],
    config: Omit<UploadConfig, 'file'>,
    onFileProgress?: (fileName: string, progress: UploadProgress) => void
  ): Promise<Map<string, UploadResult>> {
    const results = new Map<string, UploadResult>();

    for (const file of files) {
      const result = await this.uploadFile({
        ...config,
        file,
        onProgress: onFileProgress 
          ? (progress) => onFileProgress(file.name, progress)
          : undefined,
      });

      results.set(file.name, result);
    }

    return results;
  }

  /**
   * 报告进度
   */
  private reportProgress(
    onProgress: ((progress: UploadProgress) => void) | undefined,
    stage: UploadStage,
    loaded: number,
    total: number
  ): void {
    if (onProgress) {
      onProgress({
        loaded,
        total,
        percentage: total > 0 ? Math.round((loaded / total) * 100) : 0,
        stage,
        stageHint: STAGE_HINTS[stage],
      });
    }
  }
}

// 单例导出
export const uploadOrchestrator = new UploadOrchestrator();

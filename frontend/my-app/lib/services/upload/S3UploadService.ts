/**
 * S3UploadService - S3直传服务
 * @module lib/services/upload/S3UploadService
 * 
 * 功能：
 * - 初始化Multipart Upload
 * - 获取预签名URL
 * - 并发上传分片（3个worker）
 * - 自动重试（最多3次）
 * - 完成/取消上传
 * 
 * 使用场景：
 * - RustFS模式大文件上传
 */

import { getApiBaseUrl } from '@/lib/config';
import { getAuthHeaders } from '../../utils/upload';

const API_BASE_URL = getApiBaseUrl();

/**
 * S3上传配置
 */
export interface S3UploadConfig {
  /** 文件对象 */
  file: File;
  /** 目标文件夹ID */
  folderId?: string;
  /** 文件MD5 */
  fileMd5?: string;
  /** 进度回调 */
  onProgress?: (progress: S3Progress) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * S3上传进度
 */
export interface S3Progress {
  /** 已上传字节数 */
  loaded: number;
  /** 总字节数 */
  total: number;
  /** 进度百分比 (0-100) */
  percentage: number;
  /** 已上传分片数 */
  uploadedParts: number;
  /** 总分片数 */
  totalParts: number;
}

/**
 * S3上传结果
 */
export interface S3UploadResult {
  /** 文件URL */
  fileUrl: string;
  /** 文件ID */
  fileId: string;
  /** 会话ID */
  sessionId: string;
}

/**
 * 预签名URL信息
 */
interface PresignedUrl {
  partNumber: number;
  url: string;
  expiresAt: string;
}

/**
 * 上传分片结果
 */
interface UploadedPart {
  partNumber: number;
  etag: string;
}

/**
 * 上传状态
 */
interface UploadState {
  sessionId: string;
  uploadId: string;
  bucket: string;
  key: string;
  partSize: number;
  partCount: number;
  isPaused: boolean;
  isCancelled: boolean;
  uploadedParts: UploadedPart[];
}

/**
 * S3UploadService类 - S3直传服务
 */
export class S3UploadService {
  /** 分片大小：5MB */
  private readonly chunkSize = 5 * 1024 * 1024;
  /** 最大并发数 */
  private readonly maxConcurrency = 3;
  /** 最大重试次数 */
  private readonly maxRetries = 3;
  /** 重试延迟（毫秒） */
  private readonly retryDelay = 1000;
  
  /** 上传状态映射 */
  private uploadStates: Map<string, UploadState> = new Map();

  /**
   * 上传文件到S3
   * @param config - 上传配置
   * @returns 上传结果
   */
  async uploadFile(config: S3UploadConfig): Promise<S3UploadResult> {
    const { file, folderId, fileMd5, onProgress, onError } = config;

    try {
      // 1. 初始化Multipart Upload
      const initResult = await this.initMultipartUpload({
        fileName: file.name,
        fileSize: file.size,
        fileMd5: fileMd5 || '',
        mimeType: file.type,
        folderId,
      });

      const state: UploadState = {
        sessionId: initResult.sessionId,
        uploadId: initResult.uploadId,
        bucket: initResult.bucket,
        key: initResult.key,
        partSize: initResult.partSize,
        partCount: initResult.partCount,
        isPaused: false,
        isCancelled: false,
        uploadedParts: [],
      };

      this.uploadStates.set(initResult.sessionId, state);

      // 2. 并发上传分片
      await this.uploadParts(file, state, onProgress);

      // 3. 完成上传
      const result = await this.completeMultipartUpload(
        state.sessionId,
        state.uploadedParts
      );

      // 清理状态
      this.uploadStates.delete(state.sessionId);

      return result;
    } catch (error) {
      if (onError) {
        onError(error as Error);
      }
      throw error;
    }
  }

  /**
   * 初始化Multipart Upload
   */
  private async initMultipartUpload(params: {
    fileName: string;
    fileSize: number;
    fileMd5: string;
    mimeType: string;
    folderId?: string;
  }): Promise<{
    sessionId: string;
    uploadId: string;
    bucket: string;
    key: string;
    partSize: number;
    partCount: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/upload/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        fileName: params.fileName,
        fileSize: params.fileSize,
        fileMd5: params.fileMd5,
        fileExtension: params.fileName.split('.').pop() || '',
        mimeType: params.mimeType,
        folderId: params.folderId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `初始化S3上传失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message || '初始化S3上传失败');
    }

    return data.data;
  }

  /**
   * 获取预签名URL
   */
  private async getPresignedUrls(
    sessionId: string,
    partNumbers: number[]
  ): Promise<PresignedUrl[]> {
    const response = await fetch(`${API_BASE_URL}/upload/presigned-urls`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ sessionId, partNumbers }),
    });

    if (!response.ok) {
      throw new Error(`获取预签名URL失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message || '获取预签名URL失败');
    }

    return data.data.presignedUrls;
  }

  /**
   * 并发上传分片
   */
  private async uploadParts(
    file: File,
    state: UploadState,
    onProgress?: (progress: S3Progress) => void
  ): Promise<void> {
    const { partCount, partSize, sessionId } = state;
    const partNumbers = Array.from({ length: partCount }, (_, i) => i + 1);
    
    let uploadedCount = 0;
    let uploadedBytes = 0;

    // 分批获取预签名URL并上传
    const batchSize = this.maxConcurrency * 2;
    
    for (let i = 0; i < partNumbers.length; i += batchSize) {
      if (state.isCancelled) {
        throw new Error('上传已取消');
      }

      while (state.isPaused) {
        await this.delay(100);
        if (state.isCancelled) {
          throw new Error('上传已取消');
        }
      }

      const batch = partNumbers.slice(i, i + batchSize);
      const presignedUrls = await this.getPresignedUrls(sessionId, batch);

      // 并发上传当前批次
      const uploadPromises = presignedUrls.map(async (urlInfo) => {
        const partNumber = urlInfo.partNumber;
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const chunk = file.slice(start, end);

        const etag = await this.uploadPartWithRetry(urlInfo.url, chunk);
        
        state.uploadedParts.push({ partNumber, etag });
        uploadedCount++;
        uploadedBytes += chunk.size;

        if (onProgress) {
          onProgress({
            loaded: uploadedBytes,
            total: file.size,
            percentage: Math.round((uploadedBytes / file.size) * 100),
            uploadedParts: uploadedCount,
            totalParts: partCount,
          });
        }
      });

      // 控制并发数
      await this.runWithConcurrency(uploadPromises, this.maxConcurrency);
    }
  }

  /**
   * 上传单个分片（带重试）
   */
  private async uploadPartWithRetry(url: string, chunk: Blob): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await this.uploadPart(url, chunk);
      } catch (error) {
        lastError = error as Error;
        console.warn(`S3分片上传失败，尝试 ${attempt + 1}/${this.maxRetries}:`, error);
        
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('S3分片上传失败');
  }

  /**
   * 上传单个分片到S3
   */
  private async uploadPart(url: string, chunk: Blob): Promise<string> {
    const response = await fetch(url, {
      method: 'PUT',
      body: chunk,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`上传分片到S3失败: ${response.status}`);
    }

    const etag = response.headers.get('ETag');
    if (!etag) {
      throw new Error('S3响应缺少ETag');
    }

    return etag.replace(/"/g, '');
  }

  /**
   * 完成Multipart Upload
   */
  private async completeMultipartUpload(
    sessionId: string,
    parts: UploadedPart[]
  ): Promise<S3UploadResult> {
    // 按partNumber排序
    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);

    const response = await fetch(`${API_BASE_URL}/upload/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ sessionId, parts: sortedParts }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `完成S3上传失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message || '完成S3上传失败');
    }

    return {
      fileUrl: data.data.fileUrl,
      fileId: data.data.fileId,
      sessionId,
    };
  }

  /**
   * 取消上传
   * @param sessionId - 会话ID
   */
  async cancelUpload(sessionId: string): Promise<void> {
    const state = this.uploadStates.get(sessionId);
    if (state) {
      state.isCancelled = true;
    }

    try {
      await fetch(`${API_BASE_URL}/upload/abort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.error('取消S3上传失败:', error);
    }

    this.uploadStates.delete(sessionId);
  }

  /**
   * 暂停上传
   * @param sessionId - 会话ID
   */
  pauseUpload(sessionId: string): void {
    const state = this.uploadStates.get(sessionId);
    if (state) {
      state.isPaused = true;
    }
  }

  /**
   * 恢复上传
   * @param sessionId - 会话ID
   */
  resumeUpload(sessionId: string): void {
    const state = this.uploadStates.get(sessionId);
    if (state) {
      state.isPaused = false;
    }
  }

  /**
   * 控制并发执行
   */
  private async runWithConcurrency<T>(
    promises: Promise<T>[],
    concurrency: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const promise of promises) {
      const p = promise.then(result => {
        results.push(result);
      });

      executing.push(p);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex(e => e === p),
          1
        );
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 单例导出
export const s3UploadService = new S3UploadService();

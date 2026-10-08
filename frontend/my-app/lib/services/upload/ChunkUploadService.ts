/**
 * ChunkUploadService - 分片上传服务
 * @module lib/services/upload/ChunkUploadService
 * 
 * 功能：
 * - 文件分片
 * - 逐片上传
 * - 断点续传
 * - 进度回调
 * 
 * 使用场景：
 * - 本地模式大文件上传
 */

import { getApiBaseUrl } from '@/lib/config';
import { getAuthHeaders } from '../../utils/upload';
import { md5Service } from './MD5Service';

const API_BASE_URL = getApiBaseUrl();

/**
 * 分片上传配置
 */
export interface ChunkUploadConfig {
  /** 文件对象 */
  file: File;
  /** 会话ID */
  sessionId: string;
  /** 分片大小（字节） */
  chunkSize?: number;
  /** 已上传分片索引列表（断点续传） */
  uploadedChunks?: number[];
  /** 进度回调 */
  onProgress?: (progress: ChunkProgress) => void;
  /** 单个分片完成回调 */
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  /** 是否应该中止 */
  shouldAbort?: () => boolean;
}

/**
 * 分片上传进度
 */
export interface ChunkProgress {
  /** 已上传字节数 */
  loaded: number;
  /** 总字节数 */
  total: number;
  /** 进度百分比 (0-100) */
  percentage: number;
  /** 当前分片索引 */
  chunkIndex: number;
  /** 总分片数 */
  totalChunks: number;
  /** 上传速度（字节/秒） */
  speed: number;
  /** 剩余时间（秒） */
  remainingTime: number;
}

/**
 * 分片上传完成结果
 */
export interface ChunkUploadResult {
  /** 文件URL */
  fileUrl: string;
  /** 文件ID */
  fileId: string;
  /** 文件名 */
  fileName?: string;
  /** 文件大小 */
  fileSize?: number;
  /** 缩略图URL */
  thumbnailUrl?: string;
}

/**
 * ChunkUploadService类 - 分片上传服务
 */
export class ChunkUploadService {
  /** 默认分片大小：5MB */
  private readonly defaultChunkSize = 5 * 1024 * 1024;
  /** 最大重试次数 */
  private readonly maxRetries = 3;
  /** 重试延迟（毫秒） */
  private readonly retryDelay = 1000;

  /**
   * 上传文件（分片）
   * @param config - 上传配置
   */
  async uploadFile(config: ChunkUploadConfig): Promise<void> {
    const {
      file,
      sessionId,
      chunkSize = this.defaultChunkSize,
      uploadedChunks = [],
      onProgress,
      onChunkComplete,
      shouldAbort,
    } = config;

    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadedSet = new Set(uploadedChunks);
    
    let uploadedBytes = uploadedChunks.length * chunkSize;
    const startTime = Date.now();
    let lastTime = startTime;
    let lastBytes = uploadedBytes;

    for (let i = 0; i < totalChunks; i++) {
      // 检查是否应该中止
      if (shouldAbort?.()) {
        throw new Error('上传已取消');
      }

      // 跳过已上传的分片
      if (uploadedSet.has(i)) {
        continue;
      }

      // 切分分片
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      // 计算分片MD5
      const chunkMd5 = await md5Service.calculateBlobMD5(chunk);

      // 上传分片（带重试）
      await this.uploadChunkWithRetry(sessionId, i, chunk, chunkMd5);

      // 更新进度
      uploadedBytes = end;
      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000;
      const bytesDiff = uploadedBytes - lastBytes;
      const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
      const remainingBytes = file.size - uploadedBytes;
      const remainingTime = speed > 0 ? remainingBytes / speed : 0;

      if (onProgress) {
        onProgress({
          loaded: uploadedBytes,
          total: file.size,
          percentage: Math.round((uploadedBytes / file.size) * 100),
          chunkIndex: i,
          totalChunks,
          speed,
          remainingTime,
        });
      }

      if (onChunkComplete) {
        onChunkComplete(i, totalChunks);
      }

      lastTime = now;
      lastBytes = uploadedBytes;
    }
  }

  /**
   * 上传单个分片（带重试）
   */
  private async uploadChunkWithRetry(
    sessionId: string,
    chunkIndex: number,
    chunk: Blob,
    chunkMd5: string
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this.uploadChunk(sessionId, chunkIndex, chunk, chunkMd5);
        return;
      } catch (error) {
        lastError = error as Error;
        console.warn(`分片 ${chunkIndex} 上传失败，尝试 ${attempt + 1}/${this.maxRetries}:`, error);
        
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError || new Error(`分片 ${chunkIndex} 上传失败`);
  }

  /**
   * 上传单个分片
   * @param sessionId - 会话ID
   * @param chunkIndex - 分片索引
   * @param chunk - 分片数据
   * @param chunkMd5 - 分片MD5
   */
  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunk: Blob,
    chunkMd5: string
  ): Promise<void> {
    const formData = new FormData();
    formData.append('sessionId', sessionId);
    formData.append('chunkIndex', chunkIndex.toString());
    formData.append('chunk', chunk);
    formData.append('chunkMd5', chunkMd5);

    const response = await fetch(`${API_BASE_URL}/upload/chunk`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `上传分片失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message || '上传分片失败');
    }
  }

  /**
   * 完成上传（合并分片）
   * @param sessionId - 会话ID
   * @returns 文件信息
   */
  async completeUpload(sessionId: string): Promise<ChunkUploadResult> {
    const response = await fetch(`${API_BASE_URL}/upload/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `完成上传失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message || '完成上传失败');
    }

    return {
      fileUrl: data.data.fileUrl,
      fileId: data.data.fileId,
      fileName: data.data.fileName,
      fileSize: data.data.fileSize,
      thumbnailUrl: data.data.thumbnailUrl,
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 计算分片信息
   * @param fileSize - 文件大小
   * @param chunkSize - 分片大小
   * @returns 分片信息
   */
  calculateChunkInfo(fileSize: number, chunkSize?: number): {
    chunkSize: number;
    chunkCount: number;
  } {
    const size = chunkSize ?? this.defaultChunkSize;
    return {
      chunkSize: size,
      chunkCount: Math.ceil(fileSize / size),
    };
  }
}

// 单例导出
export const chunkUploadService = new ChunkUploadService();

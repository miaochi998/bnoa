/**
 * SessionService - 上传会话管理服务
 * @module lib/services/upload/SessionService
 * 
 * 功能：
 * - 初始化上传会话
 * - 获取会话信息
 * - 取消会话
 * 
 * 使用场景：
 * - 分片上传前初始化会话
 * - 断点续传时恢复会话
 */

import { getApiBaseUrl } from '@/lib/config';
import { getAuthHeaders } from '../../utils/upload';

const API_BASE_URL = getApiBaseUrl();

/**
 * 存储模式
 */
export type StorageMode = 'rustfs' | 'local';

/**
 * 会话初始化请求参数
 */
export interface SessionInitRequest {
  /** 文件名 */
  fileName: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 文件MD5 */
  fileMd5: string;
  /** MIME类型 */
  mimeType: string;
  /** 目标文件夹ID */
  folderId?: string;
  /** 存储模式 */
  storageMode: StorageMode;
}

/**
 * 会话初始化响应
 */
export interface SessionInitResponse {
  /** 会话ID */
  sessionId: string;
  /** 分片大小（字节） */
  chunkSize: number;
  /** 分片数量 */
  chunkCount: number;
  /** 已上传分片索引列表（断点续传） */
  uploadedChunks?: number[];
  /** 文件是否已存在（秒传） */
  exists?: boolean;
  /** 文件URL（秒传时返回） */
  fileUrl?: string;
  /** 文件ID（秒传时返回） */
  fileId?: string;
}

/**
 * 会话信息
 */
export interface SessionInfo {
  /** 会话ID */
  sessionId: string;
  /** 文件名 */
  fileName: string;
  /** 文件大小 */
  fileSize: number;
  /** 分片大小 */
  chunkSize: number;
  /** 分片数量 */
  chunkCount: number;
  /** 已上传分片数 */
  uploadedChunks: number;
  /** 状态 */
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'expired';
  /** 创建时间 */
  createdAt: string;
  /** 过期时间 */
  expiresAt: string;
}

/**
 * SessionService类 - 上传会话管理服务
 */
export class SessionService {
  /** 默认分片大小：5MB */
  private readonly defaultChunkSize = 5 * 1024 * 1024;

  /**
   * 初始化上传会话
   * @param params - 初始化参数
   * @returns 会话信息
   */
  async initSession(params: SessionInitRequest): Promise<SessionInitResponse> {
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
        mimeType: params.mimeType,
        folderId: params.folderId,
        storageMode: params.storageMode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `初始化上传会话失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message || '初始化上传会话失败');
    }

    return {
      sessionId: data.data.sessionId,
      chunkSize: data.data.chunkSize || this.defaultChunkSize,
      chunkCount: data.data.chunkCount,
      uploadedChunks: data.data.uploadedChunks,
      exists: data.data.exists,
      fileUrl: data.data.fileUrl,
      fileId: data.data.fileId,
    };
  }

  /**
   * 获取会话信息
   * @param sessionId - 会话ID
   * @returns 会话信息
   */
  async getSession(sessionId: string): Promise<SessionInfo> {
    const response = await fetch(`${API_BASE_URL}/upload/session/${sessionId}`, {
      method: 'GET',
      headers: {
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error(`获取会话信息失败: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
      throw new Error(data.message || '获取会话信息失败');
    }

    return data.data;
  }

  /**
   * 取消上传会话
   * @param sessionId - 会话ID
   */
  async cancelSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/upload/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `取消上传会话失败: ${response.status}`);
    }
  }

  /**
   * 计算分片数量
   * @param fileSize - 文件大小（字节）
   * @param chunkSize - 分片大小（字节）
   * @returns 分片数量
   */
  calculateChunkCount(fileSize: number, chunkSize?: number): number {
    const size = chunkSize ?? this.defaultChunkSize;
    return Math.ceil(fileSize / size);
  }

  /**
   * 获取默认分片大小
   * @returns 默认分片大小（字节）
   */
  getDefaultChunkSize(): number {
    return this.defaultChunkSize;
  }

  /**
   * 判断文件是否需要分片上传
   * @param fileSize - 文件大小（字节）
   * @param threshold - 阈值（字节），默认10MB
   * @returns 是否需要分片
   */
  needsChunkedUpload(fileSize: number, threshold: number = 10 * 1024 * 1024): boolean {
    return fileSize > threshold;
  }
}

// 单例导出
export const sessionService = new SessionService();

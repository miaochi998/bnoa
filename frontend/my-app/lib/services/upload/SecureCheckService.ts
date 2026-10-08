/**
 * SecureCheckService - 秒传检查服务
 * @module lib/services/upload/SecureCheckService
 * 
 * 功能：
 * - 基于MD5检查文件是否已存在
 * - 返回已存在文件的URL和ID
 * 
 * 使用场景：
 * - 上传前检查，实现秒传
 */

import { getApiBaseUrl } from '@/lib/config';
import { getAuthHeaders } from '../../utils/upload';

const API_BASE_URL = getApiBaseUrl();

/**
 * 秒传检查请求参数
 */
export interface SecureCheckRequest {
  /** 文件MD5 */
  fileMd5: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 目标文件夹ID */
  folderId?: string;
  /** MIME类型 */
  mimeType?: string;
  /** 文件名 */
  fileName?: string;
}

/**
 * 秒传检查响应
 */
export interface SecureCheckResponse {
  /** 文件是否已存在 */
  exists: boolean;
  /** 已存在文件的URL */
  fileUrl?: string;
  /** 已存在文件的ID */
  fileId?: string;
  /** 缩略图URL */
  thumbnailUrl?: string;
}

/**
 * 媒体类型
 */
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'other';

/**
 * SecureCheckService类 - 秒传检查服务
 */
export class SecureCheckService {
  /**
   * 检查文件是否已存在（秒传检查）
   * @param params - 检查参数
   * @returns 检查结果
   */
  async checkFileExists(params: SecureCheckRequest): Promise<SecureCheckResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/upload/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          md5: params.fileMd5,
          folderId: params.folderId,
        }),
      });

      if (!response.ok) {
        // 如果接口不存在或出错，返回不存在
        return { exists: false };
      }

      const data = await response.json();
      
      if (data.code === 0 && data.data?.exists) {
        return {
          exists: true,
          fileUrl: data.data.fileUrl,
          fileId: data.data.fileId,
          thumbnailUrl: data.data.thumbnailUrl,
        };
      }

      return { exists: false };
    } catch (error) {
      console.error('秒传检查失败:', error);
      // 出错时返回不存在，继续正常上传流程
      return { exists: false };
    }
  }

  /**
   * 根据MIME类型获取媒体类型
   * @param mimeType - MIME类型
   * @returns 媒体类型
   */
  getMediaType(mimeType?: string): MediaType {
    if (!mimeType) return 'other';
    
    const type = mimeType.toLowerCase();
    
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    
    if (
      type.includes('pdf') ||
      type.includes('word') ||
      type.includes('document') ||
      type.includes('excel') ||
      type.includes('spreadsheet') ||
      type.includes('powerpoint') ||
      type.includes('presentation') ||
      type === 'text/plain'
    ) {
      return 'document';
    }
    
    return 'other';
  }

  /**
   * 判断是否为图片文件
   * @param mimeType - MIME类型
   * @returns 是否为图片
   */
  isImage(mimeType?: string): boolean {
    return this.getMediaType(mimeType) === 'image';
  }

  /**
   * 判断是否为视频文件
   * @param mimeType - MIME类型
   * @returns 是否为视频
   */
  isVideo(mimeType?: string): boolean {
    return this.getMediaType(mimeType) === 'video';
  }

  /**
   * 判断是否为音频文件
   * @param mimeType - MIME类型
   * @returns 是否为音频
   */
  isAudio(mimeType?: string): boolean {
    return this.getMediaType(mimeType) === 'audio';
  }

  /**
   * 判断是否需要生成缩略图
   * @param mimeType - MIME类型
   * @returns 是否需要缩略图
   */
  needsThumbnail(mimeType?: string): boolean {
    const type = this.getMediaType(mimeType);
    return type === 'image' || type === 'video';
  }
}

// 单例导出
export const secureCheckService = new SecureCheckService();

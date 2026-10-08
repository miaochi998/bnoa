/**
 * 上传API服务
 */

import { getApiBaseUrl } from '@/lib/config';
import {
  FileExistsResponse,
  InitUploadResponse,
  PresignedUrlsResponse,
  CompleteUploadResponse,
  UploadSessionResponse,
  RealFolder,
} from '@/types/upload';

const API_BASE = getApiBaseUrl();

/**
 * 获取认证头
 */
function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * 通用请求方法
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ============================================
// 上传相关API
// ============================================

/**
 * 秒传检查
 */
export async function checkFileExists(
  md5: string,
  folderId?: string,
): Promise<FileExistsResponse> {
  return request<FileExistsResponse>('/upload/check', {
    method: 'POST',
    body: JSON.stringify({ md5, folderId }),
  });
}

/**
 * 初始化上传
 */
export async function initUpload(params: {
  fileName: string;
  fileSize: number;
  fileMd5: string;
  fileExtension: string;
  mimeType: string;
  folderId?: string;
  chunkSize?: number;
}): Promise<InitUploadResponse> {
  return request<InitUploadResponse>('/upload/init', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * 获取预签名URL
 */
export async function getPresignedUrls(
  sessionId: string,
  partNumbers: number[],
): Promise<PresignedUrlsResponse> {
  return request<PresignedUrlsResponse>('/upload/presigned-urls', {
    method: 'POST',
    body: JSON.stringify({ sessionId, partNumbers }),
  });
}

/**
 * 完成上传
 */
export async function completeUpload(
  sessionId: string,
  parts: Array<{ partNumber: number; etag: string }>,
): Promise<CompleteUploadResponse> {
  return request<CompleteUploadResponse>('/upload/complete', {
    method: 'POST',
    body: JSON.stringify({ sessionId, parts }),
  });
}

/**
 * 取消上传
 */
export async function abortUpload(sessionId: string): Promise<void> {
  return request<void>('/upload/abort', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

/**
 * 获取上传会话状态
 */
export async function getUploadSession(
  sessionId: string,
): Promise<UploadSessionResponse> {
  return request<UploadSessionResponse>(`/upload/session/${sessionId}`);
}

/**
 * 上传分片到S3
 */
export async function uploadPart(
  url: string,
  data: Blob,
  onProgress?: (progress: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress((event.loaded / event.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') || '';
        resolve(etag.replace(/"/g, ''));
      } else {
        reject(new Error(`上传失败: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('网络错误'));
    xhr.send(data);
  });
}

// ============================================
// 文件夹API
// ============================================

/**
 * 获取真实文件夹列表
 */
export async function getRealFolders(): Promise<RealFolder[]> {
  return request<RealFolder[]>('/folders/real');
}

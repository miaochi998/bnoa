'use client';

/**
 * UploadQueueContext - 上传队列全局状态管理
 * 
 * 功能：
 * - 将 useUploadQueue Hook 的状态提升到全局
 * - 自动渲染 FloatingUploadQueue 浮动面板
 * - 支持多场景复用（文件管理、头像上传等）
 * 
 * 使用方式：
 * 1. 在 app/layout.tsx 中包裹 UploadQueueProvider
 * 2. 在业务组件中使用 useUploadQueueContext() 获取上传状态和方法
 */

import React, { createContext, useContext, ReactNode } from 'react';
import { useUploadQueue, type UploadQueueConfig, type UploadQueueResult } from '@/hooks/upload/useUploadQueue';
import { FloatingUploadQueue } from '@/components/upload/FloatingUploadQueue';

// Context 类型定义（复用 useUploadQueue 返回类型）
type UploadQueueContextType = UploadQueueResult;

const UploadQueueContext = createContext<UploadQueueContextType | null>(null);

export interface UploadQueueProviderProps {
  children: ReactNode;
  /** 默认目标文件夹ID */
  defaultFolderId?: string;
  /** 默认存储模式 */
  defaultStorageMode?: 'rustfs' | 'local';
  /** 是否压缩图片 */
  compress?: boolean;
  /** 是否生成缩略图 */
  generateThumbnails?: boolean;
  /** 最大并发上传数 */
  maxConcurrent?: number;
  /** 单文件上传完成回调 */
  onFileComplete?: UploadQueueConfig['onFileComplete'];
  /** 全部上传完成回调 */
  onAllComplete?: UploadQueueConfig['onAllComplete'];
  /** 单文件上传失败回调 */
  onFileError?: UploadQueueConfig['onFileError'];
}

/**
 * 上传队列 Provider
 * 在应用布局中使用，提供全局上传状态管理
 */
export function UploadQueueProvider({
  children,
  defaultFolderId,
  defaultStorageMode = 'rustfs',
  compress = true,
  generateThumbnails = true,
  maxConcurrent = 3,
  onFileComplete,
  onAllComplete,
  onFileError,
}: UploadQueueProviderProps) {
  // 使用现有的 useUploadQueue Hook，完全复用其功能
  const uploadQueue = useUploadQueue({
    folderId: defaultFolderId,
    storageMode: defaultStorageMode,
    compress,
    generateThumbnails,
    maxConcurrent,
    onFileComplete,
    onAllComplete,
    onFileError,
  });

  return (
    <UploadQueueContext.Provider value={uploadQueue}>
      {children}
      {/* 全局浮动队列面板 */}
      <FloatingUploadQueue />
    </UploadQueueContext.Provider>
  );
}

/**
 * 获取上传队列上下文（严格版本）
 * 必须在 UploadQueueProvider 内部使用，否则抛出错误
 */
export function useUploadQueueContext(): UploadQueueContextType {
  const context = useContext(UploadQueueContext);
  if (!context) {
    throw new Error('useUploadQueueContext must be used within UploadQueueProvider');
  }
  return context;
}

/**
 * 获取上传队列上下文（安全版本）
 * 允许在 Provider 外部使用，返回 null
 */
export function useUploadQueueContextSafe(): UploadQueueContextType | null {
  return useContext(UploadQueueContext);
}

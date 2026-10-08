/**
 * useUploadRecovery - 上传恢复Hook
 * 提供崩溃恢复和断点续传的状态管理
 * 
 * 功能点：
 * - F025: 自动缓存 - 上传过程中自动保存状态
 * - F026: 崩溃恢复 - 页面重载后检测并恢复未完成上传
 * - F027: 智能清理 - 上传成功后自动清理缓存
 * - F028: 过期清理 - 24小时自动过期
 * 
 * @example
 * const {
 *   recoverableUploads,
 *   isChecking,
 *   checkRecoverable,
 *   recoverUpload,
 *   dismissRecoverable,
 *   clearAllRecoverable,
 * } = useUploadRecovery({
 *   onRecoveryDetected: (uploads) => {
 *     console.log('检测到可恢复的上传:', uploads.length);
 *   },
 * });
 */

import { useState, useCallback, useEffect } from 'react';
import { 
  cacheService, 
  type CachedUploadSession, 
  type RecoverableUpload 
} from '@/lib/services/upload/CacheService';

/**
 * 恢复回调参数
 */
export interface RecoveryCallbackParams {
  session: CachedUploadSession;
  uploadedChunks: number[];
  totalChunks: number;
  progress: number;
}

/**
 * useUploadRecovery配置
 */
export interface UseUploadRecoveryConfig {
  /** 是否在挂载时自动检查可恢复的上传 */
  autoCheck?: boolean;
  /** 检测到可恢复上传时的回调 */
  onRecoveryDetected?: (uploads: RecoverableUpload[]) => void;
  /** 恢复上传时的回调 */
  onRecover?: (params: RecoveryCallbackParams) => void;
  /** 是否自动清理过期缓存 */
  autoCleanupExpired?: boolean;
}

/**
 * useUploadRecovery返回值
 */
export interface UseUploadRecoveryReturn {
  /** 可恢复的上传列表 */
  recoverableUploads: RecoverableUpload[];
  /** 是否正在检查 */
  isChecking: boolean;
  /** 是否有可恢复的上传 */
  hasRecoverable: boolean;
  /** 检查可恢复的上传 */
  checkRecoverable: () => Promise<RecoverableUpload[]>;
  /** 恢复指定上传 */
  recoverUpload: (sessionId: string) => Promise<RecoveryCallbackParams | null>;
  /** 忽略/删除指定的可恢复上传 */
  dismissRecoverable: (sessionId: string) => Promise<void>;
  /** 清除所有可恢复的上传 */
  clearAllRecoverable: () => Promise<void>;
  /** 保存上传会话 */
  saveSession: (session: CachedUploadSession) => Promise<void>;
  /** 更新已上传的分片 */
  updateProgress: (sessionId: string, uploadedChunks: number[], progress: number) => Promise<void>;
  /** 标记上传完成 */
  markCompleted: (sessionId: string) => Promise<void>;
  /** 标记上传失败 */
  markFailed: (sessionId: string) => Promise<void>;
  /** 获取缓存统计 */
  getStats: () => Promise<{
    totalSessions: number;
    pendingSessions: number;
    uploadingSessions: number;
    pausedSessions: number;
    completedSessions: number;
    failedSessions: number;
    expiredSessions: number;
    totalSize: number;
  }>;
}

/**
 * 上传恢复Hook
 */
export function useUploadRecovery(
  config: UseUploadRecoveryConfig = {}
): UseUploadRecoveryReturn {
  const {
    autoCheck = true,
    onRecoveryDetected,
    onRecover,
    autoCleanupExpired = true,
  } = config;

  const [recoverableUploads, setRecoverableUploads] = useState<RecoverableUpload[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  /**
   * 检查可恢复的上传
   */
  const checkRecoverable = useCallback(async (): Promise<RecoverableUpload[]> => {
    setIsChecking(true);
    
    try {
      // 先清理过期的
      if (autoCleanupExpired) {
        await cacheService.cleanupExpired();
      }
      
      // 获取可恢复的上传
      const uploads = await cacheService.getRecoverableUploads();
      
      // 过滤掉已过期的
      const validUploads = uploads.filter(u => !u.isExpired);
      
      setRecoverableUploads(validUploads);
      
      if (validUploads.length > 0 && onRecoveryDetected) {
        onRecoveryDetected(validUploads);
      }
      
      return validUploads;
    } catch (error) {
      console.error('[useUploadRecovery] 检查可恢复上传失败:', error);
      return [];
    } finally {
      setIsChecking(false);
    }
  }, [autoCleanupExpired, onRecoveryDetected]);

  /**
   * 恢复指定上传
   */
  const recoverUpload = useCallback(async (
    sessionId: string
  ): Promise<RecoveryCallbackParams | null> => {
    try {
      const session = await cacheService.getSession(sessionId);
      
      if (!session) {
        console.warn(`[useUploadRecovery] 会话不存在: ${sessionId}`);
        return null;
      }
      
      const params: RecoveryCallbackParams = {
        session,
        uploadedChunks: session.uploadedChunks,
        totalChunks: session.totalChunks,
        progress: session.progress,
      };
      
      // 更新状态为上传中
      await cacheService.updateSessionStatus(sessionId, 'uploading');
      
      // 从列表中移除
      setRecoverableUploads(prev => prev.filter(u => u.session.sessionId !== sessionId));
      
      if (onRecover) {
        onRecover(params);
      }
      
      console.log(`[useUploadRecovery] 恢复上传: ${session.fileName}`);
      
      return params;
    } catch (error) {
      console.error('[useUploadRecovery] 恢复上传失败:', error);
      return null;
    }
  }, [onRecover]);

  /**
   * 忽略/删除指定的可恢复上传
   */
  const dismissRecoverable = useCallback(async (sessionId: string): Promise<void> => {
    try {
      await cacheService.deleteSession(sessionId);
      setRecoverableUploads(prev => prev.filter(u => u.session.sessionId !== sessionId));
      console.log(`[useUploadRecovery] 已忽略上传: ${sessionId}`);
    } catch (error) {
      console.error('[useUploadRecovery] 删除会话失败:', error);
    }
  }, []);

  /**
   * 清除所有可恢复的上传
   */
  const clearAllRecoverable = useCallback(async (): Promise<void> => {
    try {
      for (const upload of recoverableUploads) {
        await cacheService.deleteSession(upload.session.sessionId);
      }
      setRecoverableUploads([]);
      console.log('[useUploadRecovery] 已清除所有可恢复上传');
    } catch (error) {
      console.error('[useUploadRecovery] 清除失败:', error);
    }
  }, [recoverableUploads]);

  /**
   * 保存上传会话
   */
  const saveSession = useCallback(async (session: CachedUploadSession): Promise<void> => {
    await cacheService.saveSession(session);
  }, []);

  /**
   * 更新已上传的分片
   */
  const updateProgress = useCallback(async (
    sessionId: string,
    uploadedChunks: number[],
    progress: number
  ): Promise<void> => {
    await cacheService.updateUploadedChunks(sessionId, uploadedChunks, progress);
  }, []);

  /**
   * 标记上传完成
   */
  const markCompleted = useCallback(async (sessionId: string): Promise<void> => {
    await cacheService.updateSessionStatus(sessionId, 'completed');
    // 完成后删除缓存（智能清理）
    await cacheService.deleteSession(sessionId);
    console.log(`[useUploadRecovery] 上传完成，已清理缓存: ${sessionId}`);
  }, []);

  /**
   * 标记上传失败
   */
  const markFailed = useCallback(async (sessionId: string): Promise<void> => {
    await cacheService.updateSessionStatus(sessionId, 'failed');
  }, []);

  /**
   * 获取缓存统计
   */
  const getStats = useCallback(async () => {
    return cacheService.getStats();
  }, []);

  // 组件挂载时自动检查
  useEffect(() => {
    if (autoCheck) {
      checkRecoverable();
    }
  }, [autoCheck, checkRecoverable]);

  return {
    recoverableUploads,
    isChecking,
    hasRecoverable: recoverableUploads.length > 0,
    checkRecoverable,
    recoverUpload,
    dismissRecoverable,
    clearAllRecoverable,
    saveSession,
    updateProgress,
    markCompleted,
    markFailed,
    getStats,
  };
}

export default useUploadRecovery;

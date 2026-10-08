'use client';

/**
 * 上传队列管理Hook
 */

import { useState, useCallback, useRef } from 'react';
import { UploadItem, UploadStatus } from '@/types/upload';
import { calculateFileMd5 } from '@/lib/md5-worker';
import {
  initUpload,
  getPresignedUrls,
  completeUpload,
  abortUpload,
  uploadPart,
} from '@/lib/upload-api';

interface UseUploadQueueOptions {
  maxConcurrent?: number;
  chunkSize?: number;
  folderId?: string;
  onUploadComplete?: (item: UploadItem) => void;
  onUploadError?: (item: UploadItem, error: Error) => void;
}

interface UploadQueueState {
  items: UploadItem[];
  isUploading: boolean;
}

export function useUploadQueue(options: UseUploadQueueOptions = {}) {
  const {
    maxConcurrent = 3,
    chunkSize = 10 * 1024 * 1024, // 10MB
    folderId,
    onUploadComplete,
    onUploadError,
  } = options;

  const [state, setState] = useState<UploadQueueState>({
    items: [],
    isUploading: false,
  });

  const activeUploadsRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  /**
   * 添加文件到队列
   */
  const addFiles = useCallback((files: File[]) => {
    const newItems: UploadItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: UploadStatus.WAITING,
      type: file.type,
      stepHint: '等待上传',
    }));

    setState((prev) => ({
      ...prev,
      items: [...prev.items, ...newItems],
    }));

    // 存储文件引用
    newItems.forEach((item, index) => {
      (item as any)._file = files[index];
    });

    return newItems;
  }, []);

  /**
   * 更新上传项状态
   */
  const updateItem = useCallback((id: string, updates: Partial<UploadItem>) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item,
      ),
    }));
  }, []);

  /**
   * 移除上传项
   */
  const removeItem = useCallback((id: string) => {
    // 取消正在进行的上传
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }

    setState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== id),
    }));
  }, []);

  /**
   * 清除已完成的项
   */
  const clearCompleted = useCallback(() => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter(
        (item) =>
          item.status !== UploadStatus.SUCCESS &&
          item.status !== UploadStatus.ERROR,
      ),
    }));
  }, []);

  /**
   * 上传单个文件
   */
  const uploadFile = useCallback(
    async (item: UploadItem) => {
      const file = (item as any)._file as File;
      if (!file) {
        updateItem(item.id, {
          status: UploadStatus.ERROR,
          error: '文件不存在',
        });
        return;
      }

      const controller = new AbortController();
      abortControllersRef.current.set(item.id, controller);
      activeUploadsRef.current.add(item.id);

      try {
        // 步骤1: 计算MD5
        updateItem(item.id, {
          status: UploadStatus.UPLOADING,
          stepHint: '计算文件指纹...',
          progress: 0,
        });

        const md5 = await calculateFileMd5(file, (progress) => {
          updateItem(item.id, { progress: progress * 0.1 }); // MD5占10%
        });

        // 步骤2: 初始化上传
        updateItem(item.id, {
          stepHint: '初始化上传...',
          progress: 10,
        });

        const ext = file.name.split('.').pop() || '';
        const initResult = await initUpload({
          fileName: file.name,
          fileSize: file.size,
          fileMd5: md5,
          fileExtension: ext,
          mimeType: file.type || 'application/octet-stream',
          folderId,
          chunkSize,
        });

        // 检查秒传
        if (initResult.isInstant) {
          updateItem(item.id, {
            status: UploadStatus.SUCCESS,
            progress: 100,
            stepHint: '秒传成功',
            isInstant: true,
            fileId: initResult.existingFileId,
            url: initResult.existingFileUrl,
          });
          onUploadComplete?.({ ...item, status: UploadStatus.SUCCESS });
          return;
        }

        // 步骤3: 分片上传
        const { sessionId, partCount, partSize } = initResult;
        updateItem(item.id, { sessionId });

        const uploadedParts: Array<{ partNumber: number; etag: string }> = [];
        const partNumbers = Array.from({ length: partCount }, (_, i) => i + 1);

        // 批量获取预签名URL
        const urlsResult = await getPresignedUrls(sessionId, partNumbers);

        // 上传每个分片
        for (let i = 0; i < partCount; i++) {
          if (controller.signal.aborted) {
            throw new Error('上传已取消');
          }

          const partNumber = i + 1;
          const start = i * partSize;
          const end = Math.min(start + partSize, file.size);
          const chunk = file.slice(start, end);

          updateItem(item.id, {
            stepHint: `上传分片 ${partNumber}/${partCount}`,
          });

          const urlInfo = urlsResult.presignedUrls.find(
            (u) => u.partNumber === partNumber,
          );
          if (!urlInfo) {
            throw new Error(`未找到分片 ${partNumber} 的预签名URL`);
          }

          const etag = await uploadPart(urlInfo.directUrl, chunk, (progress) => {
            const baseProgress = 10 + (i / partCount) * 85;
            const chunkProgress = (progress / 100) * (85 / partCount);
            updateItem(item.id, { progress: baseProgress + chunkProgress });
          });

          uploadedParts.push({ partNumber, etag });
        }

        // 步骤4: 完成上传
        updateItem(item.id, {
          stepHint: '完成上传...',
          progress: 95,
        });

        const completeResult = await completeUpload(sessionId, uploadedParts);

        updateItem(item.id, {
          status: UploadStatus.SUCCESS,
          progress: 100,
          stepHint: '上传成功',
          fileId: completeResult.fileId,
          url: completeResult.url,
        });

        onUploadComplete?.({
          ...item,
          status: UploadStatus.SUCCESS,
          fileId: completeResult.fileId,
          url: completeResult.url,
        });
      } catch (error) {
        const err = error as Error;
        if (err.message === '上传已取消') {
          updateItem(item.id, {
            status: UploadStatus.CANCELLED,
            stepHint: '已取消',
          });
        } else {
          updateItem(item.id, {
            status: UploadStatus.ERROR,
            error: err.message,
            stepHint: '上传失败',
          });
          onUploadError?.({ ...item, status: UploadStatus.ERROR }, err);
        }
      } finally {
        activeUploadsRef.current.delete(item.id);
        abortControllersRef.current.delete(item.id);
      }
    },
    [folderId, chunkSize, updateItem, onUploadComplete, onUploadError],
  );

  /**
   * 开始上传队列
   */
  const startUpload = useCallback(() => {
    setState((prev) => ({ ...prev, isUploading: true }));

    const processQueue = () => {
      const waitingItems = state.items.filter(
        (item) =>
          item.status === UploadStatus.WAITING &&
          !activeUploadsRef.current.has(item.id),
      );

      const availableSlots = maxConcurrent - activeUploadsRef.current.size;

      waitingItems.slice(0, availableSlots).forEach((item) => {
        uploadFile(item);
      });

      // 检查是否还有待上传的项
      if (
        waitingItems.length > availableSlots ||
        activeUploadsRef.current.size > 0
      ) {
        setTimeout(processQueue, 500);
      } else {
        setState((prev) => ({ ...prev, isUploading: false }));
      }
    };

    processQueue();
  }, [state.items, maxConcurrent, uploadFile]);

  /**
   * 暂停上传
   */
  const pauseUpload = useCallback((id: string) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
    }
    updateItem(id, {
      status: UploadStatus.PAUSED,
      stepHint: '已暂停',
    });
  }, [updateItem]);

  /**
   * 继续上传
   */
  const resumeUpload = useCallback(
    (id: string) => {
      const item = state.items.find((i) => i.id === id);
      if (item && item.status === UploadStatus.PAUSED) {
        updateItem(id, {
          status: UploadStatus.WAITING,
          stepHint: '等待上传',
        });
        startUpload();
      }
    },
    [state.items, updateItem, startUpload],
  );

  /**
   * 取消上传
   */
  const cancelUpload = useCallback(
    async (id: string) => {
      const item = state.items.find((i) => i.id === id);
      if (!item) return;

      const controller = abortControllersRef.current.get(id);
      if (controller) {
        controller.abort();
      }

      // 如果有会话ID，通知后端取消
      if (item.sessionId) {
        try {
          await abortUpload(item.sessionId);
        } catch {
          // 忽略取消失败
        }
      }

      updateItem(id, {
        status: UploadStatus.CANCELLED,
        stepHint: '已取消',
      });
    },
    [state.items, updateItem],
  );

  /**
   * 重试上传
   */
  const retryUpload = useCallback(
    (id: string) => {
      const item = state.items.find((i) => i.id === id);
      if (item && item.status === UploadStatus.ERROR) {
        updateItem(id, {
          status: UploadStatus.WAITING,
          progress: 0,
          error: undefined,
          stepHint: '等待重试',
          retryCount: (item.retryCount || 0) + 1,
        });
        startUpload();
      }
    },
    [state.items, updateItem, startUpload],
  );

  /**
   * 全部开始
   */
  const startAll = useCallback(() => {
    state.items
      .filter((item) => item.status === UploadStatus.PAUSED)
      .forEach((item) => {
        updateItem(item.id, {
          status: UploadStatus.WAITING,
          stepHint: '等待上传',
        });
      });
    startUpload();
  }, [state.items, updateItem, startUpload]);

  /**
   * 全部暂停
   */
  const pauseAll = useCallback(() => {
    state.items
      .filter(
        (item) =>
          item.status === UploadStatus.UPLOADING ||
          item.status === UploadStatus.WAITING,
      )
      .forEach((item) => pauseUpload(item.id));
  }, [state.items, pauseUpload]);

  /**
   * 全部取消
   */
  const cancelAll = useCallback(() => {
    state.items
      .filter(
        (item) =>
          item.status !== UploadStatus.SUCCESS &&
          item.status !== UploadStatus.CANCELLED,
      )
      .forEach((item) => cancelUpload(item.id));
  }, [state.items, cancelUpload]);

  return {
    items: state.items,
    isUploading: state.isUploading,
    addFiles,
    removeItem,
    clearCompleted,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    startAll,
    pauseAll,
    cancelAll,
  };
}

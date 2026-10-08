/**
 * useUploadQueue - 上传队列管理Hook
 * @module hooks/upload/useUploadQueue
 * 
 * 功能：
 * - 管理上传队列状态
 * - 添加/移除/更新文件
 * - 暂停/恢复/取消/重试
 * - 进度跟踪
 * 
 * 使用场景：
 * - 多文件上传管理
 * - 上传队列UI
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { apiClient } from '../../lib/api';
import { ThumbnailService } from '../../lib/services/ThumbnailService';
import { 
  calculateFileMd5,
  calculateChunkMd5,
  SMALL_FILE_THRESHOLD,
} from '../../lib/file-utils';
import { 
  generateFileId,
  type UploadStatus,
  UPLOAD_STATUS,
  UPLOAD_STAGE,
  isImageFile,
} from '../../lib/utils/upload';
import { CompressService, type CompressConfig } from '../../lib/services/upload/CompressService';

/**
 * 队列中的文件项
 */
export interface QueueItem {
  /** 唯一ID */
  id: string;
  /** 文件对象 */
  file: File;
  /** 上传状态 */
  status: UploadStatus;
  /** 进度百分比 (0-100) */
  progress: number;
  /** 当前阶段提示 */
  stageHint?: string;
  /** 上传速度（字节/秒） */
  speed?: number;
  /** 剩余时间（秒） */
  remainingTime?: number;
  /** 上传结果 */
  result?: any;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: number;
  /** 缩略图URL（图片/视频） */
  thumbnail?: string;
  /** 是否秒传 */
  isInstant?: boolean;
}

/**
 * 上传队列配置
 */
export interface UploadQueueConfig {
  /** 目标文件夹ID */
  folderId?: string;
  /** 存储模式 */
  storageMode?: 'rustfs' | 'local';
  /** 是否压缩图片 */
  compress?: boolean;
  /** 是否生成缩略图（图片和视频） */
  generateThumbnails?: boolean;
  /** 最大并发上传数 */
  maxConcurrent?: number;
  /** 自动开始上传 */
  autoStart?: boolean;
  /** 单文件上传完成回调 */
  onFileComplete?: (item: QueueItem) => void;
  /** 单文件上传失败回调 */
  onFileError?: (item: QueueItem, error: string) => void;
  /** 全部上传完成回调 */
  onAllComplete?: (items: QueueItem[]) => void;
}

/**
 * 上传队列结果
 */
export interface UploadQueueResult {
  /** 队列中的文件列表 */
  files: QueueItem[];
  /** 是否正在上传 */
  isUploading: boolean;
  /** 是否已暂停 */
  isPaused: boolean;
  /** 总进度百分比 */
  totalProgress: number;
  /** 总上传速度 */
  totalSpeed: number;
  /** 已完成数量 */
  completedCount: number;
  /** 失败数量 */
  failedCount: number;
  /** 添加文件到队列 */
  addFiles: (files: File[]) => void;
  /** 移除文件 */
  removeFile: (id: string) => void;
  /** 清空队列 */
  clearQueue: () => void;
  /** 清空所有文件 */
  clearAll: () => void;
  /** 清空已完成的文件 */
  clearCompleted: () => void;
  /** 开始上传 */
  startUpload: () => Promise<void>;
  /** 暂停上传 */
  pauseUpload: () => void;
  /** 恢复上传 */
  resumeUpload: () => void;
  /** 取消所有上传 */
  cancelAll: () => void;
  /** 重试失败的文件 */
  retryFailed: () => void;
  /** 重试单个文件 */
  retryFile: (id: string) => void;
  /** 暂停单个文件 */
  pauseFile: (id: string) => void;
  /** 恢复单个文件 */
  resumeFile: (id: string) => void;
  /** 取消单个文件 */
  cancelFile: (id: string) => void;
  /** 替换文件（用于裁剪后替换原图） */
  replaceFile: (id: string, newFile: File) => void;
  /** 更新配置 */
  updateConfig: (config: Partial<UploadQueueConfig>) => void;
}

/**
 * useUploadQueue Hook
 * @param config - 配置选项
 * @returns 上传队列控制对象
 */
export function useUploadQueue(config: UploadQueueConfig = {}): UploadQueueResult {
  const [files, setFiles] = useState<QueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const configRef = useRef(config);
  // 🔑 保存files的最新引用，用于在回调中获取最新状态
  const filesRef = useRef<QueueItem[]>([]);
  filesRef.current = files;
  
  // 🔑 关键：为每个文件存储独立的AbortController，用于真正中止HTTP请求
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  // 存储每个文件的上传会话ID，用于恢复上传
  const sessionIdsRef = useRef<Map<string, string>>(new Map());
  // 存储每个文件已上传的分片索引，用于断点续传
  const uploadedChunksRef = useRef<Map<string, number[]>>(new Map());

  // 🔑 注意：不要在每次渲染时覆盖 configRef.current
  // 因为 updateConfig 会动态更新 configRef.current，覆盖会导致 folderId 等配置丢失
  // configRef.current = config; // 已移除，避免覆盖 updateConfig 的更新

  /**
   * 计算总进度（只计算活跃文件：上传中、等待中、暂停中、已完成）
   * 忽略已取消和失败的文件
   */
  const activeFiles = files.filter(f => 
    f.status === UPLOAD_STATUS.UPLOADING || 
    f.status === UPLOAD_STATUS.WAITING || 
    f.status === UPLOAD_STATUS.PAUSED ||
    f.status === UPLOAD_STATUS.SUCCESS
  );
  const totalProgress = activeFiles.length > 0
    ? Math.round(activeFiles.reduce((sum, f) => sum + f.progress, 0) / activeFiles.length)
    : 0;

  /**
   * 更新单个文件状态
   */
  const updateFile = useCallback((id: string, updates: Partial<QueueItem>) => {
    setFiles(prev => prev.map(f => 
      f.id === id ? { ...f, ...updates } : f
    ));
  }, []);

  // 缩略图服务实例
  const thumbnailServiceRef = useRef<ThumbnailService | null>(null);
  
  /**
   * 获取缩略图服务实例
   */
  const getThumbnailService = useCallback(() => {
    if (!thumbnailServiceRef.current) {
      thumbnailServiceRef.current = new ThumbnailService();
    }
    return thumbnailServiceRef.current;
  }, []);

  /**
   * 为文件生成缩略图
   */
  const generateThumbnailForFile = useCallback(async (file: File): Promise<string | undefined> => {
    try {
      const service = getThumbnailService();
      
      // 图片文件
      if (file.type.startsWith('image/')) {
        return await service.generateThumbnail(file);
      }
      
      // 视频文件
      if (file.type.startsWith('video/')) {
        return await service.generateVideoThumbnail(file);
      }
      
      return undefined;
    } catch (error) {
      console.warn('[useUploadQueue] 生成缩略图失败:', file.name, error);
      return undefined;
    }
  }, [getThumbnailService]);

  /**
   * 添加文件到队列
   */
  const addFiles = useCallback((newFiles: File[]) => {
    const items: QueueItem[] = newFiles.map(file => ({
      id: generateFileId(),
      file,
      status: UPLOAD_STATUS.WAITING,
      progress: 0,
      createdAt: Date.now(),
    }));

    setFiles(prev => [...prev, ...items]);

    // 异步生成缩略图（不阻塞添加文件）
    items.forEach(async (item) => {
      const thumbnail = await generateThumbnailForFile(item.file);
      if (thumbnail) {
        setFiles(prev => prev.map(f => 
          f.id === item.id ? { ...f, thumbnail } : f
        ));
      }
    });

    // 自动开始上传
    if (configRef.current.autoStart && !isUploading) {
      // 延迟启动以确保状态更新
      setTimeout(() => {
        startUploadInternal([...files, ...items]);
      }, 0);
    }
  }, [files, isUploading, generateThumbnailForFile]);

  /**
   * 移除文件
   */
  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  /**
   * 清空队列
   */
  const clearQueue = useCallback(() => {
    // 中止所有正在进行的上传
    abortControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    abortControllersRef.current.clear();
    sessionIdsRef.current.clear();
    uploadedChunksRef.current.clear();
    setFiles([]);
    setIsUploading(false);
    setIsPaused(false);
  }, []);

  /**
   * 清空已完成的文件
   */
  const clearCompleted = useCallback(() => {
    setFiles(prev => prev.filter(f => 
      f.status !== UPLOAD_STATUS.SUCCESS && f.status !== UPLOAD_STATUS.ERROR
    ));
  }, []);

  /**
   * 🔑 上传单个文件的核心函数
   * 抽取出来以支持并行上传
   */
  const uploadSingleFile = useCallback(async (item: QueueItem): Promise<void> => {
    const { 
      folderId, 
      storageMode = 'rustfs', 
      compress = false,
      generateThumbnails = true,
      onFileComplete,
      onFileError,
    } = configRef.current;

    // 🔑 为每个文件创建独立的AbortController
    const abortController = new AbortController();
    abortControllersRef.current.set(item.id, abortController);

    // 更新状态为上传中
    updateFile(item.id, { 
      status: UPLOAD_STATUS.UPLOADING, 
      progress: 0,
      error: undefined,
    });

    try {
      let file = item.file;
      
      // 如果开启压缩且是图片文件，先压缩（从后端获取压缩配置）
      if (compress && isImageFile(file.name)) {
        updateFile(item.id, { stageHint: '压缩图片...' });
        try {
          // 从后端获取压缩配置
          let backendConfig = { quality: 60, maxWidth: 1920, maxHeight: 1080, threshold: 2.5 };
          try {
            backendConfig = await apiClient.getCompressionSettings();
          } catch (e) {
            console.warn('获取压缩配置失败，使用默认配置:', e);
          }
          
          const compressService = new CompressService();
          const compressConfig: CompressConfig = {
            quality: backendConfig.quality / 100, // 后端存储的是0-100，前端需要0-1
            maxWidth: backendConfig.maxWidth,
            maxHeight: backendConfig.maxHeight,
            threshold: backendConfig.threshold * 1024 * 1024, // 后端存储的是MB，前端需要字节
          };
          const compressResult = await compressService.compressImageWithResult(file, compressConfig);
          if (compressResult.compressed) {
            console.log(`图片压缩: ${file.name}, ${compressResult.originalSize} -> ${compressResult.compressedSize}, 比例: ${(compressResult.ratio * 100).toFixed(1)}%`);
            file = compressResult.file;
          }
        } catch (compressError) {
          console.warn('图片压缩失败，使用原文件:', compressError);
        }
      }
      
      // 🔑 借鉴7DL实现：所有文件（无论大小）都先计算MD5，然后检查秒传
      // 1. 计算MD5
      updateFile(item.id, { stageHint: UPLOAD_STAGE.MD5 });
      let fileMd5 = '';
      try {
        fileMd5 = await calculateFileMd5(file);
        console.log('[useUploadQueue] MD5计算完成:', file.name, fileMd5);
      } catch (err) {
        console.warn('[useUploadQueue] MD5计算失败:', err);
      }

      // 检查是否已被取消
      if (abortController.signal.aborted) return;

      // 2. 检查秒传（所有文件都检查）
      updateFile(item.id, { stageHint: UPLOAD_STAGE.CHECKING });
      const initResult = await apiClient.initUpload({
        fileName: file.name,
        fileSize: file.size,
        fileMd5,
        mimeType: file.type || 'application/octet-stream',
        folderId,
        storageMode,
      });

      // 秒传成功
      if (initResult.exists) {
        console.log('[useUploadQueue] 秒传成功:', file.name);
        updateFile(item.id, {
          status: UPLOAD_STATUS.SUCCESS,
          progress: 100,
          stageHint: UPLOAD_STAGE.COMPLETED,
          isInstant: true,
          result: { isInstantUpload: true, fileId: initResult.fileId },
        });
        onFileComplete?.({ ...item, status: UPLOAD_STATUS.SUCCESS, isInstant: true });
        return;
      }

      // 检查是否已被取消
      if (abortController.signal.aborted) return;

      // 小文件直接上传（传递compress和generateThumbnails参数给后端）
      if (file.size <= SMALL_FILE_THRESHOLD) {
        updateFile(item.id, { stageHint: UPLOAD_STAGE.UPLOADING });
        
        // 🔑 将压缩开关状态传递给后端，由后端执行压缩
        const result = await apiClient.uploadFile(file, folderId, storageMode, (progress) => {
          updateFile(item.id, { progress });
        }, compress, generateThumbnails); // compress和generateThumbnail由开关控制

        // 如果开启缩略图生成且是视频文件，上传视频缩略图
        // 🔑 后端返回的可能是fileId或id
        const fileId = (result as { fileId?: string; id?: string })?.fileId || result?.id;
        if (generateThumbnails && file.type.startsWith('video/') && fileId) {
          try {
            updateFile(item.id, { stageHint: UPLOAD_STAGE.MERGING });
            const service = getThumbnailService();
            const thumbnailBlob = await service.generateVideoThumbnailAsBlob(file, {
              width: 200,
              height: 200,
              quality: 0.8,
            });
            const videoName = file.name.replace(/\.[^/.]+$/, '');
            const thumbnailFile = new File([thumbnailBlob], `${videoName}_thumb.jpg`, { type: 'image/jpeg' });
            await apiClient.uploadVideoThumbnail(fileId, thumbnailFile);
            console.log('[useUploadQueue] 视频缩略图上传成功:', file.name);
          } catch (thumbError) {
            console.warn('[useUploadQueue] 视频缩略图生成/上传失败（不影响上传）:', thumbError);
          }
        }

        updateFile(item.id, {
          status: UPLOAD_STATUS.SUCCESS,
          progress: 100,
          result,
        });
        onFileComplete?.({ ...item, status: UPLOAD_STATUS.SUCCESS, result });
      } else {
        // 大文件分片上传（MD5计算和秒传检查已在前面统一处理）
        // 分片上传
        const { sessionId, chunkSize, chunkCount, uploadedChunks } = initResult;
        
        // 🔑 保存会话信息，用于断点续传
        sessionIdsRef.current.set(item.id, sessionId);
        uploadedChunksRef.current.set(item.id, uploadedChunks || []);
        
        updateFile(item.id, { stageHint: UPLOAD_STAGE.UPLOADING });

        const startTime = Date.now();
        let uploadedBytes = (uploadedChunks?.length || 0) * chunkSize;
        let wasAborted = false;

        for (let i = 0; i < chunkCount; i++) {
          // 🔑 检查是否被中止（暂停或取消）
          if (abortController.signal.aborted) {
            wasAborted = true;
            console.log(`[useUploadQueue] 文件 ${item.file.name} 上传被中止，已完成 ${i}/${chunkCount} 分片`);
            break;
          }

          // 跳过已上传的分片
          if (uploadedChunks?.includes(i)) continue;

          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const chunk = file.slice(start, end);
          const chunkMd5 = await calculateChunkMd5(chunk);

          try {
            await apiClient.uploadChunk(sessionId, i, chunk, chunkMd5, undefined, abortController.signal);
            
            // 记录已上传的分片
            const currentChunks = uploadedChunksRef.current.get(item.id) || [];
            currentChunks.push(i);
            uploadedChunksRef.current.set(item.id, currentChunks);
          } catch (err) {
            if ((err as Error).message === 'AbortError') {
              wasAborted = true;
              console.log(`[useUploadQueue] 文件 ${item.file.name} 分片 ${i} 上传被中止`);
              break;
            }
            throw err;
          }

          uploadedBytes += chunk.size;
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = uploadedBytes / elapsed;
          const remaining = (file.size - uploadedBytes) / speed;
          const progress = Math.round((uploadedBytes / file.size) * 100);

          updateFile(item.id, {
            progress,
            speed,
            remainingTime: remaining,
          });
        }

        if (!wasAborted) {
          // 完成上传（传递压缩和缩略图开关）
          updateFile(item.id, { stageHint: UPLOAD_STAGE.MERGING });
          const completeResult = await apiClient.completeUpload(sessionId, compress, generateThumbnails);
          
          // 如果开启缩略图生成且是视频文件，上传视频缩略图
          if (generateThumbnails && file.type.startsWith('video/') && completeResult?.fileId) {
            try {
              updateFile(item.id, { stageHint: UPLOAD_STAGE.MERGING });
              const service = getThumbnailService();
              const thumbnailBlob = await service.generateVideoThumbnailAsBlob(file, {
                width: 200,
                height: 200,
                quality: 0.8,
              });
              const videoName = file.name.replace(/\.[^/.]+$/, '');
              const thumbnailFile = new File([thumbnailBlob], `${videoName}_thumb.jpg`, { type: 'image/jpeg' });
              await apiClient.uploadVideoThumbnail(completeResult.fileId, thumbnailFile);
              console.log('[useUploadQueue] 视频缩略图上传成功:', file.name);
            } catch (thumbError) {
              console.warn('[useUploadQueue] 视频缩略图生成/上传失败（不影响上传）:', thumbError);
            }
          }
          
          // 构建result对象，包含压缩后的大小
          const result = {
            fileId: completeResult.fileId,
            url: completeResult.fileUrl,
            size: completeResult.size,
            mimeType: completeResult.mimeType,
          };
          updateFile(item.id, {
            status: UPLOAD_STATUS.SUCCESS,
            progress: 100,
            stageHint: UPLOAD_STAGE.COMPLETED,
            result,
          });
          onFileComplete?.({ ...item, status: UPLOAD_STATUS.SUCCESS, result });
          
          // 清理会话信息
          abortControllersRef.current.delete(item.id);
          sessionIdsRef.current.delete(item.id);
          uploadedChunksRef.current.delete(item.id);
        }
      }
    } catch (error) {
      const errorMessage = (error as Error).message || '上传失败';
      // 🔑 忽略AbortError，这是正常的暂停/取消行为
      if (errorMessage !== 'AbortError') {
        updateFile(item.id, {
          status: UPLOAD_STATUS.ERROR,
          error: errorMessage,
        });
        onFileError?.({ ...item, status: UPLOAD_STATUS.ERROR }, errorMessage);
      }
    }
  }, [updateFile, getThumbnailService]);

  /**
   * 🔑 并行上传控制器
   * 使用信号量模式控制并发数量
   */
  const startUploadInternal = useCallback(async (itemsToUpload: QueueItem[]) => {
    const { 
      maxConcurrent = 1,
      onAllComplete,
    } = configRef.current;

    setIsUploading(true);

    const waitingItems = itemsToUpload.filter(f => 
      f.status === UPLOAD_STATUS.WAITING || f.status === UPLOAD_STATUS.ERROR
    );

    if (waitingItems.length === 0) {
      setIsUploading(false);
      return;
    }

    console.log(`[startUploadInternal] 开始上传 ${waitingItems.length} 个文件，并发数: ${maxConcurrent}`);

    // 🔑 使用并发控制实现并行上传
    const uploadQueue = [...waitingItems];
    const activeUploads: Promise<void>[] = [];
    let completedCount = 0;

    const startNextUpload = async (): Promise<void> => {
      if (uploadQueue.length === 0) return;
      
      const item = uploadQueue.shift()!;
      try {
        await uploadSingleFile(item);
      } finally {
        completedCount++;
        // 当一个上传完成时，启动下一个
        if (uploadQueue.length > 0) {
          await startNextUpload();
        }
      }
    };

    // 启动初始的并发上传任务
    const concurrentCount = Math.min(maxConcurrent, waitingItems.length);
    for (let i = 0; i < concurrentCount; i++) {
      activeUploads.push(startNextUpload());
    }

    // 等待所有上传完成
    await Promise.all(activeUploads);

    setIsUploading(false);

    // 🔑 使用setTimeout确保在渲染完成后调用回调，避免在setFiles内部调用
    setTimeout(() => {
      // 获取最新的文件列表并调用回调
      const currentFiles = filesRef.current;
      // 🔑 修复：重新从 configRef 获取最新的回调，因为可能在上传过程中被更新
      const latestOnAllComplete = configRef.current.onAllComplete;
      if (latestOnAllComplete) {
        latestOnAllComplete(currentFiles);
      } else if (onAllComplete) {
        onAllComplete(currentFiles);
      }
    }, 0);
  }, [uploadSingleFile]);

  /**
   * 开始上传
   */
  const startUpload = useCallback(async () => {
    if (isUploading) return;
    await startUploadInternal(files);
  }, [files, isUploading, startUploadInternal]);

  /**
   * 暂停上传
   */
  const pauseUpload = useCallback(() => {
    // 🔑 先中止所有正在上传的文件的HTTP请求（在setFiles外部执行）
    abortControllersRef.current.forEach((controller, fileId) => {
      controller.abort();
      // 获取文件名用于日志
      const file = files.find(f => f.id === fileId);
      if (file) {
        console.log(`[pauseUpload] 中止文件 ${file.file.name} 的上传`);
      }
    });
    
    // 🔑 使用flushSync确保状态同步更新，避免React警告
    flushSync(() => {
      setIsPaused(true);
      setFiles(prev => prev.map(f => 
        f.status === UPLOAD_STATUS.UPLOADING 
          ? { ...f, status: UPLOAD_STATUS.PAUSED }
          : f
      ));
    });
  }, [files]);

  // 🔑 防止重复调用的锁
  const resumingFilesRef = useRef<Set<string>>(new Set());

  /**
   * 🔑 核心：恢复单个文件的上传（从暂停点继续）
   * 借鉴7DL的实现，使用已保存的sessionId和uploadedChunks继续上传
   */
  const resumeFileUpload = useCallback(async (item: QueueItem) => {
    // 🔑 防止重复调用
    if (resumingFilesRef.current.has(item.id)) {
      console.log(`[resumeFileUpload] 文件 ${item.file.name} 正在恢复中，跳过重复调用`);
      return;
    }
    resumingFilesRef.current.add(item.id);

    const { 
      folderId, 
      storageMode = 'rustfs', 
      compress = false,
      generateThumbnails = true,
      onFileComplete,
      onFileError,
    } = configRef.current;

    const file = item.file;
    const sessionId = sessionIdsRef.current.get(item.id);
    const uploadedChunks = [...(uploadedChunksRef.current.get(item.id) || [])]; // 🔑 复制数组避免引用问题

    console.log(`[resumeFileUpload] 恢复文件 ${file.name}, sessionId=${sessionId}, 已上传分片=${uploadedChunks.length}`);

    // 🔑 创建新的AbortController
    const abortController = new AbortController();
    abortControllersRef.current.set(item.id, abortController);

    // 🔑 使用flushSync确保状态立即更新
    flushSync(() => {
      updateFile(item.id, { 
        status: UPLOAD_STATUS.UPLOADING, 
        stageHint: UPLOAD_STAGE.UPLOADING,
      });
    });

    try {
      // 如果没有sessionId，说明是小文件或还没开始分片上传，需要重新开始
      if (!sessionId) {
        console.log(`[resumeFileUpload] 没有sessionId，重新开始上传`);
        // 小文件直接上传
        if (file.size <= SMALL_FILE_THRESHOLD) {
          updateFile(item.id, { stageHint: UPLOAD_STAGE.UPLOADING });
          
          const result = await apiClient.uploadFile(file, folderId, storageMode, (progress) => {
            updateFile(item.id, { progress });
          }, compress, generateThumbnails); // compress和generateThumbnail由开关控制

          updateFile(item.id, {
            status: UPLOAD_STATUS.SUCCESS,
            progress: 100,
            result,
          });
          onFileComplete?.({ ...item, status: UPLOAD_STATUS.SUCCESS, result });
          return;
        }

        // 大文件需要重新初始化
        updateFile(item.id, { stageHint: UPLOAD_STAGE.CHECKING });
        const initResult = await apiClient.initUpload({
          fileName: file.name,
          fileSize: file.size,
          fileMd5: '',
          mimeType: file.type || 'application/octet-stream',
          folderId,
          storageMode,
        });

        if (initResult.exists) {
          updateFile(item.id, {
            status: UPLOAD_STATUS.SUCCESS,
            progress: 100,
            stageHint: UPLOAD_STAGE.COMPLETED,
            isInstant: true,
          });
          onFileComplete?.({ ...item, status: UPLOAD_STATUS.SUCCESS, isInstant: true });
          return;
        }

        // 保存新的会话信息
        sessionIdsRef.current.set(item.id, initResult.sessionId);
        uploadedChunksRef.current.set(item.id, initResult.uploadedChunks || []);
        
        // 递归调用自己，使用新的sessionId继续
        await resumeFileUpload({ ...item, status: UPLOAD_STATUS.UPLOADING });
        return;
      }

      // 🔑 有sessionId，从暂停点继续上传
      // 获取分片信息
      const chunkSize = 5 * 1024 * 1024; // 5MB
      const chunkCount = Math.ceil(file.size / chunkSize);
      
      flushSync(() => {
        updateFile(item.id, { stageHint: UPLOAD_STAGE.UPLOADING });
      });

      const startTime = Date.now();
      // 🔑 正确计算已上传的字节数：考虑最后一个分片可能不足chunkSize
      let uploadedBytes = 0;
      for (const chunkIndex of uploadedChunks) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        uploadedBytes += (end - start);
      }
      // 🔑 记录恢复时的初始已上传字节数，用于计算速度
      const initialUploadedBytes = uploadedBytes;
      let wasAborted = false;

      console.log(`[resumeFileUpload] 继续上传: 总分片=${chunkCount}, 已上传=${uploadedChunks.length}, 已上传字节=${uploadedBytes}`);

      // 🔑 设置初始进度
      const initialProgress = Math.round((uploadedBytes / file.size) * 100);
      updateFile(item.id, { progress: initialProgress });

      for (let i = 0; i < chunkCount; i++) {
        // 🔑 检查是否被中止（暂停或取消）
        if (abortController.signal.aborted) {
          wasAborted = true;
          console.log(`[resumeFileUpload] 文件 ${file.name} 上传被中止，已完成 ${i}/${chunkCount} 分片`);
          break;
        }

        // 跳过已上传的分片
        if (uploadedChunks.includes(i)) continue;

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const chunkMd5 = await calculateChunkMd5(chunk);

        try {
          await apiClient.uploadChunk(sessionId, i, chunk, chunkMd5, undefined, abortController.signal);
          
          // 记录已上传的分片
          const currentChunks = uploadedChunksRef.current.get(item.id) || [];
          if (!currentChunks.includes(i)) {
            currentChunks.push(i);
            uploadedChunksRef.current.set(item.id, currentChunks);
          }
        } catch (err) {
          if ((err as Error).message === 'AbortError') {
            wasAborted = true;
            console.log(`[resumeFileUpload] 文件 ${file.name} 分片 ${i} 上传被中止`);
            break;
          }
          throw err;
        }

        uploadedBytes += chunk.size;
        const elapsed = (Date.now() - startTime) / 1000;
        // 🔑 速度计算：只计算本次恢复后上传的字节数
        const bytesUploadedThisSession = uploadedBytes - initialUploadedBytes;
        const speed = elapsed > 0 ? bytesUploadedThisSession / elapsed : 0;
        const remaining = speed > 0 ? (file.size - uploadedBytes) / speed : 0;
        const progress = Math.round((uploadedBytes / file.size) * 100);

        updateFile(item.id, {
          progress,
          speed,
          remainingTime: remaining,
        });
      }

      if (!wasAborted) {
        // 完成上传（传递压缩和缩略图开关）
        updateFile(item.id, { stageHint: UPLOAD_STAGE.MERGING });
        const completeResult = await apiClient.completeUpload(sessionId, compress, generateThumbnails);
        
        // 如果是视频文件，上传视频缩略图
        if (file.type.startsWith('video/') && completeResult?.fileId) {
          try {
            updateFile(item.id, { stageHint: UPLOAD_STAGE.MERGING });
            const service = getThumbnailService();
            const thumbnailBlob = await service.generateVideoThumbnailAsBlob(file, {
              width: 200,
              height: 200,
              quality: 0.8,
            });
            const videoName = file.name.replace(/\.[^/.]+$/, '');
            const thumbnailFile = new File([thumbnailBlob], `${videoName}_thumb.jpg`, { type: 'image/jpeg' });
            await apiClient.uploadVideoThumbnail(completeResult.fileId, thumbnailFile);
          } catch (thumbError) {
            console.warn('[resumeFileUpload] 视频缩略图生成/上传失败:', thumbError);
          }
        }
        
        // 构建result对象，包含压缩后的大小
        const result = {
          fileId: completeResult.fileId,
          url: completeResult.fileUrl,
          size: completeResult.size,
          mimeType: completeResult.mimeType,
        };
        updateFile(item.id, {
          status: UPLOAD_STATUS.SUCCESS,
          progress: 100,
          stageHint: UPLOAD_STAGE.COMPLETED,
          result,
        });
        onFileComplete?.({ ...item, status: UPLOAD_STATUS.SUCCESS, result });
        
        // 清理会话信息
        abortControllersRef.current.delete(item.id);
        sessionIdsRef.current.delete(item.id);
        uploadedChunksRef.current.delete(item.id);
      }
    } catch (error) {
      const errorMessage = (error as Error).message || '上传失败';
      if (errorMessage !== 'AbortError') {
        updateFile(item.id, {
          status: UPLOAD_STATUS.ERROR,
          error: errorMessage,
        });
        onFileError?.({ ...item, status: UPLOAD_STATUS.ERROR }, errorMessage);
      }
    } finally {
      // 🔑 清除恢复锁
      resumingFilesRef.current.delete(item.id);
    }
  }, [updateFile, getThumbnailService]);

  /**
   * 恢复上传（恢复所有暂停的文件）
   */
  const resumeUpload = useCallback(() => {
    setIsPaused(false);
    setIsUploading(true);
    
    // 🔑 获取所有暂停的文件，逐个恢复上传
    setFiles(prev => {
      const pausedFiles = prev.filter(f => f.status === UPLOAD_STATUS.PAUSED);
      
      if (pausedFiles.length > 0) {
        // 延迟启动恢复上传，确保状态更新完成
        setTimeout(async () => {
          for (const file of pausedFiles) {
            await resumeFileUpload(file);
          }
          setIsUploading(false);
        }, 50);
      } else {
        setIsUploading(false);
      }
      
      return prev;
    });
  }, [resumeFileUpload]);

  /**
   * 取消所有上传
   * 🔑 完全清除所有上传状态，重试时从头开始
   */
  const cancelAll = useCallback(async () => {
    // 🔑 中止所有正在进行的上传
    abortControllersRef.current.forEach((controller, fileId) => {
      controller.abort();
      console.log(`[cancelAll] 中止文件 ${fileId} 的上传`);
    });
    abortControllersRef.current.clear();
    
    // 🔑 通知后端取消所有上传会话
    const cancelPromises: Promise<void>[] = [];
    sessionIdsRef.current.forEach((sessionId) => {
      cancelPromises.push(
        apiClient.cancelUpload(sessionId).catch(err => {
          console.warn(`[cancelAll] 取消后端会话 ${sessionId} 失败:`, err);
        })
      );
    });
    await Promise.all(cancelPromises);
    
    sessionIdsRef.current.clear();
    uploadedChunksRef.current.clear();
    
    setIsUploading(false);
    setIsPaused(false);
    setFiles(prev => prev.map(f => 
      f.status === UPLOAD_STATUS.UPLOADING || f.status === UPLOAD_STATUS.PAUSED
        ? { ...f, status: UPLOAD_STATUS.CANCELLED, progress: 0, stageHint: undefined, speed: undefined, remainingTime: undefined }
        : f
    ));
  }, []);

  /**
   * 重试失败的文件
   * 🔑 修复：不依赖 isUploading 闭包值，直接强制启动上传
   */
  const retryFailed = useCallback(() => {
    // 使用flushSync确保状态同步更新，避免UI卡死
    let updatedFiles: QueueItem[] = [];
    flushSync(() => {
      // 🔑 强制重置 isUploading 状态，确保重试可以启动
      setIsUploading(false);
      setFiles(prev => {
        updatedFiles = prev.map(f => 
          f.status === UPLOAD_STATUS.ERROR || f.status === UPLOAD_STATUS.CANCELLED
            ? { ...f, status: UPLOAD_STATUS.WAITING, progress: 0, error: undefined, stageHint: '等待上传' }
            : f
        );
        return updatedFiles;
      });
    });
    
    // 🔑 检查是否有需要重试的文件
    const hasFilesToRetry = updatedFiles.some(f => f.status === UPLOAD_STATUS.WAITING);
    if (hasFilesToRetry) {
      setTimeout(() => {
        startUploadInternal(updatedFiles);
      }, 50);
    }
  }, [startUploadInternal]);

  /**
   * 重试单个文件
   * 🔑 修复：不依赖 isUploading 闭包值，直接强制启动上传
   */
  const retryFile = useCallback((id: string) => {
    // 使用flushSync确保状态同步更新，避免UI卡死
    let updatedFiles: QueueItem[] = [];
    let targetFileFound = false;
    flushSync(() => {
      // 🔑 强制重置 isUploading 状态，确保重试可以启动
      setIsUploading(false);
      setFiles(prev => {
        updatedFiles = prev.map(f => {
          if (f.id === id && (f.status === UPLOAD_STATUS.ERROR || f.status === UPLOAD_STATUS.CANCELLED)) {
            targetFileFound = true;
            return { ...f, status: UPLOAD_STATUS.WAITING, progress: 0, error: undefined, stageHint: '等待上传' };
          }
          return f;
        });
        return updatedFiles;
      });
    });
    
    // 🔑 只有找到需要重试的文件才启动上传
    if (targetFileFound) {
      setTimeout(() => {
        startUploadInternal(updatedFiles);
      }, 50);
    }
  }, [startUploadInternal]);

  /**
   * 暂停单个文件上传
   */
  const pauseFile = useCallback((id: string) => {
    // 🔑 中止该文件的HTTP请求
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      console.log(`[pauseFile] 中止文件 ${id} 的上传`);
    }
    
    flushSync(() => {
      setFiles(prev => prev.map(f => 
        f.id === id && f.status === UPLOAD_STATUS.UPLOADING
          ? { ...f, status: UPLOAD_STATUS.PAUSED }
          : f
      ));
    });
  }, []);

  /**
   * 恢复单个文件上传
   */
  const resumeFile = useCallback((id: string) => {
    // 🔑 先获取文件引用，避免在setFiles回调中调用异步函数
    let fileToResume: QueueItem | undefined;
    
    // 使用flushSync同步获取最新状态
    flushSync(() => {
      setFiles(prev => {
        fileToResume = prev.find(f => f.id === id && f.status === UPLOAD_STATUS.PAUSED);
        return prev;
      });
    });
    
    if (!fileToResume) {
      console.warn(`[resumeFile] 找不到暂停的文件: ${id}`);
      return;
    }
    
    setIsUploading(true);
    
    // 🔑 直接调用恢复上传函数（已有防重复调用锁）
    resumeFileUpload(fileToResume).finally(() => {
      // 检查是否还有其他正在上传的文件
      setFiles(current => {
        const stillUploading = current.some(f => f.status === UPLOAD_STATUS.UPLOADING);
        if (!stillUploading) {
          setIsUploading(false);
        }
        return current;
      });
    });
  }, [resumeFileUpload]);

  /**
   * 取消单个文件上传
   * 🔑 完全清除上传状态，重试时从头开始
   */
  const cancelFile = useCallback((id: string) => {
    // 🔑 中止该文件的HTTP请求
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      console.log(`[cancelFile] 中止文件 ${id} 的上传`);
    }
    
    // 🔑 清除恢复锁，防止恢复函数继续执行
    resumingFilesRef.current.delete(id);
    
    // 🔑 如果有会话ID，通知后端取消上传会话（不等待）
    const sessionId = sessionIdsRef.current.get(id);
    if (sessionId) {
      apiClient.cancelUpload(sessionId).catch(err => {
        // 忽略取消失败（可能会话已过期）
        console.warn(`[cancelFile] 取消后端会话失败:`, err);
      });
      console.log(`[cancelFile] 后端会话 ${sessionId} 取消请求已发送`);
    }
    
    // 🔑 清理本地会话信息
    abortControllersRef.current.delete(id);
    sessionIdsRef.current.delete(id);
    uploadedChunksRef.current.delete(id);
    
    // 🔑 更新状态：进度归零，清除stageHint，并检查是否需要重置 isUploading
    flushSync(() => {
      setFiles(prev => {
        const newFiles = prev.map(f => 
          f.id === id && (f.status === UPLOAD_STATUS.UPLOADING || f.status === UPLOAD_STATUS.PAUSED || f.status === UPLOAD_STATUS.WAITING)
            ? { ...f, status: UPLOAD_STATUS.CANCELLED, progress: 0, stageHint: undefined, speed: undefined, remainingTime: undefined }
            : f
        );
        // 🔑 检查是否还有正在上传的文件，如果没有则重置 isUploading
        const stillUploading = newFiles.some(f => f.status === UPLOAD_STATUS.UPLOADING);
        if (!stillUploading) {
          setIsUploading(false);
        }
        return newFiles;
      });
    });
  }, []);

  /**
   * 更新配置
   */
  const updateConfig = useCallback((newConfig: Partial<UploadQueueConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };
  }, []);

  // 计算统计数据
  const completedCount = files.filter(f => f.status === UPLOAD_STATUS.SUCCESS).length;
  const failedCount = files.filter(f => f.status === UPLOAD_STATUS.ERROR).length;
  const totalSpeed = files
    .filter(f => f.status === UPLOAD_STATUS.UPLOADING)
    .reduce((sum, f) => sum + (f.speed || 0), 0);

  // 清空所有文件
  const clearAll = useCallback(() => {
    // 🔑 中止所有正在进行的上传
    abortControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    abortControllersRef.current.clear();
    sessionIdsRef.current.clear();
    uploadedChunksRef.current.clear();
    setFiles([]);
    setIsUploading(false);
    setIsPaused(false);
  }, []);

  /**
   * 替换文件（用于裁剪后替换原图）
   * 保持原文件名，只替换文件内容，并重新生成缩略图
   */
  const replaceFile = useCallback(async (id: string, newFile: File) => {
    // 创建新的File对象，保持原文件名
    const originalFile = files.find(f => f.id === id);
    if (!originalFile || originalFile.status !== UPLOAD_STATUS.WAITING) return;

    const replacedFile = new File([newFile], originalFile.file.name, {
      type: newFile.type,
      lastModified: Date.now(),
    });

    // 先更新文件，清除旧缩略图
    setFiles(prev => prev.map(f => {
      if (f.id === id) {
        return {
          ...f,
          file: replacedFile,
          thumbnail: undefined, // 清除旧缩略图
        };
      }
      return f;
    }));

    // 异步生成新缩略图
    const thumbnail = await generateThumbnailForFile(replacedFile);
    if (thumbnail) {
      setFiles(prev => prev.map(f => 
        f.id === id ? { ...f, thumbnail } : f
      ));
    }
  }, [files, generateThumbnailForFile]);

  return {
    files,
    isUploading,
    isPaused,
    totalProgress,
    totalSpeed,
    completedCount,
    failedCount,
    addFiles,
    removeFile,
    clearQueue,
    clearAll,
    clearCompleted,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelAll,
    retryFailed,
    retryFile,
    pauseFile,
    resumeFile,
    cancelFile,
    replaceFile,
    updateConfig,
  };
}

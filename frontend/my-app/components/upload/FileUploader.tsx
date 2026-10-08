'use client';

/**
 * 文件上传器组件
 * 支持拖拽上传、多文件选择、分片上传、秒传
 * 
 * 注意：此组件使用旧版 useUploadQueue hook，与 AdvancedUploadDialog 的全局上传队列独立
 * 如需全局上传队列功能，请使用 AdvancedUploadDialog + UploadQueueContext
 */

import React, { useCallback, useRef, useState } from 'react';
import { useUploadQueue } from '@/hooks/useUploadQueue';
import { Button } from '@/components/ui/button';
import { Upload, FolderUp, CheckCircle, XCircle, Loader2, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UploadStatus } from '@/types/upload';

interface FileUploaderProps {
  folderId?: string;
  accept?: string;
  maxFileSize?: number;
  maxFiles?: number;
  onUploadComplete?: (fileId: string, url: string) => void;
  onUploadError?: (fileName: string, error: string) => void;
  className?: string;
}

export function FileUploader({
  folderId,
  accept,
  maxFileSize = 20 * 1024 * 1024 * 1024, // 20GB
  maxFiles = 100,
  onUploadComplete,
  onUploadError,
  className,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const {
    items,
    isUploading,
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
  } = useUploadQueue({
    folderId,
    onUploadComplete: (item) => {
      if (item.fileId && item.url) {
        onUploadComplete?.(item.fileId, item.url);
      }
    },
    onUploadError: (item, error) => {
      onUploadError?.(item.name, error.message);
    },
  });

  /**
   * 验证文件
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > maxFileSize) {
        return `文件大小超过限制 (最大 ${formatFileSize(maxFileSize)})`;
      }

      if (accept) {
        const acceptedTypes = accept.split(',').map((t) => t.trim());
        const fileExt = `.${file.name.split('.').pop()?.toLowerCase()}`;
        const isAccepted = acceptedTypes.some(
          (type) =>
            type === file.type ||
            type === fileExt ||
            (type.endsWith('/*') && file.type.startsWith(type.slice(0, -1))),
        );
        if (!isAccepted) {
          return '不支持的文件类型';
        }
      }

      return null;
    },
    [accept, maxFileSize],
  );

  /**
   * 处理文件选择
   */
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files).slice(0, maxFiles);
      const validFiles: File[] = [];
      const errors: string[] = [];

      fileArray.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push(file);
        }
      });

      if (errors.length > 0) {
        console.warn('文件验证失败:', errors);
      }

      if (validFiles.length > 0) {
        addFiles(validFiles);
        startUpload();
      }
    },
    [maxFiles, validateFile, addFiles, startUpload],
  );

  /**
   * 处理拖拽
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles],
  );

  /**
   * 点击选择文件
   */
  const handleSelectFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * 点击选择文件夹
   */
  const handleSelectFolder = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  /**
   * 文件输入变化
   */
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFiles(files);
      }
      e.target.value = '';
    },
    [handleFiles],
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* 拖拽区域 */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 transition-colors',
          isDragging
            ? 'border-[#409fff] bg-[#409fff]/10'
            : 'border-[#3a3a3a] hover:border-[#4a4a4a]',
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#262626] flex items-center justify-center">
            <Upload className="w-8 h-8 text-[#8e8e8e]" />
          </div>

          <div className="text-center">
            <p className="text-white font-medium">
              拖拽文件到此处上传
            </p>
            <p className="text-sm text-[#8e8e8e] mt-1">
              或点击下方按钮选择文件
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleSelectFiles}
              className="bg-[#262626] border-[#3a3a3a] hover:bg-[#2e2e2e]"
            >
              <Upload className="w-4 h-4 mr-2" />
              选择文件
            </Button>
            <Button
              variant="outline"
              onClick={handleSelectFolder}
              className="bg-[#262626] border-[#3a3a3a] hover:bg-[#2e2e2e]"
            >
              <FolderUp className="w-4 h-4 mr-2" />
              选择文件夹
            </Button>
          </div>

          <p className="text-xs text-[#8e8e8e]">
            支持单个文件最大 {formatFileSize(maxFileSize)}
          </p>
        </div>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-ignore - webkitdirectory is not in the type definition
          webkitdirectory=""
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* 上传队列（简化版，不使用全局 UploadQueue 组件） */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#8e8e8e]">{items.length} 个文件</span>
            {items.some(i => i.status === UploadStatus.SUCCESS) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCompleted}
                className="text-xs"
              >
                清除已完成
              </Button>
            )}
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-2 p-2 bg-[#262626] rounded text-sm"
              >
                {item.status === UploadStatus.SUCCESS && (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
                {item.status === UploadStatus.ERROR && (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                {item.status === UploadStatus.UPLOADING && (
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                )}
                {item.status === UploadStatus.PAUSED && (
                  <Pause className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                )}
                {item.status === UploadStatus.WAITING && (
                  <div className="w-4 h-4 rounded-full border-2 border-[#8e8e8e] flex-shrink-0" />
                )}
                <span className="truncate flex-1 text-white">{item.name}</span>
                <span className="text-[#8e8e8e] text-xs flex-shrink-0">
                  {item.progress}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

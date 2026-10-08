'use client'

import { getApiBaseUrl } from '@/lib/config';

/**
 * 简化版单图上传组件
 * 用于平台Logo等单张图片上传场景
 * 复用系统现有上传能力，提供极简交互界面
 */

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';

interface SimpleImageUploaderProps {
  value?: string;
  onChange: (value: string) => void;
  folderId?: string;
  realFolderId?: string;
  storageMode?: 'rustfs' | 'local';
  accept?: string;
  maxSize?: number; // 单位：MB
  className?: string;
  placeholder?: string;
  returnFileId?: boolean; // 是否返回 fileId 而不是 URL
}

export function SimpleImageUploader({
  value,
  onChange,
  folderId,
  realFolderId,
  storageMode,
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  maxSize = 5, // 默认5MB
  className,
  placeholder = '点击或拖拽上传图片',
  returnFileId = false,
}: SimpleImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * 验证文件
   */
  const validateFile = useCallback(
    (file: File): string | null => {
      // 检查文件类型
      const acceptedTypes = accept.split(',').map((t) => t.trim());
      const isAccepted = acceptedTypes.some(
        (type) =>
          type === file.type ||
          (type.endsWith('/*') && file.type.startsWith(type.slice(0, -1))),
      );
      if (!isAccepted) {
        return '不支持的文件类型';
      }

      // 检查文件大小
      if (file.size > maxSize * 1024 * 1024) {
        return `文件大小超过限制 (最大 ${maxSize}MB)`;
      }

      return null;
    },
    [accept, maxSize],
  );

  /**
   * 执行上传
   */
  const doUpload = useCallback(
    async (file: File) => {
      try {
        setIsUploading(true);
        setError(null);

        const result = await apiClient.uploadSingleFile(file, folderId, undefined, realFolderId, storageMode);

        if (returnFileId && result.fileId) {
          // 返回 fileId
          onChange(result.fileId);
        } else if (result.url) {
          onChange(result.url);
        } else if (result.fileId) {
          // 如果没有直接返回URL，尝试获取文件详情
          const fileDetail = await apiClient.getFileById(result.fileId);
          onChange(fileDetail.url || fileDetail.path);
        }
      } catch (err: any) {
        setError(err.message || '上传失败');
        console.error('上传失败:', err);
      } finally {
        setIsUploading(false);
      }
    },
    [folderId, realFolderId, storageMode, onChange, returnFileId],
  );

  /**
   * 处理文件选择
   */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
        doUpload(file);
      }
      // 清空input，允许重复选择同一文件
      e.target.value = '';
    },
    [validateFile, doUpload],
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

      const file = e.dataTransfer.files?.[0];
      if (file) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          return;
        }
        doUpload(file);
      }
    },
    [validateFile, doUpload],
  );

  /**
   * 点击上传区域
   */
  const handleClick = useCallback(() => {
    if (!isUploading) {
      inputRef.current?.click();
    }
  }, [isUploading]);

  /**
   * 清除已上传图片
   */
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange('');
      setError(null);
    },
    [onChange],
  );

  // 构建图片URL（如果value是fileId，则构建代理URL）
  // 后端代理接口: /api/v1/public/files/${fileId}/preview
  const API_BASE_URL = getApiBaseUrl();
  const imageUrl = value?.startsWith('http') 
    ? value 
    : value 
      ? `${API_BASE_URL}/public/files/${value}/preview` 
      : '';

  // 已上传状态
  if (value) {
    return (
      <div className={cn('relative group', className)}>
        <div className="relative w-full h-full rounded-lg overflow-hidden border border-border bg-muted">
          <img
            src={imageUrl}
            alt="已上传图片"
            className="w-full h-full object-contain"
          />
          {/* 悬停遮罩 */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClick}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              更换
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClear}
              disabled={isUploading}
            >
              <X className="w-4 h-4" />
              删除
            </Button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  // 未上传状态
  return (
    <div className={cn('relative w-full h-full', className)}>
      <div
        className={cn(
          'relative w-full h-full rounded-lg border-2 border-dashed transition-colors cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50 hover:bg-muted/50',
          isUploading && 'pointer-events-none opacity-60',
        )}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2">
          {isUploading ? (
            <>
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">上传中...</span>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium">{placeholder}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  支持 {accept.replace(/image\//g, '').replace(/,/g, '、')}，最大 {maxSize}MB
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive absolute -bottom-5 left-0">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

/**
 * useDropZone - 拖拽上传Hook
 * @module hooks/upload/useDropZone
 * 
 * 功能：
 * - 拖拽文件到指定区域
 * - 拖拽状态管理
 * - 文件类型过滤
 * 
 * 使用场景：
 * - 拖拽上传区域
 * - 自定义拖拽UI
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  validateFile, 
  type FileValidationConfig 
} from '../../lib/utils/upload';

/**
 * 拖拽区域配置
 */
export interface DropZoneConfig {
  /** 是否禁用 */
  disabled?: boolean;
  /** 接受的文件类型（MIME类型） */
  accept?: string[];
  /** 文件验证配置 */
  validation?: FileValidationConfig;
  /** 拖放文件后的回调 */
  onDrop?: (files: File[]) => void;
  /** 验证失败的回调 */
  onValidationError?: (file: File, error: string) => void;
  /** 拖拽进入时的回调 */
  onDragEnter?: () => void;
  /** 拖拽离开时的回调 */
  onDragLeave?: () => void;
}

/**
 * 拖拽区域结果
 */
export interface DropZoneResult {
  /** 是否正在拖拽 */
  isDragging: boolean;
  /** 是否拖拽在区域内 */
  isOver: boolean;
  /** 绑定到目标元素的props */
  dropZoneProps: {
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
  };
  /** 手动设置拖拽状态 */
  setIsDragging: (value: boolean) => void;
}

/**
 * useDropZone Hook
 * @param config - 配置选项
 * @returns 拖拽区域控制对象
 */
export function useDropZone(config: DropZoneConfig = {}): DropZoneResult {
  const {
    disabled = false,
    accept,
    validation,
    onDrop,
    onValidationError,
    onDragEnter,
    onDragLeave,
  } = config;

  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);
  const dragCounter = useRef(0);

  /**
   * 检查文件类型是否被接受
   */
  const isAcceptedType = useCallback((file: File): boolean => {
    // 如果没有指定accept或者accept包含*/*，则接受所有文件
    if (!accept || accept.length === 0 || accept.includes('*/*')) {
      return true;
    }

    return accept.some(type => {
      if (type.endsWith('/*')) {
        const prefix = type.slice(0, -1);
        return file.type.startsWith(prefix);
      }
      return file.type === type;
    });
  }, [accept]);

  /**
   * 处理拖拽进入
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    dragCounter.current++;
    
    if (dragCounter.current === 1) {
      setIsDragging(true);
      setIsOver(true);
      onDragEnter?.();
    }
  }, [disabled, onDragEnter]);

  /**
   * 处理拖拽悬停
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    // 设置拖拽效果
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [disabled]);

  /**
   * 处理拖拽离开
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    dragCounter.current--;
    
    if (dragCounter.current === 0) {
      setIsDragging(false);
      setIsOver(false);
      onDragLeave?.();
    }
  }, [disabled, onDragLeave]);

  /**
   * 处理文件放置
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current = 0;
    setIsDragging(false);
    setIsOver(false);

    if (disabled) return;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      return;
    }

    const fileArray = Array.from(files);
    const validFiles: File[] = [];

    for (const file of fileArray) {
      // 检查文件类型
      if (!isAcceptedType(file)) {
        onValidationError?.(file, '不支持的文件类型');
        continue;
      }

      // 验证文件
      if (validation) {
        const result = validateFile(file, validation);
        if (!result.valid) {
          onValidationError?.(file, result.error || '文件验证失败');
          continue;
        }
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0 && onDrop) {
      onDrop(validFiles);
    }
  }, [disabled, isAcceptedType, validation, onDrop, onValidationError]);

  /**
   * 监听全局拖拽事件（用于显示全局拖拽状态）
   */
  useEffect(() => {
    const handleGlobalDragEnter = () => {
      setIsDragging(true);
    };

    const handleGlobalDragLeave = (e: DragEvent) => {
      // 只有当拖拽离开窗口时才重置
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleGlobalDrop = () => {
      setIsDragging(false);
    };

    // 不需要全局监听，只在组件内处理
    return () => {};
  }, []);

  return {
    isDragging,
    isOver,
    dropZoneProps: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
    setIsDragging,
  };
}

/**
 * 快捷方法：图片拖拽区域
 */
export function useImageDropZone(
  onDrop: (files: File[]) => void,
  config?: Omit<DropZoneConfig, 'accept' | 'onDrop'>
): DropZoneResult {
  return useDropZone({
    ...config,
    accept: ['image/*'],
    onDrop,
  });
}

/**
 * 快捷方法：媒体文件拖拽区域
 */
export function useMediaDropZone(
  onDrop: (files: File[]) => void,
  config?: Omit<DropZoneConfig, 'accept' | 'onDrop'>
): DropZoneResult {
  return useDropZone({
    ...config,
    accept: ['image/*', 'video/*', 'audio/*'],
    onDrop,
  });
}

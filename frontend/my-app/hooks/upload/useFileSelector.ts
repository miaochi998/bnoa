/**
 * useFileSelector - 文件选择Hook
 * @module hooks/upload/useFileSelector
 * 
 * 功能：
 * - 触发文件选择对话框
 * - 支持多选/单选
 * - 支持文件类型过滤
 * - 返回选中的文件列表
 * 
 * 使用场景：
 * - 点击按钮选择文件
 * - 自定义文件选择UI
 */

'use client';

import { useCallback, useRef } from 'react';
import { 
  validateFile, 
  filterValidFiles,
  type FileValidationConfig 
} from '../../lib/utils/upload';

/**
 * 文件选择配置
 */
export interface FileSelectorConfig {
  /** 是否允许多选，默认true */
  multiple?: boolean;
  /** 接受的文件类型（MIME类型或扩展名） */
  accept?: string;
  /** 文件验证配置 */
  validation?: FileValidationConfig;
  /** 选择文件后的回调 */
  onSelect?: (files: File[]) => void;
  /** 验证失败的回调 */
  onValidationError?: (file: File, error: string) => void;
}

/**
 * 文件选择结果
 */
export interface FileSelectorResult {
  /** 打开文件选择对话框 */
  openFileSelector: () => void;
  /** 隐藏的input元素ref */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** 重置input */
  reset: () => void;
}

/**
 * useFileSelector Hook
 * @param config - 配置选项
 * @returns 文件选择控制对象
 */
export function useFileSelector(config: FileSelectorConfig = {}): FileSelectorResult {
  const {
    multiple = true,
    accept,
    validation,
    onSelect,
    onValidationError,
  } = config;

  const inputRef = useRef<HTMLInputElement | null>(null);

  /**
   * 处理文件选择
   */
  const handleChange = useCallback((event: Event) => {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    
    if (!files || files.length === 0) {
      return;
    }

    const fileArray = Array.from(files);

    // 验证文件
    if (validation) {
      const validFiles: File[] = [];
      
      for (const file of fileArray) {
        const result = validateFile(file, validation);
        if (result.valid) {
          validFiles.push(file);
        } else if (onValidationError) {
          onValidationError(file, result.error || '文件验证失败');
        }
      }

      if (validFiles.length > 0 && onSelect) {
        onSelect(validFiles);
      }
    } else {
      if (onSelect) {
        onSelect(fileArray);
      }
    }

    // 重置input以允许选择相同文件
    input.value = '';
  }, [validation, onSelect, onValidationError]);

  /**
   * 打开文件选择对话框
   */
  const openFileSelector = useCallback(() => {
    // 创建临时input元素
    if (!inputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.style.display = 'none';
      input.multiple = multiple;
      if (accept) {
        input.accept = accept;
      }
      input.addEventListener('change', handleChange);
      document.body.appendChild(input);
      inputRef.current = input;
    } else {
      // 更新属性
      inputRef.current.multiple = multiple;
      if (accept) {
        inputRef.current.accept = accept;
      }
    }

    inputRef.current.click();
  }, [multiple, accept, handleChange]);

  /**
   * 重置input
   */
  const reset = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  return {
    openFileSelector,
    inputRef,
    reset,
  };
}

/**
 * 快捷方法：选择图片
 */
export function useImageSelector(
  onSelect: (files: File[]) => void,
  config?: Omit<FileSelectorConfig, 'accept' | 'onSelect'>
): FileSelectorResult {
  return useFileSelector({
    ...config,
    accept: 'image/*',
    onSelect,
  });
}

/**
 * 快捷方法：选择视频
 */
export function useVideoSelector(
  onSelect: (files: File[]) => void,
  config?: Omit<FileSelectorConfig, 'accept' | 'onSelect'>
): FileSelectorResult {
  return useFileSelector({
    ...config,
    accept: 'video/*',
    onSelect,
  });
}

/**
 * 快捷方法：选择文档
 */
export function useDocumentSelector(
  onSelect: (files: File[]) => void,
  config?: Omit<FileSelectorConfig, 'accept' | 'onSelect'>
): FileSelectorResult {
  return useFileSelector({
    ...config,
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt',
    onSelect,
  });
}

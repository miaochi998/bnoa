/**
 * FileSelector - 文件选择按钮组件
 * @module components/upload/FileSelector
 * 
 * 功能：
 * - 点击选择文件
 * - 支持多选/单选
 * - 支持文件类型过滤
 * - 可自定义按钮样式
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Plus, FolderOpen } from 'lucide-react';
import { useFileSelector, type FileSelectorConfig } from '@/hooks/upload';
import { cn } from '@/lib/utils';

/**
 * 文件选择器Props
 */
export interface FileSelectorProps extends FileSelectorConfig {
  /** 按钮文本 */
  label?: string;
  /** 按钮变体 */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** 按钮大小 */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** 图标类型 */
  icon?: 'upload' | 'plus' | 'folder' | 'none';
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 子元素（自定义按钮内容） */
  children?: React.ReactNode;
}

/**
 * 图标映射
 */
const IconMap = {
  upload: Upload,
  plus: Plus,
  folder: FolderOpen,
  none: null,
};

/**
 * FileSelector组件
 */
export function FileSelector({
  label = '选择文件',
  variant = 'default',
  size = 'default',
  icon = 'upload',
  disabled = false,
  className,
  children,
  multiple = true,
  accept,
  validation,
  onSelect,
  onValidationError,
}: FileSelectorProps) {
  const { openFileSelector } = useFileSelector({
    multiple,
    accept,
    validation,
    onSelect,
    onValidationError,
  });

  const IconComponent = icon !== 'none' ? IconMap[icon] : null;

  const handleClick = () => {
    if (!disabled) {
      openFileSelector();
    }
  };

  // 如果有自定义子元素，渲染子元素
  if (children) {
    return (
      <div onClick={handleClick} className={cn('cursor-pointer', className)}>
        {children}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={handleClick}
      className={className}
    >
      {IconComponent && <IconComponent className="mr-2 h-4 w-4" />}
      {label}
    </Button>
  );
}

/**
 * 图片选择器
 */
export function ImageSelector(props: Omit<FileSelectorProps, 'accept'>) {
  return <FileSelector {...props} accept="image/*" />;
}

/**
 * 视频选择器
 */
export function VideoSelector(props: Omit<FileSelectorProps, 'accept'>) {
  return <FileSelector {...props} accept="video/*" />;
}

/**
 * 文档选择器
 */
export function DocumentSelector(props: Omit<FileSelectorProps, 'accept'>) {
  return (
    <FileSelector 
      {...props} 
      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" 
    />
  );
}

/**
 * 媒体选择器（图片+视频+音频）
 */
export function MediaSelector(props: Omit<FileSelectorProps, 'accept'>) {
  return (
    <FileSelector 
      {...props} 
      accept="image/*,video/*,audio/*" 
    />
  );
}

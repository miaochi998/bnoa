/**
 * DropZone - 拖拽上传区域组件
 * @module components/upload/DropZone
 * 
 * 功能：
 * - 拖拽文件到区域上传
 * - 拖拽状态视觉反馈
 * - 支持文件类型过滤
 * - 可自定义样式
 */

'use client';

import React from 'react';
import { Upload, FileUp } from 'lucide-react';
import { useDropZone, type DropZoneConfig } from '@/hooks/upload';
import { cn } from '@/lib/utils';

/**
 * 拖拽区域Props
 */
export interface DropZoneProps extends DropZoneConfig {
  /** 自定义类名 */
  className?: string;
  /** 默认提示文字 */
  hint?: string;
  /** 拖拽中提示文字 */
  dragHint?: string;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 最小高度 */
  minHeight?: string;
  /** 子元素 */
  children?: React.ReactNode;
}

/**
 * DropZone组件
 */
export function DropZone({
  className,
  hint = '拖拽文件到此处上传',
  dragHint = '松开鼠标上传文件',
  showIcon = true,
  minHeight = '200px',
  children,
  disabled = false,
  accept,
  validation,
  onDrop,
  onValidationError,
  onDragEnter,
  onDragLeave,
}: DropZoneProps) {
  const { isDragging, isOver, dropZoneProps } = useDropZone({
    disabled,
    accept,
    validation,
    onDrop,
    onValidationError,
    onDragEnter,
    onDragLeave,
  });

  return (
    <div
      {...dropZoneProps}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200',
        disabled
          ? 'cursor-not-allowed border-[#3e3e3e] bg-[#1e1e1e] opacity-50'
          : isOver
            ? 'border-[#409fff] bg-[#409fff]/10'
            : 'border-[#3e3e3e] bg-[#262626] hover:border-[#4e4e4e] hover:bg-[#2a2a2a]',
        className
      )}
      style={{ minHeight }}
    >
      {children ? (
        children
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          {showIcon && (
            <div
              className={cn(
                'mb-4 rounded-full p-4 transition-all duration-200',
                isOver
                  ? 'bg-[#409fff]/20 text-[#409fff]'
                  : 'bg-[#3e3e3e] text-[#8e8e8e]'
              )}
            >
              {isOver ? (
                <FileUp className="h-8 w-8" />
              ) : (
                <Upload className="h-8 w-8" />
              )}
            </div>
          )}
          <p
            className={cn(
              'text-sm font-medium transition-colors duration-200',
              isOver ? 'text-[#409fff]' : 'text-[#ffffff]'
            )}
          >
            {isOver ? dragHint : hint}
          </p>
          {accept && accept.length > 0 && (
            <p className="mt-2 text-xs text-[#8e8e8e]">
              支持的格式: {accept.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* 拖拽遮罩层 */}
      {isOver && (
        <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-[#409fff] bg-[#409fff]/5" />
      )}
    </div>
  );
}

/**
 * 图片拖拽区域
 */
export function ImageDropZone(props: Omit<DropZoneProps, 'accept'>) {
  return (
    <DropZone
      {...props}
      accept={['image/*']}
      hint={props.hint || '拖拽图片到此处上传'}
    />
  );
}

/**
 * 视频拖拽区域
 */
export function VideoDropZone(props: Omit<DropZoneProps, 'accept'>) {
  return (
    <DropZone
      {...props}
      accept={['video/*']}
      hint={props.hint || '拖拽视频到此处上传'}
    />
  );
}

/**
 * 媒体拖拽区域
 */
export function MediaDropZone(props: Omit<DropZoneProps, 'accept'>) {
  return (
    <DropZone
      {...props}
      accept={['image/*', 'video/*', 'audio/*']}
      hint={props.hint || '拖拽媒体文件到此处上传'}
    />
  );
}

/**
 * 紧凑型拖拽区域
 */
export function CompactDropZone(props: DropZoneProps) {
  return (
    <DropZone
      {...props}
      minHeight="80px"
      showIcon={false}
      className={cn('py-4', props.className)}
    />
  );
}

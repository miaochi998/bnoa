'use client';

import React from 'react';

/**
 * UploadQueue - 上传队列面板组件
 * 
 * 功能：
 * - 固定定位浮动面板（右下角）
 * - 显示上传队列状态和进度
 * - 支持暂停/继续/取消/重试操作
 * - 支持图片裁剪
 * 
 * 参考：7DL项目的UploadQueue组件
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  X, 
  RotateCcw, 
  CheckCircle, 
  AlertCircle, 
  FileIcon, 
  ImageIcon, 
  VideoIcon, 
  FileTextIcon, 
  Play, 
  Pause, 
  Music, 
  Archive, 
  Code, 
  FileSpreadsheet, 
  FileType, 
  Crop, 
  Square,
  Zap,
} from 'lucide-react';
import { type QueueItem } from '@/hooks/upload/useUploadQueue';
import { UPLOAD_STATUS, UPLOAD_STAGE } from '@/lib/utils/upload';

/**
 * UploadQueue 组件 Props
 */
export interface UploadQueueProps {
  /** 队列文件列表（使用BNOA现有类型） */
  items: QueueItem[];
  /** 是否显示面板，默认true */
  visible?: boolean;
  /** 面板位置，默认'bottom-right' */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** 总进度百分比 */
  totalProgress?: number;
  /** 总上传速度（字节/秒） */
  totalSpeed?: number;
  /** 是否正在上传 */
  isUploading?: boolean;
  /** 是否已暂停 */
  isPaused?: boolean;
  /** 关闭面板回调 */
  onClose?: () => void;
  /** 开始全部上传 */
  onStartAll?: () => void;
  /** 暂停全部上传 */
  onPauseAll?: () => void;
  /** 恢复全部上传 */
  onResumeAll?: () => void;
  /** 暂停单个文件 */
  onPause?: (id: string) => void;
  /** 继续单个文件 */
  onResume?: (id: string) => void;
  /** 取消单个文件 */
  onCancel?: (id: string) => void;
  /** 重试单个文件 */
  onRetry?: (id: string) => void;
  /** 移除单个文件 */
  onRemove?: (id: string) => void;
  /** 清空已完成 */
  onClearCompleted?: () => void;
  /** 清空全部 */
  onClearAll?: () => void;
  /** 预览文件（点击缩略图） */
  onPreview?: (item: QueueItem) => void;
  /** 裁剪图片（仅对waiting状态的图片文件有效） */
  onCrop?: (id: string) => void;
  /** 添加文件回调 */
  onAddFiles?: (files: File[]) => void;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 将英文状态翻译为中文
 */
function translateStageHint(stageHint?: string): string {
  if (!stageHint) return '';
  
  const translations: Record<string, string> = {
    [UPLOAD_STAGE.MD5]: '计算文件特征中...',
    [UPLOAD_STAGE.CHECKING]: '检查秒传中...',
    [UPLOAD_STAGE.COMPRESSING]: '压缩图片中...',
    [UPLOAD_STAGE.UPLOADING]: '上传中...',
    [UPLOAD_STAGE.MERGING]: '合并分片中...',
    [UPLOAD_STAGE.COMPLETED]: '已完成',
    // 兼容旧的中文提示
    '计算文件特征...': '计算文件特征中...',
    '检查秒传...': '检查秒传中...',
    '压缩图片...': '压缩图片中...',
    '上传中...': '上传中...',
    '合并分片...': '合并分片中...',
    '已完成': '已完成',
  };
  
  return translations[stageHint] || stageHint;
}

/**
 * 格式化上传速度
 */
function formatSpeed(bytesPerSecond?: number): string {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '';
  return `${formatFileSize(bytesPerSecond)}/s`;
}

/**
 * 格式化剩余时间
 */
function formatRemainingTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${Math.round(seconds)}秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`;
  return `${Math.round(seconds / 3600)}小时`;
}

/**
 * 获取文件类型图标
 */
function getFileTypeIcon(type: string, name: string) {
  const ext = name.toLowerCase().split('.').pop() || '';
  
  // 图片格式
  if (type.startsWith('image/')) {
    return <ImageIcon className="h-6 w-6 text-blue-500" />;
  }
  
  // 视频格式
  if (type.startsWith('video/')) {
    return <VideoIcon className="h-6 w-6 text-purple-500" />;
  }
  
  // 音频格式
  if (type.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'].includes(ext)) {
    return <Music className="h-6 w-6 text-green-500" />;
  }
  
  // PDF文档
  if (type === 'application/pdf' || ext === 'pdf') {
    return <FileTextIcon className="h-6 w-6 text-red-500" />;
  }
  
  // Office文档
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
    if (['xls', 'xlsx'].includes(ext)) {
      return <FileSpreadsheet className="h-6 w-6 text-green-600" />;
    }
    return <FileTextIcon className="h-6 w-6 text-blue-600" />;
  }
  
  // 压缩文件
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'].includes(ext)) {
    return <Archive className="h-6 w-6 text-yellow-600" />;
  }
  
  // 代码文件
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'dart'].includes(ext)) {
    return <Code className="h-6 w-6 text-indigo-500" />;
  }
  
  // 文本/配置文件
  if (['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'log'].includes(ext)) {
    return <FileType className="h-6 w-6 text-gray-600" />;
  }
  
  // 数据文件
  if (['csv', 'sql', 'db', 'sqlite', 'mdb'].includes(ext)) {
    return <FileSpreadsheet className="h-6 w-6 text-emerald-600" />;
  }
  
  // 默认图标
  return <FileIcon className="h-6 w-6 text-gray-500" />;
}

/**
 * 上传队列面板组件
 */
export function UploadQueue(props: UploadQueueProps) {
  const {
    items,
    visible = true,
    position = 'bottom-right',
    totalProgress: propTotalProgress,
    isUploading,
    isPaused,
    onClose,
    onStartAll,
    onPauseAll,
    onResumeAll,
    onPause,
    onResume,
    onCancel,
    onRetry,
    onRemove,
    onClearCompleted,
    onClearAll,
    onPreview,
    onCrop,
    onAddFiles,
  } = props;
  
  // 文件选择器引用
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onAddFiles?.(files);
    }
    e.target.value = '';
  };

  // 如果不可见或没有文件，不渲染
  if (!visible || items.length === 0) return null;

  // 计算统计数据
  const completedCount = items.filter(i => i.status === UPLOAD_STATUS.SUCCESS).length;
  const errorCount = items.filter(i => i.status === UPLOAD_STATUS.ERROR).length;
  const uploadingCount = items.filter(i => i.status === UPLOAD_STATUS.UPLOADING).length;
  const waitingCount = items.filter(i => i.status === UPLOAD_STATUS.WAITING).length;
  const pausedCount = items.filter(i => i.status === UPLOAD_STATUS.PAUSED).length;
  
  // 计算总进度（如果没有传入则自己计算）
  const totalProgress = propTotalProgress ?? (
    items.length > 0
      ? Math.round(items.reduce((sum, i) => sum + i.progress, 0) / items.length)
      : 0
  );

  // 位置样式
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
  };

  return (
    <Card
      className={cn(
        'fixed w-96 max-h-[600px] shadow-lg z-50 flex flex-col',
        positionClasses[position]
      )}
    >
      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      
      {/* 头部 - 紧凑版，无上边距 */}
      <div className="px-3 pt-1.5 pb-1 flex items-center justify-between bg-muted/50 rounded-t-lg">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight">上传队列</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>✅ {completedCount} 成功</span>
            {uploadingCount > 0 && <span>⏳ {uploadingCount} 上传中</span>}
            {pausedCount > 0 && <span>⏸ {pausedCount} 暂停</span>}
            {errorCount > 0 && <span className="text-destructive">❌ {errorCount} 失败</span>}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 总体进度 - 紧凑版，无上下边距 */}
      <div className="px-3 py-1 bg-background">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">总进度</span>
          <span className="font-medium">{Math.round(totalProgress)}%</span>
        </div>
        <Progress value={totalProgress} className="h-1.5 mt-0.5" />
      </div>

      {/* 文件列表 - 无上边距 */}
      <div className="overflow-y-auto flex-1 max-h-[400px] border-t">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-3 border-b hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* 缩略图或图标 */}
              <div className="w-12 h-12 rounded flex-shrink-0 overflow-hidden bg-muted flex items-center justify-center">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.file.name}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => onPreview?.(item)}
                  />
                ) : (
                  getFileTypeIcon(item.file.type || '', item.file.name)
                )}
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" title={item.file.name}>
                  {item.file.name}
                </p>
                
                {/* 文件大小和状态提示 */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {/* 上传成功后显示实际大小（可能是压缩后的） */}
                    {item.status === UPLOAD_STATUS.SUCCESS && item.result?.size
                      ? formatFileSize(item.result.size)
                      : formatFileSize(item.file.size)}
                  </span>
                  {/* 步骤提示 - 翻译为中文（仅在上传中显示） */}
                  {item.stageHint && item.status === UPLOAD_STATUS.UPLOADING && (
                    <span className="text-xs text-blue-500 dark:text-blue-400">
                      • {translateStageHint(item.stageHint)}
                    </span>
                  )}
                  {/* 秒传成功提示 */}
                  {item.status === UPLOAD_STATUS.SUCCESS && item.isInstant && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                      • 秒传成功
                      <Zap className="h-3 w-3 text-blue-500" />
                    </span>
                  )}
                </div>

                {/* 进度条 - 上传中 */}
                {item.status === UPLOAD_STATUS.UPLOADING && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <Progress value={item.progress} className="h-1 flex-1" />
                      <span className="text-xs font-medium text-muted-foreground w-8 text-right shrink-0">
                        {Math.round(item.progress)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {item.speed && item.speed > 0 && (
                        <span className="text-muted-foreground">
                          ⚡ {formatSpeed(item.speed)}
                        </span>
                      )}
                      {item.remainingTime && item.remainingTime > 0 && (
                        <span className="text-blue-600 dark:text-blue-400">
                          ⏱ 剩余 {formatRemainingTime(item.remainingTime)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 状态标识 - 成功（显示压缩比例） */}
                {item.status === UPLOAD_STATUS.SUCCESS && !item.isInstant && (
                  <div className="flex items-center gap-1 mt-2 text-xs">
                    <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-500" />
                    <span className="text-green-600 dark:text-green-500">上传成功</span>
                    {/* 如果压缩了，显示压缩比例 */}
                    {item.result?.size && item.result.size < item.file.size && (
                      <span className="text-green-500 ml-1">
                        (压缩 {Math.round((1 - item.result.size / item.file.size) * 100)}%)
                      </span>
                    )}
                  </div>
                )}

                {/* 状态标识 - 失败 */}
                {item.status === UPLOAD_STATUS.ERROR && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{item.error || '上传失败'}</span>
                    </div>
                  </div>
                )}

                {/* 状态标识 - 等待中 */}
                {item.status === UPLOAD_STATUS.WAITING && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                    <span>等待上传...</span>
                  </div>
                )}

                {/* 状态标识 - 已暂停 */}
                {item.status === UPLOAD_STATUS.PAUSED && (
                  <div className="mt-2 space-y-1">
                    <Progress value={item.progress} className="h-1" />
                    <div className="flex items-center gap-1 text-xs text-yellow-600">
                      <Pause className="h-3 w-3" />
                      <span>已暂停 ({item.progress}%)</span>
                    </div>
                  </div>
                )}

                {/* 状态标识 - 已取消 */}
                {item.status === UPLOAD_STATUS.CANCELLED && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                    <Square className="h-3 w-3" />
                    <span>已取消</span>
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-1 flex-shrink-0">
                {/* 等待中：显示裁剪按钮（仅图片类型） */}
                {item.status === UPLOAD_STATUS.WAITING && 
                 item.file.type?.startsWith('image/') && 
                 onCrop && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onCrop(item.id)}
                    className="h-8 w-8 p-0"
                    title="裁剪"
                  >
                    <Crop className="h-4 w-4" />
                  </Button>
                )}
                
                {/* 上传中：显示暂停按钮 */}
                {item.status === UPLOAD_STATUS.UPLOADING && onPause && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onPause(item.id)}
                    className="h-8 w-8 p-0"
                    title="暂停"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                
                {/* 暂停中：显示继续按钮（放在取消前面，避免误点） */}
                {item.status === UPLOAD_STATUS.PAUSED && onResume && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onResume(item.id)}
                    className="h-8 w-8 p-0"
                    title="继续"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                
                {/* 上传中/暂停中：显示取消按钮 */}
                {(item.status === UPLOAD_STATUS.UPLOADING || 
                  item.status === UPLOAD_STATUS.PAUSED) && 
                 onCancel && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancel(item.id)}
                    className="h-8 w-8 p-0"
                    title="取消上传"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                )}
                
                {/* 已取消/失败：显示重试按钮 */}
                {(item.status === UPLOAD_STATUS.CANCELLED || 
                  item.status === UPLOAD_STATUS.ERROR) && 
                 onRetry && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRetry(item.id)}
                    className="h-8 w-8 p-0"
                    title="重试"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                
                {/* 移除按钮：所有状态都可以移除 */}
                {onRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(item.id)}
                    className="h-8 w-8 p-0"
                    title="移除"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 底部操作 */}
      <div className="p-2 border-t bg-muted/30">
        <div className="flex justify-between items-center gap-2">
          {/* 左侧：开始上传/暂停/继续 */}
          <div className="flex gap-1.5 flex-1">
            {!isUploading && waitingCount > 0 && onStartAll && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onStartAll}
                className="h-8 text-xs"
              >
                开始上传 ({waitingCount})
              </Button>
            )}
            {isUploading && !isPaused && onPauseAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={onPauseAll}
              >
                <Pause className="h-3.5 w-3.5 mr-1" />
                暂停
              </Button>
            )}
            {isUploading && isPaused && onResumeAll && (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 text-xs"
                onClick={onResumeAll}
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                继续
              </Button>
            )}
          </div>
          
          {/* 右侧：添加文件 + 清理操作 */}
          <div className="flex gap-1.5">
            {/* 添加文件按钮 */}
            {onAddFiles && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                添加文件
              </Button>
            )}
            {completedCount > 0 && onClearCompleted && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={onClearCompleted}
              >
                清空已完成
              </Button>
            )}
            {onClearAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={onClearAll}
              >
                清空全部
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

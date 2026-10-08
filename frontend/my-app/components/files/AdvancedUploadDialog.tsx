'use client';

/**
 * AdvancedUploadDialog - 高级上传对话框
 * 
 * 改造后的职责：
 * - 提供文件选择界面（拖拽/点击选择）
 * - 配置上传选项（存储模式、压缩、缩略图）
 * - 将文件添加到全局上传队列
 * 
 * 不再负责：
 * - 队列UI展示（由 FloatingUploadQueue 负责）
 * - 图片裁剪（由 FloatingUploadQueue 负责）
 * - 上传状态管理（由 UploadQueueContext 负责）
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Upload,
  FolderOpen,
  HardDrive,
  Cloud,
  Settings,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

import { UploadRecoveryPrompt } from '@/components/upload/UploadRecoveryPrompt';
import { useUploadRecovery } from '@/hooks/upload/useUploadRecovery';
import { useUploadQueueContext } from '@/contexts/UploadQueueContext';
import { useDropZone } from '../../hooks/upload/useDropZone';
import { useUploadMode } from '../../hooks/upload/useUploadMode';
import { apiClient } from '../../lib/api';
import { UPLOAD_STATUS } from '../../lib/utils/upload';

interface AdvancedUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  onSuccess: () => void;
  /** 是否为管理员 */
  isAdmin?: boolean;
  /** 最大文件数量限制 */
  maxFiles?: number;
  /** 最大总大小限制（字节） */
  maxTotalSize?: number;
}

export function AdvancedUploadDialog({
  open,
  onOpenChange,
  folderId,
  onSuccess,
  isAdmin = false,
  maxFiles,
  maxTotalSize,
}: AdvancedUploadDialogProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [autoCompress, setAutoCompress] = useState(true);
  const [generateThumbnails, setGenerateThumbnails] = useState(true);
  
  // 🔑 从后端API读取并行上传配置
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  useEffect(() => {
    const fetchUploadConfig = async () => {
      try {
        const config = await apiClient.getUploadSettings();
        setMaxConcurrent(config.maxConcurrentUploads);
      } catch (e) {
        console.warn('Failed to read upload config, using default:', e);
      }
    };
    fetchUploadConfig();
  }, []);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // 🔑 使用全局上传队列 Context
  const uploadQueue = useUploadQueueContext();

  // 崩溃恢复Hook
  const {
    recoverableUploads,
    hasRecoverable,
    dismissRecoverable,
    clearAllRecoverable,
  } = useUploadRecovery({
    autoCheck: open, // 对话框打开时检查
    onRecoveryDetected: (uploads) => {
      console.log('[上传恢复] 检测到可恢复的上传:', uploads.length);
    },
  });

  const { mode, setMode, isRustFS, modeName } = useUploadMode({
    defaultMode: 'rustfs',
    persist: true,
  });

  // 🔑 使用 ref 保存 onSuccess 回调，避免闭包问题
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  // 🔑 当配置变化时，更新全局上传队列的配置
  // 注意：文件列表的刷新现在由 FilesPage 的 useEffect 监听 uploadQueue.completedCount 实现
  useEffect(() => {
    uploadQueue.updateConfig({
      folderId,
      storageMode: mode,
      compress: autoCompress,
      generateThumbnails,
      maxConcurrent,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId, mode, autoCompress, generateThumbnails, maxConcurrent]);

  const { isDragging, isOver, dropZoneProps } = useDropZone({
    disabled: uploadQueue.isUploading,
    onDrop: (droppedFiles: File[]) => {
      console.log('拖拽文件:', droppedFiles.map(f => f.name));
      // 暂时去除文件格式和大小限制，后续通过配置页面设置
      uploadQueue.addFiles(droppedFiles);
    },
    onValidationError: (file: File, error: string) => {
      console.warn('拖拽文件验证失败:', file.name, error);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      uploadQueue.addFiles(selectedFiles);
    }
    e.target.value = '';
  };

  /**
   * 关闭对话框
   * 改造后：对话框可以直接关闭，上传继续在后台进行
   * 队列状态由 FloatingUploadQueue 展示
   */
  const handleClose = () => {
    onOpenChange(false);
  };

  // 计算文件数量限制相关信息
  const currentFileCount = uploadQueue.files.length;
  const canAddMore = maxFiles === undefined || currentFileCount < maxFiles;

  const pendingCount = uploadQueue.files.filter(f => f.status === UPLOAD_STATUS.WAITING).length;
  const canStart = pendingCount > 0 && !uploadQueue.isUploading;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              上传文件
            </DialogTitle>
            <div className="flex items-center gap-1 mr-6">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showSettings ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setShowSettings(!showSettings)}
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>上传设置</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <DialogDescription className="sr-only">
            支持多文件批量上传，拖拽或选择文件开始上传
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col">
          {showSettings && (
            <div className="px-6 py-3 bg-muted/30 border-b border-border">
              <div className="flex items-center gap-4 flex-wrap">
                {isAdmin && (
                  <>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={mode === 'rustfs' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMode('rustfs')}
                        disabled={uploadQueue.isUploading}
                        className="h-7 text-xs gap-1.5"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        RUSTFS
                      </Button>
                      <Button
                        variant={mode === 'local' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setMode('local')}
                        disabled={uploadQueue.isUploading}
                        className="h-7 text-xs gap-1.5"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        本地
                      </Button>
                    </div>
                    <div className="h-4 w-px bg-border" />
                  </>
                )}
                <div className="flex items-center gap-2">
                  <Label htmlFor="auto-compress" className="text-xs text-muted-foreground cursor-pointer">自动压缩图片</Label>
                  <Switch
                    id="auto-compress"
                    checked={autoCompress}
                    onCheckedChange={setAutoCompress}
                    disabled={uploadQueue.isUploading}
                    className="scale-75"
                  />
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <Label htmlFor="gen-thumb" className="text-xs text-muted-foreground cursor-pointer">生成缩略图</Label>
                  <Switch
                    id="gen-thumb"
                    checked={generateThumbnails}
                    onCheckedChange={setGenerateThumbnails}
                    disabled={uploadQueue.isUploading}
                    className="scale-75"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 崩溃恢复提示 */}
          {hasRecoverable && !uploadQueue.isUploading && (
            <div className="px-6 py-2">
              <UploadRecoveryPrompt
                recoverableUploads={recoverableUploads}
                onDismiss={dismissRecoverable}
                onDismissAll={clearAllRecoverable}
                showDetails={true}
              />
            </div>
          )}

          <div className="px-6 py-4">
            <div
              {...dropZoneProps}
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200',
                isOver ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-muted-foreground',
                isDragging && 'border-primary/50',
                uploadQueue.isUploading && 'pointer-events-none opacity-50'
              )}
            >
              <Upload className={cn(
                'w-10 h-10 mx-auto mb-3 transition-colors',
                isOver ? 'text-primary' : 'text-muted-foreground'
              )} />
              <p className="text-foreground font-medium mb-1">
                {isOver ? '松开鼠标上传文件' : '拖拽文件到此处上传'}
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                支持多文件批量上传，单个文件最大 20GB
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadQueue.isUploading}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  选择文件
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={uploadQueue.isUploading}
                  className="gap-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  选择文件夹
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <input
                ref={folderInputRef}
                type="file"
                multiple
                // @ts-expect-error webkitdirectory is not in the type definition
                webkitdirectory=""
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          {/* 队列状态摘要（简化版，详细队列在 FloatingUploadQueue 中显示） */}
          {uploadQueue.files.length > 0 && (
            <div className="px-6 py-3 border-t border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-foreground font-medium">
                    {uploadQueue.files.length} 个文件已添加到队列
                  </span>
                  {uploadQueue.completedCount > 0 && (
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {uploadQueue.completedCount} 完成
                    </Badge>
                  )}
                  {uploadQueue.failedCount > 0 && (
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {uploadQueue.failedCount} 失败
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {mode === 'rustfs' ? (
              <Cloud className="w-4 h-4 text-primary" />
            ) : (
              <HardDrive className="w-4 h-4 text-orange-500" />
            )}
            <span>{modeName}</span>
            {folderId && (
              <>
                <span>·</span>
                <span>目标文件夹已选择</span>
              </>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              关闭
            </Button>
            <Button onClick={uploadQueue.startUpload} disabled={!canStart}>
              <Upload className="w-4 h-4 mr-2" />
              开始上传 {pendingCount > 0 && `(${pendingCount})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

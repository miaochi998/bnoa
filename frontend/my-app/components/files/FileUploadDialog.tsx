'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import {
  calculateFileMd5,
  calculateChunkMd5,
  formatFileSize,
  formatSpeed,
  formatRemainingTime,
  getFileTypeIcon,
  DEFAULT_CHUNK_SIZE,
  SMALL_FILE_THRESHOLD,
} from '@/lib/file-utils';
import { ThumbnailService } from '@/lib/services/ThumbnailService';
import {
  validateFileSecurity,
  validateFilesBatch,
  type FileValidationResult,
} from '@/lib/utils/upload/validateFileSecurity';
import {
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  Pause,
  Play,
  FolderOpen,
  HardDrive,
  Cloud,
  ShieldAlert,
} from 'lucide-react';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  onSuccess: () => void;
}

interface UploadTask {
  file: File;
  status: 'pending' | 'hashing' | 'checking' | 'uploading' | 'success' | 'error' | 'paused' | 'instant';
  progress: number;
  speed: number;
  remainingTime: number;
  error?: string;
  sessionId?: string;
  uploadedChunks: number[];
  totalChunks: number;
  isInstantUpload?: boolean;
}

type StorageMode = 'rustfs' | 'local';

export function FileUploadDialog({ open, onOpenChange, folderId, onSuccess }: FileUploadDialogProps) {
  const [tasks, setTasks] = useState<Map<string, UploadTask>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [storageMode, setStorageMode] = useState<StorageMode>('rustfs');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<Map<string, boolean>>(new Map());
  const thumbnailServiceRef = useRef<ThumbnailService>(new ThumbnailService());

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = async (newFiles: File[]) => {
    // 前端预验证：在添加文件前检查格式和大小
    const { valid, invalid } = await validateFilesBatch(newFiles);
    
    // 显示验证失败的文件错误
    if (invalid.length > 0) {
      invalid.forEach(({ file, result }) => {
        // 将验证失败的文件添加到任务列表，状态为error
        setTasks(prev => {
          const newMap = new Map(prev);
          if (!newMap.has(file.name)) {
            newMap.set(file.name, {
              file,
              status: 'error',
              progress: 0,
              speed: 0,
              remainingTime: 0,
              uploadedChunks: [],
              totalChunks: 0,
              error: result.errors.join('; '),
            });
          }
          return newMap;
        });
      });
    }
    
    // 添加验证通过的文件
    if (valid.length > 0) {
      setTasks(prev => {
        const newMap = new Map(prev);
        valid.forEach(file => {
          if (!newMap.has(file.name)) {
            newMap.set(file.name, {
              file,
              status: 'pending',
              progress: 0,
              speed: 0,
              remainingTime: 0,
              uploadedChunks: [],
              totalChunks: Math.ceil(file.size / DEFAULT_CHUNK_SIZE),
            });
          }
        });
        return newMap;
      });
    }
  };

  const removeFile = (fileName: string) => {
    abortControllerRef.current.set(fileName, true);
    setTasks(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileName);
      return newMap;
    });
  };

  const updateTask = (fileName: string, updates: Partial<UploadTask>) => {
    setTasks(prev => {
      const newMap = new Map(prev);
      const task = newMap.get(fileName);
      if (task) {
        newMap.set(fileName, { ...task, ...updates });
      }
      return newMap;
    });
  };

  const uploadSingleFile = async (task: UploadTask) => {
    const { file } = task;
    const fileName = file.name;

    try {
      // 小文件直接上传
      if (file.size <= SMALL_FILE_THRESHOLD) {
        updateTask(fileName, { status: 'uploading' });
        
        const uploadResult = await apiClient.uploadFile(file, folderId, storageMode, (progress) => {
          updateTask(fileName, { progress });
        });

        // 如果是视频文件，生成并上传缩略图
        // 注意：后端返回的是 fileId 而不是 id
        const fileId = (uploadResult as any)?.fileId || (uploadResult as any)?.id;
        if (file.type.startsWith('video/') && fileId) {
          try {
            console.log('[FileUploadDialog] 开始为视频生成缩略图:', fileName, 'fileId:', fileId);
            const thumbnailBlob = await thumbnailServiceRef.current.generateVideoThumbnailAsBlob(file, {
              width: 200,
              height: 200,
              quality: 0.8,
              seekTime: 0,
            });
            
            // 将缩略图上传到服务器
            const videoName = fileName.replace(/\.[^/.]+$/, '');
            const thumbnailFile = new File([thumbnailBlob], `${videoName}_thumb.jpg`, { type: 'image/jpeg' });
            
            await apiClient.uploadVideoThumbnail(fileId, thumbnailFile);
            console.log('[FileUploadDialog] 视频缩略图上传成功:', fileName);
          } catch (thumbError) {
            console.warn('[FileUploadDialog] 视频缩略图生成/上传失败（不影响上传）:', thumbError);
          }
        }

        updateTask(fileName, { status: 'success', progress: 100 });
        return true;
      }

      // 大文件分片上传
      // 1. 计算文件MD5
      updateTask(fileName, { status: 'hashing', progress: 0 });
      const fileMd5 = await calculateFileMd5(file);

      if (abortControllerRef.current.get(fileName)) return false;

      // 2. 初始化上传会话（同时检查秒传）
      updateTask(fileName, { status: 'checking' });
      const initResult = await apiClient.initUpload({
        fileName: file.name,
        fileSize: file.size,
        fileMd5,
        mimeType: file.type || 'application/octet-stream',
        folderId,
        storageMode,
      });

      // 3. 秒传成功
      if (initResult.exists) {
        updateTask(fileName, { status: 'instant', progress: 100, isInstantUpload: true });
        return true;
      }

      if (abortControllerRef.current.get(fileName)) return false;

      // 4. 分片上传
      const { sessionId, chunkSize, chunkCount, uploadedChunks } = initResult;
      updateTask(fileName, {
        status: 'uploading',
        sessionId,
        totalChunks: chunkCount,
        uploadedChunks: uploadedChunks || [],
      });

      const startTime = Date.now();
      let uploadedBytes = (uploadedChunks?.length || 0) * chunkSize;

      for (let i = 0; i < chunkCount; i++) {
        if (abortControllerRef.current.get(fileName)) {
          await apiClient.cancelUpload(sessionId);
          return false;
        }

        // 跳过已上传的分片（断点续传）
        if (uploadedChunks?.includes(i)) continue;

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const chunkMd5 = await calculateChunkMd5(chunk);

        await apiClient.uploadChunk(sessionId, i, chunk, chunkMd5);

        uploadedBytes += chunk.size;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = uploadedBytes / elapsed;
        const remaining = (file.size - uploadedBytes) / speed;
        const progress = Math.round((uploadedBytes / file.size) * 100);

        updateTask(fileName, {
          progress,
          speed,
          remainingTime: remaining,
          uploadedChunks: [...(uploadedChunks || []), i],
        });
      }

      // 5. 完成上传
      await apiClient.completeUpload(sessionId);
      updateTask(fileName, { status: 'success', progress: 100 });
      return true;

    } catch (error: any) {
      updateTask(fileName, {
        status: 'error',
        error: error.message || '上传失败',
      });
      return false;
    }
  };

  const uploadFiles = async () => {
    const pendingTasks = Array.from(tasks.values()).filter(t => t.status === 'pending');
    if (pendingTasks.length === 0) return;

    setIsUploading(true);
    abortControllerRef.current.clear();

    let successCount = 0;

    for (const task of pendingTasks) {
      const success = await uploadSingleFile(task);
      if (success) successCount++;
    }

    setIsUploading(false);

    if (successCount > 0) {
      onSuccess();
    }

    if (successCount === pendingTasks.length) {
      setTimeout(() => {
        handleClose();
      }, 1500);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setTasks(new Map());
      abortControllerRef.current.clear();
      onOpenChange(false);
    }
  };

  const pendingTasks = Array.from(tasks.values()).filter(t => t.status === 'pending');
  const canUpload = pendingTasks.length > 0 && !isUploading;
  const allTasks = Array.from(tasks.values());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">上传文件</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 存储方式选择 */}
          <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
            <Cloud className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-foreground">存储方式</span>
            <div className="flex-1" />
            <div className="flex gap-2">
              <Button
                variant={storageMode === 'rustfs' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStorageMode('rustfs')}
                disabled={isUploading}
                className="gap-2"
              >
                <Cloud className="w-4 h-4" />
                RUSTFS对象存储
              </Button>
              <Button
                variant={storageMode === 'local' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStorageMode('local')}
                disabled={isUploading}
                className="gap-2"
              >
                <HardDrive className="w-4 h-4" />
                本地服务器
              </Button>
            </div>
          </div>

          {/* Drop Zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200',
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground',
              isUploading && 'pointer-events-none opacity-50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-foreground font-medium mb-2">
              拖拽文件到此处上传
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              或点击下方按钮选择文件
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                选择文件
              </Button>
              <Button
                variant="outline"
                onClick={() => folderInputRef.current?.click()}
                disabled={isUploading}
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
              onChange={handleFolderSelect}
            />
            <p className="text-xs text-muted-foreground mt-4">
              • 支持多文件批量上传 • 单个文件最大 20GB
            </p>
          </div>

          {/* File List */}
          {allTasks.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {allTasks.map((task) => (
                <div
                  key={task.file.name}
                  className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                >
                  <span className="text-2xl">{getFileTypeIcon(task.file.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {task.file.name}
                      </p>
                      {task.isInstantUpload && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-xs">
                          <Zap className="w-3 h-3 mr-1" />
                          秒传
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(task.file.size)}</span>
                      {task.status === 'uploading' && task.speed > 0 && (
                        <>
                          <span>·</span>
                          <span>{formatSpeed(task.speed)}</span>
                          <span>·</span>
                          <span>剩余 {formatRemainingTime(task.remainingTime)}</span>
                        </>
                      )}
                      {task.status === 'hashing' && <span>· 计算文件特征...</span>}
                      {task.status === 'checking' && <span>· 检查秒传...</span>}
                    </div>
                    {(task.status === 'uploading' || task.status === 'hashing') && (
                      <Progress value={task.progress} className="h-1 mt-2" />
                    )}
                    {task.status === 'error' && (
                      <p className="text-xs text-destructive mt-1">{task.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(task.status === 'uploading' || task.status === 'hashing' || task.status === 'checking') && (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    )}
                    {(task.status === 'success' || task.status === 'instant') && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {task.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                    {task.status === 'pending' && !isUploading && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeFile(task.file.name)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {allTasks.length > 0 ? `已选择 ${allTasks.length} 个文件` : '未选择文件'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isUploading}>
              {isUploading ? '上传中...' : '取消'}
            </Button>
            <Button onClick={uploadFiles} disabled={!canUpload}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  开始上传
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

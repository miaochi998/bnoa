'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileItem } from '@/types/file';
import {
  X,
  Download,
  Share2,
  FileIcon,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Archive,
  ExternalLink,
} from 'lucide-react';

interface FilePreviewProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare?: (file: FileItem) => void;
  canDownload?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('zh-CN');
}

function getFileTypeInfo(mimeType: string): { icon: React.ReactNode; label: string; color: string } {
  if (mimeType.startsWith('image/')) {
    return { icon: <ImageIcon className="w-5 h-5" />, label: '图片', color: 'bg-green-500/10 text-green-500' };
  }
  if (mimeType.startsWith('video/')) {
    return { icon: <Film className="w-5 h-5" />, label: '视频', color: 'bg-purple-500/10 text-purple-500' };
  }
  if (mimeType.startsWith('audio/')) {
    return { icon: <Music className="w-5 h-5" />, label: '音频', color: 'bg-pink-500/10 text-pink-500' };
  }
  if (mimeType.includes('pdf')) {
    return { icon: <FileText className="w-5 h-5" />, label: 'PDF', color: 'bg-red-500/10 text-red-500' };
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return { icon: <FileText className="w-5 h-5" />, label: '文档', color: 'bg-blue-500/10 text-blue-500' };
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return { icon: <FileText className="w-5 h-5" />, label: '表格', color: 'bg-green-500/10 text-green-500' };
  }
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) {
    return { icon: <Archive className="w-5 h-5" />, label: '压缩包', color: 'bg-yellow-500/10 text-yellow-500' };
  }
  return { icon: <FileIcon className="w-5 h-5" />, label: '文件', color: 'bg-muted text-muted-foreground' };
}

function isPreviewable(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    mimeType === 'application/pdf'
  );
}

export function FilePreview({ file, open, onOpenChange, onShare, canDownload = true }: FilePreviewProps) {
  const [imageError, setImageError] = useState(false);

  if (!file) return null;

  const typeInfo = getFileTypeInfo(file.mimeType);
  const canPreview = isPreviewable(file.mimeType);
  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');

  const handleDownload = () => {
    if (file.url) {
      window.open(file.url, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] bg-card border-border">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-foreground flex items-center gap-2">
            {typeInfo.icon}
            <span className="truncate max-w-[400px]">{file.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview Area */}
          <div className="bg-muted/30 rounded-lg overflow-hidden">
            {canPreview && isImage && !imageError ? (
              <div className="flex items-center justify-center p-4 min-h-[300px] max-h-[400px]">
                <img
                  src={file.url || file.thumbnailUrl}
                  alt={file.name}
                  className="max-w-full max-h-[380px] object-contain rounded"
                  onError={() => setImageError(true)}
                />
              </div>
            ) : canPreview && isVideo ? (
              <div className="flex items-center justify-center p-4">
                <video
                  src={file.url}
                  controls
                  autoPlay
                  muted
                  className="w-full max-h-[400px] rounded"
                >
                  您的浏览器不支持视频播放
                </video>
              </div>
            ) : canPreview && isAudio ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className={`p-6 rounded-full ${typeInfo.color} mb-4`}>
                  {typeInfo.icon}
                </div>
                <p className="text-foreground font-medium mb-4">{file.name}</p>
                <audio src={file.url} controls className="w-full max-w-md">
                  您的浏览器不支持音频播放
                </audio>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className={`p-6 rounded-full ${typeInfo.color} mb-4`}>
                  {typeInfo.icon}
                </div>
                <p className="text-foreground font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {canPreview ? '无法预览此文件' : '此文件类型不支持预览'}
                </p>
              </div>
            )}
          </div>

          {/* File Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">文件类型</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className={typeInfo.color}>
                  {typeInfo.label}
                </Badge>
                <span className="text-sm text-foreground">{file.extension.toUpperCase()}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">文件大小</p>
              <p className="text-sm text-foreground mt-1">{formatFileSize(file.size)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">上传时间</p>
              <p className="text-sm text-foreground mt-1">{formatDate(file.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">所在文件夹</p>
              <p className="text-sm text-foreground mt-1">{file.folderName || '根目录'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {onShare && (
              <Button variant="outline" onClick={() => onShare(file)}>
                <Share2 className="w-4 h-4 mr-2" />
                分享
              </Button>
            )}
            {canDownload && file.url && (
              <Button variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                下载
              </Button>
            )}
            {canDownload && file.url && (
              <Button onClick={() => window.open(file.url, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                在新窗口打开
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

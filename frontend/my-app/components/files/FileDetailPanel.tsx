'use client';

import { useState } from 'react';
import { FileItem } from '@/types/file';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  X,
  FileIcon,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Archive,
  Calendar,
  HardDrive,
  FolderOpen,
  Tag,
  Download,
  Share2,
  Eye,
  Play,
  Volume2,
  Hash,
} from 'lucide-react';

interface FileDetailPanelProps {
  file: FileItem | null;
  onClose: () => void;
  onDownload?: (file: FileItem) => void;
  onShare?: (file: FileItem) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFileTypeLabel(mimeType: string, extension?: string): string {
  const ext = extension?.toLowerCase().replace(/^\./, '') || '';
  
  // 优先使用扩展名判断常见文件类型
  const extensionMap: Record<string, string> = {
    // 压缩文件
    'rar': 'RAR',
    'zip': 'ZIP',
    '7z': '7Z',
    'tar': 'TAR',
    'gz': 'GZ',
    'bz2': 'BZ2',
    'xz': 'XZ',
    'iso': 'ISO',
    // 文档
    'pdf': 'PDF',
    'doc': 'Word',
    'docx': 'Word',
    'xls': 'Excel',
    'xlsx': 'Excel',
    'ppt': 'PowerPoint',
    'pptx': 'PowerPoint',
    'txt': 'TXT',
    'rtf': 'RTF',
    'odt': 'ODT',
    'ods': 'ODS',
    'odp': 'ODP',
    // 图片
    'jpg': 'JPEG',
    'jpeg': 'JPEG',
    'png': 'PNG',
    'gif': 'GIF',
    'bmp': 'BMP',
    'webp': 'WebP',
    'svg': 'SVG',
    'ico': 'ICO',
    'tiff': 'TIFF',
    'tif': 'TIFF',
    'psd': 'PSD',
    'ai': 'AI',
    'eps': 'EPS',
    // 视频
    'mp4': 'MP4',
    'avi': 'AVI',
    'mkv': 'MKV',
    'mov': 'MOV',
    'wmv': 'WMV',
    'flv': 'FLV',
    'webm': 'WebM',
    'm4v': 'M4V',
    // 音频
    'mp3': 'MP3',
    'wav': 'WAV',
    'flac': 'FLAC',
    'aac': 'AAC',
    'm4a': 'M4A',
    'ogg': 'OGG',
    'wma': 'WMA',
    // 代码
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'jsx': 'JSX',
    'tsx': 'TSX',
    'py': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'h': 'C Header',
    'cs': 'C#',
    'php': 'PHP',
    'rb': 'Ruby',
    'go': 'Go',
    'rs': 'Rust',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'dart': 'Dart',
    // 配置/数据
    'json': 'JSON',
    'xml': 'XML',
    'yaml': 'YAML',
    'yml': 'YAML',
    'toml': 'TOML',
    'ini': 'INI',
    'conf': 'Config',
    'csv': 'CSV',
    'sql': 'SQL',
    'md': 'Markdown',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'less': 'LESS',
    // 可执行文件
    'exe': 'EXE',
    'msi': 'MSI',
    'dmg': 'DMG',
    'app': 'APP',
    'apk': 'APK',
    'deb': 'DEB',
    'rpm': 'RPM',
  };
  
  // 如果扩展名在映射表中，直接返回
  if (ext && extensionMap[ext]) {
    return extensionMap[ext];
  }
  
  // 否则使用mimeType判断
  if (mimeType.startsWith('image/')) return mimeType.split('/')[1].toUpperCase();
  if (mimeType.startsWith('video/')) return mimeType.split('/')[1].toUpperCase();
  if (mimeType.startsWith('audio/')) return mimeType.split('/')[1].toUpperCase();
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'Word';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel';
  if (mimeType.includes('zip')) return 'ZIP';
  if (mimeType.includes('rar')) return 'RAR';
  
  // 如果有扩展名，返回大写的扩展名
  if (ext) {
    return ext.toUpperCase();
  }
  
  // 最后尝试从mimeType中提取
  const mimeSubtype = mimeType.split('/')[1];
  if (mimeSubtype && mimeSubtype !== 'octet-stream') {
    return mimeSubtype.toUpperCase();
  }
  
  return '未知';
}

function getFileIcon(mimeType: string) {
  const sizeClass = 'w-5 h-5';
  if (mimeType.startsWith('image/')) return <ImageIcon className={`${sizeClass} text-green-500`} />;
  if (mimeType.startsWith('video/')) return <Film className={`${sizeClass} text-purple-500`} />;
  if (mimeType.startsWith('audio/')) return <Music className={`${sizeClass} text-pink-500`} />;
  if (mimeType.includes('pdf')) return <FileText className={`${sizeClass} text-red-500`} />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className={`${sizeClass} text-blue-500`} />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileText className={`${sizeClass} text-green-500`} />;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive className={`${sizeClass} text-yellow-500`} />;
  return <FileIcon className={`${sizeClass} text-muted-foreground`} />;
}

function getLargeFileIcon(mimeType: string) {
  const sizeClass = 'w-16 h-16';
  if (mimeType.startsWith('image/')) return <ImageIcon className={`${sizeClass} text-green-500`} />;
  if (mimeType.startsWith('video/')) return <Film className={`${sizeClass} text-purple-500`} />;
  if (mimeType.startsWith('audio/')) return <Music className={`${sizeClass} text-pink-500`} />;
  if (mimeType.includes('pdf')) return <FileText className={`${sizeClass} text-red-500`} />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className={`${sizeClass} text-blue-500`} />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileText className={`${sizeClass} text-green-500`} />;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return <Archive className={`${sizeClass} text-yellow-500`} />;
  return <FileIcon className={`${sizeClass} text-muted-foreground`} />;
}

export function FileDetailPanel({ file, onClose, onDownload, onShare }: FileDetailPanelProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<'image' | 'video' | 'audio' | 'document' | null>(null);

  if (!file) {
    return null;
  }

  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isPdf = file.mimeType.includes('pdf');
  const isDocument = file.mimeType.includes('word') || file.mimeType.includes('document') || 
                     file.mimeType.includes('excel') || file.mimeType.includes('spreadsheet');

  const handlePreviewClick = () => {
    if (isImage) {
      setPreviewType('image');
      setPreviewOpen(true);
    } else if (isVideo) {
      setPreviewType('video');
      setPreviewOpen(true);
    } else if (isAudio) {
      setPreviewType('audio');
      setPreviewOpen(true);
    } else if (isPdf || isDocument) {
      setPreviewType('document');
      setPreviewOpen(true);
    }
  };

  const canPreview = isImage || isVideo || isAudio || isPdf;

  return (
    <>
      <Card className="bg-card border-border p-4 mt-4 mb-4 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileIcon className="w-4 h-4" />
            文件详情
          </h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 缩略图/预览区域 - 宽度固定，高度自适应，始终显示缩略图 */}
        <div 
          className={`relative w-full rounded-lg overflow-hidden bg-muted/30 mb-4 ${canPreview ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
          onClick={canPreview ? handlePreviewClick : undefined}
        >
          {isImage && (file.thumbnailUrl || file.url) ? (
            <>
              <img
                src={file.thumbnailUrl || file.url}
                alt={file.name}
                className="w-full h-auto object-contain"
              />
            </>
          ) : (isVideo || isAudio) && file.thumbnailUrl ? (
            <>
              <img
                src={file.thumbnailUrl}
                alt={file.name}
                className="w-full h-auto object-contain"
              />
              {/* 播放按钮覆盖层 */}
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-6 h-6 text-gray-800 ml-1" />
                  </div>
                </div>
              )}
              {isAudio && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Volume2 className="w-6 h-6 text-gray-800" />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* 非图片/视频文件显示大图标 */
            <div className="w-full py-8 flex items-center justify-center">
              {getLargeFileIcon(file.mimeType)}
            </div>
          )}
        </div>

        {/* 文件信息 */}
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <FileIcon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-muted-foreground">文件名: </span>
              <span className="text-foreground break-all">{file.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">大小: </span>
            <span className="text-foreground">{formatFileSize(file.size)}</span>
          </div>
          <div className="flex items-start gap-2">
            <FolderOpen className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-muted-foreground">路径: </span>
              <span className="text-foreground break-all text-xs">{file.path || '-'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">创建: </span>
            <span className="text-foreground">{formatDate(file.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">修改: </span>
            <span className="text-foreground">{formatDate(file.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">类型: </span>
            <span className="text-foreground">{getFileTypeLabel(file.mimeType, file.extension)}</span>
          </div>
          {file.md5 && (
            <div className="flex items-start gap-2">
              <Hash className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-muted-foreground">MD5: </span>
                <span className="text-foreground text-xs font-mono break-all">{file.md5}</span>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 - 紧凑布局 */}
        <div className="flex gap-1 mt-4">
          {canPreview && (
            <Button variant="outline" size="sm" className="flex-1 px-2" onClick={handlePreviewClick}>
              <Eye className="w-4 h-4" />
            </Button>
          )}
          {onDownload && (
            <Button variant="outline" size="sm" className="flex-1 px-2" onClick={() => onDownload(file)}>
              <Download className="w-4 h-4" />
            </Button>
          )}
          {onShare && (
            <Button variant="outline" size="sm" className="flex-1 px-2" onClick={() => onShare(file)}>
              <Share2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* 预览弹窗 - 自适应尺寸，隐藏默认关闭按钮 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent 
          className="p-0 border-0 bg-transparent w-auto max-w-none [&>button]:hidden flex items-center justify-center"
          style={{ maxWidth: '95vw', maxHeight: '95vh' }}
        >
          <DialogTitle className="sr-only">预览 {file.name}</DialogTitle>
          <div className="relative bg-black/90 rounded-lg overflow-hidden flex items-center justify-center">
            {/* 关闭按钮 */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-50 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setPreviewOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>

            {/* 图片预览 - 完整显示，自适应尺寸 */}
            {previewType === 'image' && (
              <img
                src={file.url}
                alt={file.name}
                className="block"
                style={{ 
                  maxWidth: '95vw', 
                  maxHeight: '95vh', 
                  width: 'auto', 
                  height: 'auto',
                  objectFit: 'contain' 
                }}
              />
            )}

            {/* 视频预览 - 完整显示，自适应尺寸 */}
            {previewType === 'video' && (
              <video
                src={file.url}
                controls
                autoPlay
                style={{ 
                  maxWidth: '95vw', 
                  maxHeight: '95vh', 
                  width: 'auto', 
                  height: 'auto' 
                }}
              />
            )}

            {/* 音频预览 */}
            {previewType === 'audio' && (
              <div className="p-8 bg-gray-900 rounded-lg">
                <div className="flex flex-col items-center gap-4">
                  <Music className="w-16 h-16 text-pink-500" />
                  <p className="text-white text-center max-w-md truncate">{file.name}</p>
                  <audio
                    src={file.url}
                    controls
                    autoPlay
                    className="w-full max-w-md"
                  />
                </div>
              </div>
            )}

            {/* PDF预览 */}
            {previewType === 'document' && isPdf && (
              <div className="p-8 bg-gray-900 rounded-lg text-center">
                <FileText className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <p className="text-white mb-2">{file.name}</p>
                <p className="text-gray-400 text-sm mb-4">点击下方按钮在新窗口中预览PDF</p>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => window.open(file.url, '_blank')}>
                    <Eye className="w-4 h-4 mr-2" />
                    在新窗口预览
                  </Button>
                  {onDownload && (
                    <Button variant="outline" onClick={() => onDownload(file)}>
                      <Download className="w-4 h-4 mr-2" />
                      下载
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 其他文档类型提示 */}
            {previewType === 'document' && !isPdf && (
              <div className="p-8 bg-gray-900 rounded-lg text-center">
                <FileText className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <p className="text-white mb-2">{file.name}</p>
                <p className="text-gray-400 text-sm mb-4">此文档格式暂不支持在线预览</p>
                {onDownload && (
                  <Button onClick={() => onDownload(file)}>
                    <Download className="w-4 h-4 mr-2" />
                    下载查看
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

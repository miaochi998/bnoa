'use client';

/**
 * 业务缩略图：统一 40px 缩略图 + 无图占位 + 点击查看大图。
 * - 优先使用 /thumbnail（上传时生成），失败回退 /preview（老数据无缩略图）。
 * - 权限由调用方控制（是否渲染、是否允许预览）。
 */

import { useEffect, useState } from 'react';
import { Eye, Package } from 'lucide-react';
import {
  getFilePreviewUrl,
  getFileThumbnailUrl,
} from '@/lib/api';

export interface ImageThumbProps {
  fileId?: string | null;
  alt?: string;
  size?: number;
  className?: string;
  onPreview?: (fileId: string, alt?: string) => void;
}

export function ImageThumb({
  fileId,
  alt = '',
  size = 40,
  className = '',
  onPreview,
}: ImageThumbProps) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    setStage(0);
  }, [fileId]);

  if (!fileId || stage >= 2) {
    return (
      <div
        className={`rounded-md bg-[#1e1e1e] border border-[#3e3e3e] flex items-center justify-center shrink-0 ${className}`}
        style={{ width: size, height: size }}
        title={alt || '暂无图片'}
      >
        <Package
          className="text-[#8e8e8e]"
          style={{ width: size * 0.42, height: size * 0.42 }}
        />
      </div>
    );
  }

  const src =
    stage === 0
      ? getFileThumbnailUrl(fileId)
      : getFilePreviewUrl(fileId);

  return (
    <div
      className={`relative rounded-md overflow-hidden bg-[#1e1e1e] border border-[#3e3e3e] shrink-0 ${
        onPreview ? 'cursor-pointer group' : ''
      } ${className}`}
      style={{ width: size, height: size }}
      title={onPreview ? '查看大图' : alt}
      onClick={() => onPreview?.(fileId, alt)}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setStage((s) => s + 1)}
      />
      {onPreview && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Eye className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

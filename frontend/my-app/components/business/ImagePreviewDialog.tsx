'use client';

/**
 * 图片大图预览遮罩。
 * 使用自定义 fixed 遮罩而非 Radix Dialog，避免在 Dialog 内嵌套 Dialog 的层级问题。
 */

import { X } from 'lucide-react';
import { getFilePreviewUrl } from '@/lib/api';

export interface ImagePreviewDialogProps {
  open: boolean;
  fileId: string | null;
  alt?: string;
  onClose: () => void;
}

export function ImagePreviewDialog({
  open,
  fileId,
  alt = '',
  onClose,
}: ImagePreviewDialogProps) {
  if (!open || !fileId) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#262626] border border-[#3e3e3e] text-white flex items-center justify-center hover:bg-[#363636] transition-colors duration-200 cursor-pointer"
        title="关闭"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={getFilePreviewUrl(fileId)}
        alt={alt || '图片预览'}
        className="max-w-full max-h-[85vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

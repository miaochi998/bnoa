'use client';

/**
 * 图片大图预览。
 *
 * 使用 Radix Dialog（而非自定义 fixed 遮罩）有两个原因：
 *  1) DialogContent 会 Portal 到 body，尺寸相对视口计算，图片按 max-h 自适应，
 *     不会因为在其他 Dialog 内部渲染而受父级 transform/overflow 影响出现滚动条；
 *  2) Radix 支持 Dialog 嵌套：在内层（预览）打开时，外层弹窗不会被 pointer-down-outside
 *     关闭，用户看完大图可以继续浏览原弹窗。
 */

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="bg-transparent border-0 p-0 shadow-none gap-0 w-auto max-w-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">
          {alt || '图片预览'}
        </DialogTitle>
        <img
          src={getFilePreviewUrl(fileId)}
          alt={alt || '图片预览'}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        />
      </DialogContent>
    </Dialog>
  );
}

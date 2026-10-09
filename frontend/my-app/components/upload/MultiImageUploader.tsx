'use client';

/**
 * 多图上传组件（累加式）
 *
 * 复用系统统一上传能力 `apiClient.uploadFile`：
 * - 渠道由 `storageMode` 透传（rustfs / local），不写死；
 * - 返回体的文件标识字段是 `fileId`（**不是** `id`，历史上取 id 会导致附件静默丢失）；
 * - 展示一律用 `getFileThumbnailUrl` / `getFilePreviewUrl`（前端拼地址，规避 SERVER_BASE_URL 陷阱）。
 */

import { useCallback, useRef, useState } from 'react';
import { apiClient, getFilePreviewUrl, getFileThumbnailUrl } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface MultiImageUploaderProps {
  /** 已上传文件的 fileId 列表 */
  value: string[];
  onChange: (fileIds: string[]) => void;
  /** 数量上限，默认 9 */
  maxCount?: number;
  folderId?: string;
  realFolderId?: string;
  storageMode?: 'local' | 'rustfs';
  /** 允许的文件类型，默认图片 */
  accept?: string;
  /** 单文件大小上限（MB），默认 10 */
  maxSize?: number;
  label?: string;
  hint?: string;
}

/** /upload/file 返回体（后端字段名为 fileId） */
interface UploadResult {
  fileId?: string;
  id?: string;
}

interface PendingItem {
  key: string;
  name: string;
  progress: number;
}

export function MultiImageUploader({
  value,
  onChange,
  maxCount = 9,
  folderId,
  realFolderId,
  storageMode,
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  maxSize = 10,
  label,
  hint,
}: MultiImageUploaderProps) {
  const fileIds = Array.isArray(value) ? value : [];
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 正在上传中的数量（用于并发点击时仍能正确限制总数）
  const pendingRef = useRef(0);

  const validateFile = useCallback(
    (file: File): string | null => {
      const accepted = accept
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const typeOk = accepted.some(
        (t) =>
          t === file.type ||
          (t.endsWith('/*') && file.type.startsWith(t.slice(0, -1))),
      );
      if (!typeOk) return `${file.name}：不支持的文件类型`;
      if (file.size > maxSize * 1024 * 1024) {
        return `${file.name}：超过 ${maxSize}MB`;
      }
      return null;
    },
    [accept, maxSize],
  );

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const all = Array.from(fileList);

      const used = fileIds.length + pendingRef.current;
      const remain = Math.max(0, maxCount - used);
      if (remain === 0) {
        toast.error(`最多上传 ${maxCount} 张，已达上限`);
        return;
      }
      if (all.length > remain) {
        toast.error(`最多上传 ${maxCount} 张，本次仅上传前 ${remain} 张`);
      }
      const targets = all.slice(0, remain);

      let next = [...fileIds];

      for (let i = 0; i < targets.length; i += 1) {
        const file = targets[i];
        const invalid = validateFile(file);
        if (invalid) {
          toast.error(invalid);
          continue;
        }

        const key = `${Date.now()}-${i}-${file.name}`;
        pendingRef.current += 1;
        setPending((prev) => [...prev, { key, name: file.name, progress: 0 }]);

        try {
          const res = (await apiClient.uploadFile(
            file,
            folderId,
            storageMode,
            (p) =>
              setPending((prev) =>
                prev.map((x) => (x.key === key ? { ...x, progress: p } : x)),
              ),
            true,
            true,
            realFolderId,
          )) as unknown as UploadResult;

          const fileId = res?.fileId || res?.id;
          if (!fileId) throw new Error('上传返回缺少文件标识');

          next = [...next, fileId];
          onChange(next);
        } catch (e) {
          const msg = e instanceof Error ? e.message : '上传失败';
          toast.error(`${file.name}：${msg}`);
        } finally {
          pendingRef.current = Math.max(0, pendingRef.current - 1);
          setPending((prev) => prev.filter((x) => x.key !== key));
        }
      }
    },
    [
      fileIds,
      folderId,
      maxCount,
      onChange,
      realFolderId,
      storageMode,
      validateFile,
    ],
  );

  const removeAt = (fileId: string) => {
    onChange(fileIds.filter((id) => id !== fileId));
  };

  const full = fileIds.length + pending.length >= maxCount;

  return (
    <div className="space-y-2">
      {(label || hint) && (
        <div className="flex items-center justify-between gap-2">
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-2">
        {fileIds.map((fileId) => (
          <div
            key={fileId}
            className="group relative h-20 w-20 overflow-hidden rounded-md border border-border bg-card"
          >
            <button
              type="button"
              className="h-full w-full cursor-pointer transition-colors duration-200 hover:brightness-110"
              title="点击查看大图"
              onClick={() => setPreview(getFilePreviewUrl(fileId))}
            >
              {/* 缩略图走后端代理接口，后端未生成缩略图时会回落到原图 */}
              <img
                src={getFileThumbnailUrl(fileId)}
                alt="已上传图片"
                className="h-full w-full object-cover"
                onError={(e) => {
                  const el = e.currentTarget;
                  const fallback = getFilePreviewUrl(fileId);
                  if (el.src !== fallback) el.src = fallback;
                }}
              />
            </button>
            <button
              type="button"
              title="删除"
              onClick={() => removeAt(fileId)}
              className="absolute right-1 top-1 hidden h-5 w-5 cursor-pointer items-center justify-center rounded bg-black/70 text-white transition-colors duration-200 hover:bg-destructive group-hover:flex"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        {pending.map((p) => (
          <div
            key={p.key}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-primary/60 bg-card text-xs text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{p.progress}%</span>
          </div>
        ))}

        <button
          type="button"
          disabled={full}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input text-xs text-muted-foreground transition-colors duration-200',
            full
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:border-primary hover:text-foreground',
          )}
        >
          <ImagePlus className="h-4 w-4" />
          <span>{fileIds.length}/{maxCount}</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>图片预览</DialogTitle>
          </DialogHeader>
          {preview && (
            <img
              src={preview}
              alt="图片预览"
              className="max-h-[80vh] w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

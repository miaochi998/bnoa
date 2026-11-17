'use client';

/**
 * 成品组成弹窗：产品 / 耗材 / 工费明细 + 金额。
 * 点击「成品组成」按钮时才拉取数据。
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';
import { ImageThumb } from './ImageThumb';
import { ImagePreviewDialog } from './ImagePreviewDialog';
import { CompositionDetail } from './CompositionDetail';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finishedProductId: string | null;
}

export function FinishedProductCompositionDialog({
  open,
  onOpenChange,
  finishedProductId,
}: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    fileId: string;
    alt?: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !finishedProductId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    apiClient
      .getFinishedProductComposition(finishedProductId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: any) => {
        if (!cancelled) {
          setError(e?.message || '加载成本组成失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, finishedProductId]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#262626] border-[#1e1e1e] text-white sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              成品组成
              {data?.finishedProduct?.name
                ? ` - ${data.finishedProduct.name}`
                : ''}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#8e8e8e]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-[#f59e0b]">
              {error}
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <ImageThumb
                  fileId={data.finishedProduct?.image}
                  alt={data.finishedProduct?.name || '成品图片'}
                  size={48}
                  onPreview={(fileId, alt) =>
                    setPreview({ fileId, alt })
                  }
                />
                <div className="min-w-0">
                  <div className="text-white font-medium truncate">
                    {data.finishedProduct?.name}
                  </div>
                  <div className="text-xs text-[#8e8e8e] mt-0.5">
                    {data.finishedProduct?.code}
                    {data.finishedProduct?.weight != null &&
                      ` · 成品重量 ${Number(data.finishedProduct.weight)}kg`}
                  </div>
                </div>
              </div>

              <CompositionDetail
                data={data}
                onPreview={(fileId, alt) =>
                  setPreview({ fileId, alt })
                }
              />

              {data.computed &&
                data.computed.matchesCached === false && (
                  <div className="flex items-start gap-2 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-2 text-xs text-[#fcd48b]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      按当前价格重算的成本与缓存成本不一致（可能刚改过耗材/工费价格），
                      建议回到列表点「重算成本」。
                    </span>
                  </div>
                )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ImagePreviewDialog
        open={!!preview}
        fileId={preview?.fileId || null}
        alt={preview?.alt}
        onClose={() => setPreview(null)}
      />
    </>
  );
}

'use client';

/**
 * SKU 成本组成弹窗：SKU 汇总 + 按成品分组的三层成本明细。
 * SKU 管理、链接管理、定价计算、历史方案 4 处共用。
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  Truck,
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
import {
  CompositionDetail,
  money,
} from './CompositionDetail';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skuId: string | null;
}

export function SkuCompositionDialog({
  open,
  onOpenChange,
  skuId,
}: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    fileId: string;
    alt?: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !skuId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    apiClient
      .getSkuComposition(skuId)
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
  }, [open, skuId]);

  const summaryItems = data
    ? [
        { key: 'productCost', label: '成品成本' },
        { key: 'comboPackageFee', label: '组合包装费' },
        { key: 'expressCost', label: '快递费' },
        { key: 'miscFee', label: '综合费用' },
        { key: 'totalCost', label: '总成本', total: true },
      ]
    : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#262626] border-[#1e1e1e] text-white sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              SKU 成本组成
              {data?.sku?.name ? ` - ${data.sku.name}` : ''}
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
              <div className="text-xs text-[#8e8e8e]">
                {data.sku?.link?.name || '-'}
                {data.sku?.link?.shop
                  ? ` · ${data.sku.link.shop.platform?.name || ''} ${data.sku.link.shop.name || ''}`
                  : ''}
                {data.sku?.type ? ` · ${data.sku.type}` : ''}
                {data.sku?.weight != null
                  ? ` · 重量 ${Number(data.sku.weight)}kg`
                  : ''}
              </div>

              {/* 汇总卡 */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {summaryItems.map((item) => (
                  <div
                    key={item.key}
                    className={`rounded-lg border px-3 py-2 ${
                      item.total
                        ? 'border-[#409fff]/50 bg-[#409fff]/10'
                        : 'border-[#3e3e3e] bg-[#202020]'
                    }`}
                  >
                    <div className="text-[11px] text-[#8e8e8e] mb-1">
                      {item.label}
                    </div>
                    <div
                      className={`text-base font-semibold ${
                        item.total ? 'text-[#409fff]' : 'text-white'
                      }`}
                    >
                      {money(data.costs?.[item.key])}
                    </div>
                  </div>
                ))}
              </div>

              {/* 快递信息 */}
              <div className="flex items-center gap-2 rounded-lg border border-[#3e3e3e] bg-[#202020] px-3 py-2 text-xs text-[#b7b7b7]">
                <Truck className="w-4 h-4 text-[#8e8e8e]" />
                {data.sku?.express?.companyName
                  ? `快递费：${data.sku.express.companyName} · 计费重量 ${Number(data.sku.express.weight || 0)}kg`
                  : '未设置默认快递公司，快递费按 0 计'}
              </div>

              {/* 按成品分组 */}
              {data.finishedProducts.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#8e8e8e]">
                  该 SKU 未关联成品
                </div>
              ) : (
                data.finishedProducts.map(
                  (item: any, idx: number) => (
                    <div
                      key={
                        item.finishedProduct?.finishedProduct
                          ?.id || idx
                      }
                      className="rounded-lg border border-[#3e3e3e] overflow-hidden"
                    >
                      <div className="flex items-center gap-3 bg-[#202020] px-3 py-2">
                        <ImageThumb
                          fileId={
                            item.finishedProduct
                              ?.finishedProduct?.image
                          }
                          alt={
                            item.finishedProduct
                              ?.finishedProduct?.name || ''
                          }
                          size={32}
                          onPreview={(fileId, alt) =>
                            setPreview({ fileId, alt })
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-white font-medium">
                            成品 #{idx + 1}：
                            {
                              item.finishedProduct
                                ?.finishedProduct?.name
                            }
                          </span>
                          <span className="ml-2 text-xs text-[#8e8e8e]">
                            × {item.quantity}
                          </span>
                        </div>
                        <div className="text-xs text-[#8e8e8e]">
                          单价 {money(item.unitCost)}
                        </div>
                        <div className="text-[#409fff] font-medium text-sm">
                          {money(item.amount)}
                        </div>
                      </div>
                      <div className="p-3">
                        <CompositionDetail
                          data={item.finishedProduct}
                          onPreview={(fileId, alt) =>
                            setPreview({ fileId, alt })
                          }
                        />
                      </div>
                    </div>
                  ),
                )
              )}

              {data.computed &&
                data.computed.matchesCached === false && (
                  <div className="flex items-start gap-2 rounded-lg border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-2 text-xs text-[#fcd48b]">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      明细重算合计 {money(data.computed.totalCost)}
                      与 SKU 缓存成本不一致，建议点「重算成本」。
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

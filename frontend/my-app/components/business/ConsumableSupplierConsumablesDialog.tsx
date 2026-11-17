'use client';

/**
 * 耗材供应商「管理耗材」弹窗（只读）：
 * 展示该供应商当前供货的耗材，以及每款耗材的全部供货商与价格。
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api';
import { useFieldPermissions } from '@/lib/hooks/useFieldPermissions';
import { ImageThumb } from './ImageThumb';
import { ImagePreviewDialog } from './ImagePreviewDialog';
import { money } from './CompositionDetail';

interface SupplierOption {
  id: string;
  name: string;
  code?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierOption | null;
}

export function ConsumableSupplierConsumablesDialog({
  open,
  onOpenChange,
  supplier,
}: Props) {
  const fp = useFieldPermissions('consumable');
  const [list, setList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{
    fileId: string;
    alt?: string;
  } | null>(null);
  const pageSize = 20;

  const load = useCallback(
    async (targetPage: number, kw: string) => {
      if (!supplier) return;
      setLoading(true);
      setError('');
      try {
        const data =
          await apiClient.getConsumableSupplierConsumables(
            supplier.id,
            {
              keyword: kw || undefined,
              page: targetPage,
              pageSize,
            },
          );
        setList(data?.list || []);
        setTotal(data?.pagination?.total || 0);
        setPage(data?.pagination?.page || targetPage);
      } catch (e: any) {
        setError(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    },
    [supplier],
  );

  useEffect(() => {
    if (open && supplier) {
      setKeyword('');
      load(1, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier?.id]);

  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize),
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#262626] border-[#1e1e1e] text-white sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              管理耗材
              {supplier?.name ? ` - ${supplier.name}` : ''}
            </DialogTitle>
          </DialogHeader>

          <div className="text-xs text-[#8e8e8e]">
            该供应商当前供货的耗材；每行同时展示该耗材的全部供货商与价格，便于比价。
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-[320px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8e8e] w-4 h-4" />
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    load(1, keyword);
                  }
                }}
                placeholder="搜索耗材名称、编码..."
                className="pl-9 bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e] h-8"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => load(1, keyword)}
              className="h-8 bg-[#262626] border-[#3e3e3e] text-white hover:bg-[#363636]"
            >
              搜索
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#8e8e8e]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : error ? (
            <div className="py-10 text-center text-sm text-[#f59e0b]">
              {error}
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#8e8e8e]">
              该供应商暂无供货耗材
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#3e3e3e]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#8e8e8e] border-b border-[#3e3e3e] bg-[#202020]">
                    {fp.canView('image') && (
                      <th className="text-left font-normal px-3 py-2 w-12">
                        图片
                      </th>
                    )}
                    <th className="text-left font-normal px-3 py-2">
                      耗材
                    </th>
                    {fp.canView('price.unitPrice') && (
                      <th className="text-right font-normal px-3 py-2">
                        本供应商当前价
                      </th>
                    )}
                    <th className="text-left font-normal px-3 py-2">
                      全部供货商（默认供货商标 ★）
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((item) => (
                    <tr
                      key={item.consumable?.id}
                      className="border-b border-[#3e3e3e]/60 last:border-b-0 align-top"
                    >
                      {fp.canView('image') && (
                        <td className="px-3 py-2">
                          <ImageThumb
                            fileId={item.consumable?.image}
                            alt={item.consumable?.name || ''}
                            size={32}
                            onPreview={(fileId, alt) =>
                              setPreview({ fileId, alt })
                            }
                          />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="text-white">
                          {item.consumable?.name}
                        </div>
                        <div className="text-[#8e8e8e] mt-0.5">
                          {item.consumable?.code}
                          {item.consumable?.specDesc
                            ? ` · ${item.consumable.specDesc}`
                            : ''}
                        </div>
                      </td>
                      {fp.canView('price.unitPrice') && (
                        <td className="px-3 py-2 text-right text-[#409fff]">
                          {item.currentPrice?.unitPrice ==
                          null ? (
                            '***'
                          ) : (
                            money(
                              Number(
                                item.currentPrice
                                  .unitPrice,
                              ),
                            )
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {(item.allSuppliers || []).map(
                            (s: any) => (
                              <span
                                key={s.supplierId}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
                                  s.isDefault
                                    ? 'border-[#f59e0b]/50 bg-[#f59e0b]/10 text-[#f5c56e]'
                                    : 'border-[#3e3e3e] bg-[#222] text-[#c9c9c9]'
                                }`}
                              >
                                {s.isDefault ? '★ ' : ''}
                                {s.supplierName || '未知供应商'}
                                {fp.canView('price.unitPrice') &&
                                  s.unitPrice != null && (
                                    <span className="text-[#8e8e8e]">
                                      {money(
                                        Number(
                                          s.unitPrice,
                                        ),
                                      )}
                                    </span>
                                  )}
                              </span>
                            ),
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && list.length > 0 && (
            <div className="flex items-center justify-between text-xs text-[#8e8e8e]">
              <span>
                共 {total} 条，第 {page} / {totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => load(page - 1, keyword)}
                  className="h-7 bg-[#262626] border-[#3e3e3e] text-white hover:bg-[#363636] disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  上一页
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => load(page + 1, keyword)}
                  className="h-7 bg-[#262626] border-[#3e3e3e] text-white hover:bg-[#363636] disabled:opacity-50"
                >
                  下一页
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
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

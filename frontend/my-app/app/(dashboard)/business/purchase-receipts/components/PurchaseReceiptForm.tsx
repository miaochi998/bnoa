'use client';

/**
 * 进货入库记录 · 新增 / 编辑表单
 *
 * 业务依据：docs/进货入库记录模块业务逻辑定稿.md（第三、四、十节）
 * 接口契约：docs/后端/进货入库记录模块后端技术规范.md（2.2）
 *
 * 要点：
 * - 一单多物品（默认 1 行，最多 50 行）；
 * - 三级联动：产品 → 供应商 → 规格（款式）；耗材 → 耗材供应商 → 规格自动带出（只读）；
 * - 切换上游字段必须清空下游字段，避免脏数据；
 * - 照片一律走 MultiImageUploader（内部已修正 fileId 取值）；
 * - 编辑模式先取全量详情再回填，不依赖列表行数据。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MultiImageUploader } from '@/components/upload/MultiImageUploader';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuth } from '@/hooks/useAuth';
import {
  ChevronsUpDown,
  FileDigit,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ==================== 可搜索下拉（本地/远程两用） ====================

export interface SearchableOption {
  value: string;
  label: string;
  /** 附加说明，参与本地模糊匹配（如产品编码、耗材规格） */
  hint?: string;
}

interface SearchableSelectProps {
  value?: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  /** 显示「清除选择」项 */
  allowClear?: boolean;
  /** 输入关键字时回调（用于远程搜索） */
  onSearch?: (keyword: string) => void;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  searchPlaceholder = '输入关键字搜索',
  emptyText = '无匹配结果',
  disabled,
  loading,
  className,
  allowClear,
  onSearch,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  // 远程搜索会把列表换掉，导致已选项不在 options 里；
  // 记住「最近一次点选的 值 → 名称」，保证触发器始终显示已选名称。
  const [picked, setPicked] = useState<{ value?: string; label?: string }>({});

  const selected = options.find((o) => o.value === value);
  const displayLabel =
    selected?.label ?? (picked.value === value ? picked.label : undefined);

  const kw = keyword.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!kw) return options;
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(kw),
    );
  }, [kw, options]);

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        // 关闭时清空搜索词与远程搜索条件，下次打开是干净列表
        if (!v) {
          setKeyword('');
          onSearch?.('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full cursor-pointer justify-between font-normal',
            className,
          )}
        >
          <span
            className={cn('truncate', !displayLabel && 'text-muted-foreground')}
          >
            {displayLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-56 p-2"
      >
        <Input
          autoFocus
          value={keyword}
          placeholder={searchPlaceholder}
          className="mb-2 h-8"
          onChange={(e) => {
            setKeyword(e.target.value);
            onSearch?.(e.target.value);
          }}
        />
        <div className="max-h-56 overflow-y-auto">
          {allowClear && value && (
            <button
              type="button"
              className="mb-1 w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors duration-200 hover:bg-[#2e2e2e]"
              onClick={() => {
                setPicked({});
                onChange('');
                setOpen(false);
              }}
            >
              清除选择
            </button>
          )}
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> 加载中...
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-2 py-3 text-xs text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className={cn(
                  'flex w-full cursor-pointer flex-col items-start rounded px-2 py-1.5 text-left text-sm transition-colors duration-200 hover:bg-[#2e2e2e]',
                  o.value === value && 'text-[#409fff]',
                )}
                onClick={() => {
                  setPicked({ value: o.value, label: o.label });
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="w-full truncate">{o.label}</span>
                {o.hint && (
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {o.hint}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ==================== 表单 ====================

type ItemType = 'PRODUCT' | 'CONSUMABLE' | 'OTHER';

export interface PurchaseReceiptFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  record: any;
  onSuccess: () => void;
}

interface ItemRow {
  key: string;
  itemType: ItemType;
  productId: string;
  supplierId: string;
  supplierProductId: string;
  consumableId: string;
  consumableSupplierId: string;
  /** 耗材自带规格（自动带出、只读） */
  specDesc: string;
  itemName: string;
  supplierName: string;
  specName: string;
  quantityText: string;
  remark: string;
  images: string[];
  supplierOptions: SearchableOption[];
  specOptions: SearchableOption[];
  consumableSupplierOptions: SearchableOption[];
  loadingSuppliers: boolean;
  loadingSpecs: boolean;
}

interface ProductLite {
  id: string;
  name?: string;
  code?: string;
}

interface ConsumableLite {
  id: string;
  name?: string;
  code?: string;
  specDesc?: string;
}

interface SupplierProductLite {
  id: string;
  supplierId?: string;
  styleName?: string | null;
  supplier?: { id?: string; name?: string } | null;
}

interface ConsumablePriceLite {
  supplierId?: string;
  supplier?: { id?: string; name?: string } | null;
}

interface ReceiptImageLite {
  fileId?: string;
}

interface ReceiptItemLite {
  itemType?: string;
  productId?: string | null;
  supplierId?: string | null;
  supplierProductId?: string | null;
  consumableId?: string | null;
  consumableSupplierId?: string | null;
  itemName?: string | null;
  supplierName?: string | null;
  specName?: string | null;
  quantityText?: string;
  remark?: string | null;
  images?: ReceiptImageLite[];
}

/** 详情接口返回（仅列出本表单用到的字段） */
interface ReceiptDetailLite {
  receiptTime?: string | null;
  billNo?: string | null;
  billNoSource?: string | null;
  billAmount?: number | null;
  isAccurate?: boolean;
  remark?: string | null;
  images?: ReceiptImageLite[];
  items?: ReceiptItemLite[];
}

/** 票据号重复校验命中项 */
interface BillNoConflict {
  receiptNo?: string;
  receiptTime?: string;
}

const MAX_ROWS = 50;

let rowSeq = 0;
const nextKey = () => {
  rowSeq += 1;
  return `row-${rowSeq}`;
};

const emptyRow = (itemType: ItemType = 'PRODUCT'): ItemRow => ({
  key: nextKey(),
  itemType,
  productId: '',
  supplierId: '',
  supplierProductId: '',
  consumableId: '',
  consumableSupplierId: '',
  specDesc: '',
  itemName: '',
  supplierName: '',
  specName: '',
  quantityText: '',
  remark: '',
  images: [],
  supplierOptions: [],
  specOptions: [],
  consumableSupplierOptions: [],
  loadingSuppliers: false,
  loadingSpecs: false,
});

/** ISO → datetime-local 字符串（本地时区，精确到分钟） */
function toLocalInput(value?: string | Date | null): string {
  const d = value ? new Date(value) : new Date();
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', { hour12: false });
}

/** 合并「历史快照占位选项」与实时选项（主数据改名/停用后历史记录仍可正确显示） */
function mergeOptions(
  extra: SearchableOption[],
  base: SearchableOption[],
): SearchableOption[] {
  if (extra.length === 0) return base;
  const seen = new Set(base.map((o) => o.value));
  return [...extra.filter((o) => !seen.has(o.value)), ...base];
}

export function PurchaseReceiptForm({
  open,
  onOpenChange,
  mode,
  record,
  onSuccess,
}: PurchaseReceiptFormProps) {
  const { user } = useAuth();

  const [receiptTime, setReceiptTime] = useState('');
  const [billNo, setBillNo] = useState('');
  const [billImages, setBillImages] = useState<string[]>([]);
  const [billAmount, setBillAmount] = useState('');
  const [isAccurate, setIsAccurate] = useState('true');
  const [remark, setRemark] = useState('');
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [generatingBillNo, setGeneratingBillNo] = useState(false);
  // 无票编号按钮生成标记 → billNoSource = AUTO_NO_PAPER
  const autoBillNoRef = useRef(false);
  // AI 识别回填标记 → billNoSource = AI
  const aiBillNoRef = useRef(false);
  const [recognizing, setRecognizing] = useState(false);

  const [productOptions, setProductOptions] = useState<SearchableOption[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [productKeyword, setProductKeyword] = useState('');
  const [consumableOptions, setConsumableOptions] = useState<
    SearchableOption[]
  >([]);
  const [consumableLoading, setConsumableLoading] = useState(false);
  const [consumableKeyword, setConsumableKeyword] = useState('');
  // 编辑回填时，主数据可能已改名/停用：用历史快照补一个占位选项
  const [extraProductOptions, setExtraProductOptions] = useState<
    SearchableOption[]
  >([]);
  const [extraConsumableOptions, setExtraConsumableOptions] = useState<
    SearchableOption[]
  >([]);

  const productSelectOptions = useMemo(
    () => mergeOptions(extraProductOptions, productOptions),
    [extraProductOptions, productOptions],
  );
  const consumableSelectOptions = useMemo(
    () => mergeOptions(extraConsumableOptions, consumableOptions),
    [extraConsumableOptions, consumableOptions],
  );

  const debouncedProductKeyword = useDebouncedValue(productKeyword, 300);
  const debouncedConsumableKeyword = useDebouncedValue(consumableKeyword, 300);

  const updateRow = useCallback((key: string, patch: Partial<ItemRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }, []);

  /** 基于当前行状态计算补丁（用于合并「已选但不在新列表里」的选项） */
  const patchRow = useCallback(
    (key: string, fn: (row: ItemRow) => Partial<ItemRow>) => {
      setRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, ...fn(r) } : r)),
      );
    },
    [],
  );

  // ---------- 主数据下拉 ----------

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setProductLoading(true);
    (async () => {
      try {
        const res = await apiClient.getProducts({
          keyword: debouncedProductKeyword || undefined,
          page: 1,
          pageSize: 50,
        });
        const list = (res?.list ?? []) as ProductLite[];
        if (cancelled) return;
        setProductOptions(
          list.map((p) => ({
            value: p.id,
            label: p.name || '(未命名产品)',
            hint: p.code,
          })),
        );
      } catch {
        if (!cancelled) setProductOptions([]);
      } finally {
        if (!cancelled) setProductLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debouncedProductKeyword]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setConsumableLoading(true);
    (async () => {
      try {
        const res = await apiClient.getConsumables({
          keyword: debouncedConsumableKeyword || undefined,
          page: 1,
          pageSize: 50,
        });
        const list = (res?.list ?? []) as ConsumableLite[];
        if (cancelled) return;
        setConsumableOptions(
          list.map((c) => ({
            value: c.id,
            label: c.name || '(未命名耗材)',
            hint: c.specDesc || c.code,
          })),
        );
      } catch {
        if (!cancelled) setConsumableOptions([]);
      } finally {
        if (!cancelled) setConsumableLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, debouncedConsumableKeyword]);

  // ---------- 三级联动 ----------

  /** 拉取「产品 → 供应商」候选（不清空已选值，清空由调用方决定） */
  const loadSuppliersForRow = useCallback(
    async (rowKey: string, productId: string) => {
      updateRow(rowKey, { loadingSuppliers: true });
      try {
        const list = (await apiClient.getSuppliersByProduct(
          productId,
        )) as SupplierProductLite[];
        const seen = new Set<string>();
        const options: SearchableOption[] = [];
        (list || []).forEach((sp) => {
          const sid = sp?.supplierId || sp?.supplier?.id;
          if (!sid || seen.has(sid)) return;
          seen.add(sid);
          options.push({
            value: sid,
            label: sp?.supplier?.name || '未知供应商',
          });
        });
        patchRow(rowKey, (row) => ({
          // 保留已选但新列表里没有的供应商（关系被删/停用时仍可见）
          supplierOptions: mergeOptions(row.supplierOptions, options),
          loadingSuppliers: false,
        }));
        if (options.length === 0) {
          toast.warning('该产品暂无供应商，请先在供应商管理中维护');
        }
      } catch (e) {
        updateRow(rowKey, { loadingSuppliers: false });
        toast.error(e instanceof Error ? e.message : '加载供应商失败');
      }
    },
    [patchRow, updateRow],
  );

  /** 拉取「供应商 + 产品 → 规格/款式」候选（不清空已选值） */
  const loadSpecsForRow = useCallback(
    async (rowKey: string, supplierId: string, productId: string) => {
      updateRow(rowKey, { loadingSpecs: true });
      try {
        const res = await apiClient.getSupplierProducts({
          supplierId,
          productId,
          page: 1,
          pageSize: 100,
        });
        const list = (res?.list ?? []) as SupplierProductLite[];
        patchRow(rowKey, (row) => ({
          // 保留已选但新列表里没有的规格（款式被删/停用时仍可见）
          specOptions: mergeOptions(
            row.specOptions,
            list.map((sp) => ({
              value: sp.id,
              label: sp.styleName || '无规格',
            })),
          ),
          loadingSpecs: false,
        }));
      } catch (e) {
        updateRow(rowKey, { loadingSpecs: false });
        toast.error(e instanceof Error ? e.message : '加载规格失败');
      }
    },
    [patchRow, updateRow],
  );

  /** 拉取「耗材 → 耗材供应商」候选（不清空已选值） */
  const loadConsumableSuppliersForRow = useCallback(
    async (rowKey: string, consumableId: string) => {
      updateRow(rowKey, { loadingSuppliers: true });
      try {
        const list = (await apiClient.getConsumablePrices(
          consumableId,
        )) as ConsumablePriceLite[];
        const seen = new Set<string>();
        const options: SearchableOption[] = [];
        (list || []).forEach((p) => {
          const sid = p?.supplierId || p?.supplier?.id;
          if (!sid || seen.has(sid)) return;
          seen.add(sid);
          options.push({
            value: sid,
            label: p?.supplier?.name || '未知耗材供应商',
          });
        });
        patchRow(rowKey, (row) => ({
          consumableSupplierOptions: mergeOptions(
            row.consumableSupplierOptions,
            options,
          ),
          loadingSuppliers: false,
        }));
        if (options.length === 0) {
          toast.warning('该耗材暂无供应商价格记录，请先在耗材管理中维护');
        }
      } catch (e) {
        updateRow(rowKey, { loadingSuppliers: false });
        toast.error(e instanceof Error ? e.message : '加载耗材供应商失败');
      }
    },
    [patchRow, updateRow],
  );

  // ---------- 回填 / 重置 ----------

  const applyDetail = useCallback(
    (detail: ReceiptDetailLite | null) => {
      setReceiptTime(toLocalInput(detail?.receiptTime));
      setBillNo(detail?.billNo || '');
      setBillAmount(
        detail?.billAmount === null || detail?.billAmount === undefined
          ? ''
          : String(detail.billAmount),
      );
      setIsAccurate(detail?.isAccurate === false ? 'false' : 'true');
      setRemark(detail?.remark || '');
      autoBillNoRef.current = detail?.billNoSource === 'AUTO_NO_PAPER';
      aiBillNoRef.current = detail?.billNoSource === 'AI';
      setBillImages(
        ((detail?.images ?? []) as ReceiptImageLite[])
          .map((img) => img?.fileId || '')
          .filter(Boolean),
      );

      const detailItems = (detail?.items ?? []) as ReceiptItemLite[];
      const extraProducts: SearchableOption[] = [];
      const extraConsumables: SearchableOption[] = [];
      detailItems.forEach((it) => {
        if (it.itemType === 'PRODUCT' && it.productId) {
          extraProducts.push({
            value: it.productId,
            label: it.itemName || '原产品',
          });
        }
        if (it.itemType === 'CONSUMABLE' && it.consumableId) {
          extraConsumables.push({
            value: it.consumableId,
            label: it.itemName || '原耗材',
            hint: it.specName || undefined,
          });
        }
      });
      setExtraProductOptions(extraProducts);
      setExtraConsumableOptions(extraConsumables);

      const built: ItemRow[] = (detailItems.length
        ? detailItems
        : [{} as ReceiptItemLite]
      ).map((it) => {
        const type: ItemType =
          it.itemType === 'CONSUMABLE'
            ? 'CONSUMABLE'
            : it.itemType === 'OTHER'
              ? 'OTHER'
              : 'PRODUCT';
        const row = emptyRow(type);
        row.productId = it.productId || '';
        row.supplierId = it.supplierId || '';
        row.supplierProductId = it.supplierProductId || '';
        row.consumableId = it.consumableId || '';
        row.consumableSupplierId = it.consumableSupplierId || '';
        row.specDesc =
          type === 'CONSUMABLE' ? it.specName || '' : '';
        row.itemName = it.itemName || '';
        row.supplierName = it.supplierName || '';
        row.specName = it.specName || '';
        row.quantityText = it.quantityText || '';
        row.remark = it.remark || '';
        row.images = ((it.images ?? []) as ReceiptImageLite[])
          .map((img) => img?.fileId || '')
          .filter(Boolean);
        // 先用历史快照占位，随后异步加载真实选项（主数据改名/停用也能正确显示）
        if (type === 'PRODUCT') {
          if (row.supplierId) {
            row.supplierOptions = [
              { value: row.supplierId, label: it.supplierName || '原供应商' },
            ];
          }
          if (row.supplierProductId) {
            row.specOptions = [
              {
                value: row.supplierProductId,
                label: it.specName || '无规格',
              },
            ];
          }
        }
        if (type === 'CONSUMABLE' && row.consumableSupplierId) {
          row.consumableSupplierOptions = [
            {
              value: row.consumableSupplierId,
              label: it.supplierName || '原耗材供应商',
            },
          ];
        }
        return row;
      });

      setRows(built);

      // 异步补齐联动选项
      built.forEach((row) => {
        if (row.itemType === 'PRODUCT' && row.productId) {
          void loadSuppliersForRow(row.key, row.productId);
          if (row.supplierId) {
            void loadSpecsForRow(row.key, row.supplierId, row.productId);
          }
        }
        if (row.itemType === 'CONSUMABLE' && row.consumableId) {
          void loadConsumableSuppliersForRow(row.key, row.consumableId);
        }
      });
    },
    [loadConsumableSuppliersForRow, loadSpecsForRow, loadSuppliersForRow],
  );

  const resetForCreate = useCallback(() => {
    setReceiptTime(toLocalInput(null));
    setBillNo('');
    setBillImages([]);
    setBillAmount('');
    setIsAccurate('true');
    setRemark('');
    setRows([emptyRow()]);
    setExtraProductOptions([]);
    setExtraConsumableOptions([]);
    autoBillNoRef.current = false;
    aiBillNoRef.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;
    setProductKeyword('');
    setConsumableKeyword('');
    if (mode === 'edit' && record?.id) {
      let cancelled = false;
      setLoadingDetail(true);
      (async () => {
        try {
          const detail = await apiClient.purchaseReceiptDetail(record.id);
          if (!cancelled) applyDetail(detail);
        } catch {
          // 详情失败时退化为使用列表行数据，至少不让表单空白
          if (!cancelled && record) applyDetail(record);
        } finally {
          if (!cancelled) setLoadingDetail(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    resetForCreate();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, record]);

  // ---------- 行操作 ----------

  const addRow = () => {
    if (rows.length >= MAX_ROWS) {
      toast.error(`明细最多 ${MAX_ROWS} 行`);
      return;
    }
    setRows((prev) => [...prev, emptyRow()]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const changeRowType = (row: ItemRow, type: ItemType) => {
    // 换货物类型 → 清空所有下游字段
    updateRow(row.key, {
      itemType: type,
      productId: '',
      supplierId: '',
      supplierProductId: '',
      consumableId: '',
      consumableSupplierId: '',
      specDesc: '',
      itemName: '',
      supplierName: '',
      specName: '',
      supplierOptions: [],
      specOptions: [],
      consumableSupplierOptions: [],
    });
  };

  // ---------- 无票编号 ----------

  const handleGenerateBillNo = async () => {
    setGeneratingBillNo(true);
    try {
      const res = await apiClient.purchaseReceiptNextBillNo();
      const no = res?.billNo || '';
      if (!no) {
        toast.error('生成无票编号失败，请手工填写');
        return;
      }
      setBillNo(no);
      autoBillNoRef.current = true;
      toast.success(`已生成无票编号 ${no}（可手工修改）`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '生成无票编号失败');
    } finally {
      setGeneratingBillNo(false);
    }
  };

  // ---------- AI 识别票据号（可选增强，失败不阻断） ----------

  const handleRecognizeBill = async (fileId: string) => {
    setRecognizing(true);
    try {
      const timeout = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 20000),
      );
      const res = (await Promise.race([
        apiClient.purchaseReceiptRecognizeBill(fileId),
        timeout,
      ])) as Awaited<
        ReturnType<typeof apiClient.purchaseReceiptRecognizeBill>
      > | null;
      // 超时 / 未配置模型 / 未识别到 → 静默放弃，由管理员手填
      if (!res || !res.available || !res.billNo) return;
      setBillNo(res.billNo);
      aiBillNoRef.current = true;
      autoBillNoRef.current = false;
      toast.success(`AI 已识别票据号：${res.billNo}（可修改）`);
    } catch {
      // 识别失败一律静默，绝不阻断入库
    } finally {
      setRecognizing(false);
    }
  };

  const handleBillImagesChange = (ids: string[]) => {
    const added = ids.filter((id) => !billImages.includes(id));
    setBillImages(ids);
    // 新增了发货单照片且票据号为空 → 自动识别
    if (added.length > 0 && !billNo.trim()) {
      void handleRecognizeBill(added[0]);
    }
  };

  // ---------- 提交 ----------

  const handleSubmit = async () => {
    if (!receiptTime) {
      toast.error('请填写入库日期时间');
      return;
    }
    if (rows.length === 0) {
      toast.error('至少填写一个入库物品');
      return;
    }

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const no = i + 1;
      if (!row.quantityText.trim()) {
        toast.error(`第 ${no} 行：请填写入库数量`);
        return;
      }
      if (row.itemType === 'PRODUCT') {
        if (!row.productId) {
          toast.error(`第 ${no} 行：请选择入库产品`);
          return;
        }
        if (!row.supplierId) {
          toast.error(`第 ${no} 行：请选择供应商`);
          return;
        }
        if (!row.supplierProductId) {
          toast.error(`第 ${no} 行：请选择产品规格`);
          return;
        }
      } else if (row.itemType === 'CONSUMABLE') {
        if (!row.consumableId) {
          toast.error(`第 ${no} 行：请选择耗材`);
          return;
        }
        if (!row.consumableSupplierId) {
          toast.error(`第 ${no} 行：请选择耗材供应商`);
          return;
        }
      } else if (!row.itemName.trim()) {
        toast.error(`第 ${no} 行：请填写物品名称`);
        return;
      }
    }

    if (isAccurate === 'false' && !remark.trim()) {
      toast.error('请填写不准确的原因');
      return;
    }

    let amountValue: number | undefined;
    if (billAmount.trim() !== '') {
      const n = Number(billAmount);
      if (!Number.isFinite(n) || n < 0) {
        toast.error('本次货款金额需为不小于 0 的数字');
        return;
      }
      amountValue = n;
    }

    const cleanBillImages = billImages.filter(Boolean);
    if (cleanBillImages.length > 3) {
      toast.error('发货单照片最多 3 张');
      return;
    }

    const trimmedBillNo = billNo.trim();

    setSaving(true);
    try {
      // 同供应商重复票据号 → 二次确认（不硬阻止）
      if (trimmedBillNo) {
        const keys: { supplierId?: string; consumableSupplierId?: string }[] = [];
        const seen = new Set<string>();
        rows.forEach((row) => {
          if (row.itemType === 'PRODUCT' && row.supplierId) {
            const k = `S:${row.supplierId}`;
            if (!seen.has(k)) {
              seen.add(k);
              keys.push({ supplierId: row.supplierId });
            }
          } else if (row.itemType === 'CONSUMABLE' && row.consumableSupplierId) {
            const k = `C:${row.consumableSupplierId}`;
            if (!seen.has(k)) {
              seen.add(k);
              keys.push({ consumableSupplierId: row.consumableSupplierId });
            }
          }
        });

        let dup: BillNoConflict | null = null;
        for (const key of keys.slice(0, 3)) {
          try {
            const res = await apiClient.purchaseReceiptCheckBillNo({
              billNo: trimmedBillNo,
              ...key,
              excludeId: mode === 'edit' ? record?.id : undefined,
            });
            if (res?.exists && res.records?.length) {
              dup = res.records[0] as BillNoConflict;
              break;
            }
          } catch {
            // 校验失败不阻断提交
          }
        }

        if (dup) {
          const ok = window.confirm(
            `该供应商已有相同票据号的入库单：${dup.receiptNo ?? '-'}（${formatDateTime(
              dup.receiptTime,
            )}）\n确认仍要提交吗？`,
          );
          if (!ok) {
            setSaving(false);
            return;
          }
        }
      }

      const dto: Record<string, unknown> = {
        receiptTime: new Date(receiptTime).toISOString(),
        billNo: trimmedBillNo || undefined,
        billNoSource:
          trimmedBillNo && autoBillNoRef.current
            ? 'AUTO_NO_PAPER'
            : trimmedBillNo && aiBillNoRef.current
              ? 'AI'
              : undefined,
        billAmount: amountValue,
        isAccurate: isAccurate === 'true',
        remark: remark.trim() || undefined,
        billImages: cleanBillImages,
        items: rows.map((row) => {
          const base: Record<string, unknown> = {
            itemType: row.itemType,
            quantityText: row.quantityText.trim(),
            remark: row.remark.trim() || undefined,
            images: row.images.filter(Boolean),
          };
          if (row.itemType === 'PRODUCT') {
            base.productId = row.productId;
            base.supplierId = row.supplierId;
            base.supplierProductId = row.supplierProductId;
          } else if (row.itemType === 'CONSUMABLE') {
            base.consumableId = row.consumableId;
            base.consumableSupplierId = row.consumableSupplierId;
          } else {
            base.itemName = row.itemName.trim();
            base.supplierName = row.supplierName.trim() || undefined;
            base.specName = row.specName.trim() || undefined;
          }
          return base;
        }),
      };

      if (mode === 'create') {
        await apiClient.purchaseReceiptCreate(dto);
      } else {
        await apiClient.purchaseReceiptUpdate(record?.id, dto);
      }
      toast.success(mode === 'create' ? '入库登记成功' : '保存成功');
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="col-span-2 mt-1 border-b border-border pb-1 text-sm font-semibold text-[#409fff]">
      {children}
    </div>
  );

  const accurate = isAccurate === 'true';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? '新增入库记录' : '编辑入库记录'}
            {mode === 'edit' && record?.receiptNo ? ` · ${record.receiptNo}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {/* ① 入库日期 */}
          <SectionTitle>入库信息</SectionTitle>
          <div className="space-y-1">
            <Label>入库日期时间 *</Label>
            <Input
              type="datetime-local"
              value={receiptTime}
              onChange={(e) => setReceiptTime(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              默认当前时间、精确到分钟，支持补录历史到货
            </p>
          </div>
          <div className="space-y-1">
            <Label>核对人</Label>
            <Input
              value={user?.name || user?.username || ''}
              readOnly
              disabled
              placeholder="自动取当前登录用户"
            />
            <p className="text-xs text-muted-foreground">
              系统自动填写，不可修改
            </p>
          </div>

          {/* ② 物品明细 */}
          <SectionTitle>物品明细（一张单可含多个物品）</SectionTitle>
          <div className="col-span-2 space-y-3">
            {loadingDetail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 正在加载入库单详情...
              </div>
            )}

            {rows.map((row, idx) => (
              <div
                key={row.key}
                className="space-y-3 rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    物品 {idx + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-400"
                    disabled={rows.length <= 1}
                    title={rows.length <= 1 ? '至少保留一行' : '删除该行'}
                    onClick={() => removeRow(row.key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="space-y-1">
                    <Label>货物类型 *</Label>
                    <Select
                      value={row.itemType}
                      onValueChange={(v) => changeRowType(row, v as ItemType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRODUCT">产品</SelectItem>
                        <SelectItem value="CONSUMABLE">耗材</SelectItem>
                        <SelectItem value="OTHER">其它</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 物品 */}
                  {row.itemType === 'PRODUCT' && (
                    <div className="space-y-1">
                      <Label>入库产品 *</Label>
                      <SearchableSelect
                        value={row.productId}
                        options={productSelectOptions}
                        loading={productLoading}
                        allowClear
                        placeholder="搜索并选择产品"
                        searchPlaceholder="按名称/编码搜索"
                        emptyText="未找到产品"
                        onSearch={setProductKeyword}
                        onChange={(v) => {
                          if (!v) {
                            updateRow(row.key, {
                              productId: '',
                              supplierId: '',
                              supplierProductId: '',
                              supplierOptions: [],
                              specOptions: [],
                            });
                            return;
                          }
                          // 换产品 → 清空供应商与规格
                          updateRow(row.key, {
                            productId: v,
                            supplierId: '',
                            supplierProductId: '',
                            supplierOptions: [],
                            specOptions: [],
                          });
                          void loadSuppliersForRow(row.key, v);
                        }}
                      />
                    </div>
                  )}
                  {row.itemType === 'CONSUMABLE' && (
                    <div className="space-y-1">
                      <Label>入库耗材 *</Label>
                      <SearchableSelect
                        value={row.consumableId}
                        options={consumableSelectOptions}
                        loading={consumableLoading}
                        allowClear
                        placeholder="搜索并选择耗材"
                        searchPlaceholder="按名称/编码搜索"
                        emptyText="未找到耗材"
                        onSearch={setConsumableKeyword}
                        onChange={(v) => {
                          const opt = consumableSelectOptions.find(
                            (o) => o.value === v,
                          );
                          updateRow(row.key, {
                            consumableId: v,
                            specDesc:
                              opt?.hint ||
                              (v === row.consumableId ? row.specDesc : ''),
                            consumableSupplierId: '',
                            consumableSupplierOptions: [],
                          });
                          if (v) void loadConsumableSuppliersForRow(row.key, v);
                        }}
                      />
                    </div>
                  )}
                  {row.itemType === 'OTHER' && (
                    <div className="space-y-1">
                      <Label>物品名称 *</Label>
                      <Input
                        value={row.itemName}
                        maxLength={200}
                        placeholder="如：办公用品、赠品"
                        onChange={(e) =>
                          updateRow(row.key, { itemName: e.target.value })
                        }
                      />
                    </div>
                  )}

                  {/* 供应商 */}
                  {row.itemType === 'PRODUCT' && (
                    <div className="space-y-1">
                      <Label>供应商 *</Label>
                      <SearchableSelect
                        value={row.supplierId}
                        options={row.supplierOptions}
                        loading={row.loadingSuppliers}
                        disabled={!row.productId}
                        allowClear
                        placeholder={row.productId ? '选择供应商' : '请先选产品'}
                        emptyText="该产品暂无供应商"
                        onChange={(v) => {
                          // 换供应商 → 清空规格
                          updateRow(row.key, {
                            supplierId: v,
                            supplierProductId: '',
                            specOptions: [],
                          });
                          if (v) {
                            void loadSpecsForRow(row.key, v, row.productId);
                          }
                        }}
                      />
                    </div>
                  )}
                  {row.itemType === 'CONSUMABLE' && (
                    <div className="space-y-1">
                      <Label>耗材供应商 *</Label>
                      <SearchableSelect
                        value={row.consumableSupplierId}
                        options={row.consumableSupplierOptions}
                        loading={row.loadingSuppliers}
                        disabled={!row.consumableId}
                        allowClear
                        placeholder={
                          row.consumableId ? '选择耗材供应商' : '请先选耗材'
                        }
                        emptyText="该耗材暂无供应商"
                        onChange={(v) =>
                          updateRow(row.key, { consumableSupplierId: v })
                        }
                      />
                    </div>
                  )}
                  {row.itemType === 'OTHER' && (
                    <div className="space-y-1">
                      <Label>供应商名称</Label>
                      <Input
                        value={row.supplierName}
                        maxLength={200}
                        placeholder="手填供应商名称"
                        onChange={(e) =>
                          updateRow(row.key, { supplierName: e.target.value })
                        }
                      />
                    </div>
                  )}

                  {/* 规格 */}
                  {row.itemType === 'PRODUCT' && (
                    <div className="space-y-1">
                      <Label>产品规格 *</Label>
                      <SearchableSelect
                        value={row.supplierProductId}
                        options={row.specOptions}
                        loading={row.loadingSpecs}
                        disabled={!row.supplierId}
                        allowClear
                        placeholder={
                          row.supplierId ? '选择规格/款式' : '请先选供应商'
                        }
                        emptyText="该供应商该产品暂无规格"
                        onChange={(v) =>
                          updateRow(row.key, { supplierProductId: v })
                        }
                      />
                    </div>
                  )}
                  {row.itemType === 'CONSUMABLE' && (
                    <div className="space-y-1">
                      <Label>规格（耗材自带）</Label>
                      <Input
                        value={row.specDesc}
                        readOnly
                        disabled
                        placeholder="自动带出"
                      />
                    </div>
                  )}
                  {row.itemType === 'OTHER' && (
                    <div className="space-y-1">
                      <Label>规格</Label>
                      <Input
                        value={row.specName}
                        maxLength={200}
                        placeholder="选填"
                        onChange={(e) =>
                          updateRow(row.key, { specName: e.target.value })
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>入库数量 *</Label>
                    <Input
                      value={row.quantityText}
                      maxLength={200}
                      placeholder="自由文本，如 34包/16立方"
                      onChange={(e) =>
                        updateRow(row.key, { quantityText: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>行备注</Label>
                    <Input
                      value={row.remark}
                      placeholder="该行的补充说明（选填）"
                      onChange={(e) =>
                        updateRow(row.key, { remark: e.target.value })
                      }
                    />
                  </div>
                </div>

                <MultiImageUploader
                  label="货物照片"
                  hint={`最多 10 张（${row.images.length}/10）`}
                  maxCount={10}
                  value={row.images}
                  onChange={(ids) => updateRow(row.key, { images: ids })}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rows.length >= MAX_ROWS}
              onClick={addRow}
            >
              <Plus className="mr-1 h-3 w-3" /> 添加物品
            </Button>
          </div>

          {/* ③ 票据区 */}
          <SectionTitle>票据区</SectionTitle>
          <div className="col-span-2 space-y-3">
            <MultiImageUploader
              label="发货单 / 票据照片"
              hint={`最多 3 张（${billImages.length}/3）`}
              maxCount={3}
              value={billImages}
              onChange={handleBillImagesChange}
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            />
            <div className="space-y-1">
              <Label>票据号</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-64"
                  value={billNo}
                  maxLength={100}
                  placeholder="发货单上的票据号（可留空）"
                  onChange={(e) => {
                    setBillNo(e.target.value);
                    autoBillNoRef.current = false;
                    aiBillNoRef.current = false;
                  }}
                />
                {recognizing && (
                  <span className="flex items-center gap-1 text-xs text-[#409fff]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI 识别中…
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={generatingBillNo}
                  onClick={handleGenerateBillNo}
                >
                  {generatingBillNo ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <FileDigit className="mr-1 h-3 w-3" />
                  )}
                  生成无票编号
                </Button>
                <span className="text-xs text-muted-foreground">
                  无票据时可点此生成 WP-YYYYMMDD-HHmm，与打款侧规则一致
                </span>
              </div>
            </div>
          </div>

          {/* ④ 金额 + ⑤ 是否准确 + ⑥ 备注 */}
          <SectionTitle>货款与核对</SectionTitle>
          <div className="space-y-1">
            <Label>本次货款金额（元）</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={billAmount}
              placeholder="选填，用于判断是否结清"
              onChange={(e) => setBillAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>是否准确 *</Label>
            <Select value={isAccurate} onValueChange={setIsAccurate}>
              <SelectTrigger
                className={cn(!accurate && 'border-destructive text-destructive')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">准确</SelectItem>
                <SelectItem value="false">不准确</SelectItem>
              </SelectContent>
            </Select>
            {!accurate && (
              <p className="text-xs text-destructive">
                选择「不准确」后必须填写原因
              </p>
            )}
          </div>
          <div className="col-span-2 space-y-1">
            <Label className={cn(!accurate && 'text-destructive')}>
              备注 {!accurate && '*'}
            </Label>
            <Textarea
              value={remark}
              className={cn(!accurate && 'border-destructive')}
              placeholder={
                accurate
                  ? '备注说明（选填）'
                  : '请写明不准确的原因（必填）'
              }
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving || loadingDetail}>
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> 保存中...
              </>
            ) : mode === 'create' ? (
              '提交入库'
            ) : (
              '保存'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

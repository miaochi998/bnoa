'use client';

/**
 * 进货入库记录 · 列表页
 *
 * 业务依据：docs/进货入库记录模块业务逻辑定稿.md（六、七、八、九、十节）
 * - 一张入库单占一个「行组」：单据级字段 rowSpan 纵向合并，明细字段逐行展示；
 * - 打款情况按后端计算结果显示（已结清/部分付款/未付款/未填金额），可展开打款明细；
 * - 编辑/删除：本人提交 或 拥有 purchase:manage（仍受功能权限码约束）；
 * - 导出遵循当前筛选条件（按明细展开），照片输出预览链接。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiClient,
  getFilePreviewUrl,
  getFileThumbnailUrl,
} from '@/lib/api';
import { getApiBaseUrl } from '@/lib/config';
import {
  SearchableSelect,
  type SearchableOption,
} from './components/PurchaseReceiptForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { PermissionGate } from '@/components/PermissionGate';
import { usePermissionStore } from '@/lib/stores/permission-store';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAuth } from '@/hooks/useAuth';
import { PurchaseReceiptForm } from './components/PurchaseReceiptForm';
import {
  Download,
  Eye,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ==================== 类型 ====================

interface ReceiptImage {
  fileId?: string;
}

interface ReceiptItem {
  id: string;
  itemType: string;
  itemName?: string | null;
  supplierName?: string | null;
  specName?: string | null;
  quantityText?: string | null;
  remark?: string | null;
  images?: ReceiptImage[];
}

interface PaymentBrief {
  id: string;
  recordNo: string;
  title?: string | null;
  amount: number;
  paymentTime?: string | null;
}

interface ReceiptPayment {
  status: string;
  paidAmount: number;
  linkedCount: number;
  linkType: string;
  records: PaymentBrief[];
}

interface ReceiptRow {
  id: string;
  receiptNo: string;
  receiptTime: string;
  billNo?: string | null;
  billNoSource?: string | null;
  billAmount?: number | null;
  isAccurate: boolean;
  remark?: string | null;
  createdBy: string;
  checker?: { id?: string; name?: string } | null;
  items?: ReceiptItem[];
  images?: ReceiptImage[];
  payment?: ReceiptPayment;
}

interface SelectLite {
  id: string;
  name?: string;
}

interface UserLite {
  id: string;
  name?: string;
  username?: string;
}

const ITEM_TYPE_LABEL: Record<string, string> = {
  PRODUCT: '产品',
  CONSUMABLE: '耗材',
  OTHER: '其它',
};

const BILL_NO_SOURCE_LABEL: Record<string, string> = {
  AI: 'AI识别',
  MANUAL: '手工填写',
  AUTO_NO_PAPER: '无票自拟',
  NONE: '空',
};

const PAYMENT_STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  SETTLED: { label: '已结清', className: 'text-[#00b800]' },
  PARTIAL: { label: '部分付款', className: 'text-[#ffa500]' },
  UNPAID: { label: '未付款', className: 'text-[#ff4444]' },
  NO_AMOUNT: { label: '未填金额', className: 'text-muted-foreground' },
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];

const money = (n: number | null | undefined) =>
  n === null || n === undefined ? '-' : `¥${Number(n).toLocaleString()}`;

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', { hour12: false });
}

function fileIdsOf(list?: ReceiptImage[]): string[] {
  return (list ?? []).map((x) => x.fileId || '').filter(Boolean);
}

// ==================== 子组件 ====================

/** 缩略图组（点击看大图） */
function Thumbs({
  fileIds,
  size = 'h-10 w-10',
  onPreview,
}: {
  fileIds: string[];
  size?: string;
  onPreview: (url: string) => void;
}) {
  if (fileIds.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {fileIds.map((id) => (
        <button
          key={id}
          type="button"
          title="点击查看大图"
          className={cn(
            'shrink-0 cursor-pointer overflow-hidden rounded border border-border transition-colors duration-200 hover:border-[#409fff]',
            size,
          )}
          onClick={() => onPreview(getFilePreviewUrl(id))}
        >
          <img
            src={getFileThumbnailUrl(id)}
            alt="照片"
            className="h-full w-full object-cover"
            onError={(e) => {
              const el = e.currentTarget;
              const fallback = getFilePreviewUrl(id);
              if (el.src !== fallback) el.src = fallback;
            }}
          />
        </button>
      ))}
    </div>
  );
}

/** 打款情况单元格 */
function PaymentCell({ payment }: { payment?: ReceiptPayment }) {
  const meta =
    PAYMENT_STATUS_META[payment?.status || 'NO_AMOUNT'] ??
    PAYMENT_STATUS_META.NO_AMOUNT;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer text-left transition-colors duration-200 hover:brightness-110"
          title="点击查看打款明细"
        >
          <span className={meta.className}>{meta.label}</span>
          {payment && payment.paidAmount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              已付 {money(payment.paidAmount)}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <p className="mb-2 text-xs font-medium text-[#409fff]">
          打款明细（{payment?.linkedCount ?? 0} 笔
          {payment?.linkType === 'MANUAL'
            ? '，人工关联'
            : payment?.linkType === 'AUTO'
              ? '，按票据号自动匹配'
              : ''}
          ）
        </p>
        {payment?.records?.length ? (
          <div className="space-y-2">
            {payment.records.map((r) => (
              <div
                key={r.id}
                className="rounded border border-border px-2 py-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.recordNo}</span>
                  <span className="font-medium">{money(r.amount)}</span>
                </div>
                <div className="text-muted-foreground">
                  {formatDateTime(r.paymentTime)}
                </div>
                {r.title && (
                  <div className="truncate text-muted-foreground">
                    {r.title}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">暂无匹配的打款记录</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ==================== 页面 ====================

export default function PurchaseReceiptsPage() {
  const permissionStore = usePermissionStore();
  const { user } = useAuth();

  const [records, setRecords] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // 筛选条件（Select 一律用非空哨兵 'all'）
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [itemType, setItemType] = useState('all');
  const [supplierId, setSupplierId] = useState('all');
  const [consumableSupplierId, setConsumableSupplierId] = useState('all');
  const [checkerId, setCheckerId] = useState('all');
  const [isAccurate, setIsAccurate] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [productId, setProductId] = useState('');
  const [billNo, setBillNo] = useState('');
  const [products, setProducts] = useState<SelectLite[]>([]);

  const [suppliers, setSuppliers] = useState<SelectLite[]>([]);
  const [consumableSuppliers, setConsumableSuppliers] = useState<SelectLite[]>(
    [],
  );
  const [users, setUsers] = useState<UserLite[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRecord, setEditingRecord] = useState<ReceiptRow | null>(null);
  const [detailRecord, setDetailRecord] = useState<ReceiptRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReceiptRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const hasManage =
    permissionStore.loaded && permissionStore.hasPermission('purchase:manage');

  const canWriteRow = useCallback(
    (permission: string, row: ReceiptRow) => {
      if (!permissionStore.loaded) return false;
      if (!permissionStore.hasPermission(permission)) return false;
      if (hasManage) return true;
      return !!user?.id && row.createdBy === user.id;
    },
    [hasManage, permissionStore, user?.id],
  );

  const buildFilter = useCallback(() => {
    const f: Record<string, string | number | boolean | undefined> = {
      page: pagination.page,
      pageSize: pagination.pageSize,
    };
    if (debouncedKeyword) f.keyword = debouncedKeyword;
    if (startDate) f.startDate = startDate;
    if (endDate) f.endDate = endDate;
    if (itemType !== 'all') f.itemType = itemType;
    if (supplierId !== 'all') f.supplierId = supplierId;
    if (consumableSupplierId !== 'all')
      f.consumableSupplierId = consumableSupplierId;
    if (checkerId !== 'all') f.checkerId = checkerId;
    if (isAccurate !== 'all') f.isAccurate = isAccurate === 'true';
    if (paymentStatus !== 'all') f.paymentStatus = paymentStatus;
    if (productId) f.productId = productId;
    if (billNo.trim()) f.billNo = billNo.trim();
    return f;
  }, [
    pagination.page,
    pagination.pageSize,
    debouncedKeyword,
    startDate,
    endDate,
    itemType,
    supplierId,
    consumableSupplierId,
    checkerId,
    isAccurate,
    paymentStatus,
    productId,
    billNo,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, meta } = await apiClient.purchaseReceiptList(buildFilter());
      setRecords((data ?? []) as ReceiptRow[]);
      setPagination((prev) => ({
        ...prev,
        total: meta?.total ?? 0,
        totalPages: meta?.totalPages ?? 0,
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [buildFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // 下拉数据
  useEffect(() => {
    (async () => {
      try {
        const [sup, cons, usr, prod] = await Promise.all([
          apiClient.getSuppliersForSelect(),
          apiClient.getConsumableSuppliersForSelect(),
          apiClient.getUsers({}, { page: 1, pageSize: 100 }),
          apiClient.getProducts({ page: 1, pageSize: 1000 }),
        ]);
        setSuppliers((sup ?? []) as SelectLite[]);
        setConsumableSuppliers((cons ?? []) as SelectLite[]);
        setUsers(((usr?.nodes ?? []) as UserLite[]) || []);
        setProducts(((prod?.list ?? []) as SelectLite[]) || []);
      } catch {
        // 静默，不阻断列表
      }
    })();
  }, []);

  const resetFilters = () => {
    setKeyword('');
    setStartDate('');
    setEndDate('');
    setItemType('all');
    setSupplierId('all');
    setConsumableSupplierId('all');
    setCheckerId('all');
    setIsAccurate('all');
    setPaymentStatus('all');
    setProductId('');
    setBillNo('');
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const changeFilter = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const pageNumbers = useMemo(() => {
    const total = pagination.totalPages;
    const cur = pagination.page;
    if (total <= 0) return [];
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(cur - 2, total - 4));
    return Array.from({ length: 5 }, (_, i) => start + i);
  }, [pagination.page, pagination.totalPages]);

  const openCreate = () => {
    setFormMode('create');
    setEditingRecord(null);
    setIsFormOpen(true);
  };

  const openEdit = async (row: ReceiptRow) => {
    let record: ReceiptRow = row;
    try {
      const detail = await apiClient.purchaseReceiptDetail(row.id);
      if (detail) record = detail as ReceiptRow;
    } catch {
      record = row;
    }
    setFormMode('edit');
    setEditingRecord(record);
    setIsFormOpen(true);
  };

  const openDetail = async (row: ReceiptRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRecord(row);
    try {
      const detail = await apiClient.purchaseReceiptDetail(row.id);
      if (detail) setDetailRecord(detail as ReceiptRow);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.purchaseReceiptDelete(deleteTarget.id);
      toast.success('删除成功');
      setDeleteTarget(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const filter = buildFilter();
      delete filter.page;
      delete filter.pageSize;
      const { blob, filename } = await apiClient.purchaseReceiptExport({
        ...filter,
        previewBaseUrl: getApiBaseUrl(),
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-words text-sm">{value || '-'}</span>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border">
            <PackageCheck className="h-5 w-5 text-[#409fff]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">进货入库记录</h1>
            <p className="text-sm text-muted-foreground">
              仓库到货登记台账，可与打款记录双向核对
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate permission="purchase:export">
            <Button variant="outline" disabled={exporting} onClick={handleExport}>
              {exporting ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1 h-4 w-4" />
              )}
              导出
            </Button>
          </PermissionGate>
          <PermissionGate permission="purchase:create">
            <Button onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> 新增入库
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* 筛选区 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">筛选</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative w-56">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="搜索单号/票据号/物品/供应商/备注"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
            />
          </div>

          <div className="w-52">
            <SearchableSelect
              value={productId}
              options={
                products.map((p) => ({
                  value: p.id,
                  label: p.name || p.id,
                })) as SearchableOption[]
              }
              allowClear
              placeholder="入库产品（全部）"
              searchPlaceholder="搜索产品名称"
              emptyText="无匹配产品"
              onChange={(v) => {
                setProductId(v);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
            />
          </div>

          <Input
            className="w-44"
            placeholder="票据号"
            value={billNo}
            onChange={(e) => {
              setBillNo(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />

          <Input
            type="date"
            className="w-40"
            value={startDate}
            title="入库开始日期"
            onChange={(e) => {
              setStartDate(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />
          <span className="text-muted-foreground">至</span>
          <Input
            type="date"
            className="w-40"
            value={endDate}
            title="入库结束日期"
            onChange={(e) => {
              setEndDate(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          />

          <Select value={itemType} onValueChange={changeFilter(setItemType)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="货物类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部货物</SelectItem>
              <SelectItem value="PRODUCT">产品</SelectItem>
              <SelectItem value="CONSUMABLE">耗材</SelectItem>
              <SelectItem value="OTHER">其它</SelectItem>
            </SelectContent>
          </Select>

          <Select value={supplierId} onValueChange={changeFilter(setSupplierId)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="供应商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部供应商</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name || s.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={consumableSupplierId}
            onValueChange={changeFilter(setConsumableSupplierId)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="耗材供应商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部耗材供应商</SelectItem>
              {consumableSuppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name || s.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={checkerId} onValueChange={changeFilter(setCheckerId)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="核对人" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部核对人</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.username || u.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={isAccurate}
            onValueChange={changeFilter(setIsAccurate)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="是否准确" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="true">准确</SelectItem>
              <SelectItem value="false">不准确</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={paymentStatus}
            onValueChange={changeFilter(setPaymentStatus)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="打款状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部打款状态</SelectItem>
              <SelectItem value="SETTLED">已结清</SelectItem>
              <SelectItem value="PARTIAL">部分付款</SelectItem>
              <SelectItem value="UNPAID">未付款</SelectItem>
              <SelectItem value="NO_AMOUNT">未填金额</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" onClick={resetFilters}>
            重置
          </Button>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">日期</TableHead>
                <TableHead className="whitespace-nowrap">货物类型</TableHead>
                <TableHead className="whitespace-nowrap">入库产品</TableHead>
                <TableHead className="whitespace-nowrap">供应商</TableHead>
                <TableHead className="whitespace-nowrap">产品规格</TableHead>
                <TableHead className="whitespace-nowrap">入库数量</TableHead>
                <TableHead className="whitespace-nowrap">货物照片</TableHead>
                <TableHead className="whitespace-nowrap">票据号</TableHead>
                <TableHead className="whitespace-nowrap">发货单照片</TableHead>
                <TableHead className="whitespace-nowrap">核对人</TableHead>
                <TableHead className="whitespace-nowrap">是否准确</TableHead>
                <TableHead className="whitespace-nowrap">打款情况</TableHead>
                <TableHead className="whitespace-nowrap">备注</TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={14}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    加载中...
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={14}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                records.map((row) => {
                  const items: (ReceiptItem | null)[] = row.items?.length
                    ? row.items
                    : [null];
                  const span = Math.max(items.length, 1);
                  const billFiles = fileIdsOf(row.images);
                  return items.map((item, idx) => (
                    <TableRow
                      key={`${row.id}-${item?.id ?? idx}`}
                      className="align-top"
                    >
                      {idx === 0 && (
                        <>
                          <TableCell
                            rowSpan={span}
                            className="whitespace-nowrap align-top"
                          >
                            <div className="font-medium">
                              {formatDateTime(row.receiptTime)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.receiptNo}
                            </div>
                          </TableCell>
                        </>
                      )}

                      {/* 明细级 */}
                      <TableCell className="whitespace-nowrap align-top">
                        {ITEM_TYPE_LABEL[item?.itemType || ''] ||
                          item?.itemType ||
                          '-'}
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="whitespace-nowrap">
                          {item?.itemName || '-'}
                        </span>
                        {item?.remark && (
                          <div className="text-xs text-muted-foreground">
                            行备注：{item.remark}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="whitespace-nowrap">
                          {item?.supplierName || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="whitespace-nowrap">
                          {item?.specName || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="whitespace-nowrap">
                          {item?.quantityText || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="align-top">
                        <Thumbs
                          fileIds={fileIdsOf(item?.images)}
                          onPreview={setPreviewUrl}
                        />
                      </TableCell>

                      {idx === 0 && (
                        <>
                          <TableCell
                            rowSpan={span}
                            className="whitespace-nowrap align-top"
                          >
                            <div>{row.billNo || '-'}</div>
                            <div className="text-xs text-muted-foreground">
                              {BILL_NO_SOURCE_LABEL[row.billNoSource || 'NONE'] ||
                                row.billNoSource}
                            </div>
                          </TableCell>
                          <TableCell
                            rowSpan={span}
                            className="align-top"
                          >
                            <Thumbs
                              fileIds={billFiles}
                              onPreview={setPreviewUrl}
                            />
                          </TableCell>
                          <TableCell
                            rowSpan={span}
                            className="whitespace-nowrap align-top"
                          >
                            {row.checker?.name || '-'}
                          </TableCell>
                          <TableCell
                            rowSpan={span}
                            className="whitespace-nowrap align-top"
                          >
                            {row.isAccurate ? (
                              <span className="text-[#00b800]">准确</span>
                            ) : (
                              <span className="text-[#ff4444]">不准确</span>
                            )}
                          </TableCell>
                          <TableCell
                            rowSpan={span}
                            className="whitespace-nowrap align-top"
                          >
                            <PaymentCell payment={row.payment} />
                            {row.billAmount !== null &&
                              row.billAmount !== undefined && (
                                <div className="text-xs text-muted-foreground">
                                  货款 {money(row.billAmount)}
                                </div>
                              )}
                          </TableCell>
                          <TableCell
                            rowSpan={span}
                            className="min-w-32 align-top"
                          >
                            <span className="break-words">{row.remark || '-'}</span>
                          </TableCell>
                          <TableCell
                            rowSpan={span}
                            className="whitespace-nowrap align-top text-right"
                          >
                            <div className="flex justify-end gap-1">
                              <PermissionGate permission="purchase:detail">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="查看详情"
                                  onClick={() => void openDetail(row)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </PermissionGate>
                              {canWriteRow('purchase:update', row) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title={
                                    hasManage
                                      ? '编辑（管理员可改他人记录）'
                                      : '编辑（自己提交的）'
                                  }
                                  onClick={() => void openEdit(row)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canWriteRow('purchase:delete', row) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-400"
                                  title={
                                    hasManage
                                      ? '删除（管理员可删他人记录）'
                                      : '删除（自己提交的）'
                                  }
                                  onClick={() => setDeleteTarget(row)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ));
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">
            共 {pagination.total} 条 · 第 {pagination.page} /{' '}
            {Math.max(pagination.totalPages, 1)} 页
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={String(pagination.pageSize)}
              onValueChange={(v) =>
                setPagination((p) => ({ ...p, pageSize: Number(v), page: 1 }))
              }
            >
              <SelectTrigger className="h-8 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    每页 {n} 条
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              上一页
            </Button>
            {pageNumbers.map((n) => (
              <Button
                key={n}
                variant={n === pagination.page ? 'default' : 'outline'}
                size="sm"
                className="w-9"
                onClick={() => setPagination((p) => ({ ...p, page: n }))}
              >
                {n}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={
                pagination.totalPages === 0 ||
                pagination.page >= pagination.totalPages
              }
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              下一页
            </Button>
          </div>
        </div>
      </Card>

      {/* 新增 / 编辑 */}
      <PurchaseReceiptForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        mode={formMode}
        record={editingRecord}
        onSuccess={() => {
          setIsFormOpen(false);
          void load();
        }}
      />

      {/* 详情抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent
          side="right"
          className="w-[560px] max-w-full overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              入库单详情{detailRecord?.receiptNo ? ` · ${detailRecord.receiptNo}` : ''}
            </SheetTitle>
          </SheetHeader>
          {detailRecord && (
            <div className="space-y-6 px-4 pb-6">
              {detailLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> 正在加载完整详情...
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#409fff]">
                  基本信息
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border p-3">
                  <Field label="入库单号" value={detailRecord.receiptNo} />
                  <Field
                    label="入库日期"
                    value={formatDateTime(detailRecord.receiptTime)}
                  />
                  <Field
                    label="核对人"
                    value={detailRecord.checker?.name || '-'}
                  />
                  <Field
                    label="是否准确"
                    value={
                      detailRecord.isAccurate ? (
                        <span className="text-[#00b800]">准确</span>
                      ) : (
                        <span className="text-[#ff4444]">不准确</span>
                      )
                    }
                  />
                  <Field
                    label="本次货款金额"
                    value={money(detailRecord.billAmount ?? null)}
                  />
                  <Field
                    label="票据号来源"
                    value={
                      BILL_NO_SOURCE_LABEL[
                        detailRecord.billNoSource || 'NONE'
                      ] || detailRecord.billNoSource
                    }
                  />
                  <Field label="备注" value={detailRecord.remark} />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#409fff]">票据</h3>
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <Field label="票据号" value={detailRecord.billNo} />
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">
                      发货单 / 票据照片
                    </div>
                    <Thumbs
                      fileIds={fileIdsOf(detailRecord.images)}
                      size="h-16 w-16"
                      onPreview={setPreviewUrl}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#409fff]">
                  物品明细（{detailRecord.items?.length ?? 0} 项）
                </h3>
                <div className="space-y-3">
                  {(detailRecord.items ?? []).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="space-y-3 rounded-lg border border-border p-3"
                    >
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <Field
                          label="货物类型"
                          value={ITEM_TYPE_LABEL[item.itemType] || item.itemType}
                        />
                        <Field label="物品" value={item.itemName} />
                        <Field label="供应商" value={item.supplierName} />
                        <Field label="规格" value={item.specName} />
                        <Field label="入库数量" value={item.quantityText} />
                        <Field label="行备注" value={item.remark} />
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-muted-foreground">
                          货物照片
                        </div>
                        <Thumbs
                          fileIds={fileIdsOf(item.images)}
                          size="h-14 w-14"
                          onPreview={setPreviewUrl}
                        />
                      </div>
                    </div>
                  ))}
                  {!detailRecord.items?.length && (
                    <p className="text-sm text-muted-foreground">暂无明细</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#409fff]">
                  打款关联
                </h3>
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {(() => {
                      const meta =
                        PAYMENT_STATUS_META[
                          detailRecord.payment?.status || 'NO_AMOUNT'
                        ] ?? PAYMENT_STATUS_META.NO_AMOUNT;
                      return (
                        <Badge
                          variant="outline"
                          className={cn('border-border', meta.className)}
                        >
                          {meta.label}
                        </Badge>
                      );
                    })()}
                    <span className="text-sm">
                      已付 {money(detailRecord.payment?.paidAmount ?? 0)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      共关联 {detailRecord.payment?.linkedCount ?? 0} 笔
                      {detailRecord.payment?.linkType === 'MANUAL'
                        ? '（人工关联）'
                        : detailRecord.payment?.linkType === 'AUTO'
                          ? '（按票据号自动匹配）'
                          : ''}
                    </span>
                  </div>
                  {detailRecord.payment?.records?.length ? (
                    detailRecord.payment.records.map((r) => (
                      <div
                        key={r.id}
                        className="rounded border border-border px-2 py-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{r.recordNo}</span>
                          <span className="font-medium">{money(r.amount)}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {formatDateTime(r.paymentTime)}
                          {r.title ? ` · ${r.title}` : ''}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      尚未匹配到打款记录
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 大图预览 */}
      <Dialog open={!!previewUrl} onOpenChange={(v) => !v && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>图片预览</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="图片预览"
              className="max-h-[80vh] w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除入库单「{deleteTarget?.receiptNo}」吗？该操作为软删除，数据不会物理丢失，但列表将不再显示。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

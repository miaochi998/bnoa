'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { getFilePreviewUrl } from '@/lib/api';
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
import { Search, Plus, Download, Eye, Pencil, Trash2, Ban, Wallet } from 'lucide-react';
import { PaymentForm } from './components/PaymentForm';
import { PermissionGate } from '@/components/PermissionGate';
import { usePermissionStore } from '@/lib/stores/permission-store';
import { toast } from 'sonner';
import {
  PAYMENT_TYPE_LABEL,
  PAY_METHOD_LABEL,
  INVOICE_STATUS_LABEL,
  STATUS_LABEL,
  CURRENCY_LABEL,
  RECEIVER_TYPE_LABEL,
} from './components/labels';

interface PaymentBill {
  id?: string;
  billNumber?: string;
  billDate?: string;
  billAmount?: number;
  billFileId?: string;
}

interface PaymentAttachment {
  id?: string;
  type: 'SCREENSHOT' | 'INVOICE';
  fileId: string;
  remark?: string;
}

interface PaymentRecord {
  id: string;
  recordNo: string;
  title: string;
  amount: number;
  currency: string;
  paymentTime: string;
  paymentType: string;
  receiverType: string;
  receiverName: string | null;
  supplierId?: string | null;
  consumableSupplierId?: string | null;
  customReceiverName?: string | null;
  payMethod: string;
  fromAccount?: string | null;
  invoiceStatus: string;
  status: 'DRAFT' | 'PAID' | 'FAILED' | 'CANCELLED';
  payerId: string;
  payerName?: string;
  remark?: string | null;
  billCount?: number;
  attachmentCount?: number;
  bills?: PaymentBill[];
  attachments?: PaymentAttachment[];
}

const GRID_COLS =
  'grid grid-cols-[minmax(140px,1.5fr)_100px_150px_100px_minmax(130px,1.2fr)_90px_100px_110px_92px] items-center gap-x-4';

// 判断是否为图片(否则按 PDF 处理)
function isImage(name?: string): boolean {
  if (!name) return true;
  const n = name.toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(n);
}

export default function PaymentsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [paymentType, setPaymentType] = useState('all');
  const [receiverType, setReceiverType] = useState('all');
  const [status, setStatus] = useState('all');
  const [invoiceStatus, setInvoiceStatus] = useState('all');
  const [payerId, setPayerId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [payers, setPayers] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingRecord, setEditingRecord] = useState<PaymentRecord | null>(null);
  const [detailRecord, setDetailRecord] = useState<PaymentRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRecord | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PaymentRecord | null>(null);
  // 大图预览
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);

  const permissionStore = usePermissionStore();
  const canUpdate =
    permissionStore.loaded && permissionStore.hasPermission('payment:update');

  const buildFilter = useCallback(
    (extra?: any) => {
      const f: any = { page: pagination.page, pageSize: pagination.pageSize, ...(extra || {}) };
      if (keyword) f.keyword = keyword;
      if (paymentType !== 'all') f.paymentType = paymentType;
      if (receiverType !== 'all') f.receiverType = receiverType;
      if (status !== 'all') f.status = status;
      if (invoiceStatus !== 'all') f.invoiceStatus = invoiceStatus;
      if (payerId !== 'all') f.payerId = payerId;
      if (startDate) f.startDate = startDate;
      if (endDate) f.endDate = endDate;
      return f;
    },
    [keyword, paymentType, receiverType, status, invoiceStatus, payerId, startDate, endDate, pagination.page, pagination.pageSize],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, meta } = await apiClient.paymentList(buildFilter());
      setRecords(data || []);
      setPagination((prev) => ({
        ...prev,
        total: meta?.total ?? 0,
        totalPages: meta?.totalPages ?? 0,
      }));
    } catch (e: any) {
      toast.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [buildFilter]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize, keyword, paymentType, receiverType, status, invoiceStatus, payerId, startDate, endDate]);

  useEffect(() => {
    (async () => {
      try {
        const usr = await apiClient.getUsers({}, { page: 1, pageSize: 100 });
        setPayers(usr?.nodes || []);
      } catch {
        // 静默
      }
    })();
  }, []);

  const openCreate = () => {
    setFormMode('create');
    setEditingRecord(null);
    setIsFormOpen(true);
  };

  const openEdit = async (r: PaymentRecord) => {
    // 必须取完整详情（含 bills/attachments），否则编辑表单会丢既有子记录
    let record = r;
    try {
      const detail = await apiClient.paymentDetail(r.id);
      record = detail || r;
    } catch {
      record = r;
    }
    setFormMode('edit');
    setEditingRecord(record);
    setIsFormOpen(true);
  };

  const openDetail = async (r: PaymentRecord) => {
    try {
      const detail = await apiClient.paymentDetail(r.id);
      setDetailRecord(detail);
    } catch {
      setDetailRecord(r);
    }
    setDetailOpen(true);
  };

  const handleExport = async () => {
    try {
      const filter = buildFilter({ page: undefined, pageSize: undefined });
      const { blob, filename } = await apiClient.paymentExport(filter);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('导出成功');
    } catch (e: any) {
      toast.error(e?.message || '导出失败');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.paymentDelete(deleteTarget.id);
      toast.success('删除成功');
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || '删除失败');
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await apiClient.paymentUpdate(cancelTarget.id, { status: 'CANCELLED' });
      toast.success('作废成功');
      setCancelTarget(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || '作废失败');
    }
  };

  // 详情字段行（统一样式）
  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm break-words">{value || '-'}</span>
    </div>
  );

  // 可点击缩略图（图片放大 / PDF新窗口）
  const FileThumb = ({ fileId, name }: { fileId?: string; name?: string }) => {
    if (!fileId) return null;
    const url = getFilePreviewUrl(fileId);
    const img = isImage(name);
    if (img) {
      return (
        <button
          type="button"
          className="h-14 w-14 shrink-0 overflow-hidden rounded border border-border transition-colors hover:border-[#409fff] hover:brightness-110"
          onClick={() => setPreviewFile({ url, name: name || '图片' })}
          title="点击查看大图"
        >
          <img src={url} alt={name || '图片'} className="h-full w-full object-cover" />
        </button>
      );
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded border border-border text-center text-[10px] leading-[13px] text-[#409fff] hover:border-[#409fff]"
        title="点击打开 PDF"
      >
        <span className="flex h-full w-full items-center justify-center px-1">PDF</span>
      </a>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border">
            <Wallet className="h-5 w-5 text-[#409fff]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">付款记录</h1>
            <p className="text-sm text-muted-foreground">管理日常打款流水</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate permission="payment:export">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> 导出
            </Button>
          </PermissionGate>
          <PermissionGate permission="payment:create">
            <Button onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" /> 新增付款记录
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">筛选</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative w-56">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="搜索款项名称/收款方"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Select value={paymentType} onValueChange={setPaymentType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="打款类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {Object.entries(PAYMENT_TYPE_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={receiverType} onValueChange={setReceiverType}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="收款方类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部收款方</SelectItem>
              <SelectItem value="SUPPLIER">供应商</SelectItem>
              <SelectItem value="CONSUMABLE_SUPPLIER">耗材供应商</SelectItem>
              <SelectItem value="CUSTOM">自定义</SelectItem>
            </SelectContent>
          </Select>
          <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="发票状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部发票状态</SelectItem>
              {Object.entries(INVOICE_STATUS_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {Object.entries(STATUS_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={payerId} onValueChange={setPayerId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="打款人" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部打款人</SelectItem>
              {payers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            className="w-40"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="起"
          />
          <span className="text-muted-foreground">至</span>
          <Input
            type="date"
            className="w-40"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="止"
          />
          <Button
            variant="ghost"
            onClick={() => {
              setKeyword('');
              setPaymentType('all');
              setReceiverType('all');
              setStatus('all');
              setInvoiceStatus('all');
              setPayerId('all');
              setStartDate('');
              setEndDate('');
            }}
          >
            重置
          </Button>
        </CardContent>
      </Card>

      {/* 列表 */}
      <Card>
        <div className="overflow-x-auto">
          <div className={GRID_COLS + ' rounded-t-lg border-b border-border bg-[#2e2e2e] px-3 py-2 text-xs font-medium text-muted-foreground'}>
            <span>款项名称</span>
            <span>金额</span>
            <span>打款时间</span>
            <span>打款类型</span>
            <span>收款方</span>
            <span>发票状态</span>
            <span>记录状态</span>
            <span>打款人</span>
            <span className="text-right">操作</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">加载中...</div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">暂无数据</div>
          ) : (
            records.map((r) => (
              <div key={r.id} className={GRID_COLS + ' border-b border-border px-3 py-2.5 text-sm transition-colors hover:bg-[#2e2e2e]/50'}>
                <span className="truncate">{r.title}</span>
                <span className="font-medium">¥{Number(r.amount).toLocaleString()}</span>
                <span className="text-muted-foreground">
                  {new Date(r.paymentTime).toLocaleString('zh-CN')}
                </span>
                <span>{PAYMENT_TYPE_LABEL[r.paymentType] || r.paymentType}</span>
                <span className="truncate">{r.receiverName || '-'}</span>
                <span>{INVOICE_STATUS_LABEL[r.invoiceStatus] || r.invoiceStatus}</span>
                <span>
                  <span
                    className={
                      r.status === 'PAID'
                        ? 'text-green-500'
                        : r.status === 'FAILED'
                          ? 'text-red-500'
                          : r.status === 'CANCELLED'
                            ? 'text-muted-foreground line-through'
                            : 'text-yellow-500'
                    }
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </span>
                <span>{r.payerName || '-'}</span>
                <span className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(r)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {canUpdate && r.status !== 'CANCELLED' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {canUpdate && r.status !== 'CANCELLED' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-400"
                      onClick={() => setCancelTarget(r)}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  )}
                  <PermissionGate permission="payment:delete">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteTarget(r)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </PermissionGate>
                </span>
              </div>
            ))
          )}
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              共 {pagination.total} 条
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                上一页
              </Button>
              <span className="text-xs">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                下一页
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 新增/编辑弹窗 */}
      <PaymentForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        mode={formMode}
        record={editingRecord}
        onSuccess={() => {
          setIsFormOpen(false);
          load();
        }}
      />

      {/* 详情：右侧抽屉 */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-[480px] max-w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle>付款记录详情</SheetTitle>
          </SheetHeader>
          {detailRecord && (
            <div className="space-y-6 px-4 pb-6">
              {/* 基本信息 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#409fff]">基本信息</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border p-3">
                  <Field label="款项名称" value={detailRecord.title} />
                  <Field label="流水号" value={detailRecord.recordNo} />
                  <Field label="打款金额" value={`¥${Number(detailRecord.amount).toLocaleString()} ${CURRENCY_LABEL[detailRecord.currency] || detailRecord.currency}`} />
                  <Field label="打款时间" value={new Date(detailRecord.paymentTime).toLocaleString('zh-CN')} />
                  <Field label="打款类型" value={PAYMENT_TYPE_LABEL[detailRecord.paymentType] || detailRecord.paymentType} />
                  <Field label="打款方式" value={PAY_METHOD_LABEL[detailRecord.payMethod] || detailRecord.payMethod} />
                  <Field label="付款账户" value={detailRecord.fromAccount} />
                  <Field label="打款人" value={detailRecord.payerName || '-'} />
                  <Field label="发票状态" value={INVOICE_STATUS_LABEL[detailRecord.invoiceStatus] || detailRecord.invoiceStatus} />
                  <Field label="记录状态" value={STATUS_LABEL[detailRecord.status] || detailRecord.status} />
                  <Field label="备注" value={detailRecord.remark} />
                </div>
              </div>

              {/* 收款方 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#409fff]">收款方</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-border p-3">
                  <Field label="收款方类型" value={RECEIVER_TYPE_LABEL[detailRecord.receiverType] || detailRecord.receiverType} />
                  <Field label="收款方名称" value={detailRecord.receiverName || detailRecord.customReceiverName || '-'} />
                </div>
              </div>

              {/* 票据 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#409fff]">票据</h3>
                {detailRecord.bills && detailRecord.bills.length > 0 ? (
                  <div className="space-y-3">
                    {detailRecord.bills.map((b: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 rounded-lg border border-border p-3">
                        <FileThumb fileId={b.billFile?.id || b.billFileId} name={b.billFile?.name} />
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                          <Field label="票据编号" value={b.billNumber} />
                          <Field label="票据日期" value={b.billDate ? new Date(b.billDate).toLocaleDateString('zh-CN') : '-'} />
                          <Field label="票据金额" value={b.billAmount != null ? `¥${Number(b.billAmount).toLocaleString()}` : '-'} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无票据</p>
                )}
              </div>

              {/* 附件：打款截图 + 发票 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#409fff]">附件</h3>
                {detailRecord.attachments && detailRecord.attachments.length > 0 ? (
                  <div className="space-y-4">
                    {(['SCREENSHOT', 'INVOICE'] as const).map((t) => {
                      const items = (detailRecord.attachments || []).filter((a: any) => a.type === t);
                      if (items.length === 0) return null;
                      return (
                        <div key={t} className="rounded-lg border border-border p-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            {t === 'INVOICE' ? '发票图片 / PDF' : '打款截图'}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {items.map((a: any, idx: number) => (
                              <FileThumb key={idx} fileId={a.file?.id || a.fileId} name={a.file?.name} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">暂无附件</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* 大图预览 */}
      <Dialog open={!!previewFile} onOpenChange={(v) => !v && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl bg-[#2e2e2e] border-[#1e1e1e] text-white">
          <DialogHeader>
            <DialogTitle>{previewFile?.name || '图片预览'}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <img
              src={previewFile.url}
              alt={previewFile.name || '图片'}
              className="w-full max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{deleteTarget?.title}」这条付款记录吗？该操作不可撤销（软删除）。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 作废确认 */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认作废</AlertDialogTitle>
            <AlertDialogDescription>
              确定作废「{cancelTarget?.title}」这条付款记录吗？作废后不可再编辑，且该操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-red-600 hover:bg-red-500">
              作废
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

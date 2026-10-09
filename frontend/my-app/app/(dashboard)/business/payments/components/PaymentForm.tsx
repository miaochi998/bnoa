'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2, Loader2, Plus, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { PAYMENT_TYPE_LABEL, PAY_METHOD_LABEL, CURRENCY_LABEL, INVOICE_STATUS_LABEL, STATUS_LABEL } from './labels';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface PaymentFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'create' | 'edit';
  record: any;
  onSuccess: () => void;
}

interface BillItem {
  id?: string;
  billNumber: string;
  billDate?: string;
  billAmount?: number;
  billFileId?: string;
}

interface AttachmentItem {
  id?: string;
  type: 'SCREENSHOT' | 'INVOICE';
  fileId: string;
  remark?: string;
}

/**
 * /upload/file 的返回体。
 * ⚠️ 已知坑：返回的文件标识字段是 `fileId`，不是 `id`；
 * 旧代码取 `item.id` 会拿到 undefined，导致附件静默丢失（界面仍提示"上传成功"）。
 */
interface UploadResult {
  fileId?: string;
  id?: string;
}

function pickFileId(item: unknown): string {
  const r = item as UploadResult | null | undefined;
  return r?.fileId || r?.id || '';
}

/** 可关联的入库单候选（来自 /purchase-receipts/for-payment） */
interface ReceiptCandidate {
  id: string;
  receiptNo: string;
  receiptTime?: string | null;
  billNo?: string | null;
  billAmount?: number | null;
  itemSummary?: string;
  payment?: {
    status?: string;
    paidAmount?: number;
    linkedCount?: number;
  } | null;
}

const PAYMENT_TYPES = Object.entries(PAYMENT_TYPE_LABEL).map(([value, label]) => ({ value, label }));
const PAY_METHODS = Object.entries(PAY_METHOD_LABEL).map(([value, label]) => ({ value, label }));
const CURRENCIES = Object.entries(CURRENCY_LABEL).map(([value, label]) => ({ value, label }));
const INVOICE_STATUSES = Object.entries(INVOICE_STATUS_LABEL).map(([value, label]) => ({ value, label }));
const STATUSES = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

/** 编辑态下原记录已关联的入库单摘要（详情接口 purchaseReceipts） */
interface LinkedReceiptSummary {
  id: string;
  receiptNo?: string;
  receiptTime?: string | null;
  billNo?: string | null;
  billAmount?: number | null;
}

const RECEIPT_PAYMENT_LABEL: Record<string, string> = {
  SETTLED: '已结清',
  PARTIAL: '部分付款',
  UNPAID: '未付款',
  NO_AMOUNT: '未填金额',
};

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN', { hour12: false });
}

const receiptMoney = (n?: number | null) =>
  n === null || n === undefined ? '-' : `¥${Number(n).toLocaleString()}`;

export function PaymentForm({ open, onOpenChange, mode, record, onSuccess }: PaymentFormProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [paymentTime, setPaymentTime] = useState('');
  const [paymentType, setPaymentType] = useState('GOODS');
  const [receiverType, setReceiverType] = useState('SUPPLIER');
  const [supplierId, setSupplierId] = useState('none');
  const [consumableSupplierId, setConsumableSupplierId] = useState('none');
  const [customReceiverName, setCustomReceiverName] = useState('');
  const [payMethod, setPayMethod] = useState('CORPORATE_TRANSFER');
  const [fromAccount, setFromAccount] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('PENDING');
  const [status, setStatus] = useState('DRAFT');
  const [payerId, setPayerId] = useState('none');
  const [remark, setRemark] = useState('');
  const [bills, setBills] = useState<BillItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [saving, setSaving] = useState(false);

  // ===== 关联入库单（多选） =====
  const [receiptCandidates, setReceiptCandidates] = useState<ReceiptCandidate[]>([]);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [receiptKeyword, setReceiptKeyword] = useState('');
  const debouncedReceiptKeyword = useDebouncedValue(receiptKeyword, 300);

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [consumableSuppliers, setConsumableSuppliers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  /** 当前「关联入库单」的收款方 key；为空表示不展示该区块 */
  const receiptKey = useMemo(() => {
    if (receiverType === 'SUPPLIER' && supplierId !== 'none') return `S:${supplierId}`;
    if (receiverType === 'CONSUMABLE_SUPPLIER' && consumableSupplierId !== 'none')
      return `C:${consumableSupplierId}`;
    return '';
  }, [receiverType, supplierId, consumableSupplierId]);

  /** 编辑态下原记录已关联的入库单（用于默认勾选 / 补显示） */
  const linkedReceipts = useMemo<LinkedReceiptSummary[]>(() => {
    const list = (record?.purchaseReceipts ?? []) as LinkedReceiptSummary[];
    return list.filter((r) => !!r?.id);
  }, [record]);

  const loadOptions = useCallback(async () => {
    try {
      const [sup, cons, usr] = await Promise.all([
        apiClient.getSuppliersForSelect(),
        apiClient.getConsumableSuppliersForSelect(),
        apiClient.getUsers({}, { page: 1, pageSize: 100 }),
      ]);
      setSuppliers(sup || []);
      setConsumableSuppliers(cons || []);
      setUsers(usr?.nodes || []);
    } catch {
      // 静默
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadOptions();
    if (mode === 'edit' && record) {
      setTitle(record.title || '');
      setAmount(record.amount != null ? String(record.amount) : '');
      setCurrency(record.currency || 'CNY');
      setPaymentTime(
        record.paymentTime ? new Date(record.paymentTime).toISOString().slice(0, 16) : '',
      );
      setPaymentType(record.paymentType || 'GOODS');
      setReceiverType(record.receiverType || 'SUPPLIER');
      setSupplierId(record.supplierId || 'none');
      setConsumableSupplierId(record.consumableSupplierId || 'none');
      setCustomReceiverName(record.customReceiverName || '');
      setPayMethod(record.payMethod || 'CORPORATE_TRANSFER');
      setFromAccount(record.fromAccount || '');
      setInvoiceStatus(record.invoiceStatus || 'PENDING');
      setStatus(record.status || 'DRAFT');
      setPayerId(record.payerId || 'none');
      setRemark(record.remark || '');
      setBills((record.bills || []).map((b: any) => ({
        id: b.id,
        billNumber: b.billNumber || '',
        billDate: b.billDate ? new Date(b.billDate).toISOString().slice(0, 10) : '',
        billAmount: b.billAmount != null ? Number(b.billAmount) : undefined,
        billFileId: b.billFile?.id || b.billFileId,
      })));
      setAttachments((record.attachments || []).map((a: any) => ({
        id: a.id,
        type: a.type,
        fileId: a.file?.id || a.fileId,
        remark: a.remark,
      })));
      // 已关联的入库单默认勾选（详情接口返回 purchaseReceipts）
      setSelectedReceiptIds(linkedReceipts.map((r) => r.id));
    } else {
      // create：默认当前时间
      const now = new Date();
      setTitle('');
      setAmount('');
      setCurrency('CNY');
      setPaymentTime(now.toISOString().slice(0, 16));
      setPaymentType('GOODS');
      setReceiverType('SUPPLIER');
      setSupplierId('none');
      setConsumableSupplierId('none');
      setCustomReceiverName('');
      setPayMethod('CORPORATE_TRANSFER');
      setFromAccount('');
      setInvoiceStatus('PENDING');
      setStatus('DRAFT');
      setPayerId('none');
      setRemark('');
      setBills([]);
      setAttachments([]);
      setSelectedReceiptIds([]);
    }
  }, [open, mode, record, loadOptions, linkedReceipts]);

  // 关联入库单候选：按收款方（供应商 / 耗材供应商）拉取，已结清的由后端过滤掉
  useEffect(() => {
    if (!open || !receiptKey) {
      setReceiptCandidates([]);
      setReceiptsLoading(false);
      return;
    }
    let cancelled = false;
    setReceiptsLoading(true);
    (async () => {
      try {
        const [prefix, sid] = receiptKey.split(':');
        const list = await apiClient.purchaseReceiptForPayment({
          supplierType: prefix === 'C' ? 'CONSUMABLE_SUPPLIER' : 'SUPPLIER',
          supplierId: sid,
          keyword: debouncedReceiptKeyword || undefined,
        });
        if (!cancelled) setReceiptCandidates((list ?? []) as ReceiptCandidate[]);
      } catch {
        // 权限不足/无候选都不报错，展示空态即可
        if (!cancelled) setReceiptCandidates([]);
      } finally {
        if (!cancelled) setReceiptsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, receiptKey, debouncedReceiptKeyword]);

  /** 已勾选但不在候选里（已结清/详情带回）的入库单，补出来避免"勾选看不见" */
  const displayReceipts = useMemo(() => {
    const list = [...receiptCandidates];
    const have = new Set(list.map((c) => c.id));
    selectedReceiptIds.forEach((id) => {
      if (have.has(id)) return;
      const linked = linkedReceipts.find((r) => r.id === id);
      if (linked) {
        list.push({
          id: linked.id,
          receiptNo: linked.receiptNo || '-',
          receiptTime: linked.receiptTime,
          billNo: linked.billNo,
          billAmount: linked.billAmount,
          itemSummary: '',
          payment: null,
        });
      }
    });
    return list;
  }, [receiptCandidates, selectedReceiptIds, linkedReceipts]);

  const toggleReceipt = (id: string) => {
    setSelectedReceiptIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleUpload = async (file: File, target: 'bill' | 'screenshot' | 'invoice', billIndex?: number) => {
    try {
      const item = await apiClient.uploadFile(file);
      const fileId = pickFileId(item);
      if (!fileId) throw new Error('上传返回缺少文件标识');
      if (target === 'bill' && billIndex != null) {
        setBills((prev) =>
          prev.map((b, i) => (i === billIndex ? { ...b, billFileId: fileId } : b)),
        );
      } else if (target === 'screenshot') {
        setAttachments((prev) => [...prev, { type: 'SCREENSHOT', fileId }]);
      } else if (target === 'invoice') {
        setAttachments((prev) => [...prev, { type: 'INVOICE', fileId }]);
      }
      toast.success('上传成功');
    } catch (e: any) {
      toast.error(e?.message || '上传失败');
    }
  };

  const addBill = () => setBills((p) => [...p, { billNumber: '', billFileId: undefined }]);
  const removeBill = (idx: number) => setBills((p) => p.filter((_, i) => i !== idx));
  const addAttachment = (type: 'SCREENSHOT' | 'INVOICE') =>
    setAttachments((p) => [...p, { type, fileId: '' }]);
  const removeAttachment = (idx: number) =>
    setAttachments((p) => p.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!title.trim()) return toast.error('请填写款项名称');
    if (!amount) return toast.error('请填写打款金额');
    setSaving(true);
    try {
      const dto: any = {
        title,
        amount: Number(amount),
        currency,
        paymentTime: paymentTime ? new Date(paymentTime).toISOString() : new Date().toISOString(),
        paymentType,
        receiverType,
        payMethod,
        fromAccount: fromAccount || undefined,
        invoiceStatus,
        status,
        payerId: payerId !== 'none' ? payerId : undefined,
        remark: remark || undefined,
      };
      if (receiverType === 'SUPPLIER' && supplierId !== 'none') dto.supplierId = supplierId;
      if (receiverType === 'CONSUMABLE_SUPPLIER' && consumableSupplierId !== 'none')
        dto.consumableSupplierId = consumableSupplierId;
      if (receiverType === 'CUSTOM') dto.customReceiverName = customReceiverName;

      const cleanBills = bills
        .filter((b) => b.billNumber)
        .map((b) => ({
          billNumber: b.billNumber,
          billDate: b.billDate || undefined,
          billAmount: b.billAmount,
          billFileId: b.billFileId || undefined,
        }));
      const cleanAttachments = attachments.filter((a) => a.fileId);
      if (cleanBills.length) dto.bills = cleanBills;
      if (cleanAttachments.length) dto.attachments = cleanAttachments;
      // 关联入库单：勾选结果全量提交（清空即解除关联）
      if (receiverType === 'SUPPLIER' || receiverType === 'CONSUMABLE_SUPPLIER') {
        dto.purchaseReceiptIds = selectedReceiptIds.filter(Boolean);
      }

      if (mode === 'create') {
        await apiClient.paymentCreate(dto);
      } else {
        await apiClient.paymentUpdate(record.id, dto);
      }
      toast.success(mode === 'create' ? '创建成功' : '保存成功');
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 分组小标题
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="col-span-2 mt-1 border-b border-border pb-1 text-sm font-semibold text-[#409fff]">
      {children}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增付款记录' : '编辑付款记录'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {/* 打款信息 */}
          <SectionTitle>打款信息</SectionTitle>
          <div className="space-y-1">
            <Label>款项名称 *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：某供应商货款" />
          </div>
          <div className="space-y-1">
            <Label>打款金额 *</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label>币种</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>打款时间</Label>
            <Input type="datetime-local" value={paymentTime} onChange={(e) => setPaymentTime(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>打款类型</Label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>打款方式</Label>
            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAY_METHODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>付款账户</Label>
            <Input value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} placeholder="对公账户/账号" />
          </div>
          <div className="space-y-1">
            <Label>打款人</Label>
            <Select value={payerId} onValueChange={setPayerId}>
              <SelectTrigger><SelectValue placeholder="选择打款人" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">请选择</SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 收款方 */}
          <SectionTitle>收款方</SectionTitle>
          <div className="space-y-1">
            <Label>收款方类型</Label>
            <Select
              value={receiverType}
              onValueChange={(v) => {
                setReceiverType(v);
                // 换收款方 → 原有勾选不再适用
                setSelectedReceiptIds([]);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SUPPLIER">供应商</SelectItem>
                <SelectItem value="CONSUMABLE_SUPPLIER">耗材供应商</SelectItem>
                <SelectItem value="CUSTOM">自定义（临时合作）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {receiverType === 'SUPPLIER' && (
            <div className="space-y-1">
              <Label>选择供应商</Label>
              <Select
                value={supplierId}
                onValueChange={(v) => {
                  setSupplierId(v);
                  setSelectedReceiptIds([]);
                }}
              >
                <SelectTrigger><SelectValue placeholder="选择供应商" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">请选择</SelectItem>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {receiverType === 'CONSUMABLE_SUPPLIER' && (
            <div className="space-y-1">
              <Label>选择耗材供应商</Label>
              <Select
                value={consumableSupplierId}
                onValueChange={(v) => {
                  setConsumableSupplierId(v);
                  setSelectedReceiptIds([]);
                }}
              >
                <SelectTrigger><SelectValue placeholder="选择耗材供应商" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">请选择</SelectItem>
                  {consumableSuppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {receiverType === 'CUSTOM' && (
            <div className="space-y-1">
              <Label>自定义收款方名称</Label>
              <Input value={customReceiverName} onChange={(e) => setCustomReceiverName(e.target.value)} placeholder="临时合作收款方名称" />
            </div>
          )}

          {/* 关联入库单（多选，按收款方筛选候选） */}
          {receiptKey && (
            <>
              <SectionTitle>关联入库单</SectionTitle>
              <div className="col-span-2 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    className="w-64"
                    placeholder="按入库单号/票据号搜索"
                    value={receiptKeyword}
                    onChange={(e) => setReceiptKeyword(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    <Link2 className="mr-1 inline h-3 w-3" />
                    已选 {selectedReceiptIds.length} 张入库单
                  </span>
                  <span className="text-xs text-muted-foreground">
                    已结清的入库单不会出现在候选中
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                  {receiptsLoading ? (
                    <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> 正在加载候选入库单...
                    </div>
                  ) : displayReceipts.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                      该供应商没有待付款的入库单
                    </div>
                  ) : (
                    displayReceipts.map((c) => {
                      const checked = selectedReceiptIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          className="flex cursor-pointer items-start gap-3 border-b border-border px-3 py-2 transition-colors duration-200 last:border-b-0 hover:bg-[#2e2e2e]"
                          onClick={() => toggleReceipt(c.id)}
                        >
                          <Checkbox
                            checked={checked}
                            className="mt-0.5"
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => toggleReceipt(c.id)}
                          />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <span className="font-medium">{c.receiptNo}</span>
                              <span className="text-muted-foreground">
                                {formatDateTime(c.receiptTime)}
                              </span>
                              <span className="text-muted-foreground">
                                票据号 {c.billNo || '-'}
                              </span>
                              <span>货款 {receiptMoney(c.billAmount)}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {RECEIPT_PAYMENT_LABEL[c.payment?.status || ''] ||
                                '打款状态未知'}
                              {c.payment?.paidAmount
                                ? ` · 已付 ${receiptMoney(c.payment.paidAmount)}`
                                : ''}
                            </div>
                            {c.itemSummary && (
                              <div className="truncate text-xs text-muted-foreground">
                                {c.itemSummary}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {/* 开票与状态 */}
          <SectionTitle>开票与状态</SectionTitle>
          <div className="space-y-1">
            <Label>发票状态</Label>
            <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVOICE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>记录状态</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.filter((s) => mode !== 'edit' || s.value !== 'CANCELLED').map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label>备注</Label>
            <Textarea value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="备注说明（选填）" />
          </div>

          {/* 票据子记录 */}
          <SectionTitle>票据（一单多票）</SectionTitle>
          <div className="col-span-2 space-y-2">
            {bills.length === 0 && (
              <div className="text-sm text-muted-foreground">暂无票据</div>
            )}
            {bills.map((b, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                <Input
                  className="w-40"
                  placeholder="票据编号"
                  value={b.billNumber}
                  onChange={(e) =>
                    setBills((prev) => prev.map((x, i) => (i === idx ? { ...x, billNumber: e.target.value } : x)))
                  }
                />
                <Input
                  className="w-36"
                  type="date"
                  value={b.billDate || ''}
                  onChange={(e) =>
                    setBills((prev) => prev.map((x, i) => (i === idx ? { ...x, billDate: e.target.value } : x)))
                  }
                />
                <Input
                  className="w-28"
                  type="number"
                  placeholder="票据金额"
                  value={b.billAmount != null ? String(b.billAmount) : ''}
                  onChange={(e) =>
                    setBills((prev) => prev.map((x, i) => (i === idx ? { ...x, billAmount: e.target.value ? Number(e.target.value) : undefined } : x)))
                  }
                />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id={`bill-file-${idx}`}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f, 'bill', idx);
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`bill-file-${idx}`)?.click()}>
                  <Upload className="mr-1 h-3 w-3" /> 票据照片
                </Button>
                {b.billFileId && <span className="text-xs text-green-500">已上传</span>}
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeBill(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addBill}>
              <Plus className="mr-1 h-3 w-3" /> 添加票据
            </Button>
          </div>

          {/* 附件：打款截图 + 发票 */}
          <SectionTitle>附件</SectionTitle>
          <div className="col-span-2 space-y-2">
            {attachments.length === 0 && (
              <div className="text-sm text-muted-foreground">暂无附件</div>
            )}
            {attachments.map((a, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded-lg border border-border p-2">
                <span className="w-32 text-xs text-muted-foreground">{a.type === 'INVOICE' ? '发票(图片/PDF)' : '打款截图'}</span>
                <input
                  type="file"
                  accept={a.type === 'INVOICE' ? 'image/*,.pdf' : 'image/*'}
                  className="hidden"
                  id={`att-file-${idx}`}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const item = await apiClient.uploadFile(f);
                      const fileId = pickFileId(item);
                      if (!fileId) throw new Error('上传返回缺少文件标识');
                      setAttachments((prev) => prev.map((x, i) => (i === idx ? { ...x, fileId } : x)));
                      toast.success('上传成功');
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : '上传失败');
                    }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`att-file-${idx}`)?.click()}>
                  <Upload className="mr-1 h-3 w-3" /> 上传
                </Button>
                {a.fileId && <span className="text-xs text-green-500">已上传</span>}
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAttachment(idx)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => addAttachment('SCREENSHOT')}>
                <Plus className="mr-1 h-3 w-3" /> 添加打款截图
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => addAttachment('INVOICE')}>
                <Plus className="mr-1 h-3 w-3" /> 添加发票
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? '保存中...' : mode === 'create' ? '创建' : '保存'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

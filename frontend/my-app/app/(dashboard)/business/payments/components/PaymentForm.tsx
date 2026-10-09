'use client';

/**
 * 付款记录 · 新增 / 编辑表单
 *
 * 布局参照同项目的进货入库表单（PurchaseReceiptForm）：
 * - 弹窗 sm:max-w-[1100px]（**必须带 sm: 前缀**，否则被 shadcn 默认 sm:max-w-lg 覆盖）；
 * - 字段一行四列（lg:grid-cols-4），区块纵向紧凑，目标是一屏无垂直滚动；
 * - 「关联入库单」不再平铺候选列表，改为「按钮 → 右侧抽屉多选 → 回填摘要 + 可展开只读列表」。
 */

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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ChevronDown,
  Link2,
  Loader2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
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
    linkType?: string | null;
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

/** 编辑态已关联的入库单 → 展示信息（已结清等不在候选里的场景的兜底） */
function linkedToCandidate(r: LinkedReceiptSummary): ReceiptCandidate {
  return {
    id: r.id,
    receiptNo: r.receiptNo || '-',
    receiptTime: r.receiptTime,
    billNo: r.billNo,
    billAmount: r.billAmount,
    itemSummary: '',
    payment: null,
  };
}

/**
 * 分组小标题（弹窗内网格为 2 列 / lg 4 列）
 * ⚠️ 必须定义在组件外：在组件内定义函数式组件会让其子树每次渲染都重新挂载（输入框会丢焦点）。
 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-2 border-b border-border pb-1 text-sm font-semibold text-[#409fff] lg:col-span-4">
      {children}
    </div>
  );
}

/** 一行内的字段容器（同样必须定义在组件外，避免输入时重挂载丢焦点） */
function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

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

  // ===== 关联入库单（抽屉多选） =====
  /** 候选入库单（抽屉打开时才请求；已结清的由后端过滤掉） */
  const [receiptCandidates, setReceiptCandidates] = useState<ReceiptCandidate[]>([]);
  /**
   * 已见过的入库单信息累积表。
   * 候选列表会随搜索关键字变化，若直接拿候选当数据源，
   * 「先勾选 → 再改关键字」会让已关联项在展示列表里凭空消失（但仍在提交里），故累积缓存。
   */
  const [receiptCache, setReceiptCache] = useState<Record<string, ReceiptCandidate>>({});
  /** 表单最终选中的入库单 id（全量提交） */
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);
  /** 抽屉内的临时勾选（点「确定」才回填表单） */
  const [receiptDraftIds, setReceiptDraftIds] = useState<string[]>([]);
  const [receiptSheetOpen, setReceiptSheetOpen] = useState(false);
  /** 已关联列表的展开 / 收起 */
  const [receiptExpanded, setReceiptExpanded] = useState(false);
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
    // 抽屉/展开态一律复位，避免上次残留
    setReceiptSheetOpen(false);
    setReceiptDraftIds([]);
    setReceiptExpanded(false);
    setReceiptCandidates([]);
    setReceiptKeyword('');
    // 信息缓存重置：编辑态先用已关联入库单打底（已结清的不会出现在候选里）
    setReceiptCache(() => {
      const seed: Record<string, ReceiptCandidate> = {};
      if (mode === 'edit') {
        linkedReceipts.forEach((r) => {
          seed[r.id] = linkedToCandidate(r);
        });
      }
      return seed;
    });
  }, [open, mode, record, loadOptions, linkedReceipts]);

  // 关联入库单候选：仅在抽屉打开时按收款方（供应商 / 耗材供应商）拉取
  useEffect(() => {
    if (!open || !receiptSheetOpen || !receiptKey) {
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
        if (cancelled) return;
        const rows = (list ?? []) as ReceiptCandidate[];
        setReceiptCandidates(rows);
        setReceiptCache((prev) => {
          const next = { ...prev };
          rows.forEach((c) => {
            next[c.id] = c;
          });
          return next;
        });
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
  }, [open, receiptSheetOpen, receiptKey, debouncedReceiptKeyword]);

  /** id → 入库单信息（累积缓存：候选实时信息优先，编辑态历史关联兜底） */
  const receiptInfoMap = useMemo(() => {
    const map = new Map<string, ReceiptCandidate>();
    Object.values(receiptCache).forEach((c) => map.set(c.id, c));
    return map;
  }, [receiptCache]);

  /** 表单里已选中的入库单（按勾选顺序展示） */
  const selectedReceiptList = useMemo(
    () =>
      selectedReceiptIds
        .map((id) => receiptInfoMap.get(id))
        .filter((r): r is ReceiptCandidate => !!r),
    [selectedReceiptIds, receiptInfoMap],
  );

  /** 抽屉列表：已勾选但不在当前候选（被关键字过滤 / 已结清）的，补出来避免"勾选看不见" */
  const sheetReceiptList = useMemo(() => {
    const list = [...receiptCandidates];
    const have = new Set(list.map((c) => c.id));
    receiptDraftIds.forEach((id) => {
      if (have.has(id)) return;
      const info = receiptInfoMap.get(id);
      if (info) list.push(info);
    });
    return list;
  }, [receiptCandidates, receiptDraftIds, receiptInfoMap]);

  const openReceiptSheet = () => {
    setReceiptDraftIds(selectedReceiptIds);
    setReceiptKeyword('');
    setReceiptSheetOpen(true);
  };

  const toggleDraftReceipt = (id: string) => {
    setReceiptDraftIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const confirmReceiptSheet = () => {
    setSelectedReceiptIds(receiptDraftIds);
    setReceiptExpanded(receiptDraftIds.length > 0);
    setReceiptSheetOpen(false);
  };

  const removeSelectedReceipt = (id: string) => {
    setSelectedReceiptIds((prev) => prev.filter((x) => x !== id));
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
    // ⚠️ 票据号是后端必填：只传票据号非空的票据行。
    // 若某行传了照片却没填票据号，该行会被整条丢弃（照片一起丢）——必须显式阻断，不能静默。
    const photoWithoutBillNo = bills.findIndex(
      (b) => !!b.billFileId && !b.billNumber.trim(),
    );
    if (photoWithoutBillNo >= 0) {
      return toast.error(
        `第 ${photoWithoutBillNo + 1} 条票据已上传照片，请补填票据号，否则该票据不会被保存`,
      );
    }
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
        .filter((b) => b.billNumber.trim())
        .map((b) => ({
          billNumber: b.billNumber.trim(),
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

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) setReceiptSheetOpen(false);
          onOpenChange(v);
        }}
      >
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-[1100px]">
          <DialogHeader>
            <DialogTitle className="pr-6">
              {mode === 'create' ? '新增付款记录' : '编辑付款记录'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-4">
            {/* 打款信息 */}
            <SectionTitle>打款信息</SectionTitle>
            <Field label="款项名称 *">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：某供应商货款" />
            </Field>
            <Field label="打款金额 *">
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="币种">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="打款时间">
              <Input type="datetime-local" value={paymentTime} onChange={(e) => setPaymentTime(e.target.value)} />
            </Field>
            <Field label="打款类型">
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="打款方式">
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAY_METHODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="付款账户">
              <Input value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} placeholder="对公账户/账号" />
            </Field>
            <Field label="打款人">
              <Select value={payerId} onValueChange={setPayerId}>
                <SelectTrigger className="cursor-pointer"><SelectValue placeholder="选择打款人" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">请选择</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* 收款方 */}
            <SectionTitle>收款方</SectionTitle>
            <Field label="收款方类型">
              <Select
                value={receiverType}
                onValueChange={(v) => {
                  setReceiverType(v);
                  // 换收款方 → 原有勾选不再适用
                  setSelectedReceiptIds([]);
                  setReceiptExpanded(false);
                }}
              >
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUPPLIER">供应商</SelectItem>
                  <SelectItem value="CONSUMABLE_SUPPLIER">耗材供应商</SelectItem>
                  <SelectItem value="CUSTOM">自定义（临时合作）</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {receiverType === 'SUPPLIER' && (
              <Field label="选择供应商">
                <Select
                  value={supplierId}
                  onValueChange={(v) => {
                    setSupplierId(v);
                    setSelectedReceiptIds([]);
                    setReceiptExpanded(false);
                  }}
                >
                  <SelectTrigger className="cursor-pointer"><SelectValue placeholder="选择供应商" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">请选择</SelectItem>
                    {suppliers.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {receiverType === 'CONSUMABLE_SUPPLIER' && (
              <Field label="选择耗材供应商">
                <Select
                  value={consumableSupplierId}
                  onValueChange={(v) => {
                    setConsumableSupplierId(v);
                    setSelectedReceiptIds([]);
                    setReceiptExpanded(false);
                  }}
                >
                  <SelectTrigger className="cursor-pointer"><SelectValue placeholder="选择耗材供应商" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">请选择</SelectItem>
                    {consumableSuppliers.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {receiverType === 'CUSTOM' && (
              <Field label="自定义收款方名称">
                <Input value={customReceiverName} onChange={(e) => setCustomReceiverName(e.target.value)} placeholder="临时合作收款方名称" />
              </Field>
            )}

            {/* 关联入库单：默认只一个按钮，点开右侧抽屉多选 */}
            {receiptKey && (
              <>
                <SectionTitle>关联入库单</SectionTitle>
                <div className="col-span-2 space-y-2 lg:col-span-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="cursor-pointer transition-colors duration-200"
                      onClick={openReceiptSheet}
                    >
                      <Link2 className="h-3.5 w-3.5" /> 选择关联入库单
                    </Button>
                    {selectedReceiptIds.length > 0 ? (
                      <button
                        type="button"
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors duration-200 hover:bg-[#2e2e2e]"
                        onClick={() => setReceiptExpanded((v) => !v)}
                      >
                        <span>已关联 {selectedReceiptIds.length} 张入库单</span>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 transition-transform duration-200',
                            receiptExpanded && 'rotate-180',
                          )}
                        />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">未关联入库单</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      已结清的入库单不会出现在候选中
                    </span>
                  </div>

                  {receiptExpanded && selectedReceiptList.length > 0 && (
                    <div className="max-h-28 overflow-y-auto rounded-lg border border-border">
                      {selectedReceiptList.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 border-b border-border px-3 py-1 text-xs transition-colors duration-200 last:border-b-0 hover:bg-[#2e2e2e]"
                        >
                          <span className="w-40 truncate font-medium">{r.receiptNo || '-'}</span>
                          <span className="w-40 shrink-0 text-muted-foreground">
                            {formatDateTime(r.receiptTime)}
                          </span>
                          <span className="w-36 shrink-0 truncate text-muted-foreground">
                            票据号 {r.billNo || '-'}
                          </span>
                          <span className="flex-1 truncate">货款 {receiptMoney(r.billAmount)}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            title="移除关联"
                            className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-destructive"
                            onClick={() => removeSelectedReceipt(r.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 开票与状态 */}
            <SectionTitle>开票与状态</SectionTitle>
            <Field label="发票状态">
              <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="记录状态">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.filter((s) => mode !== 'edit' || s.value !== 'CANCELLED').map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="col-span-2 space-y-1">
              <Label>备注</Label>
              <Textarea
                rows={2}
                className="min-h-9"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="备注说明（选填）"
              />
            </div>

            {/* 票据子记录 */}
            <SectionTitle>票据（一单多票）</SectionTitle>
            <div className="col-span-2 space-y-2 lg:col-span-4">
              {bills.length === 0 && (
                <div className="text-sm text-muted-foreground">暂无票据</div>
              )}
              {bills.map((b, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-lg border border-border p-2',
                    !!b.billFileId && !b.billNumber.trim() && 'border-destructive',
                  )}
                >
                  <Input
                    className="h-8 w-40"
                    placeholder="票据编号"
                    value={b.billNumber}
                    onChange={(e) =>
                      setBills((prev) => prev.map((x, i) => (i === idx ? { ...x, billNumber: e.target.value } : x)))
                    }
                  />
                  <Input
                    className="h-8 w-36"
                    type="date"
                    value={b.billDate || ''}
                    onChange={(e) =>
                      setBills((prev) => prev.map((x, i) => (i === idx ? { ...x, billDate: e.target.value } : x)))
                    }
                  />
                  <Input
                    className="h-8 w-28"
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer transition-colors duration-200"
                    onClick={() => document.getElementById(`bill-file-${idx}`)?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" /> 票据照片
                  </Button>
                  {b.billFileId && <span className="text-xs text-green-500">已上传</span>}
                  {!!b.billFileId && !b.billNumber.trim() && (
                    <span className="text-xs text-destructive">请补填票据号</span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-destructive"
                    onClick={() => removeBill(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="cursor-pointer transition-colors duration-200"
                onClick={addBill}
              >
                <Plus className="h-3.5 w-3.5" /> 添加票据
              </Button>
            </div>

            {/* 附件：打款截图 + 发票 */}
            <SectionTitle>附件</SectionTitle>
            <div className="col-span-2 space-y-2 lg:col-span-4">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer transition-colors duration-200"
                    onClick={() => document.getElementById(`att-file-${idx}`)?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" /> 上传
                  </Button>
                  {a.fileId && <span className="text-xs text-green-500">已上传</span>}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-destructive"
                    onClick={() => removeAttachment(idx)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() => addAttachment('SCREENSHOT')}
                >
                  <Plus className="h-3.5 w-3.5" /> 添加打款截图
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer transition-colors duration-200"
                  onClick={() => addAttachment('INVOICE')}
                >
                  <Plus className="h-3.5 w-3.5" /> 添加发票
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" className="cursor-pointer transition-colors duration-200" onClick={() => onOpenChange(false)}>取消</Button>
            <Button className="cursor-pointer transition-colors duration-200" onClick={handleSubmit} disabled={saving}>
              {saving ? '保存中...' : mode === 'create' ? '创建' : '保存'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 关联入库单：右侧抽屉（多选 + 关键词搜索，确定才回填） */}
      <Sheet open={receiptSheetOpen} onOpenChange={setReceiptSheetOpen}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          className="flex w-[640px] flex-col gap-0 p-0 sm:max-w-[640px]"
        >
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>选择关联入库单</SheetTitle>
            <span className="text-xs text-muted-foreground">
              已选 {receiptDraftIds.length} 张 · 已结清的入库单不会出现在候选中
            </span>
          </SheetHeader>

          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="按入库单号 / 票据号搜索"
                value={receiptKeyword}
                onChange={(e) => setReceiptKeyword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {receiptsLoading ? (
              <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 正在加载候选入库单...
              </div>
            ) : sheetReceiptList.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                该供应商没有待付款的入库单
              </div>
            ) : (
              sheetReceiptList.map((c) => {
                const checked = receiptDraftIds.includes(c.id);
                const isLinked = linkedReceipts.some((r) => r.id === c.id);
                return (
                  <div
                    key={c.id}
                    className="flex cursor-pointer items-start gap-3 border-b border-border px-4 py-2.5 transition-colors duration-200 last:border-b-0 hover:bg-[#2e2e2e]"
                    onClick={() => toggleDraftReceipt(c.id)}
                  >
                    <Checkbox
                      checked={checked}
                      className="mt-0.5 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                      onCheckedChange={() => toggleDraftReceipt(c.id)}
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="font-medium">{c.receiptNo}</span>
                        <span className="text-muted-foreground">{formatDateTime(c.receiptTime)}</span>
                        <span className="text-muted-foreground">票据号 {c.billNo || '-'}</span>
                        <span>货款 {receiptMoney(c.billAmount)}</span>
                        {isLinked && (
                          <span className="rounded border border-[#409fff]/40 px-1.5 text-xs text-[#409fff]">
                            已关联
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {RECEIPT_PAYMENT_LABEL[c.payment?.status || ''] || (c.payment ? '打款状态未知' : '历史关联')}
                        {c.payment?.paidAmount
                          ? ` · 已付 ${receiptMoney(c.payment.paidAmount)}`
                          : ''}
                        {c.payment?.linkedCount ? ` · 已被 ${c.payment.linkedCount} 条付款记录关联` : ''}
                      </div>
                      {c.itemSummary && (
                        <div className="truncate text-xs text-muted-foreground">{c.itemSummary}</div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t border-border p-4">
            <Button
              variant="outline"
              className="cursor-pointer transition-colors duration-200"
              onClick={() => setReceiptSheetOpen(false)}
            >
              取消
            </Button>
            <Button className="cursor-pointer transition-colors duration-200" onClick={confirmReceiptSheet}>
              确定
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

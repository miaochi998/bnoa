'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { PermissionGate } from '@/components/PermissionGate';
import { EditableCell } from '@/components/shared/EditableCell';
import { Plus, CheckCircle, Circle, Trash2, Pencil } from 'lucide-react';

interface ConsumablePriceDialogProps {
    consumableId: string;
    consumableName: string;
    onClose: () => void;
}

interface PriceRecord {
    id: string;
    unitPrice: number;
    effectDate: string;
    isCurrent: boolean;
    batchNote?: string;
    supplier?: { id: string; name: string; code: string };
    createdAt: string;
}

interface SupplierOption {
    id: string;
    name: string;
    code: string;
}

export function ConsumablePriceDialog({
    consumableId,
    consumableName,
    onClose,
}: ConsumablePriceDialogProps) {
    const [prices, setPrices] = useState<PriceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingPrice, setEditingPrice] = useState<PriceRecord | null>(null);
    const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
    const [formData, setFormData] = useState({
        supplierId: '',
        unitPrice: '',
        effectDate: new Date().toISOString().slice(0, 10),
        batchNote: '',
    });
    const [submitting, setSubmitting] = useState(false);

    const loadPrices = async () => {
        setLoading(true);
        try {
            const data = await apiClient.getConsumablePrices(
                consumableId,
            );
            setPrices(data || []);
        } catch (error) {
            console.error('加载价格失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSuppliers = async () => {
        try {
            const data = await apiClient
                .getConsumableSuppliersForSelect();
            setSuppliers(data || []);
        } catch (error) {
            console.error('加载供应商失败:', error);
        }
    };

    useEffect(() => {
        loadPrices();
        loadSuppliers();
    }, [consumableId]);

    const handleSetCurrent = async (priceId: string) => {
        if (!confirm('确定将此价格设为当前供货价格？')) return;
        try {
            await apiClient.setConsumablePriceCurrent(
                consumableId, priceId,
            );
            loadPrices();
        } catch (error: any) {
            alert('操作失败: ' + (error.message || '请稍后重试'));
        }
    };

    const handleDeletePrice = async (p: PriceRecord) => {
        const tip = p.isCurrent
            ? '此为当前价格，删除后将自动切换到最新的价格记录，确定删除？'
            : '确定删除此价格记录？';
        if (!confirm(tip)) return;
        try {
            await apiClient.deleteConsumablePrice(
                consumableId, p.id,
            );
            alert('删除成功');
            loadPrices();
        } catch (error: any) {
            alert('删除失败: ' + (error.message || '请稍后重试'));
        }
    };

    const handleSubmitPrice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.supplierId && !editingPrice) {
            alert('请选择供应商');
            return;
        }
        if (!formData.unitPrice || Number(formData.unitPrice) < 0) {
            alert('请输入有效的单价');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                supplierId: formData.supplierId || (editingPrice?.supplier?.id ?? ''),
                unitPrice: Number(formData.unitPrice),
                effectDate: formData.effectDate,
                batchNote: formData.batchNote || undefined,
            };
            if (editingPrice) {
                await apiClient.updateConsumablePrice(
                    consumableId, editingPrice.id, payload,
                );
                alert('价格已更新');
            } else {
                await apiClient.createConsumablePrice(consumableId, payload);
                alert('价格添加成功');
            }
            setShowForm(false);
            setEditingPrice(null);
            setFormData({
                supplierId: '',
                unitPrice: '',
                effectDate: new Date().toISOString().slice(0, 10),
                batchNote: '',
            });
            loadPrices();
        } catch (error: any) {
            alert((editingPrice ? '更新' : '添加') + '失败: ' + (error.message || '请稍后重试'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditPrice = (p: PriceRecord) => {
        setEditingPrice(p);
        setFormData({
            supplierId: p.supplier?.id || '',
            unitPrice: String(p.unitPrice),
            effectDate: p.effectDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            batchNote: p.batchNote || '',
        });
        setShowForm(true);
    };

    // 列表内直接编辑价格字段
    const handleUpdatePriceField = async (
        p: PriceRecord,
        field: 'unitPrice' | 'batchNote',
        newValue: string,
    ) => {
        try {
            await apiClient.updateConsumablePrice(
                consumableId, p.id,
                field === 'unitPrice'
                    ? { unitPrice: Number(newValue) }
                    : { batchNote: newValue || null },
            );
            // 更新本地列表
            setPrices((prev) => prev.map((item) =>
                item.id === p.id
                    ? {
                        ...item,
                        [field]: field === 'unitPrice'
                            ? Number(newValue)
                            : (newValue || undefined),
                    }
                    : item,
            ));
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-[#8e8e8e]">
                    耗材：{consumableName}
                </p>
                <Button
                    size="sm"
                    onClick={() => {
                        setEditingPrice(null);
                        setFormData({
                            supplierId: '',
                            unitPrice: '',
                            effectDate: new Date().toISOString().slice(0, 10),
                            batchNote: '',
                        });
                        setShowForm(!showForm);
                    }}
                    className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    新增报价
                </Button>
            </div>

            {showForm && (
                <form
                    onSubmit={handleSubmitPrice}
                    className="w-full p-4 rounded-lg bg-[#1e1e1e] space-y-3"
                >
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-white text-sm">
                                供应商 <span className="text-red-400">*</span>
                            </Label>
                            <Select
                                value={formData.supplierId}
                                onValueChange={(v) =>
                                    setFormData({ ...formData, supplierId: v })
                                }
                            >
                                <SelectTrigger
                                    className="w-full bg-[#262626] border-[#3e3e3e] text-white"
                                >
                                    <SelectValue placeholder="选择供应商" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name}（{s.code}）
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-white text-sm">
                                    单价 <span className="text-red-400">*</span>
                                </Label>
                                <Input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    placeholder="0.000"
                                    value={formData.unitPrice}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            unitPrice: e.target.value,
                                        })
                                    }
                                    className="bg-[#262626] border-[#3e3e3e] text-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-white text-sm">
                                    生效日期
                                </Label>
                                <Input
                                    type="date"
                                    value={formData.effectDate}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            effectDate: e.target.value,
                                        })
                                    }
                                    className="bg-[#262626] border-[#3e3e3e] text-white"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-white text-sm">
                                批次备注
                            </Label>
                            <Input
                                placeholder="可选"
                                value={formData.batchNote}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        batchNote: e.target.value,
                                    })
                                }
                                className="w-full bg-[#262626] border-[#3e3e3e] text-white"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowForm(false);
                                setEditingPrice(null);
                                setFormData({
                                    supplierId: '',
                                    unitPrice: '',
                                    effectDate: new Date().toISOString().slice(0, 10),
                                    batchNote: '',
                                });
                            }}
                            className="bg-[#262626] border-[#3e3e3e] text-white"
                        >
                            取消
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={submitting}
                            className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                        >
                            {submitting ? '提交中...' : editingPrice ? '保存修改' : '确认添加'}
                        </Button>
                    </div>
                </form>
            )}

            <div className="w-full overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="border-[#3e3e3e] hover:bg-transparent">
                        <TableHead className="text-[#8e8e8e]">状态</TableHead>
                        <TableHead className="text-[#8e8e8e]">供应商</TableHead>
                        <TableHead className="text-[#8e8e8e]">单价</TableHead>
                        <TableHead className="text-[#8e8e8e]">生效日期</TableHead>
                        <TableHead className="text-[#8e8e8e]">批次备注</TableHead>
                        <TableHead className="text-[#8e8e8e]">录入时间</TableHead>
                        <TableHead className="text-[#8e8e8e] text-right">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell
                                colSpan={7}
                                className="text-center text-[#8e8e8e] py-8"
                            >
                                加载中...
                            </TableCell>
                        </TableRow>
                    ) : prices.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={7}
                                className="text-center text-[#8e8e8e] py-8"
                            >
                                暂无价格记录
                            </TableCell>
                        </TableRow>
                    ) : (
                        [...prices]
                            .sort((a, b) => {
                                if (a.isCurrent && !b.isCurrent) return -1;
                                if (!a.isCurrent && b.isCurrent) return 1;
                                return 0;
                            })
                            .map((p) => (
                            <TableRow
                                key={p.id}
                                className="border-[#3e3e3e]"
                            >
                                <TableCell>
                                    {p.isCurrent ? (
                                        <CheckCircle className="w-4 h-4 text-[#22c55e]" />
                                    ) : (
                                        <button
                                            onClick={() => handleSetCurrent(p.id)}
                                            className="hover:text-[#409fff] transition-colors"
                                            title="设为当前价格"
                                        >
                                            <Circle className="w-4 h-4 text-[#8e8e8e]" />
                                        </button>
                                    )}
                                </TableCell>
                                <TableCell className="text-white">
                                    {p.supplier?.name || '-'}
                                </TableCell>
                                <TableCell className="text-white font-medium">
                                    <PermissionGate
                                        permission="consumable:update"
                                        fallback={<span>¥{Number(p.unitPrice).toFixed(3)}</span>}
                                    >
                                        <EditableCell
                                            value={p.unitPrice}
                                            onSave={(newValue) => handleUpdatePriceField(p, 'unitPrice', newValue)}
                                            placeholder="单价"
                                            type="number"
                                            label="单价"
                                        />
                                    </PermissionGate>
                                </TableCell>
                                <TableCell className="text-[#8e8e8e]">
                                    {p.effectDate?.slice(0, 10) || '-'}
                                </TableCell>
                                <TableCell className="text-[#8e8e8e]">
                                    <PermissionGate
                                        permission="consumable:update"
                                        fallback={<span>{p.batchNote || '-'}</span>}
                                    >
                                        <EditableCell
                                            value={p.batchNote}
                                            onSave={(newValue) => handleUpdatePriceField(p, 'batchNote', newValue)}
                                            placeholder="批次备注"
                                            maxLength={200}
                                        />
                                    </PermissionGate>
                                </TableCell>
                                <TableCell className="text-[#8e8e8e]">
                                    {new Date(p.createdAt)
                                        .toLocaleDateString('zh-CN')}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEditPrice(p)}
                                            className="h-7 w-7 text-[#8e8e8e] hover:text-[#409fff] hover:bg-[#409fff]/10"
                                            title="编辑"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeletePrice(p)}
                                            className="h-7 w-7 text-[#8e8e8e] hover:text-red-400 hover:bg-red-500/10"
                                            title="删除"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
            </div>

            <div className="flex justify-end pt-2">
                <Button
                    variant="outline"
                    onClick={onClose}
                    className="bg-[#1e1e1e] border-[#3e3e3e] text-white hover:bg-[#363636]"
                >
                    关闭
                </Button>
            </div>
        </div>
    );
}

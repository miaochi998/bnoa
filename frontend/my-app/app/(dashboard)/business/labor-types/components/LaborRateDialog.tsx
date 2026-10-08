'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { EditableCell } from '@/components/shared/EditableCell';
import { PermissionGate } from '@/components/PermissionGate';
import {
    Plus, CheckCircle, Circle, Trash2, Pencil,
} from 'lucide-react';

interface LaborRateDialogProps {
    laborTypeId: string;
    laborTypeName: string;
    onClose: () => void;
}

interface RateRecord {
    id: string;
    unitPrice: number;
    unit: string;
    effectDate: string;
    isCurrent: boolean;
    remark?: string;
    createdAt: string;
}

export function LaborRateDialog({
    laborTypeId,
    laborTypeName,
    onClose,
}: LaborRateDialogProps) {
    const [rates, setRates] = useState<RateRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingRate, setEditingRate] = useState<RateRecord | null>(null);
    const [formData, setFormData] = useState({
        unitPrice: '',
        unit: '',
        effectDate: new Date().toISOString().slice(0, 10),
        remark: '',
    });
    const [submitting, setSubmitting] = useState(false);

    const loadRates = async () => {
        setLoading(true);
        try {
            const data = await apiClient.getLaborRates(
                laborTypeId,
            );
            setRates(data || []);
        } catch (error) {
            console.error('加载工费标准失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadRates(); }, [laborTypeId]);

    const handleSetCurrent = async (rateId: string) => {
        if (!confirm('确定将此标准设为当前工费？')) return;
        try {
            await apiClient.setLaborRateCurrent(
                laborTypeId, rateId,
            );
            loadRates();
        } catch (error: any) {
            alert('操作失败: '
                + (error.message || '请稍后重试'));
        }
    };

    const handleDeleteRate = async (r: RateRecord) => {
        const tip = r.isCurrent
            ? '此为当前工费，删除后将自动切换，确定？'
            : '确定删除此工费标准？';
        if (!confirm(tip)) return;
        try {
            await apiClient.deleteLaborRate(
                laborTypeId, r.id,
            );
            alert('删除成功');
            loadRates();
        } catch (error: any) {
            alert('删除失败: '
                + (error.message || '请稍后重试'));
        }
    };

    const handleSubmitRate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.unitPrice
            || Number(formData.unitPrice) < 0) {
            alert('请输入有效的单价');
            return;
        }
        if (!formData.unit.trim()) {
            alert('请输入计费单位');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                unitPrice: Number(formData.unitPrice),
                unit: formData.unit,
                effectDate: formData.effectDate,
                remark: formData.remark || undefined,
            };
            if (editingRate) {
                await apiClient.updateLaborRate(
                    laborTypeId, editingRate.id, payload,
                );
                alert('工费标准已更新');
            } else {
                await apiClient.createLaborRate(laborTypeId, payload);
                alert('工费标准添加成功');
            }
            setShowForm(false);
            setEditingRate(null);
            setFormData({
                unitPrice: '',
                unit: '',
                effectDate: new Date()
                    .toISOString().slice(0, 10),
                remark: '',
            });
            loadRates();
        } catch (error: any) {
            alert((editingRate ? '更新' : '添加') + '失败: '
                + (error.message || '请稍后重试'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditRate = (r: RateRecord) => {
        setEditingRate(r);
        setFormData({
            unitPrice: String(r.unitPrice),
            unit: r.unit || '',
            effectDate: r.effectDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            remark: r.remark || '',
        });
        setShowForm(true);
    };

    // 列表内联编辑：单价 / 单位 / 备注
    const handleUpdateRateField = async (
        rateId: string,
        field: 'unitPrice' | 'unit' | 'remark',
        newValue: string,
    ) => {
        try {
            const payload: Record<string, any> = {};
            if (field === 'unitPrice') {
                payload.unitPrice = Number(newValue);
            } else if (field === 'unit') {
                payload.unit = newValue;
            } else {
                payload.remark = newValue || null;
            }
            await apiClient.updateLaborRate(
                laborTypeId, rateId, payload,
            );
            loadRates();
        } catch (error: any) {
            alert('更新失败: '
                + (error.message || '请稍后重试'));
            throw error;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-[#8e8e8e]">
                    工种：{laborTypeName}
                </p>
                <Button
                    size="sm"
                    onClick={() => {
                        setEditingRate(null);
                        setFormData({
                            unitPrice: '',
                            unit: '',
                            effectDate: new Date().toISOString().slice(0, 10),
                            remark: '',
                        });
                        setShowForm(!showForm);
                    }}
                    className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                >
                    <Plus className="w-4 h-4 mr-1" />
                    新增标准
                </Button>
            </div>

            {showForm && (
                <form
                    onSubmit={handleSubmitRate}
                    className="w-full p-4 rounded-lg bg-[#1e1e1e] space-y-3"
                >
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
                                计费单位 <span className="text-red-400">*</span>
                            </Label>
                            <Input
                                placeholder="件/kg/包/箱"
                                value={formData.unit}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        unit: e.target.value,
                                    })
                                }
                                className="bg-[#262626] border-[#3e3e3e] text-white"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
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
                        <div className="space-y-1">
                            <Label className="text-white text-sm">
                                备注
                            </Label>
                            <Input
                                placeholder="可选"
                                value={formData.remark}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        remark: e.target.value,
                                    })
                                }
                                className="bg-[#262626] border-[#3e3e3e] text-white"
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
                                setEditingRate(null);
                                setFormData({
                                    unitPrice: '',
                                    unit: '',
                                    effectDate: new Date().toISOString().slice(0, 10),
                                    remark: '',
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
                            {submitting ? '提交中...' : editingRate ? '保存修改' : '确认添加'}
                        </Button>
                    </div>
                </form>
            )}

            <div className="w-full overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="border-[#3e3e3e] hover:bg-transparent">
                        <TableHead className="text-[#8e8e8e]">状态</TableHead>
                        <TableHead className="text-[#8e8e8e]">单价</TableHead>
                        <TableHead className="text-[#8e8e8e]">单位</TableHead>
                        <TableHead className="text-[#8e8e8e]">生效日期</TableHead>
                        <TableHead className="text-[#8e8e8e]">备注</TableHead>
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
                    ) : rates.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={7}
                                className="text-center text-[#8e8e8e] py-8"
                            >
                                暂无工费标准
                            </TableCell>
                        </TableRow>
                    ) : (
                        [...rates]
                            .sort((a, b) => {
                                if (a.isCurrent && !b.isCurrent) return -1;
                                if (!a.isCurrent && b.isCurrent) return 1;
                                return 0;
                            })
                            .map((r) => (
                            <TableRow
                                key={r.id}
                                className="border-[#3e3e3e]"
                            >
                                <TableCell>
                                    {r.isCurrent ? (
                                        <CheckCircle className="w-4 h-4 text-[#22c55e]" />
                                    ) : (
                                        <button
                                            onClick={() => handleSetCurrent(r.id)}
                                            className="hover:text-[#409fff] transition-colors"
                                            title="设为当前标准"
                                        >
                                            <Circle className="w-4 h-4 text-[#8e8e8e]" />
                                        </button>
                                    )}
                                </TableCell>
                                <TableCell className="text-white font-medium">
                                    <PermissionGate
                                        permission="labor:update"
                                        fallback={<span>¥{Number(r.unitPrice).toFixed(3)}</span>}
                                    >
                                        <EditableCell
                                            value={Number(r.unitPrice).toFixed(3)}
                                            onSave={(newValue) => handleUpdateRateField(r.id, 'unitPrice', newValue)}
                                            placeholder="单价"
                                            type="number"
                                            label="单价"
                                        />
                                    </PermissionGate>
                                </TableCell>
                                <TableCell className="text-white">
                                    <PermissionGate
                                        permission="labor:update"
                                        fallback={<span>/{r.unit}</span>}
                                    >
                                        <EditableCell
                                            value={r.unit}
                                            onSave={(newValue) => handleUpdateRateField(r.id, 'unit', newValue)}
                                            placeholder="单位"
                                            maxLength={20}
                                        />
                                    </PermissionGate>
                                </TableCell>
                                <TableCell className="text-[#8e8e8e]">
                                    {r.effectDate?.slice(0, 10) || '-'}
                                </TableCell>
                                <TableCell className="text-[#8e8e8e]">
                                    <PermissionGate
                                        permission="labor:update"
                                        fallback={<span>{r.remark || '-'}</span>}
                                    >
                                        <EditableCell
                                            value={r.remark}
                                            onSave={(newValue) => handleUpdateRateField(r.id, 'remark', newValue)}
                                            placeholder="备注"
                                            maxLength={200}
                                        />
                                    </PermissionGate>
                                </TableCell>
                                <TableCell className="text-[#8e8e8e]">
                                    {new Date(r.createdAt)
                                        .toLocaleDateString('zh-CN')}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleEditRate(r)}
                                            className="h-7 w-7 text-[#8e8e8e] hover:text-[#409fff] hover:bg-[#409fff]/10"
                                            title="编辑"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteRate(r)}
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

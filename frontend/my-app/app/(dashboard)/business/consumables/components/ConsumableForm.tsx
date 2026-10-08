'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DictSelect } from '@/components/shared/DictSelect';
import { apiClient } from '@/lib/api';

interface Consumable {
    id: string;
    code: string;
    name: string;
    category: string;
    specDesc?: string;
    status: string;
    remark?: string;
}

interface ConsumableFormProps {
    consumable: Consumable | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export function ConsumableForm({
    consumable,
    onSuccess,
    onCancel,
}: ConsumableFormProps) {
    const [formData, setFormData] = useState({
        name: consumable?.name || '',
        category: consumable?.category || '',
        specDesc: consumable?.specDesc || '',
        status: consumable?.status || 'ACTIVE',
        remark: consumable?.remark || '',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('请输入耗材名称');
            return;
        }
        if (!formData.category) {
            alert('请选择耗材分类');
            return;
        }

        setLoading(true);
        try {
            if (consumable) {
                await apiClient.updateConsumable(
                    consumable.id, formData,
                );
                alert('更新成功');
            } else {
                const { status, ...createData } = formData;
                await apiClient.createConsumable(createData);
                alert('创建成功');
            }
            onSuccess();
        } catch (error: any) {
            alert(
                (consumable ? '更新失败: ' : '创建失败: ')
                + (error.message || '请稍后重试'),
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {consumable && (
                <div className="space-y-2">
                    <Label className="text-white">耗材编码</Label>
                    <Input
                        value={consumable.code}
                        disabled
                        className="bg-[#1e1e1e] border-[#1e1e1e] text-[#8e8e8e]"
                    />
                    <p className="text-xs text-[#8e8e8e]">
                        耗材编码创建后不可修改
                    </p>
                </div>
            )}

            <div className="space-y-2">
                <Label className="text-white">
                    耗材名称 <span className="text-red-400">*</span>
                </Label>
                <Input
                    placeholder="请输入耗材名称"
                    value={formData.name}
                    onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                    }
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                />
            </div>

            <div className="space-y-2">
                <Label className="text-white">
                    耗材分类 <span className="text-red-400">*</span>
                </Label>
                <DictSelect
                    typeCode="consumable_category"
                    value={formData.category}
                    onChange={(v) =>
                        setFormData({ ...formData, category: v })
                    }
                    placeholder="请选择分类"
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                />
            </div>

            <div className="space-y-2">
                <Label className="text-white">规格描述</Label>
                <Input
                    placeholder="请输入规格描述"
                    value={formData.specDesc}
                    onChange={(e) =>
                        setFormData({ ...formData, specDesc: e.target.value })
                    }
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                />
            </div>

            {consumable && (
                <div className="space-y-2">
                    <Label className="text-white">状态</Label>
                    <DictSelect
                        typeCode="consumable_status"
                        value={formData.status}
                        onChange={(v) =>
                            setFormData({ ...formData, status: v })
                        }
                        placeholder="选择状态"
                        className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                    />
                </div>
            )}

            <div className="space-y-2">
                <Label className="text-white">备注</Label>
                <Input
                    placeholder="请输入备注"
                    value={formData.remark}
                    onChange={(e) =>
                        setFormData({ ...formData, remark: e.target.value })
                    }
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                />
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white hover:bg-[#363636]"
                >
                    取消
                </Button>
                <Button
                    type="submit"
                    disabled={loading}
                    className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                >
                    {loading
                        ? '保存中...'
                        : consumable ? '保存' : '创建'}
                </Button>
            </div>
        </form>
    );
}

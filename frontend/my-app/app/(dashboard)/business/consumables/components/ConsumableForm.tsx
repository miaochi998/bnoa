'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DictSelect } from '@/components/shared/DictSelect';
import { apiClient } from '@/lib/api';
import { useFieldPermissions } from '@/lib/hooks/useFieldPermissions';

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
    const fp = useFieldPermissions('consumable');
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
        if (!consumable && (!fp.canEdit('name') || !fp.canEdit('category'))) {
            alert('没有创建耗材所需的字段编辑权限（名称/分类）');
            return;
        }
        if (fp.canEdit('name') && !formData.name.trim()) {
            alert('请输入耗材名称');
            return;
        }
        if (fp.canEdit('category') && !formData.category) {
            alert('请选择耗材分类');
            return;
        }

        // 只提交「可编辑」字段
        const payload: Record<string, any> = {};
        if (fp.canEdit('name')) payload.name = formData.name;
        if (fp.canEdit('category')) payload.category = formData.category;
        if (fp.canEdit('specDesc')) payload.specDesc = formData.specDesc;
        if (fp.canEdit('remark')) payload.remark = formData.remark;
        if (consumable && fp.canEdit('status')) payload.status = formData.status;

        if (Object.keys(payload).length === 0) {
            alert('你没有耗材字段的编辑权限');
            return;
        }

        setLoading(true);
        try {
            if (consumable) {
                await apiClient.updateConsumable(
                    consumable.id, payload,
                );
                alert('更新成功');
            } else {
                await apiClient.createConsumable(payload);
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
            {consumable && fp.canView('code') && (
                <div className="space-y-2">
                    <Label className="text-white">耗材编码</Label>
                    <Input
                        value={consumable.code ?? ''}
                        disabled
                        className="bg-[#1e1e1e] border-[#1e1e1e] text-[#8e8e8e]"
                    />
                    <p className="text-xs text-[#8e8e8e]">
                        耗材编码创建后不可修改
                    </p>
                </div>
            )}

            {fp.canView('name') && (
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
                    disabled={!fp.canEdit('name')}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e] disabled:opacity-50"
                />
            </div>
            )}

            {fp.canView('category') && (
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
                    disabled={!fp.canEdit('category')}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                />
            </div>
            )}

            {fp.canView('specDesc') && (
            <div className="space-y-2">
                <Label className="text-white">规格描述</Label>
                <Input
                    placeholder="请输入规格描述"
                    value={formData.specDesc}
                    onChange={(e) =>
                        setFormData({ ...formData, specDesc: e.target.value })
                    }
                    disabled={!fp.canEdit('specDesc')}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e] disabled:opacity-50"
                />
            </div>
            )}

            {consumable && fp.canView('status') && (
                <div className="space-y-2">
                    <Label className="text-white">状态</Label>
                    <DictSelect
                        typeCode="consumable_status"
                        value={formData.status}
                        onChange={(v) =>
                            setFormData({ ...formData, status: v })
                        }
                        placeholder="选择状态"
                        disabled={!fp.canEdit('status')}
                        className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                    />
                </div>
            )}

            {fp.canView('remark') && (
            <div className="space-y-2">
                <Label className="text-white">备注</Label>
                <Input
                    placeholder="请输入备注"
                    value={formData.remark}
                    onChange={(e) =>
                        setFormData({ ...formData, remark: e.target.value })
                    }
                    disabled={!fp.canEdit('remark')}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e] disabled:opacity-50"
                />
            </div>
            )}

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

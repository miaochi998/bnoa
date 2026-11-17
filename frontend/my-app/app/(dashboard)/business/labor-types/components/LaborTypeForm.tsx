'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DictSelect } from '@/components/shared/DictSelect';
import { SimpleImageUploader } from '@/components/upload/SimpleImageUploader';
import { ImageThumb } from '@/components/business/ImageThumb';
import { apiClient } from '@/lib/api';
import { useFieldPermissions } from '@/lib/hooks/useFieldPermissions';

interface LaborTypeFormProps {
    laborType?: any;
    onSuccess: () => void;
    onCancel: () => void;
}

export function LaborTypeForm({
    laborType,
    onSuccess,
    onCancel,
}: LaborTypeFormProps) {
    const fp = useFieldPermissions('labor');
    const [formData, setFormData] = useState({
        name: '',
        image: null as string | null,
        billingType: '',
        status: 'ENABLED',
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (laborType) {
            const billingType = laborType.billingType;
            setFormData({
                name: laborType.name || '',
                image: laborType.image || null,
                billingType: billingType === null || billingType === undefined ? '' : String(billingType),
                status: laborType.status || 'ENABLED',
            });
        } else {
            setFormData({
                name: '',
                image: null,
                billingType: '',
                status: 'ENABLED',
            });
        }
    }, [laborType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!laborType && (!fp.canEdit('name') || !fp.canEdit('billingType'))) {
            alert('没有创建工种所需的字段编辑权限（名称/计费方式）');
            return;
        }
        if (fp.canEdit('name') && !formData.name.trim()) {
            alert('请输入工种名称');
            return;
        }
        if (fp.canEdit('billingType') && !formData.billingType) {
            alert('请选择计费方式');
            return;
        }

        // 只提交「可编辑」字段
        const payload: Record<string, any> = {};
        if (fp.canEdit('name')) payload.name = formData.name;
        if (fp.canEdit('image')) payload.image = formData.image || null;
        if (fp.canEdit('billingType')) payload.billingType = formData.billingType;
        if (laborType && fp.canEdit('status')) payload.status = formData.status;

        if (Object.keys(payload).length === 0) {
            alert('你没有工费字段的编辑权限');
            return;
        }

        setSubmitting(true);
        try {
            if (laborType) {
                await apiClient.updateLaborType(
                    laborType.id,
                    payload,
                );
                alert('更新成功');
            } else {
                await apiClient.createLaborType(payload);
                alert('创建成功');
            }
            onSuccess();
        } catch (error: any) {
            alert(
                (laborType ? '更新' : '创建')
                + '失败: '
                + (error.message || '请稍后重试'),
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {fp.canView('name') && (
            <div className="space-y-2">
                <Label className="text-white">
                    工种名称 <span className="text-red-400">*</span>
                </Label>
                <Input
                    placeholder="如：包装工、贴标工"
                    value={formData.name}
                    onChange={(e) =>
                        setFormData({
                            ...formData,
                            name: e.target.value,
                        })
                    }
                    disabled={!fp.canEdit('name')}
                    className="bg-[#1e1e1e] border-[#3e3e3e] text-white disabled:opacity-50"
                />
            </div>
            )}

            {fp.canView('image') && (
            <div className="space-y-2">
                <Label className="text-white">工费图片</Label>
                {fp.canEdit('image') ? (
                    <SimpleImageUploader
                        value={formData.image || undefined}
                        onChange={(fileId) =>
                            setFormData({
                                ...formData,
                                image: fileId || null,
                            })
                        }
                        returnFileId={true}
                        placeholder="点击或拖拽上传图片"
                        className="w-32 h-32"
                    />
                ) : formData.image ? (
                    <ImageThumb
                        fileId={formData.image}
                        alt={formData.name}
                        size={128}
                    />
                ) : (
                    <div className="w-32 h-32 rounded-lg bg-[#1e1e1e] border border-[#3e3e3e] flex items-center justify-center text-xs text-[#8e8e8e]">
                        无图片
                    </div>
                )}
                <p className="text-xs text-[#8e8e8e]">
                    用于快速识别该工费对应的工序/产品样式
                </p>
            </div>
            )}

            {fp.canView('billingType') && (
            <div className="space-y-2">
                <Label className="text-white">
                    计费方式 <span className="text-red-400">*</span>
                </Label>
                <DictSelect
                    typeCode="labor_billing_type"
                    value={formData.billingType}
                    onChange={(v) =>
                        setFormData({
                            ...formData,
                            billingType: v,
                        })
                    }
                    disabled={!fp.canEdit('billingType')}
                    className="bg-[#1e1e1e] border-[#3e3e3e] text-white"
                />
            </div>
            )}

            {laborType && fp.canView('status') && (
                <div className="space-y-2">
                    <Label className="text-white">状态</Label>
                    <DictSelect
                        typeCode="consumable_status"
                        value={formData.status}
                        onChange={(v) =>
                            setFormData({
                                ...formData,
                                status: v,
                            })
                        }
                        disabled={!fp.canEdit('status')}
                        className="bg-[#1e1e1e] border-[#3e3e3e] text-white"
                    />
                </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    className="bg-[#1e1e1e] border-[#3e3e3e] text-white hover:bg-[#363636]"
                >
                    取消
                </Button>
                <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                >
                    {submitting
                        ? '提交中...'
                        : laborType
                            ? '保存'
                            : '创建'}
                </Button>
            </div>
        </form>
    );
}

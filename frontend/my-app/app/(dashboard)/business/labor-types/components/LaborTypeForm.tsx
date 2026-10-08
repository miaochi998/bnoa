'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DictSelect } from '@/components/shared/DictSelect';
import { apiClient } from '@/lib/api';

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
    const [formData, setFormData] = useState({
        name: '',
        billingType: '',
        status: 'ENABLED',
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (laborType) {
            const billingType = laborType.billingType;
            setFormData({
                name: laborType.name || '',
                billingType: billingType === null || billingType === undefined ? '' : String(billingType),
                status: laborType.status || 'ENABLED',
            });
        } else {
            setFormData({
                name: '',
                billingType: '',
                status: 'ENABLED',
            });
        }
    }, [laborType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('请输入工种名称');
            return;
        }
        if (!formData.billingType) {
            alert('请选择计费方式');
            return;
        }

        setSubmitting(true);
        try {
            if (laborType) {
                await apiClient.updateLaborType(
                    laborType.id,
                    formData,
                );
                alert('更新成功');
            } else {
                await apiClient.createLaborType({
                    name: formData.name,
                    billingType: formData.billingType,
                });
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
                    className="bg-[#1e1e1e] border-[#3e3e3e] text-white"
                />
            </div>

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
                    className="bg-[#1e1e1e] border-[#3e3e3e] text-white"
                />
            </div>

            {laborType && (
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

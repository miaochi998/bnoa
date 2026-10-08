'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ExpressCompany {
    id: string;
    name: string;
    code: string;
    contactName: string | null;
    contactPhone: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    remark: string | null;
}

interface ExpressCompanyFormProps {
    company?: ExpressCompany;
    onSuccess: () => void;
    onCancel: () => void;
}

export function ExpressCompanyForm({ company, onSuccess, onCancel }: ExpressCompanyFormProps) {
    const [formData, setFormData] = useState({
        name: company?.name || '',
        code: company?.code || '',
        contactName: company?.contactName || '',
        contactPhone: company?.contactPhone || '',
        status: company?.status || 'ACTIVE',
        remark: company?.remark || '',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('请输入快递公司名称');
            return;
        }

        if (!formData.code.trim()) {
            alert('请输入快递公司编码');
            return;
        }

        setLoading(true);
        try {
            if (company) {
                // 更新
                await apiClient.updateExpressCompany(company.id, {
                    name: formData.name,
                    code: formData.code,
                    contactName: formData.contactName || undefined,
                    contactPhone: formData.contactPhone || undefined,
                    status: formData.status,
                    remark: formData.remark || undefined,
                });
                alert('更新成功');
            } else {
                // 创建
                await apiClient.createExpressCompany({
                    name: formData.name,
                    code: formData.code,
                    contactName: formData.contactName || undefined,
                    contactPhone: formData.contactPhone || undefined,
                    status: formData.status,
                    remark: formData.remark || undefined,
                });
                alert('创建成功');
            }
            onSuccess();
        } catch (error: any) {
            alert((company ? '更新失败: ' : '创建失败: ') + (error.message || '请稍后重试'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="name">
                    快递公司名称 <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="请输入快递公司名称"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="code">
                    快递公司编码 {company ? null : <span className="text-red-500">*</span>}
                </Label>
                <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="请输入快递公司编码，如：SF、YT等"
                />
                <p className="text-xs text-muted-foreground">建议使用快递公司拼音首字母或常用缩写</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="contactName">联系人</Label>
                    <Input
                        id="contactName"
                        value={formData.contactName}
                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                        placeholder="请输入联系人"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="contactPhone">联系电话</Label>
                    <Input
                        id="contactPhone"
                        value={formData.contactPhone}
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                        placeholder="请输入联系电话"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="status">状态</Label>
                <Select
                    value={formData.status}
                    onValueChange={(value: 'ACTIVE' | 'INACTIVE') => setFormData({ ...formData, status: value })}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ACTIVE">合作中</SelectItem>
                        <SelectItem value="INACTIVE">已终止</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="remark">备注</Label>
                <Textarea
                    id="remark"
                    value={formData.remark}
                    onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                    placeholder="请输入备注信息"
                    rows={3}
                />
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                    取消
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? '保存中...' : company ? '保存' : '创建'}
                </Button>
            </div>
        </form>
    );
}

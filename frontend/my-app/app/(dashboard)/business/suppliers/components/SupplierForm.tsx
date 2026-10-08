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
import { apiClient } from '@/lib/api';

interface Supplier {
    id: string;
    code: string;
    name: string;
    contact?: string;
    phone?: string;
    address?: string;
    status: 'ACTIVE' | 'INACTIVE';
    remark?: string;
}

interface SupplierFormProps {
    supplier: Supplier | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
    const [formData, setFormData] = useState({
        name: supplier?.name || '',
        contact: supplier?.contact || '',
        phone: supplier?.phone || '',
        address: supplier?.address || '',
        status: supplier?.status || 'ACTIVE',
        remark: supplier?.remark || '',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 验证必填字段
        if (!formData.name.trim()) {
            alert('请输入供应商名称');
            return;
        }

        setLoading(true);
        try {
            if (supplier) {
                // 更新
                await apiClient.updateSupplier(supplier.id, formData);
                alert('更新成功');
            } else {
                // 创建
                await apiClient.createSupplier(formData);
                alert('创建成功');
            }
            onSuccess();
        } catch (error: any) {
            alert((supplier ? '更新失败: ' : '创建失败: ') + (error.message || '请稍后重试'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* 供应商编码（仅编辑时显示） */}
            {supplier && (
                <div className="space-y-2">
                    <Label className="text-white">供应商编码</Label>
                    <Input
                        value={supplier.code}
                        disabled
                        className="bg-[#1e1e1e] border-[#1e1e1e] text-[#8e8e8e]"
                    />
                    <p className="text-xs text-[#8e8e8e]">供应商编码创建后不可修改</p>
                </div>
            )}

            {/* 供应商名称 */}
            <div className="space-y-2">
                <Label className="text-white">
                    供应商名称 <span className="text-red-400">*</span>
                </Label>
                <Input
                    placeholder="请输入供应商名称"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                />
            </div>

            {/* 联系人 */}
            <div className="space-y-2">
                <Label className="text-white">联系人</Label>
                <Input
                    placeholder="请输入联系人姓名"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                />
            </div>

            {/* 联系电话 */}
            <div className="space-y-2">
                <Label className="text-white">联系电话</Label>
                <Input
                    placeholder="请输入联系电话"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                />
            </div>

            {/* 联系地址 */}
            <div className="space-y-2">
                <Label className="text-white">联系地址</Label>
                <Input
                    placeholder="请输入联系地址"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                />
            </div>

            {/* 状态 */}
            <div className="space-y-2">
                <Label className="text-white">状态</Label>
                <Select
                    value={formData.status}
                    onValueChange={(value: 'ACTIVE' | 'INACTIVE') => setFormData({ ...formData, status: value })}
                >
                    <SelectTrigger className="bg-[#1e1e1e] border-[#1e1e1e] text-white">
                        <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                        <SelectItem value="ACTIVE" className="text-white">合作中</SelectItem>
                        <SelectItem value="INACTIVE" className="text-white">已终止</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* 备注 */}
            <div className="space-y-2">
                <Label className="text-white">备注</Label>
                <Input
                    placeholder="请输入备注"
                    value={formData.remark}
                    onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                />
            </div>

            {/* 按钮 */}
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
                    {loading ? '保存中...' : supplier ? '保存' : '创建'}
                </Button>
            </div>
        </form>
    );
}

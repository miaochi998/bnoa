'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient, getFilePreviewUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SimpleImageUploader } from '@/components/upload/SimpleImageUploader';
import { DictSelect } from '@/components/shared/DictSelect';
import { Package, Upload, X } from 'lucide-react';
import { useFieldPermissions } from '@/lib/hooks/useFieldPermissions';

interface Product {
    id: string;
    name: string;
    code: string;
    brand: string | null;
    pricingMode: string;
    status: 'ON_SALE' | 'DISCONTINUED' | 'DEVELOPING';
    mainImage: string | null;
    remark: string | null;
}

interface ProductFormProps {
    product?: Product | null;
    onSuccess: () => void;
    onCancel: () => void;
}

export function ProductForm({ product, onSuccess, onCancel }: ProductFormProps) {
    const fp = useFieldPermissions('product');
    const [formData, setFormData] = useState({
        name: product?.name || '',
        code: product?.code || '',
        brand: product?.brand || '',
        pricingMode: product?.pricingMode || 'UNIT',
        status: product?.status || 'DEVELOPING',
        remark: product?.remark || '',
        mainImage: product?.mainImage || null as string | null,
    });
    const [loading, setLoading] = useState(false);

    // 产品图片配置
    const [imageConfig, setImageConfig] = useState<{
        maxWidth: number;
        maxHeight: number;
        maxSize: number;
        formats: string[];
        realFolderId: string | null;
    } | null>(null);

    // 获取图片配置
    useEffect(() => {
        const fetchImageConfig = async () => {
            try {
                const config = await apiClient.getProductImageConfig();
                setImageConfig(config);
            } catch (error) {
                console.error('获取产品图片配置失败:', error);
            }
        };
        fetchImageConfig();
    }, []);

    // 新增产品时自动获取并填充下一个产品编码，用户可修改
    useEffect(() => {
        if (!product) {
            apiClient.getNextProductCode().then((res) => {
                setFormData((prev) => ({ ...prev, code: res.code || '' }));
            }).catch(() => {});
        }
    }, [product]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 新增产品必须有「产品名称」的编辑权限
        if (!product && !fp.canEdit('name')) {
            alert('你没有「产品名称」的编辑权限，无法创建产品');
            return;
        }
        if (fp.canEdit('name') && !formData.name.trim()) {
            alert('请输入产品名称');
            return;
        }

        // 只提交「可编辑」的字段：被配成只读/隐藏的字段不发送，避免误改或 400
        const payload: Record<string, any> = {};
        if (fp.canEdit('name')) payload.name = formData.name;
        if (fp.canEdit('brand')) payload.brand = formData.brand || undefined;
        if (fp.canEdit('pricingMode')) payload.pricingMode = formData.pricingMode;
        if (fp.canEdit('status')) payload.status = formData.status;
        if (fp.canEdit('remark')) payload.remark = formData.remark || undefined;
        if (fp.canEdit('mainImage')) payload.mainImage = formData.mainImage || undefined;

        if (Object.keys(payload).length === 0) {
            alert('你没有产品字段的编辑权限');
            return;
        }

        setLoading(true);
        try {
            if (product) {
                // 更新
                await apiClient.updateProduct(product.id, payload as any);
                alert('更新成功');
            } else {
                // 创建（编码留空时后端自动生成）
                if (fp.canEdit('code')) {
                    payload.code = formData.code?.trim() || undefined;
                }
                await apiClient.createProduct(payload as any);
                alert('创建成功');
            }
            onSuccess();
        } catch (error: any) {
            alert((product ? '更新失败: ' : '创建失败: ') + (error.message || '请稍后重试'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* 产品图片上传 */}
            {fp.canView('mainImage') && (
            <div className="space-y-2">
                <Label>产品图片</Label>
                {fp.canEdit('mainImage') ? (
                    <SimpleImageUploader
                        value={formData.mainImage || undefined}
                        onChange={(fileId) => setFormData({ ...formData, mainImage: fileId })}
                        realFolderId={imageConfig?.realFolderId || undefined}
                        storageMode="rustfs"
                        accept={imageConfig?.formats?.map(f => `image/${f}`).join(',') || 'image/jpeg,image/png,image/gif'}
                        maxSize={imageConfig?.maxSize || 5}
                        className="w-32 h-32"
                        returnFileId={true}
                    />
                ) : formData.mainImage ? (
                    <div className="w-32 h-32 rounded bg-[#1e1e1e] overflow-hidden flex items-center justify-center">
                        <img
                            src={getFilePreviewUrl(formData.mainImage)}
                            alt="产品图片"
                            className="w-full h-full object-cover"
                        />
                    </div>
                ) : (
                    <div className="w-32 h-32 rounded bg-[#1e1e1e] flex items-center justify-center text-xs text-[#8e8e8e]">
                        无图片
                    </div>
                )}
            </div>
            )}

            {fp.canView('name') && (
            <div className="space-y-2">
                <Label htmlFor="name">
                    产品名称 <span className="text-red-500">*</span>
                </Label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="请输入产品名称"
                    disabled={!fp.canEdit('name')}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white disabled:opacity-50"
                />
            </div>
            )}

            {fp.canView('code') && (
            <div className="space-y-2">
                <Label htmlFor="code">
                    产品编码 {!product && <span className="text-red-500">*</span>}
                </Label>
                <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="留空则自动生成，也可手动输入"
                    disabled={!!product || !fp.canEdit('code')}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white disabled:opacity-50"
                />
                {!product && (
                    <p className="text-xs text-[#8e8e8e]">默认自动生成编码，如需自定义可直接修改</p>
                )}
                {product && (
                    <p className="text-xs text-[#8e8e8e]">产品编码创建后不可修改</p>
                )}
            </div>
            )}

            {fp.canView('pricingMode') && (
            <div className="space-y-2">
                <Label htmlFor="pricingMode">计价方式</Label>
                <DictSelect
                    typeCode="pricing_mode"
                    value={formData.pricingMode}
                    onChange={(value) =>
                        setFormData({ ...formData, pricingMode: value })
                    }
                    placeholder="选择计价方式"
                    disabled={!fp.canEdit('pricingMode')}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                />
            </div>
            )}

            {fp.canView('brand') && (
            <div className="space-y-2">
                <Label htmlFor="brand">品牌</Label>
                <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="请输入品牌名称"
                    disabled={!fp.canEdit('brand')}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white disabled:opacity-50"
                />
            </div>
            )}

            {fp.canView('status') && (
            <div className="space-y-2">
                <Label htmlFor="status">状态</Label>
                <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                    disabled={!fp.canEdit('status')}
                >
                    <SelectTrigger className="bg-[#1e1e1e] border-[#1e1e1e] text-white">
                        <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                        <SelectItem value="ON_SALE" className="text-white">在售</SelectItem>
                        <SelectItem value="DISCONTINUED" className="text-white">停售</SelectItem>
                        <SelectItem value="DEVELOPING" className="text-white">开发中</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            )}

            {fp.canView('remark') && (
            <div className="space-y-2">
                <Label htmlFor="remark">备注</Label>
                <Textarea
                    id="remark"
                    value={formData.remark}
                    onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                    placeholder="请输入备注信息"
                    rows={3}
                    disabled={!fp.canEdit('remark')}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white resize-none disabled:opacity-50"
                />
            </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                >
                    取消
                </Button>
                <Button
                    type="submit"
                    disabled={loading}
                    className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                >
                    {loading ? '保存中...' : (product ? '保存' : '创建')}
                </Button>
            </div>
        </form>
    );
}

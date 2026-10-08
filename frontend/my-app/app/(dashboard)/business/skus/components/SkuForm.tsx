'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
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
import { Plus, Trash2 } from 'lucide-react';

interface LinkOption {
    id: string;
    name: string;
    shop?: {
        name: string;
        platform?: { name: string };
    };
}

interface FpOption {
    id: string;
    code: string;
    name: string;
    weight: number;
    totalCost: number;
}

interface ExpressOption {
    id: string;
    name: string;
    code: string;
}

interface FpItem {
    finishedProductId: string;
    quantity: number;
}

interface SkuFormProps {
    sku?: any;
    onSuccess: () => void;
    onCancel: () => void;
}

export function SkuForm({
    sku,
    onSuccess,
    onCancel,
}: SkuFormProps) {
    const [linkId, setLinkId] = useState(
        sku?.link?.id || '',
    );
    const [type, setType] = useState(
        sku?.type || 'SINGLE',
    );
    const [name, setName] = useState(sku?.name || '');
    const [weight, setWeight] = useState(
        sku?.weight?.toString() || '',
    );
    const [miscFee, setMiscFee] = useState(
        sku?.miscFee?.toString() || '0',
    );
    const [comboPackageFee, setComboPackageFee] = useState(
        sku?.comboPackageFee?.toString() || '0',
    );
    const [expressId, setExpressId] = useState(
        sku?.defaultExpressCompany?.id || '',
    );
    const [status, setStatus] = useState(
        sku?.status || 'ENABLED',
    );
    const [remark, setRemark] = useState(
        sku?.remark || '',
    );

    const initFpItems = (): FpItem[] => {
        if (sku?.finishedProducts?.length) {
            return sku.finishedProducts.map(
                (fp: any) => ({
                    finishedProductId:
                        fp.finishedProduct.id,
                    quantity: fp.quantity,
                }),
            );
        }
        return [{ finishedProductId: '', quantity: 1 }];
    };

    const [fpItems, setFpItems] =
        useState<FpItem[]>(initFpItems);
    const [loading, setLoading] = useState(false);

    const [links, setLinks] =
        useState<LinkOption[]>([]);
    const [fpOptions, setFpOptions] =
        useState<FpOption[]>([]);
    const [expressList, setExpressList] =
        useState<ExpressOption[]>([]);

    useEffect(() => {
        loadOptions();
    }, []);

    const loadOptions = async () => {
        try {
            const [l, fp, ex] = await Promise.all([
                apiClient.getSkuLinksForSelect(),
                apiClient
                    .getSkuFinishedProductsForSelect(),
                apiClient
                    .getExpressCompaniesForSelect(),
            ]);
            setLinks(l || []);
            setFpOptions(fp || []);
            setExpressList(ex || []);
        } catch {
            // 静默处理
        }
    };

    const addFpItem = () => {
        setFpItems([
            ...fpItems,
            { finishedProductId: '', quantity: 1 },
        ]);
    };

    const removeFpItem = (idx: number) => {
        if (fpItems.length <= 1) return;
        setFpItems(fpItems.filter((_, i) => i !== idx));
    };

    const updateFpItem = (
        idx: number,
        field: keyof FpItem,
        value: string | number,
    ) => {
        const updated = [...fpItems];
        if (field === 'finishedProductId') {
            updated[idx].finishedProductId =
                value as string;
        } else {
            updated[idx].quantity = Number(value) || 1;
        }
        setFpItems(updated);
    };

    const handleSubmit = async (
        e: React.FormEvent,
    ) => {
        e.preventDefault();

        if (!linkId) {
            alert('请选择所属链接');
            return;
        }
        if (!name.trim()) {
            alert('请输入SKU名称');
            return;
        }
        if (
            !weight
            || parseFloat(weight) <= 0
        ) {
            alert('请输入有效的重量');
            return;
        }

        const validFps = fpItems.filter(
            (item) => item.finishedProductId,
        );
        if (validFps.length === 0) {
            alert('请至少选择一个成品');
            return;
        }

        setLoading(true);
        try {
            const submitData: any = {
                name: name.trim(),
                type,
                weight: parseFloat(weight),
                miscFee: parseFloat(miscFee) || 0,
                comboPackageFee:
                    parseFloat(comboPackageFee) || 0,
                defaultExpressCompanyId:
                    expressId || undefined,
                finishedProductItems: validFps,
                status,
                remark: remark || undefined,
            };

            if (sku) {
                await apiClient.updateSku(
                    sku.id,
                    submitData,
                );
            } else {
                submitData.linkId = linkId;
                await apiClient.createSku(submitData);
            }
            onSuccess();
        } catch (error: any) {
            alert(
                (sku ? '更新失败: ' : '创建失败: ')
                + (error.message || '请稍后重试'),
            );
        } finally {
            setLoading(false);
        }
    };

    const selectedLink = links.find(
        (l) => l.id === linkId,
    );

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"
        >
            {/* 所属链接 */}
            <div className="space-y-2">
                <Label>
                    所属链接
                    <span className="text-red-500 ml-1">
                        *
                    </span>
                </Label>
                <Select
                    value={linkId}
                    onValueChange={setLinkId}
                    disabled={!!sku}
                >
                    <SelectTrigger className="bg-[#1e1e1e] border-[#1e1e1e] text-white">
                        <SelectValue placeholder="选择链接" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                        {links.map((l) => (
                            <SelectItem
                                key={l.id}
                                value={l.id}
                                className="text-white"
                            >
                                {l.name}
                                {l.shop && (
                                    <span className="text-[#8e8e8e] ml-1">
                                        ({l.shop.name})
                                    </span>
                                )}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {selectedLink?.shop && (
                    <p className="text-xs text-[#8e8e8e]">
                        店铺：{selectedLink.shop.name}
                        {selectedLink.shop.platform
                            && ` (${selectedLink.shop.platform.name})`}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* SKU名称 */}
                <div className="space-y-2">
                    <Label>
                        SKU名称
                        <span className="text-red-500 ml-1">
                            *
                        </span>
                    </Label>
                    <Input
                        value={name}
                        onChange={(e) =>
                            setName(e.target.value)}
                        placeholder="如：压缩款袋装20片"
                        className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                    />
                </div>

                {/* 类型 */}
                <div className="space-y-2">
                    <Label>
                        SKU类型
                        <span className="text-red-500 ml-1">
                            *
                        </span>
                    </Label>
                    <Select
                        value={type}
                        onValueChange={setType}
                    >
                        <SelectTrigger className="bg-[#1e1e1e] border-[#1e1e1e] text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                            <SelectItem
                                value="SINGLE"
                                className="text-white"
                            >
                                单品
                            </SelectItem>
                            <SelectItem
                                value="COMBO"
                                className="text-white"
                            >
                                组合
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* 成品关联 */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>
                        关联成品
                        <span className="text-red-500 ml-1">
                            *
                        </span>
                    </Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={addFpItem}
                        className="text-[#409fff] hover:text-[#409fff]/80 h-7"
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        添加
                    </Button>
                </div>
                <div className="space-y-2">
                    {fpItems.map((item, idx) => (
                        <div
                            key={idx}
                            className="flex gap-2 items-center"
                        >
                            <Select
                                value={
                                    item.finishedProductId
                                    || 'none'
                                }
                                onValueChange={(v) =>
                                    updateFpItem(
                                        idx,
                                        'finishedProductId',
                                        v === 'none'
                                            ? '' : v,
                                    )}
                            >
                                <SelectTrigger className="flex-1 min-w-0 bg-[#1e1e1e] border-[#1e1e1e] text-white">
                                    <SelectValue placeholder="选择成品" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                                    <SelectItem
                                        value="none"
                                        className="text-white"
                                    >
                                        请选择成品
                                    </SelectItem>
                                    {fpOptions.map(
                                        (fp) => (
                                            <SelectItem
                                                key={fp.id}
                                                value={fp.id}
                                                className="text-white"
                                            >
                                                {fp.name}
                                                ({fp.code})
                                                - ¥
                                                {Number(
                                                    fp.totalCost
                                                    || 0,
                                                ).toFixed(3)}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                            <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                    updateFpItem(
                                        idx,
                                        'quantity',
                                        e.target.value,
                                    )}
                                className="w-20 shrink-0 bg-[#1e1e1e] border-[#1e1e1e] text-white text-center"
                                placeholder="数量"
                            />
                            {fpItems.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                        removeFpItem(idx)}
                                    className="h-8 w-8 text-[#8e8e8e] hover:text-red-400"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                {/* 重量 */}
                <div className="space-y-2">
                    <Label>
                        重量(kg)
                        <span className="text-red-500 ml-1">
                            *
                        </span>
                    </Label>
                    <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={weight}
                        onChange={(e) =>
                            setWeight(e.target.value)}
                        placeholder="0.000"
                        className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                    />
                </div>

                {/* 综合费用 */}
                <div className="space-y-2">
                    <Label>综合费用</Label>
                    <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={miscFee}
                        onChange={(e) =>
                            setMiscFee(e.target.value)}
                        placeholder="0.000"
                        className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                    />
                </div>

                {/* 组合包装费 */}
                <div className="space-y-2">
                    <Label>组合包装费</Label>
                    <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={comboPackageFee}
                        onChange={(e) =>
                            setComboPackageFee(
                                e.target.value,
                            )}
                        placeholder="0.000"
                        className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* 默认快递公司 */}
                <div className="space-y-2">
                    <Label>默认快递公司</Label>
                    <Select
                        value={expressId || 'none'}
                        onValueChange={(v) =>
                            setExpressId(
                                v === 'none' ? '' : v,
                            )}
                    >
                        <SelectTrigger className="bg-[#1e1e1e] border-[#1e1e1e] text-white">
                            <SelectValue placeholder="选择快递公司" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                            <SelectItem
                                value="none"
                                className="text-white"
                            >
                                不设置
                            </SelectItem>
                            {expressList.map((c) => (
                                <SelectItem
                                    key={c.id}
                                    value={c.id}
                                    className="text-white"
                                >
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* 状态 */}
                <div className="space-y-2">
                    <Label>状态</Label>
                    <Select
                        value={status}
                        onValueChange={setStatus}
                    >
                        <SelectTrigger className="bg-[#1e1e1e] border-[#1e1e1e] text-white">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                            <SelectItem
                                value="ENABLED"
                                className="text-white"
                            >
                                启用
                            </SelectItem>
                            <SelectItem
                                value="DISABLED"
                                className="text-white"
                            >
                                停用
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* 备注 */}
            <div className="space-y-2">
                <Label>备注</Label>
                <Input
                    value={remark}
                    onChange={(e) =>
                        setRemark(e.target.value)}
                    placeholder="请输入备注"
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                />
            </div>

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
                    {loading
                        ? '保存中...'
                        : sku ? '保存' : '创建'}
                </Button>
            </div>
        </form>
    );
}

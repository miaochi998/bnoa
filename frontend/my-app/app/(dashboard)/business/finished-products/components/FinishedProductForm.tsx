'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DictSelect } from '@/components/shared/DictSelect';
import { apiClient } from '@/lib/api';
import { Plus, Trash2 } from 'lucide-react';
import { SearchableSelect } from './SearchableSelect';
import { useFieldPermissions } from '@/lib/hooks/useFieldPermissions';

interface FinishedProductFormProps {
    finishedProduct: any;
    onSuccess: () => void;
    onCancel: () => void;
}

export function FinishedProductForm({
    finishedProduct,
    onSuccess,
    onCancel,
}: FinishedProductFormProps) {
    const isEdit = !!finishedProduct;
    const fp = useFieldPermissions('finished-product');

    const [form, setForm] = useState({
        name: finishedProduct?.name || '',
        productId: finishedProduct?.product?.id || '',
        supplierProductId:
            finishedProduct?.supplierProduct?.id || '',
        cutLength: finishedProduct?.cutLength || '',
        cutWidth: finishedProduct?.cutWidth || '',
        cutHeight: finishedProduct?.cutHeight || '',
        unitWeight: finishedProduct?.unitWeight || '',
        packageType: finishedProduct?.packageType || 'BAG',
        packageQuantity:
            finishedProduct?.packageQuantity || 1,
        packageUnit:
            finishedProduct?.packageUnit || '个',
        weight: finishedProduct?.weight || 0,
        status: finishedProduct?.status || 'ENABLED',
        remark: finishedProduct?.remark || '',
    });

    // API 返回 finishedProductConsumables / finishedProductLabor，兼容 consumableItems / laborItems
    const initialConsumables =
        finishedProduct?.consumableItems ??
        finishedProduct?.finishedProductConsumables;
    const initialLabor =
        finishedProduct?.laborItems ??
        finishedProduct?.finishedProductLabor;

    const [consumableItems, setConsumableItems] = useState<
        { consumableId: string; quantity: number }[]
    >(
        (initialConsumables ?? []).map((i: any) => ({
            consumableId: i.consumable?.id ?? i.consumableId ?? '',
            quantity: i.quantity ?? 1,
        })),
    );

    const [laborItems, setLaborItems] = useState<
        { laborTypeId: string; quantity: number }[]
    >(
        (initialLabor ?? []).map((i: any) => ({
            laborTypeId: i.laborType?.id ?? i.laborTypeId ?? '',
            // 工费次数（默认 1；此前没有该字段，导致工费成本只按 1 次计算）
            quantity: i.quantity ?? 1,
        })),
    );

    const [products, setProducts] = useState<any[]>([]);
    const [supplierProducts, setSupplierProducts] =
        useState<any[]>([]);
    const [consumables, setConsumables] =
        useState<any[]>([]);
    const [laborTypes, setLaborTypes] =
        useState<any[]>([]);
    const [pricingMode, setPricingMode] =
        useState('UNIT');
    const [loading, setLoading] = useState(false);

    // 编辑时根据接口数据回填耗材/工费清单（接口返回 finishedProductConsumables / finishedProductLabor）
    useEffect(() => {
        if (!finishedProduct) {
            setConsumableItems([]);
            setLaborItems([]);
            return;
        }
        const consumables =
            finishedProduct.consumableItems ??
            finishedProduct.finishedProductConsumables;
        const labor =
            finishedProduct.laborItems ??
            finishedProduct.finishedProductLabor;
        setConsumableItems(
            (consumables ?? []).map((i: any) => ({
                consumableId: i.consumable?.id ?? i.consumableId ?? '',
                quantity: i.quantity ?? 1,
            })),
        );
        setLaborItems(
            (labor ?? []).map((i: any) => ({
                laborTypeId: i.laborType?.id ?? i.laborTypeId ?? '',
                quantity: i.quantity ?? 1,
            })),
        );
    }, [finishedProduct?.id]);

    useEffect(() => {
        const load = async () => {
            const [p, c, l] = await Promise.all([
                apiClient.getFPProductsForSelect(),
                apiClient.getFPConsumablesForSelect(),
                apiClient.getFPLaborTypesForSelect(),
            ]);
            setProducts(p || []);
            setConsumables(c || []);
            setLaborTypes(l || []);
            if (form.productId) {
                const found = (p || []).find(
                    (x: any) => x.id === form.productId,
                );
                setPricingMode(found?.pricingMode || 'UNIT');
                const sp = await apiClient
                    .getFPSupplierProducts(form.productId);
                setSupplierProducts(sp || []);
            }
        };
        load();
    }, []);

    const handleProductChange = async (
        productId: string,
    ) => {
        setForm({
            ...form,
            productId,
            supplierProductId: '',
        });
        const found = products.find(
            (p) => p.id === productId,
        );
        setPricingMode(found?.pricingMode || 'UNIT');
        if (productId) {
            const sp = await apiClient
                .getFPSupplierProducts(productId);
            setSupplierProducts(sp || []);
        } else {
            setSupplierProducts([]);
        }
    };

    const addConsumableItem = () => {
        setConsumableItems([
            ...consumableItems,
            { consumableId: '', quantity: 1 },
        ]);
    };

    const removeConsumableItem = (idx: number) => {
        setConsumableItems(
            consumableItems.filter((_, i) => i !== idx),
        );
    };

    const addLaborItem = () => {
        setLaborItems([
            ...laborItems,
            { laborTypeId: '', quantity: 1 },
        ]);
    };

    const removeLaborItem = (idx: number) => {
        setLaborItems(
            laborItems.filter((_, i) => i !== idx),
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEdit && (!fp.canEdit('name') || !fp.canEdit('productId') || !fp.canEdit('supplierProductId') || !fp.canEdit('packageType') || !fp.canEdit('packageQuantity') || !fp.canEdit('packageUnit') || !fp.canEdit('weight'))) {
            return alert('没有创建成品所需的字段编辑权限');
        }
        if (fp.canEdit('name') && !form.name.trim()) {
            return alert('请输入成品名称');
        }
        if (!isEdit && fp.canEdit('productId') && !form.productId) {
            return alert('请选择产品');
        }
        if (fp.canEdit('supplierProductId') && !form.supplierProductId) {
            return alert('请选择供应商价格');
        }
        if (fp.canEdit('cutLength') && pricingMode === 'VOLUME'
            && (!form.cutLength || !form.cutWidth
                || !form.cutHeight)) {
            return alert('按体积计价必须填写切割长/宽/高');
        }
        if (fp.canEdit('unitWeight') && pricingMode === 'WEIGHT' && !form.unitWeight) {
            return alert('按重量计价必须填写每份重量');
        }
        if (fp.canEdit('cutLength') && pricingMode === 'AREA'
            && (!form.cutLength || !form.cutWidth)) {
            return alert('按面积计价必须填写切割长/宽');
        }
        if (fp.canEdit('cutLength') && pricingMode === 'LENGTH' && !form.cutLength) {
            return alert('按长度计价必须填写切割长度');
        }

        // 只提交「可编辑」字段：被配成只读/隐藏的字段不发送
        const payload: any = {};
        if (fp.canEdit('name')) payload.name = form.name;
        if (fp.canEdit('supplierProductId')) payload.supplierProductId = form.supplierProductId;
        if (fp.canEdit('packageType')) payload.packageType = form.packageType;
        if (fp.canEdit('packageQuantity')) payload.packageQuantity = Number(form.packageQuantity);
        if (fp.canEdit('packageUnit')) payload.packageUnit = form.packageUnit;
        if (fp.canEdit('weight')) payload.weight = Number(form.weight);
        if (fp.canEdit('remark')) payload.remark = form.remark || undefined;
        if (fp.canEdit('consumableItems')) {
            payload.consumableItems = consumableItems
                .filter((i) => i.consumableId)
                .map((i) => ({
                    consumableId: i.consumableId,
                    quantity: Number(i.quantity),
                }));
        }
        if (fp.canEdit('laborItems')) {
            payload.laborItems = laborItems
                .filter((i) => i.laborTypeId)
                .map((i) => ({
                    laborTypeId: i.laborTypeId,
                    quantity: Number(i.quantity) || 1,
                }));
        }
        if (!isEdit && fp.canEdit('productId')) {
            payload.productId = form.productId;
        }
        if (fp.canEdit('cutLength') && ['VOLUME', 'AREA', 'LENGTH'].includes(pricingMode)) {
            payload.cutLength = Number(form.cutLength);
        }
        if (fp.canEdit('cutWidth') && ['VOLUME', 'AREA'].includes(pricingMode)) {
            payload.cutWidth = Number(form.cutWidth);
        }
        if (fp.canEdit('cutHeight') && pricingMode === 'VOLUME') {
            payload.cutHeight = Number(form.cutHeight);
        }
        if (fp.canEdit('unitWeight') && pricingMode === 'WEIGHT') {
            payload.unitWeight = Number(form.unitWeight);
        }
        if (isEdit && fp.canEdit('status')) {
            payload.status = form.status;
        }

        if (Object.keys(payload).length === 0) {
            return alert('你没有成品字段的编辑权限');
        }

        setLoading(true);
        try {
            if (isEdit) {
                await apiClient.updateFinishedProduct(
                    finishedProduct.id, payload,
                );
                alert('更新成功');
            } else {
                await apiClient.createFinishedProduct(
                    payload,
                );
                alert('创建成功');
            }
            onSuccess();
        } catch (error: any) {
            alert(
                (isEdit ? '更新失败: ' : '创建失败: ')
                + (error.message || '请稍后重试'),
            );
        } finally {
            setLoading(false);
        }
    };

    const inputCls =
        'bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]';
    const selectCls =
        'bg-[#1e1e1e] border-[#1e1e1e] text-white';

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {isEdit && fp.canView('code') && (
                <div className="space-y-1">
                    <Label className="text-white">编码</Label>
                    <Input
                        value={finishedProduct.code ?? ''}
                        disabled
                        className="bg-[#1e1e1e] border-[#1e1e1e] text-[#8e8e8e]"
                    />
                </div>
            )}

            {fp.canView('name') && (
            <div className="space-y-1">
                <Label className="text-white">
                    成品名称 <span className="text-red-400">*</span>
                </Label>
                <Input
                    placeholder="请输入成品名称"
                    value={form.name}
                    onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                    }
                    disabled={!fp.canEdit('name')}
                    className={inputCls + ' disabled:opacity-50'}
                />
            </div>
            )}

            <div className="grid grid-cols-3 gap-4">
                {fp.canView('productId') && (
                <div className="space-y-1">
                    <Label className="text-white">
                        产品 <span className="text-red-400">*</span>
                    </Label>
                    <SearchableSelect
                        value={form.productId}
                        onValueChange={handleProductChange}
                        disabled={isEdit || !fp.canEdit('productId')}
                        placeholder="选择产品"
                        options={products.map((p) => ({
                            value: p.id,
                            label: `${p.name}${
                                p.pricingMode !== 'UNIT'
                                    ? ` (${{
                                        VOLUME: '体积',
                                        WEIGHT: '重量',
                                        AREA: '面积',
                                        LENGTH: '长度',
                                    }[p.pricingMode as 'VOLUME' | 'WEIGHT' | 'AREA' | 'LENGTH'] || ''})`
                                    : ''
                            }`,
                        }))}
                    />
                </div>
                )}
                {fp.canView('supplierProductId') && (
                <div className="space-y-1">
                    <Label className="text-white">
                        供应商价格 <span className="text-red-400">*</span>
                    </Label>
                    <SearchableSelect
                        value={form.supplierProductId}
                        onValueChange={(v) =>
                            setForm({ ...form, supplierProductId: v })
                        }
                        disabled={!fp.canEdit('supplierProductId')}
                        placeholder="先选产品"
                        options={supplierProducts.map((sp) => ({
                            value: sp.id,
                            label: `${sp.supplier?.name || ''} - ${sp.styleName || ''} ¥${Number(sp.supplyPrice).toFixed(3)}`,
                        }))}
                    />
                </div>
                )}
                {fp.canView('weight') && (
                <div className="space-y-1">
                    <Label className="text-white">
                        成品重量(kg) <span className="text-red-400">*</span>
                    </Label>
                    <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.weight}
                        onChange={(e) =>
                            setForm({ ...form, weight: e.target.value })
                        }
                        disabled={!fp.canEdit('weight')}
                        className={inputCls + ' disabled:opacity-50'}
                    />
                </div>
                )}
            </div>

            {/* 按计价方式显示不同参数 */}
            {pricingMode === 'VOLUME' && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label className="text-white">
                            切割长(cm) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            type="number" step="0.01" min="0"
                            value={form.cutLength}
                            onChange={(e) =>
                                setForm({ ...form, cutLength: e.target.value })
                            }
                            disabled={!fp.canEdit('cutLength')}
                            className={inputCls + ' disabled:opacity-50'}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-white">
                            切割宽(cm) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            type="number" step="0.01" min="0"
                            value={form.cutWidth}
                            onChange={(e) =>
                                setForm({ ...form, cutWidth: e.target.value })
                            }
                            disabled={!fp.canEdit('cutWidth')}
                            className={inputCls + ' disabled:opacity-50'}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-white">
                            切割高(cm) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            type="number" step="0.01" min="0"
                            value={form.cutHeight}
                            onChange={(e) =>
                                setForm({ ...form, cutHeight: e.target.value })
                            }
                            disabled={!fp.canEdit('cutHeight')}
                            className={inputCls + ' disabled:opacity-50'}
                        />
                    </div>
                </div>
            )}
            {pricingMode === 'WEIGHT' && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label className="text-white">
                            每份重量(克) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            type="number" step="0.01" min="0"
                            value={form.unitWeight}
                            onChange={(e) =>
                                setForm({ ...form, unitWeight: e.target.value })
                            }
                            disabled={!fp.canEdit('unitWeight')}
                            className={inputCls + ' disabled:opacity-50'}
                        />
                    </div>
                </div>
            )}
            {pricingMode === 'AREA' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-white">
                            切割长(cm) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            type="number" step="0.01" min="0"
                            value={form.cutLength}
                            onChange={(e) =>
                                setForm({ ...form, cutLength: e.target.value })
                            }
                            disabled={!fp.canEdit('cutLength')}
                            className={inputCls + ' disabled:opacity-50'}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-white">
                            切割宽(cm) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            type="number" step="0.01" min="0"
                            value={form.cutWidth}
                            onChange={(e) =>
                                setForm({ ...form, cutWidth: e.target.value })
                            }
                            disabled={!fp.canEdit('cutWidth')}
                            className={inputCls + ' disabled:opacity-50'}
                        />
                    </div>
                </div>
            )}
            {pricingMode === 'LENGTH' && (
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label className="text-white">
                            切割长(cm) <span className="text-red-400">*</span>
                        </Label>
                        <Input
                            type="number" step="0.01" min="0"
                            value={form.cutLength}
                            onChange={(e) =>
                                setForm({ ...form, cutLength: e.target.value })
                            }
                            disabled={!fp.canEdit('cutLength')}
                            className={inputCls + ' disabled:opacity-50'}
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-4">
                {fp.canView('packageType') && (
                <div className="space-y-1">
                    <Label className="text-white">
                        包装类型 <span className="text-red-400">*</span>
                    </Label>
                    <DictSelect
                        typeCode="package_type"
                        value={form.packageType}
                        onChange={(v) =>
                            setForm({ ...form, packageType: v })
                        }
                        disabled={!fp.canEdit('packageType')}
                        className={selectCls}
                    />
                </div>
                )}
                {fp.canView('packageQuantity') && (
                <div className="space-y-1">
                    <Label className="text-white">
                        每包数量 <span className="text-red-400">*</span>
                    </Label>
                    <Input
                        type="number"
                        min="1"
                        value={form.packageQuantity}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                packageQuantity: e.target.value,
                            })
                        }
                        disabled={!fp.canEdit('packageQuantity')}
                        className={inputCls + ' disabled:opacity-50'}
                    />
                </div>
                )}
                {fp.canView('packageUnit') && (
                <div className="space-y-1">
                    <Label className="text-white">
                        包装单位 <span className="text-red-400">*</span>
                    </Label>
                    <Input
                        placeholder="个/块/片"
                        value={form.packageUnit}
                        onChange={(e) =>
                            setForm({ ...form, packageUnit: e.target.value })
                        }
                        disabled={!fp.canEdit('packageUnit')}
                        className={inputCls + ' disabled:opacity-50'}
                    />
                </div>
                )}
            </div>

            {isEdit && fp.canView('status') && (
                <div className="space-y-1">
                    <Label className="text-white">状态</Label>
                    <DictSelect
                        typeCode="finished_product_status"
                        value={form.status}
                        onChange={(v) =>
                            setForm({ ...form, status: v })
                        }
                        disabled={!fp.canEdit('status')}
                        className={selectCls}
                    />
                </div>
            )}

            {fp.canView('remark') && (
            <div className="space-y-1">
                <Label className="text-white">备注</Label>
                <Input
                    placeholder="备注"
                    value={form.remark}
                    onChange={(e) =>
                        setForm({ ...form, remark: e.target.value })
                    }
                    disabled={!fp.canEdit('remark')}
                    className={inputCls + ' disabled:opacity-50'}
                />
            </div>
            )}

            {/* 耗材清单 */}
            {fp.canView('consumableItems') && (
            <div className="space-y-2 border-t border-[#3e3e3e] pt-4">
                <div className="flex justify-between items-center">
                    <Label className="text-white font-medium">
                        耗材清单
                    </Label>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addConsumableItem}
                        disabled={!fp.canEdit('consumableItems')}
                        className="bg-[#1e1e1e] border-[#3e3e3e] text-white hover:bg-[#363636]"
                    >
                        <Plus className="w-3 h-3 mr-1" /> 添加耗材
                    </Button>
                </div>
                {consumableItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                        <div className="col-span-2">
                            <SearchableSelect
                                value={item.consumableId}
                                onValueChange={(v) => {
                                    const arr = [...consumableItems];
                                    arr[idx].consumableId = v;
                                    setConsumableItems(arr);
                                }}
                                placeholder="选择耗材"
                                disabled={!fp.canEdit('consumableItems')}
                                options={consumables.map((c) => ({
                                    value: c.id,
                                    label: c.name,
                                }))}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                min="1"
                                placeholder="用量"
                                disabled={!fp.canEdit('consumableItems')}
                                value={item.quantity}
                                onChange={(e) => {
                                    const arr = [...consumableItems];
                                    arr[idx].quantity =
                                        Number(e.target.value);
                                    setConsumableItems(arr);
                                }}
                                className={inputCls}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeConsumableItem(idx)}
                                disabled={!fp.canEdit('consumableItems')}
                                className="h-9 w-9 shrink-0 text-[#8e8e8e] hover:text-red-400"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
                {consumableItems.length === 0 && (
                    <p className="text-xs text-[#8e8e8e]">
                        暂无耗材，点击上方按钮添加
                    </p>
                )}
            </div>
            )}

            {/* 工费清单 */}
            {fp.canView('laborItems') && (
            <div className="space-y-2 border-t border-[#3e3e3e] pt-4">
                <div className="flex justify-between items-center">
                    <Label className="text-white font-medium">
                        工费清单
                    </Label>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addLaborItem}
                        disabled={!fp.canEdit('laborItems')}
                        className="bg-[#1e1e1e] border-[#3e3e3e] text-white hover:bg-[#363636]"
                    >
                        <Plus className="w-3 h-3 mr-1" /> 添加工费
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {laborItems.map((item, idx) => (
                        <div key={idx} className="flex gap-1 items-end">
                            <div className="flex-1">
                                <SearchableSelect
                                value={item.laborTypeId}
                                onValueChange={(v) => {
                                    const arr = [...laborItems];
                                    arr[idx].laborTypeId = v;
                                    setLaborItems(arr);
                                }}
                                placeholder="选择工种"
                                disabled={!fp.canEdit('laborItems')}
                                options={laborTypes.map((l) => ({
                                    value: l.id,
                                    label: l.name,
                                }))}
                            />
                            </div>
                            <Input
                                type="number"
                                min={1}
                                step={1}
                                value={String(item.quantity ?? 1)}
                                onChange={(e) => {
                                    const arr = [...laborItems];
                                    arr[idx].quantity = Number(e.target.value) || 1;
                                    setLaborItems(arr);
                                }}
                                title="该工种需要做的次数（默认 1）"
                                placeholder="次数"
                                disabled={!fp.canEdit('laborItems')}
                                className="w-20 bg-[#1e1e1e] border-[#3e3e3e] text-white"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLaborItem(idx)}
                                disabled={!fp.canEdit('laborItems')}
                                className="h-9 w-9 shrink-0 text-[#8e8e8e] hover:text-red-400"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                {laborItems.length === 0 && (
                    <p className="text-xs text-[#8e8e8e]">
                        暂无工费，点击上方按钮添加
                    </p>
                )}
            </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[#3e3e3e]">
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
                        : isEdit ? '保存' : '创建'}
                </Button>
            </div>
        </form>
    );
}

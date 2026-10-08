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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { Plus, Trash2, Package, Pencil } from 'lucide-react';
import { DictSelect } from '@/components/shared/DictSelect';
import { DictTag } from '@/components/shared/DictTag';
import { EditableCell } from '@/components/shared/EditableCell';
import { PermissionGate } from '@/components/PermissionGate';

interface Supplier {
    id: string;
    code: string;
    name: string;
}

interface Product {
    id: string;
    code: string;
    name: string;
}

interface SupplierProduct {
    id: string;
    supplierId: string;
    productId: string;
    styleName?: string;
    supplyPrice: number;
    priceUnit: string;
    priceUnitCustom?: string;
    status: 'ACTIVE' | 'INACTIVE';
    product: Product;
}

interface SupplierProductFormProps {
    supplier: Supplier;
    onSuccess: () => void;
    onCancel: () => void;
}

export function SupplierProductForm({ supplier, onSuccess, onCancel }: SupplierProductFormProps) {
    const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // 新增/编辑关联表单
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [styleName, setStyleName] = useState('');
    const [supplyPrice, setSupplyPrice] = useState('');
    const [priceUnit, setPriceUnit] = useState('PER_PIECE');
    const [priceUnitCustom, setPriceUnitCustom] = useState('');

    // 加载数据
    useEffect(() => {
        loadSupplierProducts();
        loadProducts();
    }, [supplier.id]);

    const loadSupplierProducts = async () => {
        try {
            const data = await apiClient.getSupplierProducts({
                supplierId: supplier.id,
            });
            setSupplierProducts(data.list || []);
        } catch (error) {
            console.error('加载供应商产品关联失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadProducts = async () => {
        try {
            const data = await apiClient.getProducts({ page: 1, pageSize: 1000 });
            setProducts(data.list || []);
        } catch (error) {
            console.error('加载产品列表失败:', error);
        }
    };

    const handleAdd = async () => {
        if (!selectedProductId) {
            alert('请选择产品');
            return;
        }
        if (!supplyPrice || parseFloat(supplyPrice) < 0) {
            alert('请输入有效的供货价格');
            return;
        }

        if (priceUnit === 'PER_CUSTOM' && !priceUnitCustom.trim()) {
            alert('请输入自定义单位名称');
            return;
        }

        setSubmitting(true);
        try {
            await apiClient.createSupplierProduct({
                supplierId: supplier.id,
                productId: selectedProductId,
                styleName: styleName || undefined,
                supplyPrice: parseFloat(supplyPrice),
                priceUnit,
                priceUnitCustom: priceUnit === 'PER_CUSTOM' ? priceUnitCustom.trim() : undefined,
                status: 'ACTIVE',
            });
            alert('添加成功');
            resetForm();
            loadSupplierProducts();
        } catch (error: any) {
            alert('添加失败: ' + (error.message || '请稍后重试'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (sp: SupplierProduct) => {
        setEditingId(sp.id);
        setSelectedProductId(sp.productId);
        setStyleName(sp.styleName || '');
        setSupplyPrice(String(sp.supplyPrice));
        setPriceUnit(sp.priceUnit);
        setPriceUnitCustom(sp.priceUnitCustom || '');
        setShowAddForm(true);
    };

    const handleUpdate = async () => {
        if (!supplyPrice || parseFloat(supplyPrice) < 0) {
            alert('请输入有效的供货价格');
            return;
        }
        if (priceUnit === 'PER_CUSTOM' && !priceUnitCustom.trim()) {
            alert('请输入自定义单位名称');
            return;
        }
        setSubmitting(true);
        try {
            await apiClient.updateSupplierProduct(editingId!, {
                styleName: styleName || undefined,
                supplyPrice: parseFloat(supplyPrice),
                priceUnit,
                priceUnitCustom: priceUnit === 'PER_CUSTOM' ? priceUnitCustom.trim() : undefined,
            });
            alert('更新成功');
            resetForm();
            loadSupplierProducts();
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setShowAddForm(false);
        setEditingId(null);
        setSelectedProductId('');
        setStyleName('');
        setSupplyPrice('');
        setPriceUnit('PER_PIECE');
        setPriceUnitCustom('');
    };

    const handleDelete = async (id: string, productName: string) => {
        if (!confirm(`确定要删除与产品 "${productName}" 的关联吗？`)) {
            return;
        }

        try {
            await apiClient.deleteSupplierProduct(id);
            alert('删除成功');
            loadSupplierProducts();
        } catch (error: any) {
            alert('删除失败: ' + (error.message || '请稍后重试'));
        }
    };

    // 列表内直接编辑关联字段（款式/供货价格）
    const handleUpdateField = async (id: string, field: 'styleName' | 'supplyPrice', newValue: string) => {
        try {
            if (field === 'supplyPrice') {
                await apiClient.updateSupplierProduct(id, { supplyPrice: newValue === '' ? null : parseFloat(newValue) });
            } else {
                await apiClient.updateSupplierProduct(id, { [field]: newValue || null });
            }
            await loadSupplierProducts();
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };

    const getStatusText = (status: string) => {
        return status === 'ACTIVE' ? '合作中' : '已终止';
    };

    const getStatusClass = (status: string) => {
        return status === 'ACTIVE'
            ? 'bg-green-500/20 text-green-400'
            : 'bg-gray-500/20 text-gray-400';
    };

    const isEditing = editingId !== null;

    return (
        <div className="space-y-4">
            {/* 添加按钮 */}
            {!showAddForm && (
                <Button
                    onClick={() => setShowAddForm(true)}
                    className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                    disabled={products.length === 0}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    添加产品关联
                </Button>
            )}

            {/* 添加表单 */}
            {showAddForm && (
                <div className="bg-[#1e1e1e] p-4 rounded-lg space-y-4">
                    <h4 className="text-white font-medium">{isEditing ? '编辑产品关联' : '新增产品关联'}</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-white">选择产品</Label>
                            <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={isEditing}>
                                <SelectTrigger className="bg-[#262626] border-[#363636] text-white disabled:opacity-60">
                                    <SelectValue placeholder="选择产品" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                                    {products.map((product) => (
                                        <SelectItem
                                            key={product.id}
                                            value={product.id}
                                            className="text-white"
                                        >
                                            {product.name} ({product.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-white">款式名称</Label>
                            <Input
                                placeholder="可选，如“白色-大号”"
                                value={styleName}
                                onChange={(e) => setStyleName(e.target.value)}
                                className="bg-[#262626] border-[#363636] text-white placeholder:text-[#8e8e8e]"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-white">供货价格</Label>
                            <Input
                                type="number"
                                step="0.0001"
                                min="0"
                                placeholder="请输入供货价格"
                                value={supplyPrice}
                                onChange={(e) => setSupplyPrice(e.target.value)}
                                className="bg-[#262626] border-[#363636] text-white placeholder:text-[#8e8e8e]"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-white">价格单位</Label>
                            <div className="flex gap-2">
                                <DictSelect
                                    typeCode="price_unit"
                                    value={priceUnit}
                                    onChange={(v) => {
                                        setPriceUnit(v);
                                        if (v !== 'PER_CUSTOM') setPriceUnitCustom('');
                                    }}
                                />
                                {priceUnit === 'PER_CUSTOM' && (
                                    <Input
                                        placeholder="如“元/桶”"
                                        value={priceUnitCustom}
                                        onChange={(e) => setPriceUnitCustom(e.target.value)}
                                        className="bg-[#262626] border-[#363636] text-white placeholder:text-[#8e8e8e]"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={isEditing ? handleUpdate : handleAdd}
                            disabled={submitting}
                            className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                        >
                            {submitting ? '保存中...' : isEditing ? '确认修改' : '确认添加'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={resetForm}
                            className="bg-[#262626] border-[#363636] text-white hover:bg-[#363636]"
                        >
                            取消
                        </Button>
                    </div>
                </div>
            )}

            {/* 关联列表 */}
            <div className="border border-[#1e1e1e] rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="border-[#1e1e1e] hover:bg-transparent">
                            <TableHead className="text-[#8e8e8e]">产品编码</TableHead>
                            <TableHead className="text-[#8e8e8e]">产品名称</TableHead>
                            <TableHead className="text-[#8e8e8e]">款式</TableHead>
                            <TableHead className="text-[#8e8e8e]">供货价格</TableHead>
                            <TableHead className="text-[#8e8e8e]">单位</TableHead>
                            <TableHead className="text-[#8e8e8e]">状态</TableHead>
                            <TableHead className="text-[#8e8e8e] text-right">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-[#8e8e8e] py-8">
                                    加载中...
                                </TableCell>
                            </TableRow>
                        ) : supplierProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-[#8e8e8e] py-8">
                                    <div className="flex flex-col items-center gap-2">
                                        <Package className="w-8 h-8 text-[#8e8e8e]" />
                                        <p>暂无产品关联</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            supplierProducts.map((sp) => (
                                <TableRow key={sp.id} className="border-[#1e1e1e]">
                                    <TableCell className="text-white">{sp.product.code}</TableCell>
                                    <TableCell className="text-white">{sp.product.name}</TableCell>
                                    <TableCell className="text-white">
                                        <PermissionGate
                                            permission="supplier:product"
                                            fallback={<span>{sp.styleName || '-'}</span>}
                                        >
                                            <EditableCell
                                                value={sp.styleName}
                                                onSave={(newValue) => handleUpdateField(sp.id, 'styleName', newValue)}
                                                placeholder="款式"
                                                maxLength={100}
                                            />
                                        </PermissionGate>
                                    </TableCell>
                                    <TableCell className="text-white">
                                        <PermissionGate
                                            permission="supplier:product"
                                            fallback={<span>¥{parseFloat(sp.supplyPrice as any).toFixed(3)}</span>}
                                        >
                                            <EditableCell
                                                value={sp.supplyPrice}
                                                onSave={(newValue) => handleUpdateField(sp.id, 'supplyPrice', newValue)}
                                                type="number"
                                                label="供货价格"
                                                placeholder="供货价格"
                                            />
                                        </PermissionGate>
                                    </TableCell>
                                    <TableCell>
                                        {sp.priceUnit === 'PER_CUSTOM' && sp.priceUnitCustom ? (
                                            <span className="px-2 py-1 rounded text-xs bg-gray-500/20 text-gray-300">
                                                {sp.priceUnitCustom}
                                            </span>
                                        ) : (
                                            <DictTag typeCode="price_unit" value={sp.priceUnit} />
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded text-xs ${getStatusClass(sp.status)}`}>
                                            {getStatusText(sp.status)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleEdit(sp)}
                                                className="h-8 w-8 text-[#8e8e8e] hover:text-white hover:bg-[#363636]"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(sp.id, sp.product.name)}
                                                className="h-8 w-8 text-[#8e8e8e] hover:text-red-400 hover:bg-red-500/10"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* 关闭按钮 */}
            <div className="flex justify-end pt-4">
                <Button
                    onClick={onCancel}
                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white hover:bg-[#363636]"
                >
                    关闭
                </Button>
            </div>
        </div>
    );
}

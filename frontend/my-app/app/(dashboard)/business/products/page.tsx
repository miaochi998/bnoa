'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Plus, Edit, Trash2, Package, Settings, GripVertical, Eye } from 'lucide-react';
import { ProductForm } from './components/ProductForm';
import { ProductImageConfigDialog } from '@/components/products/ProductImageConfigDialog';
import { DictTag } from '@/components/shared/DictTag';
import { PermissionGate } from '@/components/PermissionGate';
import { EditableCell } from '@/components/shared/EditableCell';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const API_BASE_URL = getApiBaseUrl();

interface Product {
    id: string;
    name: string;
    code: string;
    brand: string | null;
    pricingMode: string;
    status: 'ON_SALE' | 'DISCONTINUED' | 'DEVELOPING';
    mainImage: string | null;
    remark: string | null;
    createdAt: string;
}

interface Pagination {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

const statusMap = {
    ON_SALE: { label: '在售', color: 'bg-green-500' },
    DISCONTINUED: { label: '停售', color: 'bg-red-500' },
    DEVELOPING: { label: '开发中', color: 'bg-yellow-500' },
};

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1000 : 'auto',
    };

    return (
        <tr
            ref={setNodeRef}
            style={style}
            className="border-t border-[#1e1e1e] hover:bg-[#363636]"
        >
            <td className="px-2 w-10">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300"
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            </td>
            {children}
        </tr>
    );
}


export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [brandFilter, setBrandFilter] = useState<string>('');
    const [brands, setBrands] = useState<string[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
    });

    const handlePageSizeChange = (newSize: number) => {
        setPagination(p => ({ ...p, pageSize: newSize, page: 1 }));
    };
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [sorting, setSorting] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // 加载产品列表
    const loadProducts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiClient.getProducts({
                keyword: searchKeyword || undefined,
                status: statusFilter || undefined,
                brand: brandFilter || undefined,
                page: pagination.page,
                pageSize: pagination.pageSize,
            });
            setProducts(data.list || []);
            setPagination({
                page: data.pagination?.page || 1,
                pageSize: data.pagination?.pageSize || 10,
                total: data.pagination?.total || 0,
                totalPages: data.pagination?.totalPages || 0,
            });
        } catch (error: any) {
            alert('加载产品列表失败: ' + (error.message || '请稍后重试'));
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.pageSize, searchKeyword, statusFilter, brandFilter]);

    // 加载品牌列表
    const loadBrands = useCallback(async () => {
        try {
            const data = await apiClient.getBrands();
            setBrands(data || []);
        } catch (error) {
            console.error('加载品牌列表失败:', error);
        }
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    useEffect(() => {
        loadBrands();
    }, [loadBrands]);

    // 删除产品
    const handleDelete = async (product: Product) => {
        if (!confirm(`确定要删除产品 "${product.name}" 吗？`)) {
            return;
        }

        try {
            await apiClient.deleteProduct(product.id);
            alert('删除成功');
            loadProducts();
        } catch (error: any) {
            alert('删除失败: ' + (error.message || '请稍后重试'));
        }
    };

    // 打开编辑对话框
    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setIsFormOpen(true);
    };

    // 打开新增对话框
    const handleAdd = () => {
        setEditingProduct(null);
        setIsFormOpen(true);
    };

    // 表单提交成功
    const handleFormSuccess = () => {
        setIsFormOpen(false);
        setEditingProduct(null);
        loadProducts();
        loadBrands();
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = products.findIndex((item) => item.id === active.id);
            const newIndex = products.findIndex((item) => item.id === over.id);
            const newList = arrayMove(products, oldIndex, newIndex);
            setProducts(newList);

            setSorting(true);
            try {
                const ids = newList.map((item) => item.id);
                await apiClient.reorderProducts(ids);
            } catch (error) {
                console.error('保存排序失败:', error);
                loadProducts();
            } finally {
                setSorting(false);
            }
        }
    };

    // 更新产品字段
    const handleUpdateField = async (id: string, field: 'name' | 'brand', newValue: string) => {
        try {
            await apiClient.updateProduct(id, { [field]: newValue || null });
            // 更新本地列表
            setProducts(prev => prev.map(item =>
                item.id === id ? { ...item, [field]: newValue || null } : item
            ));
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">产品管理</h1>
                    <p className="text-[#8e8e8e] mt-1">管理产品信息和品牌</p>
                </div>
                <div className="flex gap-2">
                    <PermissionGate permission="product:brands">
                        <Button
                            variant="outline"
                            onClick={() => setConfigDialogOpen(true)}
                            className="bg-[#2e2e2e] hover:bg-[#363636] text-white border border-[#1e1e1e]"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            上传配置
                        </Button>
                    </PermissionGate>
                    <PermissionGate permission="product:create">
                        <Button
                            onClick={handleAdd}
                            className="bg-[#2e2e2e] hover:bg-[#363636] text-white border border-[#1e1e1e]"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            新增产品
                        </Button>
                    </PermissionGate>
                </div>
            </div>

            {/* 搜索和筛选 */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e8e]" />
                    <Input
                        placeholder="搜索产品名称或编码..."
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        className="pl-10 bg-[#2e2e2e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                    />
                </div>
                <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? '' : value)}>
                    <SelectTrigger className="w-[150px] bg-[#2e2e2e] border-[#1e1e1e] text-white">
                        <SelectValue placeholder="全部状态" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                        <SelectItem value="all" className="text-white">全部状态</SelectItem>
                        <SelectItem value="ON_SALE" className="text-white">在售</SelectItem>
                        <SelectItem value="DISCONTINUED" className="text-white">停售</SelectItem>
                        <SelectItem value="DEVELOPING" className="text-white">开发中</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={brandFilter || 'all'} onValueChange={(value) => setBrandFilter(value === 'all' ? '' : value)}>
                    <SelectTrigger className="w-[150px] bg-[#2e2e2e] border-[#1e1e1e] text-white">
                        <SelectValue placeholder="全部品牌" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                        <SelectItem value="all" className="text-white">全部品牌</SelectItem>
                        {brands.map((brand) => (
                            <SelectItem key={brand} value={brand} className="text-white">
                                {brand}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    onClick={loadProducts}
                    disabled={loading}
                    className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                >
                    {loading ? '加载中...' : '刷新'}
                </Button>
            </div>

            {/* 产品列表 */}
            <div className="bg-[#2e2e2e] rounded-lg border border-[#1e1e1e] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#1e1e1e]">
                    <h3 className="text-white font-medium">产品列表</h3>
                </div>
                {products.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[#8e8e8e]">
                        暂无产品数据
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={products.map((p) => p.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-[#262626]">
                                        <th className="px-2 py-3 text-left text-sm font-medium text-[#8e8e8e] w-10">拖拽</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">产品</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">编码</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">品牌</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">状态</th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-[#8e8e8e]">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((product) => (
                                        <SortableRow key={product.id} id={product.id}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {product.mainImage ? (
                                                        <div
                                                            className="relative w-10 h-10 rounded bg-[#1e1e1e] flex items-center justify-center overflow-hidden cursor-pointer group"
                                                            title="查看大图"
                                                            onClick={() => {
                                                                setPreviewImage(`${API_BASE_URL}/public/files/${product.mainImage}/preview`);
                                                                setPreviewName(product.name);
                                                                setPreviewOpen(true);
                                                            }}
                                                        >
                                                            <img
                                                                src={`${API_BASE_URL}/public/files/${product.mainImage}/preview`}
                                                                alt={product.name}
                                                                className="w-full h-full object-cover rounded"
                                                            />
                                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                                <Eye className="w-4 h-4 text-white" />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="w-10 h-10 rounded bg-[#1e1e1e] flex items-center justify-center overflow-hidden">
                                                            <Package className="w-5 h-5 text-[#8e8e8e]" />
                                                        </div>
                                                    )}
                                                    <div className="text-white font-medium">
                                                        <PermissionGate
                                                            permission="product:update"
                                                            fallback={
                                                                <span>
                                                                    {product.name}
                                                                    {product.pricingMode !== 'UNIT' && (
                                                                        <span className="ml-2">
                                                                            <DictTag typeCode="pricing_mode" value={product.pricingMode} />
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            }
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <EditableCell
                                                                    value={product.name}
                                                                    onSave={(newValue) => handleUpdateField(product.id, 'name', newValue)}
                                                                    placeholder="产品名称"
                                                                    maxLength={100}
                                                                />
                                                                {product.pricingMode !== 'UNIT' && (
                                                                    <DictTag typeCode="pricing_mode" value={product.pricingMode} />
                                                                )}
                                                            </div>
                                                        </PermissionGate>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[#8e8e8e]">{product.code}</td>
                                            <td className="px-4 py-3 text-[#8e8e8e]">
                                                <PermissionGate
                                                    permission="product:update"
                                                    fallback={<span>{product.brand || '-'}</span>}
                                                >
                                                    <EditableCell
                                                        value={product.brand}
                                                        onSave={(newValue) => handleUpdateField(product.id, 'brand', newValue)}
                                                        placeholder="品牌"
                                                        maxLength={50}
                                                    />
                                                </PermissionGate>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge className={`${statusMap[product.status].color} text-white`}>
                                                    {statusMap[product.status].label}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <PermissionGate permission="product:update">
                                                        <button
                                                            onClick={() => handleEdit(product)}
                                                            className="p-1.5 rounded hover:bg-[#1e1e1e] text-[#8e8e8e] hover:text-white transition-colors"
                                                            title="编辑"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    </PermissionGate>
                                                    <PermissionGate permission="product:delete">
                                                        <button
                                                            onClick={() => handleDelete(product)}
                                                            className="p-1.5 rounded hover:bg-[#1e1e1e] text-[#8e8e8e] hover:text-red-500 transition-colors"
                                                            title="删除"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </PermissionGate>
                                                </div>
                                            </td>
                                        </SortableRow>
                                    ))}
                                </tbody>
                            </table>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            {/* 分页 */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-[#8e8e8e]">
                            共 {pagination.total} 条记录，第 {pagination.page} / {pagination.totalPages} 页
                        </div>
                        <Select
                            value={String(pagination.pageSize)}
                            onValueChange={(v) => handlePageSizeChange(Number(v))}
                        >
                            <SelectTrigger className="w-24 h-8 bg-[#2e2e2e] border-[#1e1e1e] text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e] text-white">
                                <SelectItem value="20">20 条/页</SelectItem>
                                <SelectItem value="50">50 条/页</SelectItem>
                                <SelectItem value="100">100 条/页</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            disabled={pagination.page === 1}
                            className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                        >
                            上一页
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            disabled={pagination.page === pagination.totalPages}
                            className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                        >
                            下一页
                        </Button>
                    </div>
                </div>
            )}

            {/* 新增/编辑对话框 */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="bg-[#2e2e2e] border-[#1e1e1e] text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingProduct ? '编辑产品' : '新增产品'}</DialogTitle>
                    </DialogHeader>
                    <ProductForm
                        product={editingProduct}
                        onSuccess={handleFormSuccess}
                        onCancel={() => setIsFormOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* 上传配置弹窗 */}
            <ProductImageConfigDialog
                open={configDialogOpen}
                onOpenChange={(open) => {
                    setConfigDialogOpen(open);
                }}
            />

            {/* 大图预览弹窗 */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="bg-[#2e2e2e] border-[#1e1e1e] text-white max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{previewName || '产品图片'}</DialogTitle>
                    </DialogHeader>
                    {previewImage && (
                        <img
                            src={previewImage}
                            alt={previewName || '产品大图'}
                            className="w-full max-h-[80vh] object-contain rounded cursor-pointer"
                            onClick={() => setPreviewOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

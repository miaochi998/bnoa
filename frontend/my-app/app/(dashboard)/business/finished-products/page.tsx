'use client';

import { useState, useEffect, useRef } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DictSelect } from '@/components/shared/DictSelect';
import { DictTag } from '@/components/shared/DictTag';
import { apiClient } from '@/lib/api';
import {
    Plus, Search, Edit, Trash2, Boxes,
    RefreshCw, GripVertical,
} from 'lucide-react';
import { FinishedProductForm } from './components/FinishedProductForm';
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

interface FinishedProduct {
    id: string;
    code: string;
    name: string;
    packageType: string;
    packageQuantity: number;
    packageUnit: string;
    weight: number;
    materialCost: number;
    consumableCost: number;
    laborCost: number;
    totalCost: number;
    status: string;
    product: { id: string; name: string };
    supplierProduct: {
        styleName: string;
        supplier: { name: string };
    };
    consumableItems: any[];
    laborItems: any[];
}

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
        <TableRow
            ref={setNodeRef}
            style={style}
            className="border-[#1e1e1e]"
        >
            <TableCell className="w-10">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300"
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            </TableCell>
            {children}
        </TableRow>
    );
}

export default function FinishedProductsPage() {
    const [list, setList] = useState<FinishedProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const debouncedKeyword = useDebouncedValue(keyword, 300);
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<FinishedProduct | null>(null);
    const [recalculating, setRecalculating] = useState('');
    const [sorting, setSorting] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await apiClient.getFinishedProducts({
                keyword: keyword || undefined,
                status: status === 'all' ? undefined : status,
                page,
                pageSize,
            });
            setList(data.list || []);
            setTotal(data.pagination?.total || 0);
        } catch (error) {
            console.error('加载成品列表失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const isFirstRender = useRef(true);
    useEffect(() => { loadData(); }, [page, pageSize]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setPage(1);
        loadData();
    }, [debouncedKeyword, status]);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(1);
    };

    const handleCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const handleEdit = async (item: FinishedProduct) => {
        try {
            const detail =
                await apiClient.getFinishedProduct(item.id);
            setEditing(detail);
            setDialogOpen(true);
        } catch {
            alert('获取成品详情失败');
        }
    };

    const handleDelete = async (item: FinishedProduct) => {
        if (!confirm(`确定要删除成品 "${item.name}" 吗？`)) {
            return;
        }
        try {
            await apiClient.deleteFinishedProduct(item.id);
            alert('删除成功');
            loadData();
        } catch (error: any) {
            alert(
                '删除失败: '
                + (error.message || '请稍后重试'),
            );
        }
    };

    const handleRecalculate = async (
        item: FinishedProduct,
    ) => {
        setRecalculating(item.id);
        try {
            await apiClient
                .recalculateFinishedProductCost(item.id);
            alert('成本重算完成');
            loadData();
        } catch (error: any) {
            alert(
                '重算失败: '
                + (error.message || '请稍后重试'),
            );
        } finally {
            setRecalculating('');
        }
    };

    const handleSuccess = () => {
        setDialogOpen(false);
        setEditing(null);
        loadData();
    };

    const formatCost = (v: number) => {
        return v ? `¥${Number(v).toFixed(3)}` : '-';
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = list.findIndex((item) => item.id === active.id);
            const newIndex = list.findIndex((item) => item.id === over.id);
            const newList = arrayMove(list, oldIndex, newIndex);
            setList(newList);

            setSorting(true);
            try {
                const ids = newList.map((item) => item.id);
                await apiClient.reorderFinishedProducts(ids);
            } catch (error) {
                console.error('保存排序失败:', error);
                loadData();
            } finally {
                setSorting(false);
            }
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    // 更新成品名称
    const handleUpdateName = async (id: string, newName: string) => {
        try {
            await apiClient.updateFinishedProduct(id, { name: newName });
            // 更新本地列表
            setList(prev => prev.map(item =>
                item.id === id ? { ...item, name: newName } : item
            ));
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error; // 抛出错误让EditableCell保持编辑状态
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        成品管理
                    </h1>
                    <p className="text-[#8e8e8e] mt-1">
                        管理成品信息、成本计算与包装配置
                    </p>
                </div>
                <PermissionGate permission="finished-product:create">
                    <Button
                        onClick={handleCreate}
                        className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        新增成品
                    </Button>
                </PermissionGate>
            </div>

            <Card className="bg-[#262626] border-[#1e1e1e]">
                <CardContent className="pt-6">
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8e8e8e] w-4 h-4"
                            />
                            <Input
                                placeholder="搜索成品名称、编码..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="pl-10 bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                            />
                        </div>
                        <DictSelect
                            typeCode="finished_product_status"
                            value={status}
                            onChange={setStatus}
                            showAll
                            allLabel="全部状态"
                            allValue="all"
                            className="w-[140px] bg-[#1e1e1e] border-[#1e1e1e] text-white"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-[#262626] border-[#1e1e1e]">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg text-white">
                        成品列表
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-[#8e8e8e]">加载中...</div>
                        </div>
                    ) : list.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12">
                            <Boxes className="w-8 h-8 text-[#8e8e8e]" />
                            <p className="text-[#8e8e8e]">暂无成品数据</p>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={list.map((i) => i.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-[#1e1e1e] hover:bg-transparent">
                                            <TableHead className="text-[#8e8e8e] w-10">拖拽</TableHead>
                                            <TableHead className="text-[#8e8e8e]">编码</TableHead>
                                            <TableHead className="text-[#8e8e8e]">名称</TableHead>
                                            <TableHead className="text-[#8e8e8e]">产品</TableHead>
                                            <TableHead className="text-[#8e8e8e]">供应商</TableHead>
                                            <TableHead className="text-[#8e8e8e]">包装</TableHead>
                                            <TableHead className="text-[#8e8e8e]">总成本</TableHead>
                                            <TableHead className="text-[#8e8e8e]">状态</TableHead>
                                            <TableHead className="text-[#8e8e8e] text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {list.map((item) => (
                                            <SortableRow key={item.id} id={item.id}>
                                                <TableCell className="font-medium text-white">
                                                    {item.code}
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    <PermissionGate
                                                        permission="finished-product:update"
                                                        fallback={<span>{item.name}</span>}
                                                    >
                                                        <EditableCell
                                                            value={item.name}
                                                            onSave={(newValue) => handleUpdateName(item.id, newValue)}
                                                            placeholder="成品名称"
                                                            maxLength={100}
                                                        />
                                                    </PermissionGate>
                                                </TableCell>
                                                <TableCell className="text-[#8e8e8e]">
                                                    {item.product?.name || '-'}
                                                </TableCell>
                                                <TableCell className="text-[#8e8e8e]">
                                                    {item.supplierProduct?.supplier?.name || '-'}
                                                </TableCell>
                                                <TableCell className="text-[#8e8e8e]">
                                                    <DictTag
                                                        typeCode="package_type"
                                                        value={item.packageType}
                                                    />
                                                    <span className="ml-1">
                                                        {item.packageQuantity}{item.packageUnit}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-white font-medium">
                                                    {formatCost(item.totalCost)}
                                                </TableCell>
                                                <TableCell>
                                                    <DictTag
                                                        typeCode="finished_product_status"
                                                        value={item.status}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <PermissionGate permission="finished-product:recalculate">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleRecalculate(item)}
                                                                disabled={recalculating === item.id}
                                                                className="h-8 w-8 text-[#8e8e8e] hover:text-[#409fff] hover:bg-[#363636]"
                                                                title="重算成本"
                                                            >
                                                                <RefreshCw
                                                                    className={`w-4 h-4 ${
                                                                        recalculating === item.id ? 'animate-spin' : ''
                                                                    }`}
                                                                />
                                                            </Button>
                                                        </PermissionGate>
                                                        <PermissionGate permission="finished-product:update">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(item)}
                                                                className="h-8 w-8 text-[#8e8e8e] hover:text-white hover:bg-[#363636]"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        </PermissionGate>
                                                        <PermissionGate permission="finished-product:delete">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete(item)}
                                                                className="h-8 w-8 text-[#8e8e8e] hover:text-red-400 hover:bg-red-500/10"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </PermissionGate>
                                                    </div>
                                                </TableCell>
                                            </SortableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </SortableContext>
                        </DndContext>
                    )}

                    {!loading && list.length > 0 && (
                        <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#1e1e1e]">
                            <div className="flex items-center gap-4">
                                <div className="text-sm text-[#8e8e8e]">
                                    共 {total} 条记录，第 {page} / {totalPages} 页
                                </div>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(v) => handlePageSizeChange(Number(v))}
                                >
                                    <SelectTrigger className="w-24 h-8 bg-[#1e1e1e] border-[#1e1e1e] text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-[#262626] border-[#1e1e1e] text-white">
                                        <SelectItem value="20">20 条/页</SelectItem>
                                        <SelectItem value="50">50 条/页</SelectItem>
                                        <SelectItem value="100">100 条/页</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(page - 1)}
                                    disabled={page === 1}
                                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white hover:bg-[#363636] disabled:opacity-50"
                                >
                                    上一页
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(page + 1)}
                                    disabled={page >= totalPages}
                                    className="bg-[#1e1e1e] border-[#1e1e1e] text-white hover:bg-[#363636] disabled:opacity-50"
                                >
                                    下一页
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="bg-[#262626] border-[#1e1e1e] text-white sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? '编辑成品' : '新增成品'}
                        </DialogTitle>
                    </DialogHeader>
                    <FinishedProductForm
                        finishedProduct={editing}
                        onSuccess={handleSuccess}
                        onCancel={() => setDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

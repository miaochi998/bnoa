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
    Plus, Search, Edit, Trash2, FlaskConical, DollarSign, GripVertical,
} from 'lucide-react';
import { ConsumableForm } from './components/ConsumableForm';
import { PermissionGate } from '@/components/PermissionGate';
import { EditableCell } from '@/components/shared/EditableCell';
import { ConsumablePriceDialog } from './components/ConsumablePriceDialog';
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

interface Consumable {
    id: string;
    code: string;
    name: string;
    category: string;
    specDesc?: string;
    status: string;
    remark?: string;
    prices?: { unitPrice: number; isCurrent: boolean; supplier?: { name: string } }[];
    createdAt: string;
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

export default function ConsumablesPage() {
    const [list, setList] = useState<Consumable[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const debouncedKeyword = useDebouncedValue(keyword, 300);
    const [category, setCategory] = useState('all');
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Consumable | null>(null);

    const [priceDialogOpen, setPriceDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Consumable | null>(null);
    const [sorting, setSorting] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await apiClient.getConsumables({
                keyword: keyword || undefined,
                category: category === 'all' ? undefined : category,
                status: status === 'all' ? undefined : status,
                page,
                pageSize,
            });
            setList(data.list || []);
            setTotal(data.pagination?.total || 0);
        } catch (error) {
            console.error('加载耗材列表失败:', error);
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
    }, [debouncedKeyword, category, status]);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(1);
    };

    const handleCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const handleEdit = (item: Consumable) => {
        setEditing(item);
        setDialogOpen(true);
    };

    const handleDelete = async (item: Consumable) => {
        if (!confirm(`确定要删除耗材 "${item.name}" 吗？`)) return;
        try {
            await apiClient.deleteConsumable(item.id);
            alert('删除成功');
            loadData();
        } catch (error: any) {
            alert('删除失败: ' + (error.message || '请稍后重试'));
        }
    };

    const handleManagePrice = (item: Consumable) => {
        setSelectedItem(item);
        setPriceDialogOpen(true);
    };

    const handleSuccess = () => {
        setDialogOpen(false);
        setEditing(null);
        loadData();
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
                await apiClient.reorderConsumables(ids);
            } catch (error) {
                console.error('保存排序失败:', error);
                loadData();
            } finally {
                setSorting(false);
            }
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    // 更新耗材字段
    const handleUpdateField = async (id: string, field: 'name' | 'specDesc', newValue: string) => {
        try {
            await apiClient.updateConsumable(id, { [field]: newValue });
            // 更新本地列表
            setList(prev => prev.map(item =>
                item.id === id ? { ...item, [field]: newValue } : item
            ));
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };


    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        耗材管理
                    </h1>
                    <p className="text-[#8e8e8e] mt-1">
                        管理耗材信息和价格记录
                    </p>
                </div>
                <PermissionGate permission="consumable:create">
                    <Button
                        onClick={handleCreate}
                        className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        新增耗材
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
                                placeholder="搜索耗材名称、编码..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="pl-10 bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                            />
                        </div>
                        <DictSelect
                            typeCode="consumable_category"
                            value={category}
                            onChange={setCategory}
                            showAll
                            allLabel="全部分类"
                            allValue="all"
                            className="w-[140px] bg-[#1e1e1e] border-[#1e1e1e] text-white"
                        />
                        <DictSelect
                            typeCode="consumable_status"
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
                        耗材列表
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-[#8e8e8e]">加载中...</div>
                        </div>
                    ) : list.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12">
                            <FlaskConical className="w-8 h-8 text-[#8e8e8e]" />
                            <p className="text-[#8e8e8e]">暂无耗材数据</p>
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
                                            <TableHead className="text-[#8e8e8e]">分类</TableHead>
                                            <TableHead className="text-[#8e8e8e]">规格</TableHead>
                                            <TableHead className="text-[#8e8e8e]">当前价格</TableHead>
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
                                                        permission="consumable:update"
                                                        fallback={<span>{item.name}</span>}
                                                    >
                                                        <EditableCell
                                                            value={item.name}
                                                            onSave={(newValue) => handleUpdateField(item.id, 'name', newValue)}
                                                            placeholder="耗材名称"
                                                            maxLength={100}
                                                        />
                                                    </PermissionGate>
                                                </TableCell>
                                                <TableCell>
                                                    <DictTag
                                                        typeCode="consumable_category"
                                                        value={item.category}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-[#8e8e8e]">
                                                    <PermissionGate
                                                        permission="consumable:update"
                                                        fallback={<span>{item.specDesc || '-'}</span>}
                                                    >
                                                        <EditableCell
                                                            value={item.specDesc}
                                                            onSave={(newValue) => handleUpdateField(item.id, 'specDesc', newValue)}
                                                            placeholder="规格描述"
                                                            maxLength={200}
                                                        />
                                                    </PermissionGate>
                                                </TableCell>
                                                <TableCell className="text-white">
                                                    {item.prices?.[0]
                                                        ? `¥${Number(item.prices[0].unitPrice).toFixed(3)}`
                                                        : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <DictTag
                                                        typeCode="consumable_status"
                                                        value={item.status}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <PermissionGate permission="consumable:price">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleManagePrice(item)}
                                                                className="h-8 w-8 text-[#8e8e8e] hover:text-[#409fff] hover:bg-[#363636]"
                                                                title="价格管理"
                                                            >
                                                                <DollarSign className="w-4 h-4" />
                                                            </Button>
                                                        </PermissionGate>
                                                        <PermissionGate permission="consumable:update">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(item)}
                                                                className="h-8 w-8 text-[#8e8e8e] hover:text-white hover:bg-[#363636]"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        </PermissionGate>
                                                        <PermissionGate permission="consumable:delete">
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

                    {sorting && (
                        <div className="text-sm text-[#8e8e8e] mt-2">保存排序中...</div>
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
                <DialogContent className="bg-[#262626] border-[#1e1e1e] text-white max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editing ? '编辑耗材' : '新增耗材'}
                        </DialogTitle>
                    </DialogHeader>
                    <ConsumableForm
                        consumable={editing}
                        onSuccess={handleSuccess}
                        onCancel={() => setDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
                <DialogContent className="bg-[#262626] border-[#1e1e1e] text-white sm:max-w-5xl overflow-hidden">
                    <DialogHeader>
                        <DialogTitle>价格管理</DialogTitle>
                    </DialogHeader>
                    {selectedItem && (
                        <ConsumablePriceDialog
                            consumableId={selectedItem.id}
                            consumableName={selectedItem.name}
                            onClose={() => setPriceDialogOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

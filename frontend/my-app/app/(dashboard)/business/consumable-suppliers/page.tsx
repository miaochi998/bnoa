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
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';
import { Plus, Search, Edit, Trash2, Building2, GripVertical } from 'lucide-react';
import { ConsumableSupplierForm } from './components/ConsumableSupplierForm';
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
            className="border-[#1e1e1e] hover:bg-[#2a2a2a]"
        >
            <TableCell className="w-10 px-2">
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

interface ConsumableSupplier {
    id: string;
    code: string;
    name: string;
    contact?: string;
    phone?: string;
    status: string;
    remark?: string;
    createdAt: string;
}

export default function ConsumableSuppliersPage() {
    const [list, setList] = useState<ConsumableSupplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const debouncedKeyword = useDebouncedValue(keyword, 300);
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [saving, setSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(1);
    };

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<ConsumableSupplier | null>(null);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = list.findIndex((item) => item.id === active.id);
            const newIndex = list.findIndex((item) => item.id === over.id);
            const newList = arrayMove(list, oldIndex, newIndex);
            setList(newList);

            setSaving(true);
            try {
                const ids = newList.map((item) => item.id);
                await apiClient.reorderConsumableSuppliers(ids);
            } catch (error) {
                console.error('保存排序失败:', error);
                loadData();
            } finally {
                setSaving(false);
            }
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await apiClient.getConsumableSuppliers({
                keyword: keyword || undefined,
                status: status === 'all' ? undefined : status,
                page,
                pageSize,
            });
            setList(data.list || []);
            setTotal(data.pagination?.total || 0);
        } catch (error) {
            console.error('加载耗材供应商失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const isFirstRender = useRef(true);
    useEffect(() => { loadData(); }, [page]);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setPage(1);
        loadData();
    }, [debouncedKeyword, status]);

    const handleCreate = () => {
        setEditing(null);
        setDialogOpen(true);
    };

    const handleEdit = (item: ConsumableSupplier) => {
        setEditing(item);
        setDialogOpen(true);
    };

    const handleDelete = async (item: ConsumableSupplier) => {
        if (!confirm(`确定要删除供应商 "${item.name}" 吗？`)) return;
        try {
            await apiClient.deleteConsumableSupplier(item.id);
            alert('删除成功');
            loadData();
        } catch (error: any) {
            alert('删除失败: ' + (error.message || '请稍后重试'));
        }
    };

    const handleSuccess = () => {
        setDialogOpen(false);
        setEditing(null);
        loadData();
    };

    const getStatusText = (s: string) =>
        s === 'ACTIVE' ? '合作中' : '已终止';

    const getStatusClass = (s: string) =>
        s === 'ACTIVE'
            ? 'bg-green-500/20 text-green-400'
            : 'bg-gray-500/20 text-gray-400';

    // 更新耗材供应商字段
    const handleUpdateField = async (id: string, field: 'name' | 'contact' | 'phone' | 'remark', newValue: string) => {
        try {
            await apiClient.updateConsumableSupplier(id, { [field]: newValue || null });
            // 更新本地列表
            setList(prev => prev.map(item =>
                item.id === id ? { ...item, [field]: newValue || null } : item
            ));
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        耗材供应商
                    </h1>
                    <p className="text-[#8e8e8e] mt-1">
                        管理耗材供应商信息
                    </p>
                </div>
                <PermissionGate permission="consumable-supplier:create">
                    <Button
                        onClick={handleCreate}
                        className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        新增供应商
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
                                placeholder="搜索供应商名称、编码..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="pl-10 bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                            />
                        </div>
                        <Select value={status} onValueChange={setStatus}>
                            <SelectTrigger
                                className="w-[140px] bg-[#1e1e1e] border-[#1e1e1e] text-white"
                            >
                                <SelectValue placeholder="状态" />
                            </SelectTrigger>
                            <SelectContent
                                className="bg-[#2e2e2e] border-[#1e1e1e]"
                            >
                                <SelectItem value="all" className="text-white">
                                    全部状态
                                </SelectItem>
                                <SelectItem value="ACTIVE" className="text-white">
                                    合作中
                                </SelectItem>
                                <SelectItem value="INACTIVE" className="text-white">
                                    已终止
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-[#262626] border-[#1e1e1e]">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg text-white">
                        供应商列表
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-[#8e8e8e]">加载中...</div>
                        </div>
                    ) : list.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12">
                            <Building2 className="w-8 h-8 text-[#8e8e8e]" />
                            <p className="text-[#8e8e8e]">暂无供应商数据</p>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={list.map((item) => item.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-[#1e1e1e] hover:bg-transparent">
                                            <TableHead className="text-[#8e8e8e] w-10">拖拽</TableHead>
                                            <TableHead className="text-[#8e8e8e]">编码</TableHead>
                                            <TableHead className="text-[#8e8e8e]">名称</TableHead>
                                            <TableHead className="text-[#8e8e8e]">联系人</TableHead>
                                            <TableHead className="text-[#8e8e8e]">联系电话</TableHead>
                                            <TableHead className="text-[#8e8e8e]">状态</TableHead>
                                            <TableHead className="text-[#8e8e8e]">备注</TableHead>
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
                                                        permission="consumable-supplier:update"
                                                        fallback={<span>{item.name}</span>}
                                                    >
                                                        <EditableCell
                                                            value={item.name}
                                                            onSave={(newValue) => handleUpdateField(item.id, 'name', newValue)}
                                                            placeholder="供应商名称"
                                                            maxLength={100}
                                                        />
                                                    </PermissionGate>
                                                </TableCell>
                                                <TableCell className="text-[#8e8e8e]">
                                                    <PermissionGate
                                                        permission="consumable-supplier:update"
                                                        fallback={<span>{item.contact || '-'}</span>}
                                                    >
                                                        <EditableCell
                                                            value={item.contact}
                                                            onSave={(newValue) => handleUpdateField(item.id, 'contact', newValue)}
                                                            placeholder="联系人"
                                                            maxLength={50}
                                                        />
                                                    </PermissionGate>
                                                </TableCell>
                                                <TableCell className="text-[#8e8e8e]">
                                                    <PermissionGate
                                                        permission="consumable-supplier:update"
                                                        fallback={<span>{item.phone || '-'}</span>}
                                                    >
                                                        <EditableCell
                                                            value={item.phone}
                                                            onSave={(newValue) => handleUpdateField(item.id, 'phone', newValue)}
                                                            placeholder="联系电话"
                                                            type="tel"
                                                            maxLength={20}
                                                        />
                                                    </PermissionGate>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded text-xs ${getStatusClass(item.status)}`}>
                                                        {getStatusText(item.status)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-[#8e8e8e]">
                                                    <PermissionGate
                                                        permission="consumable-supplier:update"
                                                        fallback={<span>{item.remark || '-'}</span>}
                                                    >
                                                        <EditableCell
                                                            value={item.remark}
                                                            onSave={(newValue) => handleUpdateField(item.id, 'remark', newValue)}
                                                            placeholder="备注"
                                                            maxLength={200}
                                                        />
                                                    </PermissionGate>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <PermissionGate permission="consumable-supplier:update">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleEdit(item)}
                                                                className="h-8 w-8 text-[#8e8e8e] hover:text-white hover:bg-[#363636]"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        </PermissionGate>
                                                        <PermissionGate permission="consumable-supplier:delete">
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

                    {saving && (
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
                            {editing ? '编辑供应商' : '新增供应商'}
                        </DialogTitle>
                    </DialogHeader>
                    <ConsumableSupplierForm
                        supplier={editing}
                        onSuccess={handleSuccess}
                        onCancel={() => setDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

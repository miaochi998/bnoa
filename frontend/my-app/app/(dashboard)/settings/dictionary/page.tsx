'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import {
    BookOpen,
    Plus,
    Edit,
    Trash2,
    Loader2,
    Palette,
} from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';

interface DictType {
    typeCode: string;
    typeName: string;
    count: number;
}

interface DictItem {
    id: string;
    typeCode: string;
    typeName: string;
    itemCode: string;
    itemName: string;
    itemValue: string;
    sortOrder: number;
    isDefault: boolean;
    isActive: boolean;
    color: string | null;
    icon: string | null;
    description: string | null;
}

const defaultForm = {
    typeCode: '',
    typeName: '',
    itemCode: '',
    itemName: '',
    itemValue: '',
    color: '#409fff',
    sortOrder: 0,
    description: '',
};

export default function DictionaryPage() {
    const [types, setTypes] = useState<DictType[]>([]);
    const [items, setItems] = useState<DictItem[]>([]);
    const [selectedType, setSelectedType] =
        useState<string>('');
    const [loading, setLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);

    // 表单状态
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] =
        useState<DictItem | null>(null);
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);

    // 删除确认
    const [deleteDialogOpen, setDeleteDialogOpen] =
        useState(false);
    const [itemToDelete, setItemToDelete] =
        useState<DictItem | null>(null);

    const fetchTypes = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiClient.getDictTypes();
            setTypes(data);
            if (data.length > 0 && !selectedType) {
                setSelectedType(data[0].typeCode);
            }
        } catch (error) {
            console.error('获取字典类型失败:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchItems = useCallback(
        async (typeCode: string) => {
            if (!typeCode) return;
            try {
                setItemsLoading(true);
                const data =
                    await apiClient.getDictItems(typeCode);
                setItems(data);
            } catch (error) {
                console.error('获取字典条目失败:', error);
            } finally {
                setItemsLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        fetchTypes();
    }, [fetchTypes]);

    useEffect(() => {
        if (selectedType) {
            fetchItems(selectedType);
        }
    }, [selectedType, fetchItems]);

    const handleAdd = () => {
        const currentType = types.find(
            (t) => t.typeCode === selectedType,
        );
        setEditingItem(null);
        setForm({
            ...defaultForm,
            typeCode: selectedType,
            typeName: currentType?.typeName || '',
            sortOrder: items.length,
        });
        setDialogOpen(true);
    };

    const handleEdit = (item: DictItem) => {
        setEditingItem(item);
        setForm({
            typeCode: item.typeCode,
            typeName: item.typeName,
            itemCode: item.itemCode,
            itemName: item.itemName,
            itemValue: item.itemValue,
            color: item.color || '#409fff',
            sortOrder: item.sortOrder,
            description: item.description || '',
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            if (editingItem) {
                await apiClient.updateDictItem(
                    editingItem.id,
                    {
                        itemName: form.itemName,
                        itemValue: form.itemValue,
                        color: form.color,
                        sortOrder: form.sortOrder,
                        description:
                            form.description || null,
                    },
                );
            } else {
                await apiClient.createDictItem(form);
            }
            setDialogOpen(false);
            fetchItems(selectedType);
            fetchTypes();
        } catch (error: any) {
            alert(error.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        try {
            await apiClient.deleteDictItem(
                itemToDelete.id,
            );
            setDeleteDialogOpen(false);
            setItemToDelete(null);
            fetchItems(selectedType);
            fetchTypes();
        } catch (error: any) {
            alert(error.message || '删除失败');
        }
    };

    const handleToggle = async (item: DictItem) => {
        try {
            await apiClient.toggleDictItem(item.id);
            fetchItems(selectedType);
        } catch (error: any) {
            alert(error.message || '操作失败');
        }
    };

    const currentType = types.find(
        (t) => t.typeCode === selectedType,
    );

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">
                        数据字典
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        管理系统中的枚举值和配置项
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* 左侧：字典类型列表 */}
                <div className="col-span-3">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">
                                字典类型
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <div className="space-y-0.5 px-2 pb-2">
                                    {types.map((t) => (
                                        <button
                                            key={
                                                t.typeCode
                                            }
                                            onClick={() =>
                                                setSelectedType(
                                                    t.typeCode,
                                                )
                                            }
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                                                selectedType ===
                                                t.typeCode
                                                    ? 'bg-primary/10 text-primary font-medium'
                                                    : 'text-muted-foreground hover:bg-card-hover hover:text-foreground'
                                            }`}
                                        >
                                            <span>
                                                {
                                                    t.typeName
                                                }
                                            </span>
                                            <span className="text-xs opacity-60">
                                                {t.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* 右侧：条目列表 */}
                <div className="col-span-9">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <CardTitle className="text-sm font-medium">
                                {currentType
                                    ? `${currentType.typeName}（${selectedType}）`
                                    : '请选择字典类型'}
                            </CardTitle>
                            {selectedType && (
                                <PermissionGate permission="dictionary:create">
                                    <Button
                                        size="sm"
                                        onClick={handleAdd}
                                    >
                                        <Plus className="w-4 h-4 mr-1" />
                                        新增条目
                                    </Button>
                                </PermissionGate>
                            )}
                        </CardHeader>
                        <CardContent>
                            {itemsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : items.length === 0 ? (
                                <div className="text-center text-muted-foreground py-12 text-sm">
                                    暂无条目
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">
                                                序号
                                            </TableHead>
                                            <TableHead>
                                                编码
                                            </TableHead>
                                            <TableHead>
                                                名称
                                            </TableHead>
                                            <TableHead>
                                                值
                                            </TableHead>
                                            <TableHead className="w-20">
                                                颜色
                                            </TableHead>
                                            <TableHead className="w-20">
                                                状态
                                            </TableHead>
                                            <TableHead className="w-28 text-right">
                                                操作
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map(
                                            (item) => (
                                                <TableRow
                                                    key={
                                                        item.id
                                                    }
                                                >
                                                    <TableCell className="text-muted-foreground">
                                                        {
                                                            item.sortOrder
                                                        }
                                                    </TableCell>
                                                    <TableCell>
                                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                            {
                                                                item.itemCode
                                                            }
                                                        </code>
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        {
                                                            item.itemName
                                                        }
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {
                                                            item.itemValue
                                                        }
                                                    </TableCell>
                                                    <TableCell>
                                                        {item.color && (
                                                            <div className="flex items-center gap-2">
                                                                <span
                                                                    className="w-4 h-4 rounded-full border border-border"
                                                                    style={{
                                                                        backgroundColor:
                                                                            item.color,
                                                                    }}
                                                                />
                                                                <span className="text-xs text-muted-foreground">
                                                                    {
                                                                        item.color
                                                                    }
                                                                </span>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Switch
                                                            checked={
                                                                item.isActive
                                                            }
                                                            onCheckedChange={() =>
                                                                handleToggle(
                                                                    item,
                                                                )
                                                            }
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <PermissionGate permission="dictionary:update">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() =>
                                                                        handleEdit(
                                                                            item,
                                                                        )
                                                                    }
                                                                >
                                                                    <Edit className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </PermissionGate>
                                                            <PermissionGate permission="dictionary:delete">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                                                    onClick={() => {
                                                                        setItemToDelete(
                                                                            item,
                                                                        );
                                                                        setDeleteDialogOpen(
                                                                            true,
                                                                        );
                                                                    }}
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </PermissionGate>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ),
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* 新增/编辑对话框 */}
            <Dialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {editingItem
                                ? '编辑字典条目'
                                : '新增字典条目'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {!editingItem && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>
                                            类型编码
                                        </Label>
                                        <Input
                                            value={
                                                form.typeCode
                                            }
                                            onChange={(
                                                e,
                                            ) =>
                                                setForm({
                                                    ...form,
                                                    typeCode:
                                                        e
                                                            .target
                                                            .value,
                                                })
                                            }
                                            placeholder="如 user_status"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>
                                            类型名称
                                        </Label>
                                        <Input
                                            value={
                                                form.typeName
                                            }
                                            onChange={(
                                                e,
                                            ) =>
                                                setForm({
                                                    ...form,
                                                    typeName:
                                                        e
                                                            .target
                                                            .value,
                                                })
                                            }
                                            placeholder="如 用户状态"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>条目编码</Label>
                                    <Input
                                        value={
                                            form.itemCode
                                        }
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                itemCode:
                                                    e.target
                                                        .value,
                                            })
                                        }
                                        placeholder="如 ACTIVE"
                                    />
                                </div>
                            </>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>条目名称</Label>
                                <Input
                                    value={form.itemName}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            itemName:
                                                e.target
                                                    .value,
                                        })
                                    }
                                    placeholder="如 正常"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>条目值</Label>
                                <Input
                                    value={form.itemValue}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            itemValue:
                                                e.target
                                                    .value,
                                        })
                                    }
                                    placeholder="如 ACTIVE"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                    <Palette className="w-3.5 h-3.5" />
                                    颜色
                                </Label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={form.color}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                color: e
                                                    .target
                                                    .value,
                                            })
                                        }
                                        className="w-8 h-8 rounded border border-border cursor-pointer"
                                    />
                                    <Input
                                        value={form.color}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                color: e
                                                    .target
                                                    .value,
                                            })
                                        }
                                        className="flex-1"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>排序号</Label>
                                <Input
                                    type="number"
                                    value={form.sortOrder}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            sortOrder:
                                                parseInt(
                                                    e.target
                                                        .value,
                                                ) || 0,
                                        })
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>描述（可选）</Label>
                            <Input
                                value={form.description}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        description:
                                            e.target.value,
                                    })
                                }
                                placeholder="条目描述"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() =>
                                setDialogOpen(false)
                            }
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving && (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            )}
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 删除确认 */}
            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            确认删除
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除字典条目「
                            {itemToDelete?.itemName}」吗？
                            此操作不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive hover:bg-destructive/90"
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { apiClient } from '@/lib/api';
import { PermissionGate } from '@/components/PermissionGate';
import { usePermissionStore } from '@/lib/stores/permission-store';
import { EditableCell } from '@/components/shared/EditableCell';
import { EditableSelectCell } from '@/components/shared/EditableSelectCell';
import { EditableSwitchCell } from '@/components/shared/EditableSwitchCell';
import { SortableTable } from '@/components/shared/SortableTable';
import {
    Store,
    Plus,
    Edit,
    Trash2,
    Loader2,
    Search,
    Tag,
    X,
} from 'lucide-react';

interface Shop {
    id: string;
    name: string;
    platformId: string;
    platform?: {
        id: string;
        name: string;
        code: string;
    };
    status: string;
    managerId: string;
    manager?: {
        id: string;
        name: string;
        username: string;
    };
    remark: string | null;
    createdAt: string;
    updatedAt: string;
}

interface Platform {
    id: string;
    name: string;
    code: string;
}

interface User {
    id: string;
    name: string;
    username: string;
}

// 列表用的列宽模板（表头与每行一致，保证对齐）
const LIST_GRID = 'grid-cols-[minmax(0,1.2fr)_150px_180px_120px_minmax(0,1fr)_140px]';

const defaultForm = {
    name: '',
    platformId: '',
    managerId: '',
    status: 'ACTIVE',
    remark: '',
};

export default function ShopPage() {
    const [shops, setShops] = useState<Shop[]>([]);
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [platformFilter, setPlatformFilter] = useState('');

    // 排序状态
    const [sorting, setSorting] = useState(false);

    // 表单状态
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingShop, setEditingShop] = useState<Shop | null>(null);
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);

    // 删除确认
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [shopToDelete, setShopToDelete] = useState<Shop | null>(null);

    // 别名管理
    const [aliasDialogOpen, setAliasDialogOpen] = useState(false);
    const [aliasShop, setAliasShop] = useState<Shop | null>(null);
    const [aliases, setAliases] = useState<{ id: string; alias: string }[]>([]);
    const [newAlias, setNewAlias] = useState('');
    const [aliasLoading, setAliasLoading] = useState(false);

    // 是否有店铺更新权限（决定内联编辑/开关/拖拽是否可交互）
    const canUpdate = usePermissionStore((s) => s.hasPermission('shop:update'));

    const platformOptions = platforms.map((p) => ({ label: p.name, value: p.id }));
    const userOptions = users.map((u) => ({ label: `${u.name} (${u.username})`, value: u.id }));

    const fetchShops = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiClient.getShops({
                keyword,
                platformId: platformFilter === 'all' ? undefined : platformFilter,
                pageSize: 999,
            });
            setShops(data.list || []);
        } catch (error) {
            console.error('获取店铺列表失败:', error);
        } finally {
            setLoading(false);
        }
    }, [keyword, platformFilter]);

    const fetchPlatforms = useCallback(async () => {
        try {
            const data = await apiClient.getActivePlatforms();
            setPlatforms(data || []);
        } catch (error) {
            console.error('获取平台列表失败:', error);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const data = await apiClient.getUsers({}, { page: 1, pageSize: 1000 });
            setUsers(data.nodes || []);
        } catch (error) {
            console.error('获取用户列表失败:', error);
        }
    }, []);

    useEffect(() => {
        fetchShops();
    }, [fetchShops]);

    useEffect(() => {
        fetchPlatforms();
        fetchUsers();
    }, [fetchPlatforms, fetchUsers]);

    const handleAdd = () => {
        setEditingShop(null);
        setForm(defaultForm);
        setDialogOpen(true);
    };

    const handleEdit = (shop: Shop) => {
        setEditingShop(shop);
        setForm({
            name: shop.name,
            platformId: shop.platformId,
            managerId: shop.managerId,
            status: shop.status,
            remark: shop.remark || '',
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            if (editingShop) {
                await apiClient.updateShop(editingShop.id, form);
            } else {
                await apiClient.createShop(form);
            }
            setDialogOpen(false);
            fetchShops();
        } catch (error: any) {
            alert(error.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!shopToDelete) return;
        try {
            await apiClient.deleteShop(shopToDelete.id);
            setDeleteDialogOpen(false);
            setShopToDelete(null);
            fetchShops();
        } catch (error: any) {
            alert(error.message || '删除失败');
        }
    };

    const openAliasDialog = async (shop: Shop) => {
        setAliasShop(shop);
        setNewAlias('');
        setAliasDialogOpen(true);
        setAliasLoading(true);
        try {
            const data = await apiClient.getShopAliases(shop.id);
            setAliases(data || []);
        } catch {
            setAliases([]);
        } finally {
            setAliasLoading(false);
        }
    };

    const handleAddAlias = async () => {
        if (!aliasShop || !newAlias.trim()) return;
        try {
            await apiClient.addShopAlias(aliasShop.id, newAlias.trim());
            setNewAlias('');
            const data = await apiClient.getShopAliases(aliasShop.id);
            setAliases(data || []);
        } catch (error: any) {
            alert(error.message || '添加别名失败');
        }
    };

    const handleRemoveAlias = async (aliasId: string) => {
        if (!aliasShop) return;
        try {
            await apiClient.removeShopAlias(aliasShop.id, aliasId);
            const data = await apiClient.getShopAliases(aliasShop.id);
            setAliases(data || []);
        } catch (error: any) {
            alert(error.message || '删除别名失败');
        }
    };

    // 列表内联编辑字段
    const handleUpdateField = async (
        id: string,
        field: 'name' | 'platformId' | 'managerId' | 'status' | 'remark',
        newValue: string,
    ) => {
        try {
            // 备注为空时清空为 null
            const finalValue = field === 'remark' ? (newValue || null) : newValue;
            const payload = { [field]: finalValue } as {
                name?: string;
                platformId?: string;
                managerId?: string;
                status?: string;
                remark?: string;
            };
            await apiClient.updateShop(id, payload);
            setShops((prev) =>
                prev.map((item) =>
                    item.id === id ? ({ ...item, [field]: finalValue } as Shop) : item,
                ),
            );
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };

    // 拖拽排序持久化
    const handleReorder = async (newItems: Shop[]) => {
        setShops(newItems);
        setSorting(true);
        try {
            await apiClient.reorderShops(newItems.map((item) => item.id));
        } catch (error) {
            console.error('保存排序失败:', error);
            fetchShops();
        } finally {
            setSorting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Store className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">店铺管理</h1>
                    <p className="text-sm text-muted-foreground">
                        管理各平台下的店铺信息
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium">店铺列表</CardTitle>
                    <PermissionGate permission="shop:create">
                        <Button onClick={handleAdd} size="sm">
                            <Plus className="w-4 h-4 mr-1" />
                            新建店铺
                        </Button>
                    </PermissionGate>
                </CardHeader>
                <CardContent>
                    {/* 搜索栏 */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索店铺名称..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select
                            value={platformFilter}
                            onValueChange={setPlatformFilter}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="筛选平台" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部平台</SelectItem>
                                {platforms.map((platform) => (
                                    <SelectItem key={platform.id} value={platform.id}>
                                        {platform.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 表格：内联编辑 + 拖拽排序 */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : shops.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            暂无数据
                        </div>
                    ) : (
                        <div>
                            {/* 表头（与 SortableRow 的拖拽手柄占位对齐） */}
                            <div className="flex items-center border-b border-[#1e1e1e]">
                                <div className={canUpdate ? 'w-[32px] shrink-0' : 'hidden'} />
                                <div className={`flex-1 grid ${LIST_GRID} gap-x-4 px-2 py-2 text-xs font-medium text-muted-foreground`}>
                                    <div>店铺名称</div>
                                    <div>所属平台</div>
                                    <div>负责人（用户）</div>
                                    <div>状态</div>
                                    <div>备注</div>
                                    <div className="text-right">操作</div>
                                </div>
                            </div>

                            <SortableTable
                                items={shops}
                                onItemsChange={handleReorder}
                                getId={(item) => item.id}
                                disabled={!canUpdate}
                                className="divide-y divide-[#1e1e1e]"
                            >
                                {(item, isDragging) => (
                                    <div
                                        className={`flex-1 grid ${LIST_GRID} gap-x-4 px-2 items-center py-2 ${
                                            isDragging ? 'bg-[#2e2e2e]' : ''
                                        }`}
                                    >
                                        <div className="min-w-0 font-medium">
                                            <PermissionGate
                                                permission="shop:update"
                                                fallback={<span>{item.name || '-'}</span>}
                                            >
                                                <EditableCell
                                                    value={item.name}
                                                    onSave={(v) => handleUpdateField(item.id, 'name', v)}
                                                    placeholder="店铺名称"
                                                    maxLength={100}
                                                />
                                            </PermissionGate>
                                        </div>
                                        <div className="min-w-0">
                                            <PermissionGate
                                                permission="shop:update"
                                                fallback={<span>{item.platform?.name || '-'}</span>}
                                            >
                                                <EditableSelectCell
                                                    value={item.platformId}
                                                    options={platformOptions}
                                                    onSave={(v) => handleUpdateField(item.id, 'platformId', v)}
                                                    placeholder="选择平台"
                                                />
                                            </PermissionGate>
                                        </div>
                                        <div className="min-w-0">
                                            <PermissionGate
                                                permission="shop:update"
                                                fallback={
                                                    <span>
                                                        {item.manager
                                                            ? `${item.manager.name} (${item.manager.username})`
                                                            : '-'}
                                                    </span>
                                                }
                                            >
                                                <EditableSelectCell
                                                    value={item.managerId}
                                                    options={userOptions}
                                                    onSave={(v) => handleUpdateField(item.id, 'managerId', v)}
                                                    placeholder="选择负责人"
                                                />
                                            </PermissionGate>
                                        </div>
                                        <div>
                                            <PermissionGate
                                                permission="shop:update"
                                                fallback={
                                                    <span className={item.status === 'ACTIVE' ? 'text-emerald-400' : 'text-gray-500'}>
                                                        {item.status === 'ACTIVE' ? '启用' : '停用'}
                                                    </span>
                                                }
                                            >
                                                <EditableSwitchCell
                                                    checked={item.status === 'ACTIVE'}
                                                    onSave={(checked) =>
                                                        handleUpdateField(item.id, 'status', checked ? 'ACTIVE' : 'INACTIVE')
                                                    }
                                                    activeLabel="启用"
                                                    inactiveLabel="停用"
                                                />
                                            </PermissionGate>
                                        </div>
                                        <div className="min-w-0 truncate text-muted-foreground">
                                            <PermissionGate
                                                permission="shop:update"
                                                fallback={<span>{item.remark || '-'}</span>}
                                            >
                                                <EditableCell
                                                    value={item.remark}
                                                    onSave={(v) => handleUpdateField(item.id, 'remark', v)}
                                                    placeholder="备注"
                                                    maxLength={200}
                                                />
                                            </PermissionGate>
                                        </div>
                                        <div className="flex items-center justify-end gap-1">
                                            <PermissionGate permission="shop:update">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(item)}
                                                    title="编辑"
                                                    className="h-8 w-8"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </PermissionGate>
                                            <PermissionGate permission="shop:update">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openAliasDialog(item)}
                                                    title="别名管理"
                                                    className="h-8 w-8"
                                                >
                                                    <Tag className="w-4 h-4" />
                                                </Button>
                                            </PermissionGate>
                                            <PermissionGate permission="shop:delete">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setShopToDelete(item);
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                    className="h-8 w-8 text-destructive"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </PermissionGate>
                                        </div>
                                    </div>
                                )}
                            </SortableTable>

                            {sorting && (
                                <div className="text-sm text-muted-foreground mt-2">保存排序中...</div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 新建/编辑对话框 */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingShop ? '编辑店铺' : '新建店铺'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>店铺名称 *</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="如：抖音旗舰店"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>所属平台 *</Label>
                            <Select
                                value={form.platformId}
                                onValueChange={(value) => setForm({ ...form, platformId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择平台" />
                                </SelectTrigger>
                                <SelectContent>
                                    {platforms.map((platform) => (
                                        <SelectItem key={platform.id} value={platform.id}>
                                            {platform.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>负责人（用户） *</Label>
                            <Select
                                value={form.managerId}
                                onValueChange={(value) => setForm({ ...form, managerId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="选择负责用户" />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.name} ({user.username})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">店铺归属到具体用户，一个用户可拥有多个店铺</p>
                        </div>
                        <div className="space-y-2">
                            <Label>店铺状态</Label>
                            <Select
                                value={form.status}
                                onValueChange={(value: any) => setForm({ ...form, status: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">经营中</SelectItem>
                                    <SelectItem value="REST">已停业</SelectItem>
                                    <SelectItem value="CLOSED">已关店</SelectItem>
                                    <SelectItem value="INACTIVE">停用</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>备注</Label>
                            <Input
                                value={form.remark}
                                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                                placeholder="其他说明（如开店时间、账号等）"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            取消
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 删除确认对话框 */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除店铺 &quot;{shopToDelete?.name}&quot; 吗？此操作不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShopToDelete(null)}>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 别名管理对话框 */}
            <Dialog open={aliasDialogOpen} onOpenChange={setAliasDialogOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>
                            别名管理 - {aliasShop?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        别名用于导入利润表时自动匹配Excel中的店铺名称
                    </p>
                    <div className="space-y-4 py-2">
                        {/* 已有别名 */}
                        {aliasLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : aliases.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                                暂无别名
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {aliases.map((a) => (
                                    <span
                                        key={a.id}
                                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-sm"
                                    >
                                        {a.alias}
                                        <button
                                            onClick={() => handleRemoveAlias(a.id)}
                                            className="ml-1 hover:text-destructive"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* 添加新别名 */}
                        <div className="flex items-center gap-2">
                            <Input
                                value={newAlias}
                                onChange={(e) => setNewAlias(e.target.value)}
                                placeholder="输入新别名，如：天猫店"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddAlias();
                                }}
                            />
                            <Button
                                size="sm"
                                onClick={handleAddAlias}
                                disabled={!newAlias.trim()}
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                添加
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

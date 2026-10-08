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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { usePermissionStore } from '@/lib/stores/permission-store';
import {
    Globe,
    Plus,
    Edit,
    Trash2,
    Loader2,
    Search,
    Settings,
    GripVertical,
} from 'lucide-react';
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
import { SimpleImageUploader } from '@/components/upload/SimpleImageUploader';
import { PlatformLogoConfigDialog } from '@/components/platforms/PlatformLogoConfigDialog';
import { PermissionGate } from '@/components/PermissionGate';
import { EditableCell } from '@/components/shared/EditableCell';
import { EditableSelectCell } from '@/components/shared/EditableSelectCell';
import { EditableSwitchCell } from '@/components/shared/EditableSwitchCell';

interface Platform {
    id: string;
    name: string;
    code: string;
    type: 'DOMESTIC' | 'CROSS_BORDER' | 'SOCIAL' | null;
    logo: string | null;
    website: string | null;
    status: 'ACTIVE' | 'INACTIVE';
    remark: string | null;
    createdAt: string;
    updatedAt: string;
}

// 平台类型选项（与新建/编辑表单 SelectItem 一致）
const platformTypeOptions = [
    { label: '国内电商', value: 'DOMESTIC' },
    { label: '跨境电商', value: 'CROSS_BORDER' },
    { label: '社交电商', value: 'SOCIAL' },
];

interface SortableRowProps {
    id: string;
    disabled?: boolean;
    children: React.ReactNode;
}

function SortableRow({ id, disabled = false, children }: SortableRowProps) {
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

    // 无更新权限时禁用拖拽（不绑定 listeners/attributes）
    const dragHandleProps = disabled ? {} : { ...attributes, ...listeners };

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className="border-[#1e1e1e]"
        >
            <TableCell className="w-10">
                <div
                    {...dragHandleProps}
                    className={
                        disabled
                            ? 'text-gray-600'
                            : 'cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300'
                    }
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            </TableCell>
            {children}
        </TableRow>
    );
}

const defaultForm = {
    name: '',
    code: '',
    type: 'DOMESTIC' as 'DOMESTIC' | 'CROSS_BORDER' | 'SOCIAL',
    logo: '',
    website: '',
    remark: '',
};

export default function PlatformPage() {
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [sorting, setSorting] = useState(false);

    // 表单状态
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
    const [form, setForm] = useState(defaultForm);
    const [saving, setSaving] = useState(false);

    // 删除确认
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [platformToDelete, setPlatformToDelete] = useState<Platform | null>(null);

    // 配置弹窗
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    // Logo配置
    const [logoConfig, setLogoConfig] = useState<{
        maxWidth: number;
        maxHeight: number;
        maxSize: number;
        formats: string[];
        realFolderId: string | null;
    } | null>(null);

    const canUpdate = usePermissionStore((s) => s.hasPermission('platform:update'));

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const fetchPlatforms = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiClient.getPlatforms({ keyword });
            setPlatforms(data.list || []);
        } catch (error) {
            console.error('获取平台列表失败:', error);
        } finally {
            setLoading(false);
        }
    }, [keyword]);

    useEffect(() => {
        fetchPlatforms();
    }, [fetchPlatforms]);

    // 获取Logo配置
    useEffect(() => {
        const fetchLogoConfig = async () => {
            try {
                const config = await apiClient.getPlatformLogoConfig();
                setLogoConfig(config);
            } catch (error) {
                console.error('获取Logo配置失败:', error);
            }
        };
        fetchLogoConfig();
    }, []);

    const handleAdd = () => {
        setEditingPlatform(null);
        setForm(defaultForm);
        setDialogOpen(true);
    };

    const handleEdit = (platform: Platform) => {
        setEditingPlatform(platform);
        setForm({
            name: platform.name,
            code: platform.code,
            type: platform.type || 'DOMESTIC',
            logo: platform.logo || '',
            website: platform.website || '',
            remark: platform.remark || '',
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            if (editingPlatform) {
                // 弹窗编辑框中的编码输入 disabled；code 已可直接在列表内联编辑（更新接口支持 code）
                const { code, ...updateData } = form;
                await apiClient.updatePlatform(editingPlatform.id, updateData);
            } else {
                await apiClient.createPlatform(form);
            }
            setDialogOpen(false);
            fetchPlatforms();
        } catch (error: any) {
            alert(error.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!platformToDelete) return;
        try {
            await apiClient.deletePlatform(platformToDelete.id);
            setDeleteDialogOpen(false);
            setPlatformToDelete(null);
            fetchPlatforms();
        } catch (error: any) {
            alert(error.message || '删除失败');
        }
    };

    // 行内更新文本字段（name/code/remark）
    const handleUpdateField = async (
        id: string,
        field: 'name' | 'code' | 'remark',
        newValue: string,
    ) => {
        try {
            await apiClient.updatePlatform(id, { [field]: newValue || null });
            setPlatforms((prev) =>
                prev.map((item) =>
                    item.id === id ? { ...item, [field]: newValue || null } : item,
                ),
            );
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };

    // 行内更新平台类型
    const handleUpdateType = async (id: string, newValue: string) => {
        try {
            await apiClient.updatePlatform(id, { type: newValue });
            setPlatforms((prev) =>
                prev.map((item) =>
                    item.id === id
                        ? { ...item, type: newValue as Platform['type'] }
                        : item,
                ),
            );
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };

    // 行内切换状态（启用/停用）
    const handleUpdateStatus = async (id: string, checked: boolean) => {
        const statusValue: 'ACTIVE' | 'INACTIVE' = checked ? 'ACTIVE' : 'INACTIVE';
        try {
            await apiClient.updatePlatform(id, { status: statusValue });
            setPlatforms((prev) =>
                prev.map((item) =>
                    item.id === id ? { ...item, status: statusValue } : item,
                ),
            );
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };

    // 拖拽排序（持久化）
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = platforms.findIndex((item) => item.id === active.id);
            const newIndex = platforms.findIndex((item) => item.id === over.id);
            const newList = arrayMove(platforms, oldIndex, newIndex);
            setPlatforms(newList);

            setSorting(true);
            try {
                const ids = newList.map((item) => item.id);
                await apiClient.reorderPlatforms(ids);
            } catch (error) {
                console.error('保存排序失败:', error);
                fetchPlatforms();
            } finally {
                setSorting(false);
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">平台管理</h1>
                    <p className="text-sm text-muted-foreground">
                        管理电商平台基础信息
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium">平台列表</CardTitle>
                    <div className="flex items-center gap-2">
                        <PermissionGate permission="platform:create">
                            <Button onClick={handleAdd} size="sm">
                                <Plus className="w-4 h-4 mr-1" />
                                新建平台
                            </Button>
                        </PermissionGate>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* 搜索栏 */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索平台名称或编码..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {/* 表格 */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={platforms.map((p) => p.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-10">拖拽</TableHead>
                                            <TableHead>平台名称</TableHead>
                                            <TableHead>平台编码</TableHead>
                                            <TableHead>平台类型</TableHead>
                                            <TableHead>状态</TableHead>
                                            <TableHead>官网</TableHead>
                                            <TableHead>备注</TableHead>
                                            <TableHead className="text-right">操作</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {platforms.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                    暂无数据
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            platforms.map((platform) => (
                                                <SortableRow
                                                    key={platform.id}
                                                    id={platform.id}
                                                    disabled={!canUpdate}
                                                >
                                                    <TableCell className="font-medium">
                                                        <EditableCell
                                                            value={platform.name}
                                                            onSave={(newValue) =>
                                                                handleUpdateField(platform.id, 'name', newValue)
                                                            }
                                                            placeholder="平台名称"
                                                            maxLength={50}
                                                            disabled={!canUpdate}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <EditableCell
                                                            value={platform.code}
                                                            onSave={(newValue) =>
                                                                handleUpdateField(platform.id, 'code', newValue)
                                                            }
                                                            placeholder="平台编码"
                                                            maxLength={50}
                                                            disabled={!canUpdate}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <EditableSelectCell
                                                            value={platform.type}
                                                            options={platformTypeOptions}
                                                            onSave={(newValue) =>
                                                                handleUpdateType(platform.id, newValue)
                                                            }
                                                            disabled={!canUpdate}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <EditableSwitchCell
                                                            checked={platform.status === 'ACTIVE'}
                                                            onSave={(checked) =>
                                                                handleUpdateStatus(platform.id, checked)
                                                            }
                                                            activeLabel="启用"
                                                            inactiveLabel="停用"
                                                            disabled={!canUpdate}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {platform.website ? (
                                                            <a
                                                                href={platform.website}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-primary hover:underline"
                                                            >
                                                                访问
                                                            </a>
                                                        ) : (
                                                            '-'
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="max-w-xs truncate">
                                                        <EditableCell
                                                            value={platform.remark}
                                                            onSave={(newValue) =>
                                                                handleUpdateField(platform.id, 'remark', newValue)
                                                            }
                                                            placeholder="备注"
                                                            maxLength={200}
                                                            disabled={!canUpdate}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <PermissionGate permission="platform:update">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleEdit(platform)}
                                                                >
                                                                    <Edit className="w-4 h-4" />
                                                                </Button>
                                                            </PermissionGate>
                                                            <PermissionGate permission="platform:delete">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        setPlatformToDelete(platform);
                                                                        setDeleteDialogOpen(true);
                                                                    }}
                                                                >
                                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                                </Button>
                                                            </PermissionGate>
                                                        </div>
                                                    </TableCell>
                                                </SortableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </SortableContext>
                        </DndContext>
                    )}

                    {sorting && (
                        <div className="text-sm text-muted-foreground mt-2">保存排序中...</div>
                    )}
                </CardContent>
            </Card>

            {/* 新建/编辑对话框 */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>
                            {editingPlatform ? '编辑平台' : '新建平台'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>平台名称 *</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="如：抖音"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>平台编码 *</Label>
                            <Input
                                value={form.code}
                                onChange={(e) => setForm({ ...form, code: e.target.value })}
                                placeholder="如：douyin"
                                disabled={!!editingPlatform}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>平台类型</Label>
                            <Select
                                value={form.type}
                                onValueChange={(value: any) => setForm({ ...form, type: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DOMESTIC">国内电商</SelectItem>
                                    <SelectItem value="CROSS_BORDER">跨境电商</SelectItem>
                                    <SelectItem value="SOCIAL">社交电商</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>平台Logo</Label>
                            <SimpleImageUploader
                                value={form.logo}
                                onChange={(url) => setForm({ ...form, logo: url })}
                                realFolderId={logoConfig?.realFolderId || undefined}
                                storageMode="rustfs"
                                maxSize={logoConfig?.maxSize || 20}
                                accept={logoConfig?.formats?.length ? logoConfig.formats.map(f => `image/${f}`).join(',') : 'image/jpeg,image/png,image/webp,image/gif'}
                                placeholder="点击或拖拽上传Logo图片"
                                className="w-32 h-32"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>平台官网</Label>
                            <Input
                                value={form.website}
                                onChange={(e) => setForm({ ...form, website: e.target.value })}
                                placeholder="如：https://www.douyin.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>备注</Label>
                            <Input
                                value={form.remark}
                                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                                placeholder="其他说明"
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
                            确定要删除平台 &quot;{platformToDelete?.name}&quot; 吗？此操作不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPlatformToDelete(null)}>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 平台Logo配置弹窗 */}
            <PlatformLogoConfigDialog
                open={configDialogOpen}
                onOpenChange={(open) => {
                    setConfigDialogOpen(open);
                    // 关闭弹窗后刷新配置
                    if (!open) {
                        apiClient.getPlatformLogoConfig().then(setLogoConfig);
                    }
                }}
            />
        </div>
    );
}

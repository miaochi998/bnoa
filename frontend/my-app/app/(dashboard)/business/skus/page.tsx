'use client';

import { useState, useEffect, useRef } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Plus,
    Search,
    Edit,
    Trash2,
    Package,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Loader2,
    GripVertical,
} from 'lucide-react';
import { DictTag } from '@/components/shared/DictTag';
import { SkuForm } from './components/SkuForm';
import { PermissionGate } from '@/components/PermissionGate';
import { EditableCell } from '@/components/shared/EditableCell';
import { usePermissionStore } from '@/lib/stores/permission-store';
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

interface LinkOption {
    id: string;
    name: string;
    shop?: {
        id: string;
        name: string;
        platform?: { name: string };
    };
}

interface Sku {
    id: string;
    name: string;
    type: string;
    weight: number;
    miscFee: number;
    comboPackageFee: number;
    productCost: number;
    expressCost: number;
    totalCost: number;
    status: string;
    remark: string | null;
    link: LinkOption;
    defaultExpressCompany: {
        id: string;
        name: string;
    } | null;
    finishedProducts: {
        finishedProduct: {
            id: string;
            name: string;
            code: string;
        };
        quantity: number;
    }[];
}

// 分组后的数据结构
interface SkuGroup {
    linkId: string;
    linkName: string;
    shopName: string;
    skus: Sku[];
    stats: {
        total: number;
        enabled: number;
        disabled: number;
    };
}

// 可排序SKU行（左侧拖拽手柄）
function SortableRow({
    id,
    disabled = false,
    children,
}: {
    id: string;
    disabled?: boolean;
    children: React.ReactNode;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, disabled });

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
            <TableCell className="w-10">
                {!disabled && (
                    <div
                        {...attributes}
                        {...listeners}
                        className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300"
                    >
                        <GripVertical className="w-4 h-4" />
                    </div>
                )}
            </TableCell>
            {children}
        </TableRow>
    );
}

export default function SkusPage() {
    const [skus, setSkus] = useState<Sku[]>([]);
    const [skuGroups, setSkuGroups] = useState<SkuGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const debouncedKeyword = useDebouncedValue(keyword, 300);
    const [linkId, setLinkId] = useState('all');
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [links, setLinks] = useState<LinkOption[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingSku, setEditingSku] =
        useState<Sku | null>(null);
    const [recalculating, setRecalculating] = useState('');

    // 展开的链接ID集合
    const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set());

    const [sorting, setSorting] = useState(false);
    const { hasPermission } = usePermissionStore();
    const canDrag = hasPermission('sku:update');

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    // 将扁平SKU数据按链接分组
    const groupSkusByLink = (skuList: Sku[]): SkuGroup[] => {
        const groups: Record<string, SkuGroup> = {};
        for (const sku of skuList) {
            const linkId = sku.link?.id || 'unknown';
            if (!groups[linkId]) {
                groups[linkId] = {
                    linkId,
                    linkName: sku.link?.name || '未知链接',
                    shopName: sku.link?.shop?.platform?.name && sku.link?.shop?.name
                        ? `${sku.link.shop.platform.name} - ${sku.link.shop.name}`
                        : '',
                    skus: [],
                    stats: { total: 0, enabled: 0, disabled: 0 },
                };
            }
            groups[linkId].skus.push(sku);
            groups[linkId].stats.total++;
            if (sku.status === 'ENABLED') {
                groups[linkId].stats.enabled++;
            } else {
                groups[linkId].stats.disabled++;
            }
        }
        return Object.values(groups);
    };

    const loadSkus = async () => {
        setLoading(true);
        try {
            const data = await apiClient.getSkus({
                keyword: keyword || undefined,
                linkId: linkId === 'all'
                    ? undefined : linkId,
                status: status === 'all'
                    ? undefined : status,
                page,
                pageSize: 100, // 获取更多数据用于分组展示
            });
            const skuList = data.list || [];
            setSkus(skuList);
            setSkuGroups(groupSkusByLink(skuList));
            setTotal(data.pagination?.total || 0);
        } catch {
            setSkus([]);
        } finally {
            setLoading(false);
        }
    };

    const loadLinks = async () => {
        try {
            const data =
                await apiClient.getSkuLinksForSelect();
            setLinks(data || []);
        } catch {
            setLinks([]);
        }
    };

    const isFirstRender = useRef(true);
    useEffect(() => { loadSkus(); }, [page]);
    useEffect(() => { loadLinks(); }, []);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        setPage(1);
        loadSkus();
    }, [debouncedKeyword, linkId, status]);

    const handleCreate = () => {
        setEditingSku(null);
        setDialogOpen(true);
    };

    const handleEdit = (sku: Sku) => {
        setEditingSku(sku);
        setDialogOpen(true);
    };

    const handleRecalculate = async (sku: Sku) => {
        setRecalculating(sku.id);
        try {
            await apiClient.recalculateSkuCost(sku.id);
            loadSkus();
        } catch (error: any) {
            alert(
                '重算失败: '
                + (error.message || '请稍后重试'),
            );
        } finally {
            setRecalculating('');
        }
    };

    // 更新SKU名称
    const handleUpdateName = async (id: string, newName: string) => {
        try {
            await apiClient.updateSku(id, { name: newName });
            // 更新本地列表
            setSkus(prev => prev.map(item =>
                item.id === id ? { ...item, name: newName } : item
            ));
            // 重新分组
            const updated = skus.map(item =>
                item.id === id ? { ...item, name: newName } : item
            );
            setSkuGroups(groupSkusByLink(updated));
        } catch (error: any) {
            alert('更新失败: ' + (error.message || '请稍后重试'));
            throw error;
        }
    };

    const handleDelete = async (sku: Sku) => {
        if (!confirm(`确定要删除SKU "${sku.name}" 吗？`)) {
            return;
        }
        try {
            await apiClient.deleteSku(sku.id);
            loadSkus();
        } catch (error: any) {
            alert(
                '删除失败: '
                + (error.message || '请稍后重试'),
            );
        }
    };

    // 组内SKU拖拽排序并保存
    const handleSkuDragEnd = async (
        group: SkuGroup,
        event: DragEndEvent,
    ) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = group.skus.findIndex(
            (s) => s.id === active.id,
        );
        const newIndex = group.skus.findIndex(
            (s) => s.id === over.id,
        );
        if (oldIndex < 0 || newIndex < 0) return;

        const newGroupSkus = arrayMove(
            group.skus,
            oldIndex,
            newIndex,
        );

        // 同步扁平列表：保持同组槽位，仅写入组内新顺序
        const groupIdSet = new Set(group.skus.map((s) => s.id));
        const byId: Record<string, Sku> = {};
        newGroupSkus.forEach((s) => { byId[s.id] = s; });
        const newSkus = skus.map((item) =>
            groupIdSet.has(item.id) ? byId[item.id] : item
        );
        setSkus(newSkus);
        setSkuGroups(groupSkusByLink(newSkus));

        setSorting(true);
        try {
            await apiClient.reorderSkus(
                newGroupSkus.map((s) => s.id),
            );
        } catch (error) {
            console.error('保存排序失败:', error);
            loadSkus();
        } finally {
            setSorting(false);
        }
    };

    // 展开/收起链接
    const toggleExpand = (linkId: string) => {
        const newExpanded = new Set(expandedLinks);
        if (newExpanded.has(linkId)) {
            newExpanded.delete(linkId);
        } else {
            newExpanded.add(linkId);
        }
        setExpandedLinks(newExpanded);
    };

    const handleSuccess = () => {
        setDialogOpen(false);
        loadSkus();
    };

    const totalPages = Math.ceil(total / pageSize);
    const fmt = (v: number | null | undefined) =>
        v != null
            ? `¥${Number(v).toFixed(3)}`
            : '-';

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">
                        SKU管理
                    </h1>
                    <p className="text-sm text-[#8e8e8e] mt-1">
                        管理链接级别的SKU，关联成品并自动计算成本
                    </p>
                </div>
                <PermissionGate permission="sku:create">
                    <Button
                        onClick={handleCreate}
                        className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        新增SKU
                    </Button>
                </PermissionGate>
            </div>

            <Card className="bg-[#262626] border-[#1e1e1e]">
                <CardContent className="p-4">
                    <div className="flex gap-4 items-center">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e8e]" />
                                <Input
                                    placeholder="搜索SKU名称..."
                                    value={keyword}
                                    onChange={(e) =>
                                        setKeyword(e.target.value)}
                                    className="pl-10 bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e]"
                                />
                            </div>
                        </div>
                        <Select
                            value={linkId}
                            onValueChange={setLinkId}
                        >
                            <SelectTrigger className="w-[200px] bg-[#1e1e1e] border-[#1e1e1e] text-white">
                                <SelectValue placeholder="选择链接" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                                <SelectItem
                                    value="all"
                                    className="text-white"
                                >
                                    全部链接
                                </SelectItem>
                                {links.map((l) => (
                                    <SelectItem
                                        key={l.id}
                                        value={l.id}
                                        className="text-white"
                                    >
                                        {l.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={status}
                            onValueChange={setStatus}
                        >
                            <SelectTrigger className="w-[140px] bg-[#1e1e1e] border-[#1e1e1e] text-white">
                                <SelectValue placeholder="状态" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                                <SelectItem
                                    value="all"
                                    className="text-white"
                                >
                                    全部状态
                                </SelectItem>
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
                </CardContent>
            </Card>

            <Card className="bg-[#262626] border-[#1e1e1e]">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg text-white">
                        SKU列表
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-[#8e8e8e]" />
                        </div>
                    ) : skuGroups.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-[#8e8e8e]">
                            <Package className="w-8 h-8" />
                            <p>暂无SKU数据</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {skuGroups.map((group) => (
                                <div key={group.linkId} className="border border-[#1e1e1e] rounded-lg overflow-hidden">
                                    {/* 分组标题行 */}
                                    <div
                                        className="flex items-center justify-between px-4 py-3 bg-[#1e1e1e] cursor-pointer hover:bg-[#2a2a2a] transition-colors"
                                        onClick={() => toggleExpand(group.linkId)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <button className="p-1 hover:bg-[#363636] rounded">
                                                {expandedLinks.has(group.linkId) ? (
                                                    <ChevronDown className="w-4 h-4 text-[#8e8e8e]" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4 text-[#8e8e8e]" />
                                                )}
                                            </button>
                                            <span className="font-medium text-white">
                                                {group.linkName}
                                            </span>
                                            {group.shopName && (
                                                <span className="text-[#8e8e8e] text-sm">
                                                    {group.shopName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-[#8e8e8e]">
                                                SKU: <span className="text-white font-medium">{group.stats.total}</span>
                                            </span>
                                            {group.stats.enabled > 0 && (
                                                <span className="text-green-500">
                                                    在售: {group.stats.enabled}
                                                </span>
                                            )}
                                            {group.stats.disabled > 0 && (
                                                <span className="text-gray-500">
                                                    停用: {group.stats.disabled}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 展开的SKU列表 */}
                                    {expandedLinks.has(group.linkId) && (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={closestCenter}
                                            onDragEnd={(event) =>
                                                handleSkuDragEnd(group, event)}
                                        >
                                            <SortableContext
                                                items={group.skus.map((s) => s.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="hover:bg-transparent border-[#1e1e1e]">
                                                            <TableHead className="text-[#8e8e8e] w-10">拖拽</TableHead>
                                                            <TableHead className="text-[#8e8e8e]">SKU名称</TableHead>
                                                            <TableHead className="text-[#8e8e8e]">类型</TableHead>
                                                            <TableHead className="text-[#8e8e8e]">成品</TableHead>
                                                            <TableHead className="text-[#8e8e8e] text-right">成品成本</TableHead>
                                                            <TableHead className="text-[#8e8e8e] text-right">快递费</TableHead>
                                                            <TableHead className="text-[#8e8e8e] text-right">总成本</TableHead>
                                                            <TableHead className="text-[#8e8e8e]">状态</TableHead>
                                                            <TableHead className="text-[#8e8e8e] text-right">操作</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {group.skus.map((sku) => (
                                                            <SortableRow key={sku.id} id={sku.id} disabled={!canDrag}>
                                                                <TableCell className="font-medium text-white">
                                                                    <PermissionGate
                                                                        permission="sku:update"
                                                                        fallback={<span>{sku.name}</span>}
                                                                    >
                                                                        <EditableCell
                                                                            value={sku.name}
                                                                            onSave={(newValue) => handleUpdateName(sku.id, newValue)}
                                                                            placeholder="SKU名称"
                                                                            maxLength={100}
                                                                        />
                                                                    </PermissionGate>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <DictTag typeCode="sku_type" value={sku.type} />
                                                                </TableCell>
                                                                <TableCell className="text-[#8e8e8e] max-w-[200px] truncate">
                                                                    {sku.finishedProducts?.map((fp) =>
                                                                        `${fp.finishedProduct.name}×${fp.quantity}`
                                                                    ).join('、') || '-'}
                                                                </TableCell>
                                                                <TableCell className="text-white text-right">
                                                                    {fmt(sku.productCost)}
                                                                </TableCell>
                                                                <TableCell className="text-white text-right">
                                                                    {fmt(sku.expressCost)}
                                                                </TableCell>
                                                                <TableCell className="text-[#409fff] font-medium text-right">
                                                                    {fmt(sku.totalCost)}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <DictTag typeCode="sku_status" value={sku.status} />
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex justify-end gap-1">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleRecalculate(sku);
                                                                            }}
                                                                            disabled={recalculating === sku.id}
                                                                            className="h-8 w-8 text-[#8e8e8e] hover:text-[#409fff] hover:bg-[#409fff]/10"
                                                                            title="重算成本"
                                                                        >
                                                                            <RefreshCw className={`w-4 h-4 ${recalculating === sku.id ? 'animate-spin' : ''}`} />
                                                                        </Button>
                                                                <PermissionGate permission="sku:update">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleEdit(sku);
                                                                        }}
                                                                        className="h-8 w-8 text-[#8e8e8e] hover:text-white hover:bg-[#363636]"
                                                                    >
                                                                        <Edit className="w-4 h-4" />
                                                                    </Button>
                                                                </PermissionGate>
                                                                <PermissionGate permission="sku:delete">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDelete(sku);
                                                                        }}
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
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 保存排序中提示 */}
                    {sorting && (
                        <div className="text-sm text-[#8e8e8e] mt-2">
                            保存排序中...
                        </div>
                    )}

                    {/* 分页 */}
                    {!loading && skuGroups.length > 0 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#1e1e1e]">
                            <div className="text-sm text-[#8e8e8e]">
                                共 {total} 条记录，第 {page} / {totalPages} 页
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(page - 1)}
                                    disabled={page <= 1}
                                    className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636] disabled:opacity-50"
                                >
                                    上一页
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage(page + 1)}
                                    disabled={page >= totalPages}
                                    className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636] disabled:opacity-50"
                                >
                                    下一页
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            >
                <DialogContent className="bg-[#262626] border-[#1e1e1e] text-white sm:max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingSku ? '编辑SKU' : '新增SKU'}
                        </DialogTitle>
                    </DialogHeader>
                    <SkuForm
                        sku={editingSku}
                        onSuccess={handleSuccess}
                        onCancel={() => setDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

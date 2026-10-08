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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DictSelect } from '@/components/shared/DictSelect';
import { DictTag } from '@/components/shared/DictTag';
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
    Link2,
    Plus,
    Edit,
    Trash2,
    Loader2,
    Search,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { ProductLinkForm } from './components/ProductLinkForm';
import { PermissionGate } from '@/components/PermissionGate';
import { SortableTable } from '@/components/shared/SortableTable';
import { usePermissionStore } from '@/lib/stores/permission-store';

interface ProductLink {
    id: string;
    name: string;
    shopId: string;
    shop?: {
        id: string;
        name: string;
        platform: {
            id: string;
            name: string;
            code: string;
        };
    };
    platformUrl: string | null;
    platformItemId: string | null;
    status: string;
    remark: string | null;
    createdAt: string;
    skuStats?: {
        total: number;
        enabled: number;
        disabled: number;
    };
}

interface ShopOption {
    id: string;
    name: string;
    platform: { id: string; name: string };
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

export default function ProductLinkPage() {
    const [links, setLinks] = useState<ProductLink[]>(
        [],
    );
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [shopFilter, setShopFilter] = useState('all');
    const [statusFilter, setStatusFilter] =
        useState('all');
    const [shops, setShops] = useState<ShopOption[]>([]);

    // 分页
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const totalPages = Math.ceil(total / pageSize);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(1);
    };

    // 表单弹窗
    const [formOpen, setFormOpen] = useState(false);
    const [editData, setEditData] = useState<any>(null);

    // 删除确认
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [toDelete, setToDelete] =
        useState<ProductLink | null>(null);

    // 展开的链接ID集合及其SKU数据
    const [expandedLinks, setExpandedLinks] = useState<Set<string>>(new Set());
    const [expandedSkus, setExpandedSkus] = useState<Record<string, Sku[]>>({});
    const [loadingSkus, setLoadingSkus] = useState<Set<string>>(new Set());

    // 拖拽排序状态（有更新权限才可拖）
    const canUpdate = usePermissionStore(
        (s) => s.hasPermission('product-link:update'),
    );
    const [sorting, setSorting] = useState(false);

    const fetchLinks = useCallback(async () => {
        try {
            setLoading(true);
            const data =
                await apiClient.getProductLinks({
                    keyword: keyword || undefined,
                    shopId:
                        shopFilter === 'all'
                            ? undefined
                            : shopFilter,
                    status:
                        statusFilter === 'all'
                            ? undefined
                            : statusFilter,
                    page,
                    pageSize,
                });
            setLinks(data.list || []);
            setTotal(data.pagination?.total || 0);
        } catch {
            setLinks([]);
        } finally {
            setLoading(false);
        }
    }, [
        keyword,
        shopFilter,
        statusFilter,
        page,
        pageSize,
    ]);

    const fetchShops = useCallback(async () => {
        try {
            const data =
                await apiClient.getPLShopsForSelect();
            setShops(data || []);
        } catch {
            setShops([]);
        }
    }, []);

    useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    useEffect(() => {
        fetchShops();
    }, [fetchShops]);

    // 筛选变化时重置页码
    useEffect(() => {
        setPage(1);
    }, [keyword, shopFilter, statusFilter]);

    const handleAdd = () => {
        setEditData(null);
        setFormOpen(true);
    };

    const handleEdit = (link: ProductLink) => {
        setEditData(link);
        setFormOpen(true);
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            await apiClient.deleteProductLink(
                toDelete.id,
            );
            setDeleteOpen(false);
            setToDelete(null);
            fetchLinks();
        } catch (error: any) {
            alert(error.message || '删除失败');
        }
    };

    // 展开/收起链接的SKU列表
    const toggleExpand = async (linkId: string) => {
        const newExpanded = new Set(expandedLinks);
        if (newExpanded.has(linkId)) {
            newExpanded.delete(linkId);
            setExpandedLinks(newExpanded);
        } else {
            newExpanded.add(linkId);
            setExpandedLinks(newExpanded);
            // 如果还没有加载过这个链接的SKU，则加载
            if (!expandedSkus[linkId]) {
                setLoadingSkus((prev) => new Set(prev).add(linkId));
                try {
                    const data = await apiClient.getSkus({
                        linkId,
                        pageSize: 100, // 获取足够多的SKU
                    });
                    setExpandedSkus((prev) => ({
                        ...prev,
                        [linkId]: data.list || [],
                    }));
                } catch (error) {
                    console.error('加载SKU失败:', error);
                } finally {
                    setLoadingSkus((prev) => {
                        const next = new Set(prev);
                        next.delete(linkId);
                        return next;
                    });
                }
            }
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr)
            .toLocaleDateString('zh-CN');
    };

    // 拖拽排序后持久化保存
    const handleReorder = async (
        newLinks: ProductLink[],
    ) => {
        setLinks(newLinks);
        setSorting(true);
        try {
            await apiClient.reorderProductLinks(
                newLinks.map((l) => l.id),
            );
        } catch (error) {
            console.error('保存排序失败:', error);
            fetchLinks();
        } finally {
            setSorting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">
                        链接管理
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        管理店铺下的商品链接
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium">
                        链接列表
                    </CardTitle>
                    <PermissionGate permission="product-link:create">
                    <Button
                        onClick={handleAdd}
                        size="sm"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        新建链接
                    </Button>
                    </PermissionGate>
                </CardHeader>
                <CardContent>
                    {/* 搜索/筛选栏 */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索链接名称..."
                                value={keyword}
                                onChange={(e) =>
                                    setKeyword(
                                        e.target.value,
                                    )
                                }
                                className="pl-9"
                            />
                        </div>
                        <Select
                            value={shopFilter}
                            onValueChange={
                                setShopFilter
                            }
                        >
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="筛选店铺" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    全部店铺
                                </SelectItem>
                                {shops.map((s) => (
                                    <SelectItem
                                        key={s.id}
                                        value={s.id}
                                    >
                                        {s.platform
                                            ?.name +
                                            ' - ' +
                                            s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <DictSelect
                            typeCode="product_link_status"
                            value={statusFilter}
                            onChange={setStatusFilter}
                            showAll
                            allLabel="全部状态"
                            allValue="all"
                            className="w-[140px]"
                        />
                    </div>

                    {/* 链接列表：与 SKU 列表相同的分组 + 表格结构 */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : links.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                            <Link2 className="w-8 h-8" />
                            <p>暂无链接数据</p>
                        </div>
                    ) : (
                        <SortableTable
                            items={links}
                            getId={(item) => item.id}
                            onItemsChange={handleReorder}
                            disabled={!canUpdate}
                            className="space-y-2"
                        >
                            {(link, isDragging) => (
                                <div
                                    className="border border-border rounded-lg overflow-hidden"
                                >
                                    {/* 分组标题行 */}
                                    <div
                                        className="flex items-center justify-between px-4 py-3 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                                        onClick={() => link.skuStats && link.skuStats.total > 0 && toggleExpand(link.id)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <button
                                                type="button"
                                                className="p-1 rounded hover:bg-muted shrink-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (link.skuStats && link.skuStats.total > 0) toggleExpand(link.id);
                                                }}
                                            >
                                                {link.skuStats && link.skuStats.total > 0 ? (
                                                    expandedLinks.has(link.id) ? (
                                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                    ) : (
                                                        <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
                                                    )
                                                ) : (
                                                    <span className="w-4 h-4 inline-block" />
                                                )}
                                            </button>
                                            <span className="font-medium truncate">{link.name}</span>
                                            {link.platformUrl && (
                                                <a
                                                    href={link.platformUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-primary hover:text-primary/80 shrink-0"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                            <span className="text-sm text-muted-foreground shrink-0">
                                                {link.shop?.platform?.name && link.shop?.name
                                                    ? `${link.shop.platform.name} - ${link.shop.name}`
                                                    : '-'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 shrink-0">
                                            {link.skuStats && (
                                                <span className="text-sm text-muted-foreground">
                                                    SKU: <span className="font-medium text-foreground">{link.skuStats.total}</span>
                                                    {link.skuStats.enabled > 0 && (
                                                        <span className="text-green-600"> 在售: {link.skuStats.enabled}</span>
                                                    )}
                                                    {link.skuStats.disabled > 0 && (
                                                        <span className="text-muted-foreground"> 停用: {link.skuStats.disabled}</span>
                                                    )}
                                                </span>
                                            )}
                                            <DictTag typeCode="product_link_status" value={link.status} />
                                            <span className="text-sm text-muted-foreground">{formatDate(link.createdAt)}</span>
                                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                <PermissionGate permission="product-link:update">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(link)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                </PermissionGate>
                                                <PermissionGate permission="product-link:delete">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() => { setToDelete(link); setDeleteOpen(true); }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </PermissionGate>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 展开的 SKU 列表 */}
                                    {expandedLinks.has(link.id) && (
                                        <div className="border-t border-border">
                                            {loadingSkus.has(link.id) ? (
                                                <div className="flex items-center justify-center py-8">
                                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : expandedSkus[link.id]?.length > 0 ? (
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead className="text-muted-foreground">SKU名称</TableHead>
                                                            <TableHead className="text-muted-foreground">类型</TableHead>
                                                            <TableHead className="text-muted-foreground">成品</TableHead>
                                                            <TableHead className="text-muted-foreground text-right">成品成本</TableHead>
                                                            <TableHead className="text-muted-foreground text-right">快递费</TableHead>
                                                            <TableHead className="text-muted-foreground text-right">总成本</TableHead>
                                                            <TableHead className="text-muted-foreground">状态</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {expandedSkus[link.id].map((sku) => (
                                                            <TableRow key={sku.id} className="hover:bg-muted/50">
                                                                <TableCell className="font-medium">{sku.name}</TableCell>
                                                                <TableCell>
                                                                    <DictTag typeCode="sku_type" value={sku.type} />
                                                                </TableCell>
                                                                <TableCell className="max-w-[200px] truncate">
                                                                    {sku.finishedProducts?.map((fp) =>
                                                                        `${fp.finishedProduct.name}×${fp.quantity}`
                                                                    ).join('、') || '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {sku.productCost != null ? `¥${Number(sku.productCost).toFixed(3)}` : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {sku.expressCost != null ? `¥${Number(sku.expressCost).toFixed(3)}` : '-'}
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium text-primary">
                                                                    {sku.totalCost != null ? `¥${Number(sku.totalCost).toFixed(3)}` : '-'}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <DictTag typeCode="sku_status" value={sku.status} />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            ) : (
                                                <div className="text-center py-6 text-muted-foreground text-sm">暂无SKU数据</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </SortableTable>
                    )}

                    {sorting && (
                        <div className="text-sm text-muted-foreground mt-2">保存排序中...</div>
                    )}

                    {/* 分页 */}
                    {!loading && totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-4">
                                <p className="text-sm text-muted-foreground">
                                    共 {total} 条，第 {page} / {totalPages} 页
                                </p>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(v) => handlePageSizeChange(Number(v))}
                                >
                                    <SelectTrigger className="w-24 h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
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
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 新建/编辑表单弹窗 */}
            <ProductLinkForm
                open={formOpen}
                onOpenChange={setFormOpen}
                editData={editData}
                onSuccess={fetchLinks}
            />

            {/* 删除确认 */}
            <AlertDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            确认删除
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除链接 &quot;
                            {toDelete?.name}
                            &quot; 吗？此操作不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() =>
                                setToDelete(null)
                            }
                        >
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive"
                        >
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

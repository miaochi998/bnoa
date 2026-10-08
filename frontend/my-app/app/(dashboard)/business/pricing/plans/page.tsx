'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from '@/components/ui/table';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Tooltip, TooltipContent, TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    History, Search, Loader2, Trash2, Download,
    ChevronLeft, ChevronRight, ChevronDown,
    ChevronRight as ChevronRightIcon, ArrowLeft,
    Eye,
} from 'lucide-react';
import { PermissionGate } from '@/components/PermissionGate';

interface SkuSummary {
    skuId: string;
    skuName: string;
    skuType: string;
    cost: number;
    sellingPrice: number;
    grossProfit: number;
    profitRate: number;
    commission: number;
}

interface PlanItem {
    id: string;
    linkId: string;
    name: string;
    profitRates: number[];
    commissionRate: number;
    taxRate: number;
    talentCommissionRate?: number;
    selectedPrices?: Record<string, number>;
    remark?: string;
    createdAt: string;
    productLink?: {
        id: string;
        name: string;
        shop?: {
            id: string;
            name: string;
            platform?: { id: string; name: string };
        };
    };
    skuSummaries?: SkuSummary[];
}

interface LinkOption {
    id: string;
    name: string;
    status: string;
    shop?: {
        id: string;
        name: string;
        platform?: { id: string; name: string };
    };
}

export default function PricingPlansPage() {
    const router = useRouter();
    const [plans, setPlans] = useState<PlanItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [linkFilter, setLinkFilter] = useState('all');
    const [links, setLinks] = useState<LinkOption[]>([]);

    // 分页
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const totalPages = Math.ceil(total / pageSize);

    // 展开行
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // 删除确认
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [toDelete, setToDelete] = useState<PlanItem | null>(null);

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        setPage(1);
    };

    const fetchPlans = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiClient.getPricingPlans({
                keyword: keyword || undefined,
                linkId: linkFilter === 'all' ? undefined : linkFilter,
                page,
                pageSize,
                withSummary: true,
            });
            setPlans(data.list || []);
            setTotal(data.pagination?.total || 0);
        } catch {
            setPlans([]);
        } finally {
            setLoading(false);
        }
    }, [keyword, linkFilter, page, pageSize]);

    const fetchLinks = useCallback(async () => {
        try {
            const data = await apiClient.getPricingLinksForSelect();
            setLinks(data || []);
        } catch {
            setLinks([]);
        }
    }, []);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    useEffect(() => {
        fetchLinks();
    }, [fetchLinks]);

    // 筛选变化时重置页码
    useEffect(() => {
        setPage(1);
    }, [keyword, linkFilter]);

    const toggleExpand = (id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            await apiClient.deletePricingPlan(toDelete.id);
            setDeleteOpen(false);
            setToDelete(null);
            fetchPlans();
        } catch (error: any) {
            alert(error.message || '删除失败');
        }
    };

    const handleLoadPlan = (plan: PlanItem) => {
        // 将方案参数编码到 URL 中，跳转到定价计算页面
        const params = new URLSearchParams();
        params.set('planId', plan.id);
        params.set('linkId', plan.linkId);
        router.push(`/business/pricing?${params.toString()}`);
    };

    const fmtDate = (d: string) => {
        const dt = new Date(d);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    };

    const fmtRates = (rates: number[]) => {
        if (!rates || rates.length === 0) return '-';
        return rates.map((r) => `${(Number(r) * 100).toFixed(0)}%`).join(', ');
    };

    const fmtMoney = (v: number) => `¥${v.toFixed(2)}`;
    const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

    return (
        <div className="space-y-6">
            {/* 页面标题 */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <History className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">历史方案</h1>
                    <p className="text-sm text-muted-foreground">
                        查看和管理已保存的定价计算方案
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/business/pricing')}
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    返回定价计算
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">方案列表</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* 搜索/筛选栏 */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className="relative flex-1 min-w-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="搜索方案名称..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={linkFilter} onValueChange={setLinkFilter}>
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="筛选链接" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部链接</SelectItem>
                                {links.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>
                                        {l.name}
                                        {l.shop && (
                                            <span className="text-muted-foreground ml-1">
                                                ({l.shop.platform?.name} - {l.shop.name})
                                            </span>
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* 列表 */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                            <History className="w-8 h-8" />
                            <p>暂无定价方案</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {plans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className="border border-border rounded-lg overflow-hidden"
                                >
                                    {/* 方案标题行 */}
                                    <div
                                        className="flex items-center justify-between px-4 py-3 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                                        onClick={() => toggleExpand(plan.id)}
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <button
                                                type="button"
                                                className="p-1 rounded hover:bg-muted shrink-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleExpand(plan.id);
                                                }}
                                            >
                                                {expandedIds.has(plan.id) ? (
                                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
                                                )}
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium truncate">{plan.name}</span>
                                                    {plan.skuSummaries && plan.skuSummaries.length > 0 && (
                                                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                            {plan.skuSummaries.length} SKU
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                    {plan.productLink && (
                                                        <span className="truncate max-w-[240px]">
                                                            {plan.productLink.name}
                                                            {plan.productLink.shop && (
                                                                <span className="ml-1">
                                                                    ({plan.productLink.shop.platform?.name} - {plan.productLink.shop.name})
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                    <span className="shrink-0">{fmtDate(plan.createdAt)}</span>
                                                    <span className="shrink-0">
                                                        佣金率: {fmtPct(Number(plan.commissionRate))}
                                                    </span>
                                                    {Number(plan.taxRate || 0) > 0 && (
                                                        <span className="shrink-0">
                                                            税费率: {fmtPct(Number(plan.taxRate))}
                                                        </span>
                                                    )}
                                                    {plan.talentCommissionRate != null && Number(plan.talentCommissionRate) > 0 && (
                                                        <span className="shrink-0">
                                                            达人佣金: {fmtPct(Number(plan.talentCommissionRate))}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    利润率: {fmtRates(plan.profitRates)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleLoadPlan(plan)}
                                                            className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                                                        >
                                                            <Download className="w-3 h-3 mr-1" />
                                                            加载
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>加载此方案到定价计算页面</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <PermissionGate permission="pricing:delete">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setToDelete(plan);
                                                        setDeleteOpen(true);
                                                    }}
                                                    className="h-7 text-xs text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </PermissionGate>
                                        </div>
                                    </div>

                                    {/* 展开的 SKU 摘要表格 */}
                                    {expandedIds.has(plan.id) && (
                                        <div className="border-t border-border">
                                            {plan.skuSummaries && plan.skuSummaries.length > 0 ? (
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableHead className="text-muted-foreground">SKU名称</TableHead>
                                                            <TableHead className="text-muted-foreground">类型</TableHead>
                                                            <TableHead className="text-muted-foreground text-right">成本</TableHead>
                                                            <TableHead className="text-muted-foreground text-right">建议售价</TableHead>
                                                            <TableHead className="text-muted-foreground text-right">毛利润</TableHead>
                                                            <TableHead className="text-muted-foreground text-right">利润率</TableHead>
                                                            <TableHead className="text-muted-foreground text-right">佣金</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {plan.skuSummaries.map((sku) => (
                                                            <TableRow key={sku.skuId} className="hover:bg-muted/50">
                                                                <TableCell className="font-medium">{sku.skuName}</TableCell>
                                                                <TableCell className="text-muted-foreground">{sku.skuType}</TableCell>
                                                                <TableCell className="text-right">{fmtMoney(sku.cost)}</TableCell>
                                                                <TableCell className="text-right font-medium text-primary">
                                                                    {fmtMoney(sku.sellingPrice)}
                                                                </TableCell>
                                                                <TableCell className={`text-right font-medium ${sku.grossProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                    {fmtMoney(sku.grossProfit)}
                                                                </TableCell>
                                                                <TableCell className={`text-right ${sku.profitRate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                                    {fmtPct(sku.profitRate)}
                                                                </TableCell>
                                                                <TableCell className="text-right text-orange-500">
                                                                    {fmtMoney(sku.commission)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            ) : (
                                                <div className="text-center py-6 text-muted-foreground text-sm">
                                                    该方案关联的链接下暂无启用的SKU
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 分页 */}
                    {!loading && total > 0 && (
                        <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-4">
                                <p className="text-sm text-muted-foreground">
                                    共 {total} 条，第 {page} / {totalPages || 1} 页
                                </p>
                                <Select
                                    value={String(pageSize)}
                                    onValueChange={(v) => handlePageSizeChange(Number(v))}
                                >
                                    <SelectTrigger className="w-24 h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10 条/页</SelectItem>
                                        <SelectItem value="20">20 条/页</SelectItem>
                                        <SelectItem value="50">50 条/页</SelectItem>
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

            {/* 删除确认 */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除方案 &quot;{toDelete?.name}&quot; 吗？此操作不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setToDelete(null)}>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

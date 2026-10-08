'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { MonthPicker } from '@/components/ui/month-picker';
import { apiClient } from '@/lib/api';
import {
    FileSpreadsheet, Plus, Eye, Trash2,
    Loader2, CheckCircle, FileEdit, Upload,
} from 'lucide-react';
import { usePermissionStore } from '@/lib/stores/permission-store';
import { PermissionGate } from '@/components/PermissionGate';
import { ImportExcelDialog } from './components/ImportExcelDialog';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    DRAFT: { label: '草稿', color: 'text-yellow-500' },
    CONFIRMED: { label: '已确认', color: 'text-green-500' },
};

const currentYear = new Date().getFullYear();

export default function ProfitReportsPage() {
    const router = useRouter();
    const { hasPermission } = usePermissionStore();
    const canEdit = hasPermission('profit:edit');
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [yearFilter, setYearFilter] = useState('');
    const [periods, setPeriods] = useState<{ year: number; months: number[] }[]>([]);

    // 从实际数据中提取可用年份
    const availableYears = useMemo(
        () => periods.map((p) => p.year).sort((a, b) => b - a),
        [periods],
    );

    // 创建对话框
    const [createOpen, setCreateOpen] = useState(false);
    const [newYear, setNewYear] = useState(currentYear);
    const [newMonth, setNewMonth] = useState(new Date().getMonth() + 1);
    const [creating, setCreating] = useState(false);

    // 导入对话框
    const [importOpen, setImportOpen] = useState(false);

    // 删除确认
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [toDelete, setToDelete] = useState<any>(null);

    const fetchPeriods = useCallback(async () => {
        try {
            const p = await apiClient.getAvailablePeriods();
            setPeriods(p);
            // 当前筛选的年份已不存在于数据中，重置
            if (yearFilter && yearFilter !== 'all') {
                const exists = p.some((x) => String(x.year) === yearFilter);
                if (!exists) setYearFilter('');
            }
        } catch {
            // ignore
        }
    }, [yearFilter]);

    const fetchReports = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiClient.getProfitReports({
                year: yearFilter && yearFilter !== 'all'
                    ? Number(yearFilter) : undefined,
                pageSize: 50,
            });
            setReports(data.list || []);
        } catch (error: any) {
            console.error('获取利润表列表失败:', error);
        } finally {
            setLoading(false);
        }
    }, [yearFilter]);

    useEffect(() => { fetchPeriods(); }, [fetchPeriods]);
    useEffect(() => { fetchReports(); }, [fetchReports]);

    const handleCreate = async () => {
        try {
            setCreating(true);
            const report = await apiClient.createProfitReport({
                year: newYear,
                month: newMonth,
            });
            setCreateOpen(false);
            router.push(
                `/business/profit-reports/${report.id}`,
            );
        } catch (error: any) {
            alert(error.message || '创建失败');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            await apiClient.deleteProfitReport(toDelete.id);
            setDeleteOpen(false);
            setToDelete(null);
            await fetchReports();
            fetchPeriods();
        } catch (error: any) {
            alert(error.message || '删除失败');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold">利润表</h1>
                    <p className="text-sm text-muted-foreground">
                        管理月度利润报表数据
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-sm font-medium">
                        利润表列表
                    </CardTitle>
                    {canEdit && (
                        <PermissionGate permission="profit:edit">
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => setImportOpen(true)}
                                    size="sm"
                                    variant="outline"
                                >
                                    <Upload className="w-4 h-4 mr-1" />
                                    Excel导入
                                </Button>
                                <Button
                                    onClick={() => setCreateOpen(true)}
                                    size="sm"
                                >
                                    <Plus className="w-4 h-4 mr-1" />
                                    新建月报
                                </Button>
                            </div>
                        </PermissionGate>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-4">
                        <Select
                            value={yearFilter || 'all'}
                            onValueChange={(v) => setYearFilter(
                                v === 'all' ? '' : v,
                            )}
                        >
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="筛选年份" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    全部年份
                                </SelectItem>
                                {availableYears.map((y) => (
                                    <SelectItem
                                        key={y}
                                        value={String(y)}
                                    >
                                        {y}年
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>期间</TableHead>
                                    <TableHead>状态</TableHead>
                                    <TableHead>店铺数</TableHead>
                                    <TableHead className="text-right">费用合计</TableHead>
                                    <TableHead className="text-right">净利润</TableHead>
                                    <TableHead>创建时间</TableHead>
                                    <TableHead className="text-right">
                                        操作
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reports.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={7}
                                            className="text-center py-8 text-muted-foreground"
                                        >
                                            暂无数据
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    reports.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell className="font-medium">
                                                {r.year}年{r.month}月
                                            </TableCell>
                                            <TableCell>
                                                <span className={
                                                    STATUS_MAP[r.status]?.color
                                                }>
                                                    {r.status === 'CONFIRMED'
                                                        && <CheckCircle className="w-3.5 h-3.5 inline mr-1" />}
                                                    {STATUS_MAP[r.status]?.label}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {r._count?.profitReportEntries ?? 0}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {(r.totalExpense ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className={`text-right font-mono ${(r.totalNetProfit ?? 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                {(r.totalNetProfit ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(r.createdAt)
                                                    .toLocaleDateString('zh-CN')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => router.push(
                                                            `/business/profit-reports/${r.id}/view`,
                                                        )}
                                                        title="查看"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <PermissionGate permission="profit:edit">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => router.push(
                                                                `/business/profit-reports/${r.id}`,
                                                            )}
                                                            title="编辑"
                                                        >
                                                            <FileEdit className="w-4 h-4" />
                                                        </Button>
                                                    </PermissionGate>
                                                    <PermissionGate permission="profit:delete">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    setToDelete(r);
                                                                    setDeleteOpen(true);
                                                                }}
                                                            >
                                                                <Trash2 className="w-4 h-4 text-destructive" />
                                                            </Button>
                                                    </PermissionGate>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* 新建对话框 */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>新建月度利润表</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>选择年月 *</Label>
                            <MonthPicker
                                year={newYear}
                                month={newMonth}
                                onSelect={(y, m) => {
                                    setNewYear(y);
                                    setNewMonth(m);
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCreateOpen(false)}
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleCreate}
                            disabled={creating}
                        >
                            {creating && (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            )}
                            创建
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 删除确认 */}
            <AlertDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            确定要删除 {toDelete?.year}年
                            {toDelete?.month}月 的利润表吗？
                            此操作不可恢复。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => setToDelete(null)}
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

            {/* Excel导入对话框 */}
            <ImportExcelDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                onSuccess={(reportId) => {
                    fetchReports();
                    fetchPeriods();
                    router.push(`/business/profit-reports/${reportId}`);
                }}
            />
        </div>
    );
}

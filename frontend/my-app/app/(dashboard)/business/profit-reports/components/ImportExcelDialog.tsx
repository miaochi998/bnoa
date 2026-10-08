'use client';

import { useState, useRef } from 'react';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell,
    TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';

import { apiClient } from '@/lib/api';
import {
    Upload, Loader2, CheckCircle, XCircle,
    AlertTriangle, FileSpreadsheet, ChevronDown,
} from 'lucide-react';

interface ImportExcelDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (reportId: string) => void;
}

export function ImportExcelDialog({ open, onOpenChange, onSuccess }: ImportExcelDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [preview, setPreview] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reset = () => {
        setFile(null);
        setPreview(null);
        setError(null);
        setPreviewing(false);
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = (v: boolean) => {
        if (!v) reset();
        onOpenChange(v);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0] || null;
        setFile(f);
        setPreview(null);
        setError(null);
    };

    const handlePreview = async () => {
        if (!file) return;
        setPreviewing(true);
        setError(null);
        try {
            const data = await apiClient.profitImportPreview(file);
            setPreview(data);
        } catch (e: any) {
            setError(e.message || '预览解析失败');
        } finally {
            setPreviewing(false);
        }
    };

    const handleConfirm = async () => {
        if (!file) return;
        setImporting(true);
        setError(null);
        try {
            const result = await apiClient.profitImportConfirm(file);
            onSuccess(result.reportId);
            handleClose(false);
        } catch (e: any) {
            setError(e.message || '导入失败');
        } finally {
            setImporting(false);
        }
    };

    const fmt = (n: number) => n ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

    // 计算汇总
    const totalSales = preview?.entries?.reduce((s: number, e: any) => s + (e.salesAmount || 0), 0) || 0;
    const totalEntries = preview?.entries?.length || 0;
    const matchedEntries = preview?.entries?.filter((e: any) => e.matched).length || 0;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[900px] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5" />
                        Excel 利润表导入
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col gap-4">
                    {/* 文件选择 */}
                    <div className="flex items-center gap-3">
                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileChange}
                            className="flex-1"
                        />
                        <Button
                            onClick={handlePreview}
                            disabled={!file || previewing}
                            variant="outline"
                        >
                            {previewing ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                                <Upload className="w-4 h-4 mr-1" />
                            )}
                            {previewing ? '解析中...' : '解析预览'}
                        </Button>
                    </div>

                    {/* 错误提示 */}
                    {error && (
                        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
                            <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* 预览结果 */}
                    {preview && (
                        <div className="flex-1 overflow-y-auto max-h-[55vh] pr-1">
                            <div className="space-y-4">
                                {/* 基本信息 */}
                                <div className="flex items-center gap-4 flex-wrap">
                                    <Badge variant="outline" className="text-base px-3 py-1">
                                        {preview.year}年{preview.month}月
                                    </Badge>
                                    <span className="text-sm text-muted-foreground">
                                        识别到 <strong>{totalEntries}</strong> 个店铺，
                                        匹配成功 <strong className="text-green-600">{matchedEntries}</strong> 个
                                        {matchedEntries < totalEntries && (
                                            <strong className="text-red-600 ml-1">
                                                ({totalEntries - matchedEntries} 个未匹配)
                                            </strong>
                                        )}
                                    </span>
                                    {preview.existingReportId && (
                                        <Badge variant={preview.existingReportStatus === 'DRAFT' ? 'secondary' : 'destructive'}>
                                            该月报表已存在（{preview.existingReportStatus === 'DRAFT' ? '草稿，将覆盖' : '已确认，无法导入'}）
                                        </Badge>
                                    )}
                                </div>

                                {/* 警告 */}
                                {preview.warnings?.length > 0 && (
                                    <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 text-sm space-y-1">
                                        <div className="font-medium flex items-center gap-1">
                                            <AlertTriangle className="w-4 h-4" /> 警告信息
                                        </div>
                                        {preview.warnings.map((w: string, i: number) => (
                                            <div key={i}>• {w}</div>
                                        ))}
                                    </div>
                                )}

                                {/* 店铺基础数据 */}
                                <div className="space-y-2">
                                    <Collapsible defaultOpen>
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium py-2 px-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                            <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
                                            店铺基础数据（{totalEntries} 个店铺，总销售额 ¥{fmt(totalSales)}）
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="px-3 pt-2">
                                            <div className="overflow-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-8">匹配</TableHead>
                                                            <TableHead>Excel名称</TableHead>
                                                            <TableHead>系统店铺</TableHead>
                                                            <TableHead className="text-right">销售额</TableHead>
                                                            <TableHead className="text-right">原料成本</TableHead>
                                                            <TableHead className="text-right">包装成本</TableHead>
                                                            <TableHead className="text-right">人工成本</TableHead>
                                                            <TableHead className="text-right">快递费</TableHead>
                                                            <TableHead className="text-right">店铺费用</TableHead>
                                                            <TableHead className="text-right">分摊费用</TableHead>
                                                            <TableHead className="text-right">毛利</TableHead>
                                                            <TableHead className="text-right">净利润</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {preview.entries.map((e: any, i: number) => {
                                                            const totalShipping = e.shippingTotal ?? e.shippingCosts?.reduce((s: number, sc: any) => s + sc.amount, 0) ?? 0;
                                                            const totalStore = e.storeExpenseTotal ?? e.storeExpenses?.reduce((s: number, se: any) => s + se.amount, 0) ?? 0;
                                                            const totalAlloc = e.allocations?.reduce((s: number, a: any) => s + a.amount, 0) || 0;
                                                            return (
                                                                <TableRow key={i} className={e.matched ? '' : 'bg-red-50 dark:bg-red-950/20'}>
                                                                    <TableCell>
                                                                        {e.matched
                                                                            ? <CheckCircle className="w-4 h-4 text-green-500" />
                                                                            : <XCircle className="w-4 h-4 text-red-500" />}
                                                                    </TableCell>
                                                                    <TableCell className="font-medium">{e.excelName}</TableCell>
                                                                    <TableCell className="text-muted-foreground">{e.shopName || '-'}</TableCell>
                                                                    <TableCell className="text-right font-mono">{fmt(e.salesAmount)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{fmt(e.rawMaterialCost)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{fmt(e.packagingCost)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{fmt(e.laborCost)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{fmt(totalShipping)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{fmt(totalStore)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{fmt(totalAlloc)}</TableCell>
                                                                    <TableCell className="text-right font-mono">{fmt(e.grossProfit)}</TableCell>
                                                                    <TableCell className={`text-right font-mono ${e.netProfit < 0 ? 'text-red-500' : ''}`}>{fmt(e.netProfit)}</TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* 公司费用 */}
                                    <Collapsible>
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium py-2 px-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                            <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
                                            公司费用（{preview.companyExpenses?.length || 0} 项，合计 ¥{fmt(preview.companyExpenses?.reduce((s: number, e: any) => s + e.amount, 0) || 0)}）
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="px-3 pt-2">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>费用名称</TableHead>
                                                        <TableHead className="text-right">金额</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {preview.companyExpenses?.map((e: any, i: number) => (
                                                        <TableRow key={i}>
                                                            <TableCell>{e.name}</TableCell>
                                                            <TableCell className="text-right font-mono">{fmt(e.amount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* 不计入费用 */}
                                    <Collapsible>
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium py-2 px-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                            <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
                                            不计入费用（{preview.nonExpenses?.length || 0} 项，合计 ¥{fmt(preview.nonExpenses?.reduce((s: number, e: any) => s + e.amount, 0) || 0)}）
                                        </CollapsibleTrigger>
                                        <CollapsibleContent className="px-3 pt-2">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>费用名称</TableHead>
                                                        <TableHead className="text-right">金额</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {preview.nonExpenses?.map((e: any, i: number) => (
                                                        <TableRow key={i}>
                                                            <TableCell>{e.name}</TableCell>
                                                            <TableCell className="text-right font-mono">{fmt(e.amount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CollapsibleContent>
                                    </Collapsible>

                                    {/* 分摊类别 */}
                                    {preview.allocationCategories?.length > 0 && (
                                        <Collapsible>
                                            <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium py-2 px-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                                <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200 [[data-state=closed]>&]:rotate-[-90deg]" />
                                                分摊类别（{preview.allocationCategories.length} 项）
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="px-3 pt-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {preview.allocationCategories.map((c: string, i: number) => (
                                                        <Badge key={i} variant="secondary">{c}</Badge>
                                                    ))}
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => handleClose(false)}>
                        取消
                    </Button>
                    {preview && (
                        <Button
                            onClick={handleConfirm}
                            disabled={
                                importing
                                || matchedEntries < totalEntries
                                || (preview.existingReportId && preview.existingReportStatus !== 'DRAFT')
                            }
                        >
                            {importing ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            ) : (
                                <CheckCircle className="w-4 h-4 mr-1" />
                            )}
                            {importing ? '导入中...' : preview.existingReportId ? '覆盖导入' : '确认导入'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

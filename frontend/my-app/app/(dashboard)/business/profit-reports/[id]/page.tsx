'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import {
    ArrowLeft, Save, CheckCircle, Undo2,
    Loader2, FileSpreadsheet,
} from 'lucide-react';
import ProfitTable from './components/ProfitTable';
import CompanyExpenseSection from './components/CompanyExpenseSection';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ProfitReportDetailPage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState(false);

    // 表格编辑数据（本地状态）
    const [editData, setEditData] = useState<Record<string, any>>({});
    // 分摊编辑数据: { entryId: { categoryId: amount } }
    const [allocData, setAllocData] = useState<
        Record<string, Record<string, number>>
    >({});

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiClient.getProfitReport(id);
            setReport(data);
            // 初始化编辑数据
            const init: Record<string, any> = {};
            const initAlloc: Record<string, Record<string, number>> = {};
            for (const entry of data.entries || []) {
                init[entry.id] = {
                    salesAmount: Number(entry.salesAmount) || 0,
                    rawMaterialCost: Number(entry.rawMaterialCost) || 0,
                    packagingCost: Number(entry.packagingCost) || 0,
                    laborCost: Number(entry.laborCost) || 0,
                };
                const am: Record<string, number> = {};
                for (const a of entry.allocations || []) {
                    am[a.categoryId] = Number(a.amount) || 0;
                }
                initAlloc[entry.id] = am;
            }
            setEditData(init);
            setAllocData(initAlloc);
        } catch (error: any) {
            alert(error.message || '加载失败');
            router.push('/business/profit-reports');
        } finally {
            setLoading(false);
        }
    }, [id, router]);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const isDraft = report?.status === 'DRAFT';

    const handleSave = async () => {
        try {
            setSaving(true);
            const entries = Object.entries(editData).map(
                ([entryId, d]: [string, any]) => ({
                    entryId,
                    salesAmount: d.salesAmount || 0,
                    rawMaterialCost: d.rawMaterialCost || 0,
                    packagingCost: d.packagingCost || 0,
                    laborCost: d.laborCost || 0,
                }),
            );
            await apiClient.saveProfitEntries(id, { entries });
            // 保存分摊数据
            const allocItems: any[] = [];
            for (const [entryId, cats] of Object.entries(allocData)) {
                for (const [categoryId, amount] of Object.entries(cats)) {
                    if (amount) {
                        allocItems.push({ entryId, categoryId, amount });
                    }
                }
            }
            if (allocItems.length > 0) {
                await apiClient.saveProfitAllocations(
                    id, { items: allocItems },
                );
            }
            await fetchReport();
        } catch (error: any) {
            alert(error.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleConfirm = async () => {
        if (!confirm('确认后数据将锁定，确定要确认吗？')) return;
        try {
            setConfirming(true);
            await apiClient.confirmProfitReport(id);
            await fetchReport();
        } catch (error: any) {
            alert(error.message || '确认失败');
        } finally {
            setConfirming(false);
        }
    };

    const handleRevoke = async () => {
        if (!confirm('确定要撤销确认吗？')) return;
        try {
            await apiClient.revokeProfitReport(id);
            await fetchReport();
        } catch (error: any) {
            alert(error.message || '撤销失败');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!report) return null;

    return (
        <div className="space-y-4">
            {/* 顶部栏 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => router.push('/business/profit-reports')}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">
                            {report.year}年{report.month}月利润表
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {isDraft ? (
                                <span className="text-yellow-500">草稿</span>
                            ) : (
                                <span className="text-green-500">
                                    <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                                    已确认
                                </span>
                            )}
                            {' · '}{report.entries?.length || 0} 个店铺
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline" size="sm"
                        onClick={handleSave} disabled={saving}
                    >
                        {saving
                            ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            : <Save className="w-4 h-4 mr-1" />}
                        保存
                    </Button>
                    {isDraft ? (
                        <Button
                            size="sm"
                            onClick={handleConfirm}
                            disabled={confirming}
                        >
                            {confirming
                                ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                : <CheckCircle className="w-4 h-4 mr-1" />}
                            确认发布
                        </Button>
                    ) : (
                        <Button
                            variant="outline" size="sm"
                            onClick={handleRevoke}
                        >
                            <Undo2 className="w-4 h-4 mr-1" />
                            撤销确认
                        </Button>
                    )}
                </div>
            </div>

            {/* 核心利润表格 */}
            <ProfitTable
                report={report}
                editData={editData}
                setEditData={setEditData}
                allocData={allocData}
                setAllocData={setAllocData}
                isDraft={true}
                reportId={id}
                onRefresh={fetchReport}
            />

            {/* 公司费用 & 不计入费用 */}
            <CompanyExpenseSection
                report={report}
                reportId={id}
                isDraft={true}
                onRefresh={fetchReport}
            />
        </div>
    );
}

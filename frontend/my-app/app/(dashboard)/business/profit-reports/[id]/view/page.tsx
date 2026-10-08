'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { usePermissionStore } from '@/lib/stores/permission-store';
import {
    ArrowLeft, Loader2, FileSpreadsheet,
    CheckCircle, FileEdit,
} from 'lucide-react';
import ProfitTable from '../components/ProfitTable';
import CompanyExpenseSection from '../components/CompanyExpenseSection';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ProfitReportViewPage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();
    const { hasPermission } = usePermissionStore();
    const canEdit = hasPermission('profit:edit');
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editData, setEditData] = useState<Record<string, any>>({});
    const [allocData, setAllocData] = useState<
        Record<string, Record<string, number>>
    >({});

    const fetchReport = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiClient.getProfitReport(id);
            setReport(data);
            const init: Record<string, any> = {};
            const initAlloc: Record<
                string, Record<string, number>
            > = {};
            for (const entry of data.entries || []) {
                init[entry.id] = {
                    salesAmount:
                        Number(entry.salesAmount) || 0,
                    rawMaterialCost:
                        Number(entry.rawMaterialCost) || 0,
                    packagingCost:
                        Number(entry.packagingCost) || 0,
                    laborCost:
                        Number(entry.laborCost) || 0,
                };
                const am: Record<string, number> = {};
                for (const a of entry.allocations || []) {
                    am[a.categoryId] =
                        Number(a.amount) || 0;
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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2
                    className="w-8 h-8 animate-spin
                        text-muted-foreground"
                />
            </div>
        );
    }

    if (!report) return null;

    const isDraft = report.status === 'DRAFT';

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => router.push(
                            '/business/profit-reports',
                        )}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="w-10 h-10 rounded-lg bg-primary/10
                        flex items-center justify-center">
                        <FileSpreadsheet
                            className="w-5 h-5 text-primary"
                        />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">
                            {report.year}年{report.month}月利润表
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {isDraft ? (
                                <span className="text-yellow-500">
                                    草稿
                                </span>
                            ) : (
                                <span className="text-green-500">
                                    <CheckCircle
                                        className="w-3.5 h-3.5
                                            inline mr-1"
                                    />
                                    已确认
                                </span>
                            )}
                            {' · '}
                            {report.entries?.length || 0} 个店铺
                            {' · 只读模式'}
                        </p>
                    </div>
                </div>
                {canEdit && (
                    <Button
                        variant="outline" size="sm"
                        onClick={() => router.push(
                            `/business/profit-reports/${id}`,
                        )}
                    >
                        <FileEdit className="w-4 h-4 mr-1" />
                        编辑
                    </Button>
                )}
            </div>

            <ProfitTable
                report={report}
                editData={editData}
                setEditData={setEditData}
                allocData={allocData}
                setAllocData={setAllocData}
                isDraft={false}
                reportId={id}
                onRefresh={fetchReport}
            />

            {canEdit && (
                <CompanyExpenseSection
                    report={report}
                    reportId={id}
                    isDraft={false}
                    onRefresh={fetchReport}
                />
            )}
        </div>
    );
}

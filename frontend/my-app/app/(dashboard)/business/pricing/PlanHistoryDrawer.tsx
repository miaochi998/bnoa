'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { Trash2, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { PlanData } from './types';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentLinkId?: string;
    onLoadPlan: (plan: PlanData) => void;
}

export function PlanHistoryDrawer({
    open, onOpenChange,
    currentLinkId, onLoadPlan,
}: Props) {
    const [plans, setPlans] =
        useState<PlanData[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] =
        useState<string | null>(null);

    const loadPlans = async () => {
        setLoading(true);
        try {
            const data =
                await apiClient.getPricingPlans({
                    linkId: currentLinkId || undefined,
                    pageSize: 50,
                });
            setPlans(data.list || []);
        } catch {
            setPlans([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) loadPlans();
    }, [open]);

    const handleDelete = async (id: string) => {
        if (!confirm('确定删除此方案？')) return;
        setDeleting(id);
        try {
            await apiClient.deletePricingPlan(id);
            setPlans((prev) =>
                prev.filter((p) => p.id !== id));
        } catch {
            alert('删除失败');
        } finally {
            setDeleting(null);
        }
    };

    const handleLoad = (plan: PlanData) => {
        onLoadPlan(plan);
        onOpenChange(false);
    };

    const fmtDate = (d: string) => {
        const dt = new Date(d);
        const pad = (n: number) =>
            String(n).padStart(2, '0');
        return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    };

    const fmtRates = (rates: number[]) => {
        if (!rates || rates.length === 0) return '-';
        return rates
            .map((r) =>
                `${(Number(r) * 100).toFixed(0)}%`)
            .join(', ');
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="bg-[#262626] border-[#1e1e1e] text-white sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        历史方案
                    </DialogTitle>
                </DialogHeader>
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-[#8e8e8e]" />
                    </div>
                ) : plans.length === 0 ? (
                    <div className="text-center py-12 text-[#8e8e8e]">
                        暂无保存的方案
                    </div>
                ) : (
                    <div className="space-y-2">
                        {plans.map((plan) => (
                            <div
                                key={plan.id}
                                className="flex items-center justify-between p-3 bg-[#1e1e1e] rounded-lg border border-[#3e3e3e]"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white font-medium truncate">
                                        {plan.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-[#8e8e8e]">
                                        {plan.link && (
                                            <span className="truncate max-w-[200px]">
                                                {plan.link.name}
                                                {plan.link.shop && (
                                                    <span className="ml-1">
                                                        ({plan.link.shop.platform?.name} - {plan.link.shop.name})
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                        <span>·</span>
                                        <span className="shrink-0">
                                            {fmtDate(plan.createdAt)}
                                        </span>
                                    </div>
                                    <div className="text-xs text-[#666] mt-1">
                                        利润率: {fmtRates(plan.profitRates)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-3 shrink-0">
                                    <Button
                                        size="sm"
                                        onClick={() =>
                                            handleLoad(plan)}
                                        className="h-7 text-xs bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                                    >
                                        <Download className="w-3 h-3 mr-1" />
                                        加载
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            handleDelete(
                                                plan.id)}
                                        disabled={
                                            deleting === plan.id
                                        }
                                        className="h-7 text-xs border-[#3e3e3e] bg-transparent text-[#8e8e8e] hover:text-red-400 hover:border-red-400/50"
                                    >
                                        {deleting === plan.id
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <Trash2 className="w-3 h-3" />
                                        }
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

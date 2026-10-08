'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Calculator, Save, AlertTriangle,
    Settings2, History, Loader2,
} from 'lucide-react';
import { ProfitRateDialog } from './ProfitRateDialog';
import { PricingMatrix } from './PricingMatrix';
import { TentativeAnalysis } from './TentativeAnalysis';
import {
    TalentCommissionAnalysis,
} from './TalentCommissionAnalysis';
import {
    MatrixResult, TentativeMap, PlanData,
} from './types';

interface LinkOption {
    id: string;
    name: string;
    status: string;
    shop?: {
        name: string;
        platform?: { name: string };
    };
}

export default function PricingPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const planLoadedRef = useRef(false);

    const [links, setLinks] =
        useState<LinkOption[]>([]);
    const [linkId, setLinkId] = useState('');
    const [selectedRates, setSelectedRates] =
        useState<number[]>([0, 10, 20, 30, 50]);
    const [rateDialogOpen, setRateDialogOpen] =
        useState(false);
    const [commissionRate, setCommissionRate] =
        useState('5');
    const [taxRate, setTaxRate] = useState('0');
    const [loading, setLoading] = useState(false);
    const [result, setResult] =
        useState<MatrixResult | null>(null);
    const [tentativeMap, setTentativeMap] =
        useState<TentativeMap>({});
    const [talentRate, setTalentRate] =
        useState('10');
    const [saveOpen, setSaveOpen] = useState(false);
    const [planName, setPlanName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        apiClient.getPricingLinksForSelect()
            .then(setLinks).catch(() => {});
    }, []);

    // 从 URL 参数自动加载方案
    useEffect(() => {
        const planId = searchParams.get('planId');
        if (planId && !planLoadedRef.current) {
            planLoadedRef.current = true;
            apiClient.getPricingPlan(planId)
                .then((plan: PlanData) => {
                    handleLoadPlan(plan);
                    // 清除 URL 参数
                    router.replace('/business/pricing', { scroll: false });
                })
                .catch(() => {});
        }
    }, [searchParams]);

    const handleCalculate = async () => {
        if (!linkId) {
            alert('请选择链接'); return;
        }
        const rates = selectedRates.map(
            (n) => n / 100,
        );
        if (rates.length === 0) {
            alert('请先设置利润率'); return;
        }
        const cr = parseFloat(commissionRate) / 100;
        const tr = parseFloat(taxRate) / 100;
        if (isNaN(cr) || cr < 0 || cr >= 1) {
            alert('佣金率无效'); return;
        }
        setLoading(true);
        try {
            const data =
                await apiClient.calculatePricingMatrix({
                    linkId,
                    profitRates: rates,
                    commissionRate: cr,
                    taxRate: tr || 0,
                });
            setResult(data);
            setTentativeMap({});
        } catch (error: any) {
            alert('计算失败: '
                + (error.message || '请稍后重试'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!planName.trim()) {
            alert('请输入方案名称'); return;
        }
        setSaving(true);
        try {
            const cr =
                parseFloat(commissionRate) / 100;
            const tr =
                parseFloat(taxRate) / 100;
            const tcr =
                parseFloat(talentRate) / 100;
            await apiClient.savePricingPlan({
                linkId,
                name: planName.trim(),
                profitRates: selectedRates.map(
                    (n) => n / 100,
                ),
                commissionRate: cr,
                taxRate: tr || 0,
                selectedPrices:
                    Object.keys(tentativeMap).length > 0
                        ? tentativeMap : undefined,
                talentCommissionRate:
                    !isNaN(tcr) ? tcr : undefined,
            });
            setSaveOpen(false);
            setPlanName('');
            alert('方案保存成功');
        } catch (error: any) {
            alert('保存失败: '
                + (error.message || '请稍后重试'));
        } finally {
            setSaving(false);
        }
    };

    const handleLoadPlan = async (plan: PlanData) => {
        setLinkId(plan.linkId);
        setSelectedRates(
            (plan.profitRates || []).map(
                (r) => Number(r) * 100,
            ),
        );
        setCommissionRate(
            String(Number(plan.commissionRate) * 100),
        );
        setTaxRate(
            String(Number(plan.taxRate || 0) * 100),
        );
        if (plan.talentCommissionRate != null) {
            setTalentRate(
                String(
                    Number(
                        plan.talentCommissionRate,
                    ) * 100,
                ),
            );
        }
        setLoading(true);
        try {
            const data =
                await apiClient.calculatePricingMatrix({
                    linkId: plan.linkId,
                    profitRates:
                        (plan.profitRates || [])
                            .map(Number),
                    commissionRate:
                        Number(plan.commissionRate),
                    taxRate:
                        Number(plan.taxRate || 0),
                });
            setResult(data);
            setTentativeMap(
                plan.selectedPrices || {},
            );
        } catch (error: any) {
            alert('加载失败: '
                + (error.message || '请稍后重试'));
        } finally {
            setLoading(false);
        }
    };

    const cr = parseFloat(commissionRate) / 100;
    const tr = parseFloat(taxRate) / 100;

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-white">
                    定价计算
                </h1>
                <p className="text-sm text-[#8e8e8e] mt-1">
                    基于链接维度，生成多利润率定价矩阵和佣金分析
                </p>
            </div>
            <Card className="bg-[#262626] border-[#1e1e1e]">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base text-white flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        计算参数
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-white">
                                选择链接
                                <span className="text-red-500 ml-1">*</span>
                            </Label>
                            <Select value={linkId} onValueChange={setLinkId}>
                                <SelectTrigger className="bg-[#1e1e1e] border-[#1e1e1e] text-white">
                                    <SelectValue placeholder="选择链接" />
                                </SelectTrigger>
                                <SelectContent className="bg-[#2e2e2e] border-[#1e1e1e]">
                                    {links.map((l) => (
                                        <SelectItem key={l.id} value={l.id} className="text-white">
                                            {l.name}
                                            {l.shop && (
                                                <span className="text-[#8e8e8e] ml-1">
                                                    ({l.shop.platform?.name} - {l.shop.name})
                                                </span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-white">
                                利润率(%)
                                <span className="text-red-500 ml-1">*</span>
                            </Label>
                            <Button
                                variant="outline"
                                onClick={() => setRateDialogOpen(true)}
                                className="w-full justify-start bg-[#1e1e1e] border-[#1e1e1e] text-white hover:bg-[#2e2e2e] h-auto min-h-[40px] py-2"
                            >
                                <Settings2 className="w-4 h-4 mr-2 shrink-0 text-[#8e8e8e]" />
                                {selectedRates.length > 0 ? (
                                    <span className="text-left truncate">
                                        已选 {selectedRates.length} 个：{selectedRates.join('%, ')}%
                                    </span>
                                ) : (
                                    <span className="text-[#8e8e8e]">点击设置利润率</span>
                                )}
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-white">平台佣金率(%)</Label>
                            <Input
                                type="number" step="0.1" min="0" max="99"
                                value={commissionRate}
                                onChange={(e) => setCommissionRate(e.target.value)}
                                className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-white">税费率(%)</Label>
                            <Input
                                type="number" step="0.1" min="0" max="99"
                                value={taxRate}
                                onChange={(e) => setTaxRate(e.target.value)}
                                className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                            />
                        </div>
                        <div className="flex items-end gap-2">
                            <Button
                                onClick={handleCalculate} disabled={loading}
                                className="bg-[#409fff] hover:bg-[#409fff]/90 text-white flex-1"
                            >
                                <Calculator className="w-4 h-4 mr-2" />
                                {loading ? '计算中...' : '开始计算'}
                            </Button>
                            {result && (
                                <Button
                                    variant="outline"
                                    onClick={() => setSaveOpen(true)}
                                    className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    保存方案
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                onClick={() => router.push('/business/pricing/plans')}
                                className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                            >
                                <History className="w-4 h-4 mr-2" />
                                历史方案
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
            {result && result.skus.length > 0 && (
                <PricingMatrix
                    result={result}
                    commissionRate={cr}
                    taxRate={tr}
                    tentativeMap={tentativeMap}
                    onTentativeChange={setTentativeMap}
                />
            )}
            {result && result.skus.length === 0 && (
                <Card className="bg-[#262626] border-[#1e1e1e]">
                    <CardContent className="py-12 text-center">
                        <AlertTriangle className="w-8 h-8 text-[#eab308] mx-auto mb-3" />
                        <p className="text-[#8e8e8e]">该链接下没有启用的SKU</p>
                    </CardContent>
                </Card>
            )}
            {result && result.skus.length > 0 && (
                <TentativeAnalysis
                    result={result} commissionRate={cr}
                    taxRate={tr} tentativeMap={tentativeMap}
                />
            )}
            {result && result.skus.length > 0 && (
                <TalentCommissionAnalysis
                    result={result} commissionRate={cr}
                    taxRate={tr}
                    tentativeMap={tentativeMap}
                    talentRate={talentRate}
                    onTalentRateChange={setTalentRate}
                />
            )}
            <ProfitRateDialog
                open={rateDialogOpen}
                onOpenChange={setRateDialogOpen}
                selectedRates={selectedRates}
                onConfirm={setSelectedRates}
            />
            <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
                <DialogContent className="bg-[#262626] border-[#1e1e1e] text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>保存定价方案</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-white">
                                方案名称
                                <span className="text-red-500 ml-1">*</span>
                            </Label>
                            <Input
                                value={planName}
                                onChange={(e) => setPlanName(e.target.value)}
                                placeholder="如：纳米魔力擦-抖音定价方案"
                                className="bg-[#1e1e1e] border-[#1e1e1e] text-white"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setSaveOpen(false)}
                                className="border-[#1e1e1e] bg-[#2e2e2e] text-white hover:bg-[#363636]"
                            >
                                取消
                            </Button>
                            <Button
                                onClick={handleSave} disabled={saving}
                                className="bg-[#409fff] hover:bg-[#409fff]/90 text-white"
                            >
                                {saving ? '保存中...' : '保存'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

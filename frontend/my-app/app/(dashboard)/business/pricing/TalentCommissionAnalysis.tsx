'use client';

import { HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
    Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip';
import {
    MatrixResult, TentativeMap, fmt, pct,
} from './types';

interface Props {
    result: MatrixResult;
    commissionRate: number;
    taxRate: number;
    tentativeMap: TentativeMap;
    talentRate: string;
    onTalentRateChange: (v: string) => void;
}

function Tip({ text }: { text: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-[#666] inline ml-1 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="bg-[#1e1e1e] text-white border-[#3e3e3e] max-w-[220px] text-xs">
                {text}
            </TooltipContent>
        </Tooltip>
    );
}

interface Entry {
    skuId: string;
    skuName: string;
    talentRate: number;
    commAmt: number;
    adjProfit: number;
    adjRate: number;
    breakEven: number;
}

export function TalentCommissionAnalysis({
    result, commissionRate, taxRate, tentativeMap,
    talentRate, onTalentRateChange,
}: Props) {
    const rate = parseFloat(talentRate) / 100;
    const validRate =
        !isNaN(rate) && rate >= 0 && rate < 1;

    const entries: Entry[] = [];
    for (const sku of result.skus) {
        const pr = tentativeMap[sku.skuId];
        if (pr === undefined) continue;

        // 尝试从预设价格中查找
        let cell = sku.prices.find(
            (p) => p.profitRate === pr,
        );

        // 如果找不到（自定义利润率），则重新计算
        if (!cell) {
            const divisor = 1 - commissionRate - taxRate;
            const cost = sku.skuCost;
            const sp = cost * (1 + pr) / divisor;
            const gp = sp * divisor - cost;

            cell = {
                profitRate: pr,
                sellingPrice: Math.round(sp * 100) / 100,
                grossProfit: Math.round(gp * 100) / 100,
                netProfitRate: sp > 0
                    ? Math.round((gp / sp) * 10000) / 10000
                    : 0,
            };
        }

        const sp = cell.sellingPrice;
        const gp = cell.grossProfit;
        const commAmt = validRate ? sp * rate : 0;
        entries.push({
            skuId: sku.skuId,
            skuName: sku.skuName,
            talentRate: validRate ? rate : 0,
            commAmt,
            adjProfit: gp - commAmt,
            adjRate: sp > 0
                ? (gp - commAmt) / sp : 0,
            breakEven: sp > 0
                ? gp / sp : 0,
        });
    }

    if (entries.length === 0) return null;

    const TH = 'text-right text-[#8e8e8e] py-3 px-3 whitespace-nowrap';
    const TD = 'py-3 px-3 text-right whitespace-nowrap';

    return (
        <Card className="bg-[#262626] border-[#1e1e1e]">
            <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">
                    达人佣金分析
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm text-[#8e8e8e]">
                        达人佣金率:
                    </span>
                    <div className="flex items-center gap-1">
                        <Input
                            type="number"
                            step="0.001"
                            min="0"
                            max="99"
                            value={talentRate}
                            onChange={(e) =>
                                onTalentRateChange(
                                    e.target.value)}
                            className="w-[100px] h-8 bg-[#1e1e1e] border-[#3e3e3e] text-white text-sm"
                        />
                        <span className="text-sm text-[#8e8e8e]">
                            %
                        </span>
                    </div>
                    <span className="text-xs text-[#8e8e8e]">
                        修改佣金率后，下方表格数据将自动更新
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#1e1e1e]">
                                <th className="text-left text-[#8e8e8e] py-3 px-3 whitespace-nowrap">
                                    SKU <Tip text="SKU名称" />
                                </th>
                                <th className={TH}>
                                    达人佣金率 <Tip text="分配给达人的佣金比例" />
                                </th>
                                <th className={TH}>
                                    佣金金额 <Tip text="暂定售价 × 达人佣金率" />
                                </th>
                                <th className={TH}>
                                    调整后毛利润 <Tip text="原毛利润 - 达人佣金金额" />
                                </th>
                                <th className={TH}>
                                    调整后利润率 <Tip text="调整后毛利润 / 暂定售价" />
                                </th>
                                <th className={TH}>
                                    零利润临界佣金率 <Tip text="最多可分配的达人佣金率上限，超过将亏损" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e) => (
                                <tr
                                    key={e.skuId}
                                    className="border-b border-[#1e1e1e] hover:bg-[#2e2e2e]"
                                >
                                    <td className="py-3 px-3 text-white whitespace-nowrap">
                                        {e.skuName}
                                    </td>
                                    <td className={`${TD} text-white`}>
                                        {pct(e.talentRate)}
                                    </td>
                                    <td className={`${TD} text-[#eab308]`}>
                                        {fmt(e.commAmt)}
                                    </td>
                                    <td className={`${TD} ${
                                        e.adjProfit < 0
                                            ? 'text-red-400'
                                            : 'text-[#22c55e]'
                                    }`}>
                                        {fmt(e.adjProfit)}
                                    </td>
                                    <td className={`${TD} ${
                                        e.adjRate < 0
                                            ? 'text-red-400'
                                            : 'text-[#22c55e]'
                                    }`}>
                                        {pct(e.adjRate)}
                                    </td>
                                    <td className={`${TD} text-[#eab308] font-medium`}>
                                        {pct(e.breakEven)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

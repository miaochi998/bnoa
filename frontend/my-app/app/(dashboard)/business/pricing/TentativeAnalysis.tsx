'use client';

import { HelpCircle } from 'lucide-react';
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
}

function Tip({ text }: { text: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <HelpCircle className="w-3 h-3 text-[#666] inline ml-1 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="bg-[#1e1e1e] text-white border-[#3e3e3e] max-w-[200px] text-xs">
                {text}
            </TooltipContent>
        </Tooltip>
    );
}

interface Entry {
    skuId: string;
    skuName: string;
    sp: number;
    cost: number;
    grossProfit: number;
    profitRate: number;
    commAmt: number;
    commRate: number;
    netRate: number;
}

export function TentativeAnalysis({
    result, commissionRate, taxRate, tentativeMap,
}: Props) {
    const entries: Entry[] = [];

    for (const sku of result.skus) {
        const rate = tentativeMap[sku.skuId];
        if (rate === undefined) continue;

        // 尝试从预设价格中查找
        let cell = sku.prices.find(
            (p) => p.profitRate === rate,
        );

        // 如果找不到（自定义利润率），则重新计算
        if (!cell) {
            const divisor = 1 - commissionRate - taxRate;
            const cost = sku.skuCost;
            const sp = cost * (1 + rate) / divisor;
            const gp = sp * divisor - cost;

            cell = {
                profitRate: rate,
                sellingPrice: Math.round(sp * 100) / 100,
                grossProfit: Math.round(gp * 100) / 100,
                netProfitRate: sp > 0
                    ? Math.round((gp / sp) * 10000) / 10000
                    : 0,
            };
        }

        entries.push({
            skuId: sku.skuId,
            skuName: sku.skuName,
            sp: cell.sellingPrice,
            cost: sku.skuCost,
            grossProfit: cell.grossProfit,
            profitRate: rate,
            commAmt: cell.sellingPrice * commissionRate,
            commRate: commissionRate,
            netRate: cell.netProfitRate,
        });
    }

    if (entries.length === 0) return null;

    const TH = 'text-right text-[#8e8e8e] py-3 px-3 whitespace-nowrap';
    const TD = 'py-3 px-3 text-right whitespace-nowrap';

    return (
        <Card className="bg-[#262626] border-[#1e1e1e]">
            <CardHeader className="pb-3">
                <CardTitle className="text-base text-white">
                    当前暂定售价及利润分析
                    ({entries.length} 个SKU)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#1e1e1e]">
                                <th className="text-left text-[#8e8e8e] py-3 px-3 whitespace-nowrap">
                                    SKU <Tip text="SKU名称" />
                                </th>
                                <th className={TH}>
                                    暂定售价 <Tip text="在利润售价表中选择的售价" />
                                </th>
                                <th className={TH}>
                                    SKU总成本 <Tip text="SKU综合成本（产品+快递+杂费）" />
                                </th>
                                <th className={TH}>
                                    毛利润 <Tip text="售价 - 成本 - 平台佣金 - 税费" />
                                </th>
                                <th className={TH}>
                                    期望利润率 <Tip text="基于成本的利润加成比例" />
                                </th>
                                <th className={TH}>
                                    平台佣金金额 <Tip text="售价 × 平台佣金率" />
                                </th>
                                <th className={TH}>
                                    平台佣金率 <Tip text="平台收取的佣金比例" />
                                </th>
                                <th className={TH}>
                                    净利润率 <Tip text="毛利润 / 售价" />
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
                                    <td className={`${TD} text-[#22c55e] font-medium`}>
                                        {fmt(e.sp)}
                                    </td>
                                    <td className={`${TD} text-white`}>
                                        {fmt(e.cost)}
                                    </td>
                                    <td className={`${TD} text-[#22c55e]`}>
                                        {fmt(e.grossProfit)}
                                    </td>
                                    <td className={`${TD} text-[#409fff]`}>
                                        {pct(e.profitRate)}
                                    </td>
                                    <td className={`${TD} text-[#eab308]`}>
                                        {fmt(e.commAmt)}
                                    </td>
                                    <td className={`${TD} text-white`}>
                                        {pct(e.commRate)}
                                    </td>
                                    <td className={`${TD} text-[#22c55e] font-medium`}>
                                        {pct(e.netRate)}
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

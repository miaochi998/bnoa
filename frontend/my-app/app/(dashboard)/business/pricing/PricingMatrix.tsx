'use client';

import { useState } from 'react';
import { Star, Check } from 'lucide-react';
import {
    Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    MatrixResult, TentativeMap, fmt, pct,
    calculateProfitRateFromPrice,
} from './types';

interface Props {
    result: MatrixResult;
    commissionRate: number;
    taxRate: number;
    tentativeMap: TentativeMap;
    onTentativeChange: (map: TentativeMap) => void;
}

export function PricingMatrix({
    result, commissionRate, taxRate,
    tentativeMap, onTentativeChange,
}: Props) {
    const [skuFilter, setSkuFilter] =
        useState('all');

    // 自定义售价输入值（字符串，便于输入）
    const [customPriceInputs, setCustomPriceInputs] =
        useState<Record<string, string>>({});

    // 已确认的自定义售价（用于判断按钮状态）
    const [confirmedCustomPrices, setConfirmedCustomPrices] =
        useState<Record<string, string>>({});

    const skus = skuFilter === 'all'
        ? result.skus
        : result.skus.filter(
            (s) => s.skuId === skuFilter,
        );
    const tentativeCount =
        Object.keys(tentativeMap).length;

    const toggle = (
        skuId: string, rate: number,
    ) => {
        const next = { ...tentativeMap };
        if (next[skuId] === rate) {
            delete next[skuId];
        } else {
            next[skuId] = rate;
        }
        onTentativeChange(next);
    };

    // 处理自定义售价输入
    const handleCustomPriceInput = (
        skuId: string, value: string,
    ) => {
        setCustomPriceInputs(prev => ({
            ...prev,
            [skuId]: value,
        }));
    };

    // 确认自定义售价
    const confirmCustomPrice = (skuId: string) => {
        const priceStr = customPriceInputs[skuId];
        if (!priceStr || priceStr.trim() === '') {
            alert('请输入售价');
            return;
        }

        const targetPrice = parseFloat(priceStr);
        if (isNaN(targetPrice) || targetPrice <= 0) {
            alert('请输入有效的售价（大于0）');
            return;
        }

        const sku = result.skus.find(s => s.skuId === skuId);
        if (!sku) return;

        // 反向计算利润率
        const calculated = calculateProfitRateFromPrice(
            targetPrice,
            sku.skuCost,
            commissionRate,
            taxRate,
        );

        if (!calculated) {
            alert('计算失败，请检查输入的售价是否合理');
            return;
        }

        // 验证合理性
        if (calculated.profitRate < -0.5) {
            const confirm = window.confirm(
                `警告：该售价将导致严重亏损（利润率：${pct(calculated.profitRate)}），确定要使用吗？`
            );
            if (!confirm) return;
        }

        // 更新tentativeMap（使用计算出的利润率）
        onTentativeChange({
            ...tentativeMap,
            [skuId]: calculated.profitRate,
        });

        // 记录已确认的售价
        setConfirmedCustomPrices(prev => ({
            ...prev,
            [skuId]: priceStr,
        }));
    };

    // 获取自定义售价的计算结果
    const getCustomPriceCalc = (skuId: string) => {
        const priceStr = customPriceInputs[skuId];
        if (!priceStr || priceStr.trim() === '') return null;

        const targetPrice = parseFloat(priceStr);
        if (isNaN(targetPrice) || targetPrice <= 0) return null;

        const sku = result.skus.find(s => s.skuId === skuId);
        if (!sku) return null;

        return calculateProfitRateFromPrice(
            targetPrice,
            sku.skuCost,
            commissionRate,
            taxRate,
        );
    };

    const rates = result.skus[0]?.prices ?? [];

    return (
        <Card className="bg-[#262626] border-[#1e1e1e]">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base text-white">
                        SKU利润售价表
                        {result.link && (
                            <span className="text-sm text-[#8e8e8e] ml-2 font-normal">
                                {result.link.name}
                            </span>
                        )}
                    </CardTitle>
                    <span className="text-xs px-2 py-1 rounded bg-[#1e1e1e] border border-[#3e3e3e] text-[#409fff]">
                        当前平台佣金率: {pct(commissionRate)}
                    </span>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[#8e8e8e]">
                            SKU:
                        </span>
                        <Select
                            value={skuFilter}
                            onValueChange={setSkuFilter}
                        >
                            <SelectTrigger className="w-[140px] h-8 text-xs bg-[#1e1e1e] border-[#3e3e3e] text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2e2e2e] border-[#3e3e3e]">
                                <SelectItem
                                    value="all"
                                    className="text-white text-xs"
                                >
                                    全部SKU
                                </SelectItem>
                                {result.skus.map((s) => (
                                    <SelectItem
                                        key={s.skuId}
                                        value={s.skuId}
                                        className="text-white text-xs"
                                    >
                                        {s.skuName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <span className="text-xs text-[#8e8e8e]">
                        共 {result.skus.length} 个SKU，已设置暂定价格 {tentativeCount} 个
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#1e1e1e]">
                                <th className="text-left text-[#8e8e8e] py-3 px-3 whitespace-nowrap">
                                    SKU
                                </th>
                                <th className="text-right text-[#8e8e8e] py-3 px-3 whitespace-nowrap">
                                    成本
                                </th>
                                {rates.map((p) => (
                                    <th
                                        key={p.profitRate}
                                        className="text-center text-[#8e8e8e] py-3 px-2 whitespace-nowrap"
                                    >
                                        {(p.profitRate * 100).toFixed(1)}%利润
                                    </th>
                                ))}
                                <th className="text-center text-[#8e8e8e] py-3 px-3 whitespace-nowrap min-w-[180px]">
                                    自定义售价
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {skus.map((sku) => {
                                const customCalc = getCustomPriceCalc(sku.skuId);
                                const isCustomSelected = tentativeMap[sku.skuId] !== undefined &&
                                    !sku.prices.some(p => p.profitRate === tentativeMap[sku.skuId]);

                                // 判断当前输入值是否与已确认的值相同
                                const currentInput = customPriceInputs[sku.skuId] || '';
                                const confirmedPrice = confirmedCustomPrices[sku.skuId] || '';
                                const isInputChanged = currentInput !== confirmedPrice;

                                // 按钮状态：已确认且未修改时显示绿色勾选，否则显示蓝色确认按钮
                                const showConfirmButton = !isCustomSelected || isInputChanged;

                                return (
                                    <tr
                                        key={sku.skuId}
                                        className="border-b border-[#1e1e1e]"
                                    >
                                        <td className="py-3 px-3 text-white whitespace-nowrap">
                                            {sku.skuName}
                                            <span className="text-xs text-[#8e8e8e] ml-1">
                                                ({sku.skuType === 'COMBO'
                                                    ? '组合' : '单品'})
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-right text-[#8e8e8e] whitespace-nowrap">
                                            {fmt(sku.skuCost)}
                                        </td>
                                        {sku.prices.map((p) => {
                                            const sel =
                                                tentativeMap[sku.skuId]
                                                    === p.profitRate;
                                            return (
                                                <td
                                                    key={p.profitRate}
                                                    className="py-2 px-2 text-center whitespace-nowrap"
                                                >
                                                    <div className="text-[#409fff] font-medium">
                                                        {fmt(p.sellingPrice)}
                                                    </div>
                                                    <div className="text-[10px] text-[#8e8e8e] mt-0.5">
                                                        毛利: {fmt(p.grossProfit)}
                                                    </div>
                                                    <button
                                                        onClick={() => toggle(
                                                            sku.skuId,
                                                            p.profitRate,
                                                        )}
                                                        className={`mt-1 text-[10px] px-1.5 py-0.5 rounded transition-colors inline-flex items-center gap-0.5 ${
                                                            sel
                                                                ? 'bg-[#409fff] text-white'
                                                                : 'bg-[#1e1e1e] text-[#8e8e8e] hover:text-white hover:bg-[#363636]'
                                                        }`}
                                                    >
                                                        <Star className={`w-2.5 h-2.5 ${sel ? 'fill-current' : ''}`} />
                                                        {sel ? '已选' : '暂定'}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                        <td className="py-2 px-3 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="flex items-center gap-1">
                                                    <Input
                                                        type="number"
                                                        step="0.001"
                                                        min="0"
                                                        max="9999.999"
                                                        placeholder="输入售价"
                                                        value={customPriceInputs[sku.skuId] || ''}
                                                        onChange={(e) => handleCustomPriceInput(
                                                            sku.skuId,
                                                            e.target.value
                                                        )}
                                                        className="w-[90px] h-7 text-xs bg-[#1e1e1e] border-[#3e3e3e] text-white"
                                                    />
                                                    {showConfirmButton ? (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => confirmCustomPrice(sku.skuId)}
                                                            disabled={!customPriceInputs[sku.skuId]}
                                                            className="h-7 px-2 text-xs bg-[#409fff] hover:bg-[#409fff]/90"
                                                        >
                                                            确认
                                                        </Button>
                                                    ) : (
                                                        <div className="h-7 px-2 flex items-center justify-center bg-[#22c55e] rounded text-white">
                                                            <Check className="w-3 h-3" />
                                                        </div>
                                                    )}
                                                </div>
                                                {customCalc && (
                                                    <div className="text-[10px] text-[#8e8e8e] text-left w-full">
                                                        <div>利润率: {pct(customCalc.profitRate)}</div>
                                                        <div>毛利: {fmt(customCalc.grossProfit)}</div>
                                                    </div>
                                                )}
                                                {isCustomSelected && !isInputChanged && (
                                                    <div className="text-[10px] text-[#22c55e] flex items-center gap-0.5">
                                                        <Check className="w-2.5 h-2.5" />
                                                        已选为暂定价
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

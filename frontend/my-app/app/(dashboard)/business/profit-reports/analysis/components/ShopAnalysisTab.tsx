'use client';

import { useState, useMemo } from 'react';
import {
    DollarSign, TrendingUp, TrendingDown, BarChart3,
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    TrendData, ShopInfo,
    fmt, fmtPct, getYearColor,
    MONTH_LABELS, TOOLTIP_STYLE, GRID_STROKE, AXIS_TICK, COLORS,
} from './chart-utils';

interface Props {
    data: TrendData;
    year: number;
    compareYears: number[];
}

export default function ShopAnalysisTab({ data, year, compareYears }: Props) {
    const [selectedShopId, setSelectedShopId] = useState<string>('');
    const allYears = [year, ...compareYears];

    // 如果没有选择店铺且有店铺数据，默认选中第一个有销售数据的店铺
    const shopOptions = data.shops || [];
    const activeShopId = selectedShopId || (shopOptions.length > 0 ? shopOptions[0].shopId : '');
    const activeShop = shopOptions.find(s => s.shopId === activeShopId);

    // 单店铺月度数据
    const shopMonthlyData = useMemo(() => {
        const result: any[] = [];
        for (let m = 1; m <= 12; m++) {
            const item: any = { month: MONTH_LABELS[m - 1] };
            for (const y of allYears) {
                const md = data.monthly.find(d => d.year === y && d.month === m);
                const shopData = md?.shops?.find((s: any) => s.shopId === activeShopId);
                if (shopData) {
                    item[`sales_${y}`] = shopData.salesAmount;
                    item[`gross_${y}`] = shopData.grossProfit;
                    item[`net_${y}`] = shopData.netProfit;
                    item[`grossMargin_${y}`] = shopData.grossMargin;
                    item[`netMargin_${y}`] = shopData.netMargin;
                    item[`rawMaterialRate_${y}`] = shopData.rawMaterialRate;
                    item[`shippingRate_${y}`] = shopData.shippingRate;
                    item[`platformFeeRate_${y}`] = shopData.platformFeeRate;
                    item[`allocationRate_${y}`] = shopData.allocationRate;
                    item[`rawMaterial_${y}`] = shopData.rawMaterialCost;
                    item[`packaging_${y}`] = shopData.packagingCost;
                    item[`labor_${y}`] = shopData.laborCost;
                    item[`shipping_${y}`] = shopData.shippingCost;
                    item[`platformFee_${y}`] = shopData.platformFee;
                    item[`allocation_${y}`] = shopData.allocationCost;
                }
            }
            result.push(item);
        }
        return result;
    }, [data, allYears, activeShopId]);

    // 费用明细月度趋势（当前年份，堆叠柱状图）
    const expenseStackData = useMemo(() => {
        return data.monthly
            .filter(d => d.year === year)
            .sort((a, b) => a.month - b.month)
            .map(d => {
                const shop = d.shops?.find((s: any) => s.shopId === activeShopId);
                return {
                    month: MONTH_LABELS[d.month - 1],
                    快递费: shop?.shippingCost || 0,
                    平台费: shop?.platformFee || 0,
                    分摊费: shop?.allocationCost || 0,
                };
            });
    }, [data, year, activeShopId]);

    // 年度汇总KPI
    const shopYearKpi = useMemo(() => {
        let sales = 0, gross = 0, net = 0;
        for (const m of data.monthly) {
            if (m.year !== year) continue;
            const shop = m.shops?.find((s: any) => s.shopId === activeShopId);
            if (shop) {
                sales += shop.salesAmount;
                gross += shop.grossProfit;
                net += shop.netProfit;
            }
        }
        return {
            sales, gross, net,
            grossMargin: sales > 0 ? (gross / sales) * 100 : 0,
            netMargin: sales > 0 ? (net / sales) * 100 : 0,
        };
    }, [data, year, activeShopId]);

    // 月度数据明细表
    const detailTableData = useMemo(() => {
        return data.monthly
            .filter(d => d.year === year)
            .sort((a, b) => a.month - b.month)
            .map(d => {
                const shop = d.shops?.find((s: any) => s.shopId === activeShopId);
                return {
                    month: d.month,
                    salesAmount: shop?.salesAmount || 0,
                    rawMaterialCost: shop?.rawMaterialCost || 0,
                    packagingCost: shop?.packagingCost || 0,
                    laborCost: shop?.laborCost || 0,
                    shippingCost: shop?.shippingCost || 0,
                    grossProfit: shop?.grossProfit || 0,
                    platformFee: shop?.platformFee || 0,
                    allocationCost: shop?.allocationCost || 0,
                    netProfit: shop?.netProfit || 0,
                    grossMargin: shop?.grossMargin || 0,
                    netMargin: shop?.netMargin || 0,
                };
            });
    }, [data, year, activeShopId]);

    if (shopOptions.length === 0) {
        return <div className="text-center py-20 text-muted-foreground">暂无店铺数据</div>;
    }

    return (
        <div className="space-y-6">
            {/* 店铺选择 */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">选择店铺：</span>
                <Select value={activeShopId} onValueChange={setSelectedShopId}>
                    <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="选择店铺" />
                    </SelectTrigger>
                    <SelectContent>
                        {shopOptions.map(s => (
                            <SelectItem key={s.shopId} value={s.shopId}>
                                {s.shopName}（{s.platformName}）
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* 店铺KPI卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                    { label: '年度销售额', value: shopYearKpi.sales, icon: DollarSign, pct: false },
                    { label: '年度毛利', value: shopYearKpi.gross, icon: TrendingUp, pct: false },
                    { label: '年度净利', value: shopYearKpi.net, icon: shopYearKpi.net >= 0 ? TrendingUp : TrendingDown, pct: false },
                    { label: '毛利率', value: shopYearKpi.grossMargin, icon: BarChart3, pct: true },
                    { label: '净利率', value: shopYearKpi.netMargin, icon: BarChart3, pct: true },
                ].map(c => {
                    const neg = c.value < 0;
                    const I = c.icon;
                    return (
                        <div key={c.label} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`p-1.5 rounded-md ${neg ? 'bg-[#ef4444]/10' : 'bg-primary/10'}`}>
                                    <I className={`w-4 h-4 ${neg ? 'text-[#ef4444]' : 'text-primary'}`} />
                                </div>
                                <span className="text-xs text-muted-foreground">{c.label}</span>
                            </div>
                            <p className={`text-lg font-bold ${neg ? 'text-[#ef4444]' : ''}`}>
                                {c.pct ? fmtPct(c.value) : fmt(c.value)}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* 销售额月度对比 */}
            <ChartCard title={`${activeShop?.shopName || ''} 销售额月度对比`}>
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={shopMonthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                        <Legend />
                        {allYears.map((y, i) => (
                            <Bar key={y} dataKey={`sales_${y}`} name={`${y}年`}
                                fill={getYearColor(y, i)} barSize={allYears.length > 1 ? 16 : 28}
                                radius={[2, 2, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 毛利/净利月度对比 */}
            <ChartCard title={`${activeShop?.shopName || ''} 毛利/净利月度对比`}>
                <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={shopMonthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                        <Legend />
                        {allYears.map((y, i) => (
                            <Bar key={`gross_${y}`} dataKey={`gross_${y}`} name={`${y}毛利`}
                                fill={getYearColor(y, i)} barSize={allYears.length > 1 ? 12 : 18}
                                radius={[2, 2, 0, 0]} opacity={0.65} />
                        ))}
                        {allYears.map((y, i) => (
                            <Bar key={`net_${y}`} dataKey={`net_${y}`} name={`${y}净利`}
                                fill={getYearColor(y, i)} barSize={allYears.length > 1 ? 12 : 18}
                                radius={[2, 2, 0, 0]} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 毛利率/净利率趋势 */}
            <ChartCard title={`${activeShop?.shopName || ''} 利润率月度趋势`}>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={shopMonthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmtPct(v)) as any} />
                        <Legend />
                        {allYears.map((y, i) => (
                            <Line key={`gm_${y}`} type="monotone" dataKey={`grossMargin_${y}`}
                                name={`${y}毛利率`} stroke={getYearColor(y, i)} strokeWidth={2} dot={{ r: 3 }} />
                        ))}
                        {allYears.map((y, i) => (
                            <Line key={`nm_${y}`} type="monotone" dataKey={`netMargin_${y}`}
                                name={`${y}净利率`} stroke={getYearColor(y, i)}
                                strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 成本构成月度变化（多折线图） */}
            <ChartCard title={`${activeShop?.shopName || ''} ${year}年费率月度变化`}>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={shopMonthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmtPct(v)) as any} />
                        <Legend />
                        <Line type="monotone" dataKey={`rawMaterialRate_${year}`} name="原料率" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey={`shippingRate_${year}`} name="快递费率" stroke={COLORS.green} strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey={`platformFeeRate_${year}`} name="平台费率" stroke={COLORS.orange} strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey={`allocationRate_${year}`} name="分摊率" stroke={COLORS.purple} strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 费用明细月度趋势（堆叠柱状图） */}
            {expenseStackData.length > 0 && (
                <ChartCard title={`${activeShop?.shopName || ''} ${year}年费用明细月度趋势`}>
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={expenseStackData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                            <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                            <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                            <Legend />
                            <Bar dataKey="快递费" stackId="a" fill={COLORS.green} barSize={28} />
                            <Bar dataKey="平台费" stackId="a" fill={COLORS.orange} />
                            <Bar dataKey="分摊费" stackId="a" fill={COLORS.purple} radius={[2, 2, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* 月度数据明细表 */}
            <div className="rounded-lg border border-border bg-card">
                <div className="p-4 border-b border-border">
                    <h2 className="text-base font-semibold">{activeShop?.shopName || ''} {year}年月度数据明细</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-muted-foreground text-xs">
                                <th className="px-3 py-2.5 text-left font-medium">月份</th>
                                <th className="px-3 py-2.5 text-right font-medium">销售额</th>
                                <th className="px-3 py-2.5 text-right font-medium">原料</th>
                                <th className="px-3 py-2.5 text-right font-medium">包装</th>
                                <th className="px-3 py-2.5 text-right font-medium">人工</th>
                                <th className="px-3 py-2.5 text-right font-medium">快递费</th>
                                <th className="px-3 py-2.5 text-right font-medium">毛利</th>
                                <th className="px-3 py-2.5 text-right font-medium">平台费</th>
                                <th className="px-3 py-2.5 text-right font-medium">分摊</th>
                                <th className="px-3 py-2.5 text-right font-medium">净利</th>
                                <th className="px-3 py-2.5 text-right font-medium">毛利率</th>
                                <th className="px-3 py-2.5 text-right font-medium">净利率</th>
                            </tr>
                        </thead>
                        <tbody>
                            {detailTableData.map(d => (
                                <tr key={d.month} className="border-b border-border hover:bg-card-foreground/5">
                                    <td className="px-3 py-2.5 font-medium">{d.month}月</td>
                                    <td className="px-3 py-2.5 text-right">{fmt(d.salesAmount)}</td>
                                    <td className="px-3 py-2.5 text-right">{fmt(d.rawMaterialCost)}</td>
                                    <td className="px-3 py-2.5 text-right">{fmt(d.packagingCost)}</td>
                                    <td className="px-3 py-2.5 text-right">{fmt(d.laborCost)}</td>
                                    <td className="px-3 py-2.5 text-right">{fmt(d.shippingCost)}</td>
                                    <td className="px-3 py-2.5 text-right">{fmt(d.grossProfit)}</td>
                                    <td className="px-3 py-2.5 text-right">{fmt(d.platformFee)}</td>
                                    <td className="px-3 py-2.5 text-right">{fmt(d.allocationCost)}</td>
                                    <td className={`px-3 py-2.5 text-right ${d.netProfit < 0 ? 'text-[#ef4444]' : ''}`}>{fmt(d.netProfit)}</td>
                                    <td className="px-3 py-2.5 text-right">{fmtPct(d.grossMargin)}</td>
                                    <td className={`px-3 py-2.5 text-right ${d.netMargin < 0 ? 'text-[#ef4444]' : ''}`}>{fmtPct(d.netMargin)}</td>
                                </tr>
                            ))}
                            {/* 合计行 */}
                            <tr className="bg-card-foreground/5 font-semibold">
                                <td className="px-3 py-2.5">合计</td>
                                <td className="px-3 py-2.5 text-right">{fmt(detailTableData.reduce((s, d) => s + d.salesAmount, 0))}</td>
                                <td className="px-3 py-2.5 text-right">{fmt(detailTableData.reduce((s, d) => s + d.rawMaterialCost, 0))}</td>
                                <td className="px-3 py-2.5 text-right">{fmt(detailTableData.reduce((s, d) => s + d.packagingCost, 0))}</td>
                                <td className="px-3 py-2.5 text-right">{fmt(detailTableData.reduce((s, d) => s + d.laborCost, 0))}</td>
                                <td className="px-3 py-2.5 text-right">{fmt(detailTableData.reduce((s, d) => s + d.shippingCost, 0))}</td>
                                <td className="px-3 py-2.5 text-right">{fmt(detailTableData.reduce((s, d) => s + d.grossProfit, 0))}</td>
                                <td className="px-3 py-2.5 text-right">{fmt(detailTableData.reduce((s, d) => s + d.platformFee, 0))}</td>
                                <td className="px-3 py-2.5 text-right">{fmt(detailTableData.reduce((s, d) => s + d.allocationCost, 0))}</td>
                                <td className={`px-3 py-2.5 text-right ${shopYearKpi.net < 0 ? 'text-[#ef4444]' : ''}`}>{fmt(detailTableData.reduce((s, d) => s + d.netProfit, 0))}</td>
                                <td className="px-3 py-2.5 text-right">{fmtPct(shopYearKpi.grossMargin)}</td>
                                <td className={`px-3 py-2.5 text-right ${shopYearKpi.netMargin < 0 ? 'text-[#ef4444]' : ''}`}>{fmtPct(shopYearKpi.netMargin)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-border bg-card">
            <div className="p-4 border-b border-border">
                <h2 className="text-base font-semibold">{title}</h2>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

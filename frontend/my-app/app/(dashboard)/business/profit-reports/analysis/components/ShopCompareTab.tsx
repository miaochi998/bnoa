'use client';

import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import {
    BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
    TrendData,
    fmt, fmtPct,
    TOOLTIP_STYLE, GRID_STROKE, AXIS_TICK, COLORS,
} from './chart-utils';
import { Switch } from '@/components/ui/switch';

interface Props {
    data: TrendData;
    year: number;
}

const PIE_COLORS = [
    COLORS.primary, COLORS.green, COLORS.yellow, COLORS.red,
    COLORS.purple, COLORS.pink, COLORS.cyan, COLORS.orange,
    COLORS.lime, COLORS.indigo,
];

type SortKey = 'totalSales' | 'totalGross' | 'totalNet' | 'grossMargin' | 'netMargin' |
    'shippingRate' | 'platformFeeRate' | 'rawMaterialRate' | 'allocationRate';

export default function ShopCompareTab({ data, year }: Props) {
    const [hideZero, setHideZero] = useState(true);
    const [sortKey, setSortKey] = useState<SortKey>('totalNet');
    const [sortAsc, setSortAsc] = useState(false);

    // 按店铺聚合当前年份数据
    const shopAggData = useMemo(() => {
        const map = new Map<string, any>();
        for (const m of data.monthly) {
            if (m.year !== year) continue;
            for (const s of m.shops || []) {
                const existing = map.get(s.shopId) || {
                    shopId: s.shopId, shopName: s.shopName, platformName: s.platformName,
                    totalSales: 0, totalGross: 0, totalNet: 0,
                    totalRawMaterial: 0, totalShipping: 0, totalPlatformFee: 0, totalAllocation: 0,
                };
                existing.totalSales += s.salesAmount;
                existing.totalGross += s.grossProfit;
                existing.totalNet += s.netProfit;
                existing.totalRawMaterial += s.rawMaterialCost;
                existing.totalShipping += s.shippingCost;
                existing.totalPlatformFee += s.platformFee;
                existing.totalAllocation += s.allocationCost;
                map.set(s.shopId, existing);
            }
        }
        return [...map.values()].map(s => ({
            ...s,
            grossMargin: s.totalSales > 0 ? +((s.totalGross / s.totalSales) * 100).toFixed(2) : 0,
            netMargin: s.totalSales > 0 ? +((s.totalNet / s.totalSales) * 100).toFixed(2) : 0,
            rawMaterialRate: s.totalSales > 0 ? +((s.totalRawMaterial / s.totalSales) * 100).toFixed(2) : 0,
            shippingRate: s.totalSales > 0 ? +((s.totalShipping / s.totalSales) * 100).toFixed(2) : 0,
            platformFeeRate: s.totalSales > 0 ? +((s.totalPlatformFee / s.totalSales) * 100).toFixed(2) : 0,
            allocationRate: s.totalSales > 0 ? +((s.totalAllocation / s.totalSales) * 100).toFixed(2) : 0,
        }));
    }, [data, year]);

    const shops = useMemo(() => {
        let list = [...shopAggData];
        if (hideZero) list = list.filter(s => s.totalSales > 0);
        list.sort((a, b) => sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]);
        return list;
    }, [shopAggData, hideZero, sortKey, sortAsc]);

    // 平台汇总
    const platforms = useMemo(() => {
        const map = new Map<string, any>();
        for (const s of shops) {
            const p = map.get(s.platformName) || {
                platformName: s.platformName, totalSales: 0, totalGross: 0, totalNet: 0, shopCount: 0,
            };
            p.totalSales += s.totalSales;
            p.totalGross += s.totalGross;
            p.totalNet += s.totalNet;
            p.shopCount += 1;
            map.set(s.platformName, p);
        }
        return [...map.values()].map(p => ({
            ...p,
            grossMargin: p.totalSales > 0 ? +((p.totalGross / p.totalSales) * 100).toFixed(1) : 0,
            netMargin: p.totalSales > 0 ? +((p.totalNet / p.totalSales) * 100).toFixed(1) : 0,
        }));
    }, [shops]);

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(false); }
    };

    // 各店铺销售额对比图表数据
    const salesBarData = shops.map(s => ({
        name: s.shopName.length > 8 ? s.shopName.slice(0, 8) + '…' : s.shopName,
        销售额: s.totalSales,
    }));

    // 各店铺利润率对比图表数据
    const marginBarData = shops.map(s => ({
        name: s.shopName.length > 8 ? s.shopName.slice(0, 8) + '…' : s.shopName,
        毛利率: s.grossMargin,
        净利率: s.netMargin,
    }));

    // 费率对比堆叠图
    const rateBarData = shops.map(s => ({
        name: s.shopName.length > 6 ? s.shopName.slice(0, 6) + '…' : s.shopName,
        原材料率: s.rawMaterialRate,
        快递费率: s.shippingRate,
        平台费率: s.platformFeeRate,
        分摊率: s.allocationRate,
    }));

    // 平台销售额饼图
    const platformPieData = platforms.filter(p => p.totalSales > 0).map(p => ({
        name: p.platformName,
        value: p.totalSales,
    }));

    const totSales = shops.reduce((s, r) => s + r.totalSales, 0);
    const totGross = shops.reduce((s, r) => s + r.totalGross, 0);
    const totNet = shops.reduce((s, r) => s + r.totalNet, 0);
    const totGM = totSales ? +((totGross / totSales) * 100).toFixed(1) : 0;
    const totNM = totSales ? +((totNet / totSales) * 100).toFixed(1) : 0;

    const cols: { key: SortKey; label: string; pct?: boolean }[] = [
        { key: 'totalSales', label: '销售额' },
        { key: 'totalGross', label: '毛利' },
        { key: 'totalNet', label: '净利' },
        { key: 'grossMargin', label: '毛利率', pct: true },
        { key: 'netMargin', label: '净利率', pct: true },
        { key: 'platformFeeRate', label: '平台费率', pct: true },
        { key: 'shippingRate', label: '快递费率', pct: true },
    ];

    return (
        <div className="space-y-6">
            {/* 控制栏 */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>隐藏零销售</span>
                <Switch checked={hideZero} onCheckedChange={setHideZero} />
            </div>

            {/* 店铺排行榜 */}
            <div className="rounded-lg border border-border bg-card">
                <div className="p-4 border-b border-border">
                    <h2 className="text-base font-semibold">{year}年 店铺排行榜</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-muted-foreground text-xs">
                                <th className="px-4 py-2.5 text-left font-medium w-8">#</th>
                                <th className="px-4 py-2.5 text-left font-medium">店铺</th>
                                <th className="px-4 py-2.5 text-left font-medium">平台</th>
                                {cols.map(c => (
                                    <th key={c.key} onClick={() => toggleSort(c.key)}
                                        className="px-4 py-2.5 text-right font-medium cursor-pointer hover:text-foreground select-none whitespace-nowrap">
                                        {c.label}
                                        {sortKey === c.key && (sortAsc
                                            ? <ArrowUp className="inline w-3 h-3 ml-0.5" />
                                            : <ArrowDown className="inline w-3 h-3 ml-0.5" />
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {shops.map((s, i) => {
                                const loss = s.totalNet < 0;
                                return (
                                    <tr key={s.shopId} className={`border-b border-border hover:bg-card-foreground/5 ${loss ? 'bg-[#ef4444]/5' : ''}`}>
                                        <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                                        <td className="px-4 py-2.5 font-medium whitespace-nowrap">{s.shopName}</td>
                                        <td className="px-4 py-2.5 text-muted-foreground">{s.platformName}</td>
                                        {cols.map(c => {
                                            const v = s[c.key] as number;
                                            const neg = v < 0;
                                            return (
                                                <td key={c.key} className={`px-4 py-2.5 text-right whitespace-nowrap ${neg ? 'text-[#ef4444]' : ''}`}>
                                                    {c.pct ? fmtPct(v) : fmt(v)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                            <tr className="bg-card-foreground/5 font-semibold">
                                <td className="px-4 py-2.5" />
                                <td className="px-4 py-2.5">合计</td>
                                <td className="px-4 py-2.5" />
                                <td className="px-4 py-2.5 text-right">{fmt(totSales)}</td>
                                <td className="px-4 py-2.5 text-right">{fmt(totGross)}</td>
                                <td className={`px-4 py-2.5 text-right ${totNet < 0 ? 'text-[#ef4444]' : ''}`}>{fmt(totNet)}</td>
                                <td className="px-4 py-2.5 text-right">{fmtPct(totGM)}</td>
                                <td className={`px-4 py-2.5 text-right ${totNM < 0 ? 'text-[#ef4444]' : ''}`}>{fmtPct(totNM)}</td>
                                <td className="px-4 py-2.5" />
                                <td className="px-4 py-2.5" />
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 各店铺销售额对比 */}
            {salesBarData.length > 0 && (
                <ChartCard title={`${year}年 各店铺销售额对比`}>
                    <ResponsiveContainer width="100%" height={Math.max(300, shops.length * 40)}>
                        <BarChart data={salesBarData} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                            <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE}
                                tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                            <YAxis type="category" dataKey="name" width={80} tick={AXIS_TICK} stroke={GRID_STROKE} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                            <Bar dataKey="销售额" fill={COLORS.primary} barSize={20} radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* 各店铺利润率对比 */}
            {marginBarData.length > 0 && (
                <ChartCard title={`${year}年 各店铺利润率对比`}>
                    <ResponsiveContainer width="100%" height={Math.max(300, shops.length * 40)}>
                        <BarChart data={marginBarData} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                            <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => `${v}%`} />
                            <YAxis type="category" dataKey="name" width={80} tick={AXIS_TICK} stroke={GRID_STROKE} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmtPct(v)) as any} />
                            <Legend />
                            <Bar dataKey="毛利率" fill={COLORS.primary} barSize={14} radius={[0, 2, 2, 0]} />
                            <Bar dataKey="净利率" fill={COLORS.green} barSize={14} radius={[0, 2, 2, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* 费率对比堆叠图 */}
            {rateBarData.length > 0 && (
                <ChartCard title={`${year}年 各店铺费率对比`}>
                    <ResponsiveContainer width="100%" height={Math.max(300, shops.length * 40)}>
                        <BarChart data={rateBarData} layout="vertical" margin={{ left: 60, right: 20, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                            <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => `${v}%`} />
                            <YAxis type="category" dataKey="name" width={60} tick={AXIS_TICK} stroke={GRID_STROKE} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmtPct(v)) as any} />
                            <Legend />
                            <Bar dataKey="原材料率" stackId="rate" fill={COLORS.primary} barSize={18} />
                            <Bar dataKey="快递费率" stackId="rate" fill={COLORS.green} />
                            <Bar dataKey="平台费率" stackId="rate" fill={COLORS.yellow} />
                            <Bar dataKey="分摊率" stackId="rate" fill={COLORS.purple} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* 平台汇总 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 平台对比表 */}
                {platforms.length > 0 && (
                    <div className="rounded-lg border border-border bg-card">
                        <div className="p-4 border-b border-border">
                            <h2 className="text-base font-semibold">平台对比</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-muted-foreground text-xs">
                                        <th className="px-4 py-2.5 text-left font-medium">平台</th>
                                        <th className="px-4 py-2.5 text-right font-medium">店铺数</th>
                                        <th className="px-4 py-2.5 text-right font-medium">销售额</th>
                                        <th className="px-4 py-2.5 text-right font-medium">毛利</th>
                                        <th className="px-4 py-2.5 text-right font-medium">净利</th>
                                        <th className="px-4 py-2.5 text-right font-medium">毛利率</th>
                                        <th className="px-4 py-2.5 text-right font-medium">净利率</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {platforms.map(p => (
                                        <tr key={p.platformName} className="border-b border-border hover:bg-card-foreground/5">
                                            <td className="px-4 py-2.5 font-medium">{p.platformName}</td>
                                            <td className="px-4 py-2.5 text-right">{p.shopCount}</td>
                                            <td className="px-4 py-2.5 text-right">{fmt(p.totalSales)}</td>
                                            <td className="px-4 py-2.5 text-right">{fmt(p.totalGross)}</td>
                                            <td className={`px-4 py-2.5 text-right ${p.totalNet < 0 ? 'text-[#ef4444]' : ''}`}>{fmt(p.totalNet)}</td>
                                            <td className="px-4 py-2.5 text-right">{fmtPct(p.grossMargin)}</td>
                                            <td className={`px-4 py-2.5 text-right ${p.netMargin < 0 ? 'text-[#ef4444]' : ''}`}>{fmtPct(p.netMargin)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 平台销售占比饼图 */}
                {platformPieData.length > 0 && (
                    <div className="rounded-lg border border-border bg-card">
                        <div className="p-4 border-b border-border">
                            <h2 className="text-base font-semibold">平台销售占比</h2>
                        </div>
                        <div className="p-4 flex flex-col items-center">
                            <div style={{ width: 260, height: 260 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={platformPieData} dataKey="value" nameKey="name"
                                            cx="50%" cy="50%" outerRadius={100} innerRadius={55} strokeWidth={0}>
                                            {platformPieData.map((_, idx) => (
                                                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm mt-2">
                                {platformPieData.map((it, idx) => {
                                    const total = platformPieData.reduce((s, i) => s + i.value, 0);
                                    return (
                                        <div key={it.name} className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                                            <span className="text-muted-foreground">{it.name}</span>
                                            <span className="font-medium">{fmt(it.value)}</span>
                                            <span className="text-muted-foreground">({(it.value / total * 100).toFixed(1)}%)</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
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

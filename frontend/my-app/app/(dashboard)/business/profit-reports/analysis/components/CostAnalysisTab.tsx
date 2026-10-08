'use client';

import { useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer,
} from 'recharts';
import {
    TrendData,
    fmt, fmtPct,
    MONTH_LABELS, TOOLTIP_STYLE, GRID_STROKE, AXIS_TICK, COLORS,
} from './chart-utils';

interface Props {
    data: TrendData;
    year: number;
}

const PIE_COLORS = [
    COLORS.primary, COLORS.cyan, COLORS.green, COLORS.yellow,
    COLORS.orange, COLORS.purple, COLORS.red,
];

export default function CostAnalysisTab({ data, year }: Props) {
    const yearData = useMemo(() =>
        data.monthly.filter(d => d.year === year).sort((a, b) => a.month - b.month),
        [data, year],
    );

    // 成本结构饼图（年度汇总）
    const costPieData = useMemo(() => {
        let raw = 0, pkg = 0, labor = 0, ship = 0, plat = 0, alloc = 0, comp = 0;
        for (const m of yearData) {
            raw += m.totalRawMaterial;
            pkg += m.totalPackaging;
            labor += m.totalLabor;
            ship += m.totalShipping;
            plat += m.totalPlatformFee;
            alloc += m.totalAllocation;
            comp += m.totalCompanyExpense;
        }
        return [
            { name: '原材料', value: +raw.toFixed(2) },
            { name: '包装', value: +pkg.toFixed(2) },
            { name: '人工', value: +labor.toFixed(2) },
            { name: '快递', value: +ship.toFixed(2) },
            { name: '平台费', value: +plat.toFixed(2) },
            { name: '分摊费', value: +alloc.toFixed(2) },
            { name: '公司费用', value: +comp.toFixed(2) },
        ].filter(i => i.value > 0);
    }, [yearData]);

    const costTotal = costPieData.reduce((s, i) => s + i.value, 0);

    // 成本月度趋势（多折线图）
    const costTrendData = useMemo(() =>
        yearData.map(d => ({
            month: MONTH_LABELS[d.month - 1],
            原料: d.totalRawMaterial,
            包装: d.totalPackaging,
            人工: d.totalLabor,
            快递: d.totalShipping,
            平台费: d.totalPlatformFee,
            分摊: d.totalAllocation,
        })),
        [yearData],
    );

    // 快递费按公司分布（年度汇总饼图）
    const shippingByCompany = useMemo(() => {
        const map = new Map<string, number>();
        for (const m of yearData) {
            for (const sc of m.shippingByCompany || []) {
                map.set(sc.name, (map.get(sc.name) || 0) + sc.amount);
            }
        }
        return [...map.entries()]
            .map(([name, amount]) => ({ name, value: +amount.toFixed(2) }))
            .filter(i => i.value > 0)
            .sort((a, b) => b.value - a.value);
    }, [yearData]);

    // 快递费月度趋势（按公司分组）
    const shippingTrendData = useMemo(() => {
        const companies = new Set<string>();
        for (const m of yearData) {
            for (const sc of m.shippingByCompany || []) companies.add(sc.name);
        }
        return yearData.map(d => {
            const item: any = { month: MONTH_LABELS[d.month - 1] };
            for (const c of companies) {
                const sc = d.shippingByCompany?.find(s => s.name === c);
                item[c] = sc?.amount || 0;
            }
            return item;
        });
    }, [yearData]);
    const shippingCompanies = useMemo(() => {
        const set = new Set<string>();
        for (const m of yearData) {
            for (const sc of m.shippingByCompany || []) set.add(sc.name);
        }
        return [...set];
    }, [yearData]);

    // 各店铺平台费用对比
    const shopPlatformFeeData = useMemo(() => {
        const map = new Map<string, { name: string; amount: number }>();
        for (const m of yearData) {
            for (const s of m.shops || []) {
                const existing = map.get(s.shopId) || { name: s.shopName, amount: 0 };
                existing.amount += s.platformFee;
                map.set(s.shopId, existing);
            }
        }
        return [...map.values()]
            .filter(s => s.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .map(s => ({
                name: s.name.length > 8 ? s.name.slice(0, 8) + '…' : s.name,
                平台费: +s.amount.toFixed(2),
            }));
    }, [yearData]);

    // 费用率月度趋势
    const ratesTrendData = useMemo(() =>
        yearData.map(d => ({
            month: MONTH_LABELS[d.month - 1],
            原料率: d.rawMaterialRate,
            快递费率: d.shippingRate,
            平台费率: d.platformFeeRate,
            分摊率: d.allocationRate,
        })),
        [yearData],
    );

    return (
        <div className="space-y-6">
            {/* 成本结构饼图 + 明细 */}
            {costPieData.length > 0 && (
                <div className="rounded-lg border border-border bg-card">
                    <div className="p-4 border-b border-border">
                        <h2 className="text-base font-semibold">{year}年 成本结构分析</h2>
                    </div>
                    <div className="p-4 flex flex-col md:flex-row items-center gap-6">
                        <div style={{ width: 280, height: 280 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={costPieData} dataKey="value" nameKey="name"
                                        cx="50%" cy="50%" outerRadius={110} innerRadius={60} strokeWidth={0}>
                                        {costPieData.map((_, idx) => (
                                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
                            {costPieData.map((it, idx) => (
                                <div key={it.name} className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-sm inline-block"
                                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                                    <span className="text-muted-foreground">{it.name}</span>
                                    <span className="font-medium">{fmt(it.value)}</span>
                                    <span className="text-muted-foreground">
                                        ({(it.value / costTotal * 100).toFixed(1)}%)
                                    </span>
                                </div>
                            ))}
                            <div className="w-full border-t border-border pt-2 mt-1 font-semibold">
                                总计：{fmt(costTotal)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 成本月度趋势 */}
            {costTrendData.length > 0 && (
                <ChartCard title={`${year}年 各项成本月度趋势`}>
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={costTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                            <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                            <YAxis tick={AXIS_TICK} stroke={GRID_STROKE}
                                tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                            <Legend />
                            <Line type="monotone" dataKey="原料" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="包装" stroke={COLORS.cyan} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="人工" stroke={COLORS.green} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="快递" stroke={COLORS.yellow} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="平台费" stroke={COLORS.orange} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="分摊" stroke={COLORS.purple} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* 快递费分析 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 快递费按公司分布饼图 */}
                {shippingByCompany.length > 0 && (
                    <div className="rounded-lg border border-border bg-card">
                        <div className="p-4 border-b border-border">
                            <h2 className="text-base font-semibold">{year}年 快递费按公司分布</h2>
                        </div>
                        <div className="p-4 flex flex-col items-center">
                            <div style={{ width: 240, height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={shippingByCompany} dataKey="value" nameKey="name"
                                            cx="50%" cy="50%" outerRadius={95} innerRadius={50} strokeWidth={0}>
                                            {shippingByCompany.map((_, idx) => (
                                                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm mt-2">
                                {shippingByCompany.map((it, idx) => {
                                    const total = shippingByCompany.reduce((s, i) => s + i.value, 0);
                                    return (
                                        <div key={it.name} className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-sm inline-block"
                                                style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
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

                {/* 快递费月度趋势（按公司） */}
                {shippingTrendData.length > 0 && shippingCompanies.length > 0 && (
                    <ChartCard title={`${year}年 快递费月度趋势（按公司）`}>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={shippingTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                                <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                                <YAxis tick={AXIS_TICK} stroke={GRID_STROKE}
                                    tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                                <Legend />
                                {shippingCompanies.map((c, i) => (
                                    <Bar key={c} dataKey={c} stackId="ship" fill={PIE_COLORS[i % PIE_COLORS.length]}
                                        barSize={24} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>
                )}
            </div>

            {/* 各店铺平台费用对比 */}
            {shopPlatformFeeData.length > 0 && (
                <ChartCard title={`${year}年 各店铺平台费用对比`}>
                    <ResponsiveContainer width="100%" height={Math.max(280, shopPlatformFeeData.length * 36)}>
                        <BarChart data={shopPlatformFeeData} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                            <XAxis type="number" tick={AXIS_TICK} stroke={GRID_STROKE}
                                tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                            <YAxis type="category" dataKey="name" width={80} tick={AXIS_TICK} stroke={GRID_STROKE} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                            <Bar dataKey="平台费" fill={COLORS.orange} barSize={20} radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* 费用率月度趋势 */}
            {ratesTrendData.length > 0 && (
                <ChartCard title={`${year}年 各项费用率月度趋势`}>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={ratesTrendData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                            <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                            <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => `${v}%`} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmtPct(v)) as any} />
                            <Legend />
                            <Line type="monotone" dataKey="原料率" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="快递费率" stroke={COLORS.green} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="平台费率" stroke={COLORS.orange} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="分摊率" stroke={COLORS.purple} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}
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

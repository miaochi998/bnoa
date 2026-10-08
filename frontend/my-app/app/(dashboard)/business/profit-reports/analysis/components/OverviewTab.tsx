'use client';

import { useMemo } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign,
    BarChart3, ArrowUp, ArrowDown,
} from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import {
    TrendData, MonthlyData,
    fmt, fmtPct, getYearColor,
    MONTH_LABELS, TOOLTIP_STYLE, GRID_STROKE, AXIS_TICK, COLORS,
} from './chart-utils';

interface Props {
    data: TrendData;
    year: number;
    compareYears: number[];
}

export default function OverviewTab({ data, year, compareYears }: Props) {
    const allYears = [year, ...compareYears];
    const currentYearSummary = data.yearlySummary.find(y => y.year === year);
    const prevYearSummary = data.yearlySummary.find(y => y.year === year - 1)
        || (compareYears.length > 0 ? data.yearlySummary.find(y => y.year === compareYears[0]) : null);

    // 月度趋势数据（按月聚合，每年一组）
    const monthlyChartData = useMemo(() => {
        const result: any[] = [];
        for (let m = 1; m <= 12; m++) {
            const item: any = { month: MONTH_LABELS[m - 1] };
            for (const y of allYears) {
                const md = data.monthly.find(d => d.year === y && d.month === m);
                if (md) {
                    item[`sales_${y}`] = md.totalSales;
                    item[`gross_${y}`] = md.totalGross;
                    item[`net_${y}`] = md.totalNet;
                    item[`grossMargin_${y}`] = md.grossMargin;
                    item[`netMargin_${y}`] = md.netMargin;
                    item[`rawMaterial_${y}`] = md.totalRawMaterial;
                    item[`packaging_${y}`] = md.totalPackaging;
                    item[`labor_${y}`] = md.totalLabor;
                    item[`shipping_${y}`] = md.totalShipping;
                    item[`platformFee_${y}`] = md.totalPlatformFee;
                    item[`allocation_${y}`] = md.totalAllocation;
                    item[`companyExpense_${y}`] = md.totalCompanyExpense;
                }
            }
            result.push(item);
        }
        return result;
    }, [data, allYears]);

    // 成本结构月度变化数据（当前年份，堆叠面积图）
    const costStackData = useMemo(() => {
        return data.monthly
            .filter(d => d.year === year)
            .sort((a, b) => a.month - b.month)
            .map(d => ({
                month: MONTH_LABELS[d.month - 1],
                原料: d.totalRawMaterial,
                包装: d.totalPackaging,
                人工: d.totalLabor,
                快递: d.totalShipping,
                平台费: d.totalPlatformFee,
                分摊: d.totalAllocation,
            }));
    }, [data, year]);

    // 公司费用月度趋势
    const companyExpenseData = useMemo(() => {
        return data.monthly
            .filter(d => d.year === year)
            .sort((a, b) => a.month - b.month)
            .map(d => ({
                month: MONTH_LABELS[d.month - 1],
                金额: d.totalCompanyExpense,
            }));
    }, [data, year]);

    return (
        <div className="space-y-6">
            {/* KPI 卡片 */}
            {currentYearSummary && (
                <KpiCards current={currentYearSummary} prev={prevYearSummary ?? undefined} year={year} />
            )}

            {/* 销售额月度趋势 */}
            <ChartCard title={`销售额月度趋势${compareYears.length > 0 ? '（跨年对比）' : ''}`}>
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={monthlyChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
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

            {/* 利润月度趋势（毛利+净利） */}
            <ChartCard title={`利润月度趋势${compareYears.length > 0 ? '（跨年对比）' : ''}`}>
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={monthlyChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                        <Legend />
                        {allYears.map((y, i) => (
                            <Bar key={`gross_${y}`} dataKey={`gross_${y}`} name={`${y}毛利`}
                                fill={getYearColor(y, i)} barSize={allYears.length > 1 ? 12 : 20}
                                radius={[2, 2, 0, 0]} opacity={0.7} />
                        ))}
                        {allYears.map((y, i) => (
                            <Bar key={`net_${y}`} dataKey={`net_${y}`} name={`${y}净利`}
                                fill={getYearColor(y, i)} barSize={allYears.length > 1 ? 12 : 20}
                                radius={[2, 2, 0, 0]} opacity={1}
                                stroke={getYearColor(y, i)} strokeWidth={1} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 利润率月度趋势（折线图） */}
            <ChartCard title={`利润率月度趋势${compareYears.length > 0 ? '（跨年对比）' : ''}`}>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyChartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                        <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmtPct(v)) as any} />
                        <Legend />
                        {allYears.map((y, i) => (
                            <Line key={`gm_${y}`} type="monotone" dataKey={`grossMargin_${y}`}
                                name={`${y}毛利率`} stroke={getYearColor(y, i)}
                                strokeWidth={2} dot={{ r: 3 }} />
                        ))}
                        {allYears.map((y, i) => (
                            <Line key={`nm_${y}`} type="monotone" dataKey={`netMargin_${y}`}
                                name={`${y}净利率`} stroke={getYearColor(y, i)}
                                strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* 成本结构月度变化（堆叠面积图） */}
            {costStackData.length > 0 && (
                <ChartCard title={`${year}年成本结构月度变化`}>
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={costStackData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                            <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                            <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                            <Legend />
                            <Area type="monotone" dataKey="原料" stackId="1" fill={COLORS.primary} stroke={COLORS.primary} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="包装" stackId="1" fill={COLORS.cyan} stroke={COLORS.cyan} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="人工" stackId="1" fill={COLORS.green} stroke={COLORS.green} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="快递" stackId="1" fill={COLORS.yellow} stroke={COLORS.yellow} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="平台费" stackId="1" fill={COLORS.orange} stroke={COLORS.orange} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="分摊" stackId="1" fill={COLORS.purple} stroke={COLORS.purple} fillOpacity={0.6} />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}

            {/* 公司费用月度趋势 */}
            {companyExpenseData.some(d => d.金额 > 0) && (
                <ChartCard title={`${year}年公司费用月度趋势`}>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={companyExpenseData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                            <XAxis dataKey="month" tick={AXIS_TICK} stroke={GRID_STROKE} />
                            <YAxis tick={AXIS_TICK} stroke={GRID_STROKE} tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={((v: number) => fmt(v)) as any} />
                            <Bar dataKey="金额" fill={COLORS.red} barSize={28} radius={[4, 4, 0, 0]} opacity={0.8} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            )}
        </div>
    );
}

/* ========== KPI 卡片 ========== */

function KpiCards({ current, prev, year }: {
    current: any;
    prev?: any;
    year: number;
}) {
    const cards = [
        { label: '总销售额', value: current.totalSales, pv: prev?.totalSales, icon: DollarSign, pct: false },
        { label: '总毛利', value: current.totalGross, pv: prev?.totalGross, icon: TrendingUp, pct: false },
        { label: '总净利', value: current.totalNet, pv: prev?.totalNet, icon: current.totalNet >= 0 ? TrendingUp : TrendingDown, pct: false },
        { label: '毛利率', value: current.grossMargin, pv: prev?.grossMargin, icon: BarChart3, pct: true },
        { label: '净利率', value: current.netMargin, pv: prev?.netMargin, icon: BarChart3, pct: true },
        { label: '报表月数', value: current.monthCount, pv: prev?.monthCount, icon: BarChart3, pct: false, isCount: true },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {cards.map(c => {
                const neg = c.value < 0;
                const txt = c.isCount ? String(c.value) : c.pct ? fmtPct(c.value) : fmt(c.value);
                let chg: number | null = null;
                if (c.pv != null && c.pv !== 0 && !c.isCount) {
                    chg = +(((c.value - c.pv) / Math.abs(c.pv)) * 100).toFixed(1);
                }
                const I = c.icon;
                return (
                    <div key={c.label} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`p-1.5 rounded-md ${neg ? 'bg-[#ef4444]/10' : 'bg-primary/10'}`}>
                                <I className={`w-4 h-4 ${neg ? 'text-[#ef4444]' : 'text-primary'}`} />
                            </div>
                            <span className="text-xs text-muted-foreground">{c.label}</span>
                        </div>
                        <p className={`text-lg font-bold ${neg ? 'text-[#ef4444]' : ''}`}>{txt}</p>
                        {chg !== null && (
                            <p className={`text-xs mt-1 flex items-center gap-0.5 ${chg >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                                {chg >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                {Math.abs(chg)}% 同比
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ========== 图表卡片容器 ========== */

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-border bg-card">
            <div className="p-4 border-b border-border">
                <h2 className="text-base font-semibold">{title}</h2>
            </div>
            <div className="p-4">
                {children}
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, BarChart3, PlusCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TrendData } from './components/chart-utils';
import OverviewTab from './components/OverviewTab';
import ShopAnalysisTab from './components/ShopAnalysisTab';
import ShopCompareTab from './components/ShopCompareTab';
import CostAnalysisTab from './components/CostAnalysisTab';

export default function ProfitAnalysisPage() {
    const router = useRouter();
    const curYear = new Date().getFullYear();
    const [year, setYear] = useState(curYear);
    const [compareYear, setCompareYear] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [ready, setReady] = useState(false);
    const [periods, setPeriods] = useState<{ year: number; months: number[] }[]>([]);
    const [trendData, setTrendData] = useState<TrendData | null>(null);

    const yearOpts = useMemo(() => periods.map(p => p.year), [periods]);

    // 初始化：获取有报表的年月，定位到最新有数据的年份
    useEffect(() => {
        if (ready) return;
        (async () => {
            setLoading(true);
            try {
                const p = await apiClient.getAvailablePeriods();
                setPeriods(p);
                if (p.length > 0) {
                    const latestYear = p[0].year;
                    setYear(latestYear);
                    const data = await apiClient.getMonthlyTrend({ year: latestYear });
                    setTrendData(data);
                }
            } catch {
                setTrendData(null);
            } finally {
                setLoading(false);
                setReady(true);
            }
        })();
    }, [ready]);

    // 年份或对比年份切换时重新加载
    useEffect(() => {
        if (!ready) return;
        (async () => {
            setLoading(true);
            try {
                const params: any = { year };
                if (compareYear && compareYear.trim()) params.compareYears = compareYear.trim();
                const data = await apiClient.getMonthlyTrend(params);
                setTrendData(data);
            } catch {
                setTrendData(null);
            } finally {
                setLoading(false);
            }
        })();
    }, [year, compareYear, ready]);

    const hasAnyData = periods.length > 0;
    const hasData = trendData && trendData.monthly && trendData.monthly.length > 0;
    const compareYears = compareYear ? compareYear.split(',').map(Number).filter(Boolean) : [];

    return (
        <div className="space-y-6">
            {/* 顶部标题栏和筛选器 */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h1 className="text-2xl font-bold">利润分析</h1>
                {hasAnyData && (
                    <div className="flex items-center gap-3 flex-wrap">
                        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                            <SelectTrigger className="w-[100px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {yearOpts.map(y => (
                                    <SelectItem key={y} value={String(y)}>{y}年</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={compareYear || '_none'} onValueChange={(v) => setCompareYear(v === '_none' ? '' : v)}>
                            <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="跨年对比" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_none">不对比</SelectItem>
                                {yearOpts.filter(y => y !== year).map(y => (
                                    <SelectItem key={y} value={String(y)}>对比 {y}年</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* 主体内容 */}
            {loading ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>加载中...</span>
                </div>
            ) : !hasAnyData ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
                    <BarChart3 className="w-14 h-14 opacity-30" />
                    <div className="text-center space-y-1">
                        <p className="text-base font-medium text-foreground/70">暂无利润报表数据</p>
                        <p className="text-sm">请先在利润表页面创建月度报表，分析数据将自动呈现</p>
                    </div>
                    <button
                        onClick={() => router.push('/business/profit-reports')}
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                        <PlusCircle className="w-4 h-4" />
                        前往创建月度利润表
                    </button>
                </div>
            ) : !hasData ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                    <BarChart3 className="w-12 h-12 opacity-40" />
                    <p>{year}年暂无数据</p>
                </div>
            ) : (
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="w-full justify-start">
                        <TabsTrigger value="overview">经营总览</TabsTrigger>
                        <TabsTrigger value="shop">店铺分析</TabsTrigger>
                        <TabsTrigger value="compare">店铺对比</TabsTrigger>
                        <TabsTrigger value="cost">成本分析</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <OverviewTab data={trendData} year={year} compareYears={compareYears} />
                    </TabsContent>

                    <TabsContent value="shop">
                        <ShopAnalysisTab data={trendData} year={year} compareYears={compareYears} />
                    </TabsContent>

                    <TabsContent value="compare">
                        <ShopCompareTab data={trendData} year={year} />
                    </TabsContent>

                    <TabsContent value="cost">
                        <CostAnalysisTab data={trendData} year={year} />
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}

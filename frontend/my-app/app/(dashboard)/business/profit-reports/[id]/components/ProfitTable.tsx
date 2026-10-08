'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Truck, ShoppingBag } from 'lucide-react';
import StoreExpensePanel from './StoreExpensePanel';
import ShippingPanel from './ShippingPanel';
import { apiClient } from '@/lib/api';

interface Props {
    report: any;
    editData: Record<string, any>;
    setEditData: (d: Record<string, any>) => void;
    allocData: Record<string, Record<string, number>>;
    setAllocData: (d: Record<string, Record<string, number>>) => void;
    isDraft: boolean;
    reportId: string;
    onRefresh: () => Promise<void>;
}

const fmt = (n: number) => n === 0 ? '' : n.toFixed(3);
const fmtPct = (n: number) => n === 0 ? '' : (n * 100).toFixed(3) + '%';

export default function ProfitTable({
    report, editData, setEditData,
    allocData, setAllocData,
    isDraft, reportId, onRefresh,
}: Props) {
    const entries: any[] = report.entries || [];
    const cats: any[] = report.allocationCategories || [];
    const [expenseEntry, setExpenseEntry] = useState<any>(null);
    const [shippingEntry, setShippingEntry] = useState<any>(null);

    const calc = (e: any) => {
        const d = editData[e.id] || {};
        const sales = d.salesAmount || 0;
        const raw = d.rawMaterialCost || 0;
        const pkg = d.packagingCost || 0;
        const labor = d.laborCost || 0;
        const ship = (e.shippingCosts || []).reduce(
            (s: number, c: any) => s + Number(c.amount || 0), 0,
        );
        // 优先使用数据库中存储的精确毛利值（Excel公式计算结果）
        // null表示未从Excel导入，0表示Excel中毛利确实为0
        const gross = e.grossProfit != null ? Number(e.grossProfit) : (sales - raw - pkg - labor - ship);
        const margin = sales > 0 ? gross / sales : 0;
        const platform = (e.storeExpenses || []).reduce(
            (s: number, x: any) => s + Number(x.amount || 0), 0,
        );
        const al = Object.values(allocData[e.id] || {}).reduce(
            (s: number, v: number) => s + (v || 0), 0,
        );
        const expense = platform + al;
        // 优先使用数据库中存储的精确净利润值
        // null表示未从Excel导入，0表示Excel中净利润确实为0
        const net = e.netProfit != null ? Number(e.netProfit) : (gross - expense);
        return {
            sales, raw, pkg, labor, ship,
            gross, margin, platform, al, expense, net,
        };
    };

    const totals = useMemo(() => {
        const t = entries.reduce((acc: any, e: any) => {
            const c = calc(e);
            return {
                sales: (acc.sales || 0) + c.sales,
                raw: (acc.raw || 0) + c.raw,
                pkg: (acc.pkg || 0) + c.pkg,
                labor: (acc.labor || 0) + c.labor,
                ship: (acc.ship || 0) + c.ship,
                gross: (acc.gross || 0) + c.gross,
                platform: (acc.platform || 0) + c.platform,
                al: (acc.al || 0) + c.al,
                expense: (acc.expense || 0) + c.expense,
                net: (acc.net || 0) + c.net,
            };
        }, {} as any);
        t.margin = t.sales > 0 ? t.gross / t.sales : 0;
        return t;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entries, editData, allocData]);

    const updateField = (
        eid: string, field: string, val: number,
    ) => {
        setEditData({
            ...editData,
            [eid]: { ...editData[eid], [field]: val },
        });
    };

    const updateAlloc = (
        eid: string, catId: string, val: number,
    ) => {
        setAllocData({
            ...allocData,
            [eid]: { ...allocData[eid], [catId]: val },
        });
    };

    const catTotal = (catId: string) => entries.reduce(
        (s: number, e: any) =>
            s + (allocData[e.id]?.[catId] || 0), 0,
    );

    // 样式
    const hd = 'px-3 py-2 text-sm font-medium whitespace-nowrap'
        + ' border-r border-border';
    const lb = hd + ' sticky left-0 bg-card z-10';
    const cl = 'px-3 py-2 text-right text-sm whitespace-nowrap'
        + ' border-r border-border';
    const nc = (v: number) => v < 0 ? 'text-red-500' : '';
    const hoverRow = 'hover:bg-muted/20 transition-colors';

    const handleSaveExpenses = async (items: any[]) => {
        if (!expenseEntry) return;
        await apiClient.saveProfitStoreExpenses(
            reportId, expenseEntry.id,
            { items: items.map((i, idx) => ({ ...i, sortOrder: idx })) },
        );
        await onRefresh();
    };

    const handleSaveShipping = async (items: any[]) => {
        if (!shippingEntry) return;
        await apiClient.saveProfitShippingCosts(
            reportId, shippingEntry.id,
            { items: items.map((i, idx) => ({ ...i, sortOrder: idx })) },
        );
        await onRefresh();
    };

    // 可编辑行
    const editRow = (label: string, field: string, tKey: string) => (
        <tr className={`border-b border-border ${hoverRow}`}>
            <td className={lb}>{label}</td>
            {entries.map((e: any) => (
                <td key={e.id} className={cl}>
                    {isDraft ? (
                        <Input
                            type="number"
                            value={editData[e.id]?.[field] || ''}
                            onChange={(ev) => updateField(
                                e.id, field,
                                parseFloat(ev.target.value) || 0,
                            )}
                            className="h-7 w-full text-right text-sm
                                border-0 bg-transparent p-0
                                focus-visible:ring-1"
                        />
                    ) : (
                        <span>{fmt(editData[e.id]?.[field] || 0)}</span>
                    )}
                </td>
            ))}
            <td className={`${cl} font-medium bg-muted/30`}>
                {fmt(totals[tKey] || 0)}
            </td>
        </tr>
    );

    // 计算行（使用不透明背景防止滚动叠加）
    const calcRow = (
        label: string,
        fn: (e: any) => number,
        tv: number,
        pct = false,
        bold = false,
    ) => (
        <tr className={`border-b border-border ${
            bold ? 'bg-primary/5' : 'bg-muted/10'
        } ${hoverRow}`}>
            <td className={`${hd} sticky left-0 z-10 ${
                bold ? 'font-bold bg-[#262626]' : 'bg-[#262626]'
            }`}>
                {label}
            </td>
            {entries.map((e: any) => {
                const v = fn(e);
                return (
                    <td key={e.id} className={`${cl} ${nc(v)} ${
                        bold ? 'font-bold' : ''
                    }`}>
                        {pct ? fmtPct(v) : fmt(v)}
                    </td>
                );
            })}
            <td className={`${cl} font-bold bg-muted/30 ${nc(tv)}`}>
                {pct ? fmtPct(tv) : fmt(tv)}
            </td>
        </tr>
    );

    return (
        <>
            <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-card border-b border-border">
                            <th className={`${hd} sticky left-0
                                bg-card z-20 min-w-[140px]`}>
                                项目
                            </th>
                            {entries.map((e: any) => (
                                <th key={e.id}
                                    className={`${hd} min-w-[120px]`}>
                                    {e.shop?.name}
                                </th>
                            ))}
                            <th className={`${hd} min-w-[120px]
                                bg-muted/30`}>
                                合计
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {editRow('销售额', 'salesAmount', 'sales')}
                        {editRow('原料成本', 'rawMaterialCost', 'raw')}
                        {editRow('包装成本', 'packagingCost', 'pkg')}
                        {editRow('人工成本', 'laborCost', 'labor')}

                        {/* 快递费用 */}
                        <tr className={`border-b border-border ${hoverRow}`}>
                            <td className={`${lb} cursor-pointer`}>
                                <span className="flex items-center gap-1">
                                    <Truck className="w-3.5 h-3.5" />
                                    快递费用
                                </span>
                            </td>
                            {entries.map((e: any) => (
                                <td key={e.id}
                                    className={`${cl} cursor-pointer
                                        hover:bg-primary/5`}
                                    onClick={() => setShippingEntry(e)}
                                >
                                    {fmt(calc(e).ship)}
                                </td>
                            ))}
                            <td className={`${cl} font-medium bg-muted/30`}>
                                {fmt(totals.ship || 0)}
                            </td>
                        </tr>

                        {calcRow('毛利',
                            (e) => calc(e).gross,
                            totals.gross)}
                        {calcRow('毛利率',
                            (e) => calc(e).margin,
                            totals.margin, true)}

                        {/* 平台费用 */}
                        <tr className={`border-b border-border ${hoverRow}`}>
                            <td className={`${lb} cursor-pointer`}>
                                <span className="flex items-center gap-1">
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                    平台费用
                                </span>
                            </td>
                            {entries.map((e: any) => (
                                <td key={e.id}
                                    className={`${cl} cursor-pointer
                                        hover:bg-primary/5`}
                                    onClick={() => setExpenseEntry(e)}
                                >
                                    {fmt(calc(e).platform)}
                                </td>
                            ))}
                            <td className={`${cl} font-medium bg-muted/30`}>
                                {fmt(totals.platform || 0)}
                            </td>
                        </tr>

                        {/* 分摊行 */}
                        {cats.map((cat: any) => (
                            <tr key={cat.id}
                                className={`border-b border-border
                                    ${hoverRow}`}>
                                <td className={lb}>{cat.name}</td>
                                {entries.map((e: any) => (
                                    <td key={e.id} className={cl}>
                                        {isDraft ? (
                                            <Input
                                                type="number"
                                                value={
                                                    allocData[e.id]
                                                        ?.[cat.id] || ''
                                                }
                                                onChange={(ev) =>
                                                    updateAlloc(
                                                        e.id, cat.id,
                                                        parseFloat(
                                                            ev.target.value,
                                                        ) || 0,
                                                    )
                                                }
                                                className="h-7 w-full
                                                    text-right text-sm
                                                    border-0 bg-transparent
                                                    p-0 focus-visible:ring-1"
                                            />
                                        ) : (
                                            <span>
                                                {fmt(
                                                    allocData[e.id]
                                                        ?.[cat.id] || 0,
                                                )}
                                            </span>
                                        )}
                                    </td>
                                ))}
                                <td className={`${cl} font-medium
                                    bg-muted/30`}>
                                    {fmt(catTotal(cat.id))}
                                </td>
                            </tr>
                        ))}

                        {calcRow('费用合计',
                            (e) => calc(e).expense,
                            totals.expense)}
                        {calcRow('净利润',
                            (e) => calc(e).net,
                            totals.net, false, true)}
                    </tbody>
                </table>
            </div>

            <StoreExpensePanel
                open={!!expenseEntry}
                onOpenChange={(o) => !o && setExpenseEntry(null)}
                shopName={expenseEntry?.shop?.name || ''}
                items={(expenseEntry?.storeExpenses || []).map(
                    (e: any) => ({
                        id: e.id, name: e.name,
                        amount: Number(e.amount), remark: e.remark || '',
                    }),
                )}
                onSave={handleSaveExpenses}
                readonly={!isDraft}
            />
            <ShippingPanel
                open={!!shippingEntry}
                onOpenChange={(o) => !o && setShippingEntry(null)}
                shopName={shippingEntry?.shop?.name || ''}
                items={shippingEntry?.shippingCosts || []}
                onSave={handleSaveShipping}
                readonly={!isDraft}
            />
        </>
    );
}

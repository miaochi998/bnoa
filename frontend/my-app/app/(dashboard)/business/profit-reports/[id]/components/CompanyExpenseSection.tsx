'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Plus, Trash2, Loader2, Building2,
    FolderMinus, Layers,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface Props {
    report: any;
    reportId: string;
    isDraft: boolean;
    onRefresh: () => Promise<void>;
}

export default function CompanyExpenseSection({
    report, reportId, isDraft, onRefresh,
}: Props) {
    const [companyItems, setCompanyItems] = useState<any[]>([]);
    const [nonItems, setNonItems] = useState<any[]>([]);
    const [allocCats, setAllocCats] = useState<any[]>([]);
    const [saving, setSaving] = useState('');

    useEffect(() => {
        setCompanyItems(
            (report.companyExpenses || []).map((i: any) => ({
                name: i.name, amount: Number(i.amount) || 0,
                isAllocatable: i.isAllocatable || false,
                remark: i.remark || '',
            })),
        );
        setNonItems(
            (report.nonExpenses || []).map((i: any) => ({
                name: i.name, amount: Number(i.amount) || 0,
                remark: i.remark || '',
            })),
        );
        setAllocCats(
            (report.allocationCategories || []).map((c: any) => ({
                id: c.id, name: c.name, sortOrder: c.sortOrder,
            })),
        );
    }, [report]);

    const saveCompany = async () => {
        try {
            setSaving('company');
            await apiClient.saveProfitCompanyExpenses(reportId, {
                items: companyItems.filter((i) => i.name.trim())
                    .map((i, idx) => ({ ...i, sortOrder: idx })),
            });
            await onRefresh();
        } catch (e: any) {
            alert(e.message || '保存失败');
        } finally {
            setSaving('');
        }
    };

    const saveNon = async () => {
        try {
            setSaving('non');
            await apiClient.saveProfitNonExpenses(reportId, {
                items: nonItems.filter((i) => i.name.trim())
                    .map((i, idx) => ({ ...i, sortOrder: idx })),
            });
            await onRefresh();
        } catch (e: any) {
            alert(e.message || '保存失败');
        } finally {
            setSaving('');
        }
    };

    const saveAllocCats = async () => {
        try {
            setSaving('alloc');
            await apiClient.saveProfitAllocationCategories(reportId, {
                categories: allocCats.filter((c) => c.name.trim())
                    .map((c, idx) => ({
                        id: c.id || undefined,
                        name: c.name,
                        sortOrder: idx,
                    })),
            });
            await onRefresh();
        } catch (e: any) {
            alert(e.message || '保存失败');
        } finally {
            setSaving('');
        }
    };

    const companyTotal = companyItems.reduce(
        (s, i) => s + (Number(i.amount) || 0), 0,
    );
    const nonTotal = nonItems.reduce(
        (s, i) => s + (Number(i.amount) || 0), 0,
    );

    const sectionTitle = (
        icon: React.ReactNode, title: string, total?: number,
    ) => (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                {icon}
                <h3 className="text-sm font-semibold">{title}</h3>
            </div>
            {total !== undefined && (
                <span className="text-sm font-bold">
                    合计: {total.toFixed(3)}
                </span>
            )}
        </div>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 公司费用 */}
            <div className="border border-border rounded-lg p-4">
                {sectionTitle(
                    <Building2 className="w-4 h-4 text-primary" />,
                    '公司费用', companyTotal,
                )}
                <div className="space-y-2">
                    {companyItems.map((item, idx) => (
                        <div key={idx}
                            className="flex items-center gap-2 group">
                            <Input
                                placeholder="费用名称"
                                value={item.name}
                                onChange={(e) => {
                                    const u = [...companyItems];
                                    u[idx].name = e.target.value;
                                    setCompanyItems(u);
                                }}
                                className="flex-1 h-8 text-sm"
                                readOnly={!isDraft}
                            />
                            <Input
                                type="number"
                                value={item.amount || ''}
                                onChange={(e) => {
                                    const u = [...companyItems];
                                    u[idx].amount =
                                        parseFloat(e.target.value) || 0;
                                    setCompanyItems(u);
                                }}
                                className="w-24 h-8 text-sm text-right"
                                readOnly={!isDraft}
                            />
                            <div className="flex items-center gap-1">
                                <Checkbox
                                    checked={item.isAllocatable}
                                    onCheckedChange={(v) => {
                                        const u = [...companyItems];
                                        u[idx].isAllocatable = !!v;
                                        setCompanyItems(u);
                                    }}
                                    disabled={!isDraft}
                                />
                                <span className="text-xs
                                    text-muted-foreground">
                                    可分摊
                                </span>
                            </div>
                            {isDraft && (
                                <Button variant="ghost" size="icon"
                                    className="h-8 w-8 opacity-0
                                        group-hover:opacity-100"
                                    onClick={() => setCompanyItems(
                                        companyItems.filter(
                                            (_, i) => i !== idx),
                                    )}>
                                    <Trash2
                                        className="w-3.5 h-3.5
                                            text-destructive"
                                    />
                                </Button>
                            )}
                        </div>
                    ))}
                    {isDraft && (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm"
                                className="flex-1"
                                onClick={() => setCompanyItems([
                                    ...companyItems,
                                    {
                                        name: '', amount: 0,
                                        isAllocatable: false, remark: '',
                                    },
                                ])}>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                添加
                            </Button>
                            <Button size="sm" onClick={saveCompany}
                                disabled={saving === 'company'}>
                                {saving === 'company'
                                    ? <Loader2 className="w-4 h-4
                                        animate-spin" />
                                    : '保存'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* 不计入费用 */}
            <div className="border border-border rounded-lg p-4">
                {sectionTitle(
                    <FolderMinus className="w-4 h-4 text-yellow-500" />,
                    '不计入费用', nonTotal,
                )}
                <div className="space-y-2">
                    {nonItems.map((item, idx) => (
                        <div key={idx}
                            className="flex items-center gap-2 group">
                            <Input
                                placeholder="名称"
                                value={item.name}
                                onChange={(e) => {
                                    const u = [...nonItems];
                                    u[idx].name = e.target.value;
                                    setNonItems(u);
                                }}
                                className="flex-1 h-8 text-sm"
                                readOnly={!isDraft}
                            />
                            <Input
                                type="number"
                                value={item.amount || ''}
                                onChange={(e) => {
                                    const u = [...nonItems];
                                    u[idx].amount =
                                        parseFloat(e.target.value) || 0;
                                    setNonItems(u);
                                }}
                                className="w-24 h-8 text-sm text-right"
                                readOnly={!isDraft}
                            />
                            {isDraft && (
                                <Button variant="ghost" size="icon"
                                    className="h-8 w-8 opacity-0
                                        group-hover:opacity-100"
                                    onClick={() => setNonItems(
                                        nonItems.filter(
                                            (_, i) => i !== idx),
                                    )}>
                                    <Trash2
                                        className="w-3.5 h-3.5
                                            text-destructive"
                                    />
                                </Button>
                            )}
                        </div>
                    ))}
                    {isDraft && (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm"
                                className="flex-1"
                                onClick={() => setNonItems([
                                    ...nonItems,
                                    { name: '', amount: 0, remark: '' },
                                ])}>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                添加
                            </Button>
                            <Button size="sm" onClick={saveNon}
                                disabled={saving === 'non'}>
                                {saving === 'non'
                                    ? <Loader2 className="w-4 h-4
                                        animate-spin" />
                                    : '保存'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* 分摊类别管理 */}
            <div className="border border-border rounded-lg p-4">
                {sectionTitle(
                    <Layers className="w-4 h-4 text-green-500" />,
                    '分摊类别',
                )}
                <p className="text-xs text-muted-foreground mb-3">
                    管理分摊费用类别（如运营人员分摊），
                    金额在上方表格中按店铺填写
                </p>
                <div className="space-y-2">
                    {allocCats.map((cat, idx) => (
                        <div key={idx}
                            className="flex items-center gap-2 group">
                            <Input
                                placeholder="类别名称"
                                value={cat.name}
                                onChange={(e) => {
                                    const u = [...allocCats];
                                    u[idx].name = e.target.value;
                                    setAllocCats(u);
                                }}
                                className="flex-1 h-8 text-sm"
                                readOnly={!isDraft}
                            />
                            {isDraft && (
                                <Button variant="ghost" size="icon"
                                    className="h-8 w-8 opacity-0
                                        group-hover:opacity-100"
                                    onClick={() => setAllocCats(
                                        allocCats.filter(
                                            (_, i) => i !== idx),
                                    )}>
                                    <Trash2
                                        className="w-3.5 h-3.5
                                            text-destructive"
                                    />
                                </Button>
                            )}
                        </div>
                    ))}
                    {isDraft && (
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm"
                                className="flex-1"
                                onClick={() => setAllocCats([
                                    ...allocCats,
                                    { name: '', sortOrder: allocCats.length },
                                ])}>
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                添加类别
                            </Button>
                            <Button size="sm" onClick={saveAllocCats}
                                disabled={saving === 'alloc'}>
                                {saving === 'alloc'
                                    ? <Loader2 className="w-4 h-4
                                        animate-spin" />
                                    : '保存'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Sheet, SheetContent, SheetHeader,
    SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Plus, Trash2, Loader2 } from 'lucide-react';

interface ExpenseItem {
    id?: string;
    name: string;
    amount: number;
    remark: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    shopName: string;
    items: ExpenseItem[];
    onSave: (items: ExpenseItem[]) => Promise<void>;
    readonly?: boolean;
}

export default function StoreExpensePanel({
    open, onOpenChange, shopName, items: initItems,
    onSave, readonly,
}: Props) {
    const [items, setItems] = useState<ExpenseItem[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setItems(initItems.length > 0
                ? initItems.map((i) => ({ ...i }))
                : [{ name: '', amount: 0, remark: '' }]);
        }
    }, [open, initItems]);

    const addItem = () => {
        setItems([...items, { name: '', amount: 0, remark: '' }]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (
        index: number,
        field: keyof ExpenseItem,
        value: string | number,
    ) => {
        const updated = [...items];
        (updated[index] as any)[field] = value;
        setItems(updated);
    };

    const total = items.reduce(
        (sum, i) => sum + (Number(i.amount) || 0), 0,
    );

    const handleSave = async () => {
        try {
            setSaving(true);
            const validItems = items.filter(
                (i) => i.name.trim() !== '',
            );
            await onSave(validItems);
            onOpenChange(false);
        } catch (error: any) {
            alert(error.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[520px] sm:max-w-[520px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>
                        {shopName} - 平台费用明细
                    </SheetTitle>
                </SheetHeader>
                <div className="mt-4 px-6 space-y-3">
                    {items.map((item, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-2 group"
                        >
                            <Input
                                placeholder="费用项名称"
                                value={item.name}
                                onChange={(e) => updateItem(
                                    idx, 'name', e.target.value,
                                )}
                                className="flex-1 h-8 text-sm"
                                readOnly={readonly}
                            />
                            <Input
                                type="number"
                                placeholder="金额"
                                value={item.amount || ''}
                                onChange={(e) => updateItem(
                                    idx, 'amount',
                                    parseFloat(e.target.value) || 0,
                                )}
                                className="w-28 h-8 text-sm text-right"
                                readOnly={readonly}
                            />
                            <Input
                                placeholder="备注"
                                value={item.remark}
                                onChange={(e) => updateItem(
                                    idx, 'remark', e.target.value,
                                )}
                                className="w-32 h-8 text-sm"
                                readOnly={readonly}
                            />
                            {!readonly && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                    onClick={() => removeItem(idx)}
                                >
                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                            )}
                        </div>
                    ))}
                    {!readonly && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={addItem}
                            className="w-full"
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            添加费用项
                        </Button>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-border">
                        <span className="text-sm font-medium">合计</span>
                        <span className="text-sm font-bold">
                            {total.toFixed(3)}
                        </span>
                    </div>
                </div>
                {!readonly && (
                    <SheetFooter className="mt-6 px-6">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            取消
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving && (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            )}
                            保存
                        </Button>
                    </SheetFooter>
                )}
            </SheetContent>
        </Sheet>
    );
}

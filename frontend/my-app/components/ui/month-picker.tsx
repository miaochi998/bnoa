'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_LABELS = [
    '1月', '2月', '3月', '4月',
    '5月', '6月', '7月', '8月',
    '9月', '10月', '11月', '12月',
];

interface MonthPickerProps {
    year: number;
    month: number;
    onSelect: (year: number, month: number) => void;
    className?: string;
}

export function MonthPicker({
    year, month, onSelect, className,
}: MonthPickerProps) {
    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(year);

    const handleSelect = (m: number) => {
        onSelect(viewYear, m);
        setOpen(false);
    };

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth() + 1;

    return (
        <Popover
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (v) setViewYear(year);
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        'w-full justify-start text-left font-normal',
                        className,
                    )}
                >
                    <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                    {year}年{month}月
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
                {/* 年份导航 */}
                <div className="flex items-center justify-between px-3 py-2 border-b">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setViewYear((y) => y - 1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-semibold">{viewYear}年</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setViewYear((y) => y + 1)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* 月份网格 */}
                <div className="grid grid-cols-4 gap-1 p-3">
                    {MONTH_LABELS.map((label, idx) => {
                        const m = idx + 1;
                        const isSelected = viewYear === year && m === month;
                        const isToday = viewYear === todayYear && m === todayMonth;
                        return (
                            <button
                                key={m}
                                onClick={() => handleSelect(m)}
                                className={cn(
                                    'h-9 w-full rounded-md text-sm transition-colors',
                                    'hover:bg-accent hover:text-accent-foreground',
                                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    isSelected
                                        ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                                        : isToday
                                            ? 'border border-primary/50 text-primary'
                                            : '',
                                )}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

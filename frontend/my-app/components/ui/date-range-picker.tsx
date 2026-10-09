'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

/** 星期表头（周一起） */
const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (s?: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const sameDay = (a: Date | null, b: Date | null) =>
  !!a && !!b && toKey(a) === toKey(b);

/** 生成某月的日期网格（周一为第一列，空位为 null） */
function monthCells(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export interface DateRangePickerProps {
  startDate?: string;
  endDate?: string;
  /** 确认选择后回调（YYYY-MM-DD） */
  onChange: (start: string, end: string) => void;
  className?: string;
  placeholder?: string;
}

/**
 * 双月并排的日期区间选择器（自研，无第三方日期库依赖）。
 * 交互：点击起始日 → 点击结束日 → 确定；再次点击可重选。
 */
export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  className,
  placeholder = '按时间筛选',
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const [tempStart, setTempStart] = useState<Date | null>(null);
  const [tempEnd, setTempEnd] = useState<Date | null>(null);
  /** 左月（右月 = 左月 + 1） */
  const [view, setView] = useState(() => {
    const base = fromKey(startDate) || today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // 打开时同步外部值
  useEffect(() => {
    if (!open) return;
    setTempStart(fromKey(startDate));
    setTempEnd(fromKey(endDate));
    const base = fromKey(startDate) || today;
    setView(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [open, startDate, endDate, today]);

  const months = useMemo(
    () => [
      { year: view.getFullYear(), month: view.getMonth() },
      {
        year: new Date(view.getFullYear(), view.getMonth() + 1, 1).getFullYear(),
        month: new Date(view.getFullYear(), view.getMonth() + 1, 1).getMonth(),
      },
    ],
    [view],
  );

  const shift = (delta: number) =>
    setView(new Date(view.getFullYear(), view.getMonth() + delta, 1));

  const pick = (d: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(d);
      setTempEnd(null);
      return;
    }
    if (d.getTime() < tempStart.getTime()) {
      setTempEnd(tempStart);
      setTempStart(d);
    } else {
      setTempEnd(d);
    }
  };

  const inRange = (d: Date) => {
    if (!tempStart || !tempEnd) return false;
    const t = d.getTime();
    return t > tempStart.getTime() && t < tempEnd.getTime();
  };

  const applyQuick = (days: number) => {
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    setTempStart(start);
    setTempEnd(end);
    setView(new Date(start.getFullYear(), start.getMonth(), 1));
  };

  const confirm = () => {
    if (!tempStart) return;
    onChange(toKey(tempStart), toKey(tempEnd || tempStart));
    setOpen(false);
  };

  const clearAll = () => {
    setTempStart(null);
    setTempEnd(null);
    onChange('', '');
    setOpen(false);
  };

  const label = startDate
    ? `${startDate}${endDate && endDate !== startDate ? ` 至 ${endDate}` : ''}`
    : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full cursor-pointer justify-between font-normal',
            !label && 'text-muted-foreground',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{label || placeholder}</span>
          </span>
          <ChevronRight className="ml-2 h-4 w-4 shrink-0 rotate-90 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-3">
        {/* 顶部导航：左右各一个翻月按钮（标题与下方双月对齐） */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="cursor-pointer rounded p-1 transition-colors duration-200 hover:bg-[#2e2e2e]"
              onClick={() => shift(-12)}
              title="上一年"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="cursor-pointer rounded p-1 transition-colors duration-200 hover:bg-[#2e2e2e]"
              onClick={() => shift(-1)}
              title="上一月"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            <span className="w-[236px] text-center">
              {months[0].year}年{months[0].month + 1}月
            </span>
            <span className="w-[236px] text-center">
              {months[1].year}年{months[1].month + 1}月
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              className="cursor-pointer rounded p-1 transition-colors duration-200 hover:bg-[#2e2e2e]"
              onClick={() => shift(1)}
              title="下一月"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="cursor-pointer rounded p-1 transition-colors duration-200 hover:bg-[#2e2e2e]"
              onClick={() => shift(12)}
              title="下一年"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 双月 */}
        <div className="flex gap-4">
          {months.map((m, mi) => (
            <div key={mi} className="w-[236px]">
              <div className="mb-1 grid grid-cols-7 gap-y-1 text-center text-[11px] text-muted-foreground">
                {WEEK_LABELS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-y-1">
                {monthCells(m.year, m.month).map((d, i) => {
                  if (!d) return <span key={i} className="h-7" />;
                  const isStart = sameDay(d, tempStart);
                  const isEnd = sameDay(d, tempEnd);
                  const isEdge = isStart || isEnd;
                  const isToday = sameDay(d, today);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => pick(d)}
                      className={cn(
                        'relative h-7 cursor-pointer rounded text-xs transition-colors duration-200',
                        inRange(d) && 'bg-[#409fff]/20',
                        isEdge &&
                          'bg-[#409fff] font-medium text-white hover:bg-[#409fff]',
                        !isEdge &&
                          !inRange(d) &&
                          'hover:bg-[#2e2e2e]',
                        !isEdge && isWeekend && 'text-[#8e8e8e]',
                      )}
                    >
                      {d.getDate()}
                      {isToday && !isEdge && (
                        <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#409fff]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 底部 */}
        <div className="mt-3 flex items-center justify-between border-t border-[#2e2e2e] pt-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer text-xs"
              onClick={() => applyQuick(7)}
            >
              近7天
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer text-xs"
              onClick={() => applyQuick(30)}
            >
              近30天
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer text-xs"
              onClick={() => applyQuick(90)}
            >
              近90天
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {(startDate || endDate) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer text-xs text-muted-foreground"
                onClick={clearAll}
              >
                清除
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="h-7 cursor-pointer text-xs"
              disabled={!tempStart}
              onClick={confirm}
            >
              确定
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

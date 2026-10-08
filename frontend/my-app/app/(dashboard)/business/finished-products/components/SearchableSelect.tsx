"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search } from "lucide-react";

/** 距离视口边缘的安全间距（px） */
const VIEWPORT_PADDING = 16;

export interface SearchableSelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

interface SearchableSelectProps {
    value: string;
    onValueChange: (value: string) => void;
    options: SearchableSelectOption[];
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    contentClassName?: string;
    emptyText?: string;
    searchPlaceholder?: string;
}

export function SearchableSelect({
    value,
    onValueChange,
    options,
    placeholder = "请选择",
    disabled,
    className,
    contentClassName,
    emptyText = "无匹配结果",
    searchPlaceholder = "搜索...",
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");

    const handleListWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const { scrollTop, scrollHeight, clientHeight } = el;
        if (clientHeight >= scrollHeight) return;
        const canScrollUp = scrollTop > 0;
        const canScrollDown = scrollTop < scrollHeight - clientHeight;
        const scrollingUp = e.deltaY < 0;
        const scrollingDown = e.deltaY > 0;
        if ((scrollingUp && canScrollUp) || (scrollingDown && canScrollDown)) {
            el.scrollTop += e.deltaY;
            e.preventDefault();
            e.stopPropagation();
        }
    }, []);

    const selected = useMemo(
        () => options.find((o) => o.value === value),
        [options, value],
    );

    const filtered = useMemo(() => {
        const keyword = q.trim().toLowerCase();
        if (!keyword) return options;
        return options.filter((o) =>
            (o.label || "").toLowerCase().includes(keyword),
        );
    }, [options, q]);

    return (
        <Popover
            open={open}
            onOpenChange={(v) => {
                if (!v) setQ("");
                setOpen(v);
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "w-full justify-between bg-[#1e1e1e] border-[#1e1e1e] text-white hover:bg-[#363636]",
                        !selected && "text-[#8e8e8e]",
                        className,
                    )}
                >
                    <span className="truncate">
                        {selected?.label || placeholder}
                    </span>
                    <ChevronDown className="w-4 h-4 opacity-70" />
                </Button>
            </PopoverTrigger>
            {/*
             * 使用 Radix 提供的 --radix-popover-content-available-height CSS 变量
             * 限制整个弹出层不超过视口可用空间，搜索框始终可见，列表区域自适应滚动。
             */}
            <PopoverContent
                align="start"
                collisionPadding={VIEWPORT_PADDING}
                className={cn(
                    "flex flex-col p-2 w-[--radix-popover-trigger-width] bg-[#2e2e2e] border-[#1e1e1e] text-white",
                    contentClassName,
                )}
                style={{ maxHeight: "var(--radix-popover-content-available-height)" }}
            >
                <div className="relative mb-2 shrink-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8e8e8e]" />
                    <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="pl-8 bg-[#1e1e1e] border-[#1e1e1e] text-white placeholder:text-[#8e8e8e] h-8"
                    />
                </div>
                <div
                    className="flex-1 min-h-0 overflow-y-auto w-full rounded-md overscroll-contain"
                    onWheel={handleListWheel}
                >
                    {filtered.length === 0 ? (
                        <div className="text-center py-4 text-[#8e8e8e] text-sm">
                            {emptyText}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filtered.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => {
                                        if (!option.disabled) {
                                            onValueChange(option.value);
                                            setOpen(false);
                                            setQ("");
                                        }
                                    }}
                                    className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm",
                                        option.disabled
                                            ? "opacity-50 cursor-not-allowed"
                                            : "hover:bg-[#3e3e3e]",
                                        option.value === value
                                            ? "bg-[#409fff]/20 text-[#409fff]"
                                            : "text-white",
                                    )}
                                >
                                    <Check
                                        className={cn(
                                            "w-4 h-4",
                                            option.value === value
                                                ? "opacity-100"
                                                : "opacity-0",
                                        )}
                                    />
                                    <span className="truncate">{option.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

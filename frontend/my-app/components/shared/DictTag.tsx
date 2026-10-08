'use client';

import { useDictionary } from '@/hooks/useDictionary';

interface DictTagProps {
    typeCode: string;
    value: string;
    /** 自定义 className，会覆盖默认样式 */
    className?: string;
}

/**
 * 字典标签组件
 * 根据 typeCode 和 itemCode 自动展示带颜色的 Badge
 */
export function DictTag({
    typeCode,
    value,
    className,
}: DictTagProps) {
    const { getLabel, getColor, loading } =
        useDictionary(typeCode);

    if (loading) {
        return (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-[#3e3e3e]/50 text-[#8e8e8e]">
                ...
            </span>
        );
    }

    const label = getLabel(typeCode, value);
    const color = getColor(typeCode, value);

    if (!color) {
        return (
            <span
                className={
                    className ||
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-[#3e3e3e] text-[#8e8e8e]'
                }
            >
                {label}
            </span>
        );
    }

    return (
        <span
            className={
                className ||
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium'
            }
            style={{
                backgroundColor: `${color}1a`,
                color: color,
            }}
        >
            {label}
        </span>
    );
}

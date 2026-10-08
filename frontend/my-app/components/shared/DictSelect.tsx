'use client';

import { useDictionary } from '@/hooks/useDictionary';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface DictSelectProps {
    typeCode: string;
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    /** 是否在最前面添加"全部"选项 */
    showAll?: boolean;
    allLabel?: string;
    allValue?: string;
    /** 排除指定 itemCode 的选项 */
    excludeValues?: string[];
    disabled?: boolean;
    className?: string;
}

/**
 * 字典下拉选择组件
 * 根据 typeCode 自动加载选项
 */
export function DictSelect({
    typeCode,
    value,
    onChange,
    placeholder = '请选择',
    showAll = false,
    allLabel = '全部',
    allValue = 'all',
    excludeValues,
    disabled = false,
    className,
}: DictSelectProps) {
    const { data, loading } = useDictionary(typeCode);
    const items = data[typeCode] || [];

    return (
        <Select
            value={value}
            onValueChange={onChange}
            disabled={disabled || loading}
        >
            <SelectTrigger className={className}>
                <SelectValue
                    placeholder={
                        loading ? '加载中...' : placeholder
                    }
                />
            </SelectTrigger>
            <SelectContent>
                {showAll && (
                    <SelectItem value={allValue}>
                        {allLabel}
                    </SelectItem>
                )}
                {items
                    .filter((item) => item.isActive
                        && (!excludeValues
                            || !excludeValues.includes(
                                item.itemCode,
                            )))
                    .map((item) => (
                        <SelectItem
                            key={item.id}
                            value={item.itemCode}
                        >
                            <span className="flex items-center gap-2">
                                {item.color && (
                                    <span
                                        className="inline-block w-2 h-2 rounded-full"
                                        style={{
                                            backgroundColor:
                                                item.color,
                                        }}
                                    />
                                )}
                                {item.itemName}
                            </span>
                        </SelectItem>
                    ))}
            </SelectContent>
        </Select>
    );
}

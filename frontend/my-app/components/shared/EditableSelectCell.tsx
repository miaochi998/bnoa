'use client';

import { useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Option {
    label: string;
    value: string;
}

interface EditableSelectCellProps {
    value: string | null | undefined;
    options: Option[];
    onSave: (value: string) => Promise<void> | void;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

export function EditableSelectCell({
    value,
    options,
    onSave,
    disabled = false,
    className = '',
    placeholder = '选择',
}: EditableSelectCellProps) {
    const [saving, setSaving] = useState(false);

    const currentLabel =
        options.find((o) => o.value === value)?.label || value || '-';

    const handleChange = async (val: string) => {
        if (val === value) return;
        setSaving(true);
        try {
            await onSave(val);
        } catch (error) {
            console.error('保存失败:', error);
            toast.error('保存失败');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="relative flex items-center">
            <Select
                value={value ?? undefined}
                onValueChange={handleChange}
                disabled={disabled || saving}
            >
                <SelectTrigger
                    className={`h-7 text-xs bg-[#1e1e1e] border-[#3e3e3e] text-white cursor-pointer ${
                        disabled ? 'opacity-50 cursor-not-allowed' : ''
                    } ${className}`}
                    title={disabled ? '无编辑权限' : '点击选择'}
                >
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                    {options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                            {o.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {saving && (
                <Loader2 className="w-3 h-3 text-[#409fff] animate-spin absolute right-7" />
            )}
        </div>
    );
}

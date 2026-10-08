'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditableSwitchCellProps {
    checked: boolean;
    onSave: (checked: boolean) => Promise<void> | void;
    disabled?: boolean;
    activeLabel?: string;
    inactiveLabel?: string;
}

export function EditableSwitchCell({
    checked,
    onSave,
    disabled = false,
    activeLabel = '启用',
    inactiveLabel = '停用',
}: EditableSwitchCellProps) {
    const [saving, setSaving] = useState(false);

    const handleToggle = async (val: boolean) => {
        if (val === checked) return;
        setSaving(true);
        try {
            await onSave(val);
        } catch (error) {
            console.error('切换失败:', error);
            toast.error('切换失败');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <Switch
                checked={checked}
                onCheckedChange={handleToggle}
                disabled={disabled || saving}
            />
            <span
                className={`text-xs font-medium ${
                    checked ? 'text-emerald-400' : 'text-gray-500'
                }`}
            >
                {checked ? activeLabel : inactiveLabel}
            </span>
            {saving && (
                <Loader2 className="w-3 h-3 text-[#409fff] animate-spin" />
            )}
        </div>
    );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface EditableCellProps {
    value: string | number | null | undefined;
    onSave: (newValue: string) => Promise<void>;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    maxLength?: number;
    type?: 'text' | 'tel' | 'number';
    label?: string;
}

export function EditableCell({
    value,
    onSave,
    placeholder = '点击编辑',
    className = '',
    disabled = false,
    maxLength,
    type = 'text',
    label = '',
}: EditableCellProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const displayValue = value || '-';

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleClick = (e: React.MouseEvent) => {
        if (disabled || isSaving) return;
        e.stopPropagation();
        setEditValue(value == null ? '' : String(value));
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (isSaving) return;

        const trimmedValue = editValue.trim();
        const originalValue = value == null ? '' : String(value);

        // 如果值没有变化，直接取消编辑
        if (trimmedValue === originalValue) {
            setIsEditing(false);
            return;
        }

        // 数字类型校验：非空时必须是合法数字（允许小数）
        if (type === 'number' && trimmedValue !== '' && !/^\d*\.?\d+$/.test(trimmedValue)) {
            toast.error(`${label || '价格'}必须为数字`);
            return;
        }

        setIsSaving(true);
        try {
            await onSave(trimmedValue);
            setIsEditing(false);
        } catch (error) {
            console.error('保存失败:', error);
            // 保存失败时保持编辑状态，让用户可以重试
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    const handleBlur = () => {
        // 延迟执行，避免与点击事件冲突
        setTimeout(() => {
            if (isEditing && !isSaving) {
                handleSave();
            }
        }, 150);
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1 relative">
                <Input
                    ref={inputRef}
                    type={type}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    disabled={isSaving}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    className={`h-7 text-xs bg-[#1e1e1e] border-[#3e3e3e] text-white ${className}`}
                />
                {isSaving && (
                    <Loader2 className="w-3 h-3 text-[#409fff] animate-spin absolute right-2" />
                )}
            </div>
        );
    }

    return (
        <div
            onClick={handleClick}
            className={`cursor-pointer hover:bg-[#2e2e2e] px-2 py-1 rounded transition-colors ${
                disabled ? 'cursor-not-allowed opacity-50' : ''
            } ${className}`}
            title={disabled ? '无编辑权限' : '点击编辑'}
        >
            {displayValue}
        </div>
    );
}

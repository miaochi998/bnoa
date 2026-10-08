'use client';

// Toolbar/SaveVersionButton.tsx
import { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Save } from 'lucide-react';

interface SaveVersionButtonProps {
    editor: Editor;
    contentKey?: string;
    onSave?: (
        content: any,
        htmlContent: string
    ) => void | Promise<void>;
}

export function SaveVersionButton({
    editor,
    contentKey,
    onSave,
}: SaveVersionButtonProps) {
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!editor || saving) return;
        setSaving(true);
        try {
            const content = editor.getJSON();
            const html = editor.getHTML();
            if (onSave) {
                await onSave(content, html);
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1"
                    disabled={saving}
                    onClick={handleSave}
                >
                    <Save className="h-4 w-4" />
                    <span className="text-xs">
                        {saving ? '保存中...' : '保存'}
                    </span>
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                保存内容
            </TooltipContent>
        </Tooltip>
    );
}

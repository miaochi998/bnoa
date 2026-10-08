'use client';

// components/shared/RichTextEditor/hooks/useAutoSave.ts
import { useEffect, useRef } from 'react';
import { UseAutoSaveOptions } from '../types';
import { AUTO_SAVE_INTERVAL } from '../constants';

export function useAutoSave({
    editor,
    contentKey,
    enabled = true,
    interval = AUTO_SAVE_INTERVAL,
    onSave,
    createVersionSnapshot = false,
}: UseAutoSaveOptions) {
    const lastContentRef = useRef<string>('');
    const timerRef =
        useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!editor || !enabled) return;

        const handleUpdate = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(
                async () => {
                    const content = editor.getJSON();
                    const currentStr =
                        JSON.stringify(content);

                    // 内容未变化则跳过
                    if (
                        currentStr
                        === lastContentRef.current
                    ) {
                        return;
                    }

                    const html = editor.getHTML();

                    // 调用外部保存回调
                    if (onSave) {
                        await onSave(content, html);
                    }

                    lastContentRef.current = currentStr;
                },
                interval
            );
        };

        editor.on('update', handleUpdate);
        return () => {
            editor.off('update', handleUpdate);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [
        editor, enabled, interval,
        onSave, createVersionSnapshot, contentKey,
    ]);
}

'use client';

// components/shared/RichTextEditor/hooks/useDraft.ts
import {
    useEffect,
    useState,
    useRef,
    useCallback,
} from 'react';
import { DraftData, UseDraftOptions } from '../types';
import {
    DRAFT_KEY_PREFIX,
    DRAFT_SAVE_INTERVAL,
    DRAFT_EXPIRY_DAYS,
} from '../constants';

export function useDraft({
    editor,
    contentKey,
    enabled = true,
}: UseDraftOptions) {
    const [showDraftDialog, setShowDraftDialog] =
        useState(false);
    const [savedDraft, setSavedDraft] =
        useState<DraftData | null>(null);
    const timerRef =
        useRef<NodeJS.Timeout | null>(null);

    const draftKey = contentKey
        ? `${DRAFT_KEY_PREFIX}${contentKey}`
        : null;

    // 保存草稿
    const saveDraft = useCallback(() => {
        if (!editor || !draftKey || !enabled) return;
        const content = editor.getJSON();
        const now = new Date();
        const expires = new Date(
            now.getTime()
                + DRAFT_EXPIRY_DAYS
                * 24 * 60 * 60 * 1000
        );
        const draft: DraftData = {
            contentKey: contentKey!,
            content,
            savedAt: now.toISOString(),
            expiresAt: expires.toISOString(),
        };
        try {
            localStorage.setItem(
                draftKey,
                JSON.stringify(draft)
            );
        } catch {
            // LocalStorage 写入失败时静默忽略
        }
    }, [editor, draftKey, enabled, contentKey]);

    // 恢复草稿
    const recoverDraft = useCallback(() => {
        if (savedDraft && editor) {
            editor.commands.setContent(
                savedDraft.content
            );
            setShowDraftDialog(false);
        }
    }, [savedDraft, editor]);

    // 放弃草稿
    const dismissDraft = useCallback(() => {
        if (draftKey) {
            try {
                localStorage.removeItem(draftKey);
            } catch {
                // 静默忽略
            }
        }
        setShowDraftDialog(false);
    }, [draftKey]);

    // 页面加载时检查草稿
    useEffect(() => {
        if (!enabled || !draftKey) return;
        try {
            const stored =
                localStorage.getItem(draftKey);
            if (stored) {
                const draft: DraftData =
                    JSON.parse(stored);
                const isExpired =
                    new Date()
                        > new Date(draft.expiresAt);
                if (isExpired) {
                    localStorage.removeItem(draftKey);
                    return;
                }
                setSavedDraft(draft);
                setShowDraftDialog(true);
            }
        } catch {
            // 解析失败时静默忽略
        }
    }, [enabled, draftKey]);

    // 监听编辑器更新，防抖保存草稿
    useEffect(() => {
        if (!editor || !enabled || !draftKey) return;
        const handleUpdate = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(
                saveDraft,
                DRAFT_SAVE_INTERVAL
            );
        };
        editor.on('update', handleUpdate);
        return () => {
            editor.off('update', handleUpdate);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [editor, enabled, draftKey, saveDraft]);

    return {
        showDraftDialog,
        savedDraft,
        recoverDraft,
        dismissDraft,
    };
}

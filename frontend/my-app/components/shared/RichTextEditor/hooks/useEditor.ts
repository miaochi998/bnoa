'use client';

// components/shared/RichTextEditor/hooks/useEditor.ts
import { useEditor as useTiptapEditor } from '@tiptap/react';
import { UseEditorOptions } from '../types';
import {
    EDITOR_PLACEHOLDER,
    SIMPLE_EDITOR_PLACEHOLDER,
} from '../constants';
import { getFullExtensions } from '../config/fullExtensions';
import { getSimpleExtensions } from '../config/simpleExtensions';

export function useEditorInstance(
    options: UseEditorOptions
) {
    const {
        mode = 'full',
        initialContent,
        onChange,
        placeholder,
    } = options;

    // 根据模式选择扩展配置
    const ph = placeholder
        || (mode === 'simple'
            ? SIMPLE_EDITOR_PLACEHOLDER
            : EDITOR_PLACEHOLDER);

    const extensions = mode === 'simple'
        ? getSimpleExtensions(ph)
        : getFullExtensions(ph);

    const editor = useTiptapEditor({
        immediatelyRender: false,
        shouldRerenderOnTransaction: true,
        extensions,
        content: initialContent,
        editable: mode !== 'readonly',
        onCreate: ({ editor }) => {
            onChange?.(editor.getJSON());
        },
        onUpdate: ({ editor }) => {
            onChange?.(editor.getJSON());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none '
                    + 'focus:outline-none p-4 '
                    + 'min-h-[300px]',
            },
        },
    });

    return editor;
}

// components/shared/RichTextEditor/config/fullExtensions.ts
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Typography from '@tiptap/extension-typography';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { VideoEmbed } from '../extensions/VideoEmbed';
import { Video } from '../extensions/Video';
import { createLowlight } from 'lowlight';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';

// 创建 lowlight 实例并注册常用语言
const lowlight = createLowlight();
lowlight.register('javascript', javascript);
lowlight.register('typescript', typescript);
lowlight.register('python', python);
lowlight.register('css', css);
lowlight.register('html', html);
lowlight.register('json', json);
lowlight.register('bash', bash);
lowlight.register('sql', sql);

export function getFullExtensions(placeholder: string) {
    return [
        // StarterKit v3 已包含 Link、Underline
        StarterKit.configure({
            codeBlock: false,
            link: {
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-primary underline'
                        + ' hover:opacity-80',
                },
            },
        }),
        Image.configure({
            HTMLAttributes: {
                class: 'rounded-lg max-w-full h-auto',
            },
        }),
        Table.configure({ resizable: true }),
        TableRow,
        TableCell,
        TableHeader,
        Placeholder.configure({ placeholder }),
        CharacterCount.configure({ limit: null }),
        Highlight.configure({ multicolor: true }),
        TextAlign.configure({
            types: ['heading', 'paragraph'],
            alignments: [
                'left', 'center', 'right', 'justify',
            ],
        }),
        TextStyle,
        Color,
        TaskList,
        TaskItem.configure({ nested: true }),
        CodeBlockLowlight.configure({
            lowlight,
            defaultLanguage: 'javascript',
        }),
        Typography,
        Subscript,
        Superscript,
        VideoEmbed,
        Video,
    ];
}

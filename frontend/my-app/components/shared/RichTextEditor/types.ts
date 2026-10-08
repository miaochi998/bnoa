// components/shared/RichTextEditor/types.ts
import { Editor } from '@tiptap/react';

/**
 * 编辑器模式
 */
export type EditorMode = 'full' | 'simple' | 'readonly';

/**
 * 版本类型
 */
export type VersionType = 'manual' | 'auto' | 'restore';

/**
 * RichTextEditor 组件 Props
 */
export interface RichTextEditorProps {
    /**
     * 内容唯一标识 - 用于草稿和版本管理
     * 格式: {contentType}_{contentId}
     * 示例: article_123, notice_45, comment_draft_67
     */
    contentKey?: string;

    /**
     * 编辑器模式
     * - full: 完整版（默认）
     * - simple: 简化版
     * - readonly: 只读模式
     */
    mode?: EditorMode;

    /**
     * 初始内容（Tiptap JSON 格式）
     */
    initialContent?: any;

    /**
     * 内容变化回调
     */
    onChange?: (content: any) => void;

    /**
     * 保存回调
     * @param content Tiptap JSON 格式
     * @param htmlContent HTML 字符串格式
     */
    onSave?: (
        content: any,
        htmlContent: string
    ) => void | Promise<void>;

    /**
     * 启用草稿功能（LocalStorage）
     * @default true
     */
    enableDraft?: boolean;

    /**
     * 启用自动保存版本快照
     * @default false
     */
    enableAutoSave?: boolean;

    /**
     * 启用版本管理功能
     * @default true (当 contentKey 存在时)
     */
    enableVersions?: boolean;

    /**
     * 自动保存间隔（毫秒）
     * @default 30000
     */
    autoSaveInterval?: number;

    /**
     * 占位符文本
     */
    placeholder?: string;

    /**
     * 自定义样式类名
     */
    className?: string;

    /**
     * 上传配置作用域
     * - 'editor'（默认）：使用通知编辑器配置
     * - 'notebook'：使用记事本专属配置
     */
    uploadScope?: 'editor' | 'notebook';
}

/**
 * useEditor Hook 配置
 */
export interface UseEditorOptions {
    mode?: EditorMode;
    initialContent?: any;
    onChange?: (content: any) => void;
    placeholder?: string;
}

/**
 * useDraft Hook 配置
 */
export interface UseDraftOptions {
    editor: Editor | null;
    contentKey?: string;
    enabled?: boolean;
}

/**
 * useAutoSave Hook 配置
 */
export interface UseAutoSaveOptions {
    editor: Editor | null;
    contentKey?: string;
    enabled?: boolean;
    interval?: number;
    onSave?: (
        content: any,
        htmlContent: string
    ) => void | Promise<void>;
    createVersionSnapshot?: boolean;
}

/**
 * 草稿数据
 */
export interface DraftData {
    contentKey: string;
    content: any;
    savedAt: string;     // ISO 时间戳
    expiresAt: string;   // 过期时间
}

/**
 * 内容版本数据
 */
export interface ContentVersion {
    id: string;
    contentType: string;
    contentId: string;
    versionNumber: number;
    content: any;
    htmlContent?: string;
    versionType: VersionType;
    versionName: string | null;
    characterCount: number | null;
    wordCount: number | null;
    createdBy: string;
    createdAt: string;
    creator?: {
        id: string;
        username: string;
        name: string;
    };
}

/**
 * 解析 contentKey
 */
export function parseContentKey(
    contentKey: string
): { contentType: string; contentId: string } {
    const lastIdx = contentKey.lastIndexOf('_');
    if (lastIdx === -1) {
        throw new Error(
            `Invalid contentKey: ${contentKey}`
        );
    }
    return {
        contentType: contentKey.substring(0, lastIdx),
        contentId: contentKey.substring(lastIdx + 1),
    };
}

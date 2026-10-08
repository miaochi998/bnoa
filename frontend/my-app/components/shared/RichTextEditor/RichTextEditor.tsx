'use client';

// components/shared/RichTextEditor/RichTextEditor.tsx
import React, { useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { RichTextEditorProps, ContentVersion } from './types';
import { useEditorInstance } from './hooks/useEditor';
import { useAutoSave } from './hooks/useAutoSave';
import { useDraft } from './hooks/useDraft';
import { Toolbar } from './Toolbar/Toolbar';
import { SimpleToolbar } from './Toolbar/SimpleToolbar';
import { SaveVersionButton } from './Toolbar/SaveVersionButton';
import { DraftRecoveryBanner } from './components/DraftRecoveryBanner';
import { LinkDialog } from './Dialogs/LinkDialog';
import { ImageUploadDialog } from './Dialogs/ImageUploadDialog';
import { VideoUploadDialog } from './Dialogs/VideoUploadDialog';
import { TableDialog } from './Dialogs/TableDialog';
import { VersionPreviewDialog } from './Dialogs/VersionPreviewDialog';
import { VersionHistoryPopover } from './Panels/VersionHistoryPopover';
import { Button } from '@/components/ui/button';
import { Code2 } from 'lucide-react';
import { AIAssistant } from './AIAssistant/AIAssistant';
import './editor.css';

export function RichTextEditor({
    contentKey,
    initialContent,
    mode = 'full',
    enableAutoSave = false,
    enableDraft = true,
    enableVersions = true,
    autoSaveInterval,
    onSave,
    onChange,
    placeholder,
    className = '',
    uploadScope = 'editor',
}: RichTextEditorProps) {
    // HTML 视图切换（仅完整版）
    const [viewMode, setViewMode] = useState<
        'visual' | 'html'
    >('visual');
    const [htmlSource, setHtmlSource] = useState('');

    // 对话框状态
    const [linkDialogOpen, setLinkDialogOpen] =
        useState(false);
    const [imageDialogOpen, setImageDialogOpen] =
        useState(false);
    const [videoDialogOpen, setVideoDialogOpen] =
        useState(false);
    const [tableDialogOpen, setTableDialogOpen] =
        useState(false);
    const [previewVersion, setPreviewVersion] =
        useState<ContentVersion | null>(null);

    // 创建编辑器实例
    const editor = useEditorInstance({
        mode,
        initialContent,
        onChange,
        placeholder,
    });

    // 草稿管理
    const {
        showDraftDialog,
        savedDraft,
        recoverDraft,
        dismissDraft,
    } = useDraft({
        editor,
        contentKey,
        enabled: enableDraft,
    });

    // 自动保存
    useAutoSave({
        editor,
        contentKey,
        enabled: enableAutoSave && !!contentKey,
        interval: autoSaveInterval,
        onSave,
        createVersionSnapshot:
            enableVersions && !!contentKey,
    });

    // HTML 视图切换
    const toggleHtmlView = () => {
        if (!editor) return;
        if (viewMode === 'visual') {
            setHtmlSource(editor.getHTML());
            setViewMode('html');
        } else {
            editor.commands.setContent(htmlSource);
            setViewMode('visual');
        }
    };

    // 版本恢复
    const handleVersionRestore = (
        version: ContentVersion
    ) => {
        if (!editor) return;
        editor.commands.setContent(version.content);
        setPreviewVersion(null);
    };

    if (!editor) {
        return (
            <div className={
                'p-4 text-center'
                + ' text-muted-foreground'
            }>
                编辑器加载中...
            </div>
        );
    }

    return (
        <div className={
            'rich-text-editor border'
            + ' rounded-lg overflow-hidden'
            + ` ${className}`
        }>
            {/* 工具栏 */}
            {mode === 'full' && (
                <Toolbar
                    editor={editor}
                    onLinkClick={() =>
                        setLinkDialogOpen(true)
                    }
                    onImageClick={() =>
                        setImageDialogOpen(true)
                    }
                    onVideoClick={() =>
                        setVideoDialogOpen(true)
                    }
                    onTableClick={() =>
                        setTableDialogOpen(true)
                    }
                />
            )}
            {mode === 'simple' && (
                <SimpleToolbar
                    editor={editor}
                    onLinkClick={() =>
                        setLinkDialogOpen(true)
                    }
                    onImageClick={() =>
                        setImageDialogOpen(true)
                    }
                    onVideoClick={() =>
                        setVideoDialogOpen(true)
                    }
                />
            )}

            {/* 草稿恢复提示条 */}
            {savedDraft && showDraftDialog && (
                <DraftRecoveryBanner
                    savedAt={
                        new Date(savedDraft.savedAt)
                    }
                    onRecover={recoverDraft}
                    onDismiss={dismissDraft}
                />
            )}

            {/* 编辑区域 */}
            {viewMode === 'visual' ? (
                <EditorContent editor={editor} />
            ) : (
                <textarea
                    value={htmlSource}
                    onChange={(e) =>
                        setHtmlSource(e.target.value)
                    }
                    className={
                        'w-full min-h-[400px] p-4'
                        + ' font-mono text-sm border-0'
                        + ' focus:outline-none'
                        + ' resize-none bg-background'
                    }
                    spellCheck={false}
                />
            )}

            {/* 底部栏 */}
            <div className={
                'border-t px-4 py-2 flex'
                + ' items-center justify-between'
                + ' text-sm text-muted-foreground'
            }>
                <span>
                    {editor.storage.characterCount
                        .characters()} 字符
                </span>
                <div className="flex items-center gap-2">
                    {/* 完整版功能按钮 */}
                    {mode === 'full' && (
                        <>
                            {/* AI 助手 */}
                            <AIAssistant
                                editor={editor}
                            />
                            {/* HTML 视图切换 */}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={
                                    'h-8 px-2 gap-1'
                                    + (viewMode === 'html'
                                        ? ' bg-accent'
                                        : '')
                                }
                                onClick={toggleHtmlView}
                            >
                                <Code2
                                    className="h-4 w-4"
                                />
                                <span className="text-xs">
                                    {viewMode === 'html'
                                        ? '返回编辑'
                                        : 'HTML'}
                                </span>
                            </Button>

                            {/* 版本历史 */}
                            {enableVersions
                                && contentKey && (
                                <VersionHistoryPopover
                                    contentKey={
                                        contentKey
                                    }
                                    onPreview={(v) =>
                                        setPreviewVersion(v)
                                    }
                                    onRestore={
                                        handleVersionRestore
                                    }
                                />
                            )}
                        </>
                    )}

                    {/* 保存按钮 */}
                    {onSave && mode !== 'readonly' && (
                        <SaveVersionButton
                            editor={editor}
                            contentKey={contentKey}
                            onSave={onSave}
                        />
                    )}
                </div>
            </div>

            {/* 对话框 */}
            <LinkDialog
                editor={editor}
                open={linkDialogOpen}
                onClose={() =>
                    setLinkDialogOpen(false)
                }
            />
            <ImageUploadDialog
                editor={editor}
                open={imageDialogOpen}
                onClose={() =>
                    setImageDialogOpen(false)
                }
                uploadScope={uploadScope}
            />
            <VideoUploadDialog
                editor={editor}
                open={videoDialogOpen}
                onClose={() =>
                    setVideoDialogOpen(false)
                }
                uploadScope={uploadScope}
            />
            {mode === 'full' && (
                <>
                    <TableDialog
                        editor={editor}
                        open={tableDialogOpen}
                        onClose={() =>
                            setTableDialogOpen(false)
                        }
                    />
                    <VersionPreviewDialog
                        version={previewVersion}
                        open={!!previewVersion}
                        onClose={() =>
                            setPreviewVersion(null)
                        }
                        onRestore={
                            handleVersionRestore
                        }
                    />
                </>
            )}
        </div>
    );
}

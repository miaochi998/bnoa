'use client';

// Toolbar/Toolbar.tsx
import { Editor } from '@tiptap/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarDivider } from './ToolbarDivider';
import { ColorPicker } from './ColorPicker';
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Code,
    Highlighter,
    Subscript,
    Superscript,
    Heading1,
    Heading2,
    Heading3,
    Pilcrow,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    List,
    ListOrdered,
    Quote,
    ListChecks,
    Link,
    Image,
    Video,
    Table,
    Minus,
    Undo2,
    Redo2,
} from 'lucide-react';

interface ToolbarProps {
    editor: Editor;
    onLinkClick?: () => void;
    onImageClick?: () => void;
    onVideoClick?: () => void;
    onTableClick?: () => void;
}

export function Toolbar({
    editor,
    onLinkClick,
    onImageClick,
    onVideoClick,
    onTableClick,
}: ToolbarProps) {
    return (
        <TooltipProvider delayDuration={300}>
            <div className="editor-toolbar">
                {/* 文本格式 */}
                <ToolbarButton
                    icon={<Bold className="h-4 w-4" />}
                    title="粗体"
                    isActive={editor.isActive('bold')}
                    onClick={() =>
                        editor.chain().focus()
                            .toggleBold().run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Italic className="h-4 w-4" />
                    }
                    title="斜体"
                    isActive={editor.isActive('italic')}
                    onClick={() =>
                        editor.chain().focus()
                            .toggleItalic().run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Underline
                            className="h-4 w-4"
                        />
                    }
                    title="下划线"
                    isActive={
                        editor.isActive('underline')
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .toggleUnderline().run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Strikethrough
                            className="h-4 w-4"
                        />
                    }
                    title="删除线"
                    isActive={editor.isActive('strike')}
                    onClick={() =>
                        editor.chain().focus()
                            .toggleStrike().run()
                    }
                />
                <ToolbarButton
                    icon={<Code className="h-4 w-4" />}
                    title="行内代码"
                    isActive={editor.isActive('code')}
                    onClick={() =>
                        editor.chain().focus()
                            .toggleCode().run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Highlighter
                            className="h-4 w-4"
                        />
                    }
                    title="高亮"
                    isActive={
                        editor.isActive('highlight')
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .toggleHighlight().run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Subscript
                            className="h-4 w-4"
                        />
                    }
                    title="下标"
                    isActive={
                        editor.isActive('subscript')
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .toggleSubscript().run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Superscript
                            className="h-4 w-4"
                        />
                    }
                    title="上标"
                    isActive={
                        editor.isActive('superscript')
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .toggleSuperscript().run()
                    }
                />
                <ColorPicker
                    editor={editor}
                    type="color"
                />

                <ToolbarDivider />

                {/* 标题 */}
                <ToolbarButton
                    icon={
                        <Heading1
                            className="h-4 w-4"
                        />
                    }
                    title="标题 1"
                    isActive={editor.isActive(
                        'heading', { level: 1 }
                    )}
                    onClick={() =>
                        editor.chain().focus()
                            .toggleHeading({ level: 1 })
                            .run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Heading2
                            className="h-4 w-4"
                        />
                    }
                    title="标题 2"
                    isActive={editor.isActive(
                        'heading', { level: 2 }
                    )}
                    onClick={() =>
                        editor.chain().focus()
                            .toggleHeading({ level: 2 })
                            .run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Heading3
                            className="h-4 w-4"
                        />
                    }
                    title="标题 3"
                    isActive={editor.isActive(
                        'heading', { level: 3 }
                    )}
                    onClick={() =>
                        editor.chain().focus()
                            .toggleHeading({ level: 3 })
                            .run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Pilcrow
                            className="h-4 w-4"
                        />
                    }
                    title="段落"
                    isActive={
                        editor.isActive('paragraph')
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .setParagraph().run()
                    }
                />

                <ToolbarDivider />

                {/* 对齐 */}
                <ToolbarButton
                    icon={
                        <AlignLeft
                            className="h-4 w-4"
                        />
                    }
                    title="左对齐"
                    isActive={editor.isActive(
                        { textAlign: 'left' }
                    )}
                    onClick={() =>
                        editor.chain().focus()
                            .setTextAlign('left').run()
                    }
                />
                <ToolbarButton
                    icon={
                        <AlignCenter
                            className="h-4 w-4"
                        />
                    }
                    title="居中"
                    isActive={editor.isActive(
                        { textAlign: 'center' }
                    )}
                    onClick={() =>
                        editor.chain().focus()
                            .setTextAlign('center').run()
                    }
                />
                <ToolbarButton
                    icon={
                        <AlignRight
                            className="h-4 w-4"
                        />
                    }
                    title="右对齐"
                    isActive={editor.isActive(
                        { textAlign: 'right' }
                    )}
                    onClick={() =>
                        editor.chain().focus()
                            .setTextAlign('right').run()
                    }
                />
                <ToolbarButton
                    icon={
                        <AlignJustify
                            className="h-4 w-4"
                        />
                    }
                    title="两端对齐"
                    isActive={editor.isActive(
                        { textAlign: 'justify' }
                    )}
                    onClick={() =>
                        editor.chain().focus()
                            .setTextAlign('justify')
                            .run()
                    }
                />

                <ToolbarDivider />

                {/* 列表 */}
                <ToolbarButton
                    icon={<List className="h-4 w-4" />}
                    title="无序列表"
                    isActive={
                        editor.isActive('bulletList')
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .toggleBulletList().run()
                    }
                />
                <ToolbarButton
                    icon={
                        <ListOrdered
                            className="h-4 w-4"
                        />
                    }
                    title="有序列表"
                    isActive={
                        editor.isActive('orderedList')
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .toggleOrderedList().run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Quote className="h-4 w-4" />
                    }
                    title="引用"
                    isActive={
                        editor.isActive('blockquote')
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .toggleBlockquote().run()
                    }
                />
                <ToolbarButton
                    icon={
                        <ListChecks
                            className="h-4 w-4"
                        />
                    }
                    title="任务列表"
                    isActive={
                        editor.isActive('taskList')
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .toggleTaskList().run()
                    }
                />

                <ToolbarDivider />

                {/* 插入 */}
                <ToolbarButton
                    icon={<Link className="h-4 w-4" />}
                    title="链接"
                    isActive={editor.isActive('link')}
                    onClick={() => onLinkClick?.()}
                />
                <ToolbarButton
                    icon={
                        <Image className="h-4 w-4" />
                    }
                    title="图片"
                    onClick={() => onImageClick?.()}
                />
                <ToolbarButton
                    icon={
                        <Video className="h-4 w-4" />
                    }
                    title="视频"
                    onClick={() => onVideoClick?.()}
                />
                <ToolbarButton
                    icon={
                        <Table className="h-4 w-4" />
                    }
                    title="表格"
                    onClick={() => onTableClick?.()}
                />
                <ToolbarButton
                    icon={
                        <Minus className="h-4 w-4" />
                    }
                    title="分隔线"
                    onClick={() =>
                        editor.chain().focus()
                            .setHorizontalRule().run()
                    }
                />

                <ToolbarDivider />

                {/* 撤销/重做 */}
                <ToolbarButton
                    icon={
                        <Undo2 className="h-4 w-4" />
                    }
                    title="撤销"
                    disabled={
                        !editor.can().undo()
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .undo().run()
                    }
                />
                <ToolbarButton
                    icon={
                        <Redo2 className="h-4 w-4" />
                    }
                    title="重做"
                    disabled={
                        !editor.can().redo()
                    }
                    onClick={() =>
                        editor.chain().focus()
                            .redo().run()
                    }
                />
            </div>
        </TooltipProvider>
    );
}

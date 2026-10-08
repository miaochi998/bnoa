'use client';

// Toolbar/SimpleToolbar.tsx
import { Editor } from '@tiptap/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarDivider } from './ToolbarDivider';
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Code,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Link,
    Image,
    Video,
    Undo2,
    Redo2,
} from 'lucide-react';

interface SimpleToolbarProps {
    editor: Editor;
    onLinkClick?: () => void;
    onImageClick?: () => void;
    onVideoClick?: () => void;
}

export function SimpleToolbar({
    editor,
    onLinkClick,
    onImageClick,
    onVideoClick,
}: SimpleToolbarProps) {
    return (
        <TooltipProvider delayDuration={300}>
            <div className="editor-toolbar">
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

                <ToolbarDivider />

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

                <ToolbarDivider />

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

                <ToolbarDivider />

                <ToolbarButton
                    icon={<Link className="h-4 w-4" />}
                    title="链接"
                    isActive={editor.isActive('link')}
                    onClick={() => onLinkClick?.()}
                />
                {onImageClick && (
                    <ToolbarButton
                        icon={
                            <Image className="h-4 w-4" />
                        }
                        title="插入图片"
                        onClick={() => onImageClick()}
                    />
                )}
                {onVideoClick && (
                    <ToolbarButton
                        icon={
                            <Video className="h-4 w-4" />
                        }
                        title="插入视频"
                        onClick={() => onVideoClick()}
                    />
                )}

                <ToolbarDivider />

                <ToolbarButton
                    icon={
                        <Undo2 className="h-4 w-4" />
                    }
                    title="撤销"
                    disabled={!editor.can().undo()}
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
                    disabled={!editor.can().redo()}
                    onClick={() =>
                        editor.chain().focus()
                            .redo().run()
                    }
                />
            </div>
        </TooltipProvider>
    );
}

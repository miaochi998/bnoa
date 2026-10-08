'use client';

// Dialogs/LinkDialog.tsx
import { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface LinkDialogProps {
    editor: Editor;
    open: boolean;
    onClose: () => void;
}

export function LinkDialog({
    editor,
    open,
    onClose,
}: LinkDialogProps) {
    const [url, setUrl] = useState('');
    const [text, setText] = useState('');

    useEffect(() => {
        if (open) {
            const attrs =
                editor.getAttributes('link');
            setUrl(attrs.href || '');
            const { from, to } =
                editor.state.selection;
            const selectedText =
                editor.state.doc.textBetween(
                    from, to, ''
                );
            setText(selectedText || '');
        }
    }, [open, editor]);

    const handleSubmit = () => {
        if (!url) return;
        if (text) {
            editor.chain().focus()
                .insertContent({
                    type: 'text',
                    text,
                    marks: [{
                        type: 'link',
                        attrs: { href: url },
                    }],
                })
                .run();
        } else {
            editor.chain().focus()
                .setLink({ href: url })
                .run();
        }
        onClose();
    };

    const handleRemove = () => {
        editor.chain().focus()
            .unsetLink().run();
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        插入链接
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="link-url">
                            链接地址
                        </Label>
                        <Input
                            id="link-url"
                            placeholder="https://"
                            value={url}
                            onChange={(e) =>
                                setUrl(e.target.value)
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="link-text">
                            显示文本（可选）
                        </Label>
                        <Input
                            id="link-text"
                            placeholder="链接文本"
                            value={text}
                            onChange={(e) =>
                                setText(e.target.value)
                            }
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2">
                    {editor.isActive('link') && (
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleRemove}
                        >
                            移除链接
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                    >
                        取消
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!url}
                    >
                        确定
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

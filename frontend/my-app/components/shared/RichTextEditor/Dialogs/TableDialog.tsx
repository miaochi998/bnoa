'use client';

// Dialogs/TableDialog.tsx
import { useState } from 'react';
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

interface TableDialogProps {
    editor: Editor;
    open: boolean;
    onClose: () => void;
}

export function TableDialog({
    editor,
    open,
    onClose,
}: TableDialogProps) {
    const [rows, setRows] = useState('3');
    const [cols, setCols] = useState('3');

    const handleSubmit = () => {
        const r = parseInt(rows) || 3;
        const c = parseInt(cols) || 3;
        editor.chain().focus()
            .insertTable({
                rows: r,
                cols: c,
                withHeaderRow: true,
            })
            .run();
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>
                        插入表格
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="table-rows">
                            行数
                        </Label>
                        <Input
                            id="table-rows"
                            type="number"
                            min="1"
                            max="20"
                            value={rows}
                            onChange={(e) =>
                                setRows(e.target.value)
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="table-cols">
                            列数
                        </Label>
                        <Input
                            id="table-cols"
                            type="number"
                            min="1"
                            max="10"
                            value={cols}
                            onChange={(e) =>
                                setCols(e.target.value)
                            }
                        />
                    </div>
                </div>
                <DialogFooter>
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
                    >
                        插入
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

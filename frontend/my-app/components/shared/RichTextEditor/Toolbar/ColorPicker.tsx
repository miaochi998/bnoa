'use client';

// Toolbar/ColorPicker.tsx
import { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Palette } from 'lucide-react';

const COLORS = [
    '#000000', '#434343', '#666666', '#999999',
    '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
    '#f3f3f3', '#ffffff', '#980000', '#ff0000',
    '#ff9900', '#ffff00', '#00ff00', '#00ffff',
    '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
    '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc',
    '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3',
    '#d9d2e9', '#ead1dc',
];

interface ColorPickerProps {
    editor: Editor;
    type: 'color' | 'highlight';
}

export function ColorPicker({
    editor,
    type,
}: ColorPickerProps) {
    const [open, setOpen] = useState(false);

    const handleColor = (color: string) => {
        if (type === 'color') {
            editor.chain().focus()
                .setColor(color).run();
        } else {
            editor.chain().focus()
                .toggleHighlight({ color }).run();
        }
        setOpen(false);
    };

    const handleClear = () => {
        if (type === 'color') {
            editor.chain().focus()
                .unsetColor().run();
        } else {
            editor.chain().focus()
                .unsetHighlight().run();
        }
        setOpen(false);
    };

    const title = type === 'color'
        ? '字体颜色' : '文本高亮';

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                        >
                            <Palette
                                className="h-4 w-4"
                            />
                        </Button>
                    </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                    {title}
                </TooltipContent>
            </Tooltip>
            <PopoverContent
                className="w-auto p-3"
                align="start"
            >
                <div className="space-y-2">
                    <p className="text-sm font-medium">
                        {title}
                    </p>
                    <div
                        className="grid gap-1"
                        style={{
                            gridTemplateColumns:
                                'repeat(10, 1fr)',
                        }}
                    >
                        {COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className={
                                    'h-6 w-6 rounded'
                                    + ' border'
                                    + ' border-border'
                                    + ' cursor-pointer'
                                    + ' hover:scale-110'
                                    + ' transition-transform'
                                }
                                style={{
                                    backgroundColor: color,
                                }}
                                onClick={() =>
                                    handleColor(color)
                                }
                            />
                        ))}
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={handleClear}
                    >
                        清除{title}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

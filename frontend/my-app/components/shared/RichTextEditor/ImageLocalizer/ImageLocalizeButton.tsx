'use client';

// ImageLocalizer/ImageLocalizeButton.tsx
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Download } from 'lucide-react';

interface ImageLocalizeButtonProps {
    remoteImageCount: number;
    onClick: () => void;
}

export function ImageLocalizeButton({
    remoteImageCount,
    onClick,
}: ImageLocalizeButtonProps) {
    if (remoteImageCount === 0) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1"
                    onClick={onClick}
                >
                    <Download
                        className="h-4 w-4"
                    />
                    <span className={
                        'text-xs px-1 rounded-full'
                        + ' bg-primary/20'
                        + ' text-primary'
                    }>
                        {remoteImageCount}
                    </span>
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                {remoteImageCount} 张远程图片待本地化
            </TooltipContent>
        </Tooltip>
    );
}

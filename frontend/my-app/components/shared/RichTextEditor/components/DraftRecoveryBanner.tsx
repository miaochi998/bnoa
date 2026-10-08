// components/DraftRecoveryBanner.tsx
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface DraftRecoveryBannerProps {
    savedAt: Date;
    onRecover: () => void;
    onDismiss: () => void;
}

export function DraftRecoveryBanner({
    savedAt,
    onRecover,
    onDismiss,
}: DraftRecoveryBannerProps) {
    const timeStr = savedAt.toLocaleString(
        'zh-CN',
        {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }
    );

    return (
        <div className={
            'flex items-center gap-2 px-4 py-2'
            + ' bg-yellow-500/10 border-b'
            + ' border-yellow-500/20 text-sm'
        }>
            <AlertCircle className={
                'h-4 w-4 text-yellow-500'
                + ' flex-shrink-0'
            } />
            <span className="text-yellow-500">
                发现未保存的草稿 ({timeStr})
            </span>
            <div className="ml-auto flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={onRecover}
                >
                    恢复
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={onDismiss}
                >
                    放弃
                </Button>
            </div>
        </div>
    );
}

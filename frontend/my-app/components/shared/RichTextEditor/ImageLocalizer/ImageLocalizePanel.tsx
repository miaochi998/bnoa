'use client';

// ImageLocalizer/ImageLocalizePanel.tsx
import { LocalizeTask } from './types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    CheckCircle,
    XCircle,
    Loader2,
    X,
} from 'lucide-react';

interface ImageLocalizePanelProps {
    tasks: LocalizeTask[];
    onClearCompleted: () => void;
    onRemoveTask: (taskId: string) => void;
}

export function ImageLocalizePanel({
    tasks,
    onClearCompleted,
    onRemoveTask,
}: ImageLocalizePanelProps) {
    if (tasks.length === 0) return null;

    return (
        <div className={
            'border-t p-3 space-y-2'
            + ' max-h-[200px] overflow-y-auto'
        }>
            <div className={
                'flex items-center'
                + ' justify-between'
            }>
                <span className={
                    'text-xs font-medium'
                }>
                    图片本地化 ({tasks.length})
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={onClearCompleted}
                >
                    清除已完成
                </Button>
            </div>
            {tasks.map((task) => (
                <div
                    key={task.id}
                    className={
                        'flex items-center gap-2'
                        + ' text-xs'
                    }
                >
                    {task.status === 'success' && (
                        <CheckCircle
                            className={
                                'h-3 w-3'
                                + ' text-green-500'
                                + ' flex-shrink-0'
                            }
                        />
                    )}
                    {task.status === 'error' && (
                        <XCircle
                            className={
                                'h-3 w-3'
                                + ' text-red-500'
                                + ' flex-shrink-0'
                            }
                        />
                    )}
                    {(task.status === 'downloading'
                        || task.status === 'uploading'
                        || task.status === 'pending'
                    ) && (
                        <Loader2
                            className={
                                'h-3 w-3'
                                + ' animate-spin'
                                + ' flex-shrink-0'
                            }
                        />
                    )}
                    <span className={
                        'truncate flex-1'
                        + ' text-muted-foreground'
                    }>
                        {task.originalUrl
                            .substring(0, 50)}...
                    </span>
                    {(task.status === 'downloading'
                        || task.status === 'uploading'
                    ) && (
                        <Progress
                            value={task.progress}
                            className="w-16 h-1"
                        />
                    )}
                    <button
                        type="button"
                        onClick={() =>
                            onRemoveTask(task.id)
                        }
                        className={
                            'hover:text-foreground'
                            + ' text-muted-foreground'
                        }
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            ))}
        </div>
    );
}

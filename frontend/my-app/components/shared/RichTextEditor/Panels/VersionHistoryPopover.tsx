'use client'

import { getApiBaseUrl } from '@/lib/config';

// Panels/VersionHistoryPopover.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Eye } from 'lucide-react';
import { ContentVersion, parseContentKey } from '../types';

const API_BASE_URL =
    getApiBaseUrl();

interface VersionHistoryPopoverProps {
    contentKey: string;
    onPreview: (version: ContentVersion) => void;
    onRestore: (version: ContentVersion) => void;
}

export function VersionHistoryPopover({
    contentKey,
    onPreview,
    onRestore,
}: VersionHistoryPopoverProps) {
    const [versions, setVersions] =
        useState<ContentVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const loadVersions = async () => {
        setLoading(true);
        try {
            const { contentType, contentId } =
                parseContentKey(contentKey);
            const token =
                localStorage.getItem('accessToken');
            const res = await fetch(
                `${API_BASE_URL}/content-versions`
                + `/${contentType}/${contentId}`
                + `?pageSize=20`,
                {
                    headers: {
                        ...(token
                            ? {
                                Authorization:
                                    `Bearer ${token}`,
                            }
                            : {}),
                    },
                }
            );
            const data = await res.json();
            if (data.data?.list) {
                setVersions(data.data.list);
            }
        } catch {
            // 静默处理
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            loadVersions();
        }
    }, [open]);

    const typeLabel: Record<string, string> = {
        manual: '手动',
        auto: '自动',
        restore: '恢复',
    };

    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
        >
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1"
                >
                    <History className="h-4 w-4" />
                    <span className="text-xs">
                        版本历史
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-80 p-0"
                align="end"
            >
                <div className={
                    'px-4 py-3 border-b font-medium'
                    + ' text-sm'
                }>
                    版本历史
                </div>
                <ScrollArea className="h-[300px]">
                    {loading ? (
                        <div className={
                            'p-4 text-center text-sm'
                            + ' text-muted-foreground'
                        }>
                            加载中...
                        </div>
                    ) : versions.length === 0 ? (
                        <div className={
                            'p-4 text-center text-sm'
                            + ' text-muted-foreground'
                        }>
                            暂无版本记录
                        </div>
                    ) : (
                        <div className="divide-y">
                            {versions.map((v) => (
                                <div
                                    key={v.id}
                                    className={
                                        'px-4 py-3'
                                        + ' hover:bg-accent'
                                        + ' transition-colors'
                                    }
                                >
                                    <div className={
                                        'flex items-center'
                                        + ' justify-between'
                                    }>
                                        <span className={
                                            'text-sm'
                                            + ' font-medium'
                                        }>
                                            v{v.versionNumber}
                                            {v.versionName
                                                && ` - ${v.versionName}`
                                            }
                                        </span>
                                        <span className={
                                            'text-xs'
                                            + ' px-1.5 py-0.5'
                                            + ' rounded'
                                            + ' bg-muted'
                                        }>
                                            {typeLabel[
                                                v.versionType
                                            ]}
                                        </span>
                                    </div>
                                    <div className={
                                        'text-xs'
                                        + ' text-muted'
                                        + '-foreground'
                                        + ' mt-1'
                                    }>
                                        {new Date(
                                            v.createdAt
                                        ).toLocaleString(
                                            'zh-CN'
                                        )}
                                        {v.characterCount
                                            != null
                                            && ` · ${v.characterCount} 字符`
                                        }
                                    </div>
                                    <div className={
                                        'flex gap-2 mt-2'
                                    }>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={
                                                'h-6 text-xs'
                                            }
                                            onClick={() =>
                                                onPreview(v)
                                            }
                                        >
                                            <Eye className={
                                                'h-3 w-3'
                                                + ' mr-1'
                                            } />
                                            预览
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={
                                                'h-6 text-xs'
                                            }
                                            onClick={() =>
                                                onRestore(v)
                                            }
                                        >
                                            恢复
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

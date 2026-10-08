'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
    getNotificationIcon,
    getNotificationTypeName,
    formatRelativeTime,
    PRIORITY_LABELS,
    PRIORITY_STYLES,
} from '../_components/notification-utils';

const API = getApiBaseUrl();

async function apiFetch(
    endpoint: string, opts?: RequestInit,
) {
    const token = typeof window !== 'undefined'
        ? localStorage.getItem('accessToken') : null;
    const res = await fetch(`${API}${endpoint}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(token
                ? { Authorization: `Bearer ${token}` }
                : {}),
            ...(opts?.headers || {}),
        },
    });
    return res.json();
}

export default function NotificationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [notification, setNotification] =
        useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchDetail = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch(
                `/notifications/${id}`,
            );
            if (data?.data) {
                setNotification(data.data);
                if (!data.data.isRead) {
                    apiFetch(
                        `/notifications/${id}/read`,
                        { method: 'PATCH' },
                    );
                }
            }
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    const handleDelete = async () => {
        if (!confirm('确定删除此通知？')) return;
        await apiFetch(
            `/notifications/${id}`,
            { method: 'DELETE' },
        );
        router.push('/notifications');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <p className="text-muted-foreground">
                    加载中...
                </p>
            </div>
        );
    }

    if (!notification) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Link href="/notifications">
                        <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-xl font-semibold text-foreground">
                        通知不存在
                    </h1>
                </div>
            </div>
        );
    }

    const Icon = getNotificationIcon(notification.type);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/notifications">
                        <Button
                            variant="ghost" size="icon"
                            className="h-8 w-8"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-xl font-semibold text-foreground">
                        通知详情
                    </h1>
                </div>
                <Button
                    variant="outline" size="sm"
                    className="text-destructive"
                    onClick={handleDelete}
                >
                    <Trash2 className="h-4 w-4 mr-1" />
                    删除
                </Button>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-5">
                <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-medium text-foreground">
                            {notification.title}
                        </h2>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                {getNotificationTypeName(
                                    notification.type,
                                )}
                            </span>
                            {notification.priority
                                && notification.priority !== 'NORMAL'
                                && (
                                <span className={
                                    'text-xs px-2 py-0.5 rounded '
                                    + (PRIORITY_STYLES[
                                        notification.priority
                                    ] || '')
                                }>
                                    {PRIORITY_LABELS[
                                        notification.priority
                                    ]}
                                </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatRelativeTime(
                                    notification.createdAt,
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="border-t border-border pt-5">
                    <div
                        className="prose prose-invert max-w-none text-sm text-foreground notification-content"
                        dangerouslySetInnerHTML={{
                            __html: notification.content
                                || '<p class="text-muted-foreground">无内容</p>',
                        }}
                    />
                </div>

                {notification.actionUrl && (
                    <div className="border-t border-border pt-4">
                        <a
                            href={notification.actionUrl}
                            className="text-sm text-primary hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            查看相关链接
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
}

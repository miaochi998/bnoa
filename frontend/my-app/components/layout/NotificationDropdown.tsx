'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    getNotificationIcon,
    getNotificationTypeName,
    formatRelativeTime,
} from '@/app/(dashboard)/notifications/_components/notification-utils';

const API_BASE =
    getApiBaseUrl();

interface NotificationItem {
    id: string;
    type: string;
    priority: string;
    title: string;
    content: string;
    actionUrl?: string;
    isRead: boolean;
    readAt?: string;
    createdAt: string;
    broadcastId?: string;
}

async function apiFetch(
    endpoint: string, options?: RequestInit,
) {
    const token =
        typeof window !== 'undefined'
            ? localStorage.getItem('accessToken')
            : null;
    const res = await fetch(
        `${API_BASE}${endpoint}`,
        {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {}),
                ...(options?.headers || {}),
            },
        },
    );
    return res.json();
}

export function NotificationDropdown() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] =
        useState<NotificationItem[]>([]);
    const [filter, setFilter] =
        useState<string>('all');
    const [loading, setLoading] = useState(false);

    const fetchUnreadCount = useCallback(async () => {
        try {
            const data = await apiFetch(
                '/notifications/unread-count',
            );
            if (data?.data?.count !== undefined) {
                setUnreadCount(data.data.count);
            }
        } catch {
            // silent
        }
    }, []);

    const fetchNotifications = useCallback(
        async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({
                    pageSize: '20',
                });
                if (filter === 'unread') {
                    params.set('isRead', 'false');
                } else if (filter === 'read') {
                    params.set('isRead', 'true');
                }
                const data = await apiFetch(
                    `/notifications?${params}`,
                );
                if (data?.data?.list) {
                    setNotifications(data.data.list);
                }
            } catch {
                // silent
            } finally {
                setLoading(false);
            }
        }, [filter],
    );

    useEffect(() => {
        fetchUnreadCount();
        const timer = setInterval(
            fetchUnreadCount, 30000,
        );
        return () => clearInterval(timer);
    }, [fetchUnreadCount]);

    useEffect(() => {
        if (open) fetchNotifications();
    }, [open, filter, fetchNotifications]);

    const handleMarkAsRead = async (
        id: string,
    ) => {
        await apiFetch(
            `/notifications/${id}/read`,
            { method: 'PATCH' },
        );
        setNotifications((prev) =>
            prev.map((n) =>
                n.id === id
                    ? { ...n, isRead: true }
                    : n,
            ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
    };

    const handleMarkAllRead = async () => {
        await apiFetch(
            '/notifications/read-all',
            {
                method: 'PATCH',
                body: JSON.stringify({}),
            },
        );
        setNotifications((prev) =>
            prev.map((n) => ({
                ...n, isRead: true,
            })),
        );
        setUnreadCount(0);
    };

    const handleClick = async (
        n: NotificationItem,
    ) => {
        if (!n.isRead) {
            await handleMarkAsRead(n.id);
        }
        setOpen(false);
        router.push(`/notifications/${n.id}`);
    };

    const filtered = notifications;

    return (
        <>
            <Popover
                open={open}
                onOpenChange={setOpen}
            >
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="relative text-muted-foreground hover:text-foreground hover:bg-card-hover"
                    >
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-medium rounded-full flex items-center justify-center px-1">
                                {unreadCount > 99
                                    ? '99+'
                                    : unreadCount}
                            </span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    align="end"
                    className="w-[380px] p-0 bg-card border-border"
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <h3 className="text-sm font-medium text-foreground">
                            通知
                        </h3>
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-primary hover:text-primary"
                                onClick={handleMarkAllRead}
                            >
                                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                                全部已读
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-1 px-4 py-2 border-b border-border">
                        {['all', 'unread', 'read'].map(
                            (f) => (
                                <Button
                                    key={f}
                                    variant={
                                        filter === f
                                            ? 'default'
                                            : 'ghost'
                                    }
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() =>
                                        setFilter(f)
                                    }
                                >
                                    {f === 'all'
                                        ? '全部'
                                        : f === 'unread'
                                            ? '未读'
                                            : '已读'}
                                </Button>
                            ),
                        )}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                        {loading ? (
                            <div className="py-8 text-center text-muted-foreground text-sm">
                                加载中...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="py-8 text-center text-muted-foreground text-sm">
                                暂无通知
                            </div>
                        ) : (
                            filtered.map((n) => {
                                const Icon =
                                    getNotificationIcon(
                                        n.type,
                                    );
                                return (
                                    <div
                                        key={n.id}
                                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-card-hover transition-colors ${
                                            !n.isRead
                                                ? 'bg-primary/5'
                                                : ''
                                        }`}
                                        onClick={() =>
                                            handleClick(n)
                                        }
                                    >
                                        {!n.isRead && (
                                            <span className="mt-2 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                        )}
                                        {n.isRead && (
                                            <span className="mt-2 w-2 h-2 flex-shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                    {getNotificationTypeName(
                                                        n.type,
                                                    )}
                                                </span>
                                            </div>
                                            <p className="text-sm text-foreground truncate">
                                                {n.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {formatRelativeTime(
                                                    n.createdAt,
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    <div className="border-t border-border p-2">
                        <Link
                            href="/notifications"
                            onClick={() =>
                                setOpen(false)
                            }
                        >
                            <Button
                                variant="ghost"
                                className="w-full h-8 text-xs text-primary hover:text-primary"
                            >
                                查看全部通知
                            </Button>
                        </Link>
                    </div>
                </PopoverContent>
            </Popover>
        </>
    );
}

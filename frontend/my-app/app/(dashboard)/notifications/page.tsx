'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    getNotificationIcon,
    getNotificationTypeName,
    formatRelativeTime,
    PRIORITY_LABELS,
    PRIORITY_STYLES,
    NOTIFICATION_TABS,
} from './_components/notification-utils';

const API = getApiBaseUrl();

async function apiFetch(endpoint: string, opts?: RequestInit) {
    const token = typeof window !== 'undefined'
        ? localStorage.getItem('accessToken') : null;
    const res = await fetch(`${API}${endpoint}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(opts?.headers || {}),
        },
    });
    return res.json();
}

export default function NotificationsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('all');
    const [notifications, setNotifications] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const tab = NOTIFICATION_TABS.find((t) => t.key === activeTab);
            const params = new URLSearchParams({
                page: String(page),
                pageSize: String(pageSize),
            });

            if (activeTab === 'unread') {
                params.set('isRead', 'false');
            } else if (tab?.types) {
                params.set('type', tab.types[0]);
            }

            const data = await apiFetch(`/notifications?${params}`);
            if (data?.data) {
                let list = data.data.list || [];
                if (tab?.types && tab.types.length > 1) {
                    list = list.filter((n: any) =>
                        tab.types!.includes(n.type),
                    );
                }
                setNotifications(list);
                setTotal(data.data.pagination?.total || 0);
                setPageSize(data.data.pagination?.pageSize || 20);
                setUnreadCount(data.data.unreadCount ?? 0);
            }
        } finally {
            setLoading(false);
        }
    }, [activeTab, page, pageSize]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
    useEffect(() => { setPage(1); }, [activeTab]);

    const handleMarkRead = async (id: string) => {
        await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
        setNotifications((prev) =>
            prev.map((n) => n.id === id ? { ...n, isRead: true } : n),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
    };

    const handleMarkAllRead = async () => {
        const tab = NOTIFICATION_TABS.find((t) => t.key === activeTab);
        const body: any = {};
        if (tab?.types) body.type = tab.types[0];
        await apiFetch('/notifications/read-all', {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
        fetchNotifications();
    };

    const handleDelete = async (id: string) => {
        await apiFetch(`/notifications/${id}`, { method: 'DELETE' });
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        setTotal((t) => t - 1);
    };

    const handleDetail = (n: any) => {
        if (!n.isRead) handleMarkRead(n.id);
        router.push(`/notifications/${n.id}`);
    };

    const totalPages = Math.ceil(total / pageSize);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-foreground">通知中心</h1>
                {unreadCount > 0 && (
                    <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                        <CheckCheck className="h-4 w-4 mr-1" />
                        全部标记已读
                    </Button>
                )}
            </div>

            <div className="flex gap-2 border-b border-border pb-2">
                {NOTIFICATION_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                                activeTab === tab.key
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-card-hover'
                            }`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">加载中...</div>
            ) : notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">暂无通知</div>
            ) : (
                <div className="space-y-2">
                    {notifications.map((n) => {
                        const Icon = getNotificationIcon(n.type);
                        return (
                            <div
                                key={n.id}
                                className={`bg-card border border-border rounded-lg p-4 flex items-start gap-3 cursor-pointer hover:bg-card-hover transition-colors ${
                                    !n.isRead ? 'border-l-2 border-l-primary' : ''
                                }`}
                                onClick={() => handleDetail(n)}
                            >
                                <div className={`p-2 rounded-lg ${
                                    !n.isRead ? 'bg-primary/10' : 'bg-muted'
                                }`}>
                                    <Icon className={`h-4 w-4 ${
                                        !n.isRead ? 'text-primary' : 'text-muted-foreground'
                                    }`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                            {getNotificationTypeName(n.type)}
                                        </span>
                                        {n.priority && n.priority !== 'NORMAL' && (
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                PRIORITY_STYLES[n.priority] || ''
                                            }`}>
                                                {PRIORITY_LABELS[n.priority]}
                                            </span>
                                        )}
                                        {!n.isRead && (
                                            <span className="w-2 h-2 rounded-full bg-primary" />
                                        )}
                                    </div>
                                    <p className={`text-sm truncate ${
                                        !n.isRead ? 'text-foreground font-medium' : 'text-muted-foreground'
                                    }`}>
                                        {n.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {formatRelativeTime(n.createdAt)}
                                    </p>
                                </div>
                                <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {!n.isRead && (
                                        <Button
                                            variant="ghost" size="icon" className="h-7 w-7"
                                            title="标记已读"
                                            onClick={() => handleMarkRead(n.id)}
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost" size="icon"
                                        className="h-7 w-7 text-destructive"
                                        title="删除"
                                        onClick={() => handleDelete(n.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        上一页
                    </Button>
                    <span className="text-sm text-muted-foreground py-1">
                        {page} / {totalPages}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                        下一页
                    </Button>
                </div>
            )}

        </div>
    );
}

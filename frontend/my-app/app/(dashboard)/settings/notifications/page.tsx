'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Plus, Eye, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    getNotificationTypeName,
    formatRelativeTime,
    PRIORITY_LABELS,
    PRIORITY_STYLES,
} from '../../notifications/_components/notification-utils';

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

export default function NotificationsSettingsPage() {
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [records, setRecords] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [bPage, setBPage] = useState(1);
    const [bTotal, setBTotal] = useState(0);
    const [rPage, setRPage] = useState(1);
    const [rTotal, setRTotal] = useState(0);

    const fetchBroadcasts = useCallback(async () => {
        const data = await apiFetch(
            `/admin/notifications/broadcasts?page=${bPage}&pageSize=10`,
        );
        if (data?.data) {
            setBroadcasts(data.data.list || []);
            setBTotal(data.data.pagination?.total || 0);
        }
    }, [bPage]);

    const fetchRecords = useCallback(async () => {
        const data = await apiFetch(
            `/admin/notifications/records?page=${rPage}&pageSize=10`,
        );
        if (data?.data) {
            setRecords(data.data.list || []);
            setRTotal(data.data.pagination?.total || 0);
            setStats(data.data.statistics);
        }
    }, [rPage]);

    useEffect(() => { fetchBroadcasts(); }, [fetchBroadcasts]);
    useEffect(() => { fetchRecords(); }, [fetchRecords]);

    const handleDeleteBroadcast = async (id: string) => {
        if (!confirm('确定删除此广播？')) return;
        await apiFetch(`/admin/notifications/broadcasts/${id}`, { method: 'DELETE' });
        fetchBroadcasts();
    };

    const handleCancelBroadcast = async (id: string) => {
        if (!confirm('确定取消此广播？')) return;
        await apiFetch(`/admin/notifications/broadcasts/${id}/cancel`, { method: 'PATCH' });
        fetchBroadcasts();
    };

    const statusColors: Record<string, string> = {
        PENDING: 'bg-muted text-muted-foreground',
        SENDING: 'bg-primary/10 text-primary',
        SENT: 'bg-green-500/10 text-green-600',
        CANCELLED: 'bg-destructive/10 text-destructive',
    };
    const statusLabels: Record<string, string> = {
        PENDING: '待发送', SENDING: '发送中',
        SENT: '已发送', CANCELLED: '已取消',
    };
    const targetLabels: Record<string, string> = {
        all: '全部用户', role: '指定角色', users: '指定用户',
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bell className="h-6 w-6 text-primary" />
                    <h1 className="text-xl font-semibold text-foreground">通知管理</h1>
                </div>
                <div className="flex gap-2">
                    <Link href="/settings/notifications/config">
                        <Button variant="outline" size="sm">通知配置</Button>
                    </Link>
                    <Link href="/settings/notifications/broadcast">
                        <Button size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            发送广播
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs defaultValue="broadcasts">
                <TabsList className="bg-card border border-border">
                    <TabsTrigger value="broadcasts">广播管理</TabsTrigger>
                    <TabsTrigger value="records">通知记录</TabsTrigger>
                </TabsList>

                <TabsContent value="broadcasts" className="space-y-4">
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">广播编号</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">类型</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">标题</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">目标</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">发送/已读</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">状态</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">时间</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {broadcasts.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-8 text-muted-foreground">暂无广播记录</td>
                                        </tr>
                                    ) : broadcasts.map((b) => (
                                        <tr key={b.id} className="border-b border-border hover:bg-card-hover">
                                            <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{b.broadcastNo}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                                    {getNotificationTypeName(b.type)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-foreground max-w-[200px] truncate">{b.title}</td>
                                            <td className="px-4 py-3 text-muted-foreground">{targetLabels[b.targetType] || b.targetType}</td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {b.sentCount}/{b.readCount}
                                                <span className="text-xs ml-1">({b.readRate}%)</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded ${statusColors[b.status] || ''}`}>
                                                    {statusLabels[b.status] || b.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {b.sentAt ? formatRelativeTime(b.sentAt) : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-1">
                                                    {b.status === 'PENDING' && (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCancelBroadcast(b.id)}>
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteBroadcast(b.id)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {bTotal > 10 && (
                            <div className="flex justify-center gap-2 py-3 border-t border-border">
                                <Button variant="outline" size="sm" disabled={bPage <= 1} onClick={() => setBPage(bPage - 1)}>上一页</Button>
                                <span className="text-sm text-muted-foreground py-1">第 {bPage} 页</span>
                                <Button variant="outline" size="sm" disabled={bPage * 10 >= bTotal} onClick={() => setBPage(bPage + 1)}>下一页</Button>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="records" className="space-y-4">
                    {stats && (
                        <div className="grid grid-cols-4 gap-4">
                            {[
                                { label: '总通知数', value: stats.total },
                                { label: '未读数', value: stats.unreadCount },
                                { label: '已读数', value: stats.readCount },
                                { label: '已读率', value: `${stats.readRate}%` },
                            ].map((s) => (
                                <div key={s.label} className="bg-card border border-border rounded-lg p-4">
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                    <p className="text-2xl font-semibold text-foreground mt-1">{s.value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">用户</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">类型</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">优先级</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">标题</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">状态</th>
                                        <th className="text-left px-4 py-3 text-muted-foreground font-medium">时间</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-muted-foreground">暂无通知记录</td>
                                        </tr>
                                    ) : records.map((r) => (
                                        <tr key={r.id} className="border-b border-border hover:bg-card-hover">
                                            <td className="px-4 py-3 text-foreground">{r.user?.name || r.user?.username || '-'}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                                    {getNotificationTypeName(r.type)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {r.priority && (
                                                    <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_STYLES[r.priority] || ''}`}>
                                                        {PRIORITY_LABELS[r.priority] || r.priority}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-foreground max-w-[250px] truncate">{r.title}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded ${r.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                                                    {r.isRead ? '已读' : '未读'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">{formatRelativeTime(r.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {rTotal > 10 && (
                            <div className="flex justify-center gap-2 py-3 border-t border-border">
                                <Button variant="outline" size="sm" disabled={rPage <= 1} onClick={() => setRPage(rPage - 1)}>上一页</Button>
                                <span className="text-sm text-muted-foreground py-1">第 {rPage} 页</span>
                                <Button variant="outline" size="sm" disabled={rPage * 10 >= rTotal} onClick={() => setRPage(rPage + 1)}>下一页</Button>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

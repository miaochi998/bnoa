'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Send, Search, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import Link from 'next/link';

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

/** 将 Tiptap JSON 节点内容转换为内联 HTML */
function inlineToHtml(content: any[]): string {
    if (!content) return '';
    return content.map((c: any) => {
        if (c.type === 'image') {
            const src = c.attrs?.src || '';
            return `<img src="${src}" style="max-width:100%;border-radius:8px;" />`;
        }
        let text = c.text || '';
        if (c.marks) {
            for (const m of c.marks) {
                if (m.type === 'bold') text = `<strong>${text}</strong>`;
                if (m.type === 'italic') text = `<em>${text}</em>`;
                if (m.type === 'underline') text = `<u>${text}</u>`;
                if (m.type === 'strike') text = `<s>${text}</s>`;
                if (m.type === 'code') text = `<code>${text}</code>`;
                if (m.type === 'link') {
                    text = `<a href="${m.attrs?.href}">${text}</a>`;
                }
            }
        }
        return text;
    }).join('');
}

/** 将 Tiptap JSON 转换为 HTML */
function tiptapJsonToHtml(json: any): string {
    if (!json?.content) return '';
    return json.content.map((node: any) => {
        if (node.type === 'paragraph') {
            return `<p>${inlineToHtml(node.content)}</p>`;
        }
        if (node.type === 'heading') {
            const lvl = node.attrs?.level || 2;
            return `<h${lvl}>${inlineToHtml(node.content)}</h${lvl}>`;
        }
        if (node.type === 'blockquote') {
            const inner = tiptapJsonToHtml(node);
            return `<blockquote>${inner}</blockquote>`;
        }
        if (node.type === 'bulletList' || node.type === 'orderedList') {
            const tag = node.type === 'bulletList' ? 'ul' : 'ol';
            const items = (node.content || []).map((li: any) => {
                const liHtml = tiptapJsonToHtml(li);
                return `<li>${liHtml}</li>`;
            }).join('');
            return `<${tag}>${items}</${tag}>`;
        }
        if (node.type === 'image') {
            const src = node.attrs?.src || '';
            return `<img src="${src}" style="max-width:100%;border-radius:8px;" />`;
        }
        if (node.type === 'video') {
            const src = node.attrs?.src || '';
            return `<video src="${src}" controls style="max-width:100%;border-radius:8px;"></video>`;
        }
        if (node.type === 'videoEmbed') {
            const src = node.attrs?.src || '';
            const w = node.attrs?.width || 640;
            const h = node.attrs?.height || 360;
            return `<div style="position:relative;max-width:${w}px;margin:1rem 0;"><iframe src="${src}" width="${w}" height="${h}" frameborder="0" allowfullscreen style="max-width:100%;"></iframe></div>`;
        }
        return '';
    }).join('');
}

const NOTIFICATION_TYPES = [
    { value: 'system_announce', label: '系统公告' },
    { value: 'system_maintenance', label: '系统维护' },
    { value: 'system_security', label: '安全提醒' },
];

export default function BroadcastPage() {
    const router = useRouter();
    const [type, setType] = useState('system_announce');
    const [priority, setPriority] = useState('NORMAL');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState<any>(null);
    const [actionUrl, setActionUrl] = useState('');
    const [targetType, setTargetType] = useState('all');
    const [targetRoles, setTargetRoles] = useState<string[]>([]);
    const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
    const [roles, setRoles] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [userDialogOpen, setUserDialogOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [selectedUserNames, setSelectedUserNames] = useState<
        Record<string, string>
    >({});

    useEffect(() => {
        apiFetch('/roles?pageSize=100').then((d) => {
            if (Array.isArray(d?.data)) {
                setRoles(d.data);
            } else if (d?.data?.list) {
                setRoles(d.data.list);
            }
        });
    }, []);

    const extractUsers = (d: any) => {
        if (d?.data?.nodes) return d.data.nodes;
        if (d?.data?.list) return d.data.list;
        if (Array.isArray(d?.data)) return d.data;
        return [];
    };

    const openUserDialog = () => {
        setUserDialogOpen(true);
        setUserSearch('');
        apiFetch('/users?pageSize=100').then((d) => {
            setAllUsers(extractUsers(d));
        });
    };

    useEffect(() => {
        if (!userDialogOpen) return;
        const timer = setTimeout(() => {
            const endpoint = userSearch
                ? `/users?keyword=${userSearch}&pageSize=100`
                : '/users?pageSize=100';
            apiFetch(endpoint).then((d) => {
                setAllUsers(extractUsers(d));
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [userSearch, userDialogOpen]);

    const toggleUser = (user: any) => {
        const uid = user.id;
        const name = user.name || user.username;
        setTargetUserIds((prev) => {
            if (prev.includes(uid)) {
                return prev.filter((id) => id !== uid);
            }
            return [...prev, uid];
        });
        setSelectedUserNames((prev) => {
            const next = { ...prev };
            if (next[uid]) {
                delete next[uid];
            } else {
                next[uid] = name;
            }
            return next;
        });
    };

    const removeUser = (uid: string) => {
        setTargetUserIds((prev) => prev.filter((id) => id !== uid));
        setSelectedUserNames((prev) => {
            const next = { ...prev };
            delete next[uid];
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!title.trim()) {
            alert('请输入标题');
            return;
        }
        setSubmitting(true);
        try {
            const html = tiptapJsonToHtml(content);
            const body: any = {
                type, priority, title,
                content: html,
                targetType,
            };
            if (actionUrl) body.actionUrl = actionUrl;
            if (targetType === 'role') body.targetRoles = targetRoles;
            if (targetType === 'users') body.targetUserIds = targetUserIds;

            const data = await apiFetch('/admin/notifications/broadcasts', {
                method: 'POST',
                body: JSON.stringify(body),
            });

            if (data?.data?.broadcastId) {
                router.push('/settings/notifications');
            } else {
                alert(data?.message || '发送失败');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/settings/notifications">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-xl font-semibold text-foreground">发送广播通知</h1>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-5">
                <div className="space-y-2">
                    <Label>通知类型</Label>
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {NOTIFICATION_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>优先级</Label>
                    <div className="flex gap-2">
                        {[
                            { value: 'LOW', label: '低' },
                            { value: 'NORMAL', label: '普通' },
                            { value: 'HIGH', label: '重要' },
                            { value: 'URGENT', label: '紧急' },
                        ].map((p) => (
                            <Button
                                key={p.value}
                                variant={priority === p.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setPriority(p.value)}
                            >
                                {p.label}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>标题</Label>
                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="请输入通知标题"
                        maxLength={200}
                        className="bg-background border-border"
                    />
                </div>

                <div className="space-y-2">
                    <Label>内容</Label>
                    <div className="border border-border rounded-lg overflow-hidden">
                        <RichTextEditor
                            mode="simple"
                            contentKey="broadcast-content"
                            placeholder="请输入通知内容..."
                            onChange={(json) => setContent(json)}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>跳转链接（可选）</Label>
                    <Input
                        value={actionUrl}
                        onChange={(e) => setActionUrl(e.target.value)}
                        placeholder="https://..."
                        className="bg-background border-border"
                    />
                </div>

                <div className="space-y-2">
                    <Label>目标范围</Label>
                    <div className="flex gap-2">
                        {[
                            { value: 'all', label: '全部用户' },
                            { value: 'role', label: '指定角色' },
                            { value: 'users', label: '指定用户' },
                        ].map((t) => (
                            <Button
                                key={t.value}
                                variant={targetType === t.value ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTargetType(t.value)}
                            >
                                {t.label}
                            </Button>
                        ))}
                    </div>
                </div>

                {targetType === 'role' && (
                    <div className="space-y-2">
                        <Label>选择角色（可多选）</Label>
                        <div className="border border-border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                            {roles.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    暂无角色数据
                                </p>
                            )}
                            {roles.map((r) => (
                                <label
                                    key={r.id}
                                    className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-card-hover cursor-pointer"
                                >
                                    <Checkbox
                                        checked={targetRoles.includes(r.id)}
                                        onCheckedChange={() => {
                                            setTargetRoles((prev) =>
                                                prev.includes(r.id)
                                                    ? prev.filter((id) => id !== r.id)
                                                    : [...prev, r.id],
                                            );
                                        }}
                                    />
                                    <span className="text-sm text-foreground">
                                        {r.name}
                                    </span>
                                </label>
                            ))}
                        </div>
                        {targetRoles.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                                已选择 {targetRoles.length} 个角色
                            </p>
                        )}
                    </div>
                )}

                {targetType === 'users' && (
                    <div className="space-y-2">
                        <Label>选择用户</Label>
                        <Button
                            variant="outline"
                            onClick={openUserDialog}
                        >
                            <Users className="h-4 w-4 mr-1" />
                            选择用户
                        </Button>
                        {targetUserIds.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {targetUserIds.map((uid) => (
                                    <span
                                        key={uid}
                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary/10 text-primary border border-primary/20"
                                    >
                                        {selectedUserNames[uid] || uid}
                                        <button
                                            type="button"
                                            onClick={() => removeUser(uid)}
                                            className="hover:text-destructive"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            已选择 {targetUserIds.length} 个用户
                        </p>
                    </div>
                )}

                <div className="pt-4 border-t border-border flex justify-end gap-3">
                    <Link href="/settings/notifications">
                        <Button variant="outline">取消</Button>
                    </Link>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        <Send className="h-4 w-4 mr-1" />
                        {submitting ? '发送中...' : '发送广播'}
                    </Button>
                </div>
            </div>

            <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
                <DialogContent className="sm:max-w-[520px] bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">
                            选择用户
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                                placeholder="搜索用户名、姓名..."
                                className="pl-9 bg-background border-border"
                            />
                        </div>
                        <div className="border border-border rounded-lg max-h-72 overflow-y-auto">
                            {allUsers.length === 0 && (
                                <p className="p-4 text-sm text-muted-foreground text-center">
                                    暂无用户数据
                                </p>
                            )}
                            {allUsers.map((u) => (
                                <label
                                    key={u.id}
                                    className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-card-hover cursor-pointer"
                                >
                                    <Checkbox
                                        checked={targetUserIds.includes(u.id)}
                                        onCheckedChange={() => toggleUser(u)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-sm text-foreground">
                                            {u.name || u.username}
                                        </span>
                                        {u.name && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                                {u.username}
                                            </span>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            已选择 {targetUserIds.length} 个用户
                        </p>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setUserDialogOpen(false)}
                        >
                            确定
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

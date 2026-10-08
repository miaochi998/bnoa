'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, Trash2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Link from 'next/link';
import { EditorConfigSection } from './EditorConfigSection';

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

interface TypeConfig {
    type: string;
    enabled: boolean;
    label: string;
    category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    system: '系统通知',
    approval: '审批通知',
    file: '文件通知',
    task: '任务通知',
    interaction: '互动通知',
};

export default function NotificationConfigPage() {
    const [retentionDays, setRetentionDays] = useState(90);
    const [pageSize, setPageSize] = useState(20);
    const [emailEnabled, setEmailEnabled] = useState(false);
    const [typeConfigs, setTypeConfigs] = useState<TypeConfig[]>([]);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const fetchConfig = useCallback(async () => {
        const data = await apiFetch('/admin/notifications/config');
        if (data?.data) {
            setRetentionDays(data.data.retentionDays || 90);
            setPageSize(data.data.pageSize || 20);
            setEmailEnabled(data.data.emailEnabled || false);
            setTypeConfigs(data.data.typeConfigs || []);
            setLoaded(true);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const data = await apiFetch('/admin/notifications/config', {
                method: 'PUT',
                body: JSON.stringify({
                    retentionDays,
                    pageSize,
                    emailEnabled,
                    typeConfigs: typeConfigs.map((tc) => ({
                        type: tc.type, enabled: tc.enabled,
                    })),
                }),
            });
            if (data?.data?.message || data?.message) {
                alert('配置保存成功');
            }
        } finally {
            setSaving(false);
        }
    };

    const toggleType = (type: string, enabled: boolean) => {
        setTypeConfigs((prev) =>
            prev.map((tc) => tc.type === type ? { ...tc, enabled } : tc),
        );
    };

    const handleMaintenance = async (operation: string) => {
        const confirmMsg = operation === 'cleanup_expired'
            ? `确定清理 ${retentionDays} 天前的过期通知？`
            : '确定重置所有未读通知为已读？';
        if (!confirm(confirmMsg)) return;

        const data = await apiFetch('/admin/notifications/maintenance', {
            method: 'POST',
            body: JSON.stringify({
                operation,
                params: { days: retentionDays },
            }),
        });
        if (data?.data) {
            alert(`操作完成，影响 ${data.data.affectedCount} 条记录`);
        }
    };

    const grouped = typeConfigs.reduce<Record<string, TypeConfig[]>>((acc, tc) => {
        const cat = tc.category || 'system';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(tc);
        return acc;
    }, {});

    if (!loaded) {
        return (
            <div className="flex items-center justify-center py-20">
                <p className="text-muted-foreground">加载配置中...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/settings/notifications">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <h1 className="text-xl font-semibold text-foreground">通知配置</h1>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-5">
                <h2 className="text-base font-medium text-foreground">基础配置</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>通知保留天数</Label>
                        <Input
                            type="number"
                            value={retentionDays}
                            onChange={(e) => setRetentionDays(Number(e.target.value))}
                            min={1}
                            max={365}
                            className="bg-background border-border"
                        />
                        <p className="text-xs text-muted-foreground">
                            超过此天数的已读通知将被自动清理
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label>每页显示数量</Label>
                        <Input
                            type="number"
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            min={5}
                            max={100}
                            className="bg-background border-border"
                        />
                        <p className="text-xs text-muted-foreground">
                            通知列表每页显示的条数
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between py-3 border-t border-border">
                    <div>
                        <Label className="text-sm">邮件联动</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            开启后，重要和紧急通知将同步发送邮件
                        </p>
                    </div>
                    <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
                </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 space-y-5">
                <h2 className="text-base font-medium text-foreground">通知类型开关</h2>
                <p className="text-xs text-muted-foreground">
                    关闭后，该类型的通知将不会被创建
                </p>

                {Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">
                            {CATEGORY_LABELS[category] || category}
                        </h3>
                        <div className="space-y-2">
                            {items.map((tc) => (
                                <div
                                    key={tc.type}
                                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-card-hover"
                                >
                                    <span className="text-sm text-foreground">{tc.label}</span>
                                    <Switch
                                        checked={tc.enabled}
                                        onCheckedChange={(v) => toggleType(tc.type, v)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <EditorConfigSection />

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <h2 className="text-base font-medium text-foreground">系统维护</h2>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => handleMaintenance('cleanup_expired')}
                    >
                        <Trash2 className="h-4 w-4 mr-1" />
                        清理过期通知
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleMaintenance('reset_unread')}
                    >
                        <MailCheck className="h-4 w-4 mr-1" />
                        全部标记已读
                    </Button>
                </div>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? '保存中...' : '保存配置'}
                </Button>
            </div>
        </div>
    );
}

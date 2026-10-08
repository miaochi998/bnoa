'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    Loader2,
    Save,
    RotateCcw,
    Mail,
} from 'lucide-react';
import SmtpConfigSection from './_components/SmtpConfigSection';
import TemplateSection from './_components/TemplateSection';
import LogSection from './_components/LogSection';

const API_URL =
    getApiBaseUrl();

export interface EmailConfig {
    senderEmail: string;
    senderName: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    encryption: string;
    provider: string;
    notifications: Record<string, boolean>;
}

const DEFAULT_CONFIG: EmailConfig = {
    senderEmail: '',
    senderName: 'BNOA 办公系统',
    smtpHost: 'smtp.qq.com',
    smtpPort: 465,
    smtpUser: '',
    smtpPass: '',
    encryption: 'ssl',
    provider: 'qq',
    notifications: {
        PASSWORD_RESET_CODE: true,
        PASSWORD_CHANGED: true,
        LOGIN_REMOTE: false,
        SECURITY_ALERT: true,
        WELCOME: true,
        FILE_SHARE: true,
    },
};

const tabs = [
    { key: 'config', label: '邮箱配置' },
    { key: 'template', label: '邮件模板' },
    { key: 'log', label: '邮件日志' },
];

export default function EmailSettingsPage() {
    const [activeTab, setActiveTab] = useState('config');
    const [config, setConfig] =
        useState<EmailConfig>(DEFAULT_CONFIG);
    const [originalConfig, setOriginalConfig] =
        useState<EmailConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const getToken = () =>
        localStorage.getItem('accessToken');

    const loadConfig = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(
                `${API_URL}/email/config`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${getToken()}`,
                    },
                },
            );
            const json = await res.json();
            const data = json.data?.data || json.data;
            if (data) {
                const merged = {
                    ...DEFAULT_CONFIG,
                    ...data,
                };
                setConfig(merged);
                setOriginalConfig(merged);
            }
        } catch {
            // 使用默认配置
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    useEffect(() => {
        setHasChanges(
            JSON.stringify(config) !==
                JSON.stringify(originalConfig),
        );
    }, [config, originalConfig]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload: Record<string, any> = {};
            const keys: (keyof EmailConfig)[] = [
                'senderEmail', 'senderName',
                'smtpHost', 'smtpPort', 'smtpUser',
                'encryption', 'provider', 'notifications',
            ];
            for (const k of keys) {
                if (
                    JSON.stringify(config[k]) !==
                    JSON.stringify(originalConfig[k])
                ) {
                    payload[k] = config[k];
                }
            }
            // 密码仅在修改时传递
            if (
                config.smtpPass &&
                config.smtpPass !== '********'
            ) {
                payload.smtpPass = config.smtpPass;
            }

            const res = await fetch(
                `${API_URL}/email/config`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type':
                            'application/json',
                        Authorization:
                            `Bearer ${getToken()}`,
                    },
                    body: JSON.stringify(payload),
                },
            );
            if (!res.ok) {
                const err = await res.json();
                throw new Error(
                    err.message || '保存失败',
                );
            }
            setOriginalConfig({ ...config });
            setHasChanges(false);
            alert('邮件配置保存成功');
        } catch (err: any) {
            alert(err.message || '保存配置失败');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setConfig({ ...originalConfig });
    };

    const updateConfig = (
        updates: Partial<EmailConfig>,
    ) => {
        setConfig((prev) => ({
            ...prev,
            ...updates,
        }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Mail className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">
                            邮件服务设置
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            配置 SMTP 邮件发送、模板管理和日志查看
                        </p>
                    </div>
                </div>
                {activeTab === 'config' && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReset}
                            disabled={
                                !hasChanges || saving
                            }
                        >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            重置
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={
                                !hasChanges || saving
                            }
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-1" />
                            )}
                            保存配置
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex gap-1 border-b border-border">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() =>
                            setActiveTab(tab.key)
                        }
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            activeTab === tab.key
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div>
                {activeTab === 'config' && (
                    <SmtpConfigSection
                        config={config}
                        onUpdate={updateConfig}
                    />
                )}
                {activeTab === 'template' && (
                    <TemplateSection />
                )}
                {activeTab === 'log' && (
                    <LogSection />
                )}
            </div>
        </div>
    );
}

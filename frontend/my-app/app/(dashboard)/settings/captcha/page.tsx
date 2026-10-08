'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
    Loader2,
    Save,
    RotateCcw,
    Fingerprint,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import BasicSettingsSection from './_components/BasicSettingsSection';
import SecuritySettingsSection from './_components/SecuritySettingsSection';
import BackgroundManageSection from './_components/BackgroundManageSection';
import CaptchaPreviewSection from './_components/CaptchaPreviewSection';

export interface CaptchaFullConfig {
    enabled: boolean;
    type: string;
    expireTime: number;
    tolerance: number;
    maxAttempts: number;
    enableTrailVerify: boolean;
    loginRequired: boolean;
    registerRequired: boolean;
    resetPasswordRequired: boolean;
    maxBackgrounds: number;
    minBackgrounds: number;
    backgroundFolderId: string;
    storageMode: string;
}

const DEFAULT_CONFIG: CaptchaFullConfig = {
    enabled: true,
    type: 'slider',
    expireTime: 300,
    tolerance: 5,
    maxAttempts: 3,
    enableTrailVerify: true,
    loginRequired: true,
    registerRequired: true,
    resetPasswordRequired: true,
    maxBackgrounds: 100,
    minBackgrounds: 5,
    backgroundFolderId: '',
    storageMode: 'rustfs',
};

const tabs = [
    { key: 'basic', label: '基础设置' },
    { key: 'security', label: '安全设置' },
    { key: 'backgrounds', label: '背景图管理' },
    { key: 'preview', label: '效果预览' },
];

export default function CaptchaSettingsPage() {
    const [activeTab, setActiveTab] = useState('basic');
    const [config, setConfig] =
        useState<CaptchaFullConfig>(DEFAULT_CONFIG);
    const [originalConfig, setOriginalConfig] =
        useState<CaptchaFullConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const loadConfig = useCallback(async () => {
        try {
            setLoading(true);
            const token =
                localStorage.getItem('accessToken');
            const res = await fetch(
                `${getApiBaseUrl()}/captcha-settings/config`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );
            const json = await res.json();
            const data =
                json.data?.data || json.data;
            if (data) {
                setConfig(data);
                setOriginalConfig(data);
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
            const token =
                localStorage.getItem('accessToken');
            const res = await fetch(
                `${getApiBaseUrl()}/captcha-settings/config`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type':
                            'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(config),
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
        updates: Partial<CaptchaFullConfig>,
    ) => {
        setConfig((prev) => ({ ...prev, ...updates }));
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
                    <Fingerprint className="h-6 w-6 text-primary" />
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">
                            验证码设置
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            配置滑块验证码的参数和行为
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={!hasChanges || saving}
                    >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        重置
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasChanges || saving}
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4 mr-1" />
                        )}
                        保存配置
                    </Button>
                </div>
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
                {activeTab === 'basic' && (
                    <BasicSettingsSection
                        config={config}
                        onUpdate={updateConfig}
                    />
                )}
                {activeTab === 'security' && (
                    <SecuritySettingsSection
                        config={config}
                        onUpdate={updateConfig}
                    />
                )}
                {activeTab === 'backgrounds' && (
                    <BackgroundManageSection
                        config={config}
                        onUpdate={updateConfig}
                    />
                )}
                {activeTab === 'preview' && (
                    <CaptchaPreviewSection
                        config={config}
                    />
                )}
            </div>
        </div>
    );
}

'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Loader2, Send } from 'lucide-react';
import { type EmailConfig } from '../page';

const API_URL =
    getApiBaseUrl();

const PROVIDER_PRESETS: Record<
    string,
    { host: string; port: number; encryption: string }
> = {
    qq: {
        host: 'smtp.qq.com',
        port: 465,
        encryption: 'ssl',
    },
    netease163: {
        host: 'smtp.163.com',
        port: 465,
        encryption: 'ssl',
    },
    gmail: {
        host: 'smtp.gmail.com',
        port: 587,
        encryption: 'tls',
    },
    custom: {
        host: '',
        port: 465,
        encryption: 'ssl',
    },
};

const ENCRYPTION_PORTS: Record<string, number> = {
    none: 25,
    ssl: 465,
    tls: 587,
};

const NOTIFICATION_GROUPS = [
    {
        label: '认证安全类',
        items: [
            {
                key: 'PASSWORD_RESET_CODE',
                label: '密码重置验证码',
            },
            {
                key: 'PASSWORD_CHANGED',
                label: '密码修改通知',
            },
            {
                key: 'LOGIN_REMOTE',
                label: '异地登录告警',
            },
            {
                key: 'SECURITY_ALERT',
                label: '安全事件告警',
            },
        ],
    },
    {
        label: '系统通知类',
        items: [
            {
                key: 'WELCOME',
                label: '欢迎邮件',
            },
            {
                key: 'FILE_SHARE',
                label: '文件分享通知',
            },
        ],
    },
];

interface Props {
    config: EmailConfig;
    onUpdate: (
        updates: Partial<EmailConfig>,
    ) => void;
}

export default function SmtpConfigSection({
    config,
    onUpdate,
}: Props) {
    const [testDialogOpen, setTestDialogOpen] =
        useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [testSending, setTestSending] =
        useState(false);

    const handleProviderChange = (
        provider: string,
    ) => {
        const preset = PROVIDER_PRESETS[provider];
        if (preset) {
            onUpdate({
                provider,
                smtpHost: preset.host,
                smtpPort: preset.port,
                encryption: preset.encryption,
            });
        }
    };

    const handleEncryptionChange = (
        encryption: string,
    ) => {
        onUpdate({
            encryption,
            smtpPort:
                ENCRYPTION_PORTS[encryption] || 465,
        });
    };

    const handleNotificationToggle = (
        key: string,
        value: boolean,
    ) => {
        onUpdate({
            notifications: {
                ...config.notifications,
                [key]: value,
            },
        });
    };

    const handleSendTest = async () => {
        if (!testEmail) return;
        setTestSending(true);
        try {
            const token =
                localStorage.getItem('accessToken');
            const res = await fetch(
                `${API_URL}/email/test`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json',
                        Authorization:
                            `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        to: testEmail,
                    }),
                },
            );
            if (!res.ok) {
                const err = await res.json();
                throw new Error(
                    err.message || '发送失败',
                );
            }
            alert('测试邮件已加入发送队列');
            setTestDialogOpen(false);
            setTestEmail('');
        } catch (err: any) {
            alert(err.message || '发送测试邮件失败');
        } finally {
            setTestSending(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* SMTP 配置 */}
            <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                <div>
                    <h3 className="text-base font-medium text-foreground">
                        SMTP 服务配置
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        配置邮件发送服务器参数
                    </p>
                </div>

                {/* 服务商选择 */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        邮箱服务商
                    </Label>
                    <Select
                        value={config.provider}
                        onValueChange={
                            handleProviderChange
                        }
                    >
                        <SelectTrigger className="w-full bg-background">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="qq">
                                QQ 邮箱
                            </SelectItem>
                            <SelectItem value="netease163">
                                网易 163 邮箱
                            </SelectItem>
                            <SelectItem value="gmail">
                                Gmail
                            </SelectItem>
                            <SelectItem value="custom">
                                其他 SMTP
                            </SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        选择服务商后自动填充 SMTP
                        参数，选择「其他」可手动配置
                    </p>
                </div>

                {/* 发件人信息 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">
                            发件人邮箱
                        </Label>
                        <Input
                            type="email"
                            value={config.senderEmail}
                            onChange={(e) =>
                                onUpdate({
                                    senderEmail:
                                        e.target.value,
                                })
                            }
                            placeholder="noreply@example.com"
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">
                            发件人名称
                        </Label>
                        <Input
                            value={config.senderName}
                            onChange={(e) =>
                                onUpdate({
                                    senderName:
                                        e.target.value,
                                })
                            }
                            placeholder="BNOA 办公系统"
                            className="bg-background"
                        />
                    </div>
                </div>

                {/* SMTP 服务器参数 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">
                            SMTP 服务器
                        </Label>
                        <Input
                            value={config.smtpHost}
                            onChange={(e) =>
                                onUpdate({
                                    smtpHost:
                                        e.target.value,
                                })
                            }
                            placeholder="smtp.qq.com"
                            className="bg-background"
                            disabled={
                                config.provider !==
                                'custom'
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">
                            端口
                        </Label>
                        <Input
                            type="number"
                            value={config.smtpPort}
                            onChange={(e) =>
                                onUpdate({
                                    smtpPort:
                                        parseInt(
                                            e.target
                                                .value,
                                        ) || 465,
                                })
                            }
                            className="bg-background"
                            disabled={
                                config.provider !==
                                'custom'
                            }
                        />
                    </div>
                </div>

                {/* 认证信息 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">
                            SMTP 用户名
                        </Label>
                        <Input
                            value={config.smtpUser}
                            onChange={(e) =>
                                onUpdate({
                                    smtpUser:
                                        e.target.value,
                                })
                            }
                            placeholder="邮箱账号"
                            className="bg-background"
                            name="smtp-user"
                            autoComplete="off"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">
                            SMTP 授权码
                        </Label>
                        <Input
                            type="password"
                            value={config.smtpPass}
                            onChange={(e) =>
                                onUpdate({
                                    smtpPass:
                                        e.target.value,
                                })
                            }
                            placeholder="授权码（非邮箱密码）"
                            className="bg-background"
                            name="smtp-pass"
                            autoComplete="new-password"
                        />
                        <p className="text-xs text-muted-foreground">
                            QQ邮箱需在邮箱设置中开启
                            SMTP 并获取授权码
                        </p>
                    </div>
                </div>

                {/* 加密方式 */}
                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        加密方式
                    </Label>
                    <div className="flex gap-4">
                        {[
                            {
                                value: 'none',
                                label: '无加密',
                            },
                            {
                                value: 'ssl',
                                label: 'SSL',
                            },
                            {
                                value: 'tls',
                                label: 'TLS',
                            },
                        ].map((item) => (
                            <label
                                key={item.value}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                                    config.encryption ===
                                    item.value
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-border text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="encryption"
                                    value={item.value}
                                    checked={
                                        config.encryption ===
                                        item.value
                                    }
                                    onChange={() =>
                                        handleEncryptionChange(
                                            item.value,
                                        )
                                    }
                                    className="sr-only"
                                    disabled={
                                        config.provider !==
                                        'custom'
                                    }
                                />
                                <span className="text-sm font-medium">
                                    {item.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* 测试发送 */}
                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            setTestDialogOpen(true)
                        }
                    >
                        <Send className="h-4 w-4 mr-1" />
                        发送测试邮件
                    </Button>
                </div>
            </div>

            {/* 邮件通知开关 */}
            <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                <div>
                    <h3 className="text-base font-medium text-foreground">
                        邮件通知开关
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        控制各业务场景的邮件通知是否启用
                    </p>
                </div>

                {NOTIFICATION_GROUPS.map(
                    (group, gi) => (
                        <div
                            key={group.label}
                            className="space-y-3"
                        >
                            {gi > 0 && <Separator />}
                            <Label className="text-sm font-semibold">
                                {group.label}
                            </Label>
                            <div className="space-y-3">
                                {group.items.map(
                                    (item) => (
                                        <div
                                            key={
                                                item.key
                                            }
                                            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                                        >
                                            <span className="text-sm text-foreground">
                                                {
                                                    item.label
                                                }
                                            </span>
                                            <Switch
                                                checked={
                                                    config
                                                        .notifications[
                                                        item
                                                            .key
                                                    ] ??
                                                    false
                                                }
                                                onCheckedChange={(
                                                    v,
                                                ) =>
                                                    handleNotificationToggle(
                                                        item.key,
                                                        v,
                                                    )
                                                }
                                            />
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>
                    ),
                )}
            </div>

            {/* 测试邮件 Dialog */}
            <Dialog
                open={testDialogOpen}
                onOpenChange={setTestDialogOpen}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            发送测试邮件
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>收件人邮箱</Label>
                            <Input
                                type="email"
                                value={testEmail}
                                onChange={(e) =>
                                    setTestEmail(
                                        e.target.value,
                                    )
                                }
                                placeholder="输入收件邮箱地址"
                                className="bg-background"
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    setTestDialogOpen(
                                        false,
                                    )
                                }
                            >
                                取消
                            </Button>
                            <Button
                                size="sm"
                                onClick={
                                    handleSendTest
                                }
                                disabled={
                                    !testEmail ||
                                    testSending
                                }
                            >
                                {testSending ? (
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4 mr-1" />
                                )}
                                发送
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

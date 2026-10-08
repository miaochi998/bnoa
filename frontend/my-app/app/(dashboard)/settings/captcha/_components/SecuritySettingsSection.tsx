'use client';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Alert,
    AlertDescription,
} from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { CaptchaFullConfig } from '../page';

interface Props {
    config: CaptchaFullConfig;
    onUpdate: (
        updates: Partial<CaptchaFullConfig>,
    ) => void;
}

export default function SecuritySettingsSection({
    config,
    onUpdate,
}: Props) {
    const disabled = !config.enabled;

    return (
        <div className="space-y-6">
            {disabled && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        验证码功能已禁用，以下设置不会生效。请先在基础设置中启用验证码。
                    </AlertDescription>
                </Alert>
            )}

            <div className="rounded-lg border border-border bg-card p-6 space-y-6">
                <div className="space-y-2">
                    <Label className="text-sm font-medium">
                        最大尝试次数
                    </Label>
                    <Input
                        type="number"
                        min={1}
                        max={10}
                        value={config.maxAttempts}
                        onChange={(e) =>
                            onUpdate({
                                maxAttempts:
                                    parseInt(
                                        e.target.value,
                                    ) || 3,
                            })
                        }
                        disabled={disabled}
                        className="bg-background"
                    />
                    <p className="text-xs text-muted-foreground">
                        连续错误次数达到此值后需手动刷新，范围
                        1-10
                    </p>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <Label className="text-sm font-medium">
                            启用轨迹验证
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                            分析用户拖动轨迹，防止机器人攻击
                        </p>
                    </div>
                    <Switch
                        checked={
                            config.enableTrailVerify
                        }
                        onCheckedChange={(v) =>
                            onUpdate({
                                enableTrailVerify: v,
                            })
                        }
                        disabled={disabled}
                    />
                </div>

                <div className="border-t border-border pt-4">
                    <h3 className="text-sm font-medium text-foreground mb-4">
                        场景开关
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium">
                                    登录需验证码
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                    用户登录时要求完成验证码验证
                                </p>
                            </div>
                            <Switch
                                checked={
                                    config.loginRequired
                                }
                                onCheckedChange={(v) =>
                                    onUpdate({
                                        loginRequired:
                                            v,
                                    })
                                }
                                disabled={disabled}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium">
                                    注册需验证码
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                    用户注册时要求完成验证码验证
                                </p>
                            </div>
                            <Switch
                                checked={
                                    config.registerRequired
                                }
                                onCheckedChange={(v) =>
                                    onUpdate({
                                        registerRequired:
                                            v,
                                    })
                                }
                                disabled={disabled}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium">
                                    重置密码需验证码
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                    用户重置密码时要求完成验证码验证
                                </p>
                            </div>
                            <Switch
                                checked={
                                    config.resetPasswordRequired
                                }
                                onCheckedChange={(v) =>
                                    onUpdate({
                                        resetPasswordRequired:
                                            v,
                                    })
                                }
                                disabled={disabled}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

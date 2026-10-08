'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import CaptchaVerify, {
    CaptchaVerifyRef,
} from '@/components/shared/CaptchaVerify';
import { CaptchaFullConfig } from '../page';

interface Props {
    config: CaptchaFullConfig;
}

export default function CaptchaPreviewSection({
    config,
}: Props) {
    const captchaRef =
        useRef<CaptchaVerifyRef>(null);
    const [result, setResult] = useState<{
        success: boolean;
        message: string;
        token?: string;
    } | null>(null);

    const handleRefresh = () => {
        setResult(null);
        captchaRef.current?.refresh(true);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-foreground">
                        实时预览
                    </h3>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                    >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        刷新
                    </Button>
                </div>

                <div className="captcha-dark-theme">
                    <CaptchaVerify
                        ref={captchaRef}
                        mode="embed"
                        bgSize={{
                            width: 320,
                            height: 160,
                        }}
                        onSuccess={(token) =>
                            setResult({
                                success: true,
                                message: '验证成功',
                                token,
                            })
                        }
                        onError={(msg) =>
                            setResult({
                                success: false,
                                message: msg,
                            })
                        }
                        limitErrorCount={
                            config.maxAttempts
                        }
                    />
                </div>

                {result && (
                    <div
                        className={`mt-4 flex items-center gap-2 p-3 rounded-md text-sm ${
                            result.success
                                ? 'bg-green-500/10 text-green-500'
                                : 'bg-destructive/10 text-destructive'
                        }`}
                    >
                        {result.success ? (
                            <CheckCircle2 className="h-4 w-4" />
                        ) : (
                            <XCircle className="h-4 w-4" />
                        )}
                        <span>{result.message}</span>
                        {result.token && (
                            <span className="text-xs text-muted-foreground ml-auto truncate max-w-[160px]">
                                Token:{' '}
                                {result.token.slice(
                                    0,
                                    16,
                                )}
                                ...
                            </span>
                        )}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                <div className="rounded-lg border border-border bg-card p-6">
                    <h3 className="text-sm font-medium text-foreground mb-4">
                        预览说明
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        此预览区域展示的是嵌入式（embed）模式的验证码效果。登录页面使用的是触发式（float）模式，
                        用户点击滑块后会弹出验证码浮层。验证成功后将获得一次性
                        Token 用于提交表单。
                    </p>
                </div>

                <div className="rounded-lg border border-border bg-card p-6">
                    <h3 className="text-sm font-medium text-foreground mb-4">
                        当前配置摘要
                    </h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                                状态
                            </span>
                            <Badge
                                variant={
                                    config.enabled
                                        ? 'default'
                                        : 'secondary'
                                }
                            >
                                {config.enabled
                                    ? '已启用'
                                    : '已禁用'}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                                类型
                            </span>
                            <span className="text-foreground">
                                {config.type ===
                                'slider'
                                    ? '滑块拼图'
                                    : config.type}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                                过期时间
                            </span>
                            <span className="text-foreground">
                                {config.expireTime} 秒
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                                容差
                            </span>
                            <span className="text-foreground">
                                {config.tolerance} 像素
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                                最大尝试次数
                            </span>
                            <span className="text-foreground">
                                {config.maxAttempts} 次
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                                轨迹验证
                            </span>
                            <Badge
                                variant={
                                    config.enableTrailVerify
                                        ? 'default'
                                        : 'secondary'
                                }
                            >
                                {config.enableTrailVerify
                                    ? '已启用'
                                    : '已禁用'}
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

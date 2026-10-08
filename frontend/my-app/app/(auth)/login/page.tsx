'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api';
import CaptchaVerify, {
    CaptchaVerifyRef,
} from '@/components/shared/CaptchaVerify';
import {
    useCaptcha,
    CaptchaConfig,
} from '@/hooks/useCaptcha';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const captchaRef = useRef<CaptchaVerifyRef>(null);
    const { getCaptchaConfig } = useCaptcha();
    const [captchaConfig, setCaptchaConfig] =
        useState<CaptchaConfig | null>(null);
    const [captchaToken, setCaptchaToken] = useState<
        string | null
    >(null);

    const needCaptcha =
        captchaConfig?.enabled &&
        captchaConfig?.loginRequired;

    useEffect(() => {
        getCaptchaConfig()
            .then(setCaptchaConfig)
            .catch(() => {});
    }, [getCaptchaConfig]);

    const doLogin = async (token?: string) => {
        setError('');
        setLoading(true);
        try {
            const finalToken =
                token || captchaToken || undefined;
            await apiClient.login({
                username,
                password,
                captchaToken: finalToken,
            });
            router.push('/dashboard');
        } catch (err: any) {
            setError(
                err.message ||
                    '登录失败，请检查用户名和密码',
            );
            if (needCaptcha) {
                setCaptchaToken(null);
                captchaRef.current?.refresh(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCaptchaSuccess = async (
        token: string,
    ) => {
        setCaptchaToken(token);
        await doLogin(token);
    };

    const handleSubmit = async (
        e: React.FormEvent,
    ) => {
        e.preventDefault();
        if (needCaptcha) {
            return;
        }
        await doLogin();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md border-border bg-card">
                <CardHeader className="space-y-1 text-center">
                    <CardTitle className="text-2xl font-semibold text-foreground">
                        BNOA 管理系统
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        请输入您的账号和密码登录
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={handleSubmit}
                        className="space-y-4"
                    >
                        {error && (
                            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label
                                htmlFor="username"
                                className="text-sm font-medium text-foreground"
                            >
                                用户名
                            </label>
                            <Input
                                id="username"
                                type="text"
                                placeholder="请输入用户名"
                                value={username}
                                onChange={(e) =>
                                    setUsername(
                                        e.target.value,
                                    )
                                }
                                required
                                disabled={loading}
                                className="bg-background border-input focus-visible:ring-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="password"
                                className="text-sm font-medium text-foreground"
                            >
                                密码
                            </label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="请输入密码"
                                value={password}
                                onChange={(e) =>
                                    setPassword(
                                        e.target.value,
                                    )
                                }
                                required
                                disabled={loading}
                                className="bg-background border-input focus-visible:ring-primary"
                            />
                        </div>

                        {needCaptcha && (
                            <div className="captcha-dark-theme">
                                <CaptchaVerify
                                    ref={captchaRef}
                                    mode="float"
                                    onSuccess={
                                        handleCaptchaSuccess
                                    }
                                    onError={(msg) =>
                                        setError(msg)
                                    }
                                    limitErrorCount={
                                        captchaConfig?.maxAttempts ||
                                        3
                                    }
                                    bgSize={{
                                        width: 320,
                                        height: 160,
                                    }}
                                    tipText={{
                                        default:
                                            '点击按钮进行验证',
                                        loading:
                                            '加载中...',
                                        moving:
                                            '请继续拖动',
                                        verifying:
                                            '验证中...',
                                        success:
                                            '验证成功',
                                        error: '验证失败，请重试',
                                    }}
                                />
                            </div>
                        )}

                        {!needCaptcha && (
                            <Button
                                type="submit"
                                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all duration-200"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        登录中...
                                    </>
                                ) : (
                                    '登录'
                                )}
                            </Button>
                        )}
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

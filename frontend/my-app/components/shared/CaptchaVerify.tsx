'use client';

import React, {
    forwardRef,
    useRef,
    useImperativeHandle,
} from 'react';
import SliderCaptcha, {
    ActionType,
    VerifyParam,
    Status,
} from 'rc-slider-captcha';
import { useCaptcha } from '@/hooks/useCaptcha';
import { cn } from '@/lib/utils';

export type CaptchaMode = 'embed' | 'float' | 'slider';

export interface CaptchaVerifyProps {
    mode?: CaptchaMode;
    onSuccess?: (token: string) => void;
    onError?: (message: string) => void;
    className?: string;
    style?: React.CSSProperties;
    themeVars?: {
        primary?: string;
        primaryLight?: string;
        success?: string;
        successLight?: string;
        error?: string;
        errorLight?: string;
        bgColor?: string;
        borderColor?: string;
        textColor?: string;
    };
    tipText?: {
        default?: React.ReactNode;
        loading?: React.ReactNode;
        moving?: React.ReactNode;
        verifying?: React.ReactNode;
        success?: React.ReactNode;
        error?: React.ReactNode;
    };
    showRefreshIcon?: boolean;
    autoRequest?: boolean;
    limitErrorCount?: number;
    bgSize?: { width: number; height: number };
    puzzleSize?: {
        width: number;
        height?: number;
        left?: number;
        top?: number;
    };
}

export interface CaptchaVerifyRef {
    refresh: (resetErrorCount?: boolean) => void;
    getStatus: () => Status;
}

const defaultTipText = {
    default: '向右拖动滑块填充拼图',
    loading: '加载中...',
    moving: '请继续拖动',
    verifying: '验证中...',
    success: '验证成功',
    error: '验证失败，请重试',
};

const CaptchaVerify = forwardRef<
    CaptchaVerifyRef,
    CaptchaVerifyProps
>((props, ref) => {
    const {
        mode = 'embed',
        onSuccess,
        onError,
        className,
        style,
        themeVars,
        tipText,
        showRefreshIcon = true,
        autoRequest = true,
        limitErrorCount = 0,
        bgSize = { width: 320, height: 160 },
        puzzleSize,
    } = props;

    const actionRef = useRef<ActionType | undefined>(
        undefined,
    );
    const { generateCaptcha, verifyCaptcha } = useCaptcha();

    useImperativeHandle(ref, () => ({
        refresh: (resetErrorCount?: boolean) => {
            actionRef.current?.refresh(resetErrorCount);
        },
        getStatus: () =>
            actionRef.current?.status || Status.Default,
    }));

    const cssVars: Record<string, string> = {};
    if (themeVars) {
        if (themeVars.primary) {
            cssVars['--rcsc-primary'] = themeVars.primary;
        }
        if (themeVars.primaryLight) {
            cssVars['--rcsc-primary-light'] =
                themeVars.primaryLight;
        }
        if (themeVars.success) {
            cssVars['--rcsc-success'] = themeVars.success;
        }
        if (themeVars.successLight) {
            cssVars['--rcsc-success-light'] =
                themeVars.successLight;
        }
        if (themeVars.error) {
            cssVars['--rcsc-error'] = themeVars.error;
        }
        if (themeVars.errorLight) {
            cssVars['--rcsc-error-light'] =
                themeVars.errorLight;
        }
        if (themeVars.bgColor) {
            cssVars['--rcsc-bg-color'] = themeVars.bgColor;
        }
        if (themeVars.borderColor) {
            cssVars['--rcsc-border-color'] =
                themeVars.borderColor;
        }
        if (themeVars.textColor) {
            cssVars['--rcsc-text-color'] =
                themeVars.textColor;
        }
    }

    const mergedTipText = {
        ...defaultTipText,
        ...tipText,
    };

    const handleVerify = async (
        verifyData: VerifyParam,
    ) => {
        const trailFormatted = {
            x: verifyData.trail.map((p) => p[0]),
            y: verifyData.trail.map((p) => p[1]),
        };
        const result = await verifyCaptcha({
            x: verifyData.x,
            y: verifyData.y,
            sliderOffsetX: verifyData.sliderOffsetX,
            duration: verifyData.duration,
            trail: trailFormatted,
        });
        if (result.success && result.token) {
            onSuccess?.(result.token);
            return;
        }
        const errMsg = result.message || '验证失败';
        onError?.(errMsg);
        throw new Error(errMsg);
    };

    const mergedStyle = {
        ...cssVars,
        ...style,
    } as React.CSSProperties;

    if (mode === 'slider') {
        return (
            <div
                className={cn(
                    'captcha-verify',
                    className,
                )}
                style={mergedStyle}
            >
                <SliderCaptcha
                    mode="slider"
                    actionRef={actionRef}
                    onVerify={handleVerify}
                    autoRequest={autoRequest}
                    showRefreshIcon={showRefreshIcon}
                    limitErrorCount={limitErrorCount}
                    tipText={mergedTipText}
                />
            </div>
        );
    }

    return (
        <div
            className={cn('captcha-verify', className)}
            style={mergedStyle}
        >
            <SliderCaptcha
                mode={mode}
                actionRef={actionRef}
                request={generateCaptcha}
                onVerify={handleVerify}
                autoRequest={autoRequest}
                showRefreshIcon={showRefreshIcon}
                limitErrorCount={limitErrorCount}
                tipText={mergedTipText}
                bgSize={bgSize}
                puzzleSize={puzzleSize}
            />
        </div>
    );
});

CaptchaVerify.displayName = 'CaptchaVerify';

export default CaptchaVerify;
export { Status };

'use client'

import { getApiBaseUrl } from '@/lib/config';

import { useCallback } from 'react';

const API_BASE_URL =
    getApiBaseUrl();

interface CaptchaData {
    bgUrl: string;
    puzzleUrl: string;
    id?: string;
}

interface VerifyResult {
    success: boolean;
    token?: string;
    message: string;
}

export interface CaptchaConfig {
    enabled: boolean;
    type: string;
    expireTime: number;
    tolerance: number;
    maxAttempts: number;
    enableTrailVerify: boolean;
    loginRequired: boolean;
    registerRequired: boolean;
    resetPasswordRequired: boolean;
}

let currentCaptchaId: string | null = null;

export function useCaptcha() {
    const generateCaptcha = useCallback(
        async (): Promise<CaptchaData> => {
            const res = await fetch(
                `${API_BASE_URL}/captcha/generate`,
            );
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json.message || '获取验证码失败');
            }
            const data = json.data?.data || json.data;
            currentCaptchaId = data.id || null;
            return {
                bgUrl: data.bgUrl,
                puzzleUrl: data.puzzleUrl,
            };
        },
        [],
    );

    const verifyCaptcha = useCallback(
        async (params: {
            x: number;
            y: number;
            sliderOffsetX: number;
            duration: number;
            trail: { x: number[]; y: number[] };
        }): Promise<VerifyResult> => {
            if (!currentCaptchaId) {
                return {
                    success: false,
                    message: '验证码未生成',
                };
            }
            const res = await fetch(
                `${API_BASE_URL}/captcha/verify`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        id: currentCaptchaId,
                        x: params.x,
                        trail: params.trail,
                    }),
                },
            );
            const json = await res.json();
            // 响应结构: {success, data: {code, message, data: {token}}}
            const wrapper = json.data;
            if (
                wrapper?.code === 200 &&
                wrapper?.data?.token
            ) {
                return {
                    success: true,
                    token: wrapper.data.token,
                    message:
                        wrapper.message || '验证成功',
                };
            }
            return {
                success: false,
                message:
                    wrapper?.message || '验证失败',
            };
        },
        [],
    );

    const verifyToken = useCallback(
        async (token: string): Promise<boolean> => {
            const res = await fetch(
                `${API_BASE_URL}/captcha/verify-token`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token }),
                },
            );
            const json = await res.json();
            const data = json.data?.data || json.data;
            return data?.valid === true;
        },
        [],
    );

    const getCaptchaConfig = useCallback(
        async (): Promise<CaptchaConfig> => {
            const res = await fetch(
                `${API_BASE_URL}/captcha/config`,
            );
            const json = await res.json();
            const data = json.data?.data || json.data;
            return data as CaptchaConfig;
        },
        [],
    );

    return {
        generateCaptcha,
        verifyCaptcha,
        verifyToken,
        getCaptchaConfig,
    };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { User, LoginRequest, ChangePasswordRequest } from '@/types/auth';
import { toast } from 'sonner';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const maybePromptCompleteProfile = useCallback((u: User) => {
    if (typeof window === 'undefined') return;
    const key = `profilePrompted:${u.id}`;
    if (localStorage.getItem(key)) return;

    const placeholderEmail = !!u.email && u.email.endsWith('@bnoa.local');
    const nameIsDefault = !u.name || u.name === u.username;
    const missingPhone = !u.phone;
    if (!placeholderEmail && !nameIsDefault && !missingPhone) return;

    localStorage.setItem(key, '1');
    toast.info('请完善个人信息', {
      description: '建议补充邮箱、姓名、手机号，便于后续通知与找回账号。',
    });
  }, []);

  // 初始化时检查登录状态
  useEffect(() => {
    const initAuth = async () => {
      if (apiClient.isAuthenticated()) {
        try {
          const userData = await apiClient.getCurrentUser();
          setUser(userData);
          maybePromptCompleteProfile(userData);
        } catch (err) {
          // Token 无效，清除登录状态
          apiClient.clearTokens();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [maybePromptCompleteProfile]);

  const login = useCallback(async (credentials: LoginRequest) => {
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.login(credentials);
      setUser(response.user);
      maybePromptCompleteProfile(response.user);
      return response;
    } catch (err: any) {
      setError(err.message || '登录失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [maybePromptCompleteProfile]);

  const logout = useCallback(async () => {
    setLoading(true);

    try {
      await apiClient.logout();
    } finally {
      setUser(null);
      setLoading(false);
      router.push('/login');
    }
  }, [router]);

  const changePassword = useCallback(async (data: ChangePasswordRequest) => {
    setError(null);
    setLoading(true);

    try {
      await apiClient.changePassword(data);
    } catch (err: any) {
      setError(err.message || '修改密码失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
      return userData;
    } catch (err) {
      throw err;
    }
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    changePassword,
    refreshUser,
  };
}

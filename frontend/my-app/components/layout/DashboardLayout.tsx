'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { apiClient } from '@/lib/api';
import type { User } from '@/types/auth';
import { Loader2 } from 'lucide-react';
import { UploadQueueProvider } from '@/contexts/UploadQueueContext';
import { usePermissionStore } from '@/lib/stores/permission-store';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// 路由与所需权限的映射（仅管理类路由需要权限检查）
const routePermissionMap: Record<string, string> = {
    '/users': 'user:list',
    '/roles': 'role:list',
    '/permissions': 'permission:list',
    '/settings': 'config:list',
    '/settings/file-storage': 'config:list',
    '/settings/upload-security': 'security:config',
    '/audit-logs': 'audit:list',
    '/security': 'security:events',
    '/security/scan-review': 'security:scan-review',
    '/security/events': 'security:events',
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setPermissions, hasPermission, loaded: permLoaded } =
      usePermissionStore();

  useEffect(() => {
    // 检查登录状态
    const checkAuth = async () => {
      if (!apiClient.isAuthenticated()) {
        router.push('/login');
        return;
      }

      try {
        const userData = await apiClient.getCurrentUser();
        setUser(userData);
        // 初始化权限 Store
        setPermissions(
            userData.permissions || [],
            userData.roles.map((r) => r.code),
        );
      } catch (err) {
        // Token 无效，跳转到登录页
        apiClient.clearTokens();
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, setPermissions]);

  // 路由级权限保护
  useEffect(() => {
    if (!permLoaded || loading) return;

    const requiredPermission = routePermissionMap[pathname];
    if (requiredPermission && !hasPermission(requiredPermission)) {
      router.replace('/403');
    }
  }, [pathname, permLoaded, loading, hasPermission, router]);

  // 从 localStorage 恢复侧边栏状态
  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved) {
      setSidebarCollapsed(saved === 'true');
    }
  }, []);

  const handleSidebarToggle = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <UploadQueueProvider>
      <div className="min-h-screen bg-background">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} />

        {/* Main Content */}
        <div
          className="transition-all duration-300 ease-in-out"
          style={{
            marginLeft: sidebarCollapsed ? '64px' : '256px',
          }}
        >
          {/* Header */}
          <Header user={user} />

          {/* Page Content */}
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
      {/* FloatingUploadQueue 由 UploadQueueProvider 自动渲染 */}
    </UploadQueueProvider>
  );
}

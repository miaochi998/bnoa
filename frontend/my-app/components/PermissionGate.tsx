'use client';

import { usePermissionStore } from '@/lib/stores/permission-store';

interface PermissionGateProps {
    /** 单个权限编码 */
    permission?: string;
    /** 多个权限编码 */
    permissions?: string[];
    /** 匹配模式：any=任一即可，all=全部需要 */
    mode?: 'any' | 'all';
    /** 无权限时的备选内容 */
    fallback?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * 权限门控组件
 * 根据用户权限决定是否渲染子组件
 */
export function PermissionGate({
    permission,
    permissions,
    mode = 'any',
    fallback = null,
    children,
}: PermissionGateProps) {
    const store = usePermissionStore();

    if (!store.loaded) return null;

    const codes = permission
        ? [permission]
        : permissions || [];

    if (codes.length === 0) return <>{children}</>;

    const hasAccess = mode === 'all'
        ? store.hasAllPermissions(...codes)
        : store.hasAnyPermission(...codes);

    return hasAccess ? <>{children}</> : <>{fallback}</>;
}

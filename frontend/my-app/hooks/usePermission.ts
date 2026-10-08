'use client';

import { usePermissionStore } from '@/lib/stores/permission-store';

/**
 * 权限检查 Hook
 * 提供便捷的权限判断方法
 */
export function usePermission() {
    const {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isSuperAdmin,
        permissions,
        loaded,
    } = usePermissionStore();

    return {
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isSuperAdmin,
        permissions,
        loaded,
    };
}

import { create } from 'zustand';

interface PermissionState {
    permissions: string[];
    roles: string[];
    isSuperAdmin: boolean;
    loaded: boolean;

    setPermissions: (permissions: string[], roles: string[]) => void;
    hasPermission: (code: string) => boolean;
    hasAnyPermission: (...codes: string[]) => boolean;
    hasAllPermissions: (...codes: string[]) => boolean;
    clear: () => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
    permissions: [],
    roles: [],
    isSuperAdmin: false,
    loaded: false,

    setPermissions: (permissions: string[], roles: string[]) => {
        const isSuperAdmin = permissions.includes('*');
        set({ permissions, roles, isSuperAdmin, loaded: true });
    },

    hasPermission: (code: string) => {
        const { isSuperAdmin, permissions } = get();
        if (isSuperAdmin) return true;
        return permissions.includes(code);
    },

    hasAnyPermission: (...codes: string[]) => {
        const { isSuperAdmin, permissions } = get();
        if (isSuperAdmin) return true;
        return codes.some((code) => permissions.includes(code));
    },

    hasAllPermissions: (...codes: string[]) => {
        const { isSuperAdmin, permissions } = get();
        if (isSuperAdmin) return true;
        return codes.every((code) => permissions.includes(code));
    },

    clear: () => {
        set({
            permissions: [],
            roles: [],
            isSuperAdmin: false,
            loaded: false,
        });
    },
}));

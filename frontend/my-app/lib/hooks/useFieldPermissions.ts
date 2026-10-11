'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';

export interface FieldPermissionInfo {
  /** 是否已加载完成；未加载时 canView 一律返回 false（避免敏感字段闪现） */
  loaded: boolean;
  isSuperAdmin: boolean;
  /** 该字段是否可见 */
  canView: (field: string) => boolean;
  /** 该字段是否可编辑 */
  canEdit: (field: string) => boolean;
}

type ModulePermission = {
  canView: string[];
  canEdit: string[];
  isSuperAdmin: boolean;
};

/** 模块级缓存，避免同一模块多次请求 */
const cache = new Map<string, ModulePermission>();
const inflight = new Map<string, Promise<ModulePermission>>();

async function fetchModulePermissions(module: string): Promise<ModulePermission> {
  const cached = cache.get(module);
  if (cached) return cached;
  const existing = inflight.get(module);
  if (existing) return existing;
  const p = apiClient
    .getMyFieldPermissions(module)
    .then((d) => {
      const value: ModulePermission = {
        canView: d?.canView ?? [],
        canEdit: d?.canEdit ?? [],
        isSuperAdmin: !!d?.isSuperAdmin,
      };
      cache.set(module, value);
      inflight.delete(module);
      return value;
    })
    .catch(() => {
      inflight.delete(module);
      // 接口异常时按「不可见、不可编辑」兜底（fail-closed）。
      // 注意：绝不能把 isSuperAdmin 置为 true —— canView/canEdit 都带
      // `state.isSuperAdmin || ...` 短路，置 true 等于放开该模块所有敏感字段。
      const fallback: ModulePermission = {
        canView: [],
        canEdit: [],
        isSuperAdmin: false,
      };
      cache.set(module, fallback);
      return fallback;
    });
  inflight.set(module, p);
  return p;
}

/** 清除缓存（角色权限变更后调用） */
export function clearFieldPermissionCache(module?: string) {
  if (module) {
    cache.delete(module);
    inflight.delete(module);
  } else {
    cache.clear();
    inflight.clear();
  }
}

/**
 * 读取当前登录用户在指定模块的字段权限
 *
 * 用法：
 *   const fp = useFieldPermissions('supplier');
 *   {fp.canView('phone') && <span>{row.phone}</span>}
 *   {fp.canEdit('phone') && <EditButton />}
 */
export function useFieldPermissions(module: string): FieldPermissionInfo {
  const [state, setState] = useState<ModulePermission | null>(
    () => cache.get(module) ?? null,
  );

  useEffect(() => {
    let alive = true;
    const cached = cache.get(module);
    if (cached) {
      setState(cached);
      return;
    }
    fetchModulePermissions(module).then((v) => {
      if (alive) setState(v);
    });
    return () => {
      alive = false;
    };
  }, [module]);

  return useMemo<FieldPermissionInfo>(() => {
    if (!state) {
      return {
        loaded: false,
        isSuperAdmin: false,
        canView: () => false,
        canEdit: () => false,
      };
    }
    return {
      loaded: true,
      isSuperAdmin: state.isSuperAdmin,
      canView: (field: string) =>
        state.isSuperAdmin || state.canView.includes(field),
      canEdit: (field: string) =>
        state.isSuperAdmin || state.canEdit.includes(field),
    };
  }, [state]);
}

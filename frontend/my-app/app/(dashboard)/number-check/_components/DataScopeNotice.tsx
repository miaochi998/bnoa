'use client';

/**
 * 数据范围（dataScope）轻量提示
 *
 * 后端 `/field-permissions/me?module=xxx` 会返回当前用户在该模块的数据范围
 * （ALL / OWN_SHOP / OWN_CREATED，见 backend field-permission.service.ts）。
 * 数据本身**已由后端过滤**，前端只负责解释「为什么数据变少了」——
 * 这里只做提示，绝不在前端二次过滤。
 */

import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { apiClient } from '@/lib/api';

const SCOPE_TEXT: Record<string, string> = {
  OWN_SHOP: '当前仅显示你负责的店铺的数据',
  OWN_CREATED: '当前仅显示你提交的数据',
};

/** 模块级缓存，避免同一模块重复请求 */
const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function fetchDataScope(module: string): Promise<string> {
  const cached = cache.get(module);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(module);
  if (existing) return existing;
  const p = apiClient
    .getMyFieldPermissions(module)
    .then((d) => {
      // ⚠️ apiClient 的返回类型尚未声明 dataScope（shared lib 不在本次改动范围），此处按后端实际返回断言
      const scope = (d as unknown as { dataScope?: string } | null)?.dataScope || 'ALL';
      cache.set(module, scope);
      inflight.delete(module);
      return scope;
    })
    .catch(() => {
      inflight.delete(module);
      // 拿不到就不提示，避免误报
      return '';
    });
  inflight.set(module, p);
  return p;
}

/** 清除缓存（切换账号/角色权限变更后调用） */
export function clearDataScopeCache(module?: string) {
  if (module) {
    cache.delete(module);
    inflight.delete(module);
  } else {
    cache.clear();
    inflight.clear();
  }
}

export function DataScopeNotice({ module }: { module: string }) {
  const [scope, setScope] = useState<string>(() => cache.get(module) ?? '');

  useEffect(() => {
    let alive = true;
    fetchDataScope(module).then((v) => {
      if (alive) setScope(v);
    });
    return () => {
      alive = false;
    };
  }, [module]);

  if (!scope || scope === 'ALL') return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-[#409fff]/30 bg-[#409fff]/5 px-3 py-2 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 shrink-0 text-[#409fff]" />
      <span>{SCOPE_TEXT[scope] || '当前仅显示你负责的数据'}</span>
    </div>
  );
}

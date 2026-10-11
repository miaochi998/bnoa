/**
 * 权限模块分类与排序（**仅影响权限配置页的展示分组与顺序，不影响任何鉴权逻辑**）
 *
 * 用户确认的分类方案（2026-10-11）：
 *   概览 → 业务类 → 工具类 → 系统类
 * 新增模块若未登记在此表中，会落到「系统类」最后（order = 99），不会被隐藏。
 */
export type PermissionCategory = 'dashboard' | 'business' | 'tool' | 'system';

export const PERMISSION_CATEGORY_LABELS: Record<PermissionCategory, string> = {
  dashboard: '概览',
  business: '业务类',
  tool: '工具类',
  system: '系统类',
};

/** 分类展示顺序 */
export const PERMISSION_CATEGORY_ORDER: PermissionCategory[] = [
  'dashboard',
  'business',
  'tool',
  'system',
];

/** 顶层模块菜单码 → { 分类, 组内顺序 } */
export const PERMISSION_CATEGORY_MAP: Record<
  string,
  { category: PermissionCategory; order: number }
> = {
  // ---------- 概览 ----------
  'dashboard:view': { category: 'dashboard', order: 1 },

  // ---------- 业务类 ----------
  'product-link:view': { category: 'business', order: 1 },
  'sku:view': { category: 'business', order: 2 },
  'pricing:view': { category: 'business', order: 3 },
  'profit:view': { category: 'business', order: 4 },
  'purchase:view': { category: 'business', order: 5 },
  'payment:view': { category: 'business', order: 6 },
  'supplier:view': { category: 'business', order: 7 },
  'product:view': { category: 'business', order: 8 },
  'finished-product:view': { category: 'business', order: 9 },
  'consumable-supplier:view': { category: 'business', order: 10 },
  'consumable:view': { category: 'business', order: 11 },
  'platform:view': { category: 'business', order: 12 },
  'shop:view': { category: 'business', order: 13 },
  'express:view': { category: 'business', order: 14 },
  'labor:view': { category: 'business', order: 15 },
  'talent:view': { category: 'business', order: 16 },

  // ---------- 工具类 ----------
  'notebook:view': { category: 'tool', order: 1 },
  'number-check:view': { category: 'tool', order: 2 },

  // ---------- 系统类 ----------
  'system:config': { category: 'system', order: 1 },
  'user:manage': { category: 'system', order: 2 },
  'permission:manage': { category: 'system', order: 3 },
  'role:manage': { category: 'system', order: 4 },
  'file-storage:manage': { category: 'system', order: 5 },
  'file:manage': { category: 'system', order: 6 },
  'backup:view': { category: 'system', order: 7 },
  'upgrade:view': { category: 'system', order: 8 },
  'security:manage': { category: 'system', order: 9 },
  'captcha:manage': { category: 'system', order: 10 },
  'ai-model:manage': { category: 'system', order: 11 },
  'notebook:manage': { category: 'system', order: 12 },
  'email:manage': { category: 'system', order: 13 },
  'notification:manage': { category: 'system', order: 14 },
  'dictionary:manage': { category: 'system', order: 15 },
  'export-import:manage': { category: 'system', order: 16 },
  'audit:view': { category: 'system', order: 17 },
  'task:manage': { category: 'system', order: 18 },
};

/** 取某权限码的分类信息（未登记的一律归到系统类末尾） */
export function getPermissionCategory(code: string): {
  category: PermissionCategory;
  order: number;
} {
  return (
    PERMISSION_CATEGORY_MAP[code] ?? { category: 'system', order: 99 }
  );
}

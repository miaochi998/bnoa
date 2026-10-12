-- 清理「僵尸权限码」：界面上能勾选、但后端与前端都不校验的权限码
--
-- 背景（2026-10-12）：权限配置界面从 permissions 表读取全部权限码，而代码实际校验的
-- 是另一批码。经三方比对（后端 @Permissions 181 个 ∩ 前端使用 137 个 ∩ 库 249 个），
-- 有 60 个码「谁都不用」——勾了完全无效，严重误导管理员
-- （例 2026-10-12 生产实测：管理员取消『管理附加费用』无效，因为该接口当时校验的是
--  「编辑快递公司」）。
--
-- 本迁移只删除其中的**叶子节点**：仍被其它在用权限码当作 parent 的「分组父节点」
-- （如 user:manage / role:manage / permission:manage / security:manage / task:manage /
--   dashboard:view）一律保留 —— 它们是权限树的层级结构，删掉会让子权限散落到顶层。
--
-- 安全性：
--   1. 这些码不被任何代码校验，删除不改变任何接口的鉴权结果；
--   2. permissions.parent_id 外键为 ON DELETE SET NULL，不会级联删除子码；
--      role_permissions.permission_id 为 ON DELETE CASCADE，但删的都是不生效的码，
--      对应角色关联一并清理符合预期；
--   3. 幂等，可重复执行；
--   4. 若将来某个码重新被启用，在 permission-definitions.ts 中声明后，
--      执行 POST /permissions/sync 即可自动重建。
--
-- 多次执行同一语句以实现「自底向上」逐层清理（子码删除后，其父码若也在名单中且已无
-- 子码，则下一遍被删除）。

-- 自底向上：只删除「当前没有任何子码」的僵尸权限码（保留仍承担分组作用的父节点）
DELETE FROM permissions
WHERE code IN (
      'admin:access',
      'ai-model:list',
      'ai-model:view',
      'audit:detail',
      'audit:export',
      'captcha:detail',
      'captcha:view',
      'config:list',
      'config:view',
      'consumable-supplier:detail',
      'consumable-supplier:list',
      'consumable-supplier:view',
      'consumable:detail',
      'consumable:list',
      'dashboard:view',
      'dictionary:list',
      'dictionary:view',
      'email:config',
      'email:log',
      'email:template',
      'email:view',
      'export-import:task-list',
      'export-import:view',
      'express:detail',
      'express:list',
      'file-storage:detail',
      'file-storage:view',
      'file:view',
      'finished-product:consumable',
      'finished-product:detail',
      'finished-product:labor',
      'finished-product:list',
      'labor:detail',
      'labor:list',
      'notification:view',
      'permission:manage',
      'permission:view',
      'platform:detail',
      'platform:list',
      'role:assign-to-user',
      'role:manage',
      'security:acknowledge',
      'security:manage',
      'security:view',
      'shop:detail',
      'shop:list',
      'sku:detail',
      'sku:finished-product',
      'sku:list',
      'supplier:detail',
      'supplier:list',
      'talent:transfer',
      'task:manage',
      'task:view',
      'upgrade:check',
      'upgrade:execute',
      'upgrade:info',
      'user:activate',
      'user:manage',
      'user:reset-password'
    )
  AND id NOT IN (
    SELECT DISTINCT parent_id FROM permissions WHERE parent_id IS NOT NULL
  );

-- 第二遍（清理因上一遍删掉子码而新变成叶子的父节点）
-- 自底向上：只删除「当前没有任何子码」的僵尸权限码（保留仍承担分组作用的父节点）
DELETE FROM permissions
WHERE code IN (
      'admin:access',
      'ai-model:list',
      'ai-model:view',
      'audit:detail',
      'audit:export',
      'captcha:detail',
      'captcha:view',
      'config:list',
      'config:view',
      'consumable-supplier:detail',
      'consumable-supplier:list',
      'consumable-supplier:view',
      'consumable:detail',
      'consumable:list',
      'dashboard:view',
      'dictionary:list',
      'dictionary:view',
      'email:config',
      'email:log',
      'email:template',
      'email:view',
      'export-import:task-list',
      'export-import:view',
      'express:detail',
      'express:list',
      'file-storage:detail',
      'file-storage:view',
      'file:view',
      'finished-product:consumable',
      'finished-product:detail',
      'finished-product:labor',
      'finished-product:list',
      'labor:detail',
      'labor:list',
      'notification:view',
      'permission:manage',
      'permission:view',
      'platform:detail',
      'platform:list',
      'role:assign-to-user',
      'role:manage',
      'security:acknowledge',
      'security:manage',
      'security:view',
      'shop:detail',
      'shop:list',
      'sku:detail',
      'sku:finished-product',
      'sku:list',
      'supplier:detail',
      'supplier:list',
      'talent:transfer',
      'task:manage',
      'task:view',
      'upgrade:check',
      'upgrade:execute',
      'upgrade:info',
      'user:activate',
      'user:manage',
      'user:reset-password'
    )
  AND id NOT IN (
    SELECT DISTINCT parent_id FROM permissions WHERE parent_id IS NOT NULL
  );

-- 第三遍（兜底）
-- 自底向上：只删除「当前没有任何子码」的僵尸权限码（保留仍承担分组作用的父节点）
DELETE FROM permissions
WHERE code IN (
      'admin:access',
      'ai-model:list',
      'ai-model:view',
      'audit:detail',
      'audit:export',
      'captcha:detail',
      'captcha:view',
      'config:list',
      'config:view',
      'consumable-supplier:detail',
      'consumable-supplier:list',
      'consumable-supplier:view',
      'consumable:detail',
      'consumable:list',
      'dashboard:view',
      'dictionary:list',
      'dictionary:view',
      'email:config',
      'email:log',
      'email:template',
      'email:view',
      'export-import:task-list',
      'export-import:view',
      'express:detail',
      'express:list',
      'file-storage:detail',
      'file-storage:view',
      'file:view',
      'finished-product:consumable',
      'finished-product:detail',
      'finished-product:labor',
      'finished-product:list',
      'labor:detail',
      'labor:list',
      'notification:view',
      'permission:manage',
      'permission:view',
      'platform:detail',
      'platform:list',
      'role:assign-to-user',
      'role:manage',
      'security:acknowledge',
      'security:manage',
      'security:view',
      'shop:detail',
      'shop:list',
      'sku:detail',
      'sku:finished-product',
      'sku:list',
      'supplier:detail',
      'supplier:list',
      'talent:transfer',
      'task:manage',
      'task:view',
      'upgrade:check',
      'upgrade:execute',
      'upgrade:info',
      'user:activate',
      'user:manage',
      'user:reset-password'
    )
  AND id NOT IN (
    SELECT DISTINCT parent_id FROM permissions WHERE parent_id IS NOT NULL
  );

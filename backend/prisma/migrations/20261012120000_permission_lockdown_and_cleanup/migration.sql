-- =============================================================================
-- 权限系统收尾修复（2026-10-12）
--
-- 目标（全部幂等、可重复执行、**不触碰任何业务数据**）：
--   1. 新增两个权限码：content-version:manage、ai:use
--   2. **先授权再挂锁**：把新码授予现有非超管角色，避免升级后用户被锁在门外
--   3. 修正权限码元数据（父级漂移 / 类型不一致）
--   4. 收回过宽授权：purchase:manage、consumable-supplier 写码 从普通用户角色收回
--   5. 清理 19 个废弃权限码（历史迁移 20260308000000_sync_permissions 会回灌它们，
--      导致「定义数 == 数据库数」永远不成立）
--   6. 清理字段权限脏数据（注册表已改名的残留）
--
-- 只删除「权限定义/授权关联/字段权限配置」三类元数据行，
-- 不涉及 files / folders / users / 业务表，不存在清空业务数据的风险。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 新增权限码
--    注意：permissions.id 是 text、updated_at 无默认值，必须显式给出
-- -----------------------------------------------------------------------------
INSERT INTO "permissions" ("id","name","code","type","description","parent_id","sort_order","is_active","created_at","updated_at")
SELECT gen_random_uuid()::text, '内容版本管理', 'content-version:manage', 'BUTTON',
       '保存/恢复/删除内容版本历史', NULL, 0, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'content-version:manage');

INSERT INTO "permissions" ("id","name","code","type","description","parent_id","sort_order","is_active","created_at","updated_at")
SELECT gen_random_uuid()::text, '使用 AI 生成', 'ai:use', 'BUTTON',
       '调用 AI 生成/润色内容', NULL, 0, true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'ai:use');

-- -----------------------------------------------------------------------------
-- 2. 先授权：把新码授予现有角色（super_admin 由守卫豁免，无需授权）
--    content-version:manage —— 富文本编辑器的版本历史属基础编辑能力
--    ai:use               —— AI 助手属业务功能，先给现有可编辑内容的角色
--    （若某环境没有这些角色，CROSS JOIN 结果为空，不会报错）
-- -----------------------------------------------------------------------------
INSERT INTO "role_permissions" ("role_id","permission_id","data_scope","created_at")
SELECT r."id", p."id", NULL, NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('operator','user')
  AND r."deleted_at" IS NULL
  AND p."code" = 'content-version:manage'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );

INSERT INTO "role_permissions" ("role_id","permission_id","data_scope","created_at")
SELECT r."id", p."id", NULL, NOW()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" IN ('operator','user')
  AND r."deleted_at" IS NULL
  AND p."code" = 'ai:use'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );

-- -----------------------------------------------------------------------------
-- 3. 元数据修正
-- -----------------------------------------------------------------------------
-- 3.1 耗材供应商写码挂到「耗材管理」菜单下（原先挂在零授予的 consumable-supplier:view 下，
--     导致「有写权限却看不到入口」；同时 Sidebar 本来就用 consumable:view）
UPDATE "permissions"
SET "parent_id" = (SELECT "id" FROM "permissions" WHERE "code" = 'consumable:view'),
    "updated_at" = NOW()
WHERE "code" IN ('consumable-supplier:create','consumable-supplier:update','consumable-supplier:delete')
  AND EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'consumable:view');

-- 3.2 supplier:product 是纯只读接口用码，类型由 BUTTON 纠正为 API
UPDATE "permissions" SET "type" = 'API', "updated_at" = NOW()
WHERE "code" = 'supplier:product' AND "type" <> 'API';

-- 3.3 backup:config 原来一码两义（GET 读 + PUT 写）：改为只表示「更新」，
--     读取改用 backup:view（代码已同步调整）
UPDATE "permissions"
SET "type" = 'BUTTON', "name" = '更新备份配置',
    "description" = '更新备份配置（读取请用 backup:view）', "updated_at" = NOW()
WHERE "code" = 'backup:config';

-- 3.4 export-import:manage 的层级漂移：定义里 parentCode = system:config，DB 却是 NULL
UPDATE "permissions"
SET "parent_id" = (SELECT "id" FROM "permissions" WHERE "code" = 'system:config'),
    "updated_at" = NOW()
WHERE "code" = 'export-import:manage'
  AND "parent_id" IS NULL
  AND EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'system:config');

-- -----------------------------------------------------------------------------
-- 4. 收回过宽授权（安全收紧；只删授权关联，不动角色本身）
-- -----------------------------------------------------------------------------
-- 4.1 purchase:manage 语义是「可修改/删除他人提交的入库记录」，
--     不应授予普通用户角色（否则 7 名非管理员都能改删他人入库单）
DELETE FROM "role_permissions"
WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "code" = 'user')
  AND "permission_id" IN (SELECT "id" FROM "permissions" WHERE "code" = 'purchase:manage');

-- 4.2 耗材供应商的写码从普通用户角色收回（该角色连耗材供应商菜单都看不到）
DELETE FROM "role_permissions"
WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "code" = 'user')
  AND "permission_id" IN (
    SELECT "id" FROM "permissions"
    WHERE "code" IN ('consumable-supplier:create','consumable-supplier:update','consumable-supplier:delete')
  );

-- -----------------------------------------------------------------------------
-- 5. 清理废弃权限码
--    这 19 个码当前定义（permission-definitions.ts）已不存在、代码也不使用，
--    但历史迁移 20260308000000_sync_permissions 会把它们插回任何新库，
--    导致权限页出现「勾了不生效」的空转码、且「定义数 == 数据库数」永久不成立。
-- -----------------------------------------------------------------------------
DELETE FROM "role_permissions"
WHERE "permission_id" IN (
  SELECT "id" FROM "permissions" WHERE "code" IN (
    'notebook:list','notebook:detail',
    'product:list','product:detail',
    'product-link:list','product-link:detail',
    'pricing:list','pricing:detail','pricing:calculate',
    'profit:list','profit:detail','profit:expense','profit:allocation',
    'talent:list','talent:detail','talent:contact','talent:contact-edit',
    'talent:contact-delete','talent:transfer-money'
  )
);

DELETE FROM "permissions"
WHERE "code" IN (
  'notebook:list','notebook:detail',
  'product:list','product:detail',
  'product-link:list','product-link:detail',
  'pricing:list','pricing:detail','pricing:calculate',
  'profit:list','profit:detail','profit:expense','profit:allocation',
  'talent:list','talent:detail','talent:contact','talent:contact-edit',
  'talent:contact-delete','talent:transfer-money'
);

-- -----------------------------------------------------------------------------
-- 6. 清理字段权限脏数据（注册表改名前留下的记录，界面看不到也删不掉）
-- -----------------------------------------------------------------------------
DELETE FROM "role_field_permissions"
WHERE ("module" = 'role' AND "field" = 'isActive')
   OR ("module" = 'system' AND "field" = 'group');

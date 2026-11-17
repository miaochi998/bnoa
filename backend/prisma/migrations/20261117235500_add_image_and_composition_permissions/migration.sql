-- A 批：图片字段 + 成本组成查看权限
--
-- 背景（2026-11-17）：
--   1) 成品、工费新增图片字段（files.id）；
--   2) 新增 3 个细粒度查看权限码：
--        consumable-supplier:consumables  查看耗材供应商关联耗材
--        finished-product:composition    查看成品成本组成
--        sku:composition                 查看 SKU 成本组成
--   3) 权限码必须先在迁移内插入，再授权；否则发版时 migrate deploy 先于
--      POST /permissions/sync 执行，授权语句匹配不到新码会静默插入 0 行。
--
-- 幂等：permissions.code 唯一 + NOT EXISTS；role_permissions 主键冲突忽略。

-- 1) 图片字段
ALTER TABLE "finished_products" ADD COLUMN     "image" UUID;

ALTER TABLE "labor_types" ADD COLUMN     "image" UUID;

-- 2) 权限码
INSERT INTO "permissions" ("id","name","code","description","type","parent_id","sort_order","is_active","created_at","updated_at")
SELECT gen_random_uuid()::text, '查看耗材供应商关联耗材', 'consumable-supplier:consumables',
       '查看某耗材供应商当前供货的耗材及其全部供货商价格', 'API',
       (SELECT "id" FROM "permissions" WHERE "code" = 'consumable:view'),
       100, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'consumable-supplier:consumables');

INSERT INTO "permissions" ("id","name","code","description","type","parent_id","sort_order","is_active","created_at","updated_at")
SELECT gen_random_uuid()::text, '查看成品成本组成', 'finished-product:composition',
       '查看成品的材料/耗材/工费明细与金额', 'API',
       (SELECT "id" FROM "permissions" WHERE "code" = 'finished-product:view'),
       100, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'finished-product:composition');

INSERT INTO "permissions" ("id","name","code","description","type","parent_id","sort_order","is_active","created_at","updated_at")
SELECT gen_random_uuid()::text, '查看SKU成本组成', 'sku:composition',
       '查看 SKU 的成品/耗材/工费/快递等成本明细', 'API',
       (SELECT "id" FROM "permissions" WHERE "code" = 'sku:view'),
       100, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "permissions" WHERE "code" = 'sku:composition');

-- 3) 授权给已持有对应模块查看权限的角色（只补齐，不扩大范围）
INSERT INTO "role_permissions" ("role_id","permission_id","data_scope","created_at")
SELECT rp."role_id", np."id", NULL, now()
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id" AND op."code" = 'consumable:view'
CROSS JOIN "permissions" np
WHERE np."code" = 'consumable-supplier:consumables'
ON CONFLICT ("role_id","permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id","permission_id","data_scope","created_at")
SELECT rp."role_id", np."id", NULL, now()
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id" AND op."code" = 'finished-product:view'
CROSS JOIN "permissions" np
WHERE np."code" = 'finished-product:composition'
ON CONFLICT ("role_id","permission_id") DO NOTHING;

INSERT INTO "role_permissions" ("role_id","permission_id","data_scope","created_at")
SELECT rp."role_id", np."id", NULL, now()
FROM "role_permissions" rp
JOIN "permissions" op ON op."id" = rp."permission_id" AND op."code" = 'sku:view'
CROSS JOIN "permissions" np
WHERE np."code" = 'sku:composition'
ON CONFLICT ("role_id","permission_id") DO NOTHING;

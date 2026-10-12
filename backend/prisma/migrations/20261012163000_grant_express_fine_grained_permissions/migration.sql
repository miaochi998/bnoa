-- 快递管理权限精细化：补授权迁移
--
-- 背景（2026-10-12）：
--   附加费增删改（POST/PATCH/DELETE .../surcharges）过去校验的是
--   `express:update`（编辑快递公司）；分区编辑（PATCH zones/:id、
--   PATCH companies/:id/zones/batch）同样借用 `express:update`；
--   重量区间编辑（PATCH weight-ranges/:id）借用 `express:price`（管理快递价格）。
--
--   这造成「界面上的『管理附加费用』勾了没用、必须取消『编辑快递公司』才有效」
--   的误导（`express:surcharge` 等码在代码里从未被校验）。
--
--   本次把这些接口改为校验各自语义正确的细粒度权限码：
--     express:surcharge（管理附加费用）/ express:zone（管理快递分区）
--     / express:weight（管理重量区间）
--
-- 本迁移的作用：
--   把上述细粒度权限码**补授权**给原本"借用"粗粒度码的角色，
--   确保「原本能做这些操作的角色，升级后依然能做」——
--   只补齐既有能力，不扩大任何角色的权限范围。
--
-- 幂等：主键 (role_id, permission_id) 上 ON CONFLICT DO NOTHING，可重复执行。
-- 说明：若某环境的 permissions 表尚无这些码（例如空库先跑迁移、后跑权限同步），
--       下面的子查询匹配不到，语句不会插入任何行，也不会报错。

-- 1) 原持有「编辑快递公司」（express:update）的角色 → 补「管理附加费用」
INSERT INTO role_permissions (role_id, permission_id, data_scope, created_at)
SELECT rp.role_id, np.id, NULL, now()
FROM role_permissions rp
JOIN permissions op ON op.id = rp.permission_id AND op.code = 'express:update'
CROSS JOIN permissions np
WHERE np.code = 'express:surcharge'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 2) 原持有「编辑快递公司」（express:update）的角色 → 补「管理快递分区」
INSERT INTO role_permissions (role_id, permission_id, data_scope, created_at)
SELECT rp.role_id, np.id, NULL, now()
FROM role_permissions rp
JOIN permissions op ON op.id = rp.permission_id AND op.code = 'express:update'
CROSS JOIN permissions np
WHERE np.code = 'express:zone'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3) 原持有「管理快递价格」（express:price）的角色 → 补「管理重量区间」
INSERT INTO role_permissions (role_id, permission_id, data_scope, created_at)
SELECT rp.role_id, np.id, NULL, now()
FROM role_permissions rp
JOIN permissions op ON op.id = rp.permission_id AND op.code = 'express:price'
CROSS JOIN permissions np
WHERE np.code = 'express:weight'
ON CONFLICT (role_id, permission_id) DO NOTHING;

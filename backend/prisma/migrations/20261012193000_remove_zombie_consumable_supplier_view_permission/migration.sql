-- 清理僵尸权限码 `consumable-supplier:view`（耗材供应商 MENU 码）
--
-- 背景（2026-10-12，v0.6.6）：
--   该码在 v0.6.4 的 `20261012170000_remove_zombie_permissions` 迁移中**已被列入删除名单**，
--   但此后执行 `POST /permissions/sync` 时被**重新创建**了 —— 原因是 sync 的语义是
--   「按 permission-definitions.ts 只新增/改名、不删除」，而定义文件里仍声明着这个码。
--   实测：测试机该码 created_at = 2026-10-12 08:30（sync 执行时刻），即"删了又被建回来"。
--
--   因此本次修复必须**同时**做两件事，缺一不可：
--     ① 从 `permission-definitions.ts` 与 `permission-categories.ts` 删除声明（本次提交一起改）；
--     ② 用本迁移把库里已存在的记录删掉（否则已升级的库仍残留该码）。
--
-- 为什么可以删（安全性核对，2026-10-12 实测）：
--   1. 全仓三方比对：该码在**后端 @Permissions 与前端 PermissionGate/hasPermission 中均无引用**
--      （前端「耗材供应商」页的菜单入口实际用 `consumable:view`），删除不改变任何接口鉴权结果；
--   2. 该码在定义文件中 parentCode 为 null（顶层 MENU）；三个同名前缀的在用子码
--      （consumable-supplier:create/update/delete）的 parentCode 是 **`consumable:view`**，
--      并非该码 ⇒ 删它不会让任何在用子码失去分组；
--   3. 生产库实测该码下曾挂 `consumable-supplier:list` / `consumable-supplier:detail`
--      （两者同样是僵尸码，已由 v0.6.4 迁移删除）。此处保留「无子码才删」的保护条件：
--      permissions.parent_id 外键为 ON DELETE SET NULL，若真有子码挂靠会使其散落到顶层。
--   4. role_permissions.permission_id 为 ON DELETE CASCADE，角色上的该码关联一并清理（符合预期）；
--   5. 幂等：记录不存在时语句不产生任何变更，可安全重复执行。
--
-- 应用顺序：时间戳晚于 v0.6.4 的迁移 ⇒ 在 v0.6.4 已清理子码的库上，此语句必命中删除。

DELETE FROM permissions
WHERE code = 'consumable-supplier:view'
  AND id NOT IN (
    SELECT DISTINCT parent_id FROM permissions WHERE parent_id IS NOT NULL
  );

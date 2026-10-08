-- Migration: Add missing business module permissions
-- This script adds permissions that may be missing in production environment
-- Run this after upgrading to v0.2.3 or later

-- ==================== 记事本模块 ====================
INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'notebook:list', '查看记事本列表', 'API', '查看记事本列表', (SELECT id FROM "permissions" WHERE code = 'notebook:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'notebook:detail', '查看记事本详情', 'API', '查看记事本详情', (SELECT id FROM "permissions" WHERE code = 'notebook:view'), true)
ON CONFLICT (code) DO NOTHING;

-- ==================== 达人管理模块 ====================
INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'talent:list', '查看达人列表', 'API', '查看达人列表', (SELECT id FROM "permissions" WHERE code = 'talent:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'talent:detail', '查看达人详情', 'API', '查看达人详情', (SELECT id FROM "permissions" WHERE code = 'talent:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'talent:contact', '查看达人联系方式', 'API', '查看达人联系方式', (SELECT id FROM "permissions" WHERE code = 'talent:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'talent:contact-add', '添加联系方式', 'BUTTON', '添加达人联系方式', (SELECT id FROM "permissions" WHERE code = 'talent:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'talent:contact-edit', '编辑联系方式', 'BUTTON', '编辑达人联系方式', (SELECT id FROM "permissions" WHERE code = 'talent:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'talent:contact-delete', '删除联系方式', 'BUTTON', '删除达人联系方式', (SELECT id FROM "permissions" WHERE code = 'talent:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'talent:transfer-money', '达人转账', 'BUTTON', '达人转账操作', (SELECT id FROM "permissions" WHERE code = 'talent:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'talent:flag', '标记达人', 'BUTTON', '标记/取消标记达人', (SELECT id FROM "permissions" WHERE code = 'talent:view'), true)
ON CONFLICT (code) DO NOTHING;

-- ==================== 产品管理模块 ====================
INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'product:list', '查看产品列表', 'API', '查看产品列表', (SELECT id FROM "permissions" WHERE code = 'product:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'product:detail', '查看产品详情', 'API', '查看产品详情', (SELECT id FROM "permissions" WHERE code = 'product:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'product:brands', '获取品牌列表', 'API', '获取品牌列表', (SELECT id FROM "permissions" WHERE code = 'product:view'), true)
ON CONFLICT (code) DO NOTHING;

-- ==================== 链接管理模块 ====================
INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'product-link:list', '查看链接列表', 'API', '查看链接列表', (SELECT id FROM "permissions" WHERE code = 'product-link:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'product-link:detail', '查看链接详情', 'API', '查看链接详情', (SELECT id FROM "permissions" WHERE code = 'product-link:view'), true)
ON CONFLICT (code) DO NOTHING;

-- ==================== 利润报表模块 ====================
INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'profit:list', '查看利润表列表', 'API', '查看利润表列表', (SELECT id FROM "permissions" WHERE code = 'profit:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'profit:detail', '查看利润表详情', 'API', '查看利润表详情', (SELECT id FROM "permissions" WHERE code = 'profit:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'profit:delete', '删除利润表', 'BUTTON', '删除利润表', (SELECT id FROM "permissions" WHERE code = 'profit:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'profit:expense', '管理费用项', 'BUTTON', '管理利润表费用项', (SELECT id FROM "permissions" WHERE code = 'profit:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'profit:allocation', '管理利润分配', 'BUTTON', '管理利润分配方案', (SELECT id FROM "permissions" WHERE code = 'profit:view'), true)
ON CONFLICT (code) DO NOTHING;

-- ==================== 定价计算模块 ====================
INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'pricing:list', '查看定价方案列表', 'API', '查看定价方案列表', (SELECT id FROM "permissions" WHERE code = 'pricing:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'pricing:detail', '查看定价方案详情', 'API', '查看定价方案详情', (SELECT id FROM "permissions" WHERE code = 'pricing:view'), true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'pricing:calculate', '计算定价', 'API', '执行定价计算', (SELECT id FROM "permissions" WHERE code = 'pricing:view'), true)
ON CONFLICT (code) DO NOTHING;

-- ==================== 记事本模块（兼容性） ====================
INSERT INTO "permissions" (id, "created_at", "updated_at", code, name, type, description, "parent_id", "is_active")
VALUES (gen_random_uuid(), NOW(), NOW(), 'notebook:manage', '记事本管理', 'MENU', '记事本管理菜单权限', NULL, true)
ON CONFLICT (code) DO NOTHING;

-- Update parent_id for permissions that may have NULL parent_id
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'notebook:view') WHERE code = 'notebook:list' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'notebook:view') WHERE code = 'notebook:detail' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'talent:view') WHERE code = 'talent:list' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'talent:view') WHERE code = 'talent:detail' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'talent:view') WHERE code = 'talent:contact' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'talent:view') WHERE code = 'talent:contact-add' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'talent:view') WHERE code = 'talent:contact-edit' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'talent:view') WHERE code = 'talent:contact-delete' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'talent:view') WHERE code = 'talent:transfer-money' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'talent:view') WHERE code = 'talent:flag' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'product:view') WHERE code = 'product:list' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'product:view') WHERE code = 'product:detail' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'product:view') WHERE code = 'product:brands' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'product-link:view') WHERE code = 'product-link:list' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'product-link:view') WHERE code = 'product-link:detail' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'profit:view') WHERE code = 'profit:list' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'profit:view') WHERE code = 'profit:detail' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'profit:view') WHERE code = 'profit:delete' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'profit:view') WHERE code = 'profit:expense' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'profit:view') WHERE code = 'profit:allocation' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'pricing:view') WHERE code = 'pricing:list' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'pricing:view') WHERE code = 'pricing:detail' AND "parent_id" IS NULL;
UPDATE "permissions" SET "parent_id" = (SELECT id FROM "permissions" WHERE code = 'pricing:view') WHERE code = 'pricing:calculate' AND "parent_id" IS NULL;

-- Show result
SELECT 'Total permissions after sync:' as info, COUNT(*) as total FROM "permissions";

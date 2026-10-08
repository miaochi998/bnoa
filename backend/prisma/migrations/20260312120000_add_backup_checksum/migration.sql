-- ====================
-- 备份模块增强：为备份记录添加 checksum 字段
-- 安全说明：仅新增可空列，不修改现有数据
-- ====================

-- AlterTable
ALTER TABLE "backup_logs" ADD COLUMN "checksum" VARCHAR(64);

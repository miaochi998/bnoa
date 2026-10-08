-- ====================
-- 系统恢复模块：恢复记录表
-- 安全说明：仅新增表/索引/外键，不修改现有数据
-- ====================

-- CreateTable
CREATE TABLE "restore_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "backup_id" UUID NOT NULL,
    "restore_type" VARCHAR(20) NOT NULL DEFAULT 'FULL',
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "content_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "auto_backup_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "steps_log" JSONB,
    "error_message" TEXT,
    "operator_id" TEXT,
    "operator_ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restore_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restore_logs_backup_id_idx" ON "restore_logs"("backup_id");

-- CreateIndex
CREATE INDEX "restore_logs_status_idx" ON "restore_logs"("status");

-- CreateIndex
CREATE INDEX "restore_logs_started_at_idx" ON "restore_logs"("started_at");

-- AddForeignKey
ALTER TABLE "restore_logs" ADD CONSTRAINT "restore_logs_backup_id_fkey"
FOREIGN KEY ("backup_id") REFERENCES "backup_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_logs" ADD CONSTRAINT "restore_logs_auto_backup_id_fkey"
FOREIGN KEY ("auto_backup_id") REFERENCES "backup_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_logs" ADD CONSTRAINT "restore_logs_operator_id_fkey"
FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

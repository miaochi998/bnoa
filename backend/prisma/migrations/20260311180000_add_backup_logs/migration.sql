-- ====================
-- 系统备份模块：备份记录表
-- 安全说明：仅新增表/索引/外键，不修改现有数据
-- ====================

-- CreateTable
CREATE TABLE "backup_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "backup_type" VARCHAR(20) NOT NULL,
    "trigger_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "storage_type" VARCHAR(20) NOT NULL,
    "storage_path" VARCHAR(500),
    "file_size" BIGINT,
    "content_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "operator_id" TEXT,
    "operator_ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "backup_logs_status_idx" ON "backup_logs"("status");

-- CreateIndex
CREATE INDEX "backup_logs_started_at_idx" ON "backup_logs"("started_at");

-- CreateIndex
CREATE INDEX "backup_logs_trigger_type_idx" ON "backup_logs"("trigger_type");

-- AddForeignKey
ALTER TABLE "backup_logs" ADD CONSTRAINT "backup_logs_operator_id_fkey"
FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


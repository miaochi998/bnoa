-- CreateTable
CREATE TABLE "system_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" VARCHAR(50) NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "backend_image" VARCHAR(255),
    "frontend_image" VARCHAR(255),
    "release_notes" TEXT,
    "release_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upgrade_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version_from" VARCHAR(50) NOT NULL,
    "version_to" VARCHAR(50) NOT NULL,
    "upgrade_type" VARCHAR(20) NOT NULL DEFAULT 'upgrade',
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "backup_file" VARCHAR(500),
    "backup_size" BIGINT,
    "backup_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "steps_log" JSONB,
    "error_message" TEXT,
    "operator_id" TEXT,
    "operator_ip" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upgrade_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_versions_version_key" ON "system_versions"("version");

-- CreateIndex
CREATE INDEX "upgrade_logs_status_idx" ON "upgrade_logs"("status");

-- CreateIndex
CREATE INDEX "upgrade_logs_started_at_idx" ON "upgrade_logs"("started_at");

-- AddForeignKey
ALTER TABLE "upgrade_logs" ADD CONSTRAINT "upgrade_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

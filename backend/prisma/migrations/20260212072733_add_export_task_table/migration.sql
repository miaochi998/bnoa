-- CreateTable
CREATE TABLE "export_tasks" (
    "id" TEXT NOT NULL,
    "task_no" VARCHAR(50) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "format" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "params" JSONB,
    "file_name" VARCHAR(255),
    "file_path" VARCHAR(500),
    "file_size" BIGINT,
    "total_rows" INTEGER,
    "processed_rows" INTEGER DEFAULT 0,
    "error_message" TEXT,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "export_tasks_task_no_key" ON "export_tasks"("task_no");

-- CreateIndex
CREATE INDEX "export_tasks_task_no_idx" ON "export_tasks"("task_no");

-- CreateIndex
CREATE INDEX "export_tasks_user_id_idx" ON "export_tasks"("user_id");

-- CreateIndex
CREATE INDEX "export_tasks_module_idx" ON "export_tasks"("module");

-- CreateIndex
CREATE INDEX "export_tasks_type_idx" ON "export_tasks"("type");

-- CreateIndex
CREATE INDEX "export_tasks_status_idx" ON "export_tasks"("status");

-- CreateIndex
CREATE INDEX "export_tasks_created_at_idx" ON "export_tasks"("created_at");

-- CreateIndex
CREATE INDEX "export_tasks_expires_at_idx" ON "export_tasks"("expires_at");

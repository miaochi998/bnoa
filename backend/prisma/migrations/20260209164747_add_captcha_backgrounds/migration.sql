-- CreateTable
CREATE TABLE "captcha_backgrounds" (
    "id" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 320,
    "height" INTEGER NOT NULL DEFAULT 160,
    "storage_type" VARCHAR(20) NOT NULL DEFAULT 'RUSTFS',
    "folder_id" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "captcha_backgrounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "captcha_backgrounds_is_enabled_idx" ON "captcha_backgrounds"("is_enabled");

-- CreateIndex
CREATE INDEX "captcha_backgrounds_sort_order_idx" ON "captcha_backgrounds"("sort_order");

-- CreateIndex
CREATE INDEX "captcha_backgrounds_created_by_idx" ON "captcha_backgrounds"("created_by");

-- CreateIndex
CREATE INDEX "captcha_backgrounds_deleted_at_idx" ON "captcha_backgrounds"("deleted_at");

-- AddForeignKey
ALTER TABLE "captcha_backgrounds" ADD CONSTRAINT "captcha_backgrounds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

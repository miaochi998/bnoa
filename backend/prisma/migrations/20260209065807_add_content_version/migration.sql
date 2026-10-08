-- CreateTable
CREATE TABLE "content_versions" (
    "id" TEXT NOT NULL,
    "content_type" VARCHAR(50) NOT NULL,
    "content_id" VARCHAR(100) NOT NULL,
    "version_number" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "html_content" TEXT,
    "version_type" VARCHAR(20) NOT NULL,
    "version_name" VARCHAR(100),
    "character_count" INTEGER,
    "word_count" INTEGER,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_versions_content_type_content_id_idx" ON "content_versions"("content_type", "content_id");

-- CreateIndex
CREATE INDEX "content_versions_created_at_idx" ON "content_versions"("created_at");

-- CreateIndex
CREATE INDEX "content_versions_version_type_idx" ON "content_versions"("version_type");

-- CreateIndex
CREATE INDEX "content_versions_created_by_idx" ON "content_versions"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_content_type_content_id_version_number_key" ON "content_versions"("content_type", "content_id", "version_number");

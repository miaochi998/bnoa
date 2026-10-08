-- CreateEnum
CREATE TYPE "number_record_status" AS ENUM ('ACTIVE', 'VOID');

-- CreateTable
CREATE TABLE "number_check_batches" (
    "id" TEXT NOT NULL,
    "batch_no" VARCHAR(50) NOT NULL,
    "file_id" TEXT,
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_check_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_check_records" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "batch_id" TEXT NOT NULL,
    "is_settled" BOOLEAN NOT NULL DEFAULT false,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remark" TEXT,
    "status" "number_record_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_check_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "number_check_batches_batch_no_key" ON "number_check_batches"("batch_no");

-- CreateIndex
CREATE INDEX "number_check_batches_batch_no_idx" ON "number_check_batches"("batch_no");

-- CreateIndex
CREATE INDEX "number_check_batches_created_at_idx" ON "number_check_batches"("created_at");

-- CreateIndex
CREATE INDEX "number_check_batches_file_id_idx" ON "number_check_batches"("file_id");

-- CreateIndex
CREATE INDEX "number_check_batches_created_by_idx" ON "number_check_batches"("created_by");

-- CreateIndex
CREATE INDEX "number_check_records_code_status_idx" ON "number_check_records"("code", "status");

-- CreateIndex
CREATE INDEX "number_check_records_batch_id_idx" ON "number_check_records"("batch_id");

-- CreateIndex
CREATE INDEX "number_check_records_status_idx" ON "number_check_records"("status");

-- CreateIndex
CREATE INDEX "number_check_records_imported_at_idx" ON "number_check_records"("imported_at");

-- CreateIndex
CREATE INDEX "number_check_records_is_settled_idx" ON "number_check_records"("is_settled");

-- CreateIndex
CREATE INDEX "number_check_records_created_by_idx" ON "number_check_records"("created_by");

-- AddForeignKey
ALTER TABLE "number_check_batches" ADD CONSTRAINT "number_check_batches_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_check_batches" ADD CONSTRAINT "number_check_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_check_records" ADD CONSTRAINT "number_check_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "number_check_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_check_records" ADD CONSTRAINT "number_check_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

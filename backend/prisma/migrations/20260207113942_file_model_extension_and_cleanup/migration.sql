/*
  Warnings:

  - You are about to drop the column `download_role_ids` on the `real_folders` table. All the data in the column will be lost.
  - You are about to drop the column `is_download_public` on the `real_folders` table. All the data in the column will be lost.
  - You are about to drop the column `is_upload_public` on the `real_folders` table. All the data in the column will be lost.
  - You are about to drop the column `upload_role_ids` on the `real_folders` table. All the data in the column will be lost.
  - You are about to drop the column `media_file_id` on the `upload_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "files" ADD COLUMN     "category" "file_category" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "sha256" VARCHAR(64),
ADD COLUMN     "width" INTEGER,
ALTER COLUMN "size" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "real_folders" DROP COLUMN "download_role_ids",
DROP COLUMN "is_download_public",
DROP COLUMN "is_upload_public",
DROP COLUMN "upload_role_ids";

-- AlterTable
ALTER TABLE "upload_logs" DROP COLUMN "media_file_id",
ADD COLUMN     "file_id" TEXT;

-- CreateIndex
CREATE INDEX "files_md5_idx" ON "files"("md5");

-- CreateIndex
CREATE INDEX "files_category_idx" ON "files"("category");

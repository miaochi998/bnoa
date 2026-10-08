-- CreateEnum
CREATE TYPE "FileSource" AS ENUM ('UPLOAD', 'EDITOR');

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "source" "FileSource" NOT NULL DEFAULT 'UPLOAD';

-- CreateIndex
CREATE INDEX "files_source_idx" ON "files"("source");

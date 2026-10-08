/*
  Warnings:

  - You are about to drop the `media_files` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `virtual_folders` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "media_files" DROP CONSTRAINT "media_files_real_folder_id_fkey";

-- DropForeignKey
ALTER TABLE "media_files" DROP CONSTRAINT "media_files_uploaded_by_fkey";

-- DropForeignKey
ALTER TABLE "media_files" DROP CONSTRAINT "media_files_virtual_folder_id_fkey";

-- DropForeignKey
ALTER TABLE "virtual_folders" DROP CONSTRAINT "virtual_folders_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "virtual_folders" DROP CONSTRAINT "virtual_folders_real_folder_id_fkey";

-- DropTable
DROP TABLE "media_files";

-- DropTable
DROP TABLE "virtual_folders";

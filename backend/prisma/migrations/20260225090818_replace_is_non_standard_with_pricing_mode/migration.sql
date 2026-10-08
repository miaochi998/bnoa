/*
  Warnings:

  - You are about to drop the column `is_non_standard` on the `products` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "pricing_mode" AS ENUM ('UNIT', 'VOLUME', 'WEIGHT', 'AREA', 'LENGTH');

-- AlterTable
ALTER TABLE "finished_products" ADD COLUMN     "unit_weight" DECIMAL(10,4);

-- AlterTable
ALTER TABLE "products" DROP COLUMN "is_non_standard",
ADD COLUMN     "pricing_mode" "pricing_mode" NOT NULL DEFAULT 'UNIT';

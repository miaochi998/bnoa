/*
  Warnings:

  - Added the required column `name` to the `labor_rates` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "labor_rates" ADD COLUMN     "name" VARCHAR(200) NOT NULL;

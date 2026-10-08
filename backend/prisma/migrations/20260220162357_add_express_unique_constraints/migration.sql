/*
  Warnings:

  - A unique constraint covering the columns `[company_id,label]` on the table `express_weight_ranges` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[company_id,name]` on the table `express_zones` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "express_weight_ranges_company_id_label_key" ON "express_weight_ranges"("company_id", "label");

-- CreateIndex
CREATE UNIQUE INDEX "express_zones_company_id_name_key" ON "express_zones"("company_id", "name");

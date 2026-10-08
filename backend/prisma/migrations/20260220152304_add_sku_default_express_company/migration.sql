-- AlterTable
ALTER TABLE "skus" ADD COLUMN     "default_express_company_id" UUID;

-- CreateIndex
CREATE INDEX "skus_default_express_company_id_idx" ON "skus"("default_express_company_id");

-- AddForeignKey
ALTER TABLE "skus" ADD CONSTRAINT "skus_default_express_company_id_fkey" FOREIGN KEY ("default_express_company_id") REFERENCES "express_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

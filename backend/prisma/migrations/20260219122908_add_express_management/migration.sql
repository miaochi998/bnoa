-- CreateEnum
CREATE TYPE "express_company_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "express_companies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "contact_name" VARCHAR(100),
    "contact_phone" VARCHAR(50),
    "status" "express_company_status" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "express_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "express_prices" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "first_weight" DECIMAL(10,3) NOT NULL,
    "first_weight_price" DECIMAL(10,2) NOT NULL,
    "additional_weight" DECIMAL(10,3) NOT NULL,
    "additional_weight_price" DECIMAL(10,2) NOT NULL,
    "volume_ratio" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "express_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "express_companies_code_key" ON "express_companies"("code");

-- CreateIndex
CREATE INDEX "express_companies_status_idx" ON "express_companies"("status");

-- CreateIndex
CREATE INDEX "express_companies_created_at_idx" ON "express_companies"("created_at");

-- CreateIndex
CREATE INDEX "express_prices_company_id_idx" ON "express_prices"("company_id");

-- CreateIndex
CREATE INDEX "express_prices_is_active_idx" ON "express_prices"("is_active");

-- AddForeignKey
ALTER TABLE "express_prices" ADD CONSTRAINT "express_prices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "express_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

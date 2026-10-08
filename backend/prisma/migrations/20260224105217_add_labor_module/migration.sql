-- CreateEnum
CREATE TYPE "labor_billing_type" AS ENUM ('PER_PIECE', 'PER_WEIGHT', 'PER_PACKAGE');

-- CreateTable
CREATE TABLE "labor_types" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "billing_type" "labor_billing_type" NOT NULL,
    "status" "consumable_status" NOT NULL DEFAULT 'ENABLED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "labor_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_rates" (
    "id" UUID NOT NULL,
    "labor_type_id" UUID NOT NULL,
    "unit_price" DECIMAL(10,4) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "effect_date" TIMESTAMP(3) NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "remark" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "labor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "labor_types_code_key" ON "labor_types"("code");

-- CreateIndex
CREATE INDEX "labor_types_status_idx" ON "labor_types"("status");

-- CreateIndex
CREATE INDEX "labor_types_deleted_at_idx" ON "labor_types"("deleted_at");

-- CreateIndex
CREATE INDEX "labor_types_created_at_idx" ON "labor_types"("created_at");

-- CreateIndex
CREATE INDEX "labor_rates_labor_type_id_idx" ON "labor_rates"("labor_type_id");

-- CreateIndex
CREATE INDEX "labor_rates_is_current_idx" ON "labor_rates"("is_current");

-- AddForeignKey
ALTER TABLE "labor_rates" ADD CONSTRAINT "labor_rates_labor_type_id_fkey" FOREIGN KEY ("labor_type_id") REFERENCES "labor_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

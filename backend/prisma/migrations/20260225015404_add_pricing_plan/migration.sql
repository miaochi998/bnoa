-- CreateTable
CREATE TABLE "pricing_plans" (
    "id" UUID NOT NULL,
    "link_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "profit_rates" DECIMAL(65,30)[],
    "commission_rate" DECIMAL(5,4) NOT NULL,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "selected_prices" JSONB,
    "needs_update" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_plans_link_id_idx" ON "pricing_plans"("link_id");

-- CreateIndex
CREATE INDEX "pricing_plans_created_by_idx" ON "pricing_plans"("created_by");

-- CreateIndex
CREATE INDEX "pricing_plans_created_at_idx" ON "pricing_plans"("created_at");

-- AddForeignKey
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "product_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

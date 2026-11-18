-- B 批：一耗材多供应商 + 历史方案成本基线
--
-- 1) consumables.default_supplier_id：默认供货商，决定成品成本按哪家当前价计算；
-- 2) pricing_plans.cost_snapshot：方案保存时的 SKU 成本基线，用于「成本已变 N 项」提示；
-- 3) 回填：把每个耗材现有 isCurrent 价格的供应商设为默认供货商（升级前后成本不变）。
--
-- 幂等：ADD COLUMN 用 IF NOT EXISTS 不可用于 Prisma 生成语句，遵循本项目「迁移只执行一次」约定。

ALTER TABLE "consumables" ADD COLUMN     "default_supplier_id" UUID;

ALTER TABLE "pricing_plans" ADD COLUMN     "cost_snapshot" JSONB;

CREATE INDEX "consumables_default_supplier_id_idx" ON "consumables"("default_supplier_id");

ALTER TABLE "consumables" ADD CONSTRAINT "consumables_default_supplier_id_fkey" FOREIGN KEY ("default_supplier_id") REFERENCES "consumable_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 回填默认供货商：取每个耗材当前价（is_current=true）中生效日期最新的一条
UPDATE "consumables" c
SET "default_supplier_id" = sub."supplier_id"
FROM (
  SELECT DISTINCT ON ("consumable_id") "consumable_id", "supplier_id"
  FROM "consumable_prices"
  WHERE "is_current" = true
  ORDER BY "consumable_id", "effect_date" DESC, "created_at" DESC
) sub
WHERE c."id" = sub."consumable_id"
  AND c."default_supplier_id" IS NULL;

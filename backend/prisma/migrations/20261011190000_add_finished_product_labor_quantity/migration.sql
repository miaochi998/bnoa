-- 成品-工费关联表新增「次数」字段（此前缺失，导致工费成本只按 1 次计算）
ALTER TABLE "finished_product_labor" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

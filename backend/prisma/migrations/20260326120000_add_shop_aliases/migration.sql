-- 创建店铺别名表
CREATE TABLE IF NOT EXISTS "shop_aliases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shop_id" UUID NOT NULL,
    "alias" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_aliases_pkey" PRIMARY KEY ("id")
);

-- 唯一约束：别名不可重复
CREATE UNIQUE INDEX IF NOT EXISTS "shop_aliases_alias_key" ON "shop_aliases"("alias");

-- 索引
CREATE INDEX IF NOT EXISTS "shop_aliases_shop_id_idx" ON "shop_aliases"("shop_id");

-- 外键
ALTER TABLE "shop_aliases" ADD CONSTRAINT "shop_aliases_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 店铺状态简化为「正常 / 关店」两个值（原 ACTIVE / REST / CLOSED）
-- 先把历史数据里可能存在的「已停业(REST)」归为「正常」，避免枚举收窄时失败
UPDATE "shops" SET "status" = 'ACTIVE' WHERE "status"::text = 'REST';

-- AlterEnum
BEGIN;
CREATE TYPE "shop_status_new" AS ENUM ('ACTIVE', 'CLOSED');
ALTER TABLE "public"."shops" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "shops" ALTER COLUMN "status" TYPE "shop_status_new" USING ("status"::text::"shop_status_new");
ALTER TYPE "shop_status" RENAME TO "shop_status_old";
ALTER TYPE "shop_status_new" RENAME TO "shop_status";
DROP TYPE "public"."shop_status_old";
ALTER TABLE "shops" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;

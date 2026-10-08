-- CreateEnum
CREATE TYPE "shop_status" AS ENUM ('ACTIVE', 'REST', 'CLOSED');

-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "platform_id" UUID NOT NULL,
    "status" "shop_status" NOT NULL DEFAULT 'ACTIVE',
    "manager_id" TEXT NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shops_platform_id_idx" ON "shops"("platform_id");

-- CreateIndex
CREATE INDEX "shops_manager_id_idx" ON "shops"("manager_id");

-- CreateIndex
CREATE INDEX "shops_status_idx" ON "shops"("status");

-- CreateIndex
CREATE INDEX "shops_created_at_idx" ON "shops"("created_at");

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

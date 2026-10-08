-- CreateEnum
CREATE TYPE "platform_type" AS ENUM ('DOMESTIC', 'CROSS_BORDER', 'SOCIAL');

-- CreateEnum
CREATE TYPE "platform_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "platforms" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "type" "platform_type" DEFAULT 'DOMESTIC',
    "logo" VARCHAR(500),
    "website" VARCHAR(255),
    "status" "platform_status" NOT NULL DEFAULT 'ACTIVE',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platforms_code_key" ON "platforms"("code");

-- CreateIndex
CREATE INDEX "platforms_code_idx" ON "platforms"("code");

-- CreateIndex
CREATE INDEX "platforms_status_idx" ON "platforms"("status");

-- CreateIndex
CREATE INDEX "platforms_created_at_idx" ON "platforms"("created_at");

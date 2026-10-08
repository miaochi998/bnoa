-- CreateEnum
CREATE TYPE "talent_status" AS ENUM ('PENDING', 'COMMUNICATING', 'SAMPLE_SENT', 'COOPERATING', 'ORDER_PLACED', 'REJECTED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "talent_level" AS ENUM ('LV1', 'LV2', 'LV3', 'LV4', 'LV5');

-- CreateEnum
CREATE TYPE "talent_flag_color" AS ENUM ('RED', 'GREEN', 'BLUE', 'GRAY', 'YELLOW');

-- CreateTable
CREATE TABLE "talents" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "wechat" VARCHAR(100),
    "phone" VARCHAR(50),
    "status" "talent_status" NOT NULL DEFAULT 'PENDING',
    "level" "talent_level" NOT NULL DEFAULT 'LV1',
    "manager_id" TEXT NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "talents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_platforms" (
    "id" UUID NOT NULL,
    "talent_id" UUID NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "nickname" VARCHAR(100),
    "account_id" VARCHAR(100),
    "home_url" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "content_forms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "talent_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_contact_logs" (
    "id" UUID NOT NULL,
    "talent_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_contact_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_transfers" (
    "id" UUID NOT NULL,
    "talent_id" UUID NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "to_user_id" TEXT NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "talent_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_flag_configs" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "flag_color" "talent_flag_color" NOT NULL,
    "meaning" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_flag_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_flags" (
    "id" UUID NOT NULL,
    "talent_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "flag_color" "talent_flag_color" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "talents_manager_id_idx" ON "talents"("manager_id");

-- CreateIndex
CREATE INDEX "talents_status_idx" ON "talents"("status");

-- CreateIndex
CREATE INDEX "talents_level_idx" ON "talents"("level");

-- CreateIndex
CREATE INDEX "talents_deleted_at_idx" ON "talents"("deleted_at");

-- CreateIndex
CREATE INDEX "talents_created_at_idx" ON "talents"("created_at");

-- CreateIndex
CREATE INDEX "talent_platforms_talent_id_idx" ON "talent_platforms"("talent_id");

-- CreateIndex
CREATE INDEX "talent_platforms_platform_idx" ON "talent_platforms"("platform");

-- CreateIndex
CREATE INDEX "talent_platforms_deleted_at_idx" ON "talent_platforms"("deleted_at");

-- CreateIndex
CREATE INDEX "talent_contact_logs_talent_id_idx" ON "talent_contact_logs"("talent_id");

-- CreateIndex
CREATE INDEX "talent_contact_logs_creator_id_idx" ON "talent_contact_logs"("creator_id");

-- CreateIndex
CREATE INDEX "talent_contact_logs_created_at_idx" ON "talent_contact_logs"("created_at");

-- CreateIndex
CREATE INDEX "talent_transfers_talent_id_idx" ON "talent_transfers"("talent_id");

-- CreateIndex
CREATE INDEX "talent_transfers_from_user_id_idx" ON "talent_transfers"("from_user_id");

-- CreateIndex
CREATE INDEX "talent_transfers_to_user_id_idx" ON "talent_transfers"("to_user_id");

-- CreateIndex
CREATE INDEX "talent_transfers_created_at_idx" ON "talent_transfers"("created_at");

-- CreateIndex
CREATE INDEX "talent_flag_configs_user_id_idx" ON "talent_flag_configs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "talent_flag_configs_user_id_flag_color_key" ON "talent_flag_configs"("user_id", "flag_color");

-- CreateIndex
CREATE INDEX "talent_flags_talent_id_idx" ON "talent_flags"("talent_id");

-- CreateIndex
CREATE INDEX "talent_flags_user_id_idx" ON "talent_flags"("user_id");

-- CreateIndex
CREATE INDEX "talent_flags_flag_color_idx" ON "talent_flags"("flag_color");

-- CreateIndex
CREATE UNIQUE INDEX "talent_flags_talent_id_user_id_key" ON "talent_flags"("talent_id", "user_id");

-- AddForeignKey
ALTER TABLE "talents" ADD CONSTRAINT "talents_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_platforms" ADD CONSTRAINT "talent_platforms_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_contact_logs" ADD CONSTRAINT "talent_contact_logs_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_contact_logs" ADD CONSTRAINT "talent_contact_logs_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_transfers" ADD CONSTRAINT "talent_transfers_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_transfers" ADD CONSTRAINT "talent_transfers_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_transfers" ADD CONSTRAINT "talent_transfers_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_transfers" ADD CONSTRAINT "talent_transfers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_flag_configs" ADD CONSTRAINT "talent_flag_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_flags" ADD CONSTRAINT "talent_flags_talent_id_fkey" FOREIGN KEY ("talent_id") REFERENCES "talents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_flags" ADD CONSTRAINT "talent_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

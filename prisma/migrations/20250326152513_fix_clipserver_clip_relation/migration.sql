/*
  Warnings:

  - You are about to drop the `DiscordServer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserServer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Clip" DROP CONSTRAINT "Clip_serverId_fkey";

-- DropForeignKey
ALTER TABLE "UserServer" DROP CONSTRAINT "UserServer_serverId_fkey";

-- DropForeignKey
ALTER TABLE "UserServer" DROP CONSTRAINT "UserServer_userId_fkey";

-- DropTable
DROP TABLE "DiscordServer";

-- DropTable
DROP TABLE "UserServer";

-- CreateIndex
CREATE INDEX "Clip_clipServerId_createdAt_idx" ON "Clip"("clipServerId", "createdAt");

-- CreateTable
CREATE TABLE "ClipServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "ownerId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClipServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClipServerUser" (
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipServerUser_pkey" PRIMARY KEY ("userId","serverId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClipServer_inviteCode_key" ON "ClipServer"("inviteCode");

-- AddForeignKey
ALTER TABLE "ClipServer" ADD CONSTRAINT "ClipServer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipServerUser" ADD CONSTRAINT "ClipServerUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClipServerUser" ADD CONSTRAINT "ClipServerUser_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ClipServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable for Clip
ALTER TABLE "Clip" ADD COLUMN "clipServerId" TEXT;

-- AddForeignKey for Clip
ALTER TABLE "Clip" ADD CONSTRAINT "Clip_clipServerId_fkey" FOREIGN KEY ("clipServerId") REFERENCES "ClipServer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
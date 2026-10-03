-- AlterTable
ALTER TABLE "Favorite" ADD COLUMN "notifiedAt" DATETIME;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "reminderSentAt" DATETIME;

-- AlterTable
ALTER TABLE "SurpriseBag" ADD COLUMN "hiddenByAdminAt" DATETIME;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "blockedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "blockedReason" TEXT;

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,
    CONSTRAINT "AdminLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdminLog_createdAt_idx" ON "AdminLog"("createdAt");

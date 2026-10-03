-- AlterTable
ALTER TABLE "Store" ADD COLUMN "feeFreeUntil" DATETIME;
ALTER TABLE "Store" ADD COLUMN "feePaidUntil" DATETIME;
ALTER TABLE "Store" ADD COLUMN "foundingNumber" INTEGER;

-- CreateTable
CREATE TABLE "MembershipPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" INTEGER NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coversUntil" DATETIME NOT NULL,
    "adminId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    CONSTRAINT "MembershipPayment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MembershipPayment_paidAt_idx" ON "MembershipPayment"("paidAt");

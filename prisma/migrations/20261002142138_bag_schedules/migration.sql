-- CreateTable
CREATE TABLE "BagSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'MIXED',
    "imageUrl" TEXT,
    "isHalal" BOOLEAN NOT NULL DEFAULT false,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "allergens" TEXT NOT NULL DEFAULT '',
    "originalPrice" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "weekdays" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "storeId" TEXT NOT NULL,
    CONSTRAINT "BagSchedule_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SurpriseBag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'MIXED',
    "imageUrl" TEXT,
    "originalPrice" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "isHalal" BOOLEAN NOT NULL DEFAULT false,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "isVegan" BOOLEAN NOT NULL DEFAULT false,
    "allergens" TEXT NOT NULL DEFAULT '',
    "quantityAvailable" INTEGER NOT NULL DEFAULT 1,
    "pickupStart" DATETIME NOT NULL,
    "pickupEnd" DATETIME NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "storeId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "scheduleDate" TEXT,
    CONSTRAINT "SurpriseBag_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SurpriseBag_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "BagSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SurpriseBag" ("allergens", "category", "createdAt", "description", "id", "imageUrl", "isActive", "isHalal", "isVegan", "isVegetarian", "originalPrice", "pickupEnd", "pickupStart", "price", "quantityAvailable", "storeId", "title", "updatedAt") SELECT "allergens", "category", "createdAt", "description", "id", "imageUrl", "isActive", "isHalal", "isVegan", "isVegetarian", "originalPrice", "pickupEnd", "pickupStart", "price", "quantityAvailable", "storeId", "title", "updatedAt" FROM "SurpriseBag";
DROP TABLE "SurpriseBag";
ALTER TABLE "new_SurpriseBag" RENAME TO "SurpriseBag";
CREATE INDEX "SurpriseBag_storeId_idx" ON "SurpriseBag"("storeId");
CREATE INDEX "SurpriseBag_isActive_pickupEnd_idx" ON "SurpriseBag"("isActive", "pickupEnd");
CREATE UNIQUE INDEX "SurpriseBag_scheduleId_scheduleDate_key" ON "SurpriseBag"("scheduleId", "scheduleDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BagSchedule_storeId_idx" ON "BagSchedule"("storeId");

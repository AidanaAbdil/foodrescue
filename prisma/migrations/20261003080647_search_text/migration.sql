-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "searchText" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "imageUrl" TEXT,
    "phone" TEXT,
    "openingHours" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedAt" DATETIME,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Store" ("address", "city", "createdAt", "description", "id", "imageUrl", "latitude", "longitude", "name", "openingHours", "ownerId", "phone", "rejectionReason", "reviewedAt", "status", "updatedAt") SELECT "address", "city", "createdAt", "description", "id", "imageUrl", "latitude", "longitude", "name", "openingHours", "ownerId", "phone", "rejectionReason", "reviewedAt", "status", "updatedAt" FROM "Store";
DROP TABLE "Store";
ALTER TABLE "new_Store" RENAME TO "Store";
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");
CREATE INDEX "Store_city_idx" ON "Store"("city");
CREATE INDEX "Store_status_idx" ON "Store"("status");
CREATE TABLE "new_SurpriseBag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "searchText" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_SurpriseBag" ("allergens", "category", "createdAt", "description", "id", "imageUrl", "isActive", "isHalal", "isVegan", "isVegetarian", "originalPrice", "pickupEnd", "pickupStart", "price", "quantityAvailable", "scheduleDate", "scheduleId", "storeId", "title", "updatedAt") SELECT "allergens", "category", "createdAt", "description", "id", "imageUrl", "isActive", "isHalal", "isVegan", "isVegetarian", "originalPrice", "pickupEnd", "pickupStart", "price", "quantityAvailable", "scheduleDate", "scheduleId", "storeId", "title", "updatedAt" FROM "SurpriseBag";
DROP TABLE "SurpriseBag";
ALTER TABLE "new_SurpriseBag" RENAME TO "SurpriseBag";
CREATE INDEX "SurpriseBag_storeId_idx" ON "SurpriseBag"("storeId");
CREATE INDEX "SurpriseBag_isActive_pickupEnd_idx" ON "SurpriseBag"("isActive", "pickupEnd");
CREATE UNIQUE INDEX "SurpriseBag_scheduleId_scheduleDate_key" ON "SurpriseBag"("scheduleId", "scheduleDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

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
    CONSTRAINT "SurpriseBag_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SurpriseBag" ("category", "createdAt", "description", "id", "imageUrl", "isActive", "originalPrice", "pickupEnd", "pickupStart", "price", "quantityAvailable", "storeId", "title", "updatedAt") SELECT "category", "createdAt", "description", "id", "imageUrl", "isActive", "originalPrice", "pickupEnd", "pickupStart", "price", "quantityAvailable", "storeId", "title", "updatedAt" FROM "SurpriseBag";
DROP TABLE "SurpriseBag";
ALTER TABLE "new_SurpriseBag" RENAME TO "SurpriseBag";
CREATE INDEX "SurpriseBag_storeId_idx" ON "SurpriseBag"("storeId");
CREATE INDEX "SurpriseBag_isActive_pickupEnd_idx" ON "SurpriseBag"("isActive", "pickupEnd");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

// Recompute the search text of every bag and store:   npm run db:search
// Run once after the migration that added searchText (or any time; it's safe).
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { refreshSearchText } from "../src/lib/search";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });
refreshSearchText(prisma)
  .then((counts) => console.log(`Search text updated: ${counts.bags} bags, ${counts.stores} stores.`))
  .finally(() => prisma.$disconnect());

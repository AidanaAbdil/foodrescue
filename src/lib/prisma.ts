// One shared Prisma client for the whole app.
// Import it anywhere on the server:  import { prisma } from "@/lib/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
  return new PrismaClient({ adapter });
}

// In development, Next.js reloads modules on every save. Without this,
// each reload would open a new database connection. Storing the client on
// `globalThis` lets us reuse the same one across reloads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

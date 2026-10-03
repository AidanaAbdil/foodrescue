// Gives founding-partner places (a free year, src/lib/fees.ts) to approved
// stores that were approved before the yearly fee existed, in approval order:
//   npm run fees:founding
// New approvals get their place automatically; this is only for older stores.
// Stores that already have a place or a free year are left alone.
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { addMonths, foundingFreeMonths, foundingPartners } from "../src/lib/fees";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });

async function main() {
  const stores = await prisma.store.findMany({ where: { status: "APPROVED", foundingNumber: null, feeFreeUntil: null } });
  stores.sort((a, b) => (a.reviewedAt ?? a.createdAt).getTime() - (b.reviewedAt ?? b.createdAt).getTime());
  let next = ((await prisma.store.aggregate({ _max: { foundingNumber: true } }))._max.foundingNumber ?? 0) + 1;
  const given: string[] = [];
  for (const store of stores) {
    if (next > foundingPartners()) break;
    const freeFrom = store.reviewedAt ?? store.createdAt;
    await prisma.store.update({
      where: { id: store.id },
      data: { foundingNumber: next, feeFreeUntil: addMonths(freeFrom, foundingFreeMonths()) },
    });
    given.push(`№${next} ${store.name}`);
    next += 1;
  }
  console.log(given.length ? `Founding places given:\n  ${given.join("\n  ")}` : "Nothing to do.");
  console.log(`Places left: ${Math.max(0, foundingPartners() - (next - 1))} of ${foundingPartners()}.`);
}

main().finally(() => prisma.$disconnect());

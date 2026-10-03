// Moves upcoming bags and all regular bags to the nearest fixed price level
// (src/lib/pricing.ts), with the guaranteed value that comes with it:
//   npm run prices:apply
// Run it after changing PRICE_LEVELS or VALUE_MULTIPLIER. Orders already
// paid keep the price that was paid (Order.totalPrice). Safe to run again.
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { nearestLevel, priceLevels, valueMultiplier } from "../src/lib/pricing";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });

async function main() {
  const levels = priceLevels();
  let bags = 0;
  let schedules = 0;
  for (const bag of await prisma.surpriseBag.findMany({ where: { pickupEnd: { gt: new Date() } } })) {
    const level = nearestLevel(bag.price, levels);
    if (bag.price === level.price && bag.originalPrice === level.value) continue;
    await prisma.surpriseBag.update({ where: { id: bag.id }, data: { price: level.price, originalPrice: level.value } });
    bags += 1;
  }
  for (const schedule of await prisma.bagSchedule.findMany()) {
    const level = nearestLevel(schedule.price, levels);
    if (schedule.price === level.price && schedule.originalPrice === level.value) continue;
    await prisma.bagSchedule.update({ where: { id: schedule.id }, data: { price: level.price, originalPrice: level.value } });
    schedules += 1;
  }
  const list = levels.map((l) => `${l.price / 100} ₸ (value ${l.value / 100} ₸)`).join(", ");
  console.log(`Levels: ${list}; value ≥ ${valueMultiplier()}× the price.`);
  console.log(`Updated ${bags} upcoming bags and ${schedules} regular bags.`);
}

main().finally(() => prisma.$disconnect());

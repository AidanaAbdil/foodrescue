// Give an existing account admin rights:   npm run make-admin -- you@example.com
// Take them away again:                    npm run make-admin -- you@example.com --remove
//
// Sign up on the site first (as a customer) with the email you want to use.
// Use a separate account from your store account: an admin account can't
// manage a store or place orders.
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const remove = process.argv.includes("--remove");
  if (!email || !email.includes("@")) {
    console.error("Usage: npm run make-admin -- you@example.com [--remove]");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { _count: { select: { stores: true } } } });
  if (!user) {
    console.error(`No account with ${email}. Sign up on the site first, then run this again.`);
    process.exitCode = 1;
    return;
  }
  if (remove) {
    await prisma.user.update({ where: { id: user.id }, data: { role: "CUSTOMER" } });
    console.log(`✓ ${email} is no longer an admin (now a customer account).`);
    return;
  }
  if (user._count.stores > 0) {
    console.error(`${email} owns a store. Use a separate account for admin, so this one keeps its dashboard.`);
    process.exitCode = 1;
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log(`✓ ${email} is now an admin. Log in and open /admin.`);
}

main().finally(() => prisma.$disconnect());

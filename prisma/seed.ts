// Fills the local database with sample data. Run with:  npm run db:seed
// Safe to re-run: it replaces the demo accounts and their stores, bags and
// orders. Accounts you created yourself are left alone.
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Helper: a Date `hours` from now.
const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

// Helper: an Unsplash photo URL from its id (host is allowed in next.config.ts).
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=70&auto=format&fit=crop`;

// Helper: tenge → tiyn, the unit prices are stored in (1 ₸ = 100 tiyn).
const tenge = (amount: number) => amount * 100;

const DEMO_EMAILS = ["owner@example.com", "customer@example.com"];

async function main() {
  // Remove only the demo data. Delete orders first: an order blocks deleting
  // its bag (onDelete: Restrict). Deleting the demo users then cascades to
  // their sessions, stores and bags.
  const demo = { email: { in: DEMO_EMAILS } };
  await prisma.order.deleteMany({
    where: { OR: [{ user: demo }, { bag: { store: { owner: demo } } }] },
  });
  await prisma.user.deleteMany({ where: demo });

  // Both demo accounts log in with the password "password123".
  const passwordHash = await hashPassword("password123");

  const owner = await prisma.user.create({
    data: { email: "owner@example.com", name: "Ерлан Сейтжанов", passwordHash, role: "STORE_OWNER" },
  });
  const customer = await prisma.user.create({
    data: { email: "customer@example.com", name: "Алия Нурланова", passwordHash },
  });

  // ── Almaty ────────────────────────────────────────────────────────────────
  // Nested create: makes the store AND its bags in one call.
  const bakery = await prisma.store.create({
    data: {
      name: "Пекарня «Тёплый хлеб»",
      description: "Хлеб на закваске, круассаны и торты — каждое утро свежие.",
      address: "пр. Абая, 52",
      city: "Алматы",
      latitude: 43.2405,
      longitude: 76.9286,
      ownerId: owner.id,
      bags: {
        create: [
          {
            title: "Хлебный сюрприз",
            description: "Хлеб и выпечка, оставшиеся за сегодня.",
            category: "BAKERY",
            imageUrl: photo("1509440159596-0249088772ff"),
            originalPrice: tenge(4500),
            price: tenge(1490),
            quantityAvailable: 5,
            pickupStart: inHours(2),
            pickupEnd: inHours(4),
          },
          {
            title: "Сладкая коробка",
            category: "BAKERY",
            imageUrl: photo("1578985545062-69928b1d9587"),
            originalPrice: tenge(3900),
            price: tenge(1290),
            quantityAvailable: 2,
            pickupStart: inHours(3),
            pickupEnd: inHours(5),
          },
        ],
      },
    },
    include: { bags: true },
  });

  await prisma.store.create({
    data: {
      name: "Зелёный базар",
      description: "Фрукты, овощи и продукты от местных фермеров.",
      address: "ул. Жибек Жолы, 30",
      city: "Алматы",
      latitude: 43.2615,
      longitude: 76.945,
      ownerId: owner.id,
      bags: {
        create: [
          {
            title: "Фрукты и овощи",
            category: "PRODUCE",
            imageUrl: photo("1610832958506-aa56368176cf"),
            originalPrice: tenge(6000),
            price: tenge(1990),
            quantityAvailable: 3,
            pickupStart: inHours(1),
            pickupEnd: inHours(3),
          },
          {
            title: "Продуктовый пакет",
            description: "Крупы, молочные продукты и свежие товары с подходящим сроком.",
            category: "GROCERIES",
            imageUrl: photo("1542838132-92c53300491e"),
            originalPrice: tenge(8000),
            price: tenge(2490),
            quantityAvailable: 4,
            pickupStart: inHours(5),
            pickupEnd: inHours(7),
          },
        ],
      },
    },
  });

  // ── Astana ────────────────────────────────────────────────────────────────
  await prisma.store.create({
    data: {
      name: "Bowl Bar",
      description: "Свежие салаты и тёплые боулы.",
      address: "пр. Мангилик Ел, 20",
      city: "Астана",
      latitude: 51.0905,
      longitude: 71.4185,
      ownerId: owner.id,
      bags: {
        create: {
          title: "Обед-сюрприз",
          category: "MEALS",
          imageUrl: photo("1546069901-ba9599a7e63c"),
          originalPrice: tenge(5000),
          price: tenge(1690),
          quantityAvailable: 6,
          pickupStart: inHours(2),
          pickupEnd: inHours(6),
        },
      },
    },
  });

  await prisma.store.create({
    data: {
      name: "Пиццерия «Слайс»",
      address: "ул. Кенесары, 40",
      city: "Астана",
      latitude: 51.1694,
      longitude: 71.43,
      ownerId: owner.id,
      bags: {
        create: {
          title: "Пицца в конце дня",
          description: "Пиццы, оставшиеся к закрытию.",
          category: "MIXED",
          imageUrl: photo("1565299624946-b28f40a0ae38"),
          originalPrice: tenge(6000),
          price: tenge(1990),
          quantityAvailable: 1,
          pickupStart: inHours(6),
          pickupEnd: inHours(8),
        },
      },
    },
  });

  // Customer reserves one bakery bag; decrement stock in the same transaction
  // so the two writes succeed or fail together.
  const bag = bakery.bags[0];
  await prisma.$transaction([
    prisma.order.create({
      data: { userId: customer.id, bagId: bag.id, quantity: 1, totalPrice: bag.price, pickupCode: "TX-4821" },
    }),
    prisma.surpriseBag.update({
      where: { id: bag.id },
      data: { quantityAvailable: { decrement: 1 } },
    }),
  ]);

  const counts = {
    users: await prisma.user.count(),
    stores: await prisma.store.count(),
    bags: await prisma.surpriseBag.count(),
    orders: await prisma.order.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

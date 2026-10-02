// Fills the local database with sample data. Run with:  npm run db:seed
// Safe to re-run: it wipes the tables first.
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

async function main() {
  // Delete children before parents so foreign keys aren't violated.
  await prisma.session.deleteMany();
  await prisma.order.deleteMany();
  await prisma.surpriseBag.deleteMany();
  await prisma.store.deleteMany();
  await prisma.user.deleteMany();

  // Both demo accounts log in with the password "password123".
  const passwordHash = await hashPassword("password123");

  const owner = await prisma.user.create({
    data: { email: "owner@example.com", name: "Sam Baker", passwordHash, role: "STORE_OWNER" },
  });
  const customer = await prisma.user.create({
    data: { email: "customer@example.com", name: "Alex Rivera", passwordHash },
  });

  // Nested create: makes the store AND its bags in one call.
  const bakery = await prisma.store.create({
    data: {
      name: "Golden Crust Bakery",
      description: "Sourdough, pastries and cakes baked fresh every morning.",
      address: "12 Main St",
      city: "Springfield",
      ownerId: owner.id,
      bags: {
        create: [
          {
            title: "Bakery Surprise Bag",
            description: "A mix of today's breads and pastries.",
            category: "BAKERY",
            imageUrl: photo("1509440159596-0249088772ff"),
            originalPrice: 1500,
            price: 499,
            quantityAvailable: 5,
            pickupStart: inHours(2),
            pickupEnd: inHours(4),
          },
          {
            title: "Cake Slice Box",
            category: "BAKERY",
            imageUrl: photo("1578985545062-69928b1d9587"),
            originalPrice: 1200,
            price: 399,
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
      name: "Green Leaf Grocery",
      address: "88 Oak Ave",
      city: "Springfield",
      ownerId: owner.id,
      bags: {
        create: [
          {
            title: "Fruit & Veg Rescue Box",
            category: "PRODUCE",
            imageUrl: photo("1610832958506-aa56368176cf"),
            originalPrice: 2000,
            price: 699,
            quantityAvailable: 3,
            pickupStart: inHours(1),
            pickupEnd: inHours(3),
          },
          {
            title: "Grocery Surprise Bag",
            description: "Pantry staples, dairy and fresh items close to their date.",
            category: "GROCERIES",
            imageUrl: photo("1542838132-92c53300491e"),
            originalPrice: 2500,
            price: 799,
            quantityAvailable: 4,
            pickupStart: inHours(5),
            pickupEnd: inHours(7),
          },
        ],
      },
    },
  });

  await prisma.store.create({
    data: {
      name: "Bowl & Basil",
      description: "Fresh salads and warm grain bowls.",
      address: "5 Elm St",
      city: "Springfield",
      ownerId: owner.id,
      bags: {
        create: {
          title: "Lunch Bowl Surprise",
          category: "MEALS",
          imageUrl: photo("1546069901-ba9599a7e63c"),
          originalPrice: 1400,
          price: 450,
          quantityAvailable: 6,
          pickupStart: inHours(2),
          pickupEnd: inHours(6),
        },
      },
    },
  });

  await prisma.store.create({
    data: {
      name: "Slice Pizzeria",
      address: "301 Maple Rd",
      city: "Springfield",
      ownerId: owner.id,
      bags: {
        create: {
          title: "End-of-Day Pizza Box",
          description: "Whatever pizzas are left at closing time.",
          category: "MIXED",
          imageUrl: photo("1565299624946-b28f40a0ae38"),
          originalPrice: 1800,
          price: 599,
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
      data: { userId: customer.id, bagId: bag.id, quantity: 1, totalPrice: bag.price, pickupCode: "GC-4821" },
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

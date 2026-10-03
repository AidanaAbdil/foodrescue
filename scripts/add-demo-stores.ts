// Adds 10 demo stores (Almaty and Astana) with regular daily bags, so there
// is always something to order when friends test the site:
//   npm run demo:stores
// Safe to run again: stores whose owner email already exists are skipped.
// Nothing else in the database is changed. Every demo owner logs in with
// the password "password123" (see the list printed at the end).
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, type BagCategory } from "../src/generated/prisma/client";
import { LEGAL_VERSION } from "../src/content/legal";
import { serializeHours } from "../src/lib/hours";
import { nearestLevel } from "../src/lib/pricing";
import { hashPassword } from "../src/lib/password";
import { storeSearchText } from "../src/lib/search";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! }) });

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=70&auto=format&fit=crop`;
const tenge = (amount: number) => amount * 100;
const EVERY_DAY = "1,2,3,4,5,6,7";
const hours = (open: string, close: string) => serializeHours(Array.from({ length: 7 }, () => [open, close] as [string, string]));

type Bag = {
  title: string;
  description: string;
  category: BagCategory;
  image: string;
  price: number; // ₸
  original: number; // ₸
  quantity: number;
  start: string;
  end: string;
  halal?: boolean;
  vegetarian?: boolean;
  vegan?: boolean;
  allergens?: string;
};
type DemoStore = {
  email: string;
  owner: string;
  name: string;
  description: string;
  city: "ALMATY" | "ASTANA";
  address: string;
  lat: number;
  lng: number;
  phone: string;
  open: [string, string];
  bags: Bag[];
};

const STORES: DemoStore[] = [
  // ── Almaty ──
  {
    email: "nauryz.nan@example.com", owner: "Айгерим Нурлановна", name: "Наурыз нан",
    description: "Тандырный нан, бауырсаки и домашняя выпечка по семейным рецептам.",
    city: "ALMATY", address: "ул. Толе би, 101", lat: 43.2526, lng: 76.9103, phone: "+77272000011", open: ["07:00", "21:00"],
    bags: [
      { title: "Нан и бауырсаки", description: "Тандырный нан, бауырсаки и булочки, испечённые сегодня.", category: "BAKERY", image: photo("1509440159596-0249088772ff"), price: 990, original: 3000, quantity: 6, start: "19:00", end: "21:00", halal: true, vegetarian: true, allergens: "GLUTEN,MILK,EGGS" },
      { title: "Утренний пакет выпечки", description: "Вчерашняя выпечка — всё ещё вкусная к завтраку.", category: "BAKERY", image: photo("1555507036-ab1f4038808a"), price: 790, original: 2500, quantity: 4, start: "08:00", end: "10:00", halal: true, vegetarian: true, allergens: "GLUTEN,MILK,EGGS" },
    ],
  },
  {
    email: "arba.coffee@example.com", owner: "Данияр Касымов", name: "Кофейня «Арба»",
    description: "Кофе, круассаны и десерты в центре города.",
    city: "ALMATY", address: "пр. Достык, 48", lat: 43.2449, lng: 76.9576, phone: "+77272000012", open: ["08:00", "22:00"],
    bags: [
      { title: "Десерты к кофе", description: "Круассаны, маффины и пирожные, оставшиеся к вечеру.", category: "BAKERY", image: photo("1509042239860-f550ce710b93"), price: 1290, original: 4000, quantity: 5, start: "20:00", end: "21:30", vegetarian: true, allergens: "GLUTEN,MILK,EGGS,NUTS" },
    ],
  },
  {
    email: "sushi.wave@example.com", owner: "Тимур Ахметов", name: "Sushi Wave",
    description: "Роллы и суши из свежей рыбы, готовим каждый день.",
    city: "ALMATY", address: "ул. Сатпаева, 22", lat: 43.2382, lng: 76.9248, phone: "+77272000013", open: ["11:00", "23:00"],
    bags: [
      { title: "Роллы в конце дня", description: "Сет из роллов, приготовленных сегодня.", category: "MEALS", image: photo("1579871494447-9811cf80d66c"), price: 2490, original: 8000, quantity: 4, start: "21:30", end: "23:00", allergens: "FISH,SOY,SESAME,GLUTEN" },
    ],
  },
  {
    email: "fresh.samal@example.com", owner: "Мадина Сейткали", name: "Fresh Market Самал",
    description: "Продуктовый магазин у дома: фрукты, овощи, молочка.",
    city: "ALMATY", address: "мкр. Самал-2, 58", lat: 43.2333, lng: 76.9547, phone: "+77272000014", open: ["08:00", "23:00"],
    bags: [
      { title: "Продуктовый пакет", description: "Молочные продукты, хлеб и бакалея с коротким сроком.", category: "GROCERIES", image: photo("1542838132-92c53300491e"), price: 1990, original: 6500, quantity: 6, start: "20:00", end: "22:00", allergens: "MILK,GLUTEN" },
      { title: "Фрукты и овощи", description: "Немного неидеальные, но свежие фрукты и овощи.", category: "PRODUCE", image: photo("1610832958506-aa56368176cf"), price: 1290, original: 4000, quantity: 5, start: "18:00", end: "20:00", vegan: true, vegetarian: true, halal: true },
    ],
  },
  {
    email: "green.plate@example.com", owner: "Алина Ким", name: "Зелёная тарелка",
    description: "Веганское кафе: боулы, салаты и супы.",
    city: "ALMATY", address: "ул. Кабанбай батыра, 85", lat: 43.2507, lng: 76.9418, phone: "+77272000015", open: ["10:00", "21:00"],
    bags: [
      { title: "Веганский обед", description: "Боул или салат и суп дня.", category: "MEALS", image: photo("1512621776951-a57141f2eefd"), price: 1590, original: 5000, quantity: 5, start: "15:00", end: "17:00", vegan: true, vegetarian: true, allergens: "SESAME,NUTS" },
      { title: "Ужин-сюрприз", description: "То, что осталось на кухне к закрытию.", category: "MEALS", image: photo("1547592180-85f173990554"), price: 1390, original: 4500, quantity: 4, start: "20:00", end: "21:00", vegan: true, vegetarian: true },
    ],
  },
  {
    email: "pancake.house@example.com", owner: "Ерлан Абенов", name: "Блинная «Тәтті»",
    description: "Блины, сырники и завтраки весь день.",
    city: "ALMATY", address: "ул. Жандосова, 34", lat: 43.2236, lng: 76.9058, phone: "+77272000016", open: ["08:00", "20:00"],
    bags: [
      { title: "Сладкий пакет", description: "Блины, сырники и выпечка к чаю.", category: "MIXED", image: photo("1567620905732-2d1ec7ab7445"), price: 1190, original: 3600, quantity: 5, start: "18:30", end: "20:00", vegetarian: true, halal: true, allergens: "GLUTEN,MILK,EGGS" },
    ],
  },
  // ── Astana ──
  {
    email: "shanyrak.cafe@example.com", owner: "Нұрлан Жақсылықов", name: "Шаңырақ кафе",
    description: "Домашняя казахская кухня: супы, второе и выпечка.",
    city: "ASTANA", address: "ул. Кенесары, 52", lat: 51.1694, lng: 71.4491, phone: "+77172000011", open: ["09:00", "22:00"],
    bags: [
      { title: "Домашняя кухня", description: "Суп дня, второе блюдо и нан.", category: "MEALS", image: photo("1504674900247-0877df9cc836"), price: 1790, original: 5500, quantity: 6, start: "20:30", end: "22:00", halal: true, allergens: "GLUTEN" },
    ],
  },
  {
    email: "bake.house@example.com", owner: "Сабина Омарова", name: "Bake House",
    description: "Кондитерская: торты, пирожные, печенье.",
    city: "ASTANA", address: "пр. Мангилик Ел, 37", lat: 51.1283, lng: 71.4305, phone: "+77172000012", open: ["09:00", "21:00"],
    bags: [
      { title: "Торты и пирожные", description: "Кусочки тортов и пирожные из сегодняшней витрины.", category: "BAKERY", image: photo("1563729784474-d77dbb933a9e"), price: 1490, original: 5000, quantity: 5, start: "19:30", end: "21:00", vegetarian: true, allergens: "GLUTEN,MILK,EGGS,NUTS" },
      { title: "Печенье к чаю", description: "Домашнее печенье на развес.", category: "BAKERY", image: photo("1499636136210-6f4ee915583e"), price: 690, original: 2000, quantity: 8, start: "12:00", end: "14:00", vegetarian: true, allergens: "GLUTEN,MILK,EGGS" },
    ],
  },
  {
    email: "napoli.pizza@example.com", owner: "Арман Сериков", name: "Pizza Napoli",
    description: "Неаполитанская пицца из дровяной печи.",
    city: "ASTANA", address: "ул. Достык, 9", lat: 51.1269, lng: 71.4294, phone: "+77172000013", open: ["11:00", "23:30"],
    bags: [
      { title: "Пицца-сюрприз", description: "Одна-две пиццы, оставшиеся к закрытию.", category: "MEALS", image: photo("1574071318508-1cdbab80d002"), price: 1990, original: 6500, quantity: 4, start: "22:00", end: "23:30", vegetarian: true, allergens: "GLUTEN,MILK" },
    ],
  },
  {
    email: "ramen.bar@example.com", owner: "Динара Исаева", name: "Ramen Bar",
    description: "Рамен, бульоны и азиатские закуски.",
    city: "ASTANA", address: "ул. Туран, 24", lat: 51.1335, lng: 71.4069, phone: "+77172000014", open: ["12:00", "23:00"],
    bags: [
      { title: "Рамен на вечер", description: "Бульон, лапша и топпинги, чтобы собрать рамен дома.", category: "MEALS", image: photo("1569718212165-3a8278d5f624"), price: 1690, original: 5200, quantity: 5, start: "21:00", end: "22:30", allergens: "GLUTEN,EGGS,SOY,SESAME" },
    ],
  },
];

async function main() {
  const passwordHash = await hashPassword("password123");
  const added: string[] = [];
  for (const demo of STORES) {
    if (await prisma.user.findUnique({ where: { email: demo.email } })) continue;
    const fields = { name: demo.name, description: demo.description, address: demo.address };
    await prisma.user.create({
      data: {
        email: demo.email, name: demo.owner, passwordHash, role: "STORE_OWNER",
        consentAt: new Date(), consentVersion: LEGAL_VERSION,
        stores: {
          create: {
            ...fields, searchText: storeSearchText(fields), city: demo.city, latitude: demo.lat, longitude: demo.lng,
            phone: demo.phone, openingHours: hours(...demo.open), status: "APPROVED", reviewedAt: new Date(),
            schedules: {
              create: demo.bags.map((bag) => ({
                title: bag.title, description: bag.description, category: bag.category, imageUrl: bag.image,
                // Snapped to the fixed price levels (src/lib/pricing.ts).
                originalPrice: nearestLevel(tenge(bag.price)).value, price: nearestLevel(tenge(bag.price)).price, quantity: bag.quantity,
                weekdays: EVERY_DAY, startTime: bag.start, endTime: bag.end,
                isHalal: bag.halal ?? false, isVegetarian: bag.vegetarian ?? false, isVegan: bag.vegan ?? false,
                allergens: bag.allergens ?? "",
              })),
            },
          },
        },
      },
    });
    added.push(`${demo.name} (${demo.city === "ALMATY" ? "Алматы" : "Астана"}): ${demo.email}`);
  }
  console.log(added.length ? `Added ${added.length} stores:\n  ${added.join("\n  ")}` : "All demo stores already exist.");
  console.log("Their bags appear by themselves within a minute while the site runs (npm run dev / demo).");
}

main().finally(() => prisma.$disconnect());

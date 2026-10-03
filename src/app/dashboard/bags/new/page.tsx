import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BagForm } from "@/components/dashboard/BagForm";
import { getI18n } from "@/i18n/server";
import { toDateInput } from "@/i18n/shared";
import { prisma } from "@/lib/prisma";
import { priceLevels } from "@/lib/pricing";
import { requireOwner } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.newBag };
}

export default async function NewBagPage() {
  const user = await requireOwner("/dashboard/bags/new");
  const stores = await prisma.store.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } });
  if (stores.length === 0) redirect("/dashboard"); // set up a store first
  const t = (await getI18n()).dict.dashboard;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">{t.newBagTitle}</h1>
      <p className="mt-1 text-stone-600">{t.newBagSubtitle}</p>
      <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-stone-200 sm:p-8">
        <BagForm
          mode="new"
          stores={stores}
          levels={priceLevels()}
          defaults={{
            weekdays: "1,2,3,4,5,6,7", // a new regular bag starts as every day
            storeId: stores[0].id,
            category: "MIXED",
            quantity: "3",
            priceLevel: String(priceLevels()[0].price / 100),
            date: toDateInput(new Date()),
            start: "17:00",
            end: "19:00",
          }}
        />
      </div>
    </main>
  );
}

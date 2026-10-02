import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BagForm } from "@/components/dashboard/BagForm";
import { toDateInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";

export const metadata: Metadata = { title: "Add a bag · FoodRescue" };

export default async function NewBagPage() {
  const user = await requireOwner("/dashboard/bags/new");
  const stores = await prisma.store.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } });
  if (stores.length === 0) redirect("/dashboard"); // set up a store first

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">Add a surprise bag</h1>
      <p className="mt-1 text-stone-600">Customers will see it on the homepage right away.</p>
      <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-stone-200 sm:p-8">
        <BagForm
          stores={stores}
          defaults={{
            storeId: stores[0].id,
            category: "MIXED",
            quantity: "3",
            date: toDateInput(new Date()),
            start: "17:00",
            end: "19:00",
          }}
        />
      </div>
    </main>
  );
}

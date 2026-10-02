import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BagForm } from "@/components/dashboard/BagForm";
import { toDateInput, toPriceInput, toTimeInput } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";

export const metadata: Metadata = { title: "Edit bag · FoodRescue" };

export default async function EditBagPage({ params }: PageProps<"/dashboard/bags/[id]/edit">) {
  const { id } = await params;
  const user = await requireOwner(`/dashboard/bags/${id}/edit`);

  const [bag, stores] = await Promise.all([
    // Only find the bag if it belongs to one of this owner's stores.
    prisma.surpriseBag.findFirst({ where: { id, store: { ownerId: user.id } } }),
    prisma.store.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } }),
  ]);
  if (!bag) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">Edit bag</h1>
      <p className="mt-1 text-stone-600">Existing reservations keep the price customers paid.</p>
      <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-stone-200 sm:p-8">
        <BagForm
          stores={stores}
          bagId={bag.id}
          defaults={{
            storeId: bag.storeId,
            title: bag.title,
            description: bag.description ?? "",
            category: bag.category,
            originalPrice: toPriceInput(bag.originalPrice),
            price: toPriceInput(bag.price),
            quantity: String(bag.quantityAvailable),
            date: toDateInput(bag.pickupStart),
            start: toTimeInput(bag.pickupStart),
            end: toTimeInput(bag.pickupEnd),
          }}
        />
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BagForm } from "@/components/dashboard/BagForm";
import { getI18n } from "@/i18n/server";
import { toDateInput, toTimeInput } from "@/i18n/shared";
import { prisma } from "@/lib/prisma";
import { nearestLevel, priceLevels } from "@/lib/pricing";
import { requireOwner } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.editBag };
}

export default async function EditBagPage({ params }: PageProps<"/dashboard/bags/[id]/edit">) {
  const { id } = await params;
  const user = await requireOwner(`/dashboard/bags/${id}/edit`);

  const [bag, stores] = await Promise.all([
    // Only find the bag if it belongs to one of this owner's stores.
    prisma.surpriseBag.findFirst({ where: { id, store: { ownerId: user.id } } }),
    prisma.store.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } }),
  ]);
  if (!bag) notFound();
  const t = (await getI18n()).dict.dashboard;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">{t.editBagTitle}</h1>
      <p className="mt-1 text-stone-600">{t.editBagSubtitle}</p>
      <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-stone-200 sm:p-8">
        <BagForm
          mode="bag"
          stores={stores}
          levels={priceLevels()}
          bagId={bag.id}
          fromScheduleId={bag.scheduleId}
          defaults={{
            storeId: bag.storeId,
            title: bag.title,
            description: bag.description ?? "",
            imageUrl: bag.imageUrl ?? "",
            isHalal: bag.isHalal ? "true" : "",
            isVegetarian: bag.isVegetarian ? "true" : "",
            isVegan: bag.isVegan ? "true" : "",
            allergens: bag.allergens,
            category: bag.category,
            // Older bags may have any price: start on the nearest level.
            priceLevel: String(nearestLevel(bag.price).price / 100),
            quantity: String(bag.quantityAvailable),
            date: toDateInput(bag.pickupStart),
            start: toTimeInput(bag.pickupStart),
            end: toTimeInput(bag.pickupEnd),
            // If it's turned into a regular bag: start with its own weekday ticked (1 = Monday).
            weekdays: String(((new Date(`${toDateInput(bag.pickupStart)}T12:00:00Z`).getUTCDay() + 6) % 7) + 1),
          }}
        />
      </div>
    </main>
  );
}

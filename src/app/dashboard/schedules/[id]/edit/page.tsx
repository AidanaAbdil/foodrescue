import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BagForm } from "@/components/dashboard/BagForm";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { nearestLevel, priceLevels } from "@/lib/pricing";
import { requireOwner } from "@/lib/session";
import { Doodle } from "@/components/Doodle";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.editSchedule };
}

export default async function EditSchedulePage({ params }: PageProps<"/dashboard/schedules/[id]/edit">) {
  const { id } = await params;
  const user = await requireOwner(`/dashboard/schedules/${id}/edit`);
  const [schedule, stores] = await Promise.all([
    // Only the owner's own regular bags.
    prisma.bagSchedule.findFirst({ where: { id, store: { ownerId: user.id } } }),
    prisma.store.findMany({ where: { ownerId: user.id }, select: { id: true, name: true } }),
  ]);
  if (!schedule) notFound();
  const t = (await getI18n()).dict.dashboard;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="flex items-center gap-3 text-3xl font-bold"><Doodle name="repeat" size={32} className="text-accent" />{t.editScheduleTitle}</h1>
      <p className="mt-1 text-stone-600">{t.editScheduleSubtitle}</p>
      <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-stone-200 sm:p-8">
        <BagForm
          mode="schedule"
          scheduleId={schedule.id}
          stores={stores}
          levels={priceLevels()}
          defaults={{
            storeId: schedule.storeId,
            title: schedule.title,
            description: schedule.description ?? "",
            imageUrl: schedule.imageUrl ?? "",
            isHalal: schedule.isHalal ? "true" : "",
            isVegetarian: schedule.isVegetarian ? "true" : "",
            isVegan: schedule.isVegan ? "true" : "",
            allergens: schedule.allergens,
            category: schedule.category,
            // Older bags may have any price: start on the nearest level.
            priceLevel: String(nearestLevel(schedule.price).price / 100),
            quantity: String(schedule.quantity),
            weekdays: schedule.weekdays,
            start: schedule.startTime,
            end: schedule.endTime,
          }}
        />
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreForm } from "@/components/dashboard/StoreForm";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.editStore };
}

export default async function EditStorePage({ params }: PageProps<"/dashboard/stores/[id]/edit">) {
  const { id } = await params;
  const user = await requireOwner(`/dashboard/stores/${id}/edit`);
  // Only the owner's own store.
  const store = await prisma.store.findFirst({ where: { id, ownerId: user.id } });
  if (!store) notFound();
  const t = (await getI18n()).dict.dashboard;

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-3xl font-bold">{t.editStoreTitle}</h1>
      <p className="mt-1 text-stone-600">{t.editStoreSubtitle}</p>
      <div className="mt-6 rounded-2xl bg-white p-6 ring-1 ring-stone-200 sm:p-8">
        <StoreForm store={store} />
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.adminTools.logTitle };
}

// Everything admins did, newest first.
export default async function AdminLogPage() {
  await requireAdmin("/admin/log");
  const { dict, f } = await getI18n();
  const t = dict.adminTools;
  const entries = await prisma.adminLog.findMany({
    include: { admin: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link href="/admin" className="text-sm font-medium text-stone-500 hover:text-brand-dark">{dict.report.back}</Link>
      <h1 className="mt-2 text-3xl font-bold">{t.logTitle}</h1>
      <p className="mt-1 text-sm text-stone-500">{t.logHint}</p>
      {entries.length === 0 ? (
        <p className="mt-6 text-stone-600">{t.logEmpty}</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          {entries.map((entry) => (
            <li key={entry.id} className="p-4 text-sm">
              <p className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{t.logActions[entry.action as keyof typeof t.logActions] ?? entry.action}</span>
                <span className="text-stone-500">{f.date(entry.createdAt)}, {f.time(entry.createdAt)}</span>
              </p>
              {entry.details && <p className="mt-1 text-stone-700">{entry.details}</p>}
              <p className="mt-1 text-xs text-stone-500">{entry.admin.name} ({entry.admin.email})</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

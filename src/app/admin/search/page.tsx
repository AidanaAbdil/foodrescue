import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { blockUser, cancelAndRefund, hideBag, unblockUser, unhideBag } from "@/app/actions/admin";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { searchWords } from "@/lib/search";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.adminTools.searchTitle };
}

const button = "rounded-lg px-3 py-1.5 text-sm font-semibold ring-1";
const input = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light";

// Find users (name or email), orders (pickup code) and bags (title), and act on them.
export default async function AdminSearchPage({ searchParams }: PageProps<"/admin/search">) {
  await requireAdmin("/admin/search");
  const { dict, f, fill } = await getI18n();
  const t = dict.adminTools;
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? raw.trim().slice(0, 100) : "";
  const back = `/admin/search?q=${encodeURIComponent(q)}`;

  // SQLite only ignores case for English letters, so names are also tried
  // lowercased and with each word capitalised ("алия нурланова" finds "Алия Нурланова").
  const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  const variants = [...new Set([q, q.toLowerCase(), capitalise(q), q.split(/\s+/).map(capitalise).join(" ")])];
  const words = searchWords(q);
  const [users, orders, bags] = q
    ? await Promise.all([
        prisma.user.findMany({
          where: { deletedAt: null, OR: [{ email: { contains: q.toLowerCase() } }, ...variants.map((v) => ({ name: { contains: v } }))] },
          include: { _count: { select: { orders: true } }, orders: { where: { status: "NO_SHOW" }, select: { id: true } }, stores: { select: { id: true, name: true, status: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.order.findMany({
          where: { pickupCode: { contains: q.toUpperCase() } },
          include: { user: { select: { name: true, email: true } }, bag: { include: { store: { select: { name: true } } } }, payment: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        words.length
          ? prisma.surpriseBag.findMany({
              where: { AND: words.map((word) => ({ OR: [{ searchText: { contains: word } }, { store: { searchText: { contains: word } } }] })) },
              include: { store: { select: { name: true } } },
              orderBy: { pickupStart: "desc" },
              take: 20,
            })
          : [],
      ])
    : [[], [], []];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/admin" className="text-sm font-medium text-stone-500 hover:text-brand-dark">{dict.report.back}</Link>
      <h1 className="mt-2 text-3xl font-bold">{t.searchTitle}</h1>
      <Form action="/admin/search" className="mt-4 flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{t.searchTitle}</span>
          <input type="search" name="q" defaultValue={q} placeholder={t.searchPlaceholder} className={input} autoFocus />
        </label>
        <button type="submit" className="rounded-lg bg-brand px-5 py-2 font-semibold text-white hover:bg-brand-dark">{t.search}</button>
      </Form>
      <p className="mt-2 text-sm text-stone-500">{t.searchHint}</p>

      {q && users.length + orders.length + bags.length === 0 && <p className="mt-8 text-stone-600">{t.nothing}</p>}

      {users.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t.users}</h2>
          <ul className="mt-3 space-y-3">
            {users.map((user) => (
              <li key={user.id} className={`rounded-2xl bg-white p-4 ring-1 ${user.blockedAt ? "ring-red-200" : "ring-stone-200"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p><span className="font-semibold">{user.name}</span> · <span className="text-stone-600">{user.email}</span></p>
                  <span className="text-sm text-stone-500">{t.roles[user.role]}</span>
                </div>
                <p className="mt-1 text-sm text-stone-600">
                  {fill(t.userLine, { orders: user._count.orders, noShows: user.orders.length, date: f.date(user.createdAt) })}
                  {user.stores.length > 0 && <> · {user.stores.map((store) => store.name).join(", ")}</>}
                </p>
                {user.blockedAt && <p className="mt-1 text-sm font-medium text-red-700">{fill(t.blocked, { reason: user.blockedReason ?? "—" })}</p>}
                {user.role !== "ADMIN" &&
                  (user.blockedAt ? (
                    <form action={unblockUser} className="mt-3">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="back" value={back} />
                      <button type="submit" className={`${button} text-stone-700 ring-stone-300 hover:bg-stone-100`}>{t.unblock}</button>
                    </form>
                  ) : (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm font-semibold text-red-700">{t.block}</summary>
                      <form action={blockUser} className="mt-2 space-y-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <input type="hidden" name="back" value={back} />
                        <label className="block text-sm">
                          <span className="text-stone-700">{t.blockReason}</span>
                          <input name="reason" required maxLength={300} className={`mt-1 ${input}`} />
                        </label>
                        <p className="text-xs text-stone-500">{t.blockHint}</p>
                        <button type="submit" className={`${button} bg-red-700 text-white ring-red-700 hover:bg-red-800`}>{t.block}</button>
                      </form>
                    </details>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      )}

      {orders.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t.orders}</h2>
          <ul className="mt-3 divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p>
                    <span className="font-mono font-semibold">{order.pickupCode}</span> · {order.bag.store.name} · {order.bag.title} · {f.price(order.totalPrice)}
                  </p>
                  <p className="text-stone-600">
                    {order.user.name} ({order.user.email}) · {f.pickupWindow(order.bag.pickupStart, order.bag.pickupEnd)} ·{" "}
                    <span className="font-medium">{dict.orders.status[order.status]}</span>
                    {order.payment?.status === "REFUNDED" && <> · {dict.orders.refunded}</>}
                  </p>
                </div>
                {order.status === "RESERVED" && (
                  <form action={cancelAndRefund}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="back" value={back} />
                    <button type="submit" className={`${button} text-red-700 ring-red-200 hover:bg-red-50`}>{dict.admin.cancelRefund}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {bags.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t.bags}</h2>
          <ul className="mt-3 space-y-3">
            {bags.map((bag) => (
              <li key={bag.id} className={`rounded-2xl bg-white p-4 text-sm ring-1 ${bag.hiddenByAdminAt ? "ring-red-200" : "ring-stone-200"}`}>
                <p>
                  <Link href={`/bags/${bag.id}`} className="font-semibold hover:text-brand-dark hover:underline">{bag.title}</Link> · {bag.store.name} ·{" "}
                  {f.pickupWindow(bag.pickupStart, bag.pickupEnd)} · {f.price(bag.price)}
                </p>
                {bag.hiddenByAdminAt ? (
                  <form action={unhideBag} className="mt-2 flex items-center gap-3">
                    <input type="hidden" name="bagId" value={bag.id} />
                    <input type="hidden" name="back" value={back} />
                    <span className="font-medium text-red-700">{t.hiddenByAdmin}</span>
                    <button type="submit" className={`${button} text-stone-700 ring-stone-300 hover:bg-stone-100`}>{t.unhide}</button>
                  </form>
                ) : (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-semibold text-red-700">{t.hide}</summary>
                    <form action={hideBag} className="mt-2 space-y-2">
                      <input type="hidden" name="bagId" value={bag.id} />
                      <input type="hidden" name="back" value={back} />
                      <label className="block">
                        <span className="text-stone-700">{t.hideReason}</span>
                        <input name="reason" maxLength={300} className={`mt-1 ${input}`} />
                      </label>
                      <button type="submit" className={`${button} bg-red-700 text-white ring-red-700 hover:bg-red-800`}>{t.hide}</button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

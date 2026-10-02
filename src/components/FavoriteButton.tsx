import Link from "next/link";
import { toggleFavorite } from "@/app/actions/favorites";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, loginUrl } from "@/lib/session";

// ♡ button for a store. Logged out → log in first and come back.
// Hidden for store and admin accounts (favourites are for customers).
export async function FavoriteButton({ storeId, back }: { storeId: string; back: string }) {
  const [user, { dict }] = await Promise.all([getCurrentUser(), getI18n()]);
  const t = dict.favorites;
  const chip = "inline-block rounded-full px-4 py-2 text-sm font-semibold ring-1 transition";

  if (!user) {
    return (
      <Link href={loginUrl(back)} className={`${chip} text-stone-700 ring-stone-300 hover:bg-stone-100`}>
        {t.loginToSave}
      </Link>
    );
  }
  if (user.role !== "CUSTOMER") return null;

  const isFavorite = Boolean(
    await prisma.favorite.findUnique({ where: { userId_storeId: { userId: user.id, storeId } } }),
  );
  return (
    <form action={toggleFavorite}>
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="back" value={back} />
      <button
        type="submit"
        aria-pressed={isFavorite}
        className={`${chip} ${
          isFavorite ? "bg-brand-light text-brand-dark ring-brand-light" : "text-stone-700 ring-stone-300 hover:bg-stone-100"
        }`}
      >
        {isFavorite ? t.added : t.add}
      </button>
    </form>
  );
}

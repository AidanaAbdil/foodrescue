import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { Doodle } from "@/components/Doodle";

// Shown for unknown URLs and whenever a page calls notFound().
export default async function NotFound() {
  const t = (await getI18n()).dict.notFound;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-20 text-center">
      <div className="flex justify-center text-brand" aria-hidden>
        <Doodle name="bowl" size={72} />
      </div>
      <h1 className="mt-4 text-2xl font-bold">{t.title}</h1>
      <p className="mt-2 text-stone-600">{t.text}</p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark"
      >
        {t.home}
      </Link>
    </main>
  );
}

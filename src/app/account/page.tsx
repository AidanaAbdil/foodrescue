import type { Metadata } from "next";
import { AccountForms } from "@/components/AccountForms";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.account };
}

export default async function AccountPage() {
  const user = await requireUser("/account");
  const t = (await getI18n()).dict.account;
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-3xl font-bold">{t.title}</h1>
      <div className="mt-6">
        <AccountForms name={user.name} email={user.email} />
      </div>
    </main>
  );
}

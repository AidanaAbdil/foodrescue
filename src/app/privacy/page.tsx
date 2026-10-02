import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { LEGAL } from "@/content/legal";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: LEGAL[(await getI18n()).locale].privacy.title };
}

export default function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}

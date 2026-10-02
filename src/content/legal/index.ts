// Privacy policy and terms of use, in all three languages.
//
// DRAFTS: written as a starting point, not legal advice. Have them reviewed
// by a lawyer in Kazakhstan before launch, and fill in the [placeholders]
// (operator details, contact email) once the ИП is registered.
//
// Changing the meaning of either text? Bump LEGAL_VERSION: users who agreed
// to an older version are asked to agree again (see ConsentBanner).
import type { Locale } from "@/i18n/config";
import { en } from "./en";
import { kk } from "./kk";
import { ru } from "./ru";

export const LEGAL_VERSION = "2026-10-02";
export const LEGAL_IS_DRAFT = true;

export type LegalDoc = {
  title: string;
  sections: { heading: string; body: string[] }[];
};
export type LegalTexts = { privacy: LegalDoc; terms: LegalDoc; draftNote: string; updated: string };

export const LEGAL: Record<Locale, LegalTexts> = { ru, kk, en };

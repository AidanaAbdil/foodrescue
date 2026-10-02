"use server";
// Map ↔ address lookups for the store form. Store owners only (it uses a free
// shared service with strict limits; see src/lib/geocode.ts).

import { getDictionaryFor, getI18n } from "@/i18n/server";
import { CITIES, isCity } from "@/lib/cities";
import { addressAt, findPlace } from "@/lib/geocode";
import { isValidCoords } from "@/lib/geo";
import { requireOwner } from "@/lib/session";

export async function lookupAddress(address: string, city: string) {
  await requireOwner();
  const clean = String(address).trim().slice(0, 200);
  if (clean.length < 3 || !isCity(city)) return null;
  try {
    return await findPlace(clean, { ...CITIES[city], ruName: getDictionaryFor("ru").cities[city] });
  } catch (error) {
    console.error("Address lookup failed", error);
    return null;
  }
}

export async function lookupPoint(lat: number, lng: number) {
  await requireOwner();
  if (!isValidCoords(lat, lng)) return null;
  const { locale } = await getI18n();
  try {
    return await addressAt(lat, lng, locale);
  } catch (error) {
    console.error("Reverse lookup failed", error);
    return null;
  }
}

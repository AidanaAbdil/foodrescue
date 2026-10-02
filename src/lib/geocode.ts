// Address ↔ map point, using OpenStreetMap's free Nominatim service.
// Its rules (operations.osmfoundation.org/policies/nominatim): at most one
// request per second, identify the app, cache results, and NO search-as-you-type.
// Everything goes through here so those rules hold. For live suggestions and
// better house-level data in Kazakhstan, switch this file to 2GIS (needs a key).
import "server-only";

import type { Locale } from "@/i18n/config";

const BASE = "https://nominatim.openstreetmap.org";
const USER_AGENT = "FoodRescue/0.1 (store address lookup; https://github.com/AidanaAbdil/foodrescue)";

// Results are remembered (addresses don't change often), up to a limit.
const cache = new Map<string, unknown>();
const remember = (key: string, value: unknown) => {
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
  return value;
};

// One request per second, across the whole server.
let nextSlot = 0;
async function politely<T>(fn: () => Promise<T>) {
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Date.now() + wait + 1100;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  return fn();
}

async function call(path: string, params: Record<string, string>) {
  const url = `${BASE}${path}?${new URLSearchParams({ format: "jsonv2", ...params })}`;
  if (cache.has(url)) return cache.get(url);
  const response = await politely(() =>
    fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8000) }),
  );
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  return remember(url, await response.json());
}

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  city?: string;
  town?: string;
};

// Common abbreviations the search doesn't understand ("пр. Абая 52" → "проспект Абая 52").
const ABBREVIATIONS: [RegExp, string][] = [
  [/(^|\s)пр(-т|\.)?\s/giu, "$1проспект "],
  [/(^|\s)ул\.?\s/giu, "$1улица "],
  [/(^|\s)мкр(-н|\.)?\s?/giu, "$1микрорайон "],
  [/(^|\s)б-р\.?\s/giu, "$1бульвар "],
  [/(^|\s)д\.\s?/giu, "$1"],
  [/(^|\s)даңғ\.?\s/giu, "$1даңғылы "],
  [/(^|\s)көш\.?\s/giu, "$1көшесі "],
];
const expand = (text: string) => ABBREVIATIONS.reduce((out, [pattern, full]) => out.replace(pattern, full), ` ${text} `).trim();

// Address text → point. Only accepts a result that is really in the chosen
// city: streets with the same name exist in nearby towns (e.g. Kaskelen),
// and a confidently wrong pin is worse than asking the owner to place it.
export async function findPlace(address: string, city: { lat: number; lng: number; ruName: string }) {
  const results = (await call("/search", {
    q: expand(address),
    countrycodes: "kz",
    limit: "5",
    addressdetails: "1",
    "accept-language": "ru", // so the city name can be compared reliably
    bounded: "1",
    viewbox: `${city.lng - 0.3},${city.lat + 0.25},${city.lng + 0.3},${city.lat - 0.25}`,
  })) as { lat: string; lon: string; address?: NominatimAddress }[];
  const hit = results.find((result) => (result.address?.city ?? result.address?.town) === city.ruName);
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
}

// Point → short street address like "улица Жандосова, 58" (or null).
export async function addressAt(lat: number, lng: number, locale: Locale) {
  const result = (await call("/reverse", {
    lat: lat.toFixed(6),
    lon: lng.toFixed(6),
    zoom: "18",
    addressdetails: "1",
    "accept-language": locale,
  })) as { address?: NominatimAddress };
  const a = result.address;
  const street = a?.road ?? a?.pedestrian;
  if (!street) return null;
  return a?.house_number ? `${street}, ${a.house_number}` : street;
}

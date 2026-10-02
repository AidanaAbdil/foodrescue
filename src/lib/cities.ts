// Cities the service runs in. Stores pick one from this list (no free text),
// so the city filter never shows "Almaty" and "Алматы" as two cities.
// Names are translated in the dictionaries (`cities`). To add a city: add it
// here and to `cities` in each dictionary.

export const CITIES = {
  ALMATY: { lat: 43.2389, lng: 76.8897, zoom: 12 },
  ASTANA: { lat: 51.1605, lng: 71.4704, zoom: 12 },
} as const;

export type City = keyof typeof CITIES;
export const CITY_LIST = Object.keys(CITIES) as City[];

export const isCity = (value: unknown): value is City =>
  typeof value === "string" && Object.hasOwn(CITIES, value);

// The city a map point is in (within ~50 km of its centre), if any.
export function cityAt(lat: number, lng: number): City | null {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  for (const city of CITY_LIST) {
    const c = CITIES[city];
    const dLat = toRad(c.lat - lat);
    const dLng = toRad(c.lng - lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(c.lat)) * Math.sin(dLng / 2) ** 2;
    if (2 * 6371 * Math.asin(Math.sqrt(h)) < 50) return city;
  }
  return null;
}

// Display name of a stored city code, e.g. cityName(dict.cities, "ALMATY") → "Алматы".
export const cityName = (names: Record<City, string>, code: string) => (isCity(code) ? names[code] : code);

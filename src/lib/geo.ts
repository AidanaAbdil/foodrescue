// Distance helpers for "near me".

export type Coords = { lat: number; lng: number };

const EARTH_RADIUS_MILES = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

// Straight-line ("as the crow flies") distance using the haversine formula.
export function distanceMiles(a: Coords, b: Coords) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

export const formatDistance = (miles: number) => (miles < 0.1 ? "< 0.1 mi" : `${miles.toFixed(1)} mi`);

export const isValidCoords = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// Parse "39.78,-89.65" (from the URL) into coordinates, or null.
export function parseCoords(value: unknown): Coords | null {
  if (typeof value !== "string") return null;
  const [lat, lng] = value.split(",").map(Number);
  return isValidCoords(lat, lng) ? { lat, lng } : null;
}

// Kazakhstan phone numbers (+7 and 10 digits), stored as "+77011234567".
// Accepts what people actually type: "8 701 123 45 67", "+7 (701) 123-45-67",
// "701 123 45 67", "87272000000" (Almaty landline) …

export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 10) digits = `7${digits}`; // without the country code
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`; // 8 instead of +7
  return digits.length === 11 && digits.startsWith("7") ? `+${digits}` : null;
}

// "+77011234567" → "+7 701 123 45 67"
export function formatPhone(stored: string) {
  const d = stored.replace(/\D/g, "");
  return d.length === 11 ? `+${d[0]} ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}` : stored;
}

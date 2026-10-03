// Opening hours, picked per weekday in the store form. Saved in
// Store.openingHours as JSON: 7 entries, Monday first, each ["09:00", "22:00"]
// or null (closed). Older stores may still have free text there; it's shown as is.

export type DayHours = [string, string] | null;
export type Week = DayHours[];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseHours(value: string | null | undefined): Week | null {
  if (!value?.startsWith("[")) return null;
  try {
    const week: unknown = JSON.parse(value);
    if (!Array.isArray(week) || week.length !== 7) return null;
    const valid = week.every(
      (day) => day === null || (Array.isArray(day) && day.length === 2 && TIME.test(day[0]) && TIME.test(day[1]) && day[0] !== day[1]),
    );
    return valid && week.some((day) => day !== null) ? (week as Week) : null;
  } catch {
    return null;
  }
}

export const serializeHours = (week: Week) => JSON.stringify(week);

// "Пн–Пт 09:00–21:00, Сб–Вс 10:00–20:00" / "Ежедневно 09:00–22:00".
// Days in a row with the same hours are grouped.
export function formatHours(
  value: string | null | undefined,
  t: { weekdays: readonly string[]; daily: string; closed: string },
) {
  const week = parseHours(value);
  if (!week) return value?.trim() || null; // older free-text hours
  const time = (day: DayHours) => (day ? `${day[0]}–${day[1]}` : t.closed);
  if (week.every((day) => time(day) === time(week[0])) && week[0]) return t.daily.replace("{time}", time(week[0]));

  const groups: { from: number; to: number; hours: string }[] = [];
  week.forEach((day, i) => {
    const last = groups.at(-1);
    if (last && last.hours === time(day) && last.to === i - 1) last.to = i;
    else groups.push({ from: i, to: i, hours: time(day) });
  });
  return groups
    .map(({ from, to, hours }) => {
      const days = from === to ? t.weekdays[from] : `${t.weekdays[from]}${to === from + 1 ? ", " : "–"}${t.weekdays[to]}`;
      return `${days} ${hours}`;
    })
    .join(", ");
}

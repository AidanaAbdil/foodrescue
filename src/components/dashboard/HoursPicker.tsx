"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { parseHours, serializeHours, type Week } from "@/lib/hours";

const DEFAULT: [string, string] = ["09:00", "21:00"];

// Opening hours: a row per weekday with "open" and two time pickers. The
// result goes to the server as JSON in a hidden "openingHours" field.
export function HoursPicker({ initial }: { initial: string }) {
  const { dict } = useI18n();
  const t = dict.dashboard;
  const parsed = parseHours(initial);
  const [enabled, setEnabled] = useState(parsed !== null);
  const [week, setWeek] = useState<Week>(parsed ?? Array.from({ length: 7 }, () => [...DEFAULT] as [string, string]));

  const setDay = (i: number, day: Week[number]) => setWeek((current) => current.map((d, j) => (j === i ? day : d)));
  const copyMondayToAll = () => setWeek((current) => current.map(() => (current[0] ? [...current[0]] : null)));

  return (
    <fieldset>
      <legend className="sr-only">{t.hours}</legend>
      <input type="hidden" name="openingHours" value={enabled ? serializeHours(week) : ""} />
      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="accent-brand" />
        {t.hoursToggle}
      </label>
      {enabled && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-stone-50 p-3 text-sm">
          {week.map((day, i) => (
            <div key={t.weekdays[i]} className="flex flex-wrap items-center gap-2">
              <label className="flex w-28 items-center gap-2 font-medium">
                <input type="checkbox" checked={day !== null} className="accent-brand"
                  onChange={(event) => setDay(i, event.target.checked ? (week[i] ?? [...DEFAULT]) : null)} />
                {t.weekdays[i]}
              </label>
              {day ? (
                <>
                  <input type="time" value={day[0]} required aria-label={`${t.weekdays[i]}: ${t.hoursOpen}`}
                    onChange={(event) => setDay(i, [event.target.value, day[1]])}
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1" />
                  <span aria-hidden>–</span>
                  <input type="time" value={day[1]} required aria-label={`${t.weekdays[i]}: ${t.hoursClose}`}
                    onChange={(event) => setDay(i, [day[0], event.target.value])}
                    className="rounded-lg border border-stone-300 bg-white px-2 py-1" />
                </>
              ) : (
                <span className="text-stone-500">{t.hoursClosed}</span>
              )}
            </div>
          ))}
          <button type="button" onClick={copyMondayToAll} className="mt-1 font-medium text-brand-dark underline underline-offset-2">
            {t.hoursCopy}
          </button>
        </div>
      )}
    </fieldset>
  );
}

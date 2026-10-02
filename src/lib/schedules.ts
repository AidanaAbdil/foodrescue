// Regular bags: turn each active BagSchedule into a SurpriseBag for today and
// tomorrow (Kazakhstan time), so customers can order a day ahead.
// Safe to run any number of times: the database allows only one bag per
// schedule per day (@@unique([scheduleId, scheduleDate])).
import "server-only";

import type { BagSchedule } from "@/generated/prisma/client";
import { dayKey, parseLocalDateTime } from "@/i18n/shared";
import { prisma } from "@/lib/prisma";

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const; // ISO: 1 = Monday … 7 = Sunday

export const parseWeekdays = (stored: string) => WEEKDAYS.filter((day) => stored.split(",").includes(String(day)));

// ISO weekday of a "2026-10-02" date.
function isoWeekday(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return day === 0 ? 7 : day;
}

// Pickup start/end for a schedule on a given day (end before start = next day).
export function windowFor(schedule: Pick<BagSchedule, "startTime" | "endTime">, date: string) {
  const start = parseLocalDateTime(date, schedule.startTime);
  let end = parseLocalDateTime(date, schedule.endTime);
  if (!start || !end) return null;
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// The bag fields copied from a schedule.
export const bagFieldsFrom = (schedule: BagSchedule) => ({
  storeId: schedule.storeId,
  title: schedule.title,
  description: schedule.description,
  category: schedule.category,
  imageUrl: schedule.imageUrl,
  isHalal: schedule.isHalal,
  isVegetarian: schedule.isVegetarian,
  isVegan: schedule.isVegan,
  allergens: schedule.allergens,
  originalPrice: schedule.originalPrice,
  price: schedule.price,
});

export async function publishScheduledBags(scheduleIds?: string[]) {
  const schedules = await prisma.bagSchedule.findMany({
    where: { isActive: true, store: { status: "APPROVED" }, ...(scheduleIds && { id: { in: scheduleIds } }) },
  });
  if (schedules.length === 0) return;

  const now = new Date();
  const days = [dayKey(now), dayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000))];
  const existing = await prisma.surpriseBag.findMany({
    where: { scheduleId: { in: schedules.map((s) => s.id) }, scheduleDate: { in: days } },
    select: { scheduleId: true, scheduleDate: true },
  });
  const have = new Set(existing.map((bag) => `${bag.scheduleId}|${bag.scheduleDate}`));

  for (const schedule of schedules) {
    const weekdays = parseWeekdays(schedule.weekdays);
    for (const date of days) {
      if (have.has(`${schedule.id}|${date}`) || !weekdays.includes(isoWeekday(date) as (typeof WEEKDAYS)[number])) continue;
      const window = windowFor(schedule, date);
      if (!window || window.end <= now) continue; // already over today
      try {
        await prisma.surpriseBag.create({
          data: {
            ...bagFieldsFrom(schedule),
            quantityAvailable: schedule.quantity,
            pickupStart: window.start,
            pickupEnd: window.end,
            scheduleId: schedule.id,
            scheduleDate: date,
          },
        });
      } catch {
        // Another request published it at the same moment (unique constraint): fine.
      }
    }
  }
}

// Upcoming bags from a schedule that nobody has ordered yet: safe to change or remove.
export const untouchedUpcoming = (scheduleId: string) => ({
  scheduleId,
  pickupStart: { gt: new Date() },
  orders: { none: {} },
});

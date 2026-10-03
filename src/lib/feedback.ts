// Ratings and problem reports after pickup.
import type { Order, SurpriseBag } from "@/generated/prisma/client";

export const PROBLEM_KINDS = ["QUALITY", "NOT_AS_DESCRIBED", "NO_FOOD", "OTHER"] as const;
export type ProblemKind = (typeof PROBLEM_KINDS)[number];
export const isProblemKind = (value: unknown): value is ProblemKind => PROBLEM_KINDS.includes(value as ProblemKind);

// Customers can rate or report for this long after the pickup window ends.
export const FEEDBACK_DAYS = 7;
// A store's average is shown publicly once it has this many ratings, so one
// unhappy customer can't sink a new store.
export const MIN_PUBLIC_REVIEWS = 3;

type OrderForFeedback = Pick<Order, "status"> & { bag: Pick<SurpriseBag, "pickupStart" | "pickupEnd"> };

const withinWindow = (order: OrderForFeedback, now: Date) =>
  now.getTime() - order.bag.pickupEnd.getTime() < FEEDBACK_DAYS * 24 * 60 * 60 * 1000;

// Rate: only orders actually handed over.
export const canRate = (order: OrderForFeedback, now = new Date()) => order.status === "COLLECTED" && withinWindow(order, now);

// Report a problem: handed over, marked "didn't show up", or still "reserved"
// after pickup started (e.g. the store was closed and nobody marked anything).
export const canReport = (order: OrderForFeedback, now = new Date()) =>
  (order.status === "COLLECTED" || order.status === "NO_SHOW" || (order.status === "RESERVED" && order.bag.pickupStart <= now)) &&
  withinWindow(order, now);

export const roundRating = (average: number) => Math.round(average * 10) / 10;

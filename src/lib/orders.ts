// Shared ordering rules, used by both the reserve form and the server action.
export const MAX_PER_ORDER = 3;

// Why a store couldn't hand over an order (shown to the customer).
export const CANCEL_REASONS = ["SOLD_OUT", "CLOSING", "OTHER"] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];
export const isCancelReason = (value: unknown): value is CancelReason =>
  CANCEL_REASONS.includes(value as CancelReason);

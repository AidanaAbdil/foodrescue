// "Become a partner" requests (the /partners page form).
export const BUSINESS_KINDS = ["BAKERY", "CAFE", "RESTAURANT", "SHOP", "OTHER"] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];
export const isBusinessKind = (value: unknown): value is BusinessKind => BUSINESS_KINDS.includes(value as BusinessKind);

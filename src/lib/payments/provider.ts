// A payment provider (Kaspi, Halyk ePay, …) behind one small interface.
// Only this folder changes when a real provider is connected; the rest of
// the app talks to service.ts.
import "server-only";

import { testProvider } from "./test-provider";

export type CreatePaymentInput = {
  paymentId: string; // our Payment.id, sent to the provider as the order reference
  amount: number; // tiyn
  description: string; // shown on the provider's page, e.g. "FoodRescue: Хлебный сюрприз × 2"
};

export interface PaymentProvider {
  name: string;
  // Start a payment. Returns where to send the customer to pay.
  createPayment(input: CreatePaymentInput): Promise<{ redirectUrl: string; providerPaymentId: string | null }>;
  // Where to send a customer who left the payment page and wants to finish paying.
  resumeUrl(payment: { id: string; providerPaymentId: string | null }): string;
  // Give the money back for a paid payment.
  refund(payment: { id: string; providerPaymentId: string | null; amount: number }): Promise<void>;
}

// Which provider to use comes from the PAYMENT_PROVIDER setting (.env).
// Real providers get added here as they're connected, e.g. kaspi: kaspiProvider.
const PROVIDERS: Record<string, PaymentProvider> = { test: testProvider };

export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "test";
  // Safety net: the test provider gives orders away for free, so it must
  // never run on the live site by accident.
  if (name === "test" && process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_PAYMENTS !== "true") {
    throw new Error("Test payments are disabled in production. Set PAYMENT_PROVIDER to a real provider.");
  }
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  return provider;
}

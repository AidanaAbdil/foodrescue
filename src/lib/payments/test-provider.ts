// Pretend payment provider for development. It sends the customer to our own
// /pay/test/<id> page, where they can choose "pay" or "decline". No money moves.
import "server-only";

import type { PaymentProvider } from "./provider";

export const testProvider: PaymentProvider = {
  name: "test",
  async createPayment({ paymentId }) {
    return { redirectUrl: `/pay/test/${paymentId}`, providerPaymentId: `test_${paymentId}` };
  },
  resumeUrl({ id }) {
    return `/pay/test/${id}`;
  },
  async refund() {
    // A real provider would call its refund API here and throw if it fails.
  },
};

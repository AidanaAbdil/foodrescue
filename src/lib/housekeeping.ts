// Background chores, run at the top of pages that show bags or orders (there's
// no scheduled job yet): release unpaid holds, retry refunds, publish regular bags.
import "server-only";

import { paymentHousekeeping } from "@/lib/payments/service";
import { publishScheduledBags } from "@/lib/schedules";

export async function runHousekeeping() {
  await paymentHousekeeping();
  await publishScheduledBags();
}

import { latestPaidOrder } from "@/lib/new-orders";
import { runHousekeeping } from "@/lib/housekeeping";
import { getCurrentUser } from "@/lib/session";

// Polled by the dashboard every few seconds: "what's my newest paid order?"
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "STORE_OWNER") return Response.json({ error: "unauthorized" }, { status: 401 });
  await runHousekeeping();
  return Response.json({ latest: await latestPaidOrder(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

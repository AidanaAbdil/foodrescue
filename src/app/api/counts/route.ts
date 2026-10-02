import { headerCount } from "@/lib/header-counts";
import { getCurrentUser } from "@/lib/session";

// Polled by the header so "Dashboard (2)" stays current without reloading.
export async function GET() {
  const count = await headerCount(await getCurrentUser());
  return Response.json({ count }, { headers: { "Cache-Control": "no-store" } });
}

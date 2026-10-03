// Runs once when the server starts (Next.js instrumentation). Starts the
// background timer for reminders and housekeeping; see src/lib/background.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return; // not while building
  if (process.env.BACKGROUND_JOBS === "off") return;
  const { startBackgroundJobs } = await import("./lib/background");
  startBackgroundJobs();
}

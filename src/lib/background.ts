// A timer inside the server that runs every minute, so things happen on time
// even when nobody has the site open:
//   - "pickup starts soon" reminders for customers, "pack N bags" for stores (src/lib/reminders.ts)
//   - housekeeping: expire unpaid orders, retry refunds, publish regular bags
// Started from src/instrumentation.ts. With several servers, each runs it;
// every job claims its rows first, so nothing is done twice.

const EVERY_MS = Number(process.env.BACKGROUND_EVERY_SECONDS ?? 60) * 1000;

const state = globalThis as unknown as { backgroundTimer?: ReturnType<typeof setInterval>; backgroundRunning?: boolean };

async function tick() {
  if (state.backgroundRunning) return; // the previous run is still going
  state.backgroundRunning = true;
  try {
    const { runHousekeeping } = await import("./housekeeping");
    await runHousekeeping();
    const { sendPackReminders, sendPickupReminders } = await import("./reminders");
    await sendPickupReminders();
    await sendPackReminders();
  } catch (error) {
    console.error("Background jobs failed", error);
  } finally {
    state.backgroundRunning = false;
  }
}

export function startBackgroundJobs() {
  if (state.backgroundTimer) return; // already running (development reloads)
  state.backgroundTimer = setInterval(tick, EVERY_MS);
  state.backgroundTimer.unref(); // never keeps the process alive on its own
  setTimeout(tick, 5_000).unref(); // first run shortly after start
}

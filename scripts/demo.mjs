// Share a demo of the site from this Mac:  npm run demo
//
// 1. builds the production version (fast, like the real site)
// 2. starts it on port 3001 with test payments allowed and a "demo" banner
// 3. opens a temporary public HTTPS link via Cloudflare (cloudflared)
// Press Ctrl+C to stop; the link stops working then.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 3001;
const CLOUDFLARED = [path.join(os.homedir(), ".local/bin/cloudflared"), "/opt/homebrew/bin/cloudflared", "/usr/local/bin/cloudflared"]
  .find((candidate) => existsSync(candidate));
if (!CLOUDFLARED) {
  console.error("cloudflared not found. See README → Demo link.");
  process.exit(1);
}

const env = { ...process.env, DEMO: "true", PAYMENT_PROVIDER: "test", ALLOW_TEST_PAYMENTS: "true" };

console.log("Building the site (about a minute)…");
const build = spawnSync("npx", ["next", "build"], { env, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: "inherit" });
const tunnel = spawn(CLOUDFLARED, ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`], {
  stdio: ["ignore", "ignore", "pipe"],
});

// cloudflared prints the random public address in its log.
tunnel.stderr.on("data", (chunk) => {
  const url = chunk.toString().match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
  if (url) {
    console.log(`\n  ✅ Demo is live — send this link to your friends:\n\n     ${url}\n\n  Keep this window open. Press Ctrl+C to stop.\n`);
  }
});

const stop = () => {
  tunnel.kill();
  server.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
tunnel.on("exit", (code) => {
  console.error(`Tunnel stopped (code ${code}).`);
  stop();
});

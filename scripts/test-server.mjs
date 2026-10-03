// Starts the site for the automated tests (npm test runs this by itself):
// 1. wipes and refills its own database, test.db, with the demo data
// 2. builds into .next-test (so it doesn't disturb `npm run dev` or a demo)
// 3. starts on port 3100 with test payments allowed
// Your real database (dev.db) is never touched.
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

export const TEST_ENV = {
  DATABASE_URL: "file:./test.db",
  NEXT_DIST_DIR: ".next-test",
  PAYMENT_PROVIDER: "test",
  ALLOW_TEST_PAYMENTS: "true",
  APP_URL: "http://localhost:3100",
};
const env = { ...process.env, ...TEST_ENV };

function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// A brand-new test database: delete the old test file, then create the tables.
for (const file of ["test.db", "test.db-journal"]) rmSync(file, { force: true });
run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["prisma", "db", "seed"]);
if (!process.env.SKIP_BUILD) run("npx", ["next", "build"]);
const server = spawn("npx", ["next", "start", "-p", "3100"], { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));

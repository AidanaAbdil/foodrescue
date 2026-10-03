// Automated tests: npm test   (see tests/e2e/README.md)
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  // One at a time: the tests share one small database.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    channel: "chrome", // the Chrome already installed on this computer
    locale: "ru-RU",
    timezoneId: "Asia/Almaty",
    trace: "retain-on-failure", // a step-by-step recording of failed tests
  },
  webServer: {
    command: "node scripts/test-server.mjs",
    url: "http://localhost:3100",
    timeout: 300_000, // building takes a minute or two
    reuseExistingServer: false, // every run starts from a fresh test database
    stdout: "ignore",
    stderr: "pipe",
  },
});

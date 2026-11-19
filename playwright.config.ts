import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:4175/review/idleops/";
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  use: { baseURL, browserName: "chromium", serviceWorkers: "block" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "1440p", use: { viewport: { width: 2560, height: 1440 } } },
    { name: "ultrawide", use: { viewport: { width: 3440, height: 1440 } } },
  ],
  webServer: { command: "python3 tests/serve_build.py", url: baseURL },
});

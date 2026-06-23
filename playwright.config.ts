import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for BETK.
 *
 * Tests live in tests/e2e/. No tests exist yet (Phase 01) — this config wires
 * the runner for Phase 02+ critical flows per CICD_PIPELINE.md:
 *   • auth (OTP + Google OAuth)
 *   • checkout (split payment — cash on delivery + digital)
 *   • seller confirm order
 *   • dispute resolve
 *
 * E2E runs on develop merges and pre-prod (not on every PR — CICD_PIPELINE.md).
 * The webServer block spins up `pnpm dev` for local runs; in CI the app is
 * expected to be already running (set PLAYWRIGHT_BASE_URL).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  /** Disallow test.only in CI — always catches accidentally committed `.only`. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /** Serial in CI to avoid flakiness against shared staging. */
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    /** RTL — Arabic locale mirrors the app's primary language. */
    locale: "ar-EG",
    /** Capture trace on retry to diagnose flakes. */
    trace: "on-first-retry",
    /** Screenshot on failure. */
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  /** Local only — CI should set PLAYWRIGHT_BASE_URL to a running preview URL. */
  webServer: process.env.CI
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

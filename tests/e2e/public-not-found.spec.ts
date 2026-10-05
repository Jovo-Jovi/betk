/**
 * D1 (2026-10-05). A missing public store or listing is HTTP 404 (R-S07)
 * inside the public shell. Titles are the `notFound.title` catalog strings.
 */

import { expect, test } from "@playwright/test";

const UNKNOWN_SLUG = "missing-store-storefix-9f3c2a";
const UNKNOWN_LISTING = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const CASES = [
  { path: `/store/${UNKNOWN_SLUG}`, title: "الصفحة غير موجودة" },
  { path: `/en/store/${UNKNOWN_SLUG}`, title: "Page not found" },
  { path: `/listing/${UNKNOWN_LISTING}`, title: "الصفحة غير موجودة" },
] as const;

for (const { path, title } of CASES) {
  test(`${path} is a 404 inside the public shell`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(title)).toBeVisible();
    const shell = page.locator('[data-slot="public-shell"]');
    await expect(shell).toBeVisible();
    await expect(shell.locator("footer")).toBeVisible();
  });
}

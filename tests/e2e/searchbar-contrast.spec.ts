/**
 * REG-58. axe-core color-contrast on the composed SearchBar, light and dark.
 * The target is the kit form (rounded-full), not the topbar's separate input.
 * No restyle. A violation fails the job.
 */

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["/", "/search"] as const;

for (const theme of ["light", "dark"] as const) {
  test.describe(`SearchBar contrast (${theme})`, () => {
    test.use({ colorScheme: theme });

    for (const path of PAGES) {
      test(`${path} passes color-contrast`, async ({ page }) => {
        await page.goto(path);
        await page.waitForFunction(
          (isDark) => document.documentElement.classList.contains("dark") === isDark,
          theme === "dark",
        );

        const bar = page.locator('form.rounded-full:has(input[type="search"])');
        await expect(bar).toHaveCount(1);
        await expect(bar).toBeVisible();
        await bar.evaluate((el) => {
          el.setAttribute("data-axe-searchbar", "1");
        });

        const results = await new AxeBuilder({ page })
          .include("[data-axe-searchbar='1']")
          .withRules(["color-contrast"])
          .analyze();

        const detail = results.violations
          .flatMap((violation) => violation.nodes.map((node) => node.failureSummary ?? violation.help))
          .join("\n");
        expect(results.violations, detail).toEqual([]);

        const unfinished = results.incomplete.filter((item) => item.id === "color-contrast");
        // The homepage hero paints a translucent pill over a gradient. axe then
        // reports bgGradient (ratio unknown), not a failed ratio. /search uses
        // the kit's opaque fill, so that page must be fully measured.
        const unmeasured = unfinished.filter((item) =>
          item.nodes.some((node) =>
            node.any.some((check) => {
              const data = check.data as { messageKey?: string } | null;
              return data?.messageKey !== "bgGradient";
            }),
          ),
        );
        const unfinishedDetail = unfinished
          .flatMap((item) => item.nodes.map((node) => node.failureSummary ?? item.help))
          .join("\n");
        if (path === "/") {
          expect(unmeasured, unfinishedDetail).toEqual([]);
        } else {
          expect(unfinished, unfinishedDetail).toEqual([]);
        }
      });
    }
  });
}

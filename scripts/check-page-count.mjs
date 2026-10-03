/**
 * Guard F (REG-67).
 *
 * Rule, quoted from the REG-67 row: adopt the physical file-count method for
 * routes. A scripts/ check re-measures the route count and fails when it
 * diverges from the pinned baseline. The historical "44 routes both locales"
 * figure is not the measurement.
 *
 * Pack T07: physical page.tsx count against 79. Phase 08 adds no page.tsx.
 * OD-21 freezes the spec inventory at 79 route patterns. B4-FIX2 reconciled
 * the built files: 26 page.tsx files, each mapped to one P-number inside that
 * 79. Phase 09 T05 adds P67–P70 (four page.tsx files) and raises the pin to
 * 30 in the same commit as the UI_SPEC reconciliation. This guard locks that
 * built count. It fails when the physical count is not 30, and it fails when
 * the count exceeds the 79 freeze. It does not demand a file for every
 * unbuilt spec page.
 *
 * Run: node scripts/check-page-count.mjs
 * Exit 0 = clean; exit 1 = the count diverged.
 */

import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** OD-21 spec freeze. Not the built-file count. */
export const OD21_PAGE_FREEZE = 79;

/**
 * Physical page.tsx files under src/app. 26 at B4-FIX2. Phase 09 T05
 * raises the pin to 30 for P67–P70.
 */
export const PINNED_PAGE_COUNT = 30;

/**
 * @param {string} appDir
 * @returns {string[]} repo-relative paths using forward slashes, sorted
 */
export function listPageFiles(appDir) {
  const root = resolve(appDir);
  /** @type {string[]} */
  const pages = [];
  /** @param {string} dir */
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === "page.tsx") {
        pages.push(relative(root, full).replace(/\\/g, "/"));
      }
    }
  }
  walk(root);
  pages.sort();
  return pages;
}

/**
 * @param {string} appDir
 * @param {number} [expected]
 * @returns {{ count: number, files: string[], problems: string[] }}
 */
export function checkPageCount(appDir, expected = PINNED_PAGE_COUNT) {
  const files = listPageFiles(appDir);
  /** @type {string[]} */
  const problems = [];
  if (files.length > OD21_PAGE_FREEZE) {
    problems.push(
      `physical page.tsx count ${files.length} exceeds the OD-21 freeze of ${OD21_PAGE_FREEZE}`,
    );
  }
  if (files.length !== expected) {
    problems.push(
      `physical page.tsx count ${files.length} is not the pinned built count ${expected} (OD-21 freeze ${OD21_PAGE_FREEZE})`,
    );
  }
  return { count: files.length, files, problems };
}

function main() {
  const appDir = join(repoRoot, "src", "app");
  const result = checkPageCount(appDir);
  if (result.problems.length > 0) {
    for (const problem of result.problems) {
      console.error(`FAIL  REG-67  ${problem}`);
    }
    console.error(
      `\n✖  Guard F (REG-67): physical page.tsx count diverged from the pinned baseline.`,
    );
    process.exit(1);
  }
  console.log(
    `✔  check-page-count: ${result.count} page.tsx files (pinned ${PINNED_PAGE_COUNT}; OD-21 freeze ${OD21_PAGE_FREEZE}).`,
  );
}

const invoked = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;
if (invoked) main();

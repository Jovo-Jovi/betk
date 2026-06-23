#!/usr/bin/env node
/**
 * Guard: no file under src/app, src/features, or src/components may import
 * lib/supabase/service (the service-role client bypasses RLS entirely).
 *
 * Allowed paths:
 *   src/services/       — typed service wrappers (explicitly server-only)
 *   src/lib/supabase/   — the file itself
 *   (any path not under the forbidden dirs above)
 *
 * Run: node scripts/check-service-import.mjs
 * Exit 0 = clean; exit 1 = violations found.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * Directories whose files must never import the service client.
 * src/app      — RSC pages and layouts (publicly reachable at runtime)
 * src/features — feature modules including Server Actions
 * src/components — shared UI components
 */
const FORBIDDEN_DIRS = [
  join(root, "src", "app"),
  join(root, "src", "features"),
  join(root, "src", "components"),
];

/**
 * Matches any import whose specifier resolves to lib/supabase/service.
 * Covers:
 *   import ... from "@/lib/supabase/service"
 *   import ... from "@/lib/supabase/service.ts"
 *   import ... from "../../lib/supabase/service"
 *   import ... from "../../lib/supabase/service.ts"
 */
const SERVICE_IMPORT_RE =
  /from\s+['"](?:@\/|[./]+\/)lib\/supabase\/service(?:\.ts)?['"]/;

/** Recursively collect .ts/.tsx files under a directory. */
function walkTs(dir) {
  /** @type {string[]} */
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files; // directory doesn't exist yet
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTs(full));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

let violations = 0;

for (const dir of FORBIDDEN_DIRS) {
  for (const file of walkTs(dir)) {
    const content = readFileSync(file, "utf8");
    if (SERVICE_IMPORT_RE.test(content)) {
      const rel = relative(root, file).replace(/\\/g, "/");
      console.error(
        `FAIL  service-import  ${rel}\n` +
          `      → imports lib/supabase/service (service-role bypasses RLS).\n` +
          `      → Move DB access to src/services/ or a server-only utility.`,
      );
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(
    `\n✖  ${violations} violation(s). lib/supabase/service must only be imported\n` +
      `   in src/services/ or explicitly server-only paths (never in app/features/components).`,
  );
  process.exit(1);
}

console.log(
  "✔  check-service-import: no forbidden service-role imports found.",
);

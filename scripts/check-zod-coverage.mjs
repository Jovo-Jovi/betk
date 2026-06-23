#!/usr/bin/env node
// Guard: every file under src/features/[feature]/actions or src/app/api that
// imports from Supabase must also import a Zod schema.
//
// "Imports from Supabase":
//   - @/lib/supabase/server  (Server Actions / RSC)
//   - @/lib/supabase/client  (rare in actions, but covered)
//   - @supabase/supabase-js  (direct SDK usage)
//   - @supabase/ssr
//
// "Has a Zod schema import":
//   - import from @/validations/...  (shared schema library)
//   - import from zod                (inline schema definition)
//   - import of a symbol ending in Schema (e.g. `import { ListingSchema }`)
//     from a local path (covers feature-local *Schema files)
//
// Currently a near-no-op (no actions exist yet) but must be wired and pass.
//
// Run: node scripts/check-zod-coverage.mjs
// Exit 0 = clean; exit 1 = violations found.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * Matches an import that pulls in a Supabase client.
 * Covers both aliased paths and the npm packages.
 */
const SUPABASE_IMPORT_RE =
  /from\s+['"](?:@\/lib\/supabase\/(?:server|client|service)|@supabase\/(?:supabase-js|ssr))['"]/;

/**
 * Matches an import that brings in a Zod schema.
 * Covers:
 *   import { ... } from "@/validations/..."   shared schema folder
 *   import { z } from "zod"                   inline schema
 *   import { FooSchema } from "..."            any *Schema symbol import
 */
const ZOD_SCHEMA_RE =
  /from\s+['"](?:@\/validations\/|zod)['"]/  // shared schemas or zod itself

// Second pattern: symbol ending in "Schema" imported from any path
const SCHEMA_SYMBOL_RE = /\bimport\s+\{[^}]*\b\w+Schema\b[^}]*\}\s+from\s+['"]/;

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

/** Collect all target files. */
const targetFiles = [
  // src/app/api/**
  ...walkTs(join(root, "src", "app", "api")),
];

// src/features/*/actions/**
try {
  const featuresDir = join(root, "src", "features");
  for (const entry of readdirSync(featuresDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      targetFiles.push(
        ...walkTs(join(featuresDir, entry.name, "actions")),
      );
    }
  }
} catch {
  // features dir may not exist yet
}

let violations = 0;

for (const file of targetFiles) {
  const content = readFileSync(file, "utf8");

  const hasSupabaseImport = SUPABASE_IMPORT_RE.test(content);
  if (!hasSupabaseImport) continue; // file doesn't use Supabase — no requirement

  const hasZodSchema =
    ZOD_SCHEMA_RE.test(content) || SCHEMA_SYMBOL_RE.test(content);

  if (!hasZodSchema) {
    const rel = relative(root, file).replace(/\\/g, "/");
    console.error(
      `FAIL  zod-coverage  ${rel}\n` +
        `      → imports Supabase but has no Zod schema import.\n` +
        `      → Add a schema from @/validations/ or define one inline with zod.`,
    );
    violations++;
  }
}

if (violations > 0) {
  console.error(
    `\n✖  ${violations} violation(s). Every Server Action / API route that queries\n` +
      `   Supabase must validate inputs with Zod before the DB call.`,
  );
  process.exit(1);
}

const checked = targetFiles.length;
console.log(
  `✔  check-zod-coverage: ${checked} file(s) checked — all have Zod schema imports (or none yet).`,
);

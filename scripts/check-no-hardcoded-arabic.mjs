#!/usr/bin/env node
/**
 * Guard (OD-7 / BL-02): no hardcoded Arabic string literals in the BL-02
 * in-scope surface — these must be i18n keys in messages/{ar,en}.json,
 * wired via useTranslations/getTranslations, not baked into JSX/strings.
 *
 * SCOPE (mirrors BL-02 task scope — non-shared UI + validation + action code):
 *   - src/app/[locale]/(auth)/**
 *   - src/app/[locale]/(buyer)/account/**
 *   - src/validations/**
 *   - src/features/*\/actions/**  (Server Action error strings)
 *
 * EXCLUDED (owned elsewhere / intentionally bilingual DATA, not UI copy):
 *   - src/components/ui, src/components/shared (Claude Design — DS-I18N owns these)
 *   - src/constants/governorates.ts (bilingual DATA: labelAr/labelEn pairs, not messages)
 *   - *.test.ts(x) fixtures
 *
 * Detection: any Arabic-script codepoint (U+0600–U+06FF) inside a string
 * literal or JSX text. Doc comments (/** ... *\/, // ...) are excluded so this
 * guard doesn't force removing incidental Arabic examples from prose docs —
 * only string literals / JSX text nodes that could render to a user.
 *
 * This is a best-effort static guard (regex-based, no AST), consistent with
 * the other scripts/check-*.mjs guards in this repo. It errs toward flagging
 * a false positive over silently missing a real hardcoded string.
 *
 * Run: node scripts/check-no-hardcoded-arabic.mjs
 * Exit 0 = clean; exit 1 = violations found.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Directories to scan (BL-02 in-scope surface). */
const SCAN_DIRS = [
  join(root, "src", "app", "[locale]", "(auth)"),
  join(root, "src", "app", "[locale]", "(buyer)", "account"),
  join(root, "src", "validations"),
];

/** Any path (file or dir) containing one of these segments is skipped. */
const EXCLUDED_SEGMENTS = [
  join("src", "components", "ui"),
  join("src", "components", "shared"),
];

/** Individual files excluded outright (bilingual DATA, not UI message copy). */
const EXCLUDED_FILES = [join(root, "src", "constants", "governorates.ts")];

const ARABIC_RE = /[\u0600-\u06FF]/;

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
    if (EXCLUDED_SEGMENTS.some((seg) => full.includes(seg))) continue;
    if (entry.isDirectory()) {
      files.push(...walkTs(full));
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Strip line comments, block comments, and import/require lines before
 * scanning for Arabic — a hardcoded UI string can never legitimately appear
 * in a comment or an import specifier, so this avoids false positives from
 * doc-comments that reference Arabic copy for context.
 */
function stripNonLiteralNoise(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments (incl. JSDoc)
    .replace(/(^|[^:])\/\/.*$/gm, "$1") // line comments (best-effort)
    .replace(/^\s*import[^;]*;?\s*$/gm, ""); // import statements
}

let violations = 0;
let checked = 0;

/** src/features/*\/actions/** — Server Action error strings. */
const featureActionDirs = [];
try {
  const featuresDir = join(root, "src", "features");
  for (const entry of readdirSync(featuresDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const actionsDir = join(featuresDir, entry.name, "actions");
      if (existsSync(actionsDir)) featureActionDirs.push(actionsDir);
    }
  }
} catch {
  // features dir may not exist yet
}

const targetFiles = [
  ...SCAN_DIRS.flatMap(walkTs),
  ...featureActionDirs.flatMap(walkTs),
].filter((f) => !EXCLUDED_FILES.includes(f));

for (const file of targetFiles) {
  checked++;
  const raw = readFileSync(file, "utf8");
  const cleaned = stripNonLiteralNoise(raw);

  if (ARABIC_RE.test(cleaned)) {
    const rel = relative(root, file).replace(/\\/g, "/");
    // Report the offending line(s) from the ORIGINAL source for a useful pointer.
    const lines = raw.split("\n");
    const hits = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => ARABIC_RE.test(line) && !/^\s*(\/\/|\*|\/\*)/.test(line));
    for (const { line, i } of hits) {
      console.error(
        `FAIL  no-hardcoded-arabic  ${rel}:${i + 1}\n` + `      → ${line.trim()}`,
      );
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(
    `\n✖  ${violations} violation(s). Move hardcoded Arabic UI copy into ` +
      `messages/{ar,en}.json and wire it via useTranslations/getTranslations ` +
      `(OD-7 / BL-02).`,
  );
  process.exit(1);
}

console.log(
  `✔  check-no-hardcoded-arabic: ${checked} file(s) checked in the BL-02 scope — no hardcoded Arabic found.`,
);

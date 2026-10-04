/**
 * Kit-integrity guard.
 *
 * sha256 of every file under src/components/ui and src/components/shared
 * must match docs/00-design/kit-manifest.json. Fails on any added, removed,
 * or changed file.
 *
 * CRLF is normalized to LF before hashing so a Windows checkout (core.autocrlf)
 * matches the Linux CI checkout. The hash is of that normalized text.
 *
 * Run: node scripts/check-kit-integrity.mjs
 * Exit 0 = match; exit 1 = added, removed, or changed.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Claude Design kit roots. A file outside these two trees is not this guard. */
export const KIT_ROOTS = ["src/components/shared", "src/components/ui"];

/**
 * @param {string} root
 * @returns {string[]} repo-relative paths, forward slashes, sorted
 */
export function listKitFiles(root) {
  /** @type {string[]} */
  const files = [];
  for (const relRoot of KIT_ROOTS) {
    const abs = resolve(root, relRoot);
    walk(abs, root, files);
  }
  files.sort();
  return files;
}

/**
 * @param {string} dir
 * @param {string} root
 * @param {string[]} files
 */
function walk(dir, root, files) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, root, files);
    else if (entry.isFile()) files.push(relative(root, full).replace(/\\/g, "/"));
  }
}

/**
 * @param {string} absPath
 * @returns {string} sha256 hex
 */
export function hashKitFile(absPath) {
  const text = readFileSync(absPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * @param {string} root
 * @returns {Record<string, string>}
 */
export function hashKitTree(root) {
  /** @type {Record<string, string>} */
  const files = {};
  for (const rel of listKitFiles(root)) {
    files[rel] = hashKitFile(resolve(root, rel));
  }
  return files;
}

/**
 * @param {string} root
 * @param {Record<string, string>} expected path → sha256
 * @returns {{ problems: string[] }}
 */
export function checkKitIntegrity(root, expected) {
  const actual = hashKitTree(root);
  /** @type {string[]} */
  const problems = [];
  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);
  const expectedSet = new Set(expectedKeys);
  const actualSet = new Set(actualKeys);
  for (const key of actualKeys) {
    if (!expectedSet.has(key)) problems.push(`added ${key}`);
    else if (actual[key] !== expected[key]) problems.push(`changed ${key}`);
  }
  for (const key of expectedKeys) {
    if (!actualSet.has(key)) problems.push(`removed ${key}`);
  }
  problems.sort();
  return { problems };
}

/**
 * @param {string} root
 */
export function buildManifest(root) {
  return {
    algorithm: "sha256",
    newline: "lf",
    roots: [...KIT_ROOTS],
    files: hashKitTree(root),
  };
}

function main() {
  const manifestPath = join(repoRoot, "docs", "00-design", "kit-manifest.json");
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    console.error(`FAIL  kit-integrity  cannot read ${manifestPath}: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
  if (parsed.algorithm !== "sha256" || !parsed.files || typeof parsed.files !== "object") {
    console.error("FAIL  kit-integrity  manifest must be { algorithm: sha256, files: { path: hex } }.");
    process.exit(1);
  }
  const result = checkKitIntegrity(repoRoot, parsed.files);
  if (result.problems.length > 0) {
    for (const problem of result.problems) {
      console.error(`FAIL  kit-integrity  ${problem}`);
    }
    console.error(
      `\n✖  Kit integrity: ${result.problems.length} file(s) added, removed, or changed under src/components/ui and src/components/shared.`,
    );
    process.exit(1);
  }
  const count = Object.keys(parsed.files).length;
  console.log(`✔  check-kit-integrity: ${count} files match kit-manifest.json.`);
}

const invoked = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;
if (invoked) main();

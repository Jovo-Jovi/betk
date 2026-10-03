/**
 * Guard E (REG-47).
 *
 * Rule, quoted from the REG-47 row: a scripts/ check that fails when a
 * loading.tsx sits at or above any segment whose page.tsx can (transitively)
 * call notFound(). A group or segment Suspense fallback commits HTTP 200 at
 * first flush before an awaited null→notFound() can set 404.
 *
 * Transitive means the page file or any local module it imports (including
 * re-exports) contains a notFound( call. Comments are ignored. Package
 * imports are not followed. The check reports. It does not delete files.
 *
 * Run: node scripts/check-no-loading-above-not-found.mjs
 * Exit 0 = clean; exit 1 = violations found.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** Drop comments so a comment that mentions notFound() is not a call. */
export function stripComments(source) {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const n = source[i + 1];
    if (c === "/" && n === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && n === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"') {
      const q = c;
      out += source[i++];
      while (i < source.length && source[i] !== q) {
        if (source[i] === "\\") {
          out += source[i++];
          if (i < source.length) out += source[i++];
          continue;
        }
        out += source[i++];
      }
      if (i < source.length) out += source[i++];
      continue;
    }
    if (c === "`") {
      out += source[i++];
      while (i < source.length && source[i] !== "`") {
        if (source[i] === "\\") {
          out += source[i++];
          if (i < source.length) out += source[i++];
          continue;
        }
        if (source[i] === "$" && source[i + 1] === "{") {
          out += source[i++];
          out += source[i++];
          let depth = 1;
          while (i < source.length && depth > 0) {
            if (source[i] === "{") depth++;
            else if (source[i] === "}") depth--;
            out += source[i++];
          }
          continue;
        }
        out += source[i++];
      }
      if (i < source.length) out += source[i++];
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function walkPages(appDir) {
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
      else if (entry.isFile() && entry.name === "page.tsx") pages.push(full);
    }
  }
  walk(appDir);
  return pages;
}

/**
 * @param {string} fromFile
 * @param {string} spec
 * @param {string} srcDir
 */
function resolveSpec(fromFile, spec, srcDir) {
  /** @type {string | null} */
  let base = null;
  if (spec.startsWith("@/")) base = join(srcDir, spec.slice(2));
  else if (spec.startsWith(".")) base = join(dirname(fromFile), spec);
  else return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.js`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const resolved = resolve(candidate);
    if (!resolved.startsWith(resolve(srcDir))) continue;
    try {
      if (statSync(resolved).isFile()) return resolved;
    } catch {
      // missing between exists and stat
    }
  }
  return null;
}

/**
 * @param {string} entry
 * @param {string} srcDir
 */
function pageCanCallNotFound(entry, srcDir) {
  /** @type {string[]} */
  const stack = [entry];
  const seen = new Set();
  while (stack.length > 0) {
    const file = stack.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const source = stripComments(raw);
    if (/\bnotFound\s*\(/.test(source)) return true;
    const specRe =
      /\bfrom\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = specRe.exec(source))) {
      const spec = match[1] || match[2];
      if (!spec) continue;
      const next = resolveSpec(file, spec, srcDir);
      if (next) stack.push(next);
    }
  }
  return false;
}

/**
 * @param {string} pageFile
 * @param {string} appDir
 */
function ancestorLoadings(pageFile, appDir) {
  /** @type {string[]} */
  const hits = [];
  const stop = resolve(appDir);
  let dir = dirname(pageFile);
  while (true) {
    const loading = join(dir, "loading.tsx");
    if (existsSync(loading)) hits.push(loading);
    if (resolve(dir) === stop) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return hits;
}

/**
 * @param {string} appDir absolute or relative directory that is the app root
 * @returns {{ page: string, loading: string }[]}
 */
export function findLoadingAboveNotFound(appDir) {
  const root = resolve(appDir);
  const srcDir = dirname(root);
  /** @type {{ page: string, loading: string }[]} */
  const violations = [];
  for (const page of walkPages(root)) {
    if (!pageCanCallNotFound(page, srcDir)) continue;
    for (const loading of ancestorLoadings(page, root)) {
      violations.push({
        page: relative(root, page).replace(/\\/g, "/"),
        loading: relative(root, loading).replace(/\\/g, "/"),
      });
    }
  }
  return violations;
}

function main() {
  const appDir = join(repoRoot, "src", "app");
  const violations = findLoadingAboveNotFound(appDir);
  if (violations.length > 0) {
    for (const hit of violations) {
      console.error(
        `FAIL  REG-47  ${hit.loading}\n` +
          `      → loading.tsx sits at or above ${hit.page}, whose page can call notFound().\n` +
          `      → Delete the loading.tsx. Do not add one above a notFound() page.`,
      );
    }
    console.error(
      `\n✖  ${violations.length} violation(s). Guard E (REG-47): no loading.tsx at or above a segment whose page can reach notFound().`,
    );
    process.exit(1);
  }
  console.log(
    "✔  check-no-loading-above-not-found: no loading.tsx sits above a notFound() page.",
  );
}

const invoked = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;
if (invoked) main();

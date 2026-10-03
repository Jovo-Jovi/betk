/**
 * REG-92 static half. Not a typecheck. Not types-drift.
 *
 * Generated Row types still list delivery_fee and total_amount, so select("*")
 * typechecks and Postgres raises 42501 at runtime. This script fails when
 * src/ contains .from("seller_orders") or .from('seller_orders') followed,
 * in the same statement, by:
 *   - .select("*") or any select string that contains *
 *   - .select() with no argument (PostgREST RETURNING *)
 *
 * An explicit column list with no * is clean. Comments are ignored.
 * The script reports. It does not edit src/.
 *
 * Run: node scripts/check-seller-orders-select.mjs
 * Exit 0 = clean; exit 1 = violations found.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** @param {string} source */
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

/**
 * @param {string} source
 * @param {number} fromIndex index of `.from`
 * A newline ends the statement only when the next token is not a chain (`.`).
 */
function statementTail(source, fromIndex) {
  let i = fromIndex;
  let depth = 0;
  /** @type {string | null} */
  let quote = null;
  while (i < source.length) {
    const c = source[i];
    if (quote) {
      if (c === "\\" && quote !== "`") {
        i += 2;
        continue;
      }
      if (quote === "`" && c === "$" && source[i + 1] === "{") {
        i += 2;
        let nest = 1;
        while (i < source.length && nest > 0) {
          if (source[i] === "{") nest++;
          else if (source[i] === "}") nest--;
          i++;
        }
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      quote = c;
      i++;
      continue;
    }
    if (c === "(") {
      depth++;
      i++;
      continue;
    }
    if (c === ")") {
      depth = Math.max(0, depth - 1);
      i++;
      continue;
    }
    if (c === ";" && depth === 0) break;
    if (c === "\n" && depth === 0) {
      let j = i + 1;
      while (j < source.length && /[ \t\r]/.test(source[j] ?? "")) j++;
      if (source[j] !== ".") break;
    }
    i++;
  }
  return source.slice(fromIndex, i);
}

/**
 * @param {string} tail
 * @param {number} openParen index of the `(` in `.select(`
 */
function classifySelect(tail, openParen) {
  let i = openParen + 1;
  while (i < tail.length && /\s/.test(tail[i] ?? "")) i++;
  const c = tail[i];
  if (c === ")" || c === undefined) return { kind: "empty", form: ".select()" };
  if (c === "'" || c === '"' || c === "`") {
    const q = c;
    i++;
    let value = "";
    while (i < tail.length && tail[i] !== q) {
      if (tail[i] === "\\") {
        value += tail[i + 1] ?? "";
        i += 2;
        continue;
      }
      value += tail[i];
      i++;
    }
    if (value.includes("*")) return { kind: "star", form: `.select(${q}${value}${q})` };
    return { kind: "columns", form: "explicit" };
  }
  return { kind: "other", form: "non-string" };
}

/**
 * @param {string} source
 * @param {string} [filename]
 * @returns {{ file: string, form: string }[]}
 */
export function sellerOrdersSelectViolations(source, filename = "<fixture>") {
  const stripped = stripComments(source);
  /** @type {{ file: string, form: string }[]} */
  const violations = [];
  const fromRe = /\.from\(\s*(['"])seller_orders\1/g;
  let fromMatch;
  while ((fromMatch = fromRe.exec(stripped))) {
    const tail = statementTail(stripped, fromMatch.index);
    const selectRe = /\.select\s*\(/g;
    let selectMatch;
    while ((selectMatch = selectRe.exec(tail))) {
      const open = selectMatch.index + selectMatch[0].length - 1;
      const classified = classifySelect(tail, open);
      if (classified.kind === "empty" || classified.kind === "star") {
        violations.push({ file: filename, form: classified.form });
      }
    }
  }
  return violations;
}

/**
 * @param {string} srcDir
 * @returns {{ file: string, form: string }[]}
 */
export function scanSellerOrdersSelect(srcDir) {
  /** @type {{ file: string, form: string }[]} */
  const violations = [];
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
      if (entry.isDirectory()) {
        if (entry.name === "node_modules") continue;
        walk(full);
      } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        const text = readFileSync(full, "utf8");
        const rel = relative(srcDir, full).replace(/\\/g, "/");
        violations.push(...sellerOrdersSelectViolations(text, rel));
      }
    }
  }
  walk(srcDir);
  return violations;
}

function main() {
  const srcDir = join(repoRoot, "src");
  const violations = scanSellerOrdersSelect(srcDir);
  if (violations.length > 0) {
    for (const hit of violations) {
      console.error(
        `FAIL  REG-92  src/${hit.file}\n` +
          `      → .from("seller_orders") followed by ${hit.form}.\n` +
          `      → List columns. select * and RETURNING * raise 42501.`,
      );
    }
    console.error(
      `\n✖  ${violations.length} violation(s). REG-92: no select-star on seller_orders under src/.`,
    );
    process.exit(1);
  }
  console.log(
    "✔  check-seller-orders-select: no select-star or RETURNING-star on seller_orders under src/.",
  );
}

const invoked = process.argv[1]
  ? resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
  : false;
if (invoked) main();

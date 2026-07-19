#!/usr/bin/env node
/**
 * Guard (OD-7 / REG-27): message-catalog parity between the AR and EN locales.
 *
 * BETK is Arabic-first + bilingual (OD-7): every user-facing string is a key in
 * BOTH messages/ar.json and messages/en.json, wired via next-intl. A key that
 * exists in one locale but not the other is a latent runtime hole — next-intl
 * renders the raw key path (or throws in strict mode) for the missing side. The
 * sessions have hand-run this leaf-key diff before every gate; this script makes
 * it deterministic and CI-enforced.
 *
 * METHOD: deep-walk both catalogs to their LEAF keys (dot-joined paths, arrays
 * treated as leaves) and compare the two sets. A mismatch is any leaf present in
 * one locale but absent in the other ("orphan"), in either direction. Total leaf
 * counts must also be equal — a defensive cross-check against a structural
 * divergence (e.g. an object-vs-leaf shape mismatch at the same path) that a
 * pure set-diff on paths could otherwise mask.
 *
 * This is intentionally a pure-Node, built-in-only guard (no npm deps, no
 * configs/env.ts import), consistent with the other scripts/check-*.mjs guards
 * so the CI `guards` job needs only a checkout + Node.js.
 *
 * Run: node scripts/check-i18n-parity.mjs
 * Exit 0 = AR/EN in parity; exit 1 = any orphan or count mismatch.
 */

import { readFileSync } from "node:fs";

const LOCALES = [
  { code: "ar", path: new URL("../messages/ar.json", import.meta.url) },
  { code: "en", path: new URL("../messages/en.json", import.meta.url) },
];

/**
 * Deep-walk an object to its leaf keys as dot-joined paths. Arrays and
 * primitives are treated as leaves; only plain objects are recursed into.
 * @param {unknown} node
 * @param {string} prefix
 * @returns {string[]}
 */
function leafPaths(node, prefix = "") {
  if (node === null || typeof node !== "object" || Array.isArray(node)) {
    return [prefix];
  }
  const out = [];
  for (const [key, value] of Object.entries(node)) {
    const next = prefix ? `${prefix}.${key}` : key;
    out.push(...leafPaths(value, next));
  }
  return out;
}

/** Load + parse a catalog, failing loudly on malformed JSON. */
function loadCatalog({ code, path }) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`✖  check-i18n-parity: failed to read/parse messages/${code}.json`);
    console.error(`   → ${err.message}`);
    process.exit(1);
  }
}

const [ar, en] = LOCALES.map(loadCatalog);

const arLeaves = new Set(leafPaths(ar));
const enLeaves = new Set(leafPaths(en));

/** In `a` but not `b`. */
const diff = (a, b) => [...a].filter((k) => !b.has(k)).sort();

const missingInEn = diff(arLeaves, enLeaves); // AR keys with no EN counterpart
const missingInAr = diff(enLeaves, arLeaves); // EN keys with no AR counterpart

console.log(
  `check-i18n-parity: ar=${arLeaves.size} leaf key(s) · en=${enLeaves.size} leaf key(s)`,
);

let failed = false;

if (missingInEn.length > 0) {
  failed = true;
  console.error(
    `\n✖  ${missingInEn.length} key(s) present in AR but MISSING in messages/en.json:`,
  );
  for (const k of missingInEn) console.error(`   - ${k}`);
}

if (missingInAr.length > 0) {
  failed = true;
  console.error(
    `\n✖  ${missingInAr.length} key(s) present in EN but MISSING in messages/ar.json:`,
  );
  for (const k of missingInAr) console.error(`   - ${k}`);
}

if (arLeaves.size !== enLeaves.size) {
  failed = true;
  console.error(
    `\n✖  leaf-count mismatch: ar=${arLeaves.size} vs en=${enLeaves.size} ` +
      `(structural divergence — check for an object-vs-string shape mismatch).`,
  );
}

if (failed) {
  console.error(
    `\n   Every user-facing string must exist in BOTH locales (OD-7). Add the ` +
      `missing key(s) to the flagged catalog and re-run.`,
  );
  process.exit(1);
}

console.log(
  `✔  check-i18n-parity: AR/EN catalogs in full parity — ${arLeaves.size} leaf key(s), 0 orphan(s).`,
);

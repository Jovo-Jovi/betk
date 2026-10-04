/**
 * P09 T05 unit checks: the checkbox schema, the version blank rule, the legal
 * copy, and Guard F's raised pin. Draft prose is absent from the pages.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { completeProfileSchema } from "@/validations/auth";
import { isConfiguredVersionLabel } from "@/services/agreementVersions";
import { PINNED_PAGE_COUNT, checkPageCount } from "../../scripts/check-page-count.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const DRAFT_MARKERS = [
  "DRAFT — NOT LEGALLY REVIEWED",
  "NOT FOR PUBLICATION",
  "InstaPay",
  "docs/01-product/legal",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("buyer terms gate (unit)", () => {
  it("treats a blank version as unconfigured and keeps any other string", () => {
    expect(isConfiguredVersionLabel("")).toBe(false);
    expect(isConfiguredVersionLabel("   ")).toBe(false);
    expect(isConfiguredVersionLabel(null)).toBe(false);
    expect(isConfiguredVersionLabel(undefined)).toBe(false);
    expect(isConfiguredVersionLabel("STAGING-DRAFT-1")).toBe(true);
    expect(isConfiguredVersionLabel(" OTHER ")).toBe(true);
  });

  it("rejects signup when the acceptance literal is missing", () => {
    const parsed = completeProfileSchema.safeParse({
      full_name: "T05 Buyer",
      governorate: "cairo",
      city: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.errors.some((issue) => issue.message === "buyerTermsRequired")).toBe(
        true,
      );
    }
  });

  it("accepts the checkbox literal", () => {
    const parsed = completeProfileSchema.safeParse({
      full_name: "T05 Buyer",
      governorate: "cairo",
      city: "",
      acceptBuyerTerms: "accepted",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("legal pages (unit)", () => {
  it("keeps the pending notice in both locales and leaves the drafts out", () => {
    const en = JSON.parse(readFileSync(join(repoRoot, "messages", "en.json"), "utf8"));
    const ar = JSON.parse(readFileSync(join(repoRoot, "messages", "ar.json"), "utf8"));

    expect(en.legal.common.pendingTitle).toBe("Pending legal review");
    expect(ar.legal.common.pendingTitle).toBe("بانتظار المراجعة القانونية");
    expect(en.legal.common.pendingBody).toContain("version label");
    expect(en.legal.common.pendingBody).not.toContain("InstaPay");

    const bundled = JSON.stringify(en.legal) + JSON.stringify(ar.legal);
    for (const marker of DRAFT_MARKERS) {
      expect(bundled).not.toContain(marker);
    }
  });

  it("does not import or quote the E-1 drafts", () => {
    const legalDir = join(repoRoot, "src", "app", "[locale]", "(public)", "legal");
    const files = walk(legalDir);
    expect(files.filter((file) => file.endsWith("page.tsx"))).toHaveLength(4);
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
    for (const marker of DRAFT_MARKERS) {
      expect(source).not.toContain(marker);
    }
    expect(source).toContain("LegalDocument");
    expect(source).not.toContain("buyer-terms.en.md");
  });
});

describe("Guard F pin after P49", () => {
  it("is 31 and matches the tree", () => {
    expect(PINNED_PAGE_COUNT).toBe(31);
    const result = checkPageCount(join(repoRoot, "src", "app"));
    expect(result.count).toBe(31);
    expect(result.problems).toEqual([]);
    expect(result.files).toEqual(
      expect.arrayContaining([
        "[locale]/(public)/legal/terms/page.tsx",
        "[locale]/(public)/legal/seller-agreement/page.tsx",
        "[locale]/(public)/legal/returns/page.tsx",
        "[locale]/(public)/legal/privacy/page.tsx",
        "[locale]/(admin)/admin/sellers/approvals/page.tsx",
      ]),
    );
  });
});

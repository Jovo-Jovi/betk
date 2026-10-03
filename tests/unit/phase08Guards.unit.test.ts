/**
 * Phase 08 T07. Red/green fixtures for REG-92 (static), Guard E (REG-47),
 * Guard F (REG-67), and Guard G (REG-74). None of these is a typecheck.
 */

import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkPageCount, PINNED_PAGE_COUNT } from "../../scripts/check-page-count.mjs";
import { findLoadingAboveNotFound } from "../../scripts/check-no-loading-above-not-found.mjs";
import {
  scanSellerOrdersSelect,
  sellerOrdersSelectViolations,
} from "../../scripts/check-seller-orders-select.mjs";
import {
  EXPECTED_HISTORY_ROWS,
  EXPECTED_SELLER_ORDERS,
  residueProblems,
  type ResidueObservation,
} from "../integration/expectedResidue";
import { integrationRunRequested } from "../setup/residueGlobalSetup";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "betk-guard-"));
  roots.push(root);
  return root;
}

function write(root: string, rel: string, body: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, body);
}

function cleanResidue(): ResidueObservation {
  const once = new Set([
    "e5d776fc-1402-484e-84c4-d2b441f5868f",
    "da73deed-0670-4cc7-bccd-064b8d301b6f",
  ]);
  const historyOrderIds: string[] = [];
  for (const row of EXPECTED_SELLER_ORDERS) {
    historyOrderIds.push(row.id);
    if (!once.has(row.id)) historyOrderIds.push(row.id);
  }
  return {
    sellerOrders: EXPECTED_SELLER_ORDERS.map((row) => ({
      id: row.id,
      masterOrderId: row.masterOrderId,
    })),
    masterIds: EXPECTED_SELLER_ORDERS.map((row) => row.masterOrderId),
    historyOrderIds,
    betkTestEmails: [],
  };
}

describe("REG-92 static seller_orders select", () => {
  it("is red on each star form", () => {
    const forms = [
      `.from("seller_orders").select("*")`,
      `.from('seller_orders').select('*')`,
      `.from("seller_orders").select()`,
      `.from("seller_orders").select("id, *")`,
      '.from("seller_orders").eq("id", id).select("*")',
      `.from("seller_orders")\n  .select()`,
      `.from("seller_orders" as "orders").update({}).select()`,
      '.from("seller_orders").select(`id, *`)',
    ];
    for (const source of forms) {
      expect(sellerOrdersSelectViolations(source, "fixture.ts").length, source).toBeGreaterThan(0);
    }
  });

  it("is green on an explicit column list and on other tables", () => {
    const forms = [
      `.from("seller_orders").select("id, status, subtotal")`,
      `.from('seller_orders').select('id, betk_ref, status, subtotal')`,
      `.from("seller_orders").insert({}).select("id")`,
      `.from("orders").select("*")`,
      `.from("seller_orders").select("id", { count: "exact" })`,
    ];
    for (const source of forms) {
      expect(sellerOrdersSelectViolations(source, "fixture.ts"), source).toEqual([]);
    }
  });

  it("is green on the current src tree", () => {
    expect(scanSellerOrdersSelect(join(repoRoot, "src"))).toEqual([]);
  });
});

describe("Guard E (REG-47)", () => {
  it("is red when loading.tsx sits above a page that calls notFound()", () => {
    const root = tempRoot();
    write(root, "src/app/[locale]/(buyer)/loading.tsx", "export default function Loading() { return null }\n");
    write(
      root,
      "src/app/[locale]/(buyer)/inbox/[id]/page.tsx",
      `import { notFound } from "next/navigation"\nexport default function Page() { notFound() }\n`,
    );
    const hits = findLoadingAboveNotFound(join(root, "src", "app"));
    expect(hits).toEqual([
      {
        page: "[locale]/(buyer)/inbox/[id]/page.tsx",
        loading: "[locale]/(buyer)/loading.tsx",
      },
    ]);
  });

  it("is red when the notFound() call is in an imported module", () => {
    const root = tempRoot();
    write(root, "src/app/segment/loading.tsx", "export default function Loading() { return null }\n");
    write(
      root,
      "src/app/segment/page.tsx",
      `import { missing } from "./missing"\nexport default function Page() { return missing() }\n`,
    );
    write(
      root,
      "src/app/segment/missing.ts",
      `import { notFound } from "next/navigation"\nexport function missing() { notFound() }\n`,
    );
    expect(findLoadingAboveNotFound(join(root, "src", "app"))).toHaveLength(1);
  });

  it("is green when a loading.tsx has no notFound() page under it", () => {
    const root = tempRoot();
    write(root, "src/app/[locale]/(auth)/loading.tsx", "export default function Loading() { return null }\n");
    write(
      root,
      "src/app/[locale]/(auth)/auth/login/page.tsx",
      `export default function Page() { return null }\n`,
    );
    expect(findLoadingAboveNotFound(join(root, "src", "app"))).toEqual([]);
  });

  it("is green when a notFound() page has no loading.tsx above it", () => {
    const root = tempRoot();
    write(
      root,
      "src/app/[locale]/(public)/listing/[id]/page.tsx",
      `import { notFound } from "next/navigation"\nexport default function Page() { notFound() }\n`,
    );
    expect(findLoadingAboveNotFound(join(root, "src", "app"))).toEqual([]);
  });

  it("is green on the current tree", () => {
    expect(findLoadingAboveNotFound(join(repoRoot, "src", "app"))).toEqual([]);
  });
});

describe("Guard F (REG-67)", () => {
  it("is red when the physical count diverges", () => {
    const root = tempRoot();
    write(root, "src/app/a/page.tsx", "export default function Page() { return null }\n");
    write(root, "src/app/b/page.tsx", "export default function Page() { return null }\n");
    const result = checkPageCount(join(root, "src", "app"), 1);
    expect(result.count).toBe(2);
    expect(result.problems.length).toBeGreaterThan(0);
  });

  it("is green when the fixture count matches the pin passed in", () => {
    const root = tempRoot();
    write(root, "src/app/a/page.tsx", "export default function Page() { return null }\n");
    const result = checkPageCount(join(root, "src", "app"), 1);
    expect(result.problems).toEqual([]);
  });

  it("is green on the current tree", () => {
    const result = checkPageCount(join(repoRoot, "src", "app"));
    expect(result.count).toBe(PINNED_PAGE_COUNT);
    expect(result.problems).toEqual([]);
  });
});

describe("Guard G (REG-74)", () => {
  it("is green on the N27 set and red on anything outside it", () => {
    const clean = cleanResidue();
    expect(clean.historyOrderIds).toHaveLength(EXPECTED_HISTORY_ROWS);
    expect(residueProblems(clean)).toEqual([]);

    const extraSeller: ResidueObservation = {
      ...clean,
      sellerOrders: [...clean.sellerOrders, { id: "00000000-0000-0000-0000-000000000001", masterOrderId: null }],
    };
    expect(residueProblems(extraSeller).join("\n")).toMatch(/seller_orders id outside/);

    const extraMaster: ResidueObservation = {
      ...clean,
      masterIds: [...clean.masterIds, "00000000-0000-0000-0000-000000000002"],
    };
    expect(residueProblems(extraMaster).join("\n")).toMatch(/master_orders id outside/);

    const extraHistory: ResidueObservation = {
      ...clean,
      historyOrderIds: [...clean.historyOrderIds, "00000000-0000-0000-0000-000000000003"],
    };
    expect(residueProblems(extraHistory).join("\n")).toMatch(/order_status_history/);

    const leakedUser: ResidueObservation = {
      ...clean,
      betkTestEmails: ["rls-smoke-buyerA-deadbeef@betk.test"],
    };
    expect(residueProblems(leakedUser).join("\n")).toMatch(/@betk\.test/);
  });

  it("does not delete: the detector source has no delete", () => {
    const residue = readFileSync(join(repoRoot, "tests", "integration", "expectedResidue.ts"), "utf8");
    const setup = readFileSync(join(repoRoot, "tests", "setup", "residueGlobalSetup.ts"), "utf8");
    expect(residue).not.toMatch(/\.delete\s*\(|\bDELETE\b/);
    expect(setup).not.toMatch(/\.delete\s*\(|\bDELETE\b/);
  });

  it("requests the live check only for an integration run", () => {
    expect(integrationRunRequested(["run", "tests/integration/rls.smoke.test.ts"])).toBe(true);
    expect(integrationRunRequested(["run", "--exclude", "tests/integration/**"])).toBe(false);
    expect(integrationRunRequested(["run", "tests/unit"])).toBe(false);
    expect(integrationRunRequested(["run"])).toBe(true);
  });
});

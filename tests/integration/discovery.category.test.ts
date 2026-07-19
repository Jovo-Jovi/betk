/**
 * Category browse integration tests — Phase 03 / T04 (FR-PUB-3).
 *
 * Runs against STAGING. Seeds fixtures via the service-role client (bypasses
 * RLS), then drives the queries under test through a plain ANON client — the
 * exact RLS context the public `/category/[slug]` page runs under.
 *
 * Covers:
 *   STEP 0 (R-S07 consistency check) — regression tests proving the
 *   `stores!inner` fix (`_shared.ts`) excludes a suspended store's active
 *   listing from `getActiveListings` AND both `getHomepageData` strips that
 *   consume `LISTING_SUMMARY_SELECT` (new arrivals + boosted). Also verifies
 *   (does NOT fix) that `getListingById` already returns `null` for the same
 *   fixture, via its own pre-existing `if (!store) return null` guard.
 *
 *   T04 task matrix — active category renders its listings (incl. the
 *   category_id/subcategory_id OR-match, BETK_UI_SPEC.md §3 line 97);
 *   inactive category → null (page 404s); unknown slug → null (page 404s);
 *   subcategory chips assemble (children resolved + parent resolved).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function extractProjectRef(url: string): string {
  return new URL(url).hostname.split(".")[0] ?? "";
}

type Outcome = "PASS" | "FAIL" | "FINDING";
const findings: string[] = [];
function record(outcome: Outcome, label: string, detail: string): void {
  // eslint-disable-next-line no-console
  console.log(`[${outcome}] ${label} — ${detail}`);
  if (outcome === "FINDING") findings.push(`${label}: ${detail}`);
}

const RUN = randomUUID().slice(0, 8);
const createdAuthIds: string[] = [];

function anonClient() {
  return createAnonClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 03 / T04 — category browse (staging, anon client)", () => {
  const service = createServiceClient();
  const svc = () => service.schema("betk");
  const anon = anonClient();

  let sellerId = "";
  let secondSellerId = "";
  let activeStoreId = "";
  let suspendedStoreId = "";

  let topCategoryId = "";
  let topCategorySlug = "";
  let childCategoryId = "";
  let childCategorySlug = "";
  let inactiveCategorySlug = "";

  const ids = {
    topOnly: "", // category_id = top, subcategory_id = null
    childListing: "", // category_id = top, subcategory_id = child
    suspendedStoreListing: "", // active listing, SUSPENDED store — R-S07 probe
  };

  async function seedListing(fields: Record<string, unknown>): Promise<string> {
    const { data, error } = await svc()
      .from("listings")
      .insert(fields as never)
      .select("id")
      .single();
    if (error || !data) throw new Error(`[category.test] listing seed: ${error?.message}`);
    return (data as { id: string }).id;
  }

  beforeAll(async () => {
    const ref = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run category tests against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    // ── sellers (active store owner + suspended store owner; seller_id UNIQUE) ──
    const { data: authUser, error: authErr } = await service.auth.admin.createUser({
      email: `betk-t04-seller-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (authErr || !authUser.user) throw new Error(`[category.test] createUser: ${authErr?.message}`);
    sellerId = authUser.user.id;
    createdAuthIds.push(sellerId);
    await svc().from("users").insert({ id: sellerId, phone_number: null, auth_provider: "google", role: "seller" } as never);
    await svc().from("seller_profiles").insert({ id: sellerId, status: "active", is_verified: true, level: "silver" } as never);

    const { data: authUser2, error: authErr2 } = await service.auth.admin.createUser({
      email: `betk-t04-seller2-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (authErr2 || !authUser2.user) throw new Error(`[category.test] createUser2: ${authErr2?.message}`);
    secondSellerId = authUser2.user.id;
    createdAuthIds.push(secondSellerId);
    await svc().from("users").insert({ id: secondSellerId, phone_number: null, auth_provider: "google", role: "seller" } as never);
    await svc().from("seller_profiles").insert({ id: secondSellerId, status: "active" } as never);

    // ── categories: top-level (active) + child (active) + a sibling (inactive) ──
    topCategorySlug = `t04-top-${RUN}`;
    const { data: topCat, error: topCatErr } = await svc()
      .from("categories")
      .insert({ name_ar: `فئة تصفح ${RUN}`, name_en: `Browse Category ${RUN}`, slug: topCategorySlug, is_active: true, sort_order: 999 } as never)
      .select("id")
      .single();
    if (topCatErr || !topCat) throw new Error(`[category.test] top category: ${topCatErr?.message}`);
    topCategoryId = (topCat as { id: string }).id;

    childCategorySlug = `t04-child-${RUN}`;
    const { data: childCat, error: childCatErr } = await svc()
      .from("categories")
      .insert({
        name_ar: `فئة فرعية تصفح ${RUN}`,
        name_en: `Browse Subcategory ${RUN}`,
        slug: childCategorySlug,
        is_active: true,
        sort_order: 1,
        parent_id: topCategoryId,
      } as never)
      .select("id")
      .single();
    if (childCatErr || !childCat) throw new Error(`[category.test] child category: ${childCatErr?.message}`);
    childCategoryId = (childCat as { id: string }).id;

    inactiveCategorySlug = `t04-inactive-${RUN}`;
    const { error: inactiveCatErr } = await svc()
      .from("categories")
      .insert({ name_ar: `فئة معطلة ${RUN}`, slug: inactiveCategorySlug, is_active: false, sort_order: 998 } as never);
    if (inactiveCatErr) throw new Error(`[category.test] inactive category: ${inactiveCatErr.message}`);

    // ── stores: active + suspended ──
    const { data: store, error: storeErr } = await svc()
      .from("stores")
      .insert({
        seller_id: sellerId,
        name_ar: `متجر تصفح ${RUN}`,
        slug: `t04-active-${RUN}`,
        category_primary: "general",
        governorate: "cairo",
        status: "active",
      } as never)
      .select("id")
      .single();
    if (storeErr || !store) throw new Error(`[category.test] active store: ${storeErr?.message}`);
    activeStoreId = (store as { id: string }).id;

    const { data: suspStore, error: suspErr } = await svc()
      .from("stores")
      .insert({
        seller_id: secondSellerId,
        name_ar: `متجر موقوف تصفح ${RUN}`,
        slug: `t04-suspended-${RUN}`,
        category_primary: "general",
        governorate: "cairo",
        status: "suspended",
      } as never)
      .select("id")
      .single();
    if (suspErr || !suspStore) throw new Error(`[category.test] suspended store: ${suspErr?.message}`);
    suspendedStoreId = (suspStore as { id: string }).id;

    // ── listings ──
    const base = {
      category_id: topCategoryId,
      type: "product" as const,
      price: 100,
      price_type: "fixed" as const,
      stock_qty: 5,
      status: "active" as const,
    };

    ids.topOnly = await seedListing({ ...base, store_id: activeStoreId, title_ar: `منتج فئة رئيسية ${RUN}` });
    ids.childListing = await seedListing({
      ...base,
      store_id: activeStoreId,
      subcategory_id: childCategoryId,
      title_ar: `منتج فئة فرعية ${RUN}`,
    });
    ids.suspendedStoreListing = await seedListing({
      ...base,
      store_id: suspendedStoreId,
      title_ar: `منتج متجر موقوف ${RUN}`,
    });

    // Boost the suspended-store listing too — probes getHomepageData's boosted strip.
    const { data: pkg, error: pkgErr } = await svc().from("boost_packages").select("id").limit(1).single();
    if (pkgErr || !pkg) throw new Error(`[category.test] boost_packages lookup: ${pkgErr?.message}`);
    const { error: boostErr } = await svc().from("boosts").insert({
      listing_id: ids.suspendedStoreListing,
      package_id: (pkg as { id: string }).id,
      store_id: suspendedStoreId,
      payment_method: "instapay",
      amount_paid: 50,
      status: "active",
    } as never);
    if (boostErr) throw new Error(`[category.test] boost seed: ${boostErr.message}`);
  });

  afterAll(async () => {
    if (suspendedStoreId) await svc().from("boosts").delete().eq("store_id", suspendedStoreId);
    for (const id of Object.values(ids)) {
      if (id) await svc().from("listings").delete().eq("id", id);
    }
    if (activeStoreId) await svc().from("stores").delete().eq("id", activeStoreId);
    if (suspendedStoreId) await svc().from("stores").delete().eq("id", suspendedStoreId);
    if (childCategoryId) await svc().from("categories").delete().eq("id", childCategoryId);
    if (topCategoryId) await svc().from("categories").delete().eq("id", topCategoryId);
    await svc().from("categories").delete().eq("slug", inactiveCategorySlug);
    for (const sid of [sellerId, secondSellerId]) {
      if (sid) {
        await svc().from("seller_profiles").delete().eq("id", sid);
        await svc().from("users").delete().eq("id", sid);
      }
    }
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }

    // eslint-disable-next-line no-console
    console.log(
      findings.length
        ? `\n===== T04 FINDINGS =====\n${findings.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}\n=========================\n`
        : "\nT04: no findings recorded.\n",
    );
  });

  // ── STEP 0 — R-S07 regression (the stores!inner fix in _shared.ts) ───────
  it("STEP 0 (getActiveListings): a suspended store's active listing is EXCLUDED (R-S07)", async () => {
    const { getActiveListings } = await import("@/features/discovery");
    const page = await getActiveListings({ category: topCategoryId }, anon);
    const resultIds = page.items.map((i) => i.id);

    const leaked = resultIds.includes(ids.suspendedStoreListing);
    record(
      leaked ? "FAIL" : "PASS",
      "getActiveListings R-S07",
      `suspended-store listing ${leaked ? "LEAKED" : "excluded"}; active listings present: ${resultIds.includes(ids.topOnly)}`,
    );
    expect(resultIds).not.toContain(ids.suspendedStoreListing);
    expect(resultIds).toContain(ids.topOnly);
    expect(resultIds).toContain(ids.childListing);
  });

  it("STEP 0 (getHomepageData): a suspended store's listing is EXCLUDED from new-arrivals AND boosted (R-S07)", async () => {
    const { getHomepageData } = await import("@/features/discovery");
    const data = await getHomepageData(anon);

    const newArrivalsIds = (data.newArrivals.data ?? []).map((i) => i.id);
    const boostedIds = (data.boosted.data ?? []).map((i) => i.id);

    const leakedNewArrivals = newArrivalsIds.includes(ids.suspendedStoreListing);
    const leakedBoosted = boostedIds.includes(ids.suspendedStoreListing);

    record(
      leakedNewArrivals || leakedBoosted ? "FAIL" : "PASS",
      "getHomepageData R-S07",
      `newArrivals leaked:${leakedNewArrivals} (status ${data.newArrivals.status}); boosted leaked:${leakedBoosted} (status ${data.boosted.status})`,
    );
    expect(newArrivalsIds).not.toContain(ids.suspendedStoreListing);
    expect(boostedIds).not.toContain(ids.suspendedStoreListing);
  });

  it("STEP 0 (getListingById): VERIFIED — a suspended store's listing ALREADY resolves to null (no fix needed; flagged for T05)", async () => {
    const { getListingById } = await import("@/features/discovery");
    const detail = await getListingById(ids.suspendedStoreListing, anon);

    record(
      detail === null ? "PASS" : "FINDING",
      "getListingById R-S07 (verify-only, T05 owns the fix if this ever flips)",
      detail === null
        ? "resolves to null via the existing `if (!store) return null` guard — no leak, no fix applied here"
        : "UNEXPECTED: resolved non-null — this WOULD be a leak; flagging for T05",
    );
    expect(detail).toBeNull();
  });

  // ── T04 — category resolution + descendant-inclusion ─────────────────────
  it("getCategoryBySlug: active top-level category resolves with its active child + no parent", async () => {
    const { getCategoryBySlug } = await import("@/features/discovery");
    const category = await getCategoryBySlug(topCategorySlug, anon);

    expect(category).not.toBeNull();
    expect(category?.id).toBe(topCategoryId);
    expect(category?.parent).toBeNull();
    expect(category?.children.some((c) => c.id === childCategoryId)).toBe(true);
  });

  it("getCategoryBySlug: active child category resolves with its active parent + no children", async () => {
    const { getCategoryBySlug } = await import("@/features/discovery");
    const category = await getCategoryBySlug(childCategorySlug, anon);

    expect(category).not.toBeNull();
    expect(category?.id).toBe(childCategoryId);
    expect(category?.parent?.id).toBe(topCategoryId);
    expect(category?.children).toHaveLength(0);
  });

  it("getCategoryBySlug: is_active=false category resolves to null (page 404s)", async () => {
    const { getCategoryBySlug } = await import("@/features/discovery");
    const category = await getCategoryBySlug(inactiveCategorySlug, anon);
    expect(category).toBeNull();
  });

  it("getCategoryBySlug: unknown slug resolves to null (page 404s, same as inactive — no existence leak)", async () => {
    const { getCategoryBySlug } = await import("@/features/discovery");
    const category = await getCategoryBySlug(`t04-unknown-${RUN}`, anon);
    expect(category).toBeNull();
  });

  it("getActiveListings: descendant-inclusion per BETK_UI_SPEC.md §3 line 97 (category_id OR subcategory_id match)", async () => {
    const { getActiveListings } = await import("@/features/discovery");

    // Top-level page: shows listings whose category_id IS the top category
    // (both fixtures), regardless of their subcategory_id.
    const topPage = await getActiveListings({ category: topCategoryId }, anon);
    const topIds = topPage.items.map((i) => i.id);
    expect(topIds).toContain(ids.topOnly);
    expect(topIds).toContain(ids.childListing);

    // Child/subcategory page: shows only the listing whose subcategory_id IS
    // this child — NOT the one that merely shares the top-level category_id.
    const childPage = await getActiveListings({ category: childCategoryId }, anon);
    const childIds = childPage.items.map((i) => i.id);
    expect(childIds).toContain(ids.childListing);
    expect(childIds).not.toContain(ids.topOnly);

    record(
      "PASS",
      "descendant-inclusion",
      "category_id/subcategory_id OR-match confirmed both directions (BETK_UI_SPEC.md §3 Category Browse, line 97)",
    );
  });
});

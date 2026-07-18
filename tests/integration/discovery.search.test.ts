/**
 * searchListings integration tests — Phase 03 / T03 (FR-PUB-2).
 *
 * Runs against STAGING. Seeds fixtures via the service-role client (bypasses
 * RLS), then drives `searchListings` through a plain ANON client — the exact
 * RLS context the public /search page runs under.
 *
 * Covers the T03 task-pack test matrix:
 *   1. keyword matches an active listing (full-text over search_vector)
 *   2. soft-deleted + suspended-store listings are EXCLUDED (R-L10 / R-S07)
 *   3. boosted ranks ABOVE organic within the result set (R-B04, as documented)
 *   4. Arabic diacritics probe — a diacritic title is matched by a non-diacritic
 *      query AND a plain title is matched by a diacritic query (both directions;
 *      the live `'arabic'` TS config normalises diacritics without unaccent)
 *   5. a filter combination narrows the result set correctly
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

describeOrSkip("Phase 03 / T03 — searchListings (staging, anon client)", () => {
  const service = createServiceClient();
  const svc = () => service.schema("betk");
  const anon = anonClient();

  let topCategoryId = "";
  let activeStoreId = "";
  let sellerId = "";
  let secondSellerId = "";

  const ids = {
    activeMatch: "",
    draft: "",
    deleted: "",
    suspended: "",
    boosted: "",
    organic: "",
    diacriticTitle: "",
    plainTitle: "",
  };

  async function seedListing(fields: Record<string, unknown>): Promise<string> {
    const { data, error } = await svc()
      .from("listings")
      .insert(fields as never)
      .select("id")
      .single();
    if (error || !data) throw new Error(`[search.test] listing seed: ${error?.message}`);
    return (data as { id: string }).id;
  }

  beforeAll(async () => {
    const ref = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run search tests against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    // ── sellers (active store owner + suspended store owner; seller_id UNIQUE) ──
    const { data: authUser, error: authErr } = await service.auth.admin.createUser({
      email: `betk-t03-seller-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (authErr || !authUser.user) throw new Error(`[search.test] createUser: ${authErr?.message}`);
    sellerId = authUser.user.id;
    createdAuthIds.push(sellerId);
    await svc().from("users").insert({ id: sellerId, phone_number: null, auth_provider: "google", role: "seller" } as never);
    await svc().from("seller_profiles").insert({ id: sellerId, status: "active", is_verified: true, level: "silver" } as never);

    const { data: authUser2, error: authErr2 } = await service.auth.admin.createUser({
      email: `betk-t03-seller2-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (authErr2 || !authUser2.user) throw new Error(`[search.test] createUser2: ${authErr2?.message}`);
    secondSellerId = authUser2.user.id;
    createdAuthIds.push(secondSellerId);
    await svc().from("users").insert({ id: secondSellerId, phone_number: null, auth_provider: "google", role: "seller" } as never);
    await svc().from("seller_profiles").insert({ id: secondSellerId, status: "active" } as never);

    // ── category ──
    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .insert({ name_ar: `فئة بحث ${RUN}`, slug: `t03-cat-${RUN}`, is_active: true, sort_order: 999 } as never)
      .select("id")
      .single();
    if (catErr || !cat) throw new Error(`[search.test] category: ${catErr?.message}`);
    topCategoryId = (cat as { id: string }).id;

    // ── active store + suspended store ──
    const { data: store, error: storeErr } = await svc()
      .from("stores")
      .insert({
        seller_id: sellerId,
        name_ar: `متجر بحث ${RUN}`,
        slug: `t03-active-${RUN}`,
        category_primary: "general",
        governorate: "cairo",
        city: "Nasr City",
        status: "active",
      } as never)
      .select("id")
      .single();
    if (storeErr || !store) throw new Error(`[search.test] active store: ${storeErr?.message}`);
    activeStoreId = (store as { id: string }).id;

    const { data: suspStore, error: suspErr } = await svc()
      .from("stores")
      .insert({
        seller_id: secondSellerId,
        name_ar: `متجر موقوف ${RUN}`,
        slug: `t03-suspended-${RUN}`,
        category_primary: "general",
        governorate: "cairo",
        status: "suspended",
      } as never)
      .select("id")
      .single();
    if (suspErr || !suspStore) throw new Error(`[search.test] suspended store: ${suspErr?.message}`);
    const suspendedStoreId = (suspStore as { id: string }).id;

    const base = {
      store_id: activeStoreId,
      category_id: topCategoryId,
      type: "product" as const,
      price_type: "fixed" as const,
      stock_qty: 10,
    };

    // ── "سماعات" set: keyword-match + exclusion probes ──
    ids.activeMatch = await seedListing({ ...base, title_ar: `سماعات ${RUN}`, price: 150, status: "active" });
    ids.draft = await seedListing({ ...base, title_ar: `سماعات ${RUN}`, price: 150, status: "draft" });
    ids.deleted = await seedListing({ ...base, title_ar: `سماعات ${RUN}`, price: 150, status: "active", deleted_at: new Date().toISOString() });
    ids.suspended = await seedListing({ ...base, store_id: suspendedStoreId, title_ar: `سماعات ${RUN}`, price: 150, status: "active" });

    // ── "قميص" set: boosted-above-organic + filter narrowing ──
    // Boosted seeded FIRST, organic AFTER (newer) — so pure-recency would rank
    // organic first; R-B04 must still lift boosted above it.
    ids.boosted = await seedListing({ ...base, title_ar: `قميص ${RUN}`, price: 100, status: "active" });
    await new Promise((r) => setTimeout(r, 25));
    ids.organic = await seedListing({ ...base, title_ar: `قميص ${RUN}`, price: 500, status: "active" });

    const { data: pkg, error: pkgErr } = await svc().from("boost_packages").select("id").limit(1).single();
    if (pkgErr || !pkg) throw new Error(`[search.test] boost_packages lookup: ${pkgErr?.message}`);
    const { error: boostErr } = await svc().from("boosts").insert({
      listing_id: ids.boosted,
      package_id: (pkg as { id: string }).id,
      store_id: activeStoreId,
      payment_method: "instapay",
      amount_paid: 50,
      status: "active",
    } as never);
    if (boostErr) throw new Error(`[search.test] boost seed: ${boostErr.message}`);

    // ── "معلم" set: Arabic diacritics probe (both directions) ──
    ids.diacriticTitle = await seedListing({ ...base, title_ar: `مُعَلِّم ${RUN}`, price: 150, status: "active" });
    ids.plainTitle = await seedListing({ ...base, title_ar: `معلم ${RUN}`, price: 150, status: "active" });
  });

  afterAll(async () => {
    await svc().from("boosts").delete().eq("store_id", activeStoreId);
    for (const id of Object.values(ids)) {
      if (id) await svc().from("listings").delete().eq("id", id);
    }
    if (activeStoreId) await svc().from("stores").delete().eq("id", activeStoreId);
    await svc().from("stores").delete().eq("slug", `t03-suspended-${RUN}`);
    if (topCategoryId) await svc().from("categories").delete().eq("id", topCategoryId);
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
  });

  it("keyword matches the active listing; soft-deleted + suspended-store listings excluded", async () => {
    const { searchListings } = await import("@/features/discovery");
    const page = await searchListings({ q: `سماعات ${RUN}`, category: topCategoryId }, anon);
    const resultIds = page.items.map((i) => i.id);

    expect(resultIds).toContain(ids.activeMatch);
    expect(resultIds).not.toContain(ids.draft); // status='draft'
    expect(resultIds).not.toContain(ids.deleted); // soft-deleted (R-L10)
    expect(resultIds).not.toContain(ids.suspended); // suspended store (R-S07, stores!inner)
  });

  it("boosted ranks above organic within the result set (R-B04)", async () => {
    const { searchListings } = await import("@/features/discovery");
    const page = await searchListings({ q: `قميص ${RUN}`, category: topCategoryId }, anon);
    const resultIds = page.items.map((i) => i.id);

    const boostedIdx = resultIds.indexOf(ids.boosted);
    const organicIdx = resultIds.indexOf(ids.organic);

    expect(boostedIdx).toBeGreaterThanOrEqual(0);
    expect(organicIdx).toBeGreaterThanOrEqual(0);
    // Boosted appears before organic even though organic is newer.
    expect(boostedIdx).toBeLessThan(organicIdx);
    expect(page.items.find((i) => i.id === ids.boosted)?.isBoosted).toBe(true);
    expect(page.items.find((i) => i.id === ids.organic)?.isBoosted).toBe(false);
  });

  it("Arabic diacritics: non-diacritic query matches a diacritic title AND vice-versa", async () => {
    const { searchListings } = await import("@/features/discovery");

    // Query WITHOUT diacritics → must match the diacritic-titled listing.
    const plainQuery = await searchListings({ q: `معلم ${RUN}`, category: topCategoryId }, anon);
    const plainIds = plainQuery.items.map((i) => i.id);
    expect(plainIds).toContain(ids.diacriticTitle);

    // Query WITH diacritics → must match the plain-titled listing.
    const diacriticQuery = await searchListings({ q: `مُعَلِّم ${RUN}`, category: topCategoryId }, anon);
    const diacriticIds = diacriticQuery.items.map((i) => i.id);
    expect(diacriticIds).toContain(ids.plainTitle);
  });

  it("a filter combination narrows the result set correctly", async () => {
    const { searchListings } = await import("@/features/discovery");

    const unfiltered = await searchListings({ q: `قميص ${RUN}`, category: topCategoryId }, anon);
    expect(unfiltered.items.length).toBeGreaterThanOrEqual(2);

    // product + priceMax=200 → only the 100-EGP boosted one (organic is 500).
    const narrowed = await searchListings(
      { q: `قميص ${RUN}`, category: topCategoryId, type: "product", priceMax: 200 },
      anon,
    );
    const narrowedIds = narrowed.items.map((i) => i.id);
    expect(narrowedIds).toContain(ids.boosted);
    expect(narrowedIds).not.toContain(ids.organic);
  });
});

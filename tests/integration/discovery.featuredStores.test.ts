/**
 * Homepage featured stores — staging (D2, REG-111).
 *
 * Seeds via the service-role client, reads through the anon client with
 * getFeaturedStores, then deletes the fixture. Guard G must stay clean:
 * afterAll removes every row this file inserts.
 *
 * The current maximum average_rating is read before any fixture rating is
 * written. Fixture ratings sit strictly above it so those stores fall
 * inside the top 8.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import {
  FEATURED_STORES_LIMIT,
  getFeaturedStores,
} from "@/features/discovery/queries/getFeaturedStores";
import type { FeaturedStore } from "@/features/discovery/types";

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
const PASSWORD = `FS-${RUN}-pw`;
const createdAuthIds: string[] = [];
const storeIds: string[] = [];
const listingIds: string[] = [];

const slug = {
  high: `fs-high-${RUN}`,
  tieNew: `fs-tienew-${RUN}`,
  tieOld: `fs-tieold-${RUN}`,
  unrated: `fs-unrated-${RUN}`,
  inactiveListings: `fs-nolive-${RUN}`,
  suspended: `fs-susp-${RUN}`,
} as const;

function anonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function indexOfSlug(rows: FeaturedStore[], storeSlug: string): number {
  return rows.findIndex((row) => row.storeHref.endsWith(`/store/${storeSlug}`));
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("HOME-STORES-ROW — getFeaturedStores (staging)", () => {
  const service = createServiceClient();
  const svc = () => service.schema("betk");

  let categoryId = "";
  let rows: FeaturedStore[] = [];

  beforeAll(async () => {
    const ref = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run featured-store tests against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    const { data: top, error: topErr } = await svc()
      .from("rating_aggregates")
      .select("average_rating")
      .order("average_rating", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (topErr) throw new Error(`[featuredStores] max rating: ${topErr.message}`);
    const maxRating = top ? Number(top.average_rating) : 0;
    console.log("[featuredStores max average_rating]", top?.average_rating ?? null);
    if (!Number.isFinite(maxRating)) {
      throw new Error(`[featuredStores] max rating is not a number: ${String(top?.average_rating)}`);
    }
    const highRating = maxRating + 2;
    const tiedRating = maxRating + 1;

    async function makeSeller(label: string): Promise<string> {
      const { data, error } = await service.auth.admin.createUser({
        email: `betk-fs-${label}-${RUN}@betk.test`,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error(`[featuredStores] seller ${label}: ${error?.message}`);
      const id = data.user.id;
      createdAuthIds.push(id);
      const { error: userErr } = await svc().from("users").insert({
        id,
        phone_number: null,
        auth_provider: "google",
        role: "seller",
      } as never);
      if (userErr) throw new Error(`[featuredStores] users ${label}: ${userErr.message}`);
      const { error: profileErr } = await svc().from("seller_profiles").insert({
        id,
        status: "active",
        level: "silver",
        is_verified: true,
      } as never);
      if (profileErr) throw new Error(`[featuredStores] profile ${label}: ${profileErr.message}`);
      return id;
    }

    async function makeStore(
      sellerId: string,
      storeSlug: string,
      status: "active" | "suspended",
      createdAt: string,
    ): Promise<string> {
      const { data, error } = await svc()
        .from("stores")
        .insert({
          seller_id: sellerId,
          name_ar: `متجر ${storeSlug}`,
          name_en: `Store ${storeSlug}`,
          slug: storeSlug,
          category_primary: "general",
          governorate: "cairo",
          status,
          created_at: createdAt,
        } as never)
        .select("id")
        .single();
      if (error || !data) throw new Error(`[featuredStores] store ${storeSlug}: ${error?.message}`);
      const id = (data as { id: string }).id;
      storeIds.push(id);
      return id;
    }

    async function approveCategory(storeId: string): Promise<void> {
      const { error: insErr } = await svc()
        .from("store_categories")
        .insert({ store_id: storeId, category_id: categoryId });
      if (insErr) throw new Error(`[featuredStores] store_categories: ${insErr.message}`);
      const { error: updErr } = await svc()
        .from("store_categories")
        .update({ approved_at: new Date().toISOString() })
        .eq("store_id", storeId)
        .eq("category_id", categoryId);
      if (updErr) throw new Error(`[featuredStores] store_categories approve: ${updErr.message}`);
    }

    async function makeListing(
      storeId: string,
      status: "active" | "draft",
      deletedAt: string | null,
    ): Promise<void> {
      const { data, error } = await svc()
        .from("listings")
        .insert({
          store_id: storeId,
          category_id: categoryId,
          type: "product",
          title_ar: `إعلان ${storeId.slice(0, 8)}`,
          price: 100,
          price_type: "fixed",
          stock_qty: 4,
          status,
          prep_days: 1,
          weight_g: 1,
          length_mm: 1,
          width_mm: 1,
          height_mm: 1,
          deleted_at: deletedAt,
        } as never)
        .select("id")
        .single();
      if (error || !data) throw new Error(`[featuredStores] listing: ${error?.message}`);
      listingIds.push((data as { id: string }).id);
    }

    async function makeRating(storeId: string, average: number): Promise<void> {
      const { error } = await svc().from("rating_aggregates").insert({
        store_id: storeId,
        average_rating: average,
        total_reviews: 1,
        rating_5: 1,
        rating_4: 0,
        rating_3: 0,
        rating_2: 0,
        rating_1: 0,
      } as never);
      if (error) throw new Error(`[featuredStores] rating: ${error.message}`);
    }

    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .insert({
        name_ar: `فئة متاجر ${RUN}`,
        name_en: `Stores Cat ${RUN}`,
        slug: `fs-cat-${RUN}`,
        is_active: true,
        sort_order: 999,
      } as never)
      .select("id")
      .single();
    if (catErr || !cat) throw new Error(`[featuredStores] category: ${catErr?.message}`);
    categoryId = (cat as { id: string }).id;

    const now = Date.now();
    const highId = await makeStore(
      await makeSeller("high"),
      slug.high,
      "active",
      new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    );
    const tieNewId = await makeStore(
      await makeSeller("tienew"),
      slug.tieNew,
      "active",
      new Date(now - 1 * 60 * 60 * 1000).toISOString(),
    );
    const tieOldId = await makeStore(
      await makeSeller("tieold"),
      slug.tieOld,
      "active",
      new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    );
    const unratedId = await makeStore(
      await makeSeller("unrated"),
      slug.unrated,
      "active",
      new Date(now).toISOString(),
    );
    const inactiveId = await makeStore(
      await makeSeller("nolive"),
      slug.inactiveListings,
      "active",
      new Date(now).toISOString(),
    );
    const suspendedId = await makeStore(
      await makeSeller("susp"),
      slug.suspended,
      "suspended",
      new Date(now).toISOString(),
    );

    for (const id of [highId, tieNewId, tieOldId, unratedId, inactiveId, suspendedId]) {
      await approveCategory(id);
    }

    await makeListing(highId, "active", null);
    await makeListing(tieNewId, "active", null);
    await makeListing(tieOldId, "active", null);
    await makeListing(unratedId, "active", null);
    await makeListing(inactiveId, "draft", null);
    await makeListing(inactiveId, "active", new Date(now).toISOString());
    await makeListing(suspendedId, "active", null);

    await makeRating(highId, highRating);
    await makeRating(tieNewId, tiedRating);
    await makeRating(tieOldId, tiedRating);

    rows = await getFeaturedStores("ar", anonClient());
  });

  afterAll(async () => {
    if (listingIds.length > 0) {
      await svc().from("listings").delete().in("id", listingIds);
    }
    if (storeIds.length > 0) {
      await svc().from("store_categories").delete().in("store_id", storeIds);
      await svc().from("rating_aggregates").delete().in("store_id", storeIds);
      await svc().from("stores").delete().in("id", storeIds);
    }
    if (categoryId) await svc().from("categories").delete().eq("id", categoryId);
    if (createdAuthIds.length > 0) {
      await svc().from("seller_profiles").delete().in("id", createdAuthIds);
      await svc().from("users").delete().in("id", createdAuthIds);
    }
    for (const id of createdAuthIds) {
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  it("includes an active store that has an active listing", () => {
    expect(indexOfSlug(rows, slug.high)).toBeGreaterThanOrEqual(0);
  });

  it("excludes an active store whose only listings are draft or soft-deleted", () => {
    expect(indexOfSlug(rows, slug.inactiveListings)).toBe(-1);
  });

  it("excludes a suspended store that has an active listing", () => {
    expect(indexOfSlug(rows, slug.suspended)).toBe(-1);
  });

  it("orders a higher average_rating first", () => {
    const high = indexOfSlug(rows, slug.high);
    const tied = indexOfSlug(rows, slug.tieNew);
    expect(high).toBeGreaterThanOrEqual(0);
    expect(tied).toBeGreaterThan(high);
  });

  it("breaks an equal rating toward the newer store", () => {
    const newer = indexOfSlug(rows, slug.tieNew);
    const older = indexOfSlug(rows, slug.tieOld);
    expect(newer).toBeGreaterThanOrEqual(0);
    expect(older).toBeGreaterThan(newer);
  });

  it("places an unrated store after the rated ones", () => {
    const unrated = indexOfSlug(rows, slug.unrated);
    const oldestRated = indexOfSlug(rows, slug.tieOld);
    expect(unrated).toBeGreaterThanOrEqual(0);
    expect(unrated).toBeGreaterThan(oldestRated);
  });

  it("returns at most 8 rows and sends that limit on the database request", async () => {
    expect(rows.length).toBeLessThanOrEqual(FEATURED_STORES_LIMIT);
    for (const row of rows) {
      expect(row).not.toHaveProperty("listingCount");
      expect(row.hideFollow).toBe(true);
    }

    const seen: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      seen.push(url);
      return original(input, init);
    }) as typeof fetch;
    try {
      const again = await getFeaturedStores("ar", anonClient());
      expect(again.length).toBeLessThanOrEqual(FEATURED_STORES_LIMIT);
    } finally {
      globalThis.fetch = original;
    }

    const hit = seen.find((url) => url.includes("/stores"));
    expect(hit).toBeTruthy();
    const params = new URL(hit!).searchParams;
    expect(params.get("limit")).toBe(String(FEATURED_STORES_LIMIT));
    expect(params.get("listings.limit")).toBe("1");
  });
});

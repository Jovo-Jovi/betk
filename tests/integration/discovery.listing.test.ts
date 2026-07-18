/**
 * Listing Detail integration tests — Phase 03 / T05 (FR-PUB-4).
 *
 * Runs against STAGING. Seeds fixtures via the service-role client (bypasses
 * RLS), then drives `getListingById`/`getMoreFromStore` under test through a
 * plain ANON client — the exact RLS context the public `/listing/[id]` page
 * runs under.
 *
 * Covers the T05 task matrix:
 *   - active listing renders full data (images, tags, store, seller, reviews
 *     with photos + seller reply)
 *   - soft-deleted → null (page 404s, R-L10)
 *   - suspended-store listing → null (page 404s) — re-verifies the T04 STEP 0
 *     finding now that T05 actually owns/ships this page
 *   - quote_only → price null / priceType 'quote_only' (PriceBlock hides the
 *     number; the page additionally suppresses the exact stock count — see
 *     tests/unit/listingStockDisplay.unit.test.ts for that pure-logic proof)
 *   - sold-out state reachable via `stock_qty=0` while `status` stays
 *     'active' (the only anon-visible path to R-N06's restock CTA today)
 *   - getMoreFromStore rail: same-store active listings, excluding the
 *     current one, excluding other stores/soft-deleted
 *
 * Plus a NEW FINDING (verified live, NOT fixed — no new policy is in this
 * task's scope): a listing whose `status` enum is literally `sold_out`
 * (reachable via the now-live `decrement_stock_on_confirm` trigger, R2)
 * resolves to `null` here too, because `listings_public` RLS only exposes
 * `status='active'` rows to anon. This contradicts FR-PUB-4/R-N06's explicit
 * requirement that a sold-out listing stay publicly visible. See the test
 * below and the page.tsx header comment for the full writeup.
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

describeOrSkip("Phase 03 / T05 — listing detail (staging, anon client)", () => {
  const service = createServiceClient();
  const svc = () => service.schema("betk");
  const anon = anonClient();

  let sellerId = "";
  let secondSellerId = "";
  let buyerId = "";
  let activeStoreId = "";
  let suspendedStoreId = "";
  let categoryId = "";

  const ids = {
    fullListing: "", // active, images + tags + a visible review with photos + seller reply
    railSibling: "", // second active listing on the SAME store — more-from-store rail
    deletedListing: "", // R-L10 soft-deleted
    suspendedStoreListing: "", // active listing, SUSPENDED store — R-S07 re-verify
    quoteOnlyListing: "", // price_type = quote_only
    stockZeroActiveListing: "", // status stays 'active', stock_qty = 0 (the reachable sold-out state)
    soldOutStatusListing: "", // status enum = 'sold_out' — the FINDING
  };
  let orderId = "";
  let reviewId = "";

  beforeAll(async () => {
    const ref = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run listing-detail tests against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    // ── identities: active-store seller, suspended-store seller, buyer ──
    const { data: authUser, error: authErr } = await service.auth.admin.createUser({
      email: `betk-t05-seller-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (authErr || !authUser.user) throw new Error(`[listing.test] createUser: ${authErr?.message}`);
    sellerId = authUser.user.id;
    createdAuthIds.push(sellerId);
    await svc().from("users").insert({ id: sellerId, phone_number: null, auth_provider: "google", role: "seller" } as never);
    await svc().from("seller_profiles").insert({ id: sellerId, status: "active", is_verified: true, level: "gold", avg_response_hours: 2 } as never);

    const { data: authUser2, error: authErr2 } = await service.auth.admin.createUser({
      email: `betk-t05-seller2-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (authErr2 || !authUser2.user) throw new Error(`[listing.test] createUser2: ${authErr2?.message}`);
    secondSellerId = authUser2.user.id;
    createdAuthIds.push(secondSellerId);
    await svc().from("users").insert({ id: secondSellerId, phone_number: null, auth_provider: "google", role: "seller" } as never);
    await svc().from("seller_profiles").insert({ id: secondSellerId, status: "active" } as never);

    const { data: buyerAuth, error: buyerAuthErr } = await service.auth.admin.createUser({
      email: `betk-t05-buyer-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (buyerAuthErr || !buyerAuth.user) throw new Error(`[listing.test] createUser (buyer): ${buyerAuthErr?.message}`);
    buyerId = buyerAuth.user.id;
    createdAuthIds.push(buyerId);
    await svc().from("users").insert({ id: buyerId, phone_number: null, auth_provider: "google", role: "buyer" } as never);

    // ── category ──
    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .insert({ name_ar: `فئة تفاصيل ${RUN}`, name_en: `Detail Category ${RUN}`, slug: `t05-cat-${RUN}`, is_active: true, sort_order: 999 } as never)
      .select("id")
      .single();
    if (catErr || !cat) throw new Error(`[listing.test] category: ${catErr?.message}`);
    categoryId = (cat as { id: string }).id;

    // ── stores: active + suspended ──
    const { data: store, error: storeErr } = await svc()
      .from("stores")
      .insert({
        seller_id: sellerId,
        name_ar: `متجر تفاصيل ${RUN}`,
        name_en: `Detail Store ${RUN}`,
        slug: `t05-active-${RUN}`,
        category_primary: "general",
        governorate: "cairo",
        city: "Nasr City",
        status: "active",
      } as never)
      .select("id")
      .single();
    if (storeErr || !store) throw new Error(`[listing.test] active store: ${storeErr?.message}`);
    activeStoreId = (store as { id: string }).id;

    const { data: suspStore, error: suspErr } = await svc()
      .from("stores")
      .insert({
        seller_id: secondSellerId,
        name_ar: `متجر موقوف تفاصيل ${RUN}`,
        slug: `t05-suspended-${RUN}`,
        category_primary: "general",
        governorate: "cairo",
        status: "suspended",
      } as never)
      .select("id")
      .single();
    if (suspErr || !suspStore) throw new Error(`[listing.test] suspended store: ${suspErr?.message}`);
    suspendedStoreId = (suspStore as { id: string }).id;

    await svc().from("rating_aggregates").insert({
      store_id: activeStoreId,
      average_rating: 4.8,
      total_reviews: 1,
      rating_5: 1,
      rating_4: 0,
      rating_3: 0,
      rating_2: 0,
      rating_1: 0,
    } as never);

    // ── listings ──
    const base = {
      store_id: activeStoreId,
      category_id: categoryId,
      type: "product" as const,
      price: 250,
      price_type: "fixed" as const,
      stock_qty: 10,
      status: "active" as const,
    };

    async function seedListing(fields: Record<string, unknown>): Promise<string> {
      const { data, error } = await svc().from("listings").insert(fields as never).select("id").single();
      if (error || !data) throw new Error(`[listing.test] listing seed: ${error?.message}`);
      return (data as { id: string }).id;
    }

    ids.fullListing = await seedListing({ ...base, title_ar: `منتج كامل ${RUN}`, title_en: `Full Listing ${RUN}` });
    ids.railSibling = await seedListing({ ...base, title_ar: `منتج آخر بنفس المتجر ${RUN}` });
    ids.deletedListing = await seedListing({ ...base, title_ar: `منتج محذوف ${RUN}`, deleted_at: new Date().toISOString() });
    ids.suspendedStoreListing = await seedListing({ ...base, store_id: suspendedStoreId, title_ar: `منتج متجر موقوف ${RUN}` });
    ids.quoteOnlyListing = await seedListing({
      ...base,
      title_ar: `منتج عرض سعر ${RUN}`,
      price: null,
      price_type: "quote_only",
      stock_qty: 2,
      low_stock_threshold: 3,
    });
    ids.stockZeroActiveListing = await seedListing({ ...base, title_ar: `منتج نفد مخزونه ${RUN}`, stock_qty: 0 });
    // FINDING fixture — direct insert with status='sold_out' (bypasses the
    // order-confirm trigger; a real order-confirm flow would reach this same
    // state — R2's decrement_stock_on_confirm trigger, now live).
    ids.soldOutStatusListing = await seedListing({ ...base, title_ar: `منتج بحالة نفاد رسمية ${RUN}`, status: "sold_out", stock_qty: 0 });

    // ── listing_images + listing_tags on the full listing ──
    await svc().from("listing_images").insert([
      { listing_id: ids.fullListing, url: `https://cdn.betk.test/t05-${RUN}-0.jpg`, sort_order: 0 },
      { listing_id: ids.fullListing, url: `https://cdn.betk.test/t05-${RUN}-1.jpg`, sort_order: 1 },
    ] as never);
    await svc().from("listing_tags").insert([
      { listing_id: ids.fullListing, tag: "هدايا" },
      { listing_id: ids.fullListing, tag: "يدوي" },
    ] as never);

    // ── a confirmed order + a visible review (with a photo + seller reply) on the full listing's store ──
    const { data: order, error: orderErr } = await svc()
      .from("orders")
      .insert({
        betk_ref: `BETK-T05TEST-${RUN}`,
        buyer_id: buyerId,
        store_id: activeStoreId,
        delivery_method: "pickup",
        delivery_fee: 0,
        subtotal: 250,
        total_amount: 250,
        status: "delivered",
      } as never)
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(`[listing.test] order: ${orderErr?.message}`);
    orderId = (order as { id: string }).id;

    const { data: review, error: reviewErr } = await svc()
      .from("reviews")
      .insert({
        order_id: orderId,
        buyer_id: buyerId,
        store_id: activeStoreId,
        rating: 5,
        body: `تجربة ممتازة ${RUN}`,
        is_visible: true,
        seller_reply: `شكرًا لك ${RUN}`,
        seller_replied_at: new Date().toISOString(),
      } as never)
      .select("id")
      .single();
    if (reviewErr || !review) throw new Error(`[listing.test] review: ${reviewErr?.message}`);
    reviewId = (review as { id: string }).id;

    await svc().from("review_photos").insert([
      { review_id: reviewId, url: `https://cdn.betk.test/t05-review-${RUN}.jpg`, sort_order: 0 },
    ] as never);
  });

  afterAll(async () => {
    if (reviewId) await svc().from("review_photos").delete().eq("review_id", reviewId);
    if (reviewId) await svc().from("reviews").delete().eq("id", reviewId);
    if (orderId) await svc().from("orders").delete().eq("id", orderId);
    for (const id of Object.values(ids)) {
      if (id) await svc().from("listings").delete().eq("id", id);
    }
    if (activeStoreId) await svc().from("rating_aggregates").delete().eq("store_id", activeStoreId);
    if (activeStoreId) await svc().from("stores").delete().eq("id", activeStoreId);
    if (suspendedStoreId) await svc().from("stores").delete().eq("id", suspendedStoreId);
    if (categoryId) await svc().from("categories").delete().eq("id", categoryId);
    for (const sid of [sellerId, secondSellerId]) {
      if (sid) {
        await svc().from("seller_profiles").delete().eq("id", sid);
      }
    }
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }

    // eslint-disable-next-line no-console
    console.log(
      findings.length
        ? `\n===== T05 FINDINGS =====\n${findings.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}\n=========================\n`
        : "\nT05: no findings recorded.\n",
    );
  });

  it("getListingById: active listing renders full data — images, tags, store, seller, visible review with photo + seller reply", async () => {
    const { getListingById } = await import("@/features/discovery");
    const detail = await getListingById(ids.fullListing, anon);

    expect(detail).not.toBeNull();
    expect(detail?.titleAr).toContain(RUN);
    expect(detail?.images.length).toBe(2);
    expect(detail?.images[0]?.sortOrder).toBe(0);
    expect(detail?.tags.sort()).toEqual(["هدايا", "يدوي"].sort());
    expect(detail?.store.id).toBe(activeStoreId);
    expect(detail?.seller?.level).toBe("gold");
    expect(detail?.seller?.isVerified).toBe(true);
    expect(detail?.reviews.length).toBe(1);
    expect(detail?.reviews[0]?.body).toContain(RUN);
    expect(detail?.reviews[0]?.sellerReply).toContain(RUN);
    expect(detail?.reviews[0]?.photos.length).toBe(1);
  });

  it("getListingById: soft-deleted listing resolves to null (R-L10, page 404s)", async () => {
    const { getListingById } = await import("@/features/discovery");
    const detail = await getListingById(ids.deletedListing, anon);
    expect(detail).toBeNull();
  });

  it("getListingById: a suspended store's active listing resolves to null (R-S07, page 404s)", async () => {
    const { getListingById } = await import("@/features/discovery");
    const detail = await getListingById(ids.suspendedStoreListing, anon);

    record(
      detail === null ? "PASS" : "FAIL",
      "getListingById R-S07 (T05 re-verification)",
      detail === null ? "resolves to null — no leak" : "UNEXPECTED: resolved non-null — this IS a leak",
    );
    expect(detail).toBeNull();
  });

  it("getListingById: quote_only listing returns priceType='quote_only' and price=null", async () => {
    const { getListingById } = await import("@/features/discovery");
    const detail = await getListingById(ids.quoteOnlyListing, anon);

    expect(detail).not.toBeNull();
    expect(detail?.priceType).toBe("quote_only");
    expect(detail?.price).toBeNull();
    expect(detail?.stockQty).toBe(2); // raw value still returned; the PAGE hides the number (unit-tested separately)
  });

  it("getListingById: a listing with status still 'active' but stock_qty=0 IS anon-visible (the reachable sold-out state)", async () => {
    const { getListingById } = await import("@/features/discovery");
    const detail = await getListingById(ids.stockZeroActiveListing, anon);

    expect(detail).not.toBeNull();
    expect(detail?.status).toBe("active");
    expect(detail?.stockQty).toBe(0);
  });

  it("FINDING: a listing whose status enum is 'sold_out' resolves to null — listings_public RLS hides it, contradicting FR-PUB-4/R-N06 (NOT fixed here, no new policy)", async () => {
    const { getListingById } = await import("@/features/discovery");
    const detail = await getListingById(ids.soldOutStatusListing, anon);

    record(
      detail === null ? "FINDING" : "PASS",
      "listings_public RLS vs FR-PUB-4/R-N06 sold_out visibility",
      detail === null
        ? "status='sold_out' listing resolves to null for anon — listings_public RLS only allows status='active'; a genuinely sold-out listing (reachable via the live decrement_stock_on_confirm trigger, R2) would 404 on the public listing page, contradicting the documented requirement that it stay visible with a restock CTA. Flagged for a dedicated review/fix task (new policy needed) — NOT fixed in T05 (no new policies allowed in this task)."
        : "UNEXPECTED: resolved non-null — the finding no longer reproduces",
    );
    expect(detail).toBeNull();
  });

  it("getMoreFromStore: returns the sibling active listing from the same store, excluding the current one", async () => {
    const { getMoreFromStore } = await import("@/features/discovery");
    const rail = await getMoreFromStore(activeStoreId, ids.fullListing, anon);

    const railIds = rail.map((r) => r.id);
    expect(railIds).toContain(ids.railSibling);
    expect(railIds).not.toContain(ids.fullListing);
    expect(railIds).not.toContain(ids.deletedListing);
  });

  it("getMoreFromStore: excludes listings from other stores", async () => {
    const { getMoreFromStore } = await import("@/features/discovery");
    const rail = await getMoreFromStore(activeStoreId, randomUUID(), anon);
    const railIds = rail.map((r) => r.id);
    expect(railIds).not.toContain(ids.suspendedStoreListing);
  });
});

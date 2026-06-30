/**
 * Discovery query layer integration tests — Phase 03 / T01.
 *
 * Runs against the STAGING Supabase project. Seeds fixtures via the
 * service-role client (bypasses RLS), then drives every query under test
 * through a plain ANON client (no session) — exactly the RLS context the
 * real public pages run under (T02/T04/T05/T06).
 *
 * Required by the T01 task pack:
 *   1. active listing visible (getActiveListings + getListingById)
 *   2. draft + soft-deleted listings hidden
 *   3. suspended store → getStoreBySlug returns null
 *   4. category tree assembles parent/child
 *
 * Plus an evidence suite for the RLS finding recorded in
 * `src/features/discovery/queries/_shared.ts`: `listing_images`,
 * `listing_tags`, `rating_aggregates`, `review_photos`, and
 * `collection_listings` have RLS enabled with ZERO policies on staging, so
 * these assertions are expected to come back empty for anon — recorded as
 * FINDING (not FAIL), mirroring the Phase 01 T08 harness convention.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Runtime gating — skip cleanly when staging credentials are absent
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Findings ledger (mirrors tests/integration/rls.smoke.test.ts conventions)
// ---------------------------------------------------------------------------
type Outcome = "PASS" | "FAIL" | "FINDING";
const findings: string[] = [];
function record(outcome: Outcome, label: string, detail: string): void {
  // eslint-disable-next-line no-console
  console.log(`[${outcome}] ${label} — ${detail}`);
  if (outcome === "FINDING") findings.push(`${label}: ${detail}`);
}

// ---------------------------------------------------------------------------
// Fixture state
// ---------------------------------------------------------------------------
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

describeOrSkip("Phase 03 / T01 — discovery query layer (staging, anon client)", () => {
  const service = createServiceClient();
  const svc = () => service.schema("betk");
  const anon = anonClient();

  let topCategoryId = "";
  let childCategoryId = "";
  let storeId = "";
  let suspendedStoreSlug = "";
  let activeStoreSlug = "";
  let sellerId = "";
  let secondSellerId = ""; // stores.seller_id is UNIQUE (1 store/seller) — needs its own owner
  let activeListingId = "";
  let draftListingId = "";
  let deletedListingId = "";
  let collectionListingId = ""; // active listing attached to a live collection

  beforeAll(async () => {
    // ---- STAGING_GUARD ----
    const ref = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run discovery tests against project '${ref}'. ` +
          `Only these refs are allowed: ${STAGING_ALLOWLIST.join(", ")}. ` +
          `Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    // ---- seller identity (owns both stores) ----
    const { data: authUser, error: authErr } = await service.auth.admin.createUser({
      email: `betk-t01-seller-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (authErr || !authUser.user) {
      throw new Error(`[discovery.test] createUser failed: ${authErr?.message}`);
    }
    sellerId = authUser.user.id;
    createdAuthIds.push(sellerId);

    const { error: usersErr } = await svc()
      .from("users")
      .insert({ id: sellerId, phone_number: null, auth_provider: "google", role: "seller" });
    if (usersErr) throw new Error(`[discovery.test] betk.users seed: ${usersErr.message}`);

    const { error: spErr } = await svc()
      .from("seller_profiles")
      .insert({ id: sellerId, status: "active", is_verified: true, level: "silver" });
    if (spErr) throw new Error(`[discovery.test] seller_profiles seed: ${spErr.message}`);

    // ---- second seller identity (stores.seller_id is UNIQUE — owns the suspended store) ----
    const { data: secondAuthUser, error: secondAuthErr } = await service.auth.admin.createUser({
      email: `betk-t01-seller2-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (secondAuthErr || !secondAuthUser.user) {
      throw new Error(`[discovery.test] second seller createUser failed: ${secondAuthErr?.message}`);
    }
    secondSellerId = secondAuthUser.user.id;
    createdAuthIds.push(secondSellerId);

    const { error: secondUsersErr } = await svc()
      .from("users")
      .insert({ id: secondSellerId, phone_number: null, auth_provider: "google", role: "seller" });
    if (secondUsersErr) {
      throw new Error(`[discovery.test] second seller users seed: ${secondUsersErr.message}`);
    }
    const { error: secondSpErr } = await svc()
      .from("seller_profiles")
      .insert({ id: secondSellerId, status: "active" });
    if (secondSpErr) throw new Error(`[discovery.test] second seller_profiles seed: ${secondSpErr.message}`);

    // ---- categories: top-level + child ----
    const { data: topCat, error: topCatErr } = await svc()
      .from("categories")
      .insert({ name_ar: `فئة اختبار ${RUN}`, slug: `t01-top-${RUN}`, is_active: true, sort_order: 999 })
      .select("id")
      .single();
    if (topCatErr || !topCat) throw new Error(`[discovery.test] top category: ${topCatErr?.message}`);
    topCategoryId = topCat.id;

    const { data: childCat, error: childCatErr } = await svc()
      .from("categories")
      .insert({
        name_ar: `فئة فرعية اختبار ${RUN}`,
        slug: `t01-child-${RUN}`,
        is_active: true,
        sort_order: 1,
        parent_id: topCategoryId,
      })
      .select("id")
      .single();
    if (childCatErr || !childCat) throw new Error(`[discovery.test] child category: ${childCatErr?.message}`);
    childCategoryId = childCat.id;

    // ---- stores: one active, one suspended ----
    activeStoreSlug = `t01-active-store-${RUN}`;
    suspendedStoreSlug = `t01-suspended-store-${RUN}`;

    const { data: store, error: storeErr } = await svc()
      .from("stores")
      .insert({
        seller_id: sellerId,
        name_ar: `متجر اختبار ${RUN}`,
        slug: activeStoreSlug,
        category_primary: "general",
        governorate: "Cairo",
        status: "active",
      })
      .select("id")
      .single();
    if (storeErr || !store) throw new Error(`[discovery.test] active store: ${storeErr?.message}`);
    storeId = store.id;

    const { error: suspendedStoreErr } = await svc().from("stores").insert({
      seller_id: secondSellerId,
      name_ar: `متجر معلق اختبار ${RUN}`,
      slug: suspendedStoreSlug,
      category_primary: "general",
      governorate: "Cairo",
      status: "suspended",
    });
    if (suspendedStoreErr) {
      throw new Error(`[discovery.test] suspended store: ${suspendedStoreErr.message}`);
    }

    // ---- rating_aggregates for the active store (RLS-gap evidence) ----
    const { error: raErr } = await svc()
      .from("rating_aggregates")
      .insert({
        store_id: storeId,
        average_rating: 4.5,
        total_reviews: 1,
        rating_5: 1,
        rating_4: 0,
        rating_3: 0,
        rating_2: 0,
        rating_1: 0,
      });
    if (raErr) throw new Error(`[discovery.test] rating_aggregates seed: ${raErr.message}`);

    // ---- listings: active / draft / soft-deleted ----
    const baseListing = {
      store_id: storeId,
      category_id: topCategoryId,
      subcategory_id: childCategoryId,
      type: "product" as const,
      price: 150,
      price_type: "fixed" as const,
      stock_qty: 10,
    };

    const { data: active, error: aErr } = await svc()
      .from("listings")
      .insert({ ...baseListing, title_ar: `منتج فعال ${RUN}`, status: "active" })
      .select("id")
      .single();
    if (aErr || !active) throw new Error(`[discovery.test] active listing: ${aErr?.message}`);
    activeListingId = active.id;
    collectionListingId = active.id;

    const { data: draft, error: dErr } = await svc()
      .from("listings")
      .insert({ ...baseListing, title_ar: `منتج مسودة ${RUN}`, status: "draft" })
      .select("id")
      .single();
    if (dErr || !draft) throw new Error(`[discovery.test] draft listing: ${dErr?.message}`);
    draftListingId = draft.id;

    const { data: deleted, error: delErr } = await svc()
      .from("listings")
      .insert({
        ...baseListing,
        title_ar: `منتج محذوف ${RUN}`,
        status: "active",
        deleted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (delErr || !deleted) throw new Error(`[discovery.test] deleted listing: ${delErr?.message}`);
    deletedListingId = deleted.id;

    // ---- listing_images + listing_tags (RLS-gap evidence) ----
    const { error: imgErr } = await svc()
      .from("listing_images")
      .insert([{ listing_id: activeListingId, url: "https://cdn.betk.test/hero.jpg", sort_order: 0 }]);
    if (imgErr) throw new Error(`[discovery.test] listing_images seed: ${imgErr.message}`);

    const { error: tagErr } = await svc()
      .from("listing_tags")
      .insert([{ listing_id: activeListingId, tag: "اختبار" }]);
    if (tagErr) throw new Error(`[discovery.test] listing_tags seed: ${tagErr.message}`);

    // ---- collection + collection_listings (RLS-gap evidence) ----
    const { data: collection, error: colErr } = await svc()
      .from("collections")
      .insert({
        name_ar: `مجموعة اختبار ${RUN}`,
        homepage_position: 999,
        status: "live",
        created_by: sellerId,
      })
      .select("id")
      .single();
    if (colErr || !collection) throw new Error(`[discovery.test] collection seed: ${colErr?.message}`);

    const { error: clErr } = await svc()
      .from("collection_listings")
      .insert([{ collection_id: collection.id, listing_id: collectionListingId, sort_order: 0 }]);
    if (clErr) throw new Error(`[discovery.test] collection_listings seed: ${clErr.message}`);

    // ---- boost (active) on the active listing ----
    const { data: pkg, error: pkgErr } = await svc()
      .from("boost_packages")
      .select("id")
      .limit(1)
      .single();
    if (pkgErr || !pkg) throw new Error(`[discovery.test] boost_packages lookup: ${pkgErr?.message}`);

    const { error: boostErr } = await svc().from("boosts").insert({
      listing_id: activeListingId,
      package_id: pkg.id,
      store_id: storeId,
      payment_method: "instapay",
      amount_paid: 50,
      status: "active",
    });
    if (boostErr) throw new Error(`[discovery.test] boost seed: ${boostErr.message}`);

    // ---- buyer + order + visible review + review_photos (RLS-gap evidence) ----
    const { data: buyerAuth, error: buyerAuthErr } = await service.auth.admin.createUser({
      email: `betk-t01-buyer-${RUN}@betk.test`,
      email_confirm: true,
    });
    if (buyerAuthErr || !buyerAuth.user) {
      throw new Error(`[discovery.test] buyer createUser failed: ${buyerAuthErr?.message}`);
    }
    const buyerId = buyerAuth.user.id;
    createdAuthIds.push(buyerId);

    const { error: buyerRowErr } = await svc()
      .from("users")
      .insert({ id: buyerId, phone_number: `0102${RUN}`, auth_provider: "phone" });
    if (buyerRowErr) throw new Error(`[discovery.test] buyer users seed: ${buyerRowErr.message}`);

    const { data: order, error: orderErr } = await svc()
      .from("orders")
      .insert({
        betk_ref: `T01-${RUN}`,
        buyer_id: buyerId,
        store_id: storeId,
        delivery_method: "delivery",
        subtotal: 150,
        delivery_fee: 0,
        total_amount: 150,
        status: "delivered",
      })
      .select("id")
      .single();
    if (orderErr || !order) throw new Error(`[discovery.test] order seed: ${orderErr?.message}`);

    const { data: review, error: reviewErr } = await svc()
      .from("reviews")
      .insert({
        order_id: order.id,
        buyer_id: buyerId,
        store_id: storeId,
        rating: 5,
        body: `تجربة ممتازة ${RUN}`,
        is_visible: true,
        edit_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (reviewErr || !review) throw new Error(`[discovery.test] review seed: ${reviewErr?.message}`);

    const { error: photoErr } = await svc()
      .from("review_photos")
      .insert([{ review_id: review.id, url: "https://cdn.betk.test/review.jpg", sort_order: 0 }]);
    if (photoErr) throw new Error(`[discovery.test] review_photos seed: ${photoErr.message}`);
  });

  afterAll(async () => {
    // FK-safe teardown order. `reviews`→`review_photos`, `stores`→`rating_aggregates`,
    // `listings`→`listing_images`/`listing_tags`/`collection_listings` all cascade;
    // `boosts`/`orders` do NOT cascade from `stores` and must be deleted first.
    if (storeId) {
      await svc().from("reviews").delete().eq("store_id", storeId);
      await svc().from("orders").delete().eq("store_id", storeId);
      await svc().from("boosts").delete().eq("store_id", storeId);
      await svc().from("rating_aggregates").delete().eq("store_id", storeId);
    }
    if (collectionListingId) {
      await svc().from("collection_listings").delete().eq("listing_id", collectionListingId);
    }
    await svc().from("collections").delete().like("name_ar", `%${RUN}%`);
    for (const id of [activeListingId, draftListingId, deletedListingId]) {
      if (id) {
        await svc().from("listing_images").delete().eq("listing_id", id);
        await svc().from("listing_tags").delete().eq("listing_id", id);
        await svc().from("listings").delete().eq("id", id);
      }
    }
    if (storeId) await svc().from("stores").delete().eq("id", storeId);
    await svc().from("stores").delete().eq("slug", suspendedStoreSlug);
    if (childCategoryId) await svc().from("categories").delete().eq("id", childCategoryId);
    if (topCategoryId) await svc().from("categories").delete().eq("id", topCategoryId);
    if (sellerId) {
      await svc().from("seller_profiles").delete().eq("id", sellerId);
      await svc().from("users").delete().eq("id", sellerId);
    }
    if (secondSellerId) {
      await svc().from("seller_profiles").delete().eq("id", secondSellerId);
      await svc().from("users").delete().eq("id", secondSellerId);
    }
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }

    // eslint-disable-next-line no-console
    console.log(
      findings.length
        ? `\n===== T01 FINDINGS =====\n${findings.map((f, i) => `  ${i + 1}. ${f}`).join("\n")}\n=========================\n`
        : "\nT01: no findings recorded.\n",
    );
  });

  // -------------------------------------------------------------------------
  it("getActiveListings: anon sees the active listing; draft + soft-deleted hidden", async () => {
    const { getActiveListings } = await import("@/features/discovery");
    const page = await getActiveListings({ category: topCategoryId }, anon);

    const ids = page.items.map((i) => i.id);
    const hasActive = ids.includes(activeListingId);
    const hidesDraft = !ids.includes(draftListingId);
    const hidesDeleted = !ids.includes(deletedListingId);

    record(
      hasActive && hidesDraft && hidesDeleted ? "PASS" : "FAIL",
      "getActiveListings",
      `active:${hasActive} draftHidden:${hidesDraft} deletedHidden:${hidesDeleted}`,
    );
    expect(hasActive).toBe(true);
    expect(hidesDraft).toBe(true);
    expect(hidesDeleted).toBe(true);
  });

  it("getListingById: active listing resolves; draft + soft-deleted resolve to null", async () => {
    const { getListingById } = await import("@/features/discovery");

    const activeResult = await getListingById(activeListingId, anon);
    const draftResult = await getListingById(draftListingId, anon);
    const deletedResult = await getListingById(deletedListingId, anon);

    expect(activeResult).not.toBeNull();
    expect(activeResult?.titleAr).toContain(RUN);
    expect(draftResult).toBeNull(); // RLS-denied (not 'active') → null, page 404s
    expect(deletedResult).toBeNull(); // R-L10 soft-deleted → null, page 404s
  });

  it("getStoreBySlug: active store resolves; suspended store → null (R-S07)", async () => {
    const { getStoreBySlug } = await import("@/features/discovery");

    const activeStore = await getStoreBySlug(activeStoreSlug, anon);
    const suspendedStore = await getStoreBySlug(suspendedStoreSlug, anon);
    const unknownStore = await getStoreBySlug(`t01-unknown-${RUN}`, anon);

    record(
      activeStore && !suspendedStore && !unknownStore ? "PASS" : "FAIL",
      "getStoreBySlug",
      `active:${!!activeStore} suspendedHidden:${!suspendedStore} unknownHidden:${!unknownStore}`,
    );
    expect(activeStore).not.toBeNull();
    expect(activeStore?.slug).toBe(activeStoreSlug);
    expect(suspendedStore).toBeNull();
    expect(unknownStore).toBeNull();
  });

  it("getCategoryTree: assembles the seeded parent/child pair", async () => {
    const { getCategoryTree } = await import("@/features/discovery");
    const tree = await getCategoryTree(anon);

    const topNode = tree.find((n) => n.id === topCategoryId);
    expect(topNode).toBeDefined();
    expect(topNode?.children.some((c) => c.id === childCategoryId)).toBe(true);

    record(
      "PASS",
      "getCategoryTree",
      "seeded top-level node present with the seeded child nested under it",
    );
  });

  // -------------------------------------------------------------------------
  // RLS-gap evidence (FINDING, not FAIL) — see queries/_shared.ts header.
  // -------------------------------------------------------------------------
  it("FINDING: listing_images / rating_aggregates / listing_tags resolve empty for anon despite being seeded", async () => {
    const { getActiveListings } = await import("@/features/discovery");
    const { getListingById } = await import("@/features/discovery");

    const page = await getActiveListings({ category: topCategoryId }, anon);
    const cardRow = page.items.find((i) => i.id === activeListingId);
    const detail = await getListingById(activeListingId, anon);

    const heroMissing = !cardRow?.heroImageUrl;
    const ratingMissing = !cardRow?.store?.rating;
    const tagsMissing = (detail?.tags.length ?? 0) === 0;
    const imagesMissingOnDetail = (detail?.images.length ?? 0) === 0;

    if (heroMissing && ratingMissing && tagsMissing && imagesMissingOnDetail) {
      record(
        "FINDING",
        "listing_images/listing_tags/rating_aggregates",
        "RLS-enabled-no-policy confirmed live: a hero image, a tag, and a rating " +
          "aggregate were seeded for this listing/store, but the anon client's " +
          "embedded read came back empty for all three — matches pg_policies " +
          "(zero rows for listing_images/listing_tags/rating_aggregates).",
      );
    } else {
      record(
        "PASS",
        "listing_images/listing_tags/rating_aggregates",
        "anon read returned seeded data — the RLS gap has been closed since this " +
          "test was written; update the _shared.ts header finding.",
      );
    }
    // Not asserted as a hard expectation either way — this test exists to
    // PROVE/DISPROVE the finding, not to gate the build on it.
  });

  it("FINDING: collection_listings / review_photos resolve empty for anon despite being seeded", async () => {
    const { getHomepageData, getStoreBySlug } = await import("@/features/discovery");

    const homepage = await getHomepageData(anon);
    const seededCollection = homepage.collections.data?.find((c) =>
      c.listings.some((l) => l.id === collectionListingId),
    );

    const store = await getStoreBySlug(activeStoreSlug, anon);
    const reviewWithPhotos = store?.reviews.find((r) => r.body?.includes(RUN));

    const collectionGapConfirmed = homepage.collections.status === "ok" && !seededCollection;
    const reviewPhotosGapConfirmed = !!reviewWithPhotos && reviewWithPhotos.photos.length === 0;

    record(
      collectionGapConfirmed ? "FINDING" : "PASS",
      "collection_listings",
      collectionGapConfirmed
        ? "the seeded live collection's listing did not surface via getHomepageData " +
          "(collection_listings has zero anon-readable rows) — collections strip " +
          "resolves to status:'ok' with the affected collection/listing absent, not an error."
        : "seeded collection listing surfaced — RLS gap closed since this test was written.",
    );
    record(
      reviewPhotosGapConfirmed ? "FINDING" : "PASS",
      "review_photos",
      reviewPhotosGapConfirmed
        ? "the seeded review photo did not surface via getStoreBySlug (review_photos " +
          "has zero anon-readable rows)."
        : "seeded review photo surfaced — RLS gap closed since this test was written.",
    );

    expect(homepage.collections.status).toBe("ok"); // never an error — degrades to empty
  });
});

/**
 * Storefront + wishlist/follow actions integration tests — Phase 03 / T06
 * (FR-PUB-5).
 *
 * Runs against STAGING. Seeds fixtures via the service-role client (bypasses
 * RLS), then exercises TWO layers:
 *
 *   1. The real Server Actions (`toggleWishlist` / `toggleFollow`) end-to-end —
 *      `@/lib/supabase/server`'s `createClient` is vi.mocked to return a
 *      per-test client (an authenticated buyer's session, or a session-less
 *      guest), so the action's own `auth.getUser()` gate, Zod validation,
 *      toggle logic and return shape are all driven exactly as they run in a
 *      Server Action — WITHOUT a Next request/cookies context.
 *
 *   2. The RLS boundary itself, driven directly through authenticated
 *      per-buyer anon clients (the same `signInWithPassword` pattern as
 *      rls.smoke / account.profile) — cross-user isolation, the non-owner
 *      SELECT negative, and the raw 23505 unique-race the action's guard maps
 *      to idempotent success. This is the empirical proof of REG-29's restored
 *      `store_follows` self-scope policies + the pre-existing `wishlist_own`.
 *
 * Plus the storefront 404 contract: `getStoreBySlug` resolves to `null` for an
 * unknown slug AND a suspended store (R-S07, no existence leak → the page
 * hard-404s both, both locales).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

/**
 * The action files import `createClient` from `@/lib/supabase/server` (which
 * needs `cookies()`); we swap it for a mutable holder so each test can inject
 * the exact RLS context (buyer A, buyer B, or a session-less guest).
 */
const mockHolder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockHolder.client),
}));

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
const PASSWORD = `T06-${RUN}-pw`;
const createdAuthIds: string[] = [];

function anonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function signedInClient(email: string) {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`[storefront.test] signIn ${email}: ${error.message}`);
  return client;
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 03 / T06 — storefront + wishlist/follow actions (staging)", () => {
  const service = createServiceClient();
  const svc = () => service.schema("betk");

  let sellerId = "";
  let suspSellerId = "";
  let buyerAId = "";
  let buyerBId = "";
  let activeStoreId = "";
  let suspendedStoreId = "";
  let categoryId = "";
  let listingId = "";
  const activeSlug = `t06-active-${RUN}`;
  const suspendedSlug = `t06-suspended-${RUN}`;

  let authedA: Awaited<ReturnType<typeof signedInClient>>;
  let authedB: Awaited<ReturnType<typeof signedInClient>>;
  let guest: ReturnType<typeof anonClient>;

  beforeAll(async () => {
    const ref = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run storefront tests against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    // ── seller (owns the active store) ──
    const { data: sellerAuth, error: sErr } = await service.auth.admin.createUser({
      email: `betk-t06-seller-${RUN}@betk.test`,
      password: PASSWORD,
      email_confirm: true,
    });
    if (sErr || !sellerAuth.user) throw new Error(`[storefront.test] seller: ${sErr?.message}`);
    sellerId = sellerAuth.user.id;
    createdAuthIds.push(sellerId);
    await svc().from("users").insert({ id: sellerId, phone_number: null, auth_provider: "google", role: "seller" } as never);
    await svc().from("seller_profiles").insert({ id: sellerId, status: "active", is_verified: true, level: "gold", avg_response_hours: 3 } as never);

    // ── second seller (owns the suspended store; stores.seller_id is UNIQUE and
    //    FKs to seller_profiles, so it needs its own seller identity) ──
    const { data: susSellerAuth, error: susSErr } = await service.auth.admin.createUser({
      email: `betk-t06-seller2-${RUN}@betk.test`,
      password: PASSWORD,
      email_confirm: true,
    });
    if (susSErr || !susSellerAuth.user) throw new Error(`[storefront.test] seller2: ${susSErr?.message}`);
    suspSellerId = susSellerAuth.user.id;
    createdAuthIds.push(suspSellerId);
    await svc().from("users").insert({ id: suspSellerId, phone_number: null, auth_provider: "google", role: "seller" } as never);
    await svc().from("seller_profiles").insert({ id: suspSellerId, status: "active" } as never);

    // ── buyers A + B ──
    for (const label of ["a", "b"] as const) {
      const { data, error } = await service.auth.admin.createUser({
        email: `betk-t06-buyer${label}-${RUN}@betk.test`,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error || !data.user) throw new Error(`[storefront.test] buyer${label}: ${error?.message}`);
      const uid = data.user.id;
      createdAuthIds.push(uid);
      await svc().from("users").insert({ id: uid, phone_number: null, auth_provider: "google", role: "buyer" } as never);
      if (label === "a") buyerAId = uid;
      else buyerBId = uid;
    }

    // ── category ──
    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .insert({ name_ar: `فئة متجر ${RUN}`, name_en: `Store Cat ${RUN}`, slug: `t06-cat-${RUN}`, is_active: true, sort_order: 999 } as never)
      .select("id")
      .single();
    if (catErr || !cat) throw new Error(`[storefront.test] category: ${catErr?.message}`);
    categoryId = (cat as { id: string }).id;

    // ── active store + suspended store ──
    const { data: store, error: storeErr } = await svc()
      .from("stores")
      .insert({
        seller_id: sellerId,
        name_ar: `متجر بيتك ${RUN}`,
        name_en: `BETK Store ${RUN}`,
        slug: activeSlug,
        category_primary: "general",
        governorate: "cairo",
        city: "Nasr City",
        status: "active",
        return_policy: `استرجاع خلال 14 يومًا ${RUN}`,
        payment_methods: { instapay_handle: "01000000000", cod_enabled: true } as never,
        delivery_options: { modes: ["delivery", "pickup"], min_delivery_days: 2, max_delivery_days: 5, delivery_fee_egp: 30 } as never,
      } as never)
      .select("id")
      .single();
    if (storeErr || !store) throw new Error(`[storefront.test] active store: ${storeErr?.message}`);
    activeStoreId = (store as { id: string }).id;

    const { data: susp, error: suspErr } = await svc()
      .from("stores")
      .insert({
        seller_id: suspSellerId,
        name_ar: `متجر موقوف ${RUN}`,
        slug: suspendedSlug,
        category_primary: "general",
        governorate: "cairo",
        status: "suspended",
      } as never)
      .select("id")
      .single();
    if (suspErr || !susp) throw new Error(`[storefront.test] suspended store: ${suspErr?.message}`);
    suspendedStoreId = (susp as { id: string }).id;

    // ── one active listing on the active store (wishlist target) ──
    const { data: listing, error: listErr } = await svc()
      .from("listings")
      .insert({
        store_id: activeStoreId,
        category_id: categoryId,
        type: "product",
        title_ar: `منتج المتجر ${RUN}`,
        price: 200,
        price_type: "fixed",
        stock_qty: 5,
        status: "active",
      } as never)
      .select("id")
      .single();
    if (listErr || !listing) throw new Error(`[storefront.test] listing: ${listErr?.message}`);
    listingId = (listing as { id: string }).id;

    authedA = await signedInClient(`betk-t06-buyera-${RUN}@betk.test`);
    authedB = await signedInClient(`betk-t06-buyerb-${RUN}@betk.test`);
    guest = anonClient();
  });

  afterAll(async () => {
    if (listingId) {
      await svc().from("wishlists").delete().eq("listing_id", listingId);
      await svc().from("listings").delete().eq("id", listingId);
    }
    if (activeStoreId) await svc().from("store_follows").delete().eq("store_id", activeStoreId);
    for (const sid of [activeStoreId, suspendedStoreId]) {
      if (sid) await svc().from("stores").delete().eq("id", sid);
    }
    if (categoryId) await svc().from("categories").delete().eq("id", categoryId);
    for (const sid of [sellerId, suspSellerId]) {
      if (sid) await svc().from("seller_profiles").delete().eq("id", sid);
    }
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  /* ── toggleWishlist (real action, buyer A) ─────────────────────────────── */

  it("toggleWishlist: on→off→on round-trip returns the new state each time", async () => {
    const { toggleWishlist } = await import("@/features/discovery/actions/toggleWishlist");
    mockHolder.client = authedA;

    expect(await toggleWishlist(listingId)).toEqual({ ok: true, active: true });
    expect(await toggleWishlist(listingId)).toEqual({ ok: true, active: false });
    expect(await toggleWishlist(listingId)).toEqual({ ok: true, active: true });

    // Leave it clean for later isolation assertions.
    expect(await toggleWishlist(listingId)).toEqual({ ok: true, active: false });
  });

  it("toggleWishlist: a session-less guest is rejected (→ client routes to login)", async () => {
    const { toggleWishlist } = await import("@/features/discovery/actions/toggleWishlist");
    mockHolder.client = guest;
    expect(await toggleWishlist(listingId)).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("toggleWishlist: a malformed (non-UUID) listing id is rejected by Zod before any DB call", async () => {
    const { toggleWishlist } = await import("@/features/discovery/actions/toggleWishlist");
    mockHolder.client = authedA;
    expect(await toggleWishlist("not-a-uuid")).toEqual({ ok: false, reason: "invalid" });
  });

  it("wishlist RLS: buyer B cannot see or delete buyer A's wishlist row (wishlist_own self-scope)", async () => {
    // A saves via the action.
    const { toggleWishlist } = await import("@/features/discovery/actions/toggleWishlist");
    mockHolder.client = authedA;
    expect(await toggleWishlist(listingId)).toEqual({ ok: true, active: true });

    // B cannot SELECT A's row.
    const bSees = await authedB
      .schema("betk")
      .from("wishlists")
      .select("id")
      .eq("buyer_id", buyerAId)
      .eq("listing_id", listingId);
    expect(bSees.error).toBeNull();
    expect(bSees.data ?? []).toHaveLength(0);

    // B's DELETE of A's row affects nothing — A's row survives (service confirms).
    await authedB.schema("betk").from("wishlists").delete().eq("buyer_id", buyerAId).eq("listing_id", listingId);
    const stillThere = await svc().from("wishlists").select("id").eq("buyer_id", buyerAId).eq("listing_id", listingId);
    expect(stillThere.data ?? []).toHaveLength(1);

    // cleanup A's row via the action.
    mockHolder.client = authedA;
    expect(await toggleWishlist(listingId)).toEqual({ ok: true, active: false });
  });

  it("wishlist RLS: a session-less guest INSERT is denied by RLS (boundary holds even without the app-layer auth check)", async () => {
    const { error } = await guest
      .schema("betk")
      .from("wishlists")
      .insert({ buyer_id: buyerAId, listing_id: listingId } as never);
    expect(error).not.toBeNull();
  });

  /* ── toggleFollow (real action, buyer A) ───────────────────────────────── */

  it("toggleFollow: on→off→on round-trip returns the new state each time", async () => {
    const { toggleFollow } = await import("@/features/discovery/actions/toggleFollow");
    mockHolder.client = authedA;

    expect(await toggleFollow(activeStoreId)).toEqual({ ok: true, active: true });
    expect(await toggleFollow(activeStoreId)).toEqual({ ok: true, active: false });
    expect(await toggleFollow(activeStoreId)).toEqual({ ok: true, active: true });
    expect(await toggleFollow(activeStoreId)).toEqual({ ok: true, active: false });
  });

  it("toggleFollow: a session-less guest is rejected (→ client routes to login)", async () => {
    const { toggleFollow } = await import("@/features/discovery/actions/toggleFollow");
    mockHolder.client = guest;
    expect(await toggleFollow(activeStoreId)).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("getStoreFollowState: reflects buyer A's real follow state under self-scope RLS", async () => {
    const { getStoreFollowState } = await import("@/features/discovery/queries/getStoreFollowState");
    const { toggleFollow } = await import("@/features/discovery/actions/toggleFollow");
    mockHolder.client = authedA;

    expect(await getStoreFollowState(activeStoreId, buyerAId, authedA)).toBe(false);
    expect(await toggleFollow(activeStoreId)).toEqual({ ok: true, active: true });
    expect(await getStoreFollowState(activeStoreId, buyerAId, authedA)).toBe(true);

    // Guest short-circuits to false with no query.
    expect(await getStoreFollowState(activeStoreId, null, authedA)).toBe(false);

    // cleanup.
    expect(await toggleFollow(activeStoreId)).toEqual({ ok: true, active: false });
  });

  it("follow RLS: buyer B cannot see buyer A's follow row (sf_select_self — proves self-scope, not just default-deny)", async () => {
    const { toggleFollow } = await import("@/features/discovery/actions/toggleFollow");
    mockHolder.client = authedA;
    expect(await toggleFollow(activeStoreId)).toEqual({ ok: true, active: true });

    // Non-owner SELECT negative: B sees zero of A's rows.
    const bSees = await authedB
      .schema("betk")
      .from("store_follows")
      .select("id")
      .eq("buyer_id", buyerAId)
      .eq("store_id", activeStoreId);
    expect(bSees.error).toBeNull();
    expect(bSees.data ?? []).toHaveLength(0);

    // B's DELETE of A's row affects nothing — A's follow survives.
    await authedB.schema("betk").from("store_follows").delete().eq("buyer_id", buyerAId).eq("store_id", activeStoreId);
    const stillThere = await svc().from("store_follows").select("id").eq("buyer_id", buyerAId).eq("store_id", activeStoreId);
    expect(stillThere.data ?? []).toHaveLength(1);

    // cleanup.
    mockHolder.client = authedA;
    expect(await toggleFollow(activeStoreId)).toEqual({ ok: true, active: false });
  });

  it("follow 23505: a raw double-insert raises the unique-violation the action's guard maps to idempotent success", async () => {
    const first = await authedA
      .schema("betk")
      .from("store_follows")
      .insert({ buyer_id: buyerAId, store_id: activeStoreId } as never);
    expect(first.error).toBeNull();

    const second = await authedA
      .schema("betk")
      .from("store_follows")
      .insert({ buyer_id: buyerAId, store_id: activeStoreId } as never);
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe("23505");

    // The action treats this same 23505 as "already followed → followed" (no
    // error surface). Verify the action returns cleanly with the row present:
    const { toggleFollow } = await import("@/features/discovery/actions/toggleFollow");
    mockHolder.client = authedA;
    // Row exists → read-first sees it → unfollow (clean success, no error).
    expect(await toggleFollow(activeStoreId)).toEqual({ ok: true, active: false });
  });

  it("follow RLS: a session-less guest INSERT is denied by RLS (sf_insert_self WITH CHECK)", async () => {
    const { error } = await guest
      .schema("betk")
      .from("store_follows")
      .insert({ buyer_id: buyerAId, store_id: activeStoreId } as never);
    expect(error).not.toBeNull();
  });

  /* ── storefront 404 contract ───────────────────────────────────────────── */

  it("getStoreBySlug: an active store resolves with its coalesced fields (sanity)", async () => {
    const { getStoreBySlug } = await import("@/features/discovery/queries/getStoreBySlug");
    const store = await getStoreBySlug(activeSlug, guest);
    expect(store).not.toBeNull();
    expect(store?.id).toBe(activeStoreId);
    expect(store?.returnPolicy).toContain(RUN);
  });

  it("getStoreBySlug: an unknown slug resolves to null (page hard-404s, no existence leak)", async () => {
    const { getStoreBySlug } = await import("@/features/discovery/queries/getStoreBySlug");
    const store = await getStoreBySlug(`t06-does-not-exist-${RUN}`, guest);
    expect(store).toBeNull();
  });

  it("getStoreBySlug: a SUSPENDED store resolves to null (R-S07 — same 404 as unknown, no leak)", async () => {
    const { getStoreBySlug } = await import("@/features/discovery/queries/getStoreBySlug");
    const store = await getStoreBySlug(suspendedSlug, guest);
    expect(store).toBeNull();
  });
});

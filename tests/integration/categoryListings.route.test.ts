/**
 * GET /api/category-listings integration tests — PERF-02.
 *
 * Runs against the STAGING Supabase project. Seeds fixtures via the
 * service-role client (bypasses RLS), then drives the ACTUAL route handler
 * (`GET`) — which itself queries through a plain ANON client via
 * `createAnonClient()` (no session, no service-role) — exactly the RLS context
 * the public category page's "load more" runs under.
 *
 * Asserts (per the PERF-02 STEP 4 addition):
 *   1. A valid request returns 200 + page-1-shaped JSON ({ items, nextCursor });
 *      the seeded ACTIVE listing is present.
 *   2. A garbage cursor → 400 (Zod refine), NOT 500 and NOT a silent page-1.
 *   3. A missing/invalid category → 400.
 *   4. draft / soft-deleted / suspended-store listings are EXCLUDED (the handler
 *      rides the same R-S07-safe `stores!inner` query as the page) — asserted,
 *      not assumed.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import { GET } from "@/app/api/category-listings/route";
import type { ListingPage } from "@/features/discovery";

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

/** Drive the handler with a query string; return {status, body}. */
async function callHandler(query: string): Promise<{ status: number; body: unknown }> {
  const res = await GET(new Request(`http://localhost/api/category-listings?${query}`));
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

const RUN = randomUUID().slice(0, 8);
const createdAuthIds: string[] = [];

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("PERF-02 — GET /api/category-listings (staging, anon handler)", () => {
  const service = createServiceClient();
  const svc = () => service.schema("betk");

  let topCategoryId = "";
  let activeSellerId = "";
  let suspendedSellerId = "";
  let activeStoreId = "";
  let suspendedStoreId = "";
  let activeListingId = "";
  let draftListingId = "";
  let deletedListingId = "";
  let suspendedStoreListingId = "";

  beforeAll(async () => {
    const ref = extractProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    // ---- two sellers (stores.seller_id is UNIQUE — one store per seller) ----
    for (const label of ["active", "suspended"] as const) {
      const { data: authUser, error: authErr } = await service.auth.admin.createUser({
        email: `betk-perf02-${label}-${RUN}@betk.test`,
        email_confirm: true,
      });
      if (authErr || !authUser.user) throw new Error(`createUser(${label}): ${authErr?.message}`);
      const id = authUser.user.id;
      createdAuthIds.push(id);
      if (label === "active") activeSellerId = id;
      else suspendedSellerId = id;

      const { error: uErr } = await svc()
        .from("users")
        .insert({ id, phone_number: null, auth_provider: "google", role: "seller" });
      if (uErr) throw new Error(`users(${label}): ${uErr.message}`);
      const { error: spErr } = await svc()
        .from("seller_profiles")
        .insert({ id, status: "active" });
      if (spErr) throw new Error(`seller_profiles(${label}): ${spErr.message}`);
    }

    // ---- category (top-level) ----
    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .insert({ name_ar: `فئة PERF02 ${RUN}`, slug: `perf02-top-${RUN}`, is_active: true, sort_order: 999 })
      .select("id")
      .single();
    if (catErr || !cat) throw new Error(`category: ${catErr?.message}`);
    topCategoryId = cat.id;

    // ---- stores: one active, one suspended ----
    const { data: activeStore, error: asErr } = await svc()
      .from("stores")
      .insert({
        seller_id: activeSellerId,
        name_ar: `متجر فعال ${RUN}`,
        slug: `perf02-active-${RUN}`,
        category_primary: "general",
        governorate: "Cairo",
        status: "active",
      })
      .select("id")
      .single();
    if (asErr || !activeStore) throw new Error(`active store: ${asErr?.message}`);
    activeStoreId = activeStore.id;

    const { data: suspendedStore, error: ssErr } = await svc()
      .from("stores")
      .insert({
        seller_id: suspendedSellerId,
        name_ar: `متجر معلق ${RUN}`,
        slug: `perf02-suspended-${RUN}`,
        category_primary: "general",
        governorate: "Cairo",
        status: "suspended",
      })
      .select("id")
      .single();
    if (ssErr || !suspendedStore) throw new Error(`suspended store: ${ssErr?.message}`);
    suspendedStoreId = suspendedStore.id;

    // ---- listings in the SAME category ----
    const base = {
      category_id: topCategoryId,
      type: "product" as const,
      price: 100,
      price_type: "fixed" as const,
      stock_qty: 5,
    };

    const seedListing = async (
      storeId: string,
      title: string,
      extra: Record<string, unknown>,
    ): Promise<string> => {
      const { data, error } = await svc()
        .from("listings")
        .insert({ ...base, store_id: storeId, title_ar: title, ...extra })
        .select("id")
        .single();
      if (error || !data) throw new Error(`listing '${title}': ${error?.message}`);
      return data.id;
    };

    activeListingId = await seedListing(activeStoreId, `فعال ${RUN}`, { status: "active" });
    draftListingId = await seedListing(activeStoreId, `مسودة ${RUN}`, { status: "draft" });
    deletedListingId = await seedListing(activeStoreId, `محذوف ${RUN}`, {
      status: "active",
      deleted_at: new Date().toISOString(),
    });
    suspendedStoreListingId = await seedListing(suspendedStoreId, `متجر معلق ${RUN}`, {
      status: "active",
    });
  });

  afterAll(async () => {
    for (const id of [activeListingId, draftListingId, deletedListingId, suspendedStoreListingId]) {
      if (id) await svc().from("listings").delete().eq("id", id);
    }
    if (activeStoreId) await svc().from("stores").delete().eq("id", activeStoreId);
    if (suspendedStoreId) await svc().from("stores").delete().eq("id", suspendedStoreId);
    if (topCategoryId) await svc().from("categories").delete().eq("id", topCategoryId);
    for (const id of [activeSellerId, suspendedSellerId]) {
      if (id) {
        await svc().from("seller_profiles").delete().eq("id", id);
        await svc().from("users").delete().eq("id", id);
      }
    }
    for (const id of createdAuthIds) {
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  it("valid request → 200 + page-1-shaped data; active listing present", async () => {
    const { status, body } = await callHandler(`category=${topCategoryId}&locale=ar`);
    expect(status).toBe(200);

    const page = body as ListingPage;
    expect(Array.isArray(page.items)).toBe(true);
    // nextCursor is either an opaque string or null — the shape T04 returns.
    expect(page.nextCursor === null || typeof page.nextCursor === "string").toBe(true);

    const ids = page.items.map((i) => i.id);
    expect(ids).toContain(activeListingId);
  });

  it("draft / soft-deleted / suspended-store listings are EXCLUDED (R-S07-safe)", async () => {
    const { status, body } = await callHandler(`category=${topCategoryId}&locale=ar`);
    expect(status).toBe(200);

    const ids = (body as ListingPage).items.map((i) => i.id);
    expect(ids).not.toContain(draftListingId);
    expect(ids).not.toContain(deletedListingId);
    expect(ids).not.toContain(suspendedStoreListingId);
  });

  it("garbage cursor → 400 (Zod refine), not 500 and not a silent page-1", async () => {
    const { status } = await callHandler(
      `category=${topCategoryId}&cursor=${encodeURIComponent("not-a-real-cursor!!!")}&locale=ar`,
    );
    expect(status).toBe(400);
  });

  it("missing category → 400; non-uuid category → 400", async () => {
    const missing = await callHandler(`locale=ar`);
    expect(missing.status).toBe(400);

    const nonUuid = await callHandler(`category=not-a-uuid&locale=ar`);
    expect(nonUuid.status).toBe(400);
  });
});

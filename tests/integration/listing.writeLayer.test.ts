/**
 * Phase 05 / T02 — listing write layer (Server Actions + queries) integration.
 *
 * Runs against the STAGING Supabase project. Mints real GoTrue users, seeds
 * betk.users + seller_profiles + stores, signs each in for an RLS-respecting
 * authenticated client, and cleans every fixture (users delete cascades
 * stores → listings → listing_images/tags). Zero residue.
 *
 * The Server Actions read their client via `@/lib/supabase/server` createClient,
 * mocked to return the current test's authenticated client (the T03/T06
 * precedent) so requireActiveUser() + every DB write run as the minted seller;
 * setUserRole-style service reads use the real service client.
 *
 * Proves (ADR-013 draft-first decomposition, no rpc):
 *   • createListing → status='draft' + search_vector maintained (trigger)
 *   • createListing service → stock stripped (R-L09); updateStock on a service rejected
 *   • addListingImage own-prefix OK; outside-prefix → forbidden_path; >5 → limit_reached
 *   • publish happy path → draft→active (R-L02/03/04 + R-S09 all met)
 *   • publish blocked per-requirement (no image; NO PAYMENT METHOD → R-S09 bites HERE)
 *   • tags >5 rejected (Zod)
 *   • soft delete → status='removed'+deleted_at; anon getListingById null (R-L10);
 *     still in owner reads; excluded from inventory
 *   • updateStock restock: sold_out + qty>0 → active (R-L07 app-layer flip)
 *   • cross-seller writes denied (update / softDelete / addImage → not_found)
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/lib/supabase/types";

// ── Mock the cookie client → the current test's authenticated client ─────────
const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { createListing } from "@/features/listings/actions/createListing";
import { updateListing } from "@/features/listings/actions/updateListing";
import { publishListing } from "@/features/listings/actions/publishListing";
import { softDeleteListing } from "@/features/listings/actions/softDeleteListing";
import { updateStock } from "@/features/listings/actions/updateStock";
import {
  addListingImage,
  removeListingImage,
} from "@/features/listings/actions/manageListingImages";
import { getOwnListings } from "@/features/listings/queries/getOwnListings";
import { getOwnListingById } from "@/features/listings/queries/getOwnListingById";
import { getOwnInventory } from "@/features/listings/queries/getOwnInventory";
import { getListingById } from "@/features/discovery/queries/getListingById";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type BetkClient = SupabaseClient<Database, "betk">;

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_P5T02_${RUN}!`;
const EMAIL_PREFIX = "betk-p5t02-";

const service = createServiceClient();
const svc = () => service.schema("betk");
const createdAuthIds: string[] = [];

function anonClient(): BetkClient {
  return createClient<Database, "betk">(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { db: { schema: "betk" }, auth: { persistSession: false, autoRefreshToken: false } },
  );
}

let phoneCounter = 0;
function makePhone(): string {
  const base = parseInt(RUN.slice(0, 6), 16) % 100000000;
  const n = (base + phoneCounter++) % 100000000;
  return `+2010${n.toString().padStart(8, "0")}`;
}

interface Seller {
  id: string;
  client: BetkClient;
  storeId: string;
}

async function createSeller(
  label: string,
  paymentMethods: Json,
): Promise<Seller> {
  const email = `${EMAIL_PREFIX}${label}-${RUN}@betk.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
  const id = data.user.id;
  createdAuthIds.push(id);

  const { error: uErr } = await svc()
    .from("users")
    .insert({ id, phone_number: makePhone(), auth_provider: "phone", role: "seller" });
  if (uErr) throw new Error(`users seed(${label}): ${uErr.message}`);

  const { error: spErr } = await svc().from("seller_profiles").insert({ id, status: "active" });
  if (spErr) throw new Error(`seller_profiles seed(${label}): ${spErr.message}`);

  const { data: store, error: stErr } = await svc()
    .from("stores")
    .insert({
      seller_id: id,
      name_ar: `متجر ${label} ${RUN}`,
      slug: `p5t02-${label}-${RUN}`,
      category_primary: "general",
      governorate: "Cairo",
      status: "active",
      payment_methods: paymentMethods,
    })
    .select("id")
    .single();
  if (stErr || !store) throw new Error(`stores seed(${label}): ${stErr?.message}`);

  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw new Error(`signIn(${label}): ${signInErr.message}`);

  return { id, client, storeId: store.id };
}

/** Service-role seed of a listing (bypasses the action, for setup). */
async function seedListing(
  storeId: string,
  overrides: Partial<Database["betk"]["Tables"]["listings"]["Insert"]> = {},
): Promise<string> {
  const { data, error } = await svc()
    .from("listings")
    .insert({
      store_id: storeId,
      category_id: categoryId,
      type: "product",
      title_ar: `منتج ${RUN}`,
      title_en: `Product ${RUN}`,
      price: 100,
      price_type: "fixed",
      status: "draft",
      ...overrides,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`seedListing: ${error?.message}`);
  return data.id;
}

const publicMediaUrl = (uid: string, name: string) =>
  `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${uid}/${name}`;

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

let categoryId: string;

describeOrSkip("Phase 05 / T02 — listing write layer (staging)", () => {
  let sellerA: Seller; // store WITH a payment method → publish can pass
  let sellerB: Seller; // store WITHOUT payment methods → R-S09 blocks publish

  beforeAll(async () => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(`[STAGING_GUARD] Refusing to run against '${ref}'.`);
    }

    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (catErr || !cat) throw new Error(`no active category: ${catErr?.message}`);
    categoryId = cat.id;

    sellerA = await createSeller("a", { cod_enabled: true });
    sellerB = await createSeller("b", {});
  });

  afterAll(async () => {
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  // ── createListing ─────────────────────────────────────────────────────────
  it("createListing → draft + search_vector maintained by the trigger", async () => {
    h.client = sellerA.client;
    const res = await createListing({
      type: "product",
      titleAr: `منتج جديد ${RUN}`,
      titleEn: `New product ${RUN}`,
      categoryId,
      priceType: "fixed",
      price: 250,
      stockQty: 8,
      tags: ["handmade", "cairo"],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const { data: row } = await svc()
      .from("listings")
      .select("status, store_id, title_en, stock_qty")
      .eq("id", res.listingId)
      .single();
    expect(row?.status).toBe("draft");
    expect(row?.store_id).toBe(sellerA.storeId);
    expect(row?.stock_qty).toBe(8);

    // search_vector populated by trg_listing_search_vector.
    const { data: sv } = await svc()
      .from("listings")
      .select("id")
      .eq("id", res.listingId)
      .not("search_vector", "is", null);
    expect(sv?.length ?? 0).toBe(1);

    const { data: tags } = await svc()
      .from("listing_tags")
      .select("tag")
      .eq("listing_id", res.listingId);
    expect((tags ?? []).map((t) => t.tag).sort()).toEqual(["cairo", "handmade"]);
  });

  it("createListing service → stock stripped (R-L09); updateStock on a service rejected", async () => {
    h.client = sellerA.client;
    const res = await createListing({
      type: "service",
      titleAr: `خدمة ${RUN}`,
      titleEn: `Service ${RUN}`,
      categoryId,
      priceType: "quote_only",
      // client tries to sneak stock in — server must strip it.
      stockQty: 99,
      isMadeToOrder: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const { data: row } = await svc()
      .from("listings")
      .select("stock_qty, is_made_to_order, price")
      .eq("id", res.listingId)
      .single();
    expect(row?.stock_qty).toBeNull();
    expect(row?.is_made_to_order).toBe(false);
    expect(row?.price).toBeNull(); // quote_only → price null

    const stockRes = await updateStock({ listingId: res.listingId, stockQty: 5 });
    expect(stockRes).toEqual({ ok: false, reason: "invalid" });
  });

  it("createListing rejects >5 tags (Zod)", async () => {
    h.client = sellerA.client;
    const res = await createListing({
      type: "product",
      titleAr: `t ${RUN}`,
      titleEn: `t ${RUN}`,
      categoryId,
      priceType: "fixed",
      price: 10,
      tags: ["a", "b", "c", "d", "e", "f"],
    });
    expect(res).toEqual({ ok: false, reason: "invalid" });
  });

  // ── images ──────────────────────────────────────────────────────────────
  it("addListingImage: own-prefix OK; outside-prefix forbidden; >5 limit_reached", async () => {
    h.client = sellerA.client;
    const listingId = await seedListing(sellerA.storeId);

    const good = await addListingImage({
      listingId,
      url: publicMediaUrl(sellerA.id, `hero-${RUN}.png`),
      sortOrder: 0,
    });
    expect(good.ok).toBe(true);

    const foreign = await addListingImage({
      listingId,
      url: publicMediaUrl(sellerB.id, `evil-${RUN}.png`),
      sortOrder: 1,
    });
    expect(foreign).toEqual({ ok: false, reason: "forbidden_path" });

    // Fill to 5 total (already 1), then the 6th is rejected.
    for (let i = 1; i < 5; i++) {
      const r = await addListingImage({
        listingId,
        url: publicMediaUrl(sellerA.id, `img-${i}-${RUN}.png`),
        sortOrder: i,
      });
      expect(r.ok).toBe(true);
    }
    const sixth = await addListingImage({
      listingId,
      url: publicMediaUrl(sellerA.id, `img-6-${RUN}.png`),
      sortOrder: 4,
    });
    expect(sixth).toEqual({ ok: false, reason: "limit_reached" });

    // removeListingImage deletes the ROW (storage object retained by design).
    const { data: first } = await svc()
      .from("listing_images")
      .select("id")
      .eq("listing_id", listingId)
      .order("sort_order")
      .limit(1)
      .single();
    const rm = await removeListingImage({ imageId: first!.id });
    expect(rm.ok).toBe(true);
    const { data: after } = await svc()
      .from("listing_images")
      .select("id")
      .eq("id", first!.id);
    expect(after?.length ?? 0).toBe(0);
  });

  // ── publish gate ──────────────────────────────────────────────────────────
  it("publish happy path → draft→active (R-L02/03/04 + R-S09 all met)", async () => {
    h.client = sellerA.client;
    const listingId = await seedListing(sellerA.storeId);
    await addListingImage({
      listingId,
      url: publicMediaUrl(sellerA.id, `p-${RUN}.png`),
      sortOrder: 0,
    });

    const res = await publishListing({ listingId });
    expect(res).toEqual({ ok: true });

    const { data: row } = await svc()
      .from("listings")
      .select("status")
      .eq("id", listingId)
      .single();
    expect(row?.status).toBe("active");
  });

  it("publish blocked: no image → unmet includes 'image'", async () => {
    h.client = sellerA.client;
    const listingId = await seedListing(sellerA.storeId); // no image
    const res = await publishListing({ listingId });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("unmet_requirements");
    if (res.reason !== "unmet_requirements") return;
    expect(res.unmet).toContain("image");
  });

  it("publish blocked: R-S09 bites HERE — store with NO payment method", async () => {
    h.client = sellerB.client; // store B has empty payment_methods
    const listingId = await seedListing(sellerB.storeId);
    await addListingImage({
      listingId,
      url: publicMediaUrl(sellerB.id, `b-${RUN}.png`),
      sortOrder: 0,
    });

    const res = await publishListing({ listingId });
    expect(res.ok).toBe(false);
    if (res.ok || res.reason !== "unmet_requirements") throw new Error("expected unmet");
    expect(res.unmet).toEqual(["payment_method"]);

    const { data: row } = await svc()
      .from("listings")
      .select("status")
      .eq("id", listingId)
      .single();
    expect(row?.status).toBe("draft"); // NOT published
  });

  // ── soft delete (R-L10) ─────────────────────────────────────────────────
  it("soft delete → removed+deleted_at; anon detail 404s; owner still reads", async () => {
    h.client = sellerA.client;
    // Seed an ACTIVE listing under A's active store + an image so anon can see it.
    const listingId = await seedListing(sellerA.storeId, { status: "active" });
    await svc()
      .from("listing_images")
      .insert({ listing_id: listingId, url: publicMediaUrl(sellerA.id, `d-${RUN}.png`), sort_order: 0 });

    // Before delete: anon detail resolves.
    const before = await getListingById(listingId, anonClient());
    expect(before?.id).toBe(listingId);

    const del = await softDeleteListing({ listingId });
    expect(del).toEqual({ ok: true });

    const { data: row } = await svc()
      .from("listings")
      .select("status, deleted_at")
      .eq("id", listingId)
      .single();
    expect(row?.status).toBe("removed");
    expect(row?.deleted_at).not.toBeNull();

    // Public 404 (R-L10): anon detail now null.
    const after = await getListingById(listingId, anonClient());
    expect(after).toBeNull();

    // Owner still sees it (edit-load + "removed" tab); inventory excludes it.
    const own = await getOwnListingById(listingId, sellerA.client);
    expect(own?.id).toBe(listingId);

    const removedTab = await getOwnListings({ status: "removed" }, sellerA.client);
    expect(removedTab.items.some((l) => l.id === listingId)).toBe(true);

    const inv = await getOwnInventory(sellerA.client);
    expect(inv.some((l) => l.id === listingId)).toBe(false);
  });

  // ── updateStock restock (R-L07) ────────────────────────────────────────
  it("updateStock restock: sold_out + qty>0 → active (app-layer flip)", async () => {
    h.client = sellerA.client;
    const listingId = await seedListing(sellerA.storeId, { status: "sold_out", stock_qty: 0 });

    const res = await updateStock({ listingId, stockQty: 12 });
    expect(res).toEqual({ ok: true, restocked: true });

    const { data: row } = await svc()
      .from("listings")
      .select("status, stock_qty")
      .eq("id", listingId)
      .single();
    expect(row?.status).toBe("active");
    expect(row?.stock_qty).toBe(12);
  });

  // ── cross-seller denial ───────────────────────────────────────────────────
  it("cross-seller writes denied (update / softDelete / addImage → not_found)", async () => {
    const listingId = await seedListing(sellerA.storeId, { status: "active" });

    h.client = sellerB.client; // acting as the OTHER seller
    const upd = await updateListing({
      listingId,
      type: "product",
      titleAr: `hacked ${RUN}`,
      titleEn: `hacked ${RUN}`,
      categoryId,
      priceType: "fixed",
      price: 1,
    });
    expect(upd).toEqual({ ok: false, reason: "not_found" });

    const del = await softDeleteListing({ listingId });
    expect(del).toEqual({ ok: false, reason: "not_found" });

    const img = await addListingImage({
      listingId,
      url: publicMediaUrl(sellerB.id, `x-${RUN}.png`),
      sortOrder: 0,
    });
    expect(img).toEqual({ ok: false, reason: "not_found" });

    // A's listing is untouched.
    const { data: row } = await svc()
      .from("listings")
      .select("status, title_ar, deleted_at")
      .eq("id", listingId)
      .single();
    expect(row?.status).toBe("active");
    expect(row?.deleted_at).toBeNull();
    expect(row?.title_ar).toBe(`منتج ${RUN}`);
  });
});

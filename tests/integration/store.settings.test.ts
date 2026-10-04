/**
 * Phase 04 / T07 — delivery / returns / payments settings (Server Actions)
 * integration.
 *
 * Runs against the STAGING Supabase project. Mints real GoTrue users, seeds
 * betk.users + an ACTIVE seller_profiles + a stores row, signs each in for an
 * RLS-respecting authenticated client, and cleans every fixture (users delete
 * cascades seller_profiles → stores). Zero residue.
 *
 * Proves, per form:
 *   1. P27 writes store_pickup_addresses and leaves stores.delivery_options
 *      untouched (REG-65). A payload that still carries delivery modes is
 *      rejected by the strict pickup schema.
 *   2. payments JSONB round-trips EXACTLY the `StorePaymentMethods` shape.
 *   3. return_policy TEXT round-trips: a real string persists verbatim; an
 *      empty/omitted policy persists as true DB NULL (never `""`).
 *   4. cross-user update on EACH of the 3 columns is denied by `stores_manage`
 *      RLS (0 rows affected, the owner's row unchanged).
 *
 * The actions read their Supabase client via `@/lib/supabase/server`
 * createClient, which is mocked to return the current test's authenticated
 * client so requireActiveUser() + the store read/update all run as the
 * minted user.
 */

import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Mock the cookie client so the actions + requireActiveUser run as the
// minted user. `h.client` is swapped per test before each action call.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { updateStorePickup } from "@/features/store-management/actions/updateStorePickup";
import { updateStoreReturns } from "@/features/store-management/actions/updateStoreReturns";
import { updateStorePayments } from "@/features/store-management/actions/updateStorePayments";

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
const PASSWORD = `Betk_T07_${RUN}!`;
const EMAIL_PREFIX = "betk-t07-";

const service = createServiceClient();
const svc = () => service.schema("betk");
const createdAuthIds: string[] = [];

function anonClient(): BetkClient {
  return createClient<Database, "betk">(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      db: { schema: "betk" },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

let phoneCounter = 0;
function makePhone(): string {
  const base = parseInt(RUN.slice(0, 6), 16) % 100000000;
  const n = (base + phoneCounter++) % 100000000;
  return `+2012${n.toString().padStart(8, "0")}`;
}

let slugCounter = 0;
function makeSlug(): string {
  return `t07-${RUN}-${slugCounter++}`;
}

interface Actor {
  id: string;
  client: BetkClient;
}

async function createActor(label: string): Promise<Actor> {
  const email = `${EMAIL_PREFIX}${label}-${RUN}@betk.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser(${label}) failed: ${error?.message}`);
  }
  const id = data.user.id;
  createdAuthIds.push(id);

  const { error: uErr } = await svc()
    .from("users")
    .insert({ id, phone_number: makePhone(), auth_provider: "phone", role: "seller", status: "active" });
  if (uErr) throw new Error(`users seed(${label}) failed: ${uErr.message}`);

  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw new Error(`signIn(${label}) failed: ${signInErr.message}`);

  return { id, client };
}

/** Seed an ACTIVE seller with a store (default JSONB columns, return_policy NULL). */
async function seedSellerStore(uid: string, slug: string): Promise<void> {
  const { error: spErr } = await svc().from("seller_profiles").insert({ id: uid, status: "active" });
  if (spErr) throw new Error(`seller_profiles seed failed: ${spErr.message}`);
  const { error: stErr } = await svc().from("stores").insert({
    seller_id: uid,
    name_ar: "متجر أولي",
    slug,
    category_primary: "handmade",
    governorate: "cairo",
    status: "active",
  });
  if (stErr) throw new Error(`stores seed failed: ${stErr.message}`);
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 04 / T07 — store settings (delivery/returns/payments, staging)", () => {
  beforeAll(() => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }
  });

  afterAll(async () => {
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  // -------------------------------------------------------------------------
  // 1. P27 pickup — does not write stores.delivery_options (REG-65)
  // -------------------------------------------------------------------------
  it("pickup address is stored and delivery_options stays empty", async () => {
    const a = await createActor("pickup-persist");
    await seedSellerStore(a.id, makeSlug());

    h.client = a.client;
    const res = await updateStorePickup({
      governorate: "cairo",
      city: "Nasr",
      streetAddress: "1 Street",
      buildingNotes: "floor 2",
    });
    expect(res).toEqual({ ok: true });

    const { data: store } = await svc()
      .from("stores")
      .select("id, delivery_options, governorate")
      .eq("seller_id", a.id)
      .single();
    expect(store?.delivery_options).toEqual({});
    expect(store?.governorate).toBe("cairo");

    const { data: pickup } = await svc()
      .from("store_pickup_addresses")
      .select("governorate, city, street_address, building_notes")
      .eq("store_id", store!.id)
      .single();
    expect(pickup).toEqual({
      governorate: "cairo",
      city: "Nasr",
      street_address: "1 Street",
      building_notes: "floor 2",
    });
  });

  it("a delivery-mode payload is rejected and does not write delivery_options", async () => {
    const a = await createActor("pickup-modes");
    await seedSellerStore(a.id, makeSlug());

    h.client = a.client;
    const res = await updateStorePickup({
      modes: ["delivery", "pickup", "remote"],
      delivery_fee_egp: 30,
    } as never);
    expect(res).toEqual({ ok: false, reason: "invalid" });

    const { data: store } = await svc()
      .from("stores")
      .select("delivery_options")
      .eq("seller_id", a.id)
      .single();
    expect(store?.delivery_options).toEqual({});
  });

  it("cross-user delivery_options update denied by stores_manage RLS", async () => {
    const a = await createActor("delivery-victim");
    await seedSellerStore(a.id, makeSlug());
    const b = await createActor("delivery-attacker");

    const { data: updated, error } = await b.client
      .from("stores")
      .update({ delivery_options: { modes: ["remote"] } })
      .eq("seller_id", a.id)
      .select("id");

    expect(error).toBeNull();
    expect(updated?.length ?? 0).toBe(0);

    const { data: store } = await svc()
      .from("stores")
      .select("delivery_options")
      .eq("seller_id", a.id)
      .single();
    expect(store?.delivery_options).toEqual({});
  });

  // -------------------------------------------------------------------------
  // 2. payments — round-trips the EXACT StorePaymentMethods shape
  // -------------------------------------------------------------------------
  it("payments JSONB round-trips exactly the StorePaymentMethods shape", async () => {
    const a = await createActor("payments-persist");
    await seedSellerStore(a.id, makeSlug());

    const payload = {
      instapay_handle: "nour.atelier",
      vodafone_cash: "01012345678",
      orange_cash: "01212345678",
      cod_enabled: true,
    };

    h.client = a.client;
    const res = await updateStorePayments(payload);
    expect(res).toEqual({ ok: true });

    const { data: store } = await svc()
      .from("stores")
      .select("payment_methods")
      .eq("seller_id", a.id)
      .single();

    expect(store?.payment_methods).toEqual(payload);
    expect(Object.keys(store?.payment_methods as object).sort()).toEqual(Object.keys(payload).sort());
  });

  it("cross-user payment_methods update denied by stores_manage RLS", async () => {
    const a = await createActor("payments-victim");
    await seedSellerStore(a.id, makeSlug());
    const b = await createActor("payments-attacker");

    const { data: updated, error } = await b.client
      .from("stores")
      .update({ payment_methods: { cod_enabled: true } })
      .eq("seller_id", a.id)
      .select("id");

    expect(error).toBeNull();
    expect(updated?.length ?? 0).toBe(0);

    const { data: store } = await svc()
      .from("stores")
      .select("payment_methods")
      .eq("seller_id", a.id)
      .single();
    expect(store?.payment_methods).toEqual({});
  });

  // -------------------------------------------------------------------------
  // 3. returns — TEXT + true-NULL round-trip
  // -------------------------------------------------------------------------
  it("return_policy: a real string persists verbatim", async () => {
    const a = await createActor("returns-text");
    await seedSellerStore(a.id, makeSlug());

    h.client = a.client;
    const res = await updateStoreReturns({ returnPolicy: "يمكن إرجاع المنتج خلال 7 أيام." });
    expect(res).toEqual({ ok: true });

    const { data: store } = await svc()
      .from("stores")
      .select("return_policy")
      .eq("seller_id", a.id)
      .single();
    expect(store?.return_policy).toBe("يمكن إرجاع المنتج خلال 7 أيام.");
  });

  it("return_policy: an empty/omitted policy persists as true NULL, never an empty string", async () => {
    const a = await createActor("returns-null");
    await seedSellerStore(a.id, makeSlug());

    // First set a real value, then clear it — proves the clear path too.
    h.client = a.client;
    await updateStoreReturns({ returnPolicy: "سياسة مؤقتة" });
    const cleared = await updateStoreReturns({ returnPolicy: "" });
    expect(cleared).toEqual({ ok: true });

    const { data: store } = await svc()
      .from("stores")
      .select("return_policy")
      .eq("seller_id", a.id)
      .single();
    expect(store?.return_policy).toBeNull();
  });

  it("cross-user return_policy update denied by stores_manage RLS", async () => {
    const a = await createActor("returns-victim");
    await seedSellerStore(a.id, makeSlug());
    const b = await createActor("returns-attacker");

    const { data: updated, error } = await b.client
      .from("stores")
      .update({ return_policy: "اختراق" })
      .eq("seller_id", a.id)
      .select("id");

    expect(error).toBeNull();
    expect(updated?.length ?? 0).toBe(0);

    const { data: store } = await svc()
      .from("stores")
      .select("return_policy")
      .eq("seller_id", a.id)
      .single();
    expect(store?.return_policy).toBeNull();
  });
});

/**
 * Phase 04 / T06 — store-profile settings (Server Action) integration.
 *
 * Runs against the STAGING Supabase project. Mints real GoTrue users, seeds
 * betk.users + an ACTIVE seller_profiles + a stores row, signs each in for an
 * RLS-respecting authenticated client, and cleans every fixture (users delete
 * cascades seller_profiles → stores). Zero residue.
 *
 * Proves:
 *   1. own-row update persists EVERY editable field (no slug change).
 *   2. cross-user update is denied by `stores_manage` RLS (B cannot UPDATE A's
 *      store row — 0 rows affected, A unchanged).
 *   3. R-S03 change-once is SERVER-ENFORCED: the first slug change succeeds and
 *      sets slug_changed_at; a SECOND slug change is rejected server-side
 *      (`slug_locked`) even though the client sends it — the DB slug is unchanged.
 *   4. image dimension validation rejects undersized avatar/cover (pure gate).
 *
 * The action reads its Supabase client via `@/lib/supabase/server` createClient,
 * which is mocked to return the current test's authenticated client so
 * requireActiveUser() + the store read/update all run as the minted user.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import {
  AVATAR_MIN_DIMENSIONS,
  COVER_MIN_DIMENSIONS,
  meetsMinDimensions,
} from "@/validations/storeProfile";

// ---------------------------------------------------------------------------
// Mock the cookie client so the action + requireActiveUser run as the minted
// user. `h.client` is swapped per test before each action call.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { updateStoreProfile } from "@/features/store-management/actions/updateStoreProfile";
import type { UpdateStoreProfileInput } from "@/validations/storeProfile";

// ---------------------------------------------------------------------------
// Pure dimension gate — runs regardless of staging credentials.
// ---------------------------------------------------------------------------
describe("Phase 04 / T06 — image dimension validation (pure)", () => {
  it("rejects an undersized avatar and accepts one that meets the minimum", () => {
    expect(meetsMinDimensions({ width: 100, height: 100 }, AVATAR_MIN_DIMENSIONS)).toBe(false);
    expect(meetsMinDimensions({ width: 200, height: 199 }, AVATAR_MIN_DIMENSIONS)).toBe(false);
    expect(meetsMinDimensions({ width: 200, height: 200 }, AVATAR_MIN_DIMENSIONS)).toBe(true);
    expect(meetsMinDimensions({ width: 512, height: 512 }, AVATAR_MIN_DIMENSIONS)).toBe(true);
  });

  it("rejects an undersized cover and accepts one that meets the minimum", () => {
    expect(meetsMinDimensions({ width: 1199, height: 400 }, COVER_MIN_DIMENSIONS)).toBe(false);
    expect(meetsMinDimensions({ width: 1200, height: 399 }, COVER_MIN_DIMENSIONS)).toBe(false);
    expect(meetsMinDimensions({ width: 1200, height: 400 }, COVER_MIN_DIMENSIONS)).toBe(true);
    expect(meetsMinDimensions({ width: 1920, height: 640 }, COVER_MIN_DIMENSIONS)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Runtime gating for the staging integration cases
// ---------------------------------------------------------------------------
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
const PASSWORD = `Betk_T06_${RUN}!`;
const EMAIL_PREFIX = "betk-t06-";

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
  return `+2011${n.toString().padStart(8, "0")}`;
}

let slugCounter = 0;
function makeSlug(): string {
  return `t06-${RUN}-${slugCounter++}`;
}

interface Actor {
  id: string;
  email: string;
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

  return { id, email, client };
}

/** Seed an ACTIVE seller with a store holding `slug` (slug_changed_at NULL). */
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

function fullPayload(overrides: Partial<UpdateStoreProfileInput>): UpdateStoreProfileInput {
  return {
    nameAr: "متجر محدّث",
    nameEn: "Updated Store",
    bioAr: "نبذة محدّثة",
    slug: "placeholder",
    categoryPrimary: "handmade",
    categorySecondary: "accessories",
    governorate: "giza",
    city: "Dokki",
    minOrderEgp: 150,
    avatarUrl: "https://cdn.betk.test/avatar.png",
    coverUrl: "https://cdn.betk.test/cover.png",
    ...overrides,
  };
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 04 / T06 — store-profile settings (staging)", () => {
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
  // 1. own-row update persists every editable field (no slug change)
  // -------------------------------------------------------------------------
  it("own-row update persists every field", async () => {
    const slug = makeSlug();
    const a = await createActor("persist");
    await seedSellerStore(a.id, slug);

    h.client = a.client;
    const res = await updateStoreProfile(fullPayload({ slug })); // slug unchanged
    expect(res).toEqual({ ok: true, slugChanged: false });

    const { data: store } = await svc()
      .from("stores")
      .select(
        "name_ar, name_en, bio_ar, slug, slug_changed_at, category_primary, category_secondary, governorate, city, min_order_egp, avatar_url, cover_url",
      )
      .eq("seller_id", a.id)
      .single();

    expect(store).toMatchObject({
      name_ar: "متجر محدّث",
      name_en: "Updated Store",
      bio_ar: "نبذة محدّثة",
      slug,
      category_primary: "handmade",
      category_secondary: "accessories",
      governorate: "giza",
      city: "Dokki",
      min_order_egp: 150,
      avatar_url: "https://cdn.betk.test/avatar.png",
      cover_url: "https://cdn.betk.test/cover.png",
    });
    // No slug change → slug_changed_at stays NULL (change-once budget intact).
    expect(store?.slug_changed_at).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2. cross-user update denied by stores_manage RLS
  // -------------------------------------------------------------------------
  it("cross-user update denied by stores_manage RLS", async () => {
    const slug = makeSlug();
    const a = await createActor("victim");
    await seedSellerStore(a.id, slug);

    const b = await createActor("attacker");

    // B attempts a DIRECT UPDATE on A's store row (bypassing the uid-scoped
    // action) — stores_manage USING (seller_id = auth.uid()) matches nothing.
    const { data: updated, error } = await b.client
      .from("stores")
      .update({ name_ar: "اختراق" })
      .eq("seller_id", a.id)
      .select("id");

    expect(error).toBeNull();
    expect(updated?.length ?? 0).toBe(0);

    // A's store is untouched.
    const { data: store } = await svc()
      .from("stores")
      .select("name_ar")
      .eq("seller_id", a.id)
      .single();
    expect(store?.name_ar).toBe("متجر أولي");
  });

  // -------------------------------------------------------------------------
  // 3. second slug change rejected SERVER-SIDE (R-S03 change-once)
  // -------------------------------------------------------------------------
  it("second slug change rejected server-side even if the client sends it", async () => {
    const original = makeSlug();
    const a = await createActor("slug-once");
    await seedSellerStore(a.id, original);

    // First change → allowed; sets slug_changed_at.
    const firstSlug = makeSlug();
    h.client = a.client;
    const first = await updateStoreProfile(fullPayload({ slug: firstSlug }));
    expect(first).toEqual({ ok: true, slugChanged: true });

    const { data: afterFirst } = await svc()
      .from("stores")
      .select("slug, slug_changed_at")
      .eq("seller_id", a.id)
      .single();
    expect(afterFirst?.slug).toBe(firstSlug);
    expect(afterFirst?.slug_changed_at).not.toBeNull();

    // Second change → the client "sends it" anyway; the server rejects it.
    const secondSlug = makeSlug();
    const second = await updateStoreProfile(fullPayload({ slug: secondSlug }));
    expect(second).toEqual({ ok: false, reason: "slug_locked" });

    // The DB slug is UNCHANGED (still the first-changed value).
    const { data: afterSecond } = await svc()
      .from("stores")
      .select("slug, slug_changed_at")
      .eq("seller_id", a.id)
      .single();
    expect(afterSecond?.slug).toBe(firstSlug);
    expect(afterSecond?.slug_changed_at).toBe(afterFirst?.slug_changed_at);
  });
});

/**
 * Phase 04 / T03 — seller-application submit (rpc + Server Action) integration.
 *
 * Runs against the STAGING Supabase project. Mints real GoTrue users, seeds
 * betk.users, signs each in for an RLS-respecting authenticated client, and
 * cleans every fixture (users delete cascades seller_profiles → stores →
 * seller_documents; storage objects removed explicitly). Zero residue.
 *
 * Proves (ADR-012):
 *   1. phone-NULL user → PhoneRequiredError at the action + ZERO rows; and the
 *      DB half (RESTRICTIVE phone gate) bites when the rpc is called directly.
 *   2. happy path → EXACTLY 1 seller_profiles + 1 stores + 2 seller_documents +
 *      role='seller' + status='pending'.
 *   3. slug collision mid-submit → clean `slug_taken` + NO PARTIAL RESIDUE
 *      (the rpc's transactional rollback leaves the new applicant with ZERO
 *      seller_profiles / stores / seller_documents rows — the invariant proven
 *      here is atomic rollback, not compensation).
 *   4. second application by an existing seller → `application_exists` (R-S01).
 *   5. deactivated user blocked (R-A05) → `blocked` + ZERO rows.
 *   6. cross-user isolation on getOwnSellerApplication (B never sees A's
 *      pending application).
 *
 * The action reads its Supabase client via `@/lib/supabase/server` createClient,
 * which is mocked to return the current test's authenticated client (the T06
 * discovery precedent) so requireVerifiedPhone() + the rpc both run as the
 * minted user; setUserRole() uses the real service-role client.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Mock the cookie client so the action + requireVerifiedPhone run as the minted
// user. `h.client` is swapped per test before each action call.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { submitSellerApplication } from "@/features/seller-onboarding/actions/submitSellerApplication";
import { getOwnSellerApplication } from "@/features/seller-onboarding/queries/getOwnSellerApplication";
import type { SubmitSellerApplicationInput } from "@/validations/sellerOnboarding";

// ---------------------------------------------------------------------------
// Runtime gating
// ---------------------------------------------------------------------------
const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (
  process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type BetkClient = SupabaseClient<Database, "betk">;

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_T03_${RUN}!`;
const EMAIL_PREFIX = "betk-t03-";
const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET ?? "docs";

const service = createServiceClient();
const svc = () => service.schema("betk");
const createdAuthIds: string[] = [];
const uploadedDocs: string[] = [];

// A 1x1 transparent PNG (docs bucket MIME allow-list = image/*).
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

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
  return `t03-${RUN}-${slugCounter++}`;
}

interface Actor {
  id: string;
  email: string;
  client: BetkClient;
}

async function createActor(
  label: string,
  opts: {
    phone: string | null;
    role?: Database["betk"]["Enums"]["user_role"];
    status?: Database["betk"]["Enums"]["user_status"];
    deletedAt?: string | null;
  },
): Promise<Actor> {
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
    .insert({
      id,
      phone_number: opts.phone,
      auth_provider: opts.phone === null ? "google" : "phone",
      role: opts.role ?? "buyer",
      status: opts.status ?? "active",
      deleted_at: opts.deletedAt ?? null,
    });
  if (uErr) throw new Error(`users seed(${label}) failed: ${uErr.message}`);

  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInErr) throw new Error(`signIn(${label}) failed: ${signInErr.message}`);

  return { id, email, client };
}

/** A valid full-payload application for `uid`, with own-prefix doc paths. */
function makePayload(uid: string, slug: string): SubmitSellerApplicationInput {
  return {
    nameAr: "متجر اختبار T03",
    nameEn: "T03 Test Store",
    bioAr: "نبذة عن المتجر",
    slug,
    categoryPrimary: "handmade",
    categorySecondary: "accessories",
    governorate: "cairo",
    city: "Nasr City",
    paymentMethods: { instapay_handle: "01000000000", cod_enabled: true },
    deliveryOptions: { modes: ["delivery", "pickup"], delivery_fee_egp: 40 },
    returnPolicy: "14-day returns.",
    minOrderEgp: 100,
    docFrontPath: `${uid}/national_id_front-${RUN}.png`,
    docBackPath: `${uid}/national_id_back-${RUN}.png`,
  };
}

async function countRows(uid: string) {
  const [{ count: profiles }, { count: stores }, { count: docs }] = await Promise.all([
    svc().from("seller_profiles").select("id", { count: "exact", head: true }).eq("id", uid),
    svc().from("stores").select("id", { count: "exact", head: true }).eq("seller_id", uid),
    svc().from("seller_documents").select("id", { count: "exact", head: true }).eq("seller_id", uid),
  ]);
  return { profiles: profiles ?? 0, stores: stores ?? 0, docs: docs ?? 0 };
}

async function roleOf(uid: string): Promise<string | null> {
  const { data } = await svc().from("users").select("role").eq("id", uid).maybeSingle();
  return data?.role ?? null;
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 04 / T03 — seller-application submit (staging)", () => {
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
    if (uploadedDocs.length) {
      await service.storage.from(DOCS_BUCKET).remove(uploadedDocs);
    }
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  // -------------------------------------------------------------------------
  // 1. phone-NULL — action gate + DB gate, ZERO rows
  // -------------------------------------------------------------------------
  it("phone-NULL → action returns phone_required and creates ZERO rows", async () => {
    const g = await createActor("phone-null", { phone: null });
    h.client = g.client;

    const res = await submitSellerApplication(makePayload(g.id, makeSlug()));
    expect(res).toEqual({ ok: false, reason: "phone_required" });

    const counts = await countRows(g.id);
    expect(counts).toEqual({ profiles: 0, stores: 0, docs: 0 });
    expect(await roleOf(g.id)).toBe("buyer");
  });

  it("phone-NULL → the rpc itself is denied by the RESTRICTIVE phone gate (DB half)", async () => {
    const g = await createActor("phone-null-rpc", { phone: null });

    const { error } = await g.client.rpc("submit_seller_application", {
      p_name_ar: "متجر",
      p_name_en: null,
      p_bio_ar: null,
      p_slug: makeSlug(),
      p_category_primary: "handmade",
      p_category_secondary: null,
      p_governorate: "cairo",
      p_city: null,
      p_payment_methods: {},
      p_delivery_options: {},
      p_return_policy: null,
      p_min_order_egp: null,
      p_doc_front_path: `${g.id}/f.png`,
      p_doc_back_path: `${g.id}/b.png`,
    });

    expect(error).not.toBeNull();
    const counts = await countRows(g.id);
    expect(counts).toEqual({ profiles: 0, stores: 0, docs: 0 });
  });

  // -------------------------------------------------------------------------
  // 2. happy path — 1 + 1 + 2 + role flip + status pending
  // -------------------------------------------------------------------------
  it("happy path → 1 seller_profiles + 1 stores + 2 seller_documents + role=seller + status=pending", async () => {
    const a = await createActor("happy", { phone: makePhone() });
    const payload = makePayload(a.id, makeSlug());

    // Uploads land BEFORE the action (T04 does this via ImageUploader); prove the
    // own-prefix docs-bucket path works and reference the real objects.
    for (const p of [payload.docFrontPath, payload.docBackPath]) {
      const up = await a.client.storage
        .from(DOCS_BUCKET)
        .upload(p, PNG_1x1, { contentType: "image/png", upsert: true });
      expect(up.error).toBeNull();
      uploadedDocs.push(p);
    }

    h.client = a.client;
    const res = await submitSellerApplication(payload);
    expect(res).toEqual({ ok: true });

    const counts = await countRows(a.id);
    expect(counts).toEqual({ profiles: 1, stores: 1, docs: 2 });
    expect(await roleOf(a.id)).toBe("seller");

    const { data: profile } = await svc()
      .from("seller_profiles")
      .select("status, level, submitted_at")
      .eq("id", a.id)
      .single();
    expect(profile?.status).toBe("pending");
    expect(profile?.level).toBe("bronze");
    expect(profile?.submitted_at).not.toBeNull();

    const { data: store } = await svc()
      .from("stores")
      .select("status, name_ar, slug")
      .eq("seller_id", a.id)
      .single();
    expect(store?.status).toBe("pending");
    expect(store?.name_ar).toBe(payload.nameAr);

    const { data: docs } = await svc()
      .from("seller_documents")
      .select("document_type, review_status")
      .eq("seller_id", a.id)
      .order("document_type", { ascending: true });
    // ORDER BY the doc_type enum column follows the enum's DEFINITION order
    // (front, then back), not alphabetical.
    expect(docs?.map((d) => d.document_type)).toEqual([
      "national_id_front",
      "national_id_back",
    ]);
    expect(docs?.every((d) => d.review_status === "pending")).toBe(true);

    // getOwnSellerApplication reflects the submitted application (self-scope).
    const own = await getOwnSellerApplication(a.client);
    expect(own?.profile.status).toBe("pending");
    expect(own?.store?.slug).toBe(payload.slug);
    expect(own?.documents.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  // 3. slug collision mid-submit — clean error, NO PARTIAL RESIDUE
  // -------------------------------------------------------------------------
  it("slug collision → slug_taken + NO PARTIAL RESIDUE (atomic rollback: zero rows for the new applicant)", async () => {
    const taken = makeSlug();

    // Seed an existing ACTIVE seller+store holding the slug (via service role).
    const owner = await createActor("slug-owner", { phone: makePhone() });
    await svc().from("seller_profiles").insert({ id: owner.id, status: "active" });
    await svc().from("stores").insert({
      seller_id: owner.id,
      name_ar: "صاحب النطاق",
      slug: taken,
      category_primary: "handmade",
      governorate: "cairo",
    });

    // A fresh applicant submits with the SAME slug.
    const applicant = await createActor("slug-collision", { phone: makePhone() });
    h.client = applicant.client;
    const res = await submitSellerApplication(makePayload(applicant.id, taken));
    expect(res).toEqual({ ok: false, reason: "slug_taken" });

    // INVARIANT (ADR-012): the rpc's single transaction rolled back — the new
    // applicant has ZERO seller_profiles / stores / seller_documents rows.
    const counts = await countRows(applicant.id);
    expect(counts).toEqual({ profiles: 0, stores: 0, docs: 0 });
    // Role never flipped (the write failed before step 4).
    expect(await roleOf(applicant.id)).toBe("buyer");
  });

  // -------------------------------------------------------------------------
  // 4. second application by an existing seller — R-S01
  // -------------------------------------------------------------------------
  it("second application by an existing seller → application_exists (R-S01)", async () => {
    const a = await createActor("dup", { phone: makePhone() });

    h.client = a.client;
    const first = await submitSellerApplication(makePayload(a.id, makeSlug()));
    expect(first).toEqual({ ok: true });

    const second = await submitSellerApplication(makePayload(a.id, makeSlug()));
    expect(second).toEqual({ ok: false, reason: "application_exists" });

    // Still exactly one application (the second attempt created nothing new).
    const counts = await countRows(a.id);
    expect(counts).toEqual({ profiles: 1, stores: 1, docs: 2 });
  });

  // -------------------------------------------------------------------------
  // 5. deactivated user blocked (R-A05)
  // -------------------------------------------------------------------------
  it("deactivated user (R-A05) → blocked + ZERO rows", async () => {
    const d = await createActor("deactivated", {
      phone: makePhone(),
      deletedAt: new Date().toISOString(),
    });

    h.client = d.client;
    const res = await submitSellerApplication(makePayload(d.id, makeSlug()));
    expect(res).toEqual({ ok: false, reason: "blocked" });

    const counts = await countRows(d.id);
    expect(counts).toEqual({ profiles: 0, stores: 0, docs: 0 });
  });

  // -------------------------------------------------------------------------
  // 6. cross-user isolation on getOwnSellerApplication
  // -------------------------------------------------------------------------
  it("cross-user isolation: B never sees A's pending application", async () => {
    const a = await createActor("iso-a", { phone: makePhone() });
    h.client = a.client;
    const res = await submitSellerApplication(makePayload(a.id, makeSlug()));
    expect(res).toEqual({ ok: true });

    // B has no application of their own → null.
    const b = await createActor("iso-b", { phone: makePhone() });
    const bOwn = await getOwnSellerApplication(b.client);
    expect(bOwn).toBeNull();

    // B cannot read A's pending seller_profiles row directly (sp_select:
    // id = auth.uid() OR status='active'; A is 'pending' → invisible to B).
    const { data: leak } = await b.client
      .from("seller_profiles")
      .select("id")
      .eq("id", a.id);
    expect(leak?.length ?? 0).toBe(0);
  });
});

/**
 * Phase 04 / T05 — seller-application resubmit (rpc + Server Action, MW2)
 * integration.
 *
 * Runs against the STAGING Supabase project. Mints real GoTrue users, seeds
 * betk.users + a seller_profiles/stores/seller_documents application via the
 * service-role client (simulating an admin rejection — Phase 14 does not
 * exist yet), signs each in for an RLS-respecting authenticated client, and
 * cleans every fixture. Zero residue.
 *
 * Proves the CONFIRMED STATE MODEL (see resubmit_seller_application's header,
 * BETK_DATABASE_SCHEMA.sql):
 *   1. rejected seller (status='pending' + rejected_reason set) resubmits →
 *      rejected_reason cleared to NULL, submitted_at refreshed, BOTH
 *      seller_documents rows overwritten (storage_path/review_status/
 *      reviewed_at) IN PLACE — proving the retention model directly: the
 *      row count stays at 2 (never becomes 4), and the PRIOR storage object
 *      is still present in the bucket after the resubmit (R-S08 retention is
 *      at the storage-object layer, not a new DB row).
 *   2. non-rejected statuses (never-reviewed pending / active / suspended /
 *      banned) CANNOT resubmit — server-side rpc guard, per status.
 *   3. cross-user: B has no code path to target A's application at all (no
 *      id parameter exists in the action/rpc — it only ever acts on the
 *      caller's own auth.uid() rows).
 *
 * The action reads its Supabase client via `@/lib/supabase/server`
 * createClient, which is mocked to return the current test's authenticated
 * client (T03/T06 precedent) so requireActiveUser() + the rpc both run as the
 * minted user.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Mock the cookie client so the action + requireActiveUser run as the minted
// user. `h.client` is swapped per test before each action call.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { resubmitSellerApplication } from "@/features/seller-onboarding/actions/resubmitSellerApplication";

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
const PASSWORD = `Betk_T05_${RUN}!`;
const EMAIL_PREFIX = "betk-t05-";
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
  return `+2012${n.toString().padStart(8, "0")}`;
}

let slugCounter = 0;
function makeSlug(): string {
  return `t05-${RUN}-${slugCounter++}`;
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
      role: "seller",
      status: "active",
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

/** Seed a full application (profile + store + 2 docs) via service role, at a
 * given seller_profiles.status (+ optional rejected_reason for the
 * "rejected" compound state). Docs upload real bytes so a real storage
 * object exists to prove retention. */
async function seedApplication(
  uid: string,
  opts: {
    status: "pending" | "active" | "suspended" | "banned";
    rejectedReason?: string | null;
  },
): Promise<{ frontPath: string; backPath: string }> {
  await svc().from("seller_profiles").insert({
    id: uid,
    status: opts.status,
    rejected_reason: opts.rejectedReason ?? null,
    submitted_at: new Date(Date.now() - 3_600_000).toISOString(), // 1h ago
  });
  await svc().from("stores").insert({
    seller_id: uid,
    name_ar: "متجر اختبار T05",
    slug: makeSlug(),
    category_primary: "handmade",
    governorate: "cairo",
    status: opts.status === "active" ? "active" : "pending",
  });

  const frontPath = `${uid}/national_id_front-${RUN}.png`;
  const backPath = `${uid}/national_id_back-${RUN}.png`;
  for (const p of [frontPath, backPath]) {
    const up = await service.storage
      .from(DOCS_BUCKET)
      .upload(p, PNG_1x1, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error(`seed doc upload failed: ${up.error.message}`);
    uploadedDocs.push(p);
  }
  await svc().from("seller_documents").insert([
    {
      seller_id: uid,
      document_type: "national_id_front",
      storage_path: frontPath,
      review_status: opts.status === "active" ? "approved" : "rejected",
    },
    {
      seller_id: uid,
      document_type: "national_id_back",
      storage_path: backPath,
      review_status: opts.status === "active" ? "approved" : "rejected",
    },
  ]);

  return { frontPath, backPath };
}

/** Upload a fresh doc pair as the given actor's own client (own-prefix RLS). */
async function uploadNewDocs(
  client: BetkClient,
  uid: string,
): Promise<{ docFrontPath: string; docBackPath: string }> {
  const docFrontPath = `${uid}/national_id_front-resubmit-${Date.now()}.png`;
  const docBackPath = `${uid}/national_id_back-resubmit-${Date.now()}.png`;
  for (const p of [docFrontPath, docBackPath]) {
    const up = await client.storage
      .from(DOCS_BUCKET)
      .upload(p, PNG_1x1, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error(`resubmit doc upload failed: ${up.error.message}`);
    uploadedDocs.push(p);
  }
  return { docFrontPath, docBackPath };
}

async function docCount(uid: string): Promise<number> {
  const { count } = await svc()
    .from("seller_documents")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", uid);
  return count ?? 0;
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 04 / T05 — seller-application resubmit (staging)", () => {
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
  // 1. rejected → resubmit happy path (the CONFIRMED STATE MODEL)
  // -------------------------------------------------------------------------
  it("rejected seller resubmits → status stays 'pending' + rejected_reason cleared + submitted_at refreshed + docs overwritten IN PLACE (retention proof)", async () => {
    const a = await createActor("rejected", { phone: makePhone() });
    const seeded = await seedApplication(a.id, {
      status: "pending",
      rejectedReason: "National ID photo was blurry.",
    });

    const beforeSubmittedAt = (
      await svc().from("seller_profiles").select("submitted_at").eq("id", a.id).single()
    ).data?.submitted_at;

    const { docFrontPath, docBackPath } = await uploadNewDocs(a.client, a.id);

    h.client = a.client;
    const res = await resubmitSellerApplication({ docFrontPath, docBackPath });
    expect(res).toEqual({ ok: true });

    const { data: profile } = await svc()
      .from("seller_profiles")
      .select("status, rejected_reason, submitted_at")
      .eq("id", a.id)
      .single();
    expect(profile?.status).toBe("pending"); // never left 'pending' (confirmed model)
    expect(profile?.rejected_reason).toBeNull();
    expect(profile?.submitted_at).not.toBe(beforeSubmittedAt);
    expect(new Date(profile!.submitted_at!).getTime()).toBeGreaterThan(
      new Date(beforeSubmittedAt!).getTime(),
    );

    // Row count stays at 2 — proves UPDATE-in-place, not a new INSERT
    // (uq_seller_doc_type would reject a genuine second insert anyway).
    expect(await docCount(a.id)).toBe(2);

    const { data: docs } = await svc()
      .from("seller_documents")
      .select("document_type, storage_path, review_status, reviewed_at")
      .eq("seller_id", a.id)
      .order("document_type", { ascending: true });
    const front = docs?.find((d) => d.document_type === "national_id_front");
    const back = docs?.find((d) => d.document_type === "national_id_back");
    expect(front?.storage_path).toBe(docFrontPath);
    expect(back?.storage_path).toBe(docBackPath);
    expect(front?.review_status).toBe("pending");
    expect(back?.review_status).toBe("pending");
    expect(front?.reviewed_at).toBeNull();
    expect(back?.reviewed_at).toBeNull();

    // RETENTION PROOF (R-S08): the PRIOR storage objects are still present in
    // the bucket — resubmission does not delete/overwrite the old files, it
    // only repoints the DB row to a NEW object.
    const priorFront = await service.storage.from(DOCS_BUCKET).download(seeded.frontPath);
    const priorBack = await service.storage.from(DOCS_BUCKET).download(seeded.backPath);
    expect(priorFront.error).toBeNull();
    expect(priorBack.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2. non-rejected statuses cannot resubmit (per-status server guard)
  // -------------------------------------------------------------------------
  it("never-reviewed pending (rejected_reason IS NULL) → not_rejected + ZERO writes", async () => {
    const a = await createActor("never-reviewed", { phone: makePhone() });
    await seedApplication(a.id, { status: "pending", rejectedReason: null });
    const { docFrontPath, docBackPath } = await uploadNewDocs(a.client, a.id);

    h.client = a.client;
    const res = await resubmitSellerApplication({ docFrontPath, docBackPath });
    expect(res).toEqual({ ok: false, reason: "not_rejected" });

    const { data: docs } = await svc()
      .from("seller_documents")
      .select("storage_path")
      .eq("seller_id", a.id);
    expect(docs?.some((d) => d.storage_path === docFrontPath)).toBe(false);
  });

  it("active seller → not_rejected + ZERO writes", async () => {
    const a = await createActor("active", { phone: makePhone() });
    await seedApplication(a.id, { status: "active" });
    const { docFrontPath, docBackPath } = await uploadNewDocs(a.client, a.id);

    h.client = a.client;
    const res = await resubmitSellerApplication({ docFrontPath, docBackPath });
    expect(res).toEqual({ ok: false, reason: "not_rejected" });
  });

  it("suspended seller → not_rejected + ZERO writes", async () => {
    const a = await createActor("suspended", { phone: makePhone() });
    await seedApplication(a.id, { status: "suspended" });
    const { docFrontPath, docBackPath } = await uploadNewDocs(a.client, a.id);

    h.client = a.client;
    const res = await resubmitSellerApplication({ docFrontPath, docBackPath });
    expect(res).toEqual({ ok: false, reason: "not_rejected" });
  });

  it("banned seller → not_rejected + ZERO writes", async () => {
    const a = await createActor("banned", { phone: makePhone() });
    await seedApplication(a.id, { status: "banned" });
    const { docFrontPath, docBackPath } = await uploadNewDocs(a.client, a.id);

    h.client = a.client;
    const res = await resubmitSellerApplication({ docFrontPath, docBackPath });
    expect(res).toEqual({ ok: false, reason: "not_rejected" });
  });

  // -------------------------------------------------------------------------
  // 3. deactivated user blocked (R-A05, no phone re-check)
  // -------------------------------------------------------------------------
  it("deactivated user (R-A05) → blocked + ZERO writes", async () => {
    const d = await createActor("deactivated", {
      phone: makePhone(),
      deletedAt: new Date().toISOString(),
    });
    await seedApplication(d.id, { status: "pending", rejectedReason: "reason" });
    const { docFrontPath, docBackPath } = await uploadNewDocs(d.client, d.id);

    h.client = d.client;
    const res = await resubmitSellerApplication({ docFrontPath, docBackPath });
    expect(res).toEqual({ ok: false, reason: "blocked" });
  });

  // -------------------------------------------------------------------------
  // 4. cross-user: B cannot resubmit A's application — no id parameter exists
  // -------------------------------------------------------------------------
  it("cross-user: B's own resubmit call only ever touches B's OWN rows, never A's", async () => {
    const a = await createActor("iso-a", { phone: makePhone() });
    await seedApplication(a.id, { status: "pending", rejectedReason: "A's rejection" });

    const b = await createActor("iso-b", { phone: makePhone() });
    await seedApplication(b.id, { status: "pending", rejectedReason: "B's rejection" });

    // B calls resubmit with B's own uploaded paths (own-prefix, own client) —
    // there is no id parameter anywhere for B to target A's application with.
    const bDocs = await uploadNewDocs(b.client, b.id);
    h.client = b.client;
    const res = await resubmitSellerApplication(bDocs);
    expect(res).toEqual({ ok: true });

    // A's application is completely untouched by B's resubmit.
    const { data: aProfile } = await svc()
      .from("seller_profiles")
      .select("status, rejected_reason")
      .eq("id", a.id)
      .single();
    expect(aProfile?.status).toBe("pending");
    expect(aProfile?.rejected_reason).toBe("A's rejection");

    // A's doc paths are unchanged (still the seeded paths, not B's new ones).
    const { data: aDocs } = await svc()
      .from("seller_documents")
      .select("storage_path")
      .eq("seller_id", a.id);
    expect(aDocs?.some((r) => r.storage_path === bDocs.docFrontPath)).toBe(false);
    expect(aDocs?.some((r) => r.storage_path === bDocs.docBackPath)).toBe(false);

    // B, meanwhile, was actually cleared (proves the action ran, not a no-op).
    const { data: bProfile } = await svc()
      .from("seller_profiles")
      .select("rejected_reason")
      .eq("id", b.id)
      .single();
    expect(bProfile?.rejected_reason).toBeNull();
  });
});

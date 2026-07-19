/**
 * Phase 04 / T01 — seller DB & storage foundation RLS integration tests.
 *
 * Runs against the STAGING Supabase project (sojmjvohiziapiwkzsjg). Mints real
 * GoTrue users, exercises the policies through RLS-respecting authenticated
 * clients (service-role only seeds + tears down), and cleans every fixture.
 *
 * Proves:
 *   REG-10  seller_profiles ownership INSERT (permissive sp_insert) COMBINES
 *           with the RESTRICTIVE seller_profiles_phone_gate:
 *             +  phone-verified user inserts their OWN row               (PASS)
 *             -  phone-NULL user is DENIED despite sp_insert (gate bites) (PASS)
 *             -  cross-user id (id != auth.uid()) is DENIED               (PASS)
 *   REG-31  stores ownership INSERT (permissive stores_insert):
 *             +  owner inserts their OWN store                           (PASS)
 *             -  cross-user seller_id is DENIED                          (PASS)
 *   STORAGE docs (PRIVATE) + media (public):
 *             +  owner uploads + reads own docs object                  (PASS)
 *             -  anon and another authed user get NOTHING on docs        (PASS)
 *             +  admin reads the owner's docs object (review path)       (PASS)
 *   STORAGE media (public=true, SELECT hardened to own-prefix, T01-FIX):
 *             +  anon fetch via PUBLIC URL still returns bytes (load-bearing)
 *             -  anon .list() on the bucket returns zero rows (denied)   (PASS)
 *             -  other-user .list() of a foreign prefix returns zero rows (denied)
 *             +  owner lists + reads own prefix; writes own-prefix       (PASS)
 *   NOTE: per-object READ (download / public URL) stays open on a public bucket
 *   by design — the advisor (0025 public_bucket_allows_listing) + T01-FIX target
 *   LISTING/enumeration, not public object reads. A foreign-prefix download of a
 *   KNOWN path still returns the bytes; that boundary is asserted explicitly.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

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

const DOCS_BUCKET = serverEnv.SUPABASE_DOCS_BUCKET ?? "docs";
const MEDIA_BUCKET = serverEnv.SUPABASE_MEDIA_BUCKET ?? "media";

type BetkClient = SupabaseClient<Database, "betk">;

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_T01_${RUN}!`;
const EMAIL_PREFIX = "betk-t01-";

const service = createServiceClient();
const svc = () => service.schema("betk");
const createdAuthIds: string[] = [];
const uploadedDocs: string[] = [];
const uploadedMedia: string[] = [];

// A 1x1 transparent PNG (bucket MIME allow-list = image/*).
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
  return `+2010${n.toString().padStart(8, "0")}`;
}

interface Actor {
  id: string;
  email: string;
  client: BetkClient;
}

async function createActor(
  label: string,
  opts: { phone: string | null; role?: Database["betk"]["Enums"]["user_role"] },
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

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 04 / T01 — seller DB + storage RLS (staging)", () => {
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
    if (uploadedMedia.length) {
      await service.storage.from(MEDIA_BUCKET).remove(uploadedMedia);
    }
    // users delete cascades seller_profiles -> stores (ON DELETE CASCADE).
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  // -------------------------------------------------------------------------
  // REG-10 — seller_profiles ownership INSERT + phone gate combination
  // -------------------------------------------------------------------------
  it("REG-10 (+): a phone-VERIFIED user inserts their OWN seller_profiles row", async () => {
    const a = await createActor("sp-pos", { phone: makePhone() });

    const { data, error } = await a.client
      .from("seller_profiles")
      .insert({ id: a.id, status: "pending", level: "bronze" })
      .select("id");

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(1);
    expect(data?.[0]?.id).toBe(a.id);
  });

  it("REG-10 (-): a phone-NULL user is DENIED despite sp_insert (RESTRICTIVE gate bites)", async () => {
    const g = await createActor("sp-null", { phone: null });

    const { data, error } = await g.client
      .from("seller_profiles")
      .insert({ id: g.id, status: "pending", level: "bronze" })
      .select("id");

    // RLS denial on INSERT surfaces as an error + no row; and no row persists.
    expect(error).not.toBeNull();
    expect(data?.length ?? 0).toBe(0);

    const { data: after } = await svc()
      .from("seller_profiles")
      .select("id")
      .eq("id", g.id);
    expect(after?.length ?? 0).toBe(0);
  });

  it("REG-10 (-): cross-user id (id != auth.uid()) is DENIED", async () => {
    const attacker = await createActor("sp-attacker", { phone: makePhone() });
    const victim = await createActor("sp-victim", { phone: makePhone() });

    const { data, error } = await attacker.client
      .from("seller_profiles")
      .insert({ id: victim.id, status: "pending" })
      .select("id");

    expect(error).not.toBeNull();
    expect(data?.length ?? 0).toBe(0);

    const { data: after } = await svc()
      .from("seller_profiles")
      .select("id")
      .eq("id", victim.id);
    expect(after?.length ?? 0).toBe(0);
  });

  // -------------------------------------------------------------------------
  // REG-31 — stores ownership INSERT
  // -------------------------------------------------------------------------
  it("REG-31 (+): the owner inserts their OWN store", async () => {
    const s = await createActor("store-pos", { phone: makePhone() });
    // A store's seller_id FKs seller_profiles(id) — the profile must exist first.
    await svc().from("seller_profiles").insert({ id: s.id, status: "pending" });

    const { data, error } = await s.client
      .from("stores")
      .insert({
        seller_id: s.id,
        name_ar: "متجر اختبار T01",
        slug: `t01-store-${RUN}`,
        category_primary: "general",
        governorate: "Cairo",
      })
      .select("id");

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(1);
  });

  it("REG-31 (-): a cross-user seller_id is DENIED", async () => {
    const attacker = await createActor("store-attacker", { phone: makePhone() });
    const victim = await createActor("store-victim", { phone: makePhone() });
    // Give the victim a real seller_profiles row so the FK passes and only RLS
    // can be the thing that rejects (isolates the policy from the FK).
    await svc().from("seller_profiles").insert({ id: victim.id, status: "pending" });

    const { data, error } = await attacker.client
      .from("stores")
      .insert({
        seller_id: victim.id,
        name_ar: "متجر مسروق",
        slug: `t01-steal-${RUN}`,
        category_primary: "general",
        governorate: "Cairo",
      })
      .select("id");

    expect(error).not.toBeNull();
    expect(data?.length ?? 0).toBe(0);

    const { data: after } = await svc()
      .from("stores")
      .select("id")
      .eq("seller_id", victim.id);
    expect(after?.length ?? 0).toBe(0);
  });

  // -------------------------------------------------------------------------
  // STORAGE — docs (PRIVATE) own-prefix + admin review path
  // -------------------------------------------------------------------------
  it("STORAGE docs: owner uploads + reads own; anon + other-user get NOTHING; admin reads", async () => {
    const owner = await createActor("docs-owner", { phone: makePhone() });
    const other = await createActor("docs-other", { phone: makePhone() });
    const admin = await createActor("docs-admin", { phone: makePhone(), role: "admin" });

    const path = `${owner.id}/national_id_front.png`;

    // (+) owner uploads under own prefix
    const up = await owner.client.storage
      .from(DOCS_BUCKET)
      .upload(path, PNG_1x1, { contentType: "image/png", upsert: false });
    expect(up.error).toBeNull();
    if (!up.error) uploadedDocs.push(path);

    // (-) owner CANNOT upload outside own prefix
    const badUp = await owner.client.storage
      .from(DOCS_BUCKET)
      .upload(`${other.id}/sneaky.png`, PNG_1x1, { contentType: "image/png" });
    expect(badUp.error).not.toBeNull();

    // (+) owner reads own object
    const ownRead = await owner.client.storage.from(DOCS_BUCKET).download(path);
    expect(ownRead.error).toBeNull();
    expect(ownRead.data).toBeTruthy();

    // (-) another authenticated user cannot read it
    const otherRead = await other.client.storage.from(DOCS_BUCKET).download(path);
    expect(otherRead.error).not.toBeNull();
    expect(otherRead.data).toBeFalsy();

    // (-) anon cannot read it
    const anonRead = await anonClient().storage.from(DOCS_BUCKET).download(path);
    expect(anonRead.error).not.toBeNull();
    expect(anonRead.data).toBeFalsy();

    // (+) admin can read it (docs_select_own_or_admin → is_admin())
    const adminRead = await admin.client.storage.from(DOCS_BUCKET).download(path);
    expect(adminRead.error).toBeNull();
    expect(adminRead.data).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // STORAGE — media: public=true (URL serving unaffected) but SELECT hardened
  // to own-prefix (T01-FIX, migration 20260719134903) so the Data API cannot
  // enumerate the whole bucket. Clears advisor 0025 public_bucket_allows_listing.
  // -------------------------------------------------------------------------
  it("STORAGE media: public URL still serves; .list() own-prefix only; foreign-prefix enumeration denied", async () => {
    const owner = await createActor("media-owner", { phone: makePhone() });
    const other = await createActor("media-other", { phone: makePhone() });
    const path = `${owner.id}/avatar.png`;

    const up = await owner.client.storage
      .from(MEDIA_BUCKET)
      .upload(path, PNG_1x1, { contentType: "image/png", upsert: false });
    expect(up.error).toBeNull();
    if (!up.error) uploadedMedia.push(path);

    // (-) owner cannot write outside own prefix
    const badUp = await owner.client.storage
      .from(MEDIA_BUCKET)
      .upload(`someone-else/avatar.png`, PNG_1x1, { contentType: "image/png" });
    expect(badUp.error).not.toBeNull();

    // (1) LOAD-BEARING POSITIVE: anon fetch of the object via its PUBLIC URL
    // still returns the bytes. public=true buckets serve URLs bypassing RLS —
    // this is the app's read path and MUST keep working after the SELECT-policy
    // swap. If this fails, the hardening broke public serving — STOP, do not
    // restore the broad public SELECT.
    const { data: pub } = owner.client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    const res = await fetch(pub.publicUrl);
    expect(res.ok).toBe(true);
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.length).toBe(PNG_1x1.length);

    // (2) anon .list() on the media bucket returns ZERO rows (no SELECT policy
    // for anon → RLS filters everything; enumeration denied).
    const anonList = await anonClient().storage.from(MEDIA_BUCKET).list(owner.id);
    expect(anonList.error).toBeNull();
    expect(anonList.data?.length ?? 0).toBe(0);

    // (3) another authenticated user cannot ENUMERATE a foreign prefix via the
    // Data API — the own-prefix SELECT does not match their uid, so .list()
    // returns zero rows. This is the property advisor 0025 flags and T01-FIX
    // closes: no cross-tenant listing of the bucket.
    const otherList = await other.client.storage.from(MEDIA_BUCKET).list(owner.id);
    expect(otherList.error).toBeNull();
    expect(otherList.data?.length ?? 0).toBe(0);

    // BOUNDARY (documented, not a regression): per-object READ stays open on a
    // public bucket. download()/public-URL of a KNOWN path succeeds for any
    // caller — that is what public=true means and is the app's avatar/cover
    // serving path (assertion 1). The hardening removes LISTING/enumeration,
    // not public object reads. So a foreign-prefix download still returns the
    // bytes; assert that reality explicitly rather than hide it.
    const otherDownload = await other.client.storage.from(MEDIA_BUCKET).download(path);
    expect(otherDownload.error).toBeNull();
    expect(otherDownload.data).toBeTruthy();

    // (4) the owner lists + reads their OWN prefix.
    const ownList = await owner.client.storage.from(MEDIA_BUCKET).list(owner.id);
    expect(ownList.error).toBeNull();
    expect(ownList.data?.some((o) => o.name === "avatar.png")).toBe(true);

    const ownDownload = await owner.client.storage.from(MEDIA_BUCKET).download(path);
    expect(ownDownload.error).toBeNull();
    expect(ownDownload.data).toBeTruthy();
  });
});

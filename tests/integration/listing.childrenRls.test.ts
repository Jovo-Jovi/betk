/**
 * Phase 05 / T01 — listing-children owner-write RLS integration tests (REG-34).
 *
 * Runs against the STAGING Supabase project (sojmjvohiziapiwkzsjg). Mints real
 * GoTrue users, exercises the policies through RLS-respecting authenticated
 * clients (service-role only seeds + tears down), and cleans every fixture.
 *
 * REG-34: migration 20260721111355_listing_children_owner_write_rls added
 * listing_images_seller / listing_tags_seller (FOR ALL USING (parent listing's
 * store_id = my_store_id() OR is_admin())), mirroring the parent listings_seller.
 * The pre-existing public SELECT policies (listing_images_public /
 * listing_tags_public, active+sold_out via parent) are UNTOUCHED and OR-combine.
 *
 * Proves:
 *   OWNER (+)  seller INSERT / UPDATE / DELETE image+tag rows on OWN listing   (PASS)
 *   OWNER (+)  seller SELECTs OWN DRAFT listing's children via the FOR ALL
 *              policy (the "follows listing" reconstruction — unblocks T02 edit) (PASS)
 *   CROSS  (-) a 2nd seller cannot INSERT/UPDATE/DELETE children on another
 *              store's listing                                                  (DENY)
 *   ANON   (-) anon cannot INSERT children on any listing                       (DENY)
 *   PUBLIC (+) anon SELECT of an ACTIVE listing's children still works (no
 *              regression from the public policy)                               (PASS)
 *   DRAFT  (-) anon SELECT of a DRAFT listing's children returns nothing        (DENY)
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

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
const PASSWORD = `Betk_P5T01_${RUN}!`;
const EMAIL_PREFIX = "betk-p5t01-";

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
  return `+2010${n.toString().padStart(8, "0")}`;
}

interface Seller {
  id: string;
  email: string;
  client: BetkClient;
  storeId: string;
}

async function createSeller(label: string): Promise<Seller> {
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
    .insert({ id, phone_number: makePhone(), auth_provider: "phone", role: "seller" });
  if (uErr) throw new Error(`users seed(${label}) failed: ${uErr.message}`);

  const { error: spErr } = await svc()
    .from("seller_profiles")
    .insert({ id, status: "active" });
  if (spErr) throw new Error(`seller_profiles seed(${label}) failed: ${spErr.message}`);

  const { data: store, error: stErr } = await svc()
    .from("stores")
    .insert({
      seller_id: id,
      name_ar: `متجر ${label} ${RUN}`,
      slug: `p5t01-${label}-${RUN}`,
      category_primary: "general",
      governorate: "Cairo",
      status: "active",
    })
    .select("id")
    .single();
  if (stErr || !store) throw new Error(`stores seed(${label}) failed: ${stErr?.message}`);

  const client = anonClient();
  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInErr) throw new Error(`signIn(${label}) failed: ${signInErr.message}`);

  return { id, email, client, storeId: store.id };
}

async function seedListing(
  storeId: string,
  categoryId: string,
  status: Database["betk"]["Enums"]["listing_status"],
): Promise<string> {
  const { data, error } = await svc()
    .from("listings")
    .insert({
      store_id: storeId,
      category_id: categoryId,
      type: "product",
      title_ar: `منتج اختبار ${RUN}`,
      price: 100,
      price_type: "fixed",
      status,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`listings seed failed: ${error?.message}`);
  return data.id;
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 05 / T01 — listing children owner-write RLS (staging)", () => {
  let sellerA: Seller;
  let sellerB: Seller;
  let categoryId: string;
  let activeListingA: string;
  let draftListingA: string;

  beforeAll(async () => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (catErr || !cat) throw new Error(`no active category for fixtures: ${catErr?.message}`);
    categoryId = cat.id;

    sellerA = await createSeller("a");
    sellerB = await createSeller("b");
    activeListingA = await seedListing(sellerA.storeId, categoryId, "active");
    draftListingA = await seedListing(sellerA.storeId, categoryId, "draft");
  });

  afterAll(async () => {
    // listings/images/tags cascade from stores -> seller_profiles -> users.
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  // -------------------------------------------------------------------------
  // OWNER (+) — INSERT / UPDATE / DELETE own listing's images + tags
  // -------------------------------------------------------------------------
  it("OWNER (+): seller INSERT/UPDATE/DELETE an image row on their OWN listing", async () => {
    const ins = await sellerA.client
      .from("listing_images")
      .insert({ listing_id: activeListingA, url: `https://cdn.test/${RUN}/0.png`, sort_order: 0 })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    expect(ins.data?.id).toBeTruthy();
    const imgId = ins.data!.id;

    const upd = await sellerA.client
      .from("listing_images")
      .update({ sort_order: 1 })
      .eq("id", imgId)
      .select("id, sort_order");
    expect(upd.error).toBeNull();
    expect(upd.data?.[0]?.sort_order).toBe(1);

    const del = await sellerA.client.from("listing_images").delete().eq("id", imgId).select("id");
    expect(del.error).toBeNull();
    expect(del.data?.length ?? 0).toBe(1);

    const { data: after } = await svc().from("listing_images").select("id").eq("id", imgId);
    expect(after?.length ?? 0).toBe(0);
  });

  it("OWNER (+): seller INSERT/UPDATE/DELETE a tag row on their OWN listing", async () => {
    const ins = await sellerA.client
      .from("listing_tags")
      .insert({ listing_id: activeListingA, tag: `tag-${RUN}` })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    const tagId = ins.data!.id;

    const upd = await sellerA.client
      .from("listing_tags")
      .update({ tag: `tag2-${RUN}` })
      .eq("id", tagId)
      .select("id, tag");
    expect(upd.error).toBeNull();
    expect(upd.data?.[0]?.tag).toBe(`tag2-${RUN}`);

    const del = await sellerA.client.from("listing_tags").delete().eq("id", tagId).select("id");
    expect(del.error).toBeNull();
    expect(del.data?.length ?? 0).toBe(1);
  });

  it("OWNER (+): seller SELECTs their OWN DRAFT listing's children (FOR ALL policy)", async () => {
    // Seed a child on the DRAFT listing via service role, then read as owner.
    const { data: seeded } = await svc()
      .from("listing_images")
      .insert({ listing_id: draftListingA, url: `https://cdn.test/${RUN}/draft.png`, sort_order: 0 })
      .select("id")
      .single();
    expect(seeded?.id).toBeTruthy();

    const ownRead = await sellerA.client
      .from("listing_images")
      .select("id")
      .eq("listing_id", draftListingA);
    expect(ownRead.error).toBeNull();
    expect(ownRead.data?.some((r) => r.id === seeded!.id)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CROSS-SELLER (-) — writes on ANOTHER store's listing denied
  // -------------------------------------------------------------------------
  it("CROSS (-): a 2nd seller cannot INSERT an image on another store's listing", async () => {
    const ins = await sellerB.client
      .from("listing_images")
      .insert({ listing_id: activeListingA, url: `https://cdn.test/${RUN}/evil.png`, sort_order: 0 })
      .select("id");
    expect(ins.error).not.toBeNull();
    expect(ins.data?.length ?? 0).toBe(0);
  });

  it("CROSS (-): a 2nd seller cannot UPDATE/DELETE another store's existing child rows", async () => {
    // Seed a real image + tag on A's listing via service role.
    const { data: img } = await svc()
      .from("listing_images")
      .insert({ listing_id: activeListingA, url: `https://cdn.test/${RUN}/victim.png`, sort_order: 0 })
      .select("id")
      .single();
    const { data: tag } = await svc()
      .from("listing_tags")
      .insert({ listing_id: activeListingA, tag: `victim-${RUN}` })
      .select("id")
      .single();

    const updImg = await sellerB.client
      .from("listing_images")
      .update({ sort_order: 4 })
      .eq("id", img!.id)
      .select("id");
    expect(updImg.data?.length ?? 0).toBe(0); // USING filters the row out → no-op

    const delTag = await sellerB.client
      .from("listing_tags")
      .delete()
      .eq("id", tag!.id)
      .select("id");
    expect(delTag.data?.length ?? 0).toBe(0);

    // Both rows survive.
    const { data: imgAfter } = await svc().from("listing_images").select("id").eq("id", img!.id);
    const { data: tagAfter } = await svc().from("listing_tags").select("id").eq("id", tag!.id);
    expect(imgAfter?.length ?? 0).toBe(1);
    expect(tagAfter?.length ?? 0).toBe(1);
  });

  // -------------------------------------------------------------------------
  // ANON (-) — writes denied
  // -------------------------------------------------------------------------
  it("ANON (-): anon cannot INSERT children on any listing", async () => {
    const anon = anonClient();
    const insImg = await anon
      .from("listing_images")
      .insert({ listing_id: activeListingA, url: `https://cdn.test/${RUN}/anon.png`, sort_order: 0 })
      .select("id");
    expect(insImg.error).not.toBeNull();
    expect(insImg.data?.length ?? 0).toBe(0);

    const insTag = await anon
      .from("listing_tags")
      .insert({ listing_id: activeListingA, tag: `anon-${RUN}` })
      .select("id");
    expect(insTag.error).not.toBeNull();
    expect(insTag.data?.length ?? 0).toBe(0);
  });

  // -------------------------------------------------------------------------
  // PUBLIC (+) / DRAFT (-) — SELECT regression + draft hidden
  // -------------------------------------------------------------------------
  it("PUBLIC (+): anon SELECTs an ACTIVE listing's children; DRAFT (-) hidden", async () => {
    // Seed one child on each listing via service role.
    await svc()
      .from("listing_images")
      .insert({ listing_id: activeListingA, url: `https://cdn.test/${RUN}/pub.png`, sort_order: 2 });
    await svc()
      .from("listing_tags")
      .insert({ listing_id: activeListingA, tag: `pub-${RUN}` });
    await svc()
      .from("listing_tags")
      .insert({ listing_id: draftListingA, tag: `draft-${RUN}` });

    const anon = anonClient();

    const pubImg = await anon.from("listing_images").select("id").eq("listing_id", activeListingA);
    expect(pubImg.error).toBeNull();
    expect((pubImg.data?.length ?? 0) > 0).toBe(true);

    const pubTag = await anon.from("listing_tags").select("id").eq("listing_id", activeListingA);
    expect((pubTag.data?.length ?? 0) > 0).toBe(true);

    // Draft listing's children are hidden from anon (public policy = active/sold_out only).
    const draftImg = await anon.from("listing_images").select("id").eq("listing_id", draftListingA);
    expect(draftImg.data?.length ?? 0).toBe(0);
    const draftTag = await anon.from("listing_tags").select("id").eq("listing_id", draftListingA);
    expect(draftTag.data?.length ?? 0).toBe(0);
  });
});

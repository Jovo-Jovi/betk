/**
 * Phase 06 / T01 — inquiries + inquiry_messages RLS integration tests (REG-41).
 *
 * Runs against the STAGING Supabase project (sojmjvohiziapiwkzsjg). Mints real
 * GoTrue users, exercises the policies through RLS-respecting authenticated
 * clients (service-role only seeds + tears down), and cleans every fixture.
 *
 * REG-41: migration 20260722115026_inquiry_messaging_rls added, ERD §3 rows 51-52:
 *   inquiries        — INSERT=buyer (WITH CHECK buyer_id=auth.uid()), UPDATE=store/admin
 *                      (SELECT already covered by the pre-existing inq_buyer =
 *                       buyer OR store OR admin).
 *   inquiry_messages — SELECT/INSERT=thread parties (parent inquiry buyer OR store),
 *                      INSERT pins sender_id=auth.uid(); UPDATE=sender own rows; no DELETE.
 *
 * Proves (both directions):
 *   BUYER    (+)  buyer INSERTs OWN inquiry + reads it                          (PASS)
 *   SELLER   (+)  owning seller reads the SAME inquiry                          (PASS)
 *   OUTSIDER (-)  unrelated seller + unrelated buyer read → zero rows           (DENY)
 *   ANON     (-)  anon read → zero rows                                         (DENY)
 *   THREAD   (+)  both parties INSERT messages into their thread + both read    (PASS)
 *   OUTSIDER (-)  non-party message INSERT denied                              (DENY)
 *   SENDER   (+)  sender UPDATEs own message's is_read                          (PASS)
 *   RECEIVER (+)  other party flips is_read on the sender's message             (PASS)
 *                 [REG-42 CLOSED by T02-FIX mig 20260722124510 + ERD §3 row-52
 *                  amendment; full tamper proof in inquiry.readReceipt.test.ts]
 *   DELETE   (-)  no DELETE path — message delete → 0 rows, row survives        (DENY)
 *   STATUS   (+/-) seller UPDATEs inquiry status; buyer status UPDATE → 0 rows  (PASS/DENY)
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
const PASSWORD = `Betk_P6T01_${RUN}!`;
const EMAIL_PREFIX = "betk-p6t01-";

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

async function signIn(email: string): Promise<BetkClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  return client;
}

interface Buyer {
  id: string;
  email: string;
  client: BetkClient;
}

async function createBuyer(label: string): Promise<Buyer> {
  const email = `${EMAIL_PREFIX}${label}-${RUN}@betk.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`);
  const id = data.user.id;
  createdAuthIds.push(id);

  const { error: uErr } = await svc()
    .from("users")
    .insert({ id, phone_number: makePhone(), auth_provider: "phone", role: "buyer" });
  if (uErr) throw new Error(`users seed(${label}) failed: ${uErr.message}`);

  return { id, email, client: await signIn(email) };
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
  if (error || !data.user) throw new Error(`createUser(${label}) failed: ${error?.message}`);
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
      slug: `p6t01-${label}-${RUN}`,
      category_primary: "general",
      governorate: "Cairo",
      status: "active",
    })
    .select("id")
    .single();
  if (stErr || !store) throw new Error(`stores seed(${label}) failed: ${stErr?.message}`);

  return { id, email, client: await signIn(email), storeId: store.id };
}

async function seedListing(storeId: string, categoryId: string): Promise<string> {
  const { data, error } = await svc()
    .from("listings")
    .insert({
      store_id: storeId,
      category_id: categoryId,
      type: "product",
      title_ar: `منتج اختبار ${RUN}`,
      price: 100,
      price_type: "fixed",
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`listings seed failed: ${error?.message}`);
  return data.id;
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 06 / T01 — inquiries + inquiry_messages RLS (staging)", () => {
  let sellerA: Seller; // owns the store the inquiry targets
  let sellerB: Seller; // unrelated seller (outsider)
  let buyer: Buyer; // the thread buyer
  let outsiderBuyer: Buyer; // unrelated buyer (outsider)
  let categoryId: string;
  let listingA: string;
  let inquiryId: string;

  beforeAll(async () => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    // Self-heal: purge any residue left by a previously interrupted run (deletes
    // inquiries referencing stale stores first, then their owners — cascading
    // seller_profiles -> stores -> listings). Keeps re-runs zero-residue.
    const { data: stale } = await svc().from("stores").select("id, seller_id").like("slug", "p6t01-%");
    if (stale && stale.length > 0) {
      await svc().from("inquiries").delete().in("store_id", stale.map((s) => s.id));
      await svc().from("users").delete().in("id", stale.map((s) => s.seller_id));
    }

    const { data: cat, error: catErr } = await svc()
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .single();
    if (catErr || !cat) throw new Error(`no active category for fixtures: ${catErr?.message}`);
    categoryId = cat.id;

    sellerA = await createSeller("sellera");
    sellerB = await createSeller("sellerb");
    buyer = await createBuyer("buyer");
    outsiderBuyer = await createBuyer("outsider");
    listingA = await seedListing(sellerA.storeId, categoryId);
  });

  afterAll(async () => {
    // Delete ALL run inquiries first (inquiry_messages cascade ON DELETE from the
    // parent inquiry). The inquiry's store_id FK has NO cascade, so the seller's
    // store cannot cascade-delete with its user while the inquiry still references
    // it — hence inquiries must go before the users loop. Then deleting betk.users
    // cascades seller_profiles -> stores -> listings.
    await svc().from("inquiries").delete().in("buyer_id", createdAuthIds);
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  // -------------------------------------------------------------------------
  // BUYER (+) create + read; SELLER (+) read same
  // -------------------------------------------------------------------------
  it("BUYER (+): buyer INSERTs OWN inquiry and reads it back", async () => {
    const ins = await buyer.client
      .from("inquiries")
      .insert({
        buyer_id: buyer.id,
        store_id: sellerA.storeId,
        listing_id: listingA,
        buyer_first_message: `مرحبا ${RUN}`,
      })
      .select("id, status")
      .single();
    expect(ins.error).toBeNull();
    expect(ins.data?.id).toBeTruthy();
    expect(ins.data?.status).toBe("open");
    inquiryId = ins.data!.id;

    const read = await buyer.client.from("inquiries").select("id").eq("id", inquiryId);
    expect(read.error).toBeNull();
    expect(read.data?.length ?? 0).toBe(1);
  });

  it("BUYER (-): buyer cannot INSERT an inquiry impersonating another buyer_id", async () => {
    const ins = await buyer.client
      .from("inquiries")
      .insert({
        buyer_id: outsiderBuyer.id, // not the caller
        store_id: sellerA.storeId,
        listing_id: listingA,
        buyer_first_message: `spoof ${RUN}`,
      })
      .select("id");
    expect(ins.error).not.toBeNull();
    expect(ins.data?.length ?? 0).toBe(0);
  });

  it("SELLER (+): owning seller reads the SAME inquiry", async () => {
    const read = await sellerA.client.from("inquiries").select("id").eq("id", inquiryId);
    expect(read.error).toBeNull();
    expect(read.data?.length ?? 0).toBe(1);
  });

  // -------------------------------------------------------------------------
  // OUTSIDER (-) / ANON (-) read isolation
  // -------------------------------------------------------------------------
  it("OUTSIDER (-): unrelated seller and unrelated buyer read → zero rows", async () => {
    const bySellerB = await sellerB.client.from("inquiries").select("id").eq("id", inquiryId);
    expect(bySellerB.data?.length ?? 0).toBe(0);

    const byOutsider = await outsiderBuyer.client.from("inquiries").select("id").eq("id", inquiryId);
    expect(byOutsider.data?.length ?? 0).toBe(0);
  });

  it("ANON (-): anon read → zero rows", async () => {
    const anon = anonClient();
    const read = await anon.from("inquiries").select("id").eq("id", inquiryId);
    expect(read.data?.length ?? 0).toBe(0);
  });

  // -------------------------------------------------------------------------
  // THREAD (+) both parties send; OUTSIDER (-) send denied
  // -------------------------------------------------------------------------
  it("THREAD (+): both parties INSERT messages and both can read the thread", async () => {
    const buyerMsg = await buyer.client
      .from("inquiry_messages")
      .insert({
        inquiry_id: inquiryId,
        sender_id: buyer.id,
        sender_type: "buyer",
        body: `buyer says ${RUN}`,
      })
      .select("id")
      .single();
    expect(buyerMsg.error).toBeNull();
    expect(buyerMsg.data?.id).toBeTruthy();

    const sellerMsg = await sellerA.client
      .from("inquiry_messages")
      .insert({
        inquiry_id: inquiryId,
        sender_id: sellerA.id,
        sender_type: "seller",
        body: `seller says ${RUN}`,
      })
      .select("id")
      .single();
    expect(sellerMsg.error).toBeNull();
    expect(sellerMsg.data?.id).toBeTruthy();

    const buyerRead = await buyer.client
      .from("inquiry_messages")
      .select("id")
      .eq("inquiry_id", inquiryId);
    expect(buyerRead.data?.length ?? 0).toBe(2);

    const sellerRead = await sellerA.client
      .from("inquiry_messages")
      .select("id")
      .eq("inquiry_id", inquiryId);
    expect(sellerRead.data?.length ?? 0).toBe(2);
  });

  it("OUTSIDER (-): non-party message INSERT denied (sellerB, outsiderBuyer, anon)", async () => {
    const bySellerB = await sellerB.client
      .from("inquiry_messages")
      .insert({ inquiry_id: inquiryId, sender_id: sellerB.id, sender_type: "seller", body: "evil" })
      .select("id");
    expect(bySellerB.error).not.toBeNull();
    expect(bySellerB.data?.length ?? 0).toBe(0);

    const byOutsider = await outsiderBuyer.client
      .from("inquiry_messages")
      .insert({ inquiry_id: inquiryId, sender_id: outsiderBuyer.id, sender_type: "buyer", body: "evil" })
      .select("id");
    expect(byOutsider.error).not.toBeNull();
    expect(byOutsider.data?.length ?? 0).toBe(0);

    const anon = anonClient();
    const byAnon = await anon
      .from("inquiry_messages")
      .insert({ inquiry_id: inquiryId, sender_id: buyer.id, sender_type: "buyer", body: "evil" })
      .select("id");
    expect(byAnon.error).not.toBeNull();
    expect(byAnon.data?.length ?? 0).toBe(0);
  });

  it("OUTSIDER (-): unrelated parties cannot read the thread messages", async () => {
    const bySellerB = await sellerB.client
      .from("inquiry_messages")
      .select("id")
      .eq("inquiry_id", inquiryId);
    expect(bySellerB.data?.length ?? 0).toBe(0);

    const anon = anonClient();
    const byAnon = await anon.from("inquiry_messages").select("id").eq("inquiry_id", inquiryId);
    expect(byAnon.data?.length ?? 0).toBe(0);
  });

  // -------------------------------------------------------------------------
  // SENDER-only UPDATE (+/-) and NO DELETE (-)
  // -------------------------------------------------------------------------
  it("SENDER (+) own is_read; RECEIVER (+) flips the sender's is_read [REG-42 CLOSED]", async () => {
    // Buyer's own message.
    const { data: bMsg } = await svc()
      .from("inquiry_messages")
      .select("id")
      .eq("inquiry_id", inquiryId)
      .eq("sender_id", buyer.id)
      .single();

    // Sender updates own row's is_read → allowed (inq_msg_update, column-confined).
    const ownUpd = await buyer.client
      .from("inquiry_messages")
      .update({ is_read: true })
      .eq("id", bMsg!.id)
      .select("id, is_read");
    expect(ownUpd.error).toBeNull();
    expect(ownUpd.data?.[0]?.is_read).toBe(true);

    // The OTHER party (seller = the RECEIVER of the buyer's message) may now flip
    // is_read on it. REG-42 CLOSED by T02-FIX (migration 20260722124510 +
    // authorized ERD §3 row-52 amendment): inq_msg_read_receipt authorizes the row
    // (party AND sender <> caller), the column GRANT confines it to is_read. The
    // full tamper proof (both directions + body-edit GRANT denial) lives in
    // inquiry.readReceipt.test.ts.
    const otherUpd = await sellerA.client
      .from("inquiry_messages")
      .update({ is_read: false })
      .eq("id", bMsg!.id)
      .select("id, is_read");
    expect(otherUpd.error).toBeNull();
    expect(otherUpd.data?.length ?? 0).toBe(1);
    expect(otherUpd.data?.[0]?.is_read).toBe(false);

    const { data: after } = await svc()
      .from("inquiry_messages")
      .select("is_read")
      .eq("id", bMsg!.id)
      .single();
    expect(after?.is_read).toBe(false); // flipped by the receiver (seller)
  });

  it("DELETE (-): no DELETE policy — message delete → 0 rows, row survives", async () => {
    const { data: bMsg } = await svc()
      .from("inquiry_messages")
      .select("id")
      .eq("inquiry_id", inquiryId)
      .eq("sender_id", buyer.id)
      .single();

    const byBuyer = await buyer.client
      .from("inquiry_messages")
      .delete()
      .eq("id", bMsg!.id)
      .select("id");
    expect(byBuyer.data?.length ?? 0).toBe(0);

    const bySeller = await sellerA.client
      .from("inquiry_messages")
      .delete()
      .eq("id", bMsg!.id)
      .select("id");
    expect(bySeller.data?.length ?? 0).toBe(0);

    const { data: survives } = await svc()
      .from("inquiry_messages")
      .select("id")
      .eq("id", bMsg!.id);
    expect(survives?.length ?? 0).toBe(1);
  });

  // -------------------------------------------------------------------------
  // INQUIRY UPDATE (+/-): seller status transition allowed, buyer denied
  // -------------------------------------------------------------------------
  it("STATUS (+): owning seller UPDATEs inquiry status (the confirm surface)", async () => {
    const upd = await sellerA.client
      .from("inquiries")
      .update({ status: "confirmed" })
      .eq("id", inquiryId)
      .select("id, status");
    expect(upd.error).toBeNull();
    expect(upd.data?.[0]?.status).toBe("confirmed");
  });

  it("STATUS (-): buyer cannot UPDATE inquiry status → 0 rows (ERD: UPDATE = store/admin)", async () => {
    const upd = await buyer.client
      .from("inquiries")
      .update({ status: "declined" })
      .eq("id", inquiryId)
      .select("id");
    expect(upd.data?.length ?? 0).toBe(0);

    const { data: after } = await svc()
      .from("inquiries")
      .select("status")
      .eq("id", inquiryId)
      .single();
    expect(after?.status).toBe("confirmed"); // unchanged by the buyer's attempt
  });

  it("STATUS (-): unrelated seller cannot UPDATE the inquiry status → 0 rows", async () => {
    const upd = await sellerB.client
      .from("inquiries")
      .update({ status: "declined" })
      .eq("id", inquiryId)
      .select("id");
    expect(upd.data?.length ?? 0).toBe(0);
  });
});

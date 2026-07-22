/**
 * Phase 06 / T02-FIX — inquiry_messages read-receipt tamper proof (REG-42 CLOSED).
 *
 * Runs against the STAGING Supabase project. Proves the AUTHORIZED receiver
 * read-receipt write (ERD §3 row-52 amendment, 2026-07-22 + migration
 * 20260722124510_inquiry_read_receipt_rls): the RECEIVER of a message may flip
 * `is_read` on the OTHER party's messages, while the column-level GRANT confines
 * every authenticated UPDATE to the `is_read` column (a body/content edit is
 * DENIED BY THE GRANT, not merely filtered to zero rows).
 *
 * Tamper matrix:
 *   RECEIPT   (+)  receiver flips is_read on the other party's messages — BOTH
 *                  directions (seller→buyer's message, buyer→seller's message)
 *   GRANT     (-)  receiver UPDATE of `body` on the other party's message → DENIED
 *                  BY THE GRANT (error asserted, code 42501 / permission denied)
 *   SENDER    (+)  sender flipping own is_read → harmless (allowed, no-op-safe)
 *   IDEMPOTENT(+)  re-marking an already-read thread → markedCount 0, ok
 *   OUTSIDER  (-)  unrelated seller markInquiryRead → not_found; direct UPDATE → 0 rows
 *   ANON      (-)  anon is_read UPDATE → 0 rows (no applicable policy)
 *   DELETE    (-)  no DELETE path — message delete → 0 rows, row survives
 *
 * Mints real GoTrue users, cleans every fixture (inquiries deleted first —
 * inquiry_messages cascade; then users cascade seller_profiles→stores→listings).
 * Zero residue.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/configs/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

// ── Mock the cookie client → the current test's authenticated client ─────────
const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { markInquiryRead } from "@/features/messaging/actions/markInquiryRead";
import { getInquiryThread } from "@/features/messaging/queries/getInquiryThread";

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
const PASSWORD = `Betk_P6T02FIX_${RUN}!`;
const EMAIL_PREFIX = "betk-p6t02fix-";

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

async function signIn(email: string): Promise<BetkClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn(${email}) failed: ${error.message}`);
  return client;
}

interface Buyer {
  id: string;
  client: BetkClient;
}

async function createBuyer(label: string): Promise<Buyer> {
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
    .insert({ id, phone_number: makePhone(), auth_provider: "phone", role: "buyer" });
  if (uErr) throw new Error(`users seed(${label}): ${uErr.message}`);

  return { id, client: await signIn(email) };
}

interface Seller {
  id: string;
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
      slug: `p6t02fix-${label}-${RUN}`,
      category_primary: "general",
      governorate: "Cairo",
      status: "active",
    })
    .select("id")
    .single();
  if (stErr || !store) throw new Error(`stores seed(${label}): ${stErr?.message}`);

  return { id, client: await signIn(email), storeId: store.id };
}

async function seedListing(storeId: string, categoryId: string): Promise<string> {
  const { data, error } = await svc()
    .from("listings")
    .insert({
      store_id: storeId,
      category_id: categoryId,
      type: "product",
      title_ar: `منتج ${RUN}`,
      price: 100,
      price_type: "fixed",
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`listings seed failed: ${error?.message}`);
  return data.id;
}

async function isRead(messageId: string): Promise<boolean> {
  const { data } = await svc()
    .from("inquiry_messages")
    .select("is_read")
    .eq("id", messageId)
    .single();
  return data?.is_read ?? false;
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 06 / T02-FIX — inquiry_messages read-receipt (staging)", () => {
  let sellerA: Seller; // owns the store the inquiry targets
  let sellerB: Seller; // unrelated seller (outsider)
  let buyer: Buyer;
  let categoryId: string;
  let listingA: string;

  let inquiryId: string;
  let buyerMsgId: string; // sent by the buyer   → seller is its receiver
  let sellerMsgId: string; // sent by the seller → buyer is its receiver

  beforeAll(async () => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    // Self-heal any residue from an interrupted run.
    const { data: stale } = await svc()
      .from("stores")
      .select("id, seller_id")
      .like("slug", "p6t02fix-%");
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
    if (catErr || !cat) throw new Error(`no active category: ${catErr?.message}`);
    categoryId = cat.id;

    sellerA = await createSeller("sellera");
    sellerB = await createSeller("sellerb");
    buyer = await createBuyer("buyer");
    listingA = await seedListing(sellerA.storeId, categoryId);

    // Inquiry + one message from EACH party (service-seeded; is_read defaults false).
    const { data: inq, error: inqErr } = await svc()
      .from("inquiries")
      .insert({
        buyer_id: buyer.id,
        store_id: sellerA.storeId,
        listing_id: listingA,
        buyer_first_message: `مرحبا ${RUN}`,
      })
      .select("id")
      .single();
    if (inqErr || !inq) throw new Error(`inquiry seed failed: ${inqErr?.message}`);
    inquiryId = inq.id;

    const { data: bm, error: bmErr } = await svc()
      .from("inquiry_messages")
      .insert({ inquiry_id: inquiryId, sender_id: buyer.id, sender_type: "buyer", body: `س ${RUN}` })
      .select("id")
      .single();
    if (bmErr || !bm) throw new Error(`buyer message seed failed: ${bmErr?.message}`);
    buyerMsgId = bm.id;

    const { data: sm, error: smErr } = await svc()
      .from("inquiry_messages")
      .insert({ inquiry_id: inquiryId, sender_id: sellerA.id, sender_type: "seller", body: `ر ${RUN}` })
      .select("id")
      .single();
    if (smErr || !sm) throw new Error(`seller message seed failed: ${smErr?.message}`);
    sellerMsgId = sm.id;
  });

  afterAll(async () => {
    await svc().from("inquiries").delete().in("buyer_id", createdAuthIds);
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  // ── RECEIPT (+) both directions ──────────────────────────────────────────────
  it("RECEIPT (+): seller (receiver) marks the buyer's message read; own message untouched", async () => {
    expect(await isRead(buyerMsgId)).toBe(false);

    h.client = sellerA.client;
    const res = await markInquiryRead({ inquiryId });
    expect(res).toEqual({ ok: true, markedCount: 1 }); // only the buyer's (other party's) message

    expect(await isRead(buyerMsgId)).toBe(true); // flipped by the receiver
    expect(await isRead(sellerMsgId)).toBe(false); // seller's own message NOT flipped by seller
  });

  it("RECEIPT (+): buyer (receiver) marks the seller's message read (the other direction)", async () => {
    expect(await isRead(sellerMsgId)).toBe(false);

    h.client = buyer.client;
    const res = await markInquiryRead({ inquiryId });
    expect(res).toEqual({ ok: true, markedCount: 1 }); // only the seller's (other party's) message

    expect(await isRead(sellerMsgId)).toBe(true); // flipped by the buyer receiver
  });

  it("IDEMPOTENT (+): re-marking a fully-read thread → markedCount 0, still ok", async () => {
    h.client = sellerA.client;
    expect(await markInquiryRead({ inquiryId })).toEqual({ ok: true, markedCount: 0 });
    h.client = buyer.client;
    expect(await markInquiryRead({ inquiryId })).toEqual({ ok: true, markedCount: 0 });
  });

  // ── GRANT (-) body edit DENIED BY THE GRANT (error, not zero rows) ───────────
  it("GRANT (-): receiver UPDATE of `body` on the other party's message → DENIED BY THE GRANT", async () => {
    // sellerA is a THREAD PARTY (RLS read_receipt USING would pass the row), so a
    // zero-row result would NOT prove the grant. The column GRANT (authenticated
    // may UPDATE is_read ONLY) rejects the statement outright → error 42501.
    const attempt = await sellerA.client
      .from("inquiry_messages")
      .update({ body: `HACKED ${RUN}` })
      .eq("id", buyerMsgId)
      .select("id");
    expect(attempt.error).not.toBeNull();
    expect(`${attempt.error?.code ?? ""} ${attempt.error?.message ?? ""}`).toMatch(
      /42501|permission denied/i,
    );

    // The body is unchanged (the write never landed).
    const { data: after } = await svc()
      .from("inquiry_messages")
      .select("body")
      .eq("id", buyerMsgId)
      .single();
    expect(after?.body).toBe(`س ${RUN}`);
  });

  it("GRANT (-): even the SENDER cannot edit their own message `body` (grant narrowed)", async () => {
    const attempt = await buyer.client
      .from("inquiry_messages")
      .update({ body: `edited ${RUN}` })
      .eq("id", buyerMsgId)
      .select("id");
    expect(attempt.error).not.toBeNull();
    expect(`${attempt.error?.code ?? ""} ${attempt.error?.message ?? ""}`).toMatch(
      /42501|permission denied/i,
    );
  });

  // ── SENDER (+) own is_read harmless ──────────────────────────────────────────
  it("SENDER (+): sender flipping own message's is_read is harmless (allowed, no error)", async () => {
    const upd = await buyer.client
      .from("inquiry_messages")
      .update({ is_read: true })
      .eq("id", buyerMsgId)
      .select("id, is_read");
    expect(upd.error).toBeNull();
    expect(upd.data?.[0]?.is_read).toBe(true);
  });

  // ── OUTSIDER (-) ─────────────────────────────────────────────────────────────
  it("OUTSIDER (-): unrelated seller markInquiryRead → not_found; direct is_read UPDATE → 0 rows", async () => {
    h.client = sellerB.client;
    expect(await markInquiryRead({ inquiryId })).toEqual({ ok: false, reason: "not_found" });

    const direct = await sellerB.client
      .from("inquiry_messages")
      .update({ is_read: false })
      .eq("id", buyerMsgId)
      .select("id");
    expect(direct.error).toBeNull(); // is_read is granted; RLS filters the row out
    expect(direct.data?.length ?? 0).toBe(0);
    expect(await isRead(buyerMsgId)).toBe(true); // unchanged by the outsider
  });

  // ── ANON (-) ─────────────────────────────────────────────────────────────────
  it("ANON (-): anon is_read UPDATE → 0 rows (no applicable policy)", async () => {
    const anon = anonClient();
    const res = await anon
      .from("inquiry_messages")
      .update({ is_read: false })
      .eq("id", buyerMsgId)
      .select("id");
    expect(res.data?.length ?? 0).toBe(0);
    expect(await isRead(buyerMsgId)).toBe(true); // unchanged
  });

  // ── DELETE (-) no path ───────────────────────────────────────────────────────
  it("DELETE (-): no DELETE policy — receiver/sender delete → 0 rows, row survives", async () => {
    const bySeller = await sellerA.client
      .from("inquiry_messages")
      .delete()
      .eq("id", buyerMsgId)
      .select("id");
    expect(bySeller.data?.length ?? 0).toBe(0);

    const byBuyer = await buyer.client
      .from("inquiry_messages")
      .delete()
      .eq("id", buyerMsgId)
      .select("id");
    expect(byBuyer.data?.length ?? 0).toBe(0);

    const { data: survives } = await svc()
      .from("inquiry_messages")
      .select("id")
      .eq("id", buyerMsgId);
    expect(survives?.length ?? 0).toBe(1);
  });

  // ── query wiring: unreadCount surfaces + zeroes after mark-read ──────────────
  it("getInquiryThread: unreadCount reflects the caller's unread; 0 after mark-read", async () => {
    // Fresh unread message from the seller → buyer sees unreadCount ≥ 1.
    const { data: fresh } = await svc()
      .from("inquiry_messages")
      .insert({ inquiry_id: inquiryId, sender_id: sellerA.id, sender_type: "seller", body: `جديد ${RUN}` })
      .select("id")
      .single();
    expect(fresh?.id).toBeTruthy();

    const beforeThread = await getInquiryThread(inquiryId, buyer.client);
    expect(beforeThread?.unreadCount).toBeGreaterThanOrEqual(1);

    h.client = buyer.client;
    await markInquiryRead({ inquiryId });

    const afterThread = await getInquiryThread(inquiryId, buyer.client);
    expect(afterThread?.unreadCount).toBe(0);
  });
});

/**
 * Phase 06 / T02 — messaging write layer (Server Actions + queries) integration.
 *
 * Runs against the STAGING Supabase project. Mints real GoTrue users, seeds
 * betk.users + seller_profiles + stores + a listing, signs each in for an
 * RLS-respecting authenticated client, and cleans every fixture (inquiries
 * deleted first — inquiry_messages cascade; then users cascade
 * seller_profiles→stores→listings). Zero residue.
 *
 * The Server Actions read their client via `@/lib/supabase/server` createClient,
 * mocked to return the current test's authenticated client (the T02-Phase-05
 * precedent) so requireActiveUser() + every write run as the minted actor;
 * getUserRowById-style service reads use the real service client.
 *
 * Proves (ADR-014 single-table create; DEC2=A metric; DEC3 REG-42 no mark-read;
 * DEC4 REG-43 derive-at-read):
 *   • createInquiry → single-table inquiries row (status 'open', opening on
 *     buyer_first_message); unreadable listing → listing_unavailable
 *   • getInquiryThread participant read; outsider/unknown/malformed → null (404)
 *   • both parties sendInquiryMessage; outsider send → not_found
 *   • seller FIRST reply flips open→replied (UI_SPEC L482) + updates
 *     avg_response_hours (DECISION 2 / Option A, own profile, no service-role)
 *   • REG-43 last_message_at NOT bumped; getOwnInquiries orders by derived
 *     latest activity → a BUYER's newest message re-sorts the thread to the top
 *   • confirmInquiry happy (→confirmed, converted_to_order_id stays NULL);
 *     buyer-cannot-confirm → not_found; idempotent re-confirm → already_confirmed
 *   • declineInquiry (UI_SPEC L481) happy + idempotent + confirm-on-declined
 *     invalid_state
 *   • cross-seller confirm/decline denied
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

import { createInquiry } from "@/features/messaging/actions/createInquiry";
import { sendInquiryMessage } from "@/features/messaging/actions/sendInquiryMessage";
import { confirmInquiry } from "@/features/messaging/actions/confirmInquiry";
import { declineInquiry } from "@/features/messaging/actions/declineInquiry";
import { getInquiryThread } from "@/features/messaging/queries/getInquiryThread";
import { getOwnInquiries } from "@/features/messaging/queries/getOwnInquiries";
import { getStoreInquiries } from "@/features/messaging/queries/getStoreInquiries";

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
const PASSWORD = `Betk_P6T02_${RUN}!`;
const EMAIL_PREFIX = "betk-p6t02-";

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
      slug: `p6t02-${label}-${RUN}`,
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

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("Phase 06 / T02 — messaging write layer (staging)", () => {
  let sellerA: Seller; // owns the listing/store the inquiries target
  let sellerB: Seller; // unrelated seller (outsider)
  let buyer: Buyer;
  let outsiderBuyer: Buyer;
  let categoryId: string;
  let listingA: string;

  // Inquiry ids reused across the ordered specs.
  let inquiry1: string;
  let inquiry2: string;
  let inquiry3: string;

  beforeAll(async () => {
    const ref = new URL(clientEnv.NEXT_PUBLIC_SUPABASE_URL).host.split(".")[0]!;
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(
        `[STAGING_GUARD] Refusing to run against project '${ref}'. ` +
          `Allowed: ${STAGING_ALLOWLIST.join(", ")}. Set RLS_ALLOW_PROJECT_REF to override.`,
      );
    }

    // Self-heal any residue from an interrupted run.
    const { data: stale } = await svc().from("stores").select("id, seller_id").like("slug", "p6t02-%");
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
    outsiderBuyer = await createBuyer("outsider");
    listingA = await seedListing(sellerA.storeId, categoryId);
  });

  afterAll(async () => {
    await svc().from("inquiries").delete().in("buyer_id", createdAuthIds);
    for (const id of createdAuthIds) {
      await svc().from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id).catch(() => undefined);
    }
  });

  // ── createInquiry ──────────────────────────────────────────────────────────
  it("createInquiry (buyer): single-table inquiries row, status 'open', opening on buyer_first_message", async () => {
    h.client = buyer.client;
    const res = await createInquiry({ listingId: listingA, message: `مرحبا ${RUN}`, quantity: 2 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    inquiry1 = res.inquiryId;

    const { data } = await svc()
      .from("inquiries")
      .select("buyer_id, store_id, listing_id, status, buyer_first_message, quantity, converted_to_order_id")
      .eq("id", inquiry1)
      .single();
    expect(data?.buyer_id).toBe(buyer.id);
    expect(data?.store_id).toBe(sellerA.storeId); // resolved server-side, not client-supplied
    expect(data?.listing_id).toBe(listingA);
    expect(data?.status).toBe("open");
    expect(data?.buyer_first_message).toBe(`مرحبا ${RUN}`);
    expect(data?.quantity).toBe(2);
    expect(data?.converted_to_order_id).toBeNull();

    // A second inquiry (created LATER) — used for the REG-43 ordering proof.
    const res2 = await createInquiry({ listingId: listingA, message: `تانية ${RUN}` });
    expect(res2.ok).toBe(true);
    if (res2.ok) inquiry2 = res2.inquiryId;
  });

  it("createInquiry (buyer): unreadable/unknown listing → listing_unavailable", async () => {
    h.client = buyer.client;
    const res = await createInquiry({ listingId: randomUUID(), message: "x" });
    expect(res).toEqual({ ok: false, reason: "listing_unavailable" });
  });

  // ── getInquiryThread scoping ────────────────────────────────────────────────
  it("getInquiryThread: participant reads it; outsider/unknown/malformed → null", async () => {
    const asBuyer = await getInquiryThread(inquiry1, buyer.client);
    expect(asBuyer?.id).toBe(inquiry1);
    expect(asBuyer?.buyerFirstMessage).toBe(`مرحبا ${RUN}`);
    expect(asBuyer?.messages.length).toBe(0); // valid empty-thread resting state (ADR-014)

    const asSeller = await getInquiryThread(inquiry1, sellerA.client);
    expect(asSeller?.id).toBe(inquiry1);

    expect(await getInquiryThread(inquiry1, outsiderBuyer.client)).toBeNull();
    expect(await getInquiryThread(inquiry1, sellerB.client)).toBeNull();
    expect(await getInquiryThread(randomUUID(), buyer.client)).toBeNull();
    expect(await getInquiryThread("not-a-uuid", buyer.client)).toBeNull();
  });

  // ── sendInquiryMessage both parties + outsider denied ───────────────────────
  it("sendInquiryMessage: buyer sends; seller FIRST reply flips open→replied + updates avg_response_hours", async () => {
    // last_message_at BEFORE any message (REG-43 baseline).
    const { data: before } = await svc()
      .from("inquiries")
      .select("last_message_at, created_at")
      .eq("id", inquiry1)
      .single();

    h.client = buyer.client;
    const b = await sendInquiryMessage({ inquiryId: inquiry1, body: `سؤال ${RUN}` });
    expect(b.ok).toBe(true);

    h.client = sellerA.client;
    const s = await sendInquiryMessage({ inquiryId: inquiry1, body: `رد ${RUN}` });
    expect(s.ok).toBe(true);

    // open→replied on the seller's first reply (UI_SPEC L482).
    const { data: after } = await svc()
      .from("inquiries")
      .select("status, last_message_at")
      .eq("id", inquiry1)
      .single();
    expect(after?.status).toBe("replied");

    // REG-43: last_message_at was NOT bumped by the messages (derive-at-read).
    expect(after?.last_message_at).toBe(before?.last_message_at);

    // DECISION 2 / Option A: the metric was recomputed on sellerA's OWN profile.
    const { data: sp } = await svc()
      .from("seller_profiles")
      .select("avg_response_hours")
      .eq("id", sellerA.id)
      .single();
    expect(sp?.avg_response_hours).not.toBeNull();
    expect(Number(sp?.avg_response_hours)).toBeGreaterThanOrEqual(0);
  });

  it("sendInquiryMessage: outsider (unrelated seller / unrelated buyer) → not_found", async () => {
    h.client = sellerB.client;
    expect(await sendInquiryMessage({ inquiryId: inquiry1, body: "evil" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    h.client = outsiderBuyer.client;
    expect(await sendInquiryMessage({ inquiryId: inquiry1, body: "evil" })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("getInquiryThread: both parties' messages present, ordered ASC", async () => {
    const thread = await getInquiryThread(inquiry1, buyer.client);
    expect(thread?.messages.map((m) => m.senderType)).toEqual(["buyer", "seller"]);
    const times = thread?.messages.map((m) => Date.parse(m.sentAt)) ?? [];
    expect(times[0]!).toBeLessThanOrEqual(times[1]!);
  });

  // ── REG-43 ordering proof (buyer's newest message sorts the thread to top) ───
  it("getOwnInquiries (buyer): a BUYER's newest message re-sorts the thread to the top (REG-43)", async () => {
    // Right now inquiry2 was created AFTER inquiry1, but inquiry1 has the newest
    // ACTIVITY (the seller reply above). Send a fresh BUYER message on inquiry1
    // to make its derived latest-activity unambiguously newest.
    h.client = buyer.client;
    await sendInquiryMessage({ inquiryId: inquiry1, body: `أحدث ${RUN}` });

    const list = await getOwnInquiries(buyer.client);
    const ids = list.map((i) => i.id);
    expect(ids).toContain(inquiry1);
    expect(ids).toContain(inquiry2);
    // inquiry1 (buyer's newest message) sorts before inquiry2.
    expect(ids.indexOf(inquiry1)).toBeLessThan(ids.indexOf(inquiry2));

    const row1 = list.find((i) => i.id === inquiry1)!;
    expect(row1.lastMessagePreview).toBe(`أحدث ${RUN}`);
    expect(row1.store?.id).toBe(sellerA.storeId); // buyer reads the active store
    expect(row1.buyerId).toBeNull(); // buyer-side rows don't carry buyerId
  });

  // ── getStoreInquiries (seller, status filter) ───────────────────────────────
  it("getStoreInquiries (seller): lists own-store inquiries with buyerId; status filter works; buyer name omitted (REG-44)", async () => {
    const all = await getStoreInquiries({}, sellerA.client);
    expect(all.map((i) => i.id)).toEqual(expect.arrayContaining([inquiry1, inquiry2]));
    const row1 = all.find((i) => i.id === inquiry1)!;
    expect(row1.buyerId).toBe(buyer.id); // REG-44: id only, no display name
    expect(row1.store).toBeNull();

    const replied = await getStoreInquiries({ status: "replied" }, sellerA.client);
    expect(replied.map((i) => i.id)).toContain(inquiry1);
    expect(replied.map((i) => i.id)).not.toContain(inquiry2); // inquiry2 is still 'open'

    // Cross-seller isolation: sellerB sees none of sellerA's inquiries.
    expect(await getStoreInquiries({}, sellerB.client)).toEqual([]);
  });

  // ── confirmInquiry ──────────────────────────────────────────────────────────
  it("confirmInquiry (seller): happy → confirmed, converted_to_order_id stays NULL", async () => {
    h.client = sellerA.client;
    const res = await confirmInquiry({ inquiryId: inquiry1 });
    expect(res).toEqual({ ok: true, alreadyConfirmed: false });

    const { data } = await svc()
      .from("inquiries")
      .select("status, converted_to_order_id")
      .eq("id", inquiry1)
      .single();
    expect(data?.status).toBe("confirmed");
    expect(data?.converted_to_order_id).toBeNull(); // Phase-07 owns this write
  });

  it("confirmInquiry: buyer cannot confirm → not_found (status unchanged)", async () => {
    h.client = buyer.client;
    expect(await confirmInquiry({ inquiryId: inquiry2 })).toEqual({
      ok: false,
      reason: "not_found",
    });
    const { data } = await svc().from("inquiries").select("status").eq("id", inquiry2).single();
    expect(data?.status).toBe("open"); // untouched by the buyer's attempt
  });

  it("confirmInquiry: idempotent re-confirm → already_confirmed", async () => {
    h.client = sellerA.client;
    expect(await confirmInquiry({ inquiryId: inquiry1 })).toEqual({
      ok: true,
      alreadyConfirmed: true,
    });
  });

  it("confirmInquiry: cross-seller → not_found", async () => {
    h.client = sellerB.client;
    expect(await confirmInquiry({ inquiryId: inquiry1 })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  // ── declineInquiry ──────────────────────────────────────────────────────────
  it("declineInquiry (seller): happy + idempotent; confirm-on-declined → invalid_state", async () => {
    // Fresh inquiry for the decline path.
    h.client = buyer.client;
    const created = await createInquiry({ listingId: listingA, message: `تالتة ${RUN}` });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    inquiry3 = created.inquiryId;

    h.client = sellerA.client;
    expect(await declineInquiry({ inquiryId: inquiry3 })).toEqual({
      ok: true,
      alreadyDeclined: false,
    });
    const { data } = await svc().from("inquiries").select("status").eq("id", inquiry3).single();
    expect(data?.status).toBe("declined");

    // Idempotent.
    expect(await declineInquiry({ inquiryId: inquiry3 })).toEqual({
      ok: true,
      alreadyDeclined: true,
    });

    // Confirm on a terminal (declined) inquiry → invalid_state.
    expect(await confirmInquiry({ inquiryId: inquiry3 })).toEqual({
      ok: false,
      reason: "invalid_state",
    });
  });

  it("declineInquiry: cross-seller → not_found", async () => {
    h.client = sellerB.client;
    expect(await declineInquiry({ inquiryId: inquiry2 })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

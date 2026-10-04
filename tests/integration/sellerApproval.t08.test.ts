/**
 * P09 T08 evidence against staging.
 *
 * Incomplete applications are refused. A non-admin cannot approve.
 * An admin approval is what lets a later food publish pass the trigger.
 * moderation_logs is append-only (`no_delete_mod_log` is DO INSTEAD NOTHING).
 * DELETE of the fixture log is a no-op while that rule is enabled, and the
 * admin user then cannot be removed. This file runs only when
 * BETK_ALLOW_MODLOG_CLEANUP=1, after that rule has been disabled for the
 * cleanup and will be re-enabled afterwards. The 2026-10-04 run did that.
 */

import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import type { ListingRefusalCode } from "@/features/listings/publishRefusal";

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { submitSellerApplication } from "@/features/seller-onboarding/actions/submitSellerApplication";
import { createListing } from "@/features/listings/actions/createListing";
import { publishListing } from "@/features/listings/actions/publishListing";
import { approveSellerApplication, rejectSellerApplication } from "@/features/seller-approval/actions/approveSellerApplication";
import { loadApprovalDetail } from "@/features/seller-approval/queries/approvalQueue";
import { SIGNED_URL_EXPIRY_SECONDS } from "@/features/seller-approval/docUrl";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_T08_${RUN}!`;
const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET ?? "docs";
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Db = SupabaseClient<Database, "betk">;
type Service = ReturnType<typeof createServiceClient>;

const createdAuthIds: string[] = [];
const uploadedPaths: string[] = [];
let phoneCounter = 0;
let slugCounter = 0;

function makePhone() {
  const base = parseInt(RUN.slice(0, 6), 16) % 100000000;
  const n = (base + phoneCounter++) % 100000000;
  return `+2016${n.toString().padStart(8, "0")}`;
}

function makeSlug() {
  return `t08-${RUN}-${slugCounter++}`;
}

function userClient(): Db {
  return createSupabaseClient<Database, "betk">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "betk" }, auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function residue(service: Service) {
  const names = [
    "seller_orders",
    "master_orders",
    "order_status_history",
    "payouts",
    "seller_profiles",
    "stores",
    "seller_documents",
    "agreement_acceptances",
    "moderation_logs",
  ] as const;
  const counts: Record<string, number | null> = {};
  for (const name of names) {
    const { count, error } = await service.schema("betk").from(name).select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    counts[name] = count;
  }
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);
  const betkTest = (data.users ?? []).filter((user) => user.email?.endsWith("@betk.test")).length;
  return { ...counts, betkTest };
}

async function createUser(service: Service, label: string, role: "buyer" | "seller" | "admin" = "buyer") {
  const email = `betk-t08-${label}-${RUN}@betk.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`);
  const id = data.user.id;
  createdAuthIds.push(id);
  const { error: insertError } = await service.schema("betk").from("users").insert({
    id,
    phone_number: makePhone(),
    auth_provider: "phone",
    role,
    status: "active",
  });
  if (insertError) throw new Error(`users ${label}: ${insertError.message}`);
  const client = userClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw new Error(`signIn ${label}: ${signInError.message}`);
  return { id, client, email };
}

function assertRefusal(result: { ok: boolean; reason?: string; code?: string }, code: ListingRefusalCode) {
  expect(result).toEqual({ ok: false, reason: "refused", code });
}

const describeOrSkip = HAS_CREDS && process.env.BETK_ALLOW_MODLOG_CLEANUP === "1" ? describe : describe.skip;

describeOrSkip("P09 T08 — seller approval (staging)", () => {
  let service: Service;
  let before: Awaited<ReturnType<typeof residue>>;
  let admin: Awaited<ReturnType<typeof createUser>>;
  let buyer: Awaited<ReturnType<typeof createUser>>;
  let incomplete: Awaited<ReturnType<typeof createUser>>;
  let seller: Awaited<ReturnType<typeof createUser>>;
  let foodId = "";
  let incompleteStoreId = "";

  beforeAll(async () => {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0] ?? "";
    if (!STAGING_ALLOWLIST.includes(ref)) throw new Error(`[STAGING_GUARD] Refusing project '${ref}'.`);
    service = createServiceClient();
    before = await residue(service);
    console.log("[t08 residue before]", JSON.stringify(before));

    const food = await service.schema("betk").from("categories").select("id").eq("slug", "food-beverages").limit(1);
    if (food.error || !food.data?.[0]) throw new Error(food.error?.message ?? "food-beverages missing");
    foodId = food.data[0].id;

    admin = await createUser(service, "admin", "admin");
    buyer = await createUser(service, "buyer");
    incomplete = await createUser(service, "incomplete", "seller");
    const profile = await service.schema("betk").from("seller_profiles").insert({
      id: incomplete.id,
      status: "pending",
    });
    if (profile.error) throw new Error(profile.error.message);
    const store = await service.schema("betk").from("stores").insert({
      seller_id: incomplete.id,
      name_ar: "ناقص",
      slug: makeSlug(),
      category_primary: "food-beverages",
      governorate: "cairo",
      status: "pending",
    }).select("id").single();
    if (store.error || !store.data) throw new Error(store.error?.message ?? "store");
    incompleteStoreId = store.data.id;

    seller = await createUser(service, "seller");
    h.client = seller.client;
    const submitted = await submitSellerApplication({
      nameAr: "متجر",
      slug: makeSlug(),
      categoryIds: [foodId],
      governorate: "cairo",
      pickup: { city: "Nasr", streetAddress: "8 Street" },
      sellerAgreementAccepted: true,
      docFrontPath: `${seller.id}/front.png`,
      docBackPath: `${seller.id}/back.png`,
      food: {
        packagingPath: `${seller.id}/pack.png`,
        labelPath: `${seller.id}/label.png`,
        expiryPath: `${seller.id}/expiry.png`,
        socialUrl: "https://example.invalid/t08",
      },
    });
    if (!submitted.ok) throw new Error(`submit ${submitted.reason}`);
    for (const name of ["front.png", "back.png", "pack.png", "label.png", "expiry.png"]) {
      const path = `${seller.id}/${name}`;
      const uploaded = await seller.client.storage.from(DOCS_BUCKET).upload(path, TINY_PNG, {
        contentType: "image/png",
        upsert: true,
      });
      if (uploaded.error) throw new Error(uploaded.error.message);
      uploadedPaths.push(path);
    }
  }, 120_000);

  afterAll(async () => {
    if (!service) return;
    const stores = await service.schema("betk").from("stores").select("id").in("seller_id", createdAuthIds);
    const storeIds = (stores.data ?? []).map((row) => row.id);
    if (storeIds.length > 0) {
      const listings = await service.schema("betk").from("listings").select("id").in("store_id", storeIds);
      const listingIds = (listings.data ?? []).map((row) => row.id);
      if (listingIds.length > 0) {
        await service.schema("betk").from("listing_images").delete().in("listing_id", listingIds);
        await service.schema("betk").from("listings").delete().in("id", listingIds);
      }
    }
    if (uploadedPaths.length > 0) await service.storage.from(DOCS_BUCKET).remove(uploadedPaths);

    const logs = await service.schema("betk").from("moderation_logs").select("id").eq("admin_id", admin?.id ?? "");
    const logIds = (logs.data ?? []).map((row) => row.id);
    if (logIds.length > 0) {
      const removed = await service.schema("betk").from("moderation_logs").delete().in("id", logIds).select("id");
      if (removed.error || (removed.data ?? []).length !== logIds.length) {
        throw new Error(
          "no_delete_mod_log blocked fixture cleanup. The @betk.test admin is still referenced.",
        );
      }
    }

    for (const id of createdAuthIds) {
      await service.schema("betk").from("agreement_acceptances").delete().eq("user_id", id);
      await service.schema("betk").from("seller_documents").delete().eq("seller_id", id);
      await service.schema("betk").from("store_categories").delete().in("store_id", storeIds);
      await service.schema("betk").from("store_pickup_addresses").delete().in("store_id", storeIds);
      await service.schema("betk").from("stores").delete().eq("seller_id", id);
      await service.schema("betk").from("seller_profiles").delete().eq("id", id);
      await service.schema("betk").from("users").delete().eq("id", id);
      const authDelete = await service.auth.admin.deleteUser(id);
      if (authDelete.error) throw new Error(authDelete.error.message);
    }

    const after = await residue(service);
    console.log("[t08 residue after]", JSON.stringify(after));
    expect(after).toEqual(before);
  }, 120_000);

  it("a non-admin cannot approve", async () => {
    h.client = buyer.client;
    const result = await approveSellerApplication({ sellerId: incomplete.id });
    expect(result).toEqual({ ok: false, reason: "forbidden" });
    const row = await service.schema("betk").from("seller_profiles").select("status, approved_at").eq("id", incomplete.id).single();
    expect(row.data).toMatchObject({ status: "pending", approved_at: null });
  });

  it("an incomplete application is refused until every piece exists", async () => {
    h.client = admin.client;
    expect(await approveSellerApplication({ sellerId: incomplete.id })).toEqual({
      ok: false,
      reason: "incomplete",
      missing: "categories",
    });

    const category = await service.schema("betk").from("store_categories").insert({
      store_id: incompleteStoreId,
      category_id: foodId,
    });
    expect(category.error).toBeNull();
    expect(await approveSellerApplication({ sellerId: incomplete.id })).toEqual({
      ok: false,
      reason: "incomplete",
      missing: "pickup",
    });

    const pickup = await service.schema("betk").from("store_pickup_addresses").insert({
      store_id: incompleteStoreId,
      governorate: "cairo",
      city: "Nasr",
      street_address: "1 Street",
    });
    expect(pickup.error).toBeNull();
    expect(await approveSellerApplication({ sellerId: incomplete.id })).toEqual({
      ok: false,
      reason: "incomplete",
      missing: "agreement",
    });

    const version = await admin.client.rpc("checkout_agreement_version", {
      p_key: "agreement_seller_agreement_version",
    });
    expect(version.data).toBeTruthy();
    const acceptance = await service.schema("betk").from("agreement_acceptances").insert({
      user_id: incomplete.id,
      document: "seller_agreement",
      version_label: version.data!,
      status: "accepted",
    });
    expect(acceptance.error).toBeNull();
    expect(await approveSellerApplication({ sellerId: incomplete.id })).toEqual({
      ok: false,
      reason: "incomplete",
      missing: "food_documents",
    });

    const still = await service.schema("betk").from("seller_profiles").select("status, approved_at").eq("id", incomplete.id).single();
    expect(still.data).toMatchObject({ status: "pending", approved_at: null });
  }, 60_000);

  it("admin reject writes the reason and does not approve", async () => {
    h.client = admin.client;
    const result = await rejectSellerApplication({ sellerId: incomplete.id, reason: "ناقص" });
    expect(result).toEqual({ ok: true });
    const row = await service.schema("betk").from("seller_profiles").select("status, approved_at, rejected_reason").eq("id", incomplete.id).single();
    expect(row.data).toMatchObject({ status: "pending", approved_at: null, rejected_reason: "ناقص" });
    const categories = await service.schema("betk").from("store_categories").select("approved_at").eq("store_id", incompleteStoreId);
    expect(categories.data?.every((item) => item.approved_at === null)).toBe(true);
  });

  it("admin approval is what lets a food publish pass", async () => {
    const paid = await service
      .schema("betk")
      .from("stores")
      .update({ payment_methods: { instapay_handle: "t08" } })
      .eq("seller_id", seller.id);
    expect(paid.error).toBeNull();

    h.client = seller.client;
    const created = await createListing({
      type: "product",
      titleAr: "غذاء",
      titleEn: `Food ${RUN}`,
      categoryId: foodId,
      priceType: "fixed",
      price: 100,
      prepDays: 1,
      weightG: 1,
      lengthMm: 1,
      widthMm: 1,
      heightMm: 1,
      stockQty: 4,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const image = await seller.client.from("listing_images").insert({
      listing_id: created.listingId,
      url: "https://example.invalid/t08.png",
      sort_order: 0,
    });
    expect(image.error).toBeNull();

    const blocked = await publishListing({ listingId: created.listingId });
    assertRefusal(blocked, "BETK_CATEGORY_NOT_APPROVED");

    h.client = admin.client;
    const detail = await loadApprovalDetail(admin.client as never, admin.id, seller.id);
    expect(detail).not.toBeNull();
    expect(detail).not.toBe("missing");
    if (detail && detail !== "missing") {
      const social = detail.documents.find((doc) => doc.documentType === "food_social_url");
      expect(social?.socialUrl).toBe("https://example.invalid/t08");
      expect(social?.signedUrl).toBeNull();
      const pack = detail.documents.find((doc) => doc.documentType === "food_packaging");
      expect(pack?.signError).toBe(false);
      expect(pack?.signedUrl).toBeTruthy();
    }

    const approved = await approveSellerApplication({ sellerId: seller.id });
    expect(approved).toEqual({ ok: true });

    const profile = await service.schema("betk").from("seller_profiles").select("status, approved_at").eq("id", seller.id).single();
    expect(profile.data?.status).toBe("active");
    expect(profile.data?.approved_at).toBeTruthy();
    const docs = await service.schema("betk").from("seller_documents").select("document_type, review_status, reviewed_at").eq("seller_id", seller.id);
    expect((docs.data ?? []).length).toBeGreaterThan(0);
    expect((docs.data ?? []).every((row) => row.review_status === "approved" && row.reviewed_at !== null)).toBe(true);
    const categories = await service
      .schema("betk")
      .from("store_categories")
      .select("approved_at")
      .eq("store_id", (await service.schema("betk").from("stores").select("id").eq("seller_id", seller.id).single()).data!.id);
    expect(categories.data?.every((row) => row.approved_at !== null)).toBe(true);
    const store = await service.schema("betk").from("stores").select("status").eq("seller_id", seller.id).single();
    expect(store.data?.status).toBe("active");
    const log = await service
      .schema("betk")
      .from("moderation_logs")
      .select("action, target_type, admin_id")
      .eq("target_id", seller.id)
      .eq("action", "approve_seller")
      .single();
    expect(log.data).toMatchObject({ action: "approve_seller", target_type: "seller", admin_id: admin.id });

    h.client = seller.client;
    const published = await publishListing({ listingId: created.listingId });
    expect(published).toEqual({ ok: true });

    const stranger = await buyer.client.storage.from(DOCS_BUCKET).createSignedUrl(`${seller.id}/pack.png`, SIGNED_URL_EXPIRY_SECONDS);
    expect(stranger.error).not.toBeNull();
  }, 60_000);
});

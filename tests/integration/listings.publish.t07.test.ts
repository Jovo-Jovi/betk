/**
 * P09 T07 evidence against staging.
 *
 * The publish trigger and the shipping check are the refusals. The form
 * checklist is not. Paths are synthetic. This file does not print credentials.
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

import type { CreateListingInput } from "@/validations/listings";
import { createListing } from "@/features/listings/actions/createListing";
import { publishListing } from "@/features/listings/actions/publishListing";
import { setListingSoldOut } from "@/features/listings/actions/setListingSoldOut";
import { updateListing } from "@/features/listings/actions/updateListing";
import { updateStock } from "@/features/listings/actions/updateStock";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_T07_${RUN}!`;

type Db = SupabaseClient<Database, "betk">;
type Service = ReturnType<typeof createServiceClient>;

const createdAuthIds: string[] = [];

function userClient(): Db {
  return createSupabaseClient<Database, "betk">(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: "betk" }, auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function residue(service: Service) {
  const names = ["seller_orders", "master_orders", "order_status_history", "payouts", "agreement_acceptances"] as const;
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

function assertRefusal(
  result: { ok: boolean; reason?: string; code?: string },
  code: ListingRefusalCode,
) {
  expect(result).toEqual({ ok: false, reason: "refused", code });
  expect(JSON.stringify(result).includes("violates check")).toBe(false);
  expect(JSON.stringify(result).includes("new row for relation")).toBe(false);
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("P09 T07 — catalogue publish refusals (staging)", () => {
  let service: Service;
  let sellerId = "";
  let storeId = "";
  let client: Db;
  let approvedId = "";
  let unapprovedId = "";
  let foodId = "";
  let prepOver = 0;
  let priceOver = 0;
  let beforeResidue: Record<string, number | null> | null = null;

  beforeAll(async () => {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0] ?? "";
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(`[STAGING_GUARD] Refusing project '${ref}'.`);
    }
    service = createServiceClient();
    beforeResidue = await residue(service);
    console.log("[t07 residue before]", JSON.stringify(beforeResidue));

    const settings = await service
      .schema("betk")
      .from("admin_settings")
      .select("key, value")
      .in("key", ["price_band_min_egp", "price_band_max_egp", "prep_cap_days"]);
    if (settings.error) throw new Error(settings.error.message);
    const byKey = new Map((settings.data ?? []).map((row) => [row.key, row.value]));
    if (byKey.get("price_band_min_egp") !== "1" || byKey.get("price_band_max_egp") !== "1000000") {
      throw new Error("staging price band is not the T01 placeholder");
    }
    const cap = Number(byKey.get("prep_cap_days"));
    if (!Number.isInteger(cap) || cap < 1) throw new Error("prep cap is not a positive integer");
    prepOver = cap + 1;
    priceOver = 1000001;

    const email = `betk-t07-seller-${RUN}@betk.test`;
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(error?.message ?? "createUser");
    sellerId = data.user.id;
    createdAuthIds.push(sellerId);
    const phone = `+2016${(parseInt(RUN.slice(0, 6), 16) % 100000000).toString().padStart(8, "0")}`;
    const userInsert = await service.schema("betk").from("users").insert({
      id: sellerId,
      phone_number: phone,
      auth_provider: "phone",
      role: "seller",
      status: "active",
    });
    if (userInsert.error) throw new Error(userInsert.error.message);
    const profile = await service.schema("betk").from("seller_profiles").insert({
      id: sellerId,
      status: "active",
    });
    if (profile.error) throw new Error(profile.error.message);
    const store = await service
      .schema("betk")
      .from("stores")
      .insert({
        seller_id: sellerId,
        name_ar: "متجر",
        slug: `t07-${RUN}`,
        category_primary: "handmade",
        governorate: "cairo",
        status: "active",
        payment_methods: { instapay_handle: "t07" },
      })
      .select("id")
      .single();
    if (store.error || !store.data) throw new Error(store.error?.message ?? "store");
    storeId = store.data.id;

    const categories = await service
      .schema("betk")
      .from("categories")
      .select("id, slug, parent_id")
      .eq("is_active", true);
    if (categories.error) throw new Error(categories.error.message);
    const rows = categories.data ?? [];
    const food = rows.find((row) => row.slug === "food-beverages");
    if (!food) throw new Error("food-beverages category is missing");
    foodId = food.id;
    const nonFood = rows.filter(
      (row) => row.slug !== "food-beverages" && row.parent_id !== food.id,
    );
    if (nonFood.length < 2) throw new Error("need two non-food categories");
    approvedId = nonFood[0]!.id;
    unapprovedId = nonFood[1]!.id;

    async function approve(categoryId: string) {
      const inserted = await service.schema("betk").from("store_categories").insert({
        store_id: storeId,
        category_id: categoryId,
      });
      if (inserted.error) throw new Error(inserted.error.message);
      const updated = await service
        .schema("betk")
        .from("store_categories")
        .update({ approved_at: new Date().toISOString() })
        .eq("store_id", storeId)
        .eq("category_id", categoryId)
        .select("approved_at")
        .single();
      if (updated.error || !updated.data?.approved_at) {
        throw new Error(updated.error?.message ?? "approved_at stayed null");
      }
    }

    await approve(approvedId);
    await approve(foodId);
    const pending = await service.schema("betk").from("store_categories").insert({
      store_id: storeId,
      category_id: unapprovedId,
    });
    if (pending.error) throw new Error(pending.error.message);

    const docs = await service.schema("betk").from("seller_documents").insert([
      { seller_id: sellerId, document_type: "food_packaging", storage_path: `${sellerId}/pack.png`, review_status: "pending" },
      { seller_id: sellerId, document_type: "food_label", storage_path: `${sellerId}/label.png`, review_status: "pending" },
      { seller_id: sellerId, document_type: "food_expiry", storage_path: `${sellerId}/expiry.png`, review_status: "pending" },
      { seller_id: sellerId, document_type: "food_social_url", storage_path: `${sellerId}/social.txt`, review_status: "pending" },
    ]);
    if (docs.error) throw new Error(docs.error.message);

    client = userClient();
    const signed = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (signed.error) throw new Error(signed.error.message);
    h.client = client;
  });

  afterAll(async () => {
    const failures: string[] = [];
    function note(label: string, error: { message?: string; code?: string } | null) {
      if (error) failures.push(`${label}: ${error.code ?? ""} ${error.message ?? ""}`.trim());
    }
    if (storeId) {
      note("listings", (await service.schema("betk").from("listings").delete().eq("store_id", storeId)).error);
      note(
        "store_categories",
        (await service.schema("betk").from("store_categories").delete().eq("store_id", storeId)).error,
      );
      const left = await service
        .schema("betk")
        .from("store_categories")
        .select("category_id")
        .eq("store_id", storeId);
      note("store_categories read", left.error);
      if (!left.error && (left.data?.length ?? 0) !== 0) failures.push("store_categories residue");
      note("stores", (await service.schema("betk").from("stores").delete().eq("id", storeId)).error);
    }
    if (sellerId) {
      note(
        "seller_documents",
        (await service.schema("betk").from("seller_documents").delete().eq("seller_id", sellerId)).error,
      );
      note(
        "seller_profiles",
        (await service.schema("betk").from("seller_profiles").delete().eq("id", sellerId)).error,
      );
      note("users", (await service.schema("betk").from("users").delete().eq("id", sellerId)).error);
      const authDelete = await service.auth.admin.deleteUser(sellerId);
      note("auth", authDelete.error);
    }
    if (service && beforeResidue) {
      const after = await residue(service);
      console.log("[t07 residue after]", JSON.stringify(after));
      if (JSON.stringify(after) !== JSON.stringify(beforeResidue)) {
        failures.push("residue changed");
      }
    }
    if (failures.length > 0) throw new Error(failures.join("; "));
  });

  async function draft(overrides: Partial<CreateListingInput> = {}) {
    h.client = client;
    const created = await createListing({
      type: "product",
      titleAr: "منتج",
      titleEn: `Product ${RUN}`,
      categoryId: approvedId,
      priceType: "fixed",
      price: 100,
      prepDays: 1,
      weightG: 1,
      lengthMm: 1,
      widthMm: 1,
      heightMm: 1,
      stockQty: 4,
      ...overrides,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("draft failed");
    const image = await client.from("listing_images").insert({
      listing_id: created.listingId,
      url: "https://example.invalid/t07.png",
      sort_order: 0,
    });
    expect(image.error).toBeNull();
    return created.listingId;
  }

  it("a draft without shipping stays a draft", async () => {
    const id = await draft({ weightG: null, lengthMm: null, widthMm: null, heightMm: null, prepDays: null });
    const row = await service
      .schema("betk")
      .from("listings")
      .select("status, weight_g")
      .eq("id", id)
      .single();
    expect(row.data?.status).toBe("draft");
    expect(row.data?.weight_g).toBeNull();
  });

  it("publishing a service is BETK_LISTING_TYPE", async () => {
    const id = await draft({ type: "service" });
    const published = await publishListing({ listingId: id });
    assertRefusal(published, "BETK_LISTING_TYPE");
  });

  it("publishing without a shipping dimension is the shipping check", async () => {
    const id = await draft({ weightG: null });
    const published = await publishListing({ listingId: id });
    assertRefusal(published, "SHIPPING");
  });

  it("publishing an unapproved category is BETK_CATEGORY_NOT_APPROVED", async () => {
    const id = await draft({ categoryId: unapprovedId });
    const published = await publishListing({ listingId: id });
    assertRefusal(published, "BETK_CATEGORY_NOT_APPROVED");
  });

  it("prep above the cap is BETK_PREP_CAP", async () => {
    const id = await draft({ prepDays: prepOver });
    const published = await publishListing({ listingId: id });
    assertRefusal(published, "BETK_PREP_CAP");
  });

  it("a price outside the band is BETK_PRICE_BAND", async () => {
    const id = await draft({ price: priceOver });
    const published = await publishListing({ listingId: id });
    assertRefusal(published, "BETK_PRICE_BAND");
  });

  it("a food category with pending food documents is BETK_FOOD_APPROVAL_REQUIRED", async () => {
    const id = await draft({ categoryId: foodId });
    const published = await publishListing({ listingId: id });
    assertRefusal(published, "BETK_FOOD_APPROVAL_REQUIRED");
  });

  it("a valid product publishes, and F-P1 allows stock and sold_out but not a price outside the band", async () => {
    const id = await draft({});
    const published = await publishListing({ listingId: id });
    expect(published).toEqual({ ok: true });

    const stock = await updateStock({ listingId: id, stockQty: 9 });
    expect(stock).toEqual({ ok: true, restocked: false });
    const afterStock = await service.schema("betk").from("listings").select("status, stock_qty").eq("id", id).single();
    expect(afterStock.data).toMatchObject({ status: "active", stock_qty: 9 });

    const marked = await setListingSoldOut({ listingId: id, soldOut: true });
    expect(marked).toEqual({ ok: true });
    const sold = await service.schema("betk").from("listings").select("status").eq("id", id).single();
    expect(sold.data?.status).toBe("sold_out");

    const restored = await setListingSoldOut({ listingId: id, soldOut: false });
    expect(restored).toEqual({ ok: true });
    const active = await service.schema("betk").from("listings").select("status, price").eq("id", id).single();
    expect(active.data?.status).toBe("active");

    const priced = await updateListing({
      listingId: id,
      type: "product",
      titleAr: "منتج",
      titleEn: `Product ${RUN}`,
      categoryId: approvedId,
      priceType: "fixed",
      price: priceOver,
      prepDays: 1,
      weightG: 1,
      lengthMm: 1,
      widthMm: 1,
      heightMm: 1,
      stockQty: 9,
    });
    assertRefusal(priced, "BETK_PRICE_BAND");
    const unchanged = await service.schema("betk").from("listings").select("price, status").eq("id", id).single();
    expect(unchanged.data?.status).toBe("active");
    expect(Number(unchanged.data?.price)).toBe(100);
  });
});

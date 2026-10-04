/**
 * P09 T06 evidence against staging.
 *
 * AC-AGR-3, REG-65, the store-category cap, approved_at, the pickup
 * governorate trigger, and the food-document read boundary. Paths and the
 * social URL are synthetic. This file does not print file bytes.
 */

import { randomUUID } from "node:crypto";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/lib/supabase/types";

const h = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => h.client,
}));

import { submitSellerApplication } from "@/features/seller-onboarding/actions/submitSellerApplication";

const HAS_CREDS =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  !!process.env.SUPABASE_SERVICE_KEY;

const STAGING_ALLOWLIST = (process.env.RLS_ALLOW_PROJECT_REF ?? "sojmjvohiziapiwkzsjg")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const RUN = randomUUID().slice(0, 8);
const PASSWORD = `Betk_T06_${RUN}!`;
const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET ?? "docs";
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Db = SupabaseClient<Database, "betk">;
type Service = ReturnType<typeof createServiceClient>;

const createdAuthIds: string[] = [];
let phoneCounter = 0;
let slugCounter = 0;

function makePhone() {
  const base = parseInt(RUN.slice(0, 6), 16) % 100000000;
  const n = (base + phoneCounter++) % 100000000;
  return `+2015${n.toString().padStart(8, "0")}`;
}

function makeSlug() {
  return `t06-${RUN}-${slugCounter++}`;
}

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

async function createUser(service: Service, label: string, role: "buyer" | "seller" | "admin" = "buyer") {
  const email = `betk-t06-${label}-${RUN}@betk.test`;
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
  return { id, client };
}

function rpcArgs(uid: string, slug: string, categorySlug: string, delivery: Json) {
  return {
    p_name_ar: "متجر",
    p_name_en: null,
    p_bio_ar: null,
    p_slug: slug,
    p_category_primary: categorySlug,
    p_category_secondary: null,
    p_governorate: "cairo",
    p_city: null,
    p_payment_methods: {},
    p_delivery_options: delivery,
    p_return_policy: null,
    p_min_order_egp: null,
    p_doc_front_path: `${uid}/front.png`,
    p_doc_back_path: `${uid}/back.png`,
  } as unknown as Database["betk"]["Functions"]["submit_seller_application"]["Args"];
}

const describeOrSkip = HAS_CREDS ? describe : describe.skip;

describeOrSkip("P09 T06 — onboarding refusals (staging)", () => {
  let service: Service;
  let before: Awaited<ReturnType<typeof residue>>;

  beforeAll(async () => {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0] ?? "";
    if (!STAGING_ALLOWLIST.includes(ref)) {
      throw new Error(`[STAGING_GUARD] Refusing project '${ref}'.`);
    }
    service = createServiceClient();
    before = await residue(service);
    console.log("[t06 residue before]", JSON.stringify(before));
  });

  afterAll(async () => {
    for (const id of createdAuthIds) {
      await service.schema("betk").from("agreement_acceptances").delete().eq("user_id", id);
      await service.schema("betk").from("users").delete().eq("id", id);
      await service.auth.admin.deleteUser(id);
    }
    const after = await residue(service);
    console.log("[t06 residue after]", JSON.stringify(after));
  });

  it("AC-AGR-3 and REG-65: missing acceptance refuses; a sent fee is stored as {}", async () => {
    const seller = await createUser(service, "rpc");
    const beforeStores = await service
      .schema("betk")
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", seller.id);
    expect(beforeStores.count ?? 0).toBe(0);

    const refused = await seller.client.rpc(
      "submit_seller_application",
      rpcArgs(seller.id, makeSlug(), "handmade", { modes: ["delivery"], delivery_fee_egp: 40 }),
    );
    expect(refused.error?.message ?? "").toContain("BETK_SELLER_AGREEMENT_REQUIRED");
    const stillNone = await service
      .schema("betk")
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("seller_id", seller.id);
    expect(stillNone.count ?? 0).toBe(0);

    const version = await seller.client.rpc("checkout_agreement_version", {
      p_key: "agreement_seller_agreement_version",
    });
    expect(version.data).toBe("STAGING-DRAFT-1");
    const { error: acceptError } = await seller.client.from("agreement_acceptances").insert({
      user_id: seller.id,
      document: "seller_agreement",
      version_label: version.data!,
    });
    expect(acceptError).toBeNull();

    const accepted = await seller.client.rpc(
      "submit_seller_application",
      rpcArgs(seller.id, makeSlug(), "handmade", { modes: ["remote"], delivery_fee_egp: 75 }),
    );
    expect(accepted.error).toBeNull();

    const { data: store } = await service
      .schema("betk")
      .from("stores")
      .select("id, delivery_options, governorate")
      .eq("seller_id", seller.id)
      .single();
    expect(store?.delivery_options).toEqual({});

    const limitRow = await service
      .schema("betk")
      .from("admin_settings")
      .select("value")
      .eq("key", "seller_category_limit")
      .single();
    expect(limitRow.data?.value).toBe("3");

    const { data: categories } = await service
      .schema("betk")
      .from("categories")
      .select("id, slug, parent_id")
      .eq("is_active", true);
    const food = (categories ?? []).find((row) => row.slug === "food-beverages");
    if (!food) throw new Error("food-beverages category is missing");
    const others = (categories ?? []).filter((row) => row.slug !== "food-beverages").slice(0, 3);
    if (others.length < 3) throw new Error("need three more categories for the cap");

    const stamped = await seller.client.from("store_categories").insert({
      store_id: store!.id,
      category_id: others[0]!.id,
      approved_at: new Date().toISOString(),
    });
    expect(stamped.error).toBeNull();
    const { data: stampedRow } = await service
      .schema("betk")
      .from("store_categories")
      .select("approved_at")
      .eq("store_id", store!.id)
      .eq("category_id", others[0]!.id)
      .single();
    expect(stampedRow?.approved_at).toBeNull();

    for (const category of others.slice(1)) {
      const inserted = await seller.client.from("store_categories").insert({
        store_id: store!.id,
        category_id: category.id,
      });
      expect(inserted.error).toBeNull();
    }
    const fourth = await seller.client.from("store_categories").insert({
      store_id: store!.id,
      category_id: food.id,
    });
    expect(fourth.error?.message ?? "").toContain("BETK_STORE_CATEGORY_CAP");

    const mismatch = await seller.client.from("store_pickup_addresses").insert({
      store_id: store!.id,
      governorate: "giza",
      city: "Dokki",
      street_address: "1 Street",
    });
    expect(mismatch.error?.message ?? "").toContain("BETK_PICKUP_GOVERNORATE_MISMATCH");

    const matched = await seller.client.from("store_pickup_addresses").insert({
      store_id: store!.id,
      governorate: store!.governorate,
      city: "Nasr",
      street_address: "1 Street",
    });
    expect(matched.error).toBeNull();
  });

  it("the action writes pending food documents that only the seller and an admin can read", async () => {
    const seller = await createUser(service, "action");
    const buyer = await createUser(service, "buyer");
    const admin = await createUser(service, "admin", "admin");

    const { data: categories } = await service
      .schema("betk")
      .from("categories")
      .select("id, slug")
      .eq("slug", "food-beverages")
      .limit(1);
    const food = categories?.[0];
    if (!food) throw new Error("food-beverages category is missing");

    h.client = seller.client;
    const result = await submitSellerApplication({
      nameAr: "متجر",
      slug: makeSlug(),
      categoryIds: [food.id],
      governorate: "cairo",
      pickup: { city: "Nasr", streetAddress: "2 Street" },
      sellerAgreementAccepted: true,
      docFrontPath: `${seller.id}/front.png`,
      docBackPath: `${seller.id}/back.png`,
      food: {
        packagingPath: `${seller.id}/pack.png`,
        labelPath: `${seller.id}/label.png`,
        expiryPath: `${seller.id}/expiry.png`,
        socialUrl: "https://example.invalid/t06",
      },
    });
    expect(result).toEqual({ ok: true });

    const { data: store } = await service
      .schema("betk")
      .from("stores")
      .select("delivery_options")
      .eq("seller_id", seller.id)
      .single();
    expect(store?.delivery_options).toEqual({});

    const { data: acceptance } = await service
      .schema("betk")
      .from("agreement_acceptances")
      .select("document, version_label, status, ip, user_agent")
      .eq("user_id", seller.id)
      .single();
    expect(acceptance).toMatchObject({
      document: "seller_agreement",
      version_label: "STAGING-DRAFT-1",
      status: "accepted",
      ip: null,
      user_agent: null,
    });

    const { data: docs } = await service
      .schema("betk")
      .from("seller_documents")
      .select("document_type, review_status")
      .eq("seller_id", seller.id);
    const foodDocs = (docs ?? []).filter((row) => row.document_type.startsWith("food_"));
    expect(foodDocs.map((row) => row.document_type).sort()).toEqual([
      "food_expiry",
      "food_label",
      "food_packaging",
      "food_social_url",
    ]);
    expect(foodDocs.every((row) => row.review_status === "pending")).toBe(true);

    const own = await seller.client
      .from("seller_documents")
      .select("review_status")
      .eq("document_type", "food_social_url");
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);

    const asAdmin = await admin.client
      .from("seller_documents")
      .select("review_status")
      .eq("seller_id", seller.id)
      .eq("document_type", "food_social_url");
    expect(asAdmin.error).toBeNull();
    expect(asAdmin.data).toHaveLength(1);

    const asBuyer = await buyer.client
      .from("seller_documents")
      .select("review_status")
      .eq("seller_id", seller.id)
      .eq("document_type", "food_social_url");
    expect(asBuyer.data ?? []).toHaveLength(0);

    const anon = userClient();
    const asAnon = await anon
      .from("seller_documents")
      .select("review_status")
      .eq("seller_id", seller.id)
      .eq("document_type", "food_social_url");
    expect((asAnon.data ?? []).length === 0 || asAnon.error !== null).toBe(true);

    const path = `${seller.id}/t06-probe.png`;
    const uploaded = await seller.client.storage.from(DOCS_BUCKET).upload(path, TINY_PNG, {
      contentType: "image/png",
      upsert: true,
    });
    expect(uploaded.error).toBeNull();

    const ownRead = await seller.client.storage.from(DOCS_BUCKET).download(path);
    expect(ownRead.error).toBeNull();
    const buyerRead = await buyer.client.storage.from(DOCS_BUCKET).download(path);
    expect(buyerRead.error).not.toBeNull();
    const adminRead = await admin.client.storage.from(DOCS_BUCKET).download(path);
    expect(adminRead.error).toBeNull();
    const anonRead = await anon.storage.from(DOCS_BUCKET).download(path);
    expect(anonRead.error).not.toBeNull();

    await service.storage.from(DOCS_BUCKET).remove([path]);
  });
});

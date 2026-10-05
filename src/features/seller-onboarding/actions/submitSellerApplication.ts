"use server";

/**
 * submitSellerApplication — become-seller submit (FR-SEL-1, AC-AGR-3, REG-65).
 *
 * ORDER:
 *   1. Zod, then requireVerifiedPhone() (OD-4).
 *   2. Own-prefix check on document paths. Paths are never logged.
 *   3. When the seller e-signed, insert agreement_acceptances for the current
 *      seller_agreement version (user_id, document, version_label only).
 *      A missing row is not short-circuited: the RPC is still called.
 *   4. betk.submit_seller_application. p_delivery_options is always {}.
 *      The body writes stores.delivery_options as {} even if a caller sends
 *      values (REG-65). Argument list is unchanged.
 *   5. Insert store_categories by category id (no approved_at), the pickup
 *      row (governorate = the store's), and the four food documents when a
 *      food-beverages category was chosen.
 *   6. setUserRole(uid, 'seller') last (REG-19).
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireVerifiedPhone,
  NotAuthenticatedError,
  PhoneRequiredError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import { setUserRole } from "@/services/authUsers";
import {
  isConfiguredVersionLabel,
  readAgreementVersionAsUser,
} from "@/services/agreementVersions";
import {
  submitSellerApplicationSchema,
  type SubmitSellerApplicationParsed,
  type SubmitSellerApplicationInput,
  type SubmitSellerApplicationResult,
} from "@/validations/sellerOnboarding";
import { selectionIncludesFood, type CategoryRef } from "../foodBranch";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import type { Database, Json } from "@/lib/supabase/types";

type SubmitArgs = Database["betk"]["Functions"]["submit_seller_application"]["Args"];

const RPC_SLUG_TAKEN = "BETK_SLUG_TAKEN";
const RPC_APPLICATION_EXISTS = "BETK_APPLICATION_EXISTS";
const RPC_AGREEMENT_REQUIRED = "BETK_SELLER_AGREEMENT_REQUIRED";
const SELLER_AGREEMENT_KEY = "agreement_seller_agreement_version" as const;
const PG_UNIQUE = "23505";

const FOOD_ROWS = [
  ["food_packaging", "packagingPath"],
  ["food_label", "labelPath"],
  ["food_expiry", "expiryPath"],
  ["food_social_url", "socialUrl"],
] as const;

function ownsPrefix(path: string, uid: string): boolean {
  return path.split("/")[0] === uid;
}

type Writer = Awaited<ReturnType<typeof createClient>>;

async function writeFollowUps(
  supabase: Writer,
  userId: string,
  app: SubmitSellerApplicationParsed,
  categoryIds: string[],
  food: boolean,
): Promise<string | null> {
  const { data: store, error: storeError } = await supabase
    .schema("betk")
    .from("stores")
    .select("id")
    .eq("seller_id", userId)
    .maybeSingle();
  if (storeError || !store) return "store";

  for (const categoryId of categoryIds) {
    const { error } = await supabase.schema("betk").from("store_categories").insert({
      store_id: store.id,
      category_id: categoryId,
    });
    if (error && error.code !== PG_UNIQUE) return "categories";
  }

  const { error: pickupError } = await supabase.schema("betk").from("store_pickup_addresses").upsert(
    {
      store_id: store.id,
      governorate: app.governorate,
      city: app.pickup.city,
      street_address: app.pickup.streetAddress,
      building_notes: app.pickup.buildingNotes ?? null,
    },
    { onConflict: "store_id" },
  );
  if (pickupError) return "pickup";

  if (food && app.food) {
    for (const [documentType, field] of FOOD_ROWS) {
      const { error } = await supabase.schema("betk").from("seller_documents").upsert(
        {
          seller_id: userId,
          document_type: documentType,
          storage_path: app.food[field],
          review_status: "pending",
          reviewed_at: null,
        },
        { onConflict: "seller_id,document_type" },
      );
      if (error) return "food";
    }
  }

  return null;
}

export async function submitSellerApplication(
  input: SubmitSellerApplicationInput,
): Promise<SubmitSellerApplicationResult> {
  setFeatureContext("seller-onboarding");

  const parsed = submitSellerApplicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }
  const app = parsed.data;
  const categoryIds = [...new Set(app.categoryIds)];

  let userId: string;
  try {
    const user = await requireVerifiedPhone();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    if (err instanceof PhoneRequiredError) return { ok: false, reason: "phone_required" };
    captureTaggedError(err, "seller-onboarding", { extra: { step: "requireVerifiedPhone" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });

  const paths = [app.docFrontPath, app.docBackPath];
  if (app.food) {
    paths.push(app.food.packagingPath, app.food.labelPath, app.food.expiryPath);
  }
  if (paths.some((path) => !ownsPrefix(path, userId))) {
    captureTaggedError(new Error("seller-onboarding: doc path outside caller prefix"), "seller-onboarding", {
      extra: { step: "prefixOwnership" },
    });
    return { ok: false, reason: "invalid" };
  }

  const supabase = await createClient();
  const { data: categoryRows, error: categoryError } = await supabase
    .schema("betk")
    .from("categories")
    .select("id, parent_id, slug")
    .in("id", categoryIds);

  if (categoryError || !categoryRows || categoryRows.length !== categoryIds.length) {
    return { ok: false, reason: "invalid" };
  }

  const rows: CategoryRef[] = categoryRows;
  const food = selectionIncludesFood(rows, categoryIds);
  if (food && !app.food) return { ok: false, reason: "invalid" };

  const byId = new Map(rows.map((row) => [row.id, row]));
  const primary = byId.get(categoryIds[0]!);
  if (!primary) return { ok: false, reason: "invalid" };
  const secondary = categoryIds[1] ? byId.get(categoryIds[1]) : undefined;

  if (app.sellerAgreementAccepted) {
    const version = await readAgreementVersionAsUser(supabase, SELLER_AGREEMENT_KEY);
    if (version.ok && isConfiguredVersionLabel(version.label)) {
      const { error: acceptError } = await supabase.schema("betk").from("agreement_acceptances").insert({
        user_id: userId,
        document: "seller_agreement",
        version_label: version.label,
      });
      if (acceptError && acceptError.code !== PG_UNIQUE) {
        captureTaggedError(acceptError, "seller-onboarding", { extra: { step: "sellerAgreement" } });
        return { ok: false, reason: "error" };
      }
    }
  }

  const submitArgs: SubmitArgs = {
    p_name_ar: app.nameAr,
    p_name_en: (app.nameEn ?? null) as string,
    p_bio_ar: (app.bioAr ?? null) as string,
    p_slug: app.slug,
    p_category_primary: primary.slug,
    p_category_secondary: (secondary?.slug ?? null) as string,
    p_governorate: app.governorate,
    p_city: (app.city ?? null) as string,
    p_payment_methods: {} as Json,
    p_delivery_options: {} as Json,
    p_return_policy: null as unknown as string,
    p_min_order_egp: null as unknown as number,
    p_doc_front_path: app.docFrontPath,
    p_doc_back_path: app.docBackPath,
  };

  const { error: rpcError } = await supabase.schema("betk").rpc("submit_seller_application", submitArgs);

  if (rpcError) {
    const message = rpcError.message ?? "";
    if (message.includes(RPC_SLUG_TAKEN)) return { ok: false, reason: "slug_taken" };
    if (message.includes(RPC_AGREEMENT_REQUIRED)) return { ok: false, reason: "agreement_required" };
    if (message.includes(RPC_APPLICATION_EXISTS)) {
      const followUp = await writeFollowUps(supabase, userId, app, categoryIds, food);
      if (followUp) {
        captureTaggedError(new Error("seller-onboarding: follow-up write failed"), "seller-onboarding", {
          extra: { step: followUp },
        });
      }
      try {
        await setUserRole(userId, "seller");
      } catch (healErr) {
        captureTaggedError(healErr, "seller-onboarding", { extra: { step: "roleFlipHeal" } });
      }
      return { ok: false, reason: "application_exists" };
    }
    captureTaggedError(rpcError, "seller-onboarding", { extra: { step: "submitRpc" } });
    return { ok: false, reason: "error" };
  }

  const followUp = await writeFollowUps(supabase, userId, app, categoryIds, food);
  if (followUp) {
    captureTaggedError(new Error("seller-onboarding: follow-up write failed"), "seller-onboarding", {
      extra: { step: followUp },
    });
    return { ok: false, reason: "error" };
  }

  try {
    await setUserRole(userId, "seller");
  } catch (roleErr) {
    captureTaggedError(roleErr, "seller-onboarding", { extra: { step: "roleFlip" } });
    return { ok: false, reason: "error" };
  }

  captureServerEvent(userId, "seller_application_submitted");
  return { ok: true };
}

"use server";

/**
 * P49 approval writes. The caller is the cookie session. A non-admin is
 * refused before any approval-state column is written. Incomplete
 * applications are refused before any write.
 *
 * Approve sets store_categories.approved_at, seller_documents.review_status
 * and reviewed_at, seller_profiles.status and approved_at, and stores.status
 * (the store is public only when active). The moderation log uses the live
 * moderation_target value `seller` (REG-70: no new enum member).
 */

import { createClient } from "@/lib/supabase/server";
import {
  NotAuthenticatedError,
  requireActiveUser,
} from "@/features/auth/queries/requireVerifiedPhone";
import { UserDeactivatedError, UserNotActiveError } from "@/features/auth/queries/findOrCreateUser";
import {
  approveSellerSchema,
  rejectSellerSchema,
  type ApprovalMissing,
  type ApproveSellerInput,
  type RejectSellerInput,
  type SellerApprovalResult,
} from "@/validations/sellerApproval";

const FOOD_TYPES = ["food_packaging", "food_label", "food_expiry", "food_social_url"] as const;

type Db = Awaited<ReturnType<typeof createClient>>;

function refused(): SellerApprovalResult {
  return { ok: false, reason: "refused" };
}

function incomplete(missing: ApprovalMissing): SellerApprovalResult {
  return { ok: false, reason: "incomplete", missing };
}

async function adminId(): Promise<string | SellerApprovalResult> {
  try {
    const user = await requireActiveUser();
    if (user.role !== "admin" && user.role !== "superadmin") {
      return { ok: false, reason: "forbidden" };
    }
    return user.id;
  } catch (error) {
    if (
      error instanceof NotAuthenticatedError ||
      error instanceof UserDeactivatedError ||
      error instanceof UserNotActiveError
    ) {
      return { ok: false, reason: "forbidden" };
    }
    throw error;
  }
}

async function foodCategoryIds(supabase: Db): Promise<Set<string>> {
  const { data, error } = await supabase.schema("betk").from("categories").select("id, parent_id, slug");
  if (error || !data) return new Set();
  const root = data.find((row) => row.slug === "food-beverages");
  if (!root) return new Set();
  const ids = new Set<string>([root.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const row of data) {
      if (row.parent_id && ids.has(row.parent_id) && !ids.has(row.id)) {
        ids.add(row.id);
        grew = true;
      }
    }
  }
  return ids;
}

async function missingPiece(supabase: Db, sellerId: string): Promise<ApprovalMissing | null> {
  const store = await supabase
    .schema("betk")
    .from("stores")
    .select("id")
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (store.error || !store.data) return "categories";

  const categories = await supabase
    .schema("betk")
    .from("store_categories")
    .select("category_id")
    .eq("store_id", store.data.id);
  if (categories.error || !categories.data || categories.data.length === 0) return "categories";

  const pickup = await supabase
    .schema("betk")
    .from("store_pickup_addresses")
    .select("store_id")
    .eq("store_id", store.data.id)
    .maybeSingle();
  if (pickup.error || !pickup.data) return "pickup";

  const version = await supabase.schema("betk").rpc("checkout_agreement_version", {
    p_key: "agreement_seller_agreement_version",
  });
  if (version.error || !version.data) return "agreement";
  const acceptance = await supabase
    .schema("betk")
    .from("agreement_acceptances")
    .select("id")
    .eq("user_id", sellerId)
    .eq("document", "seller_agreement")
    .eq("version_label", version.data)
    .eq("status", "accepted")
    .limit(1);
  if (acceptance.error || !acceptance.data || acceptance.data.length === 0) return "agreement";

  const foodIds = await foodCategoryIds(supabase);
  const isFood = categories.data.some((row) => foodIds.has(row.category_id));
  if (!isFood) return null;

  const docs = await supabase
    .schema("betk")
    .from("seller_documents")
    .select("document_type")
    .eq("seller_id", sellerId)
    .in("document_type", [...FOOD_TYPES]);
  if (docs.error || !docs.data) return "food_documents";
  const present = new Set(docs.data.map((row) => row.document_type));
  if (FOOD_TYPES.some((type) => !present.has(type))) return "food_documents";
  return null;
}

export async function approveSellerApplication(input: ApproveSellerInput): Promise<SellerApprovalResult> {
  const parsed = approveSellerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const caller = await adminId();
  if (typeof caller !== "string") return caller;

  const supabase = await createClient();
  const sellerId = parsed.data.sellerId;
  const missing = await missingPiece(supabase, sellerId);
  if (missing) return incomplete(missing);

  const store = await supabase.schema("betk").from("stores").select("id").eq("seller_id", sellerId).maybeSingle();
  if (store.error || !store.data) return refused();

  const now = new Date().toISOString();
  const categories = await supabase
    .schema("betk")
    .from("store_categories")
    .update({ approved_at: now })
    .eq("store_id", store.data.id)
    .select("category_id");
  if (categories.error || !categories.data || categories.data.length === 0) return refused();

  const documents = await supabase
    .schema("betk")
    .from("seller_documents")
    .update({ review_status: "approved", reviewed_at: now })
    .eq("seller_id", sellerId)
    .select("document_type");
  if (documents.error) return refused();

  const profile = await supabase
    .schema("betk")
    .from("seller_profiles")
    .update({ status: "active", approved_at: now })
    .eq("id", sellerId)
    .select("id, status, approved_at")
    .maybeSingle();
  if (profile.error || profile.data?.status !== "active" || !profile.data.approved_at) return refused();

  const storeStatus = await supabase
    .schema("betk")
    .from("stores")
    .update({ status: "active" })
    .eq("id", store.data.id)
    .select("id")
    .maybeSingle();
  if (storeStatus.error || !storeStatus.data) return refused();

  const log = await supabase.schema("betk").from("moderation_logs").insert({
    admin_id: caller,
    action: "approve_seller",
    target_type: "seller",
    target_id: sellerId,
  });
  if (log.error) return refused();
  return { ok: true };
}

export async function rejectSellerApplication(input: RejectSellerInput): Promise<SellerApprovalResult> {
  const parsed = rejectSellerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const caller = await adminId();
  if (typeof caller !== "string") return caller;

  const supabase = await createClient();
  const sellerId = parsed.data.sellerId;
  const now = new Date().toISOString();

  const profile = await supabase
    .schema("betk")
    .from("seller_profiles")
    .update({ rejected_reason: parsed.data.reason })
    .eq("id", sellerId)
    .eq("status", "pending")
    .select("id, approved_at")
    .maybeSingle();
  if (profile.error || !profile.data || profile.data.approved_at !== null) return refused();

  const documents = await supabase
    .schema("betk")
    .from("seller_documents")
    .update({ review_status: "rejected", reviewed_at: now })
    .eq("seller_id", sellerId);
  if (documents.error) return refused();

  const log = await supabase.schema("betk").from("moderation_logs").insert({
    admin_id: caller,
    action: "reject_seller",
    target_type: "seller",
    target_id: sellerId,
    reason: parsed.data.reason,
  });
  if (log.error) return refused();
  return { ok: true };
}

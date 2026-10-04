import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { imageExtension, SIGNED_URL_EXPIRY_SECONDS } from "@/features/seller-approval/docUrl";

type Db = Awaited<ReturnType<typeof createClient>>;

const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET ?? "docs";

export interface QueueRow {
  sellerId: string;
  storeName: string;
  status: "pending" | "rejected";
}

export interface ApprovalDocument {
  documentType: string;
  /** File documents only. food_social_url is never a signed URL. */
  signedUrl: string | null;
  signError: boolean;
  /** Present only for food_social_url. Never fetched. */
  socialUrl: string | null;
}

export interface ApprovalDetail {
  sellerId: string;
  storeName: string;
  status: "pending" | "rejected";
  documents: ApprovalDocument[];
}

export async function loadApprovalQueue(supabase: Db): Promise<QueueRow[] | null> {
  const profiles = await supabase
    .schema("betk")
    .from("seller_profiles")
    .select("id, status, rejected_reason")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });
  if (profiles.error || !profiles.data) return null;
  if (profiles.data.length === 0) return [];

  const ids = profiles.data.map((row) => row.id);
  const stores = await supabase.schema("betk").from("stores").select("seller_id, name_ar").in("seller_id", ids);
  if (stores.error || !stores.data) return null;
  const names = new Map(stores.data.map((row) => [row.seller_id, row.name_ar]));

  return profiles.data.map((row) => ({
    sellerId: row.id,
    storeName: names.get(row.id) ?? "",
    status: row.rejected_reason ? "rejected" : "pending",
  }));
}

async function callerIsAdmin(supabase: Db, userId: string): Promise<boolean> {
  const role = await supabase.schema("betk").from("users").select("role").eq("id", userId).maybeSingle();
  return role.data?.role === "admin" || role.data?.role === "superadmin";
}

export async function loadApprovalDetail(
  supabase: Db,
  adminId: string,
  sellerId: string,
): Promise<ApprovalDetail | "missing" | null> {
  if (!sellerId || !(await callerIsAdmin(supabase, adminId))) return null;

  const profile = await supabase
    .schema("betk")
    .from("seller_profiles")
    .select("id, status, rejected_reason")
    .eq("id", sellerId)
    .maybeSingle();
  if (profile.error) return null;
  if (!profile.data || profile.data.status !== "pending") return "missing";

  const store = await supabase.schema("betk").from("stores").select("name_ar").eq("seller_id", sellerId).maybeSingle();
  if (store.error || !store.data) return "missing";

  const docs = await supabase
    .schema("betk")
    .from("seller_documents")
    .select("document_type, storage_path")
    .eq("seller_id", sellerId)
    .order("document_type");
  if (docs.error || !docs.data) return null;

  const documents: ApprovalDocument[] = [];
  for (const doc of docs.data) {
    if (doc.document_type === "food_social_url") {
      documents.push({
        documentType: doc.document_type,
        signedUrl: null,
        signError: false,
        socialUrl: doc.storage_path,
      });
      continue;
    }
    if (!imageExtension(doc.storage_path)) {
      documents.push({
        documentType: doc.document_type,
        signedUrl: null,
        signError: false,
        socialUrl: null,
      });
      continue;
    }
    const signed = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY_SECONDS);
    documents.push({
      documentType: doc.document_type,
      signedUrl: signed.data?.signedUrl ?? null,
      signError: Boolean(signed.error) || !signed.data?.signedUrl,
      socialUrl: null,
    });
  }

  return {
    sellerId,
    storeName: store.data.name_ar,
    status: profile.data.rejected_reason ? "rejected" : "pending",
    documents,
  };
}

/**
 * getOwnSellerApplication — Phase 04 / T03 (FR-SEL-1/2). Reads the caller's OWN
 * seller application (profile + store + the two ID documents) for the status /
 * resume surfaces (T05 consumes it).
 *
 * Identity-dependent read (NOT public): runs under the caller's own auth context
 * (cookie client in RSC; an authenticated per-user client injected in tests),
 * subject to self-scope RLS — `sp_select` (id = auth.uid()), `stores_public`
 * (seller_id = auth.uid() branch), and `sdoc_own` (seller_id = auth.uid()). The
 * uid is resolved from the live GoTrue session; every filter is ALSO pinned to
 * that uid explicitly (not RLS alone) so the result is correct even for an admin
 * viewer and a non-owner still reads nothing.
 *
 * Returns `null` when the caller has no application yet (no seller_profiles row)
 * — the /seller/onboarding entry state.
 */

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Minimal client surface: schema access + session lookup. */
export type SellerOnboardingClient = Pick<SupabaseClient<Database>, "schema" | "auth">;

type SellerProfileRow = Database["betk"]["Tables"]["seller_profiles"]["Row"];
type StoreRow = Database["betk"]["Tables"]["stores"]["Row"];
type SellerDocumentRow = Database["betk"]["Tables"]["seller_documents"]["Row"];

export interface OwnSellerApplication {
  profile: Pick<
    SellerProfileRow,
    "id" | "status" | "level" | "submitted_at" | "approved_at" | "rejected_reason"
  >;
  /** The seller's store, or `null` if somehow absent (should not happen for a
   * successful submit — profile + store are written atomically per ADR-012). */
  store: Pick<
    StoreRow,
    | "id"
    | "name_ar"
    | "name_en"
    | "slug"
    | "status"
    | "category_primary"
    | "category_secondary"
    | "governorate"
    | "city"
  > | null;
  documents: Pick<
    SellerDocumentRow,
    "document_type" | "review_status" | "uploaded_at"
  >[];
}

export async function getOwnSellerApplication(
  client?: SellerOnboardingClient,
): Promise<OwnSellerApplication | null> {
  const supabase = client ?? (await createClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .schema("betk")
    .from("seller_profiles")
    .select("id, status, level, submitted_at, approved_at, rejected_reason")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(
      `[seller-onboarding] getOwnSellerApplication profile read failed: ${profileError.message}`,
    );
  }
  if (!profile) return null;

  const [{ data: store, error: storeError }, { data: documents, error: docsError }] =
    await Promise.all([
      supabase
        .schema("betk")
        .from("stores")
        .select(
          "id, name_ar, name_en, slug, status, category_primary, category_secondary, governorate, city",
        )
        .eq("seller_id", user.id)
        .maybeSingle(),
      supabase
        .schema("betk")
        .from("seller_documents")
        .select("document_type, review_status, uploaded_at")
        .eq("seller_id", user.id)
        .order("document_type", { ascending: true }),
    ]);

  if (storeError) {
    throw new Error(
      `[seller-onboarding] getOwnSellerApplication store read failed: ${storeError.message}`,
    );
  }
  if (docsError) {
    throw new Error(
      `[seller-onboarding] getOwnSellerApplication documents read failed: ${docsError.message}`,
    );
  }

  return {
    profile,
    store: store ?? null,
    documents: documents ?? [],
  };
}

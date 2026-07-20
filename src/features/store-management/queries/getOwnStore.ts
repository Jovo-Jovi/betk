/**
 * getOwnStore — Phase 04 / T06 (FR-SEL-4). Reads the caller's OWN store row
 * (every field the profile-settings form edits) for the /seller/store page.
 *
 * Identity-dependent read (NOT public): runs under the caller's own auth context
 * (cookie client in RSC; an authenticated per-user client injected in tests),
 * subject to self-scope RLS — `stores_public` exposes the row via its
 * `seller_id = auth.uid()` branch even while the store is not `active` (a pending
 * seller can still read/edit their own store). The uid is resolved from the live
 * GoTrue session and the filter is ALSO pinned to it explicitly (not RLS alone),
 * so an admin viewer or a non-owner still reads only their own row / nothing.
 *
 * Returns `null` when the caller has no store yet (should not happen for a
 * seller — profile + store are written atomically at submit per ADR-012).
 */

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Minimal client surface: schema access + session lookup. */
export type StoreManagementClient = Pick<SupabaseClient<Database>, "schema" | "auth">;

type StoreRow = Database["betk"]["Tables"]["stores"]["Row"];

export type OwnStore = Pick<
  StoreRow,
  | "id"
  | "name_ar"
  | "name_en"
  | "bio_ar"
  | "slug"
  | "slug_changed_at"
  | "category_primary"
  | "category_secondary"
  | "governorate"
  | "city"
  | "min_order_egp"
  | "avatar_url"
  | "cover_url"
  | "status"
>;

const STORE_COLUMNS =
  "id, name_ar, name_en, bio_ar, slug, slug_changed_at, category_primary, category_secondary, governorate, city, min_order_egp, avatar_url, cover_url, status";

export async function getOwnStore(client?: StoreManagementClient): Promise<OwnStore | null> {
  const supabase = client ?? (await createClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("stores")
    .select(STORE_COLUMNS)
    .eq("seller_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`[store-management] getOwnStore read failed: ${error.message}`);
  }

  return data ?? null;
}

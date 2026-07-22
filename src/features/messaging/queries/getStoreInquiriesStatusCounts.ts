/**
 * getStoreInquiriesStatusCounts — per-status counts for the Seller Inbox
 * filter tabs (`/seller/inbox`, T04). Phase 06 / T04 (FR-SEL-13).
 *
 * Additive sibling to `getStoreInquiries` — same own-store scope resolution
 * (`resolveCallerScope`), no new RLS/migration. Five head-only
 * `count: "exact"` reads (one per `inquiry_status` member; "all" is their
 * sum) — the `getOwnListingsStatusCounts` (Phase 05 / T03) precedent, cheap
 * at MVP scale. Returns all-zero counts (never throws) when the caller isn't
 * a seller with a store.
 */

import { createClient } from "@/lib/supabase/server";
import type { InquiryStatusFilter } from "@/validations/messaging";
import { resolveCallerScope, type MessagingClient } from "./_shared";

export type StoreInquiriesStatusCounts = Record<InquiryStatusFilter, number>;

const CONCRETE_STATUSES = ["open", "replied", "confirmed", "declined", "expired"] as const;

const ZERO_COUNTS: StoreInquiriesStatusCounts = {
  all: 0,
  open: 0,
  replied: 0,
  confirmed: 0,
  declined: 0,
  expired: 0,
};

export async function getStoreInquiriesStatusCounts(
  client?: MessagingClient,
): Promise<StoreInquiriesStatusCounts> {
  const supabase = client ?? (await createClient());

  const scope = await resolveCallerScope(supabase);
  if (!scope || scope.storeId === null) return { ...ZERO_COUNTS };
  const storeId = scope.storeId;

  const perStatus = await Promise.all(
    CONCRETE_STATUSES.map(async (status) => {
      const { count, error } = await supabase
        .schema("betk")
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .eq("status", status);
      if (error) {
        throw new Error(`[messaging] getStoreInquiriesStatusCounts failed: ${error.message}`);
      }
      return { status, count: count ?? 0 };
    }),
  );

  const counts: StoreInquiriesStatusCounts = { ...ZERO_COUNTS };
  for (const { status, count } of perStatus) {
    counts[status] = count;
  }
  counts.all = CONCRETE_STATUSES.reduce((sum, status) => sum + counts[status], 0);
  return counts;
}

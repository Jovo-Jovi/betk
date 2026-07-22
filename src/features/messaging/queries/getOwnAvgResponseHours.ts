/**
 * getOwnAvgResponseHours — the caller's OWN `seller_profiles.avg_response_hours`
 * (`/seller/inbox`, T04). Phase 06 / T04 (FR-SEL-13, DECISION 2 / Option A).
 *
 * UI_SPEC.md L481 lists a "response-time chip" among the Seller Inbox
 * components, but `avg_response_hours` is a SINGLE seller-level metric (one
 * value per store), not a per-inquiry fact — the same number would repeat on
 * every row. Rendering it ONCE at the page level (a stat chip above the
 * list/tabs) avoids that redundancy; this is a stated engineering judgment
 * call, not a spec citation for placement (the metric itself + its write site
 * ARE spec-pinned — UI_SPEC L482 "reply updates seller_profiles.avg_response_
 * hours").
 *
 * Self-scope read: `seller_profiles` self-row SELECT (`id = auth.uid()`) is
 * the same policy shape `getOwnSellerApplication`/middleware already read
 * from. NULL (never 0) when the seller has no first-replied inquiries yet —
 * T04 renders a keyed "not enough data" line, never a fabricated zero.
 */

import { createClient } from "@/lib/supabase/server";
import { resolveCallerScope, type MessagingClient } from "./_shared";

export async function getOwnAvgResponseHours(client?: MessagingClient): Promise<number | null> {
  const supabase = client ?? (await createClient());

  const scope = await resolveCallerScope(supabase);
  if (!scope || scope.storeId === null) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("seller_profiles")
    .select("avg_response_hours")
    .eq("id", scope.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[messaging] getOwnAvgResponseHours failed: ${error.message}`);
  }

  return data?.avg_response_hours ?? null;
}

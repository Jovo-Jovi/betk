/**
 * Messaging actions — shared write helpers. Phase 06 / T02. NOT server-only
 * (imported by the "use server" action files, which re-export only async fns).
 */

import type { MessagingClient } from "../queries/_shared";
import { computeAvgResponseHours } from "../messagingRules";

/**
 * DECISION 2 / Option A — recompute `seller_profiles.avg_response_hours` for the
 * caller's OWN profile (`id = auth.uid()`, permitted by `sp_update` — a self-row
 * UPDATE with no column restriction and no INSERT-only phone gate). NO
 * service-role. Best-effort: the caller already sent their message, so a metric
 * failure must not fail the send — the caller surfaces the returned message to
 * Sentry and continues.
 *
 * Full recompute (no response-count column exists → not incremental): the mean,
 * across the store's inquiries that have a first seller reply, of
 * (firstSellerReply.sent_at − inquiry.created_at) in hours (see
 * computeAvgResponseHours). Cheap at MVP scale; a candidate analytics/cron job
 * post-MVP.
 *
 * @returns a DB error message when a read/write failed, else null.
 */
export async function recomputeSellerAvgResponseHours(
  supabase: MessagingClient,
  sellerUserId: string,
  storeId: string,
): Promise<string | null> {
  const { data: inqs, error: inqErr } = await supabase
    .schema("betk")
    .from("inquiries")
    .select("id, created_at")
    .eq("store_id", storeId);
  if (inqErr) return inqErr.message;

  const inquiries = (inqs ?? []) as { id: string; created_at: string }[];
  if (inquiries.length === 0) return null;

  const { data: msgs, error: msgErr } = await supabase
    .schema("betk")
    .from("inquiry_messages")
    .select("inquiry_id, sent_at")
    .eq("sender_type", "seller")
    .in(
      "inquiry_id",
      inquiries.map((i) => i.id),
    );
  if (msgErr) return msgErr.message;

  // Earliest seller reply per inquiry.
  const firstReplyByInquiry = new Map<string, string>();
  for (const m of (msgs ?? []) as { inquiry_id: string; sent_at: string }[]) {
    const cur = firstReplyByInquiry.get(m.inquiry_id);
    if (!cur || Date.parse(m.sent_at) < Date.parse(cur)) {
      firstReplyByInquiry.set(m.inquiry_id, m.sent_at);
    }
  }

  const pairs = inquiries
    .filter((i) => firstReplyByInquiry.has(i.id))
    .map((i) => ({
      inquiryCreatedAt: i.created_at,
      firstSellerReplyAt: firstReplyByInquiry.get(i.id)!,
    }));

  const avg = computeAvgResponseHours(pairs);

  const { error: updErr } = await supabase
    .schema("betk")
    .from("seller_profiles")
    .update({ avg_response_hours: avg })
    .eq("id", sellerUserId);

  return updErr ? updErr.message : null;
}

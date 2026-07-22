/**
 * Messaging — pure, side-effect-free rules (unit-tested). Phase 06 / T02.
 *
 * Kept free of any Supabase/`next/headers` import so they run in the plain unit
 * suite and are reused by the queries (derive-at-read ordering, REG-43) and the
 * seller reply action (avg_response_hours recompute, DECISION 2 / Option A).
 */

/** Thread participant classification (server-verified in the actions). */
export type Participant = "buyer" | "seller";

/**
 * Resolves which thread party the caller is, or null when the caller is neither
 * (an outsider — the action returns not_found; RLS also denies the write).
 *
 * `callerStoreId` is the caller's OWN store id (null when they aren't a seller
 * with a store). A user who is BOTH the buyer AND the owning seller of an
 * inquiry (a seller inquiring on their own listing) classifies as "buyer" — the
 * buyer branch is checked first so self-inquiries stay buyer-authored.
 */
export function resolveParticipant(
  inquiry: { buyerId: string; storeId: string },
  caller: { userId: string; storeId: string | null },
): Participant | null {
  if (inquiry.buyerId === caller.userId) return "buyer";
  if (caller.storeId !== null && inquiry.storeId === caller.storeId) return "seller";
  return null;
}

/**
 * REG-43 (DECISION 4 — DERIVE-AT-READ): the thread's sort key. `last_message_at`
 * is NOT maintained (a buyer cannot bump it via RLS — ERD §3 row 51 UPDATE =
 * store/admin — and we deliberately add no DEFINER trigger), so ordering is
 * derived here from the latest activity = max(inquiry.createdAt, max message
 * sentAt). This makes a BUYER's newest message sort the thread to the top for
 * BOTH parties (the REG-43 proof), without any write to last_message_at.
 *
 * All inputs are ISO timestamps; returns the max ISO timestamp.
 */
export function latestActivityAt(createdAt: string, messageSentAts: string[]): string {
  let maxMs = Date.parse(createdAt);
  let maxIso = createdAt;
  for (const sentAt of messageSentAts) {
    const ms = Date.parse(sentAt);
    if (ms > maxMs) {
      maxMs = ms;
      maxIso = sentAt;
    }
  }
  return maxIso;
}

/**
 * The thread-list preview = the most recent message body (or the buyer's
 * opening message when the seller hasn't replied yet — an inquiry with zero
 * `inquiry_messages` is a valid resting state, ADR-014).
 */
export function lastMessagePreview(
  buyerFirstMessage: string,
  messages: { body: string; sentAt: string }[],
): string {
  if (messages.length === 0) return buyerFirstMessage;
  let latest = messages[0]!;
  for (const m of messages) {
    if (Date.parse(m.sentAt) > Date.parse(latest.sentAt)) latest = m;
  }
  return latest.body;
}

/**
 * DECISION 2 / Option A — avg_response_hours formula (an ENGINEERING choice:
 * no formula is pinned in PRD/UI_SPEC; only the write SITE is — PRD FR-SEL-13 +
 * UI_SPEC L482 "reply updates avg_response_hours"). It is the mean, across the
 * seller's inquiries that have received a first seller reply, of
 * (firstSellerReplyAt − inquiryCreatedAt) in hours, rounded to NUMERIC(5,2).
 * Returns null when the seller has no responded inquiries yet.
 *
 * Because `seller_profiles` carries no response-count column, this is a full
 * RECOMPUTE (not an incremental running average) — cheap at MVP scale and
 * correct; it may migrate to analytics/cron post-MVP.
 */
export function computeAvgResponseHours(
  pairs: { inquiryCreatedAt: string; firstSellerReplyAt: string }[],
): number | null {
  if (pairs.length === 0) return null;
  let sumHours = 0;
  let n = 0;
  for (const { inquiryCreatedAt, firstSellerReplyAt } of pairs) {
    const deltaMs = Date.parse(firstSellerReplyAt) - Date.parse(inquiryCreatedAt);
    if (Number.isNaN(deltaMs) || deltaMs < 0) continue; // ignore clock-skew/bad rows
    sumHours += deltaMs / 3_600_000;
    n += 1;
  }
  if (n === 0) return null;
  const avg = sumHours / n;
  // NUMERIC(5,2): 2 decimals, cap at the column's max (999.99).
  return Math.min(Math.round(avg * 100) / 100, 999.99);
}

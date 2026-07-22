"use server";

/**
 * createInquiry — Phase 06 / T02 (FR-BUY-5). A buyer opens an inquiry from a
 * listing detail page. Never throws to the client — returns a discriminated
 * `CreateInquiryResult`.
 *
 * SHAPE (ADR-014): a SINGLE-TABLE `betk.inquiries` INSERT. The opening message
 * is captured on the row itself (`buyer_first_message` NOT NULL); NO first
 * `inquiry_messages` row is written (an inquiry with zero messages is a valid
 * resting state — the seller's reply is the thread's first row). Hence no rpc,
 * no migration.
 *
 * STORE RESOLUTION: `store_id` is resolved SERVER-SIDE from the listing (read
 * via `listings_public`), never accepted from the client. If the listing isn't
 * publicly readable → `listing_unavailable`.
 *
 * GATE: `requireActiveUser` (R-A05), NOT `requireVerifiedPhone` — inquiries are
 * pre-transaction (ERD §1.2 gates only orders/seller_profiles/payouts). RLS
 * `inq_insert` (WITH CHECK buyer_id = auth.uid()) is the authz boundary; no
 * service-role.
 *
 * REG-43 (DECISION 4): `last_message_at` is left at its INSERT default (derive-
 * at-read); we do not set it.
 *
 * R-N04: capture the "new inquiry" event; DELIVERY (email/WhatsApp/in-app ≤5s)
 * is a Phase-12 (notifications infra) dependency — NO notifications-table write,
 * NO WhatsApp/email send here.
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  requireActiveUser,
  NotAuthenticatedError,
  UserDeactivatedError,
  UserNotActiveError,
} from "@/features/auth";
import {
  createInquirySchema,
  type CreateInquiryInput,
  type CreateInquiryResult,
} from "@/validations/messaging";
import type { Database } from "@/lib/supabase/types";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";

type InquiryInsert = Database["betk"]["Tables"]["inquiries"]["Insert"];

export async function createInquiry(input: CreateInquiryInput): Promise<CreateInquiryResult> {
  setFeatureContext("messaging");

  const parsed = createInquirySchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const p = parsed.data;

  let userId: string;
  try {
    const user = await requireActiveUser();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "messaging", { extra: { step: "requireActiveUser" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });

  const supabase = await createClient();

  // Resolve the listing's store SERVER-SIDE (never client-supplied). The buyer
  // reads the listing via listings_public; an unreadable listing → unavailable.
  const { data: listing, error: listingErr } = await supabase
    .schema("betk")
    .from("listings")
    .select("store_id")
    .eq("id", p.listingId)
    .maybeSingle();

  if (listingErr) {
    captureTaggedError(listingErr, "messaging", { extra: { step: "resolveListing" } });
    return { ok: false, reason: "error" };
  }
  if (!listing) return { ok: false, reason: "listing_unavailable" };

  const insert: InquiryInsert = {
    buyer_id: userId,
    store_id: listing.store_id,
    listing_id: p.listingId,
    buyer_first_message: p.message,
  };
  if (p.quantity !== undefined) insert.quantity = p.quantity;
  if (p.deliveryPreference !== undefined) insert.delivery_preference = p.deliveryPreference;
  if (p.specialRequests !== undefined) insert.special_requests = p.specialRequests;

  const { data, error } = await supabase
    .schema("betk")
    .from("inquiries")
    .insert(insert)
    .select("id")
    .single();

  if (error || !data) {
    captureTaggedError(error ?? new Error("createInquiry: no row"), "messaging", {
      extra: { step: "insertInquiry" },
    });
    return { ok: false, reason: "error" };
  }

  // R-N04: notify the seller of the new inquiry. Event captured now; delivery
  // (≤5s email/WhatsApp/in-app) is deferred to Phase 12 (notifications infra).
  captureServerEvent(userId, "inquiry_created", { inquiry_id: data.id });

  return { ok: true, inquiryId: data.id };
}

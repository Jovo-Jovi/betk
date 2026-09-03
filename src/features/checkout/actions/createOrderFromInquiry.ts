"use server";

/**
 * createOrderFromInquiry — Phase 07 / T02b (AC-BUY-6, ADR-018, REG-49). The BUYER
 * converts a seller-CONFIRMED inquiry into an order. Never throws — returns a
 * discriminated `CreateOrderFromInquiryResult`.
 *
 * ATOMICITY (ADR-018): the write is ONE `betk.create_order_from_inquiry(...)`
 * SECURITY INVOKER rpc — order + 1 item + 2 payments + the initial status-history
 * row commit or roll back together inside PostgREST's per-request transaction
 * (an itemless/paymentless order is never a valid resting state; orders has no
 * DELETE policy). Because the rpc is INVOKER, orders_insert + the RESTRICTIVE
 * orders_phone_gate (OD-4) + order_items_insert + payments_insert all bite THROUGH
 * the buyer — no service-role, no hand-rolled checks.
 *
 * SERVER-AUTHORITATIVE amounts: the client supplies ONLY {inquiryId, addressId,
 * deliveryMethod, depositMethod}. The rpc re-resolves listing price × qty →
 * subtotal, RE-READS delivery_fee from admin_settings (never an rpc param), and
 * computes total + the 50/50 deposit/balance split in SQL. Commission is stamped
 * by the BEFORE INSERT trigger (the buyer never reads the rate).
 *
 * GATE: requireVerifiedPhone() FIRST (OD-4) — typed phone_required/unauthenticated/
 * blocked route the T03 caller.
 *
 * UNPINNED ENGINEERING DECISION (cite-or-flag): nothing in the frozen scope pins
 * whether the flat delivery fee applies to pickup/remote; the rpc applies it
 * UNIFORMLY to all delivery methods (documented in the migration header). If a
 * method-specific fee schedule is ever specced, revisit both the rpc and this note.
 *
 * R-N04: capture the "order_created" event; DELIVERY (WhatsApp/email/in-app) is a
 * Phase-12 dependency — NO notifications-table write, NO send here.
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
import {
  createOrderFromInquirySchema,
  type CreateOrderFromInquiryInput,
  type CreateOrderFromInquiryResult,
} from "@/validations/checkout";
import { getTyped, type StoreDeliveryOptions } from "@/types/jsonb";
import { setFeatureContext, captureTaggedError } from "@/services/sentry";
import { captureServerEvent } from "@/services/posthog.server";
import type { Database } from "@/lib/supabase/types";
import {
  SETTINGS_HANDLE_KEYS,
  hasAnyDepositHandle,
  isDepositHandleConfigured,
} from "../checkoutRules";

type RpcArgs = Database["betk"]["Functions"]["create_order_from_inquiry"]["Args"];

/** Opaque tokens the rpc RAISEs (mapped to typed outcomes; never surfaced raw). */
const RPC = {
  NOT_FOUND: "BETK_INQUIRY_NOT_FOUND",
  NOT_CONFIRMED: "BETK_INQUIRY_NOT_CONFIRMED",
  ALREADY_CONVERTED: "BETK_ALREADY_CONVERTED",
  INVALID_DEPOSIT: "BETK_INVALID_DEPOSIT_METHOD",
  ADDRESS_NOT_FOUND: "BETK_ADDRESS_NOT_FOUND",
  LISTING_UNPRICED: "BETK_LISTING_UNPRICED",
} as const;

export async function createOrderFromInquiry(
  input: CreateOrderFromInquiryInput,
): Promise<CreateOrderFromInquiryResult> {
  setFeatureContext("checkout");

  const parsed = createOrderFromInquirySchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const p = parsed.data;

  // ── OD-4 verified-phone gate FIRST (R-A05 order, then phone) ────────────────
  let userId: string;
  try {
    const user = await requireVerifiedPhone();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAuthenticatedError) return { ok: false, reason: "unauthenticated" };
    if (err instanceof PhoneRequiredError) return { ok: false, reason: "phone_required" };
    if (err instanceof UserDeactivatedError || err instanceof UserNotActiveError) {
      return { ok: false, reason: "blocked" };
    }
    captureTaggedError(err, "checkout", { extra: { step: "requireVerifiedPhone" } });
    return { ok: false, reason: "error" };
  }

  Sentry.setUser({ id: userId });
  const supabase = await createClient();

  // ── Read the source inquiry (own, via inq_buyer) for clean UX outcomes.
  //    The rpc re-checks all of this authoritatively; this only shapes routing. ─
  const { data: inquiry, error: inqErr } = await supabase
    .schema("betk")
    .from("inquiries")
    .select("id, store_id, status, converted_to_order_id")
    .eq("id", p.inquiryId)
    .eq("buyer_id", userId)
    .maybeSingle();

  if (inqErr) {
    if (inqErr.code === "22P02") return { ok: false, reason: "not_found" };
    captureTaggedError(inqErr, "checkout", { extra: { step: "readInquiry" } });
    return { ok: false, reason: "error" };
  }
  if (!inquiry) return { ok: false, reason: "not_found" };
  if (inquiry.converted_to_order_id) {
    return { ok: false, reason: "already_converted", existingOrderId: inquiry.converted_to_order_id };
  }
  if (inquiry.status !== "confirmed") return { ok: false, reason: "not_confirmed" };

  // ── REG-14: the chosen delivery method must be one the store enables ────────
  const { data: store, error: storeErr } = await supabase
    .schema("betk")
    .from("stores")
    .select("delivery_options")
    .eq("id", inquiry.store_id)
    .maybeSingle();
  if (storeErr) {
    captureTaggedError(storeErr, "checkout", { extra: { step: "readStoreModes" } });
    return { ok: false, reason: "error" };
  }
  const modes = getTyped<StoreDeliveryOptions>(store?.delivery_options ?? {}).modes ?? [];
  if (!modes.includes(p.deliveryMethod)) {
    return { ok: false, reason: "delivery_method_unavailable" };
  }

  // ── payment_config_missing: ZERO BETK handles configured → CREATE NOTHING ───
  const { data: settingsRows, error: settingsErr } = await supabase
    .schema("betk")
    .from("admin_settings")
    .select("key, value")
    .in("key", [...SETTINGS_HANDLE_KEYS]);
  if (settingsErr) {
    captureTaggedError(settingsErr, "checkout", { extra: { step: "readHandles" } });
    return { ok: false, reason: "error" };
  }
  const handles: Record<string, string | null> = {};
  for (const r of settingsRows ?? []) handles[r.key] = r.value;
  if (!hasAnyDepositHandle(handles)) return { ok: false, reason: "payment_config_missing" };
  // Defense-in-depth: the picker must only offer configured rails (T03). A chosen
  // rail with no handle is a client bug, not a "no config at all" state.
  if (!isDepositHandleConfigured(p.depositMethod, handles)) return { ok: false, reason: "invalid" };

  // ── The atomic INVOKER rpc — delivery_fee/amounts re-resolved server-side ───
  const args: RpcArgs = {
    p_inquiry_id: p.inquiryId,
    p_address_id: p.addressId,
    p_delivery_method: p.deliveryMethod,
    p_deposit_method: p.depositMethod,
  };
  const { data: orderId, error: rpcErr } = await supabase
    .schema("betk")
    .rpc("create_order_from_inquiry", args);

  if (rpcErr || !orderId) {
    const msg = rpcErr?.message ?? "";
    if (msg.includes(RPC.ALREADY_CONVERTED)) {
      // Lost a race with a concurrent checkout — re-read the winning order id.
      const { data: reinq } = await supabase
        .schema("betk")
        .from("inquiries")
        .select("converted_to_order_id")
        .eq("id", p.inquiryId)
        .maybeSingle();
      if (reinq?.converted_to_order_id) {
        return { ok: false, reason: "already_converted", existingOrderId: reinq.converted_to_order_id };
      }
    }
    if (msg.includes(RPC.NOT_CONFIRMED)) return { ok: false, reason: "not_confirmed" };
    if (msg.includes(RPC.NOT_FOUND)) return { ok: false, reason: "not_found" };
    if (msg.includes(RPC.ADDRESS_NOT_FOUND)) return { ok: false, reason: "address_not_found" };
    if (msg.includes(RPC.LISTING_UNPRICED)) return { ok: false, reason: "listing_unavailable" };
    if (msg.includes(RPC.INVALID_DEPOSIT)) return { ok: false, reason: "invalid" };
    captureTaggedError(rpcErr ?? new Error("createOrderFromInquiry: no id"), "checkout", {
      extra: { step: "rpc" },
    });
    return { ok: false, reason: "error" };
  }

  // R-N04: notify the seller of the new order. Delivery = Phase 12.
  captureServerEvent(userId, "order_created", { order_id: orderId });

  return { ok: true, orderId };
}

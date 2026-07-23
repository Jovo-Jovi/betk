/**
 * Pure checkout rules — Phase 07 / T02b. NO DB, NO IO; unit-tested.
 *
 * These mirror the SERVER-AUTHORITATIVE arithmetic that the
 * `create_order_from_inquiry` rpc + the `set_order_commission_snapshot` trigger
 * perform in SQL (migration 20260723140552). They are the app-layer reflection of
 * that contract — used by getCheckoutContext to DISPLAY the summary the rpc will
 * commit, and unit-tested so a drift between the JS preview and the SQL truth is
 * caught. The rpc is always the authority; these never write.
 */

import type { DepositMethodInput } from "@/validations/checkout";

/** Round to 2 decimal places (EGP piastres) — matches SQL round(x, 2). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** The admin_settings keys the buyer may read at checkout (REG-69 literal allow-list). */
export const SETTINGS_FEE_KEY = "delivery_fee_flat_egp" as const;
export const HANDLE_KEY_BY_METHOD: Readonly<Record<DepositMethodInput, string>> = {
  instapay: "betk_instapay_handle",
  vodafone_cash: "betk_vodafone_cash",
  orange_cash: "betk_orange_cash",
};
/** The 3 BETK deposit-handle keys (order-stable). */
export const SETTINGS_HANDLE_KEYS = [
  "betk_instapay_handle",
  "betk_vodafone_cash",
  "betk_orange_cash",
] as const;

export interface CheckoutAmounts {
  subtotal: number;
  deliveryFee: number;
  total: number;
  deposit: number;
  balance: number;
}

/**
 * Compute the order money the way the rpc does: subtotal = unitPrice × qty,
 * total = subtotal + deliveryFee (chk_order_total), deposit = round(total/2, 2),
 * balance = total − deposit. All rounded to 2dp.
 */
export function computeCheckoutAmounts(
  unitPrice: number,
  quantity: number,
  deliveryFee: number,
): CheckoutAmounts {
  const subtotal = round2(unitPrice * quantity);
  const fee = round2(deliveryFee);
  const total = round2(subtotal + fee);
  const deposit = round2(total / 2);
  const balance = round2(total - deposit);
  return { subtotal, deliveryFee: fee, total, deposit, balance };
}

/**
 * Commission on SUBTOTAL (never total) — mirrors set_order_commission_snapshot:
 * round(ratePct/100 * subtotal, 2). The buyer never sees this; it is a BETK↔seller
 * concern surfaced only in seller/admin contexts.
 */
export function computeCommissionAmount(ratePct: number, subtotal: number): number {
  return round2((ratePct / 100) * subtotal);
}

/** Parse an admin_settings string value ('' / null → 0) as the rpc does (NULLIF/COALESCE). */
export function parseSettingNumber(value: string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : 0;
}

/** True when at least one of the 3 BETK deposit handles has a non-empty value. */
export function hasAnyDepositHandle(handles: Record<string, string | null | undefined>): boolean {
  return SETTINGS_HANDLE_KEYS.some((k) => (handles[k] ?? "").trim() !== "");
}

/** True when the specific chosen rail's handle is configured (non-empty). */
export function isDepositHandleConfigured(
  method: DepositMethodInput,
  handles: Record<string, string | null | undefined>,
): boolean {
  return (handles[HANDLE_KEY_BY_METHOD[method]] ?? "").trim() !== "";
}

/* ── BETK order reference (R-O02, BETK-YYYYMMDD-XXXX) ─────────────────────── */

/** The canonical betk_ref shape: `BETK-YYYYMMDD-XXXX` (XXXX = 4 upper hex). */
export const BETK_REF_PATTERN = /^BETK-\d{8}-[0-9A-F]{4}$/;

/** Format a betk_ref from a UTC date + a 4-char suffix (mirrors the rpc string build). */
export function formatBetkRef(date: Date, suffix: string): string {
  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `BETK-${y}${m}${d}-${suffix.slice(0, 4).toUpperCase()}`;
}

/** Validate a betk_ref against R-O02. */
export function isValidBetkRef(ref: string): boolean {
  return BETK_REF_PATTERN.test(ref);
}

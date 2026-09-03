/**
 * getDepositHandles — BETK's configured deposit-payment handles, for the
 * `/checkout/confirmation/[id]` instructions panel. Phase 07 / T03.
 *
 * Reads ONLY the 3 handle keys via `settings_payment_config_read` (REG-69
 * literal allow-list) — never `commission_rate_pct`/`return_hold_hours`
 * (those return ZERO ROWS to a non-admin caller, never an error; this query
 * does not even ask for them — E2 discipline, commission is never shown to
 * the buyer). No auth check here (the allow-list itself is `authenticated`-
 * scoped; an anon caller reads zero rows and this resolves to all-null,
 * which the page never reaches because the route is buyer-gated).
 */

import { createClient } from "@/lib/supabase/server";
import { SETTINGS_HANDLE_KEYS, HANDLE_KEY_BY_METHOD } from "../checkoutRules";
import type { CheckoutDepositHandles } from "../types";
import type { CheckoutClient } from "./_shared";

export async function getDepositHandles(client?: CheckoutClient): Promise<CheckoutDepositHandles> {
  const supabase = client ?? (await createClient());

  const { data, error } = await supabase
    .schema("betk")
    .from("admin_settings")
    .select("key, value")
    .in("key", [...SETTINGS_HANDLE_KEYS]);

  if (error) {
    throw new Error(`[checkout] getDepositHandles failed: ${error.message}`);
  }

  const settings: Record<string, string | null> = {};
  for (const r of data ?? []) settings[r.key] = r.value;

  return {
    instapay: settings[HANDLE_KEY_BY_METHOD.instapay] ?? null,
    vodafoneCash: settings[HANDLE_KEY_BY_METHOD.vodafone_cash] ?? null,
    orangeCash: settings[HANDLE_KEY_BY_METHOD.orange_cash] ?? null,
  };
}

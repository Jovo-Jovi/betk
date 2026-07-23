/**
 * getCheckoutContext — everything the /checkout screen (T03) renders for a single
 * confirmed inquiry. Phase 07 / T02b (AC-BUY-6, TRAP 1 resolution).
 *
 * RLS-scoped: the inquiry is read under the caller via `inq_buyer` (buyer/store/
 * admin) then pinned to `buyer_id = self` — a foreign/unknown inquiry reads zero
 * rows → returns **null** (T03 turns that into its per-spec redirect/notFound).
 *
 * SERVER-AUTHORITATIVE amounts: subtotal = listing.price × qty; delivery_fee is
 * READ from admin_settings via `settings_payment_config_read` (REG-69 allow-list —
 * the buyer may read the 4 config keys, NEVER commission_rate_pct); total + the
 * 50/50 split are computed here with the SAME arithmetic the rpc commits
 * (checkoutRules, unit-tested against the SQL). This is a PREVIEW — the rpc
 * re-resolves everything at write time and is the authority.
 *
 * Commission is DELIBERATELY absent from the returned shape (a BETK↔seller concern;
 * the buyer never sees the rate or amount — the DEFINER trigger owns it).
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { getTyped, type StoreDeliveryOptions } from "@/types/jsonb";
import {
  computeCheckoutAmounts,
  parseSettingNumber,
  hasAnyDepositHandle,
  SETTINGS_FEE_KEY,
  SETTINGS_HANDLE_KEYS,
  HANDLE_KEY_BY_METHOD,
} from "../checkoutRules";
import type { CheckoutContext } from "../types";
import type { DeliveryMethodInput } from "@/validations/checkout";
import { resolveCallerUserId, type CheckoutClient } from "./_shared";

const CHECKOUT_SELECT = `
  id, buyer_id, store_id, status, quantity, converted_to_order_id,
  listings ( id, title_ar, title_en, price ),
  stores ( delivery_options )
`;

interface RawListing {
  id: string;
  title_ar: string;
  title_en: string | null;
  price: number | null;
}
interface RawStore {
  delivery_options: Database["betk"]["Tables"]["stores"]["Row"]["delivery_options"];
}
interface RawInquiryRow {
  id: string;
  buyer_id: string;
  store_id: string;
  status: Database["betk"]["Enums"]["inquiry_status"];
  quantity: number | null;
  converted_to_order_id: string | null;
  listings: RawListing | RawListing[] | null;
  stores: RawStore | RawStore[] | null;
}

function asSingle<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

const ALL_DELIVERY_MODES: readonly DeliveryMethodInput[] = ["delivery", "pickup", "remote"];

export async function getCheckoutContext(
  inquiryId: string,
  client?: CheckoutClient,
): Promise<CheckoutContext | null> {
  const supabase = client ?? (await createClient());
  const userId = await resolveCallerUserId(supabase);
  if (!userId) return null;

  const { data, error } = await supabase
    .schema("betk")
    .from("inquiries")
    .select(CHECKOUT_SELECT)
    .eq("id", inquiryId)
    .eq("buyer_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "22P02") return null; // malformed uuid → not-found
    throw new Error(`[checkout] getCheckoutContext failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as RawInquiryRow;
  const listing = asSingle(row.listings);
  const store = asSingle(row.stores);

  // Config keys (settings_payment_config_read allow-list; commission is NOT here).
  const { data: settingsRows, error: settingsErr } = await supabase
    .schema("betk")
    .from("admin_settings")
    .select("key, value")
    .in("key", [...SETTINGS_HANDLE_KEYS, SETTINGS_FEE_KEY]);
  if (settingsErr) {
    throw new Error(`[checkout] getCheckoutContext settings failed: ${settingsErr.message}`);
  }
  const settings: Record<string, string | null> = {};
  for (const r of settingsRows ?? []) settings[r.key] = r.value;

  const deliveryFee = parseSettingNumber(settings[SETTINGS_FEE_KEY]);
  const quantity = row.quantity ?? 1;
  const unitPrice = listing?.price ?? 0;
  const amounts = computeCheckoutAmounts(unitPrice, quantity, deliveryFee);

  const modes = getTyped<StoreDeliveryOptions>(store?.delivery_options ?? {}).modes ?? [];
  const availableDeliveryModes = ALL_DELIVERY_MODES.filter((m) => modes.includes(m));

  return {
    inquiryId: row.id,
    status: row.status,
    convertedToOrderId: row.converted_to_order_id,
    storeId: row.store_id,
    listing: listing
      ? {
          id: listing.id,
          titleAr: listing.title_ar,
          titleEn: listing.title_en,
          unitPrice,
        }
      : null,
    quantity,
    amounts,
    handles: {
      instapay: settings[HANDLE_KEY_BY_METHOD.instapay] ?? null,
      vodafoneCash: settings[HANDLE_KEY_BY_METHOD.vodafone_cash] ?? null,
      orangeCash: settings[HANDLE_KEY_BY_METHOD.orange_cash] ?? null,
    },
    availableDeliveryModes,
    paymentConfigMissing: !hasAnyDepositHandle(settings),
  };
}

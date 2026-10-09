/**
 * quote_validity_hours for the dropped-quote window.
 *
 * Authenticated SELECT on admin_settings is the payment-handle policy only,
 * so the buyer cannot read this key. Same fail-closed read as
 * onboardingSettings, and the same shape send_inquiry_quote accepts
 * (`^[1-9][0-9]*$`, otherwise BETK_QUOTE_VALIDITY_UNCONFIGURED). One key.
 * No numeric fallback.
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

const KEY = "quote_validity_hours";

export async function readQuoteValidityHours(): Promise<number | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .schema("betk")
    .from("admin_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();

  if (error || !data) return null;
  const raw = data.value.trim();
  if (!/^[1-9][0-9]*$/.test(raw)) return null;
  return Number(raw);
}

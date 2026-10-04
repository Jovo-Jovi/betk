/**
 * Onboarding settings the seller cannot read through RLS.
 *
 * `admin_settings` SELECT is admin-only, except the payment-handle policy and
 * `checkout_agreement_version` (the four agreement keys). `seller_category_limit`
 * and `food_requirements` are not on that allow-list. The onboarding page reads
 * these two keys here, and nothing else. An empty category limit fails closed
 * (the same rule as `enforce_store_category_cap`).
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/service";

const CATEGORY_LIMIT_KEY = "seller_category_limit";
const FOOD_LABEL_KEY = "food_requirements";

export type OnboardingSettings =
  | { ok: true; categoryLimit: number; foodLabel: string }
  | { ok: false };

export async function readOnboardingSettings(): Promise<OnboardingSettings> {
  const service = createServiceClient();
  const { data, error } = await service
    .schema("betk")
    .from("admin_settings")
    .select("key, value")
    .in("key", [CATEGORY_LIMIT_KEY, FOOD_LABEL_KEY]);

  if (error || !data) return { ok: false };

  const limitRaw = data.find((row) => row.key === CATEGORY_LIMIT_KEY)?.value ?? "";
  const foodLabel = data.find((row) => row.key === FOOD_LABEL_KEY)?.value ?? "";
  if (!/^[1-9][0-9]*$/.test(limitRaw.trim())) return { ok: false };

  return { ok: true, categoryLimit: Number(limitRaw.trim()), foodLabel };
}

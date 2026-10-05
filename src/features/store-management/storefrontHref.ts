/**
 * D3 (2026-10-05). Seller-console "View my storefront" target.
 *
 * Public predicate: `stores_public` exposes a store to everyone only when
 * `status = 'active'` (supabase/migrations/20260622083131_functions_rls.sql
 * L98–99). Pending, suspended, and any other status stay off the public URL.
 */

import { routes } from "@/constants/routes";

export function sellerStorefrontHref(
  store: { slug: string; status: string } | null,
): string | null {
  if (store?.status !== "active") return null;
  return routes.store(store.slug);
}

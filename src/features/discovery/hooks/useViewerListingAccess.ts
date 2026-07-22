"use client";

/**
 * useViewerListingAccess — CLIENT-ONLY identity check for the Listing Detail
 * page's Inquiry CTA (Phase 06 / T03, FR-BUY-5).
 *
 * WHY CLIENT-ONLY: `/listing/[id]` is deliberately IDENTITY-FREE server-side
 * (anon client, ISR `revalidate=60`, Phase-03 T06 decision) so the page stays
 * cacheable — hydrating per-user state there would force it dynamic. This hook
 * instead reads the session AFTER hydration, via the browser Supabase client
 * (`@/lib/supabase/client`), which never touches the request/response cycle
 * the RSC page's caching depends on.
 *
 * Resolves two things a guest doesn't need and an authed non-owner doesn't
 * either, but the Inquiry CTA needs both to decide what a click does:
 *   - `status`: "loading" | "guest" | "authed" (mirrors the ListingActionButtons
 *     click contract — guests still redirect to /auth/login, unchanged).
 *   - `isOwnListing`: true when the caller is the seller who owns `storeId`
 *     (queried the same way `resolveCallerScope` does server-side —
 *     `stores.seller_id = auth.uid()` — but as a single ownership check
 *     scoped to this exact store, under RLS, no service-role).
 *
 * A seller inquiring on their own listing has no UI_SPEC-pinned behavior
 * (BETK_UI_SPEC.md L107-110); the caller (ListingActionButtons) disables the
 * CTA with a stated reason rather than inventing an affordance.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ViewerListingAccess =
  | { status: "loading"; isOwnListing: false }
  | { status: "guest"; isOwnListing: false }
  | { status: "authed"; isOwnListing: boolean };

export function useViewerListingAccess(storeId: string): ViewerListingAccess {
  const [state, setState] = useState<ViewerListingAccess>({
    status: "loading",
    isOwnListing: false,
  });

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;

      if (!user) {
        setState({ status: "guest", isOwnListing: false });
        return;
      }

      const { data: ownStore } = await supabase
        .schema("betk")
        .from("stores")
        .select("id")
        .eq("seller_id", user.id)
        .eq("id", storeId)
        .maybeSingle();
      if (!active) return;

      setState({ status: "authed", isOwnListing: Boolean(ownStore) });
    })();

    return () => {
      active = false;
    };
  }, [storeId]);

  return state;
}

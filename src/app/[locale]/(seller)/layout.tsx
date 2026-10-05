import { SellerChrome } from "../_components/SellerChrome";
import { getOwnStore } from "@/features/store-management";
import { sellerStorefrontHref } from "@/features/store-management/storefrontHref";

/**
 * Seller console route group layout — wraps /seller, /seller/status, and the
 * store-settings pages (BETK_UI_SPEC §3 "SellerShell (sidebar)"). The seller
 * onboarding entry (/seller/onboarding) is deliberately OUTSIDE this group
 * (UI_SPEC: "AuthShell → wizard"), so it renders chromeless without the console
 * sidebar.
 *
 * The (seller) route group is URL-invisible. The middleware already gates every
 * /seller* route (role=seller + R-S04 status routing); this layout is a pure
 * structural wrapper and does NOT re-implement auth/role/status guards.
 *
 * DS: mounts the frozen ConsoleSidebar (seller variant) via <SellerChrome />
 * (AppChrome pattern). The sidebar is fixed at 260px on desktop (content offset
 * by --sidebar-width) and off-canvas ≤768px (opened from the mobile header).
 * Composition only — no restyle.
 *
 * D3 (2026-10-05): "View my storefront" links to /store/{slug}, shown only
 * when the store is active. The read is getOwnStore
 * (src/features/store-management/queries/getOwnStore.ts). The public
 * predicate is stores_public status = 'active'
 * (supabase/migrations/20260622083131_functions_rls.sql L98–99).
 */

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const store = await getOwnStore();
  const storefrontHref = sellerStorefrontHref(store);

  return (
    <div data-slot="seller-shell" className="min-h-screen">
      <SellerChrome storefrontHref={storefrontHref} />

      <div className="md:ms-[var(--sidebar-width)]">
        <main data-slot="content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

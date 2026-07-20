import { SellerChrome } from "../_components/SellerChrome";

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
 */

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="seller-shell" className="min-h-screen">
      <SellerChrome />

      <div className="md:ms-[var(--sidebar-width)]">
        <main data-slot="content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

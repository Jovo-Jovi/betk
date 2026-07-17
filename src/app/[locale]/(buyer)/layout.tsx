import { AppChrome } from "../_components/AppChrome";

/**
 * Buyer route group layout — wraps all /account /wishlist /orders /inbox etc.
 *
 * The (buyer) route group is URL-invisible (Next.js parallel-routing convention).
 * The T10 middleware already gates every buyer route; this layout is a pure
 * structural wrapper and does NOT re-implement auth/active guards.
 *
 * DS-LAND: mounts the DS shell chrome (AppTopbar + MobileBottomNav) via
 * <AppChrome />. Bottom nav is fixed + md:hidden, so the shell reserves bottom
 * padding on mobile only. Composition only — no restyle.
 */

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-slot="buyer-shell"
      className="flex min-h-screen flex-col pb-[var(--bottom-nav-height)] md:pb-0"
    >
      <AppChrome />

      <main data-slot="content" className="flex-1">
        {children}
      </main>
    </div>
  );
}

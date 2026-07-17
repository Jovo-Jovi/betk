import { AppChrome } from "../_components/AppChrome";

/**
 * PublicShell — layout wrapper for all (public) routes.
 *
 * DS-LAND: the T09 topbar placeholder is replaced by the DS shell chrome
 * (AppTopbar + MobileBottomNav) via <AppChrome />. The bottom nav is fixed and
 * md:hidden, so the shell gets bottom padding on mobile only.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="public-shell"
      className="flex min-h-screen flex-col pb-[var(--bottom-nav-height)] md:pb-0"
    >
      <AppChrome />

      <main data-slot="content" className="flex-1">
        {children}
      </main>
    </div>
  );
}

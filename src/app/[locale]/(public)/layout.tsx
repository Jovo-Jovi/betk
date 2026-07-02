/**
 * PublicShell — layout wrapper for all (public) routes.
 *
 * Placeholder: topbar slot + main content area.
 * Real nav component arrives in Phase 02 (auth) / Phase 03 (discovery).
 * TODO(Phase 02): replace topbar slot with <PublicTopbar /> from features/discovery.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-slot="public-shell" className="flex min-h-screen flex-col">
      {/* Topbar slot — replaced by real nav in Phase 02/03 */}
      <header data-slot="topbar" />

      <main data-slot="content" className="flex-1">
        {children}
      </main>
    </div>
  );
}

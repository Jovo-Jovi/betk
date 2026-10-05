import { ApprovalsChrome } from "./admin/sellers/approvals/_components/ApprovalsChrome";

/**
 * Admin route group for P49. The middleware lets an authenticated non-admin
 * reach the queue page, which calls notFound(). This layout does not gate.
 * Composition only.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="admin-shell" className="min-h-screen">
      <ApprovalsChrome />
      <div className="md:ms-[var(--sidebar-width)]">
        <main data-slot="content" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Auth layout — wraps /auth/login, /auth/verify, /auth/register.
 *
 * Public route group: no session required. Composed from design-system
 * placeholders (Phase DS owns visuals — do not restyle here).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      {children}
    </main>
  );
}

/**
 * Buyer route group layout — wraps all /account /wishlist /orders /inbox etc.
 *
 * The (buyer) route group is URL-invisible (Next.js parallel-routing convention).
 * The T10 middleware already gates every buyer route; this layout is a pure
 * structural wrapper and does NOT re-implement auth/active guards.
 *
 * Phase 02 / T05 placeholder — TODO(Phase DS): inject buyer topbar / nav shell
 * from Claude Design once available.
 */

export default function BuyerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

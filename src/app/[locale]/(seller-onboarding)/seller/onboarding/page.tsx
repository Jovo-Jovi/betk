/**
 * Seller Onboarding entry (/seller/onboarding) — PLACEHOLDER.
 *
 * TODO(Phase 04 T04): replace this with the real 5-step onboarding wizard
 * (Stepper) per BETK_UI_SPEC §3 "Seller Onboarding (5-step)" — Identity /
 * Category / Payment / Delivery / National-ID upload, slug picker, and the
 * become-seller submit action (T03). This file exists NOW only so the
 * middleware auth-only gate has a 200 target to smoke-test against (buyers must
 * reach this route).
 *
 * Placed in its OWN route group `(seller-onboarding)` — NOT under `(seller)` —
 * so it renders chromeless (no console sidebar), matching the UI_SPEC layout
 * "AuthShell → wizard". Middleware gates it to authenticated users only and
 * redirects existing sellers away per status.
 */

export default function SellerOnboardingPage() {
  return (
    <main
      data-slot="onboarding-placeholder"
      className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-2 px-4 py-10 text-center"
    >
      <p className="font-display text-base font-bold text-foreground">Seller onboarding</p>
      <p className="text-sm text-muted-foreground">
        Placeholder — the 5-step onboarding wizard lands in Phase 04 / T04.
      </p>
    </main>
  );
}

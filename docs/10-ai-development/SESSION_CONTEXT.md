# SESSION_CONTEXT.md
> Running state Claude reads at the start of every Cursor session to restore context without relying on chat memory. Update at the end of each session. (Dev OS Step 7 / Memory Guard.)

## Project state
- Phase: **Scope SIGNED & FROZEN (2026-06-13). Ready for Phase 01 — Foundation.**
- Stack: Next.js 15 · Supabase · Tailwind/shadcn · TS strict · Zod · Resend · PostHog · Sentry · Vercel.
- Docs baseline: full Dev OS set in `docs/`. UI Spec = 56 pages; schema = 43 tables.

## Frozen decisions (MVP Freeze Sheet — respect exactly)
- OD-1 low-stock DERIVED (no inventory_alerts table). Schema: NO.
- OD-2 account = DEACTIVATE-only. Schema: YES — add `users.deleted_at`, `users.anonymized_at` (nullable; no MVP behavior beyond deactivation).
- OD-3 broadcast = no campaign entity (fan-out to notifications). Schema: NO.
- OD-4 Google OAuth IN. Schema: YES — `users.phone_number` nullable+UNIQUE; add enum `auth_provider` + `users.auth_provider`. Phone-OTP + Google OAuth sign-in; **verified phone required before transacting** (checkout/become-seller/payout). R-A01 amended.
- OD-5 sessions UI OUT; WhatsApp templates under Admin → Settings → Notifications tab. Schema: NO.
- OD-6 table count = 43 (authoritative inventory in BETK_ERD.md §1.1). Schema: NO.

## Design system (Claude Design) — integrated
- Visual system lives in components/ui + components/shared, OWNED by Claude Design (brief: 00-design/BETK_DESIGN_BRIEF.md). Cursor composes + wires data, never restyles. Phase DS pack: phase-packs/PHASE_DS_DESIGN_SYSTEM.md.
- Placement decision PENDING: Option A early (after Phase 01/03, lower rework, recommended) vs Option B late polish (after Phase 14). Default if unset: Option B (user intent = backend/APIs first).

## Schema deltas to apply in Phase 01 migration (vs C3 baseline)
- migration 003: `CREATE TYPE auth_provider AS ENUM ('phone','google');`
- migration 004 (users): `phone_number` nullable; add `auth_provider NOT NULL DEFAULT 'phone'`, `deleted_at TIMESTAMPTZ NULL`, `anonymized_at TIMESTAMPTZ NULL`.
- Transaction gate: Server Action + RLS WITH CHECK requiring `phone_number IS NOT NULL` on orders/seller_profiles/payouts inserts.
- R-A05 login block also checks `deleted_at IS NULL`.

## Execution model
- Skills auto-attach via `.cursor/rules/*.mdc` (core always-on + glob-scoped DB/actions/ui/tests + agent-requested security/UI reviews). You pick the model only; the core rule flags a model mismatch. Ref: HOW_RULES_AUTORUN.md.

## Last completed
- **Phase 01 / T01 (2026-06-16):** Repo & tooling init complete. Next.js 15.5.19 + React 19 + TypeScript strict + pnpm 9 bootstrapped. All deps installed (Tailwind 3.4, CVA, clsx, tailwind-merge, lucide-react, @supabase/supabase-js, @supabase/ssr, zod, resend, posthog-js, posthog-node, @sentry/nextjs; dev: supabase CLI, vitest, testing-library, jsdom, playwright, eslint, prettier). tsconfig strict + noUncheckedIndexedAccess + `@/*` paths. All scripts present. `pnpm typecheck` clean; `pnpm dev` boots RTL blank app.

## Open issues / blockers
- One assumption to confirm with product: OD-4 resolution = OAuth additive + phone nullable + phone-gated-to-transactions (vs forcing phone OTP during OAuth signup). Default applied as above.

## Next task
- Phase 01 / T02: Directory skeleton (`src/` tree per BETK_CODEBASE_ARCHITECTURE.md §1).

## Update template (append per session)
```
Date | Model | Phase | Task | Files changed | Issues | Next
```

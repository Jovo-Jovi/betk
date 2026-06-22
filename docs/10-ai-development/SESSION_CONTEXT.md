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
- **Phase 01 / T02 (2026-06-16):** Directory skeleton complete. Full `src/` tree per BETK_CODEBASE_ARCHITECTURE.md §1: `app/(public|auth|buyer|seller/seller|admin/admin|api)`; 15 feature folders (`auth discovery buyer-account messaging checkout orders reviews disputes notifications seller-onboarding store-management listings boosts seller-analytics admin`) each with `components/ hooks/ actions/ queries/ types/ index.ts` (with FR/UI-Spec/table traceability headers); `components/ui` + `components/shared`; `lib/supabase` + `lib/utils.ts`; `services hooks types validations constants configs`; `tests/{unit,integration,e2e}`. READMEs added to all top-level folders. `pnpm typecheck` clean.
- **Phase 01 / T03 (2026-06-17):** Design tokens, RTL shell, shadcn wired. `globals.css` — full BETK HSL token set (background/foreground/primary/accent/destructive/muted/secondary/success/warning/card/popover/border/input/ring + `--radius: 0.625rem`) light + dark via `.dark`. `tailwind.config.ts` — all tokens mapped `hsl(var(--token))`, borderRadius lg/md/sm/full, BETK type scale (display/h1/h2/h3), semantic shadow aliases (card/card-hover/dialog), font-family entries. `app/layout.tsx` — Cairo + IBM Plex Sans Arabic + IBM Plex Mono via `next/font/google`; CSS vars `--font-cairo/ibm-plex-sans-arabic/ibm-plex-mono` injected on `<html>`. `components.json` — shadcn config (style=default, rtl=true, baseColor=neutral, cssVariables=true, aliases wired). `constants/statusColors.ts` — full StatusBadge color map (8 domains × all enum values → bg+fg class pairs). Note: tailwindcss-rtl plugin NOT needed — Tailwind 3.3+ has built-in logical utilities (ps-*/pe-*/ms-*/me-*/start-*/end-*). `pnpm typecheck` clean.
- **Phase 01 / T04 (2026-06-17):** Supabase clients + local dev setup. `src/configs/env.ts` — Zod loader with `server-only` guard; splits `clientEnv` (NEXT_PUBLIC_*) from `serverEnv` (service key + secrets); throws on missing vars. `src/lib/supabase/client.ts` — `createBrowserClient` (anon key, RLS applies). `src/lib/supabase/server.ts` — async `createServerClient` cookie-bound via `next/headers`. `src/lib/supabase/service.ts` — `createServiceClient` with `server-only` guard + SERVICE_ROLE comment. `src/lib/supabase/types.ts` — placeholder `Database` type (regenerate after first migration). `.env.example` — all 17 var names, no values. `supabase init` run; `supabase/` dir created. `.env.local` confirmed git-ignored. `pnpm typecheck` clean.
- **Phase 01 / T05 (2026-06-22, Opus 4.8):** Database migrations — DONE on **staging**. 13 FK-safe files `supabase/migrations/0001..0013` split from the authoritative `BETK_DATABASE_SCHEMA.sql` (now complete, 1256 lines), source statement order preserved. Applied via Supabase MCP `apply_migration`. Verified: **43 tables**, **34 RLS policies** (31 + 3 OD-4 RESTRICTIVE phone-gate on orders/seller_profiles/payouts INSERT), **6 pg_cron**, **4 triggers**, seeds (3 boost_packages, 11 admin_settings). `betk.users` freeze deltas confirmed (phone_number nullable+UNIQUE; auth_provider NOT NULL DEFAULT 'phone'; deleted_at/anonymized_at nullable). `pnpm db:types` regenerated `types.ts`; `pnpm typecheck` clean.
- **Phase 01 / T06 (2026-06-22, Sonnet 4.6):** Categories taxonomy seed — DONE. New CLI-managed migration `20260622091700_categories_seed.sql` created and applied via `supabase db push`. 8 top-level categories + 31 subcategories (39 total), sized for Egypt's informal creative economy. Self-referential `parent_id` resolved via slug join; fully idempotent (ON CONFLICT DO NOTHING). `migration list` confirms `20260622091700` present in both Local and Remote — 14 migrations total, no orphans. Boost_packages (3) and admin_settings (11) confirmed already seeded in 0008; no duplicates added. CLI discovery finding: `npx supabase` JS wrapper hangs on startup in this env; direct binary at `node_modules/.pnpm/@supabase+cli-windows-x64@2.106.0/.../supabase.exe` works reliably — use for all future CLI calls.

## Open issues / blockers
- One assumption to confirm with product: OD-4 resolution = OAuth additive + phone nullable + phone-gated-to-transactions (vs forcing phone OTP during OAuth signup). Default applied as above.
- **T05 finding — stock-decrement trigger missing from source:** BETK_ERD §7 / Phase-01 DoD list 5 triggers, but `BETK_DATABASE_SCHEMA.sql` defines only 4 (search_vector, review edit_deadline, dispute SLA, rating recompute). The `decrement_stock_on_confirm` trigger (R-L05/06) was NOT invented (FROM-FILE-ONLY). DB owner to add it to the source + a new migration if required.
- **T05 finding — grants not in source:** `0013_grants.sql` is standard Supabase role-grant boilerplate (step 057), the only non-verbatim file. Also: `betk`/`betk_analytics` must be added to `supabase/config.toml [api].schemas` before the Data API can reach them.
- **T05 finding — security advisors (hardening, for security gate):** ~21 tables are RLS-enabled-no-policy (default-deny, parent-scoped — remaining policies arrive in T08/later phases per C3 §5); `function_search_path_mutable` on the 6 functions; `extension_in_public` for pg_trgm/unaccent. All match the verbatim source; address during the 90-review-security gate.

## Next task
- Phase 01 / T07: JSONB interfaces + enum constants (`types.ts` already current from T05). Create `constants/enums.ts` re-exporting every enum literal union from C3 §2 (incl. `auth_provider`). Create `src/types/jsonb.ts` with hand-written interfaces over the generated `Json` type. Add `getTyped<T>()` helper. Ensure `statusColors.ts` keys match. Then T08 (Opus RLS verification harness).

## Update template (append per session)
```
Date | Model | Phase | Task | Files changed | Issues | Next
```

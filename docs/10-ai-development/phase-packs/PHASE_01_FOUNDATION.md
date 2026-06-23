# PHASE 01 — FOUNDATION · Task Pack
> Execution pack for `BETK_PHASES.md` Phase 01. Drives Opus/Sonnet in Cursor. Every prompt assumes `.cursorrules` + `BETK_MASTER_EXECUTION_PROMPT.md` + `SESSION_CONTEXT.md` are already loaded (they are, via .cursorrules). Build in task order — later tasks depend on earlier. No app features yet; this phase makes the skeleton, the database, and the wiring correct.

> **AS-BUILT ANNOTATIONS (added 2026-06-23).** Each task below keeps its **canonical prompt** unchanged as the spec of record. Where the prompt was expanded for execution to fit concrete repo-state facts, an **▸ EXPANDED FOR EXECUTION** block holds the prompt actually run, and an **▸ AS-BUILT** line records what shipped + any carry-forward. Rule applied throughout: *an expanded prompt supersedes the canonical default only when it addresses a concrete repo-state fact (e.g. a file already built, an auth mechanism the default omits); otherwise the canonical prompt is run verbatim.* Phase 01 status: **T01–T13 COMPLETE; T14 (Opus exit review) pending.**

## Objectives
Repo + tooling · design tokens/RTL shell · Supabase clients · **full migration incl. MVP-freeze deltas** · type generation · services scaffolding · auth middleware skeleton · CI gates. Exit when: app boots RTL; all 43 tables + RLS + indexes + triggers + pg_cron live in a staging Supabase; `types.ts` generated; CI green.

## Stack versions (pin these)
Next.js 15 (App Router, React 19) · TypeScript strict · Tailwind v3.4 + logical RTL utilities · shadcn/ui · `@supabase/supabase-js` + `@supabase/ssr` · Zod · Resend · PostHog (`posthog-js`/`posthog-node`) · `@sentry/nextjs` · Vitest + Testing Library · Playwright · Supabase CLI (dev dep). NO ORM, NO microservices (ADR-001).

## Definition of done (Phase 01 exit checklist)
- [ ] `pnpm dev` boots a blank app with `<html dir="rtl" lang="ar">`, fonts + tokens applied.
- [ ] Supabase staging project provisioned; all migrations applied in order; **freeze deltas present** (`auth_provider` enum; `users.phone_number` nullable; `users.auth_provider/deleted_at/anonymized_at`).
- [ ] 43 tables across `betk` + `betk_analytics`; 34 indexes; 5 triggers; 22 RLS policies + 2 helper functions; 6 pg_cron jobs; seeds (boost_packages, admin_settings, categories).
- [ ] `src/lib/supabase/types.ts` generated from the live schema and committed.
- [ ] `middleware.ts` gates routes by group + role and blocks suspended/deactivated users.
- [ ] Services (`resend/posthog/sentry/whatsapp/sms/courier`) scaffolded as typed wrappers (no real sends yet).
- [ ] CI runs lint → typecheck → test → types-drift → build and blocks on failure.
- [ ] RLS default-deny smoke test passes (anon cannot read a draft listing; can read an active one).

---

## T01 — Repo & tooling init
- **Model:** Sonnet 4.6 · **Skill:** skill-nextjs-engineer
- **Prompt:**
```
Initialize the BETK repo per docs/02-architecture/BETK_CODEBASE_ARCHITECTURE.md and BETK_ARCHITECTURE.md.
Create a Next.js 15 App Router project (TypeScript strict, React 19, pnpm). Add Tailwind v3.4 + postcss + autoprefixer, class-variance-authority, clsx, tailwind-merge, lucide-react. Add deps: @supabase/supabase-js, @supabase/ssr, zod, resend, posthog-js, posthog-node, @sentry/nextjs. Dev deps: supabase (CLI), vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @playwright/test, eslint, prettier, eslint-config-next, typescript.
tsconfig: strict true, noUncheckedIndexedAccess true, paths "@/*" -> "src/*".
Add scripts: dev, build, start, lint, typecheck (tsc --noEmit), test (vitest), test:e2e (playwright), db:types (supabase gen types). Do not scaffold any feature pages yet.
```
- **Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `.eslintrc`, `.prettierrc`, `postcss.config.js`.
- **Done when:** `pnpm install && pnpm dev` boots an empty Next app; `pnpm typecheck` passes.
- **▸ AS-BUILT (2026-06-16, Sonnet):** Canonical prompt run verbatim. Next.js 15.5.19 + React 19 + TS strict + pnpm 9; all deps + dev deps installed; tsconfig strict + noUncheckedIndexedAccess + `@/*`; all scripts present. `pnpm typecheck` clean; `pnpm dev` boots RTL blank app.

## T02 — Directory skeleton
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer
- **Prompt:**
```
Create the exact folder skeleton from docs/02-architecture/BETK_CODEBASE_ARCHITECTURE.md §1 under src/:
app/(public) (auth) (buyer) (seller)/seller (admin)/admin api ; features/ with the listed feature folders, each containing empty components/ hooks/ actions/ queries/ types/ index.ts ; components/ui (shadcn target) components/shared ; lib/supabase ; services ; hooks ; types ; validations ; constants ; configs ; tests/{unit,integration,e2e}. Add a README in each top-level folder stating its purpose and that feature folders map to UI Spec areas. Do NOT create any pages/components beyond placeholders.
```
- **Files:** the tree (empty `index.ts` + READMEs).
- **Done when:** tree matches the codebase doc; `pnpm typecheck` clean.
- **▸ AS-BUILT (2026-06-16, Sonnet):** Canonical prompt run verbatim. Full `src/` tree; 15 feature folders each with components/hooks/actions/queries/types/index.ts + FR/UI-Spec/table traceability headers; READMEs on all top-level folders. `pnpm typecheck` clean.

## T03 — Design tokens, RTL shell, shadcn
- **Model:** Sonnet · **Skill:** skill-ui-engineer · **Source:** UI Spec §1
- **Prompt:**
```
Implement the BETK design system from docs/00-design/BETK_UI_SPEC.md §1.
1) Configure Tailwind with the color CSS variables (background, foreground, primary, accent, destructive, muted, success, warning, border, ring) as HSL tokens in globals.css for light + dark; map them in tailwind.config (theme.extend.colors using hsl(var(--token))). 2) Radius 0.625rem; type scale per spec; shadows sm/md/lg. 3) RTL-first: set up logical-property usage (prefer ps/pe/ms/me); add tailwindcss-rtl OR document the logical-utility convention. 4) Load fonts: Cairo (display), IBM Plex Sans Arabic (body), IBM Plex Mono (mono) via next/font; expose --font-display/body/mono. 5) Run shadcn init targeting components/ui; set the base color to neutral and wire it to our CSS vars (do not let shadcn overwrite our token names). Add a StatusBadge color map stub in constants/statusColors.ts keyed by the C3 enums (order/seller/dispute/payment/boost/listing/flag/payout) — values only, no component yet.
Do not edit components/ui after generation; extensions go in components/shared.
```
- **Files:** `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx` (fonts only), `components.json`, `constants/statusColors.ts`.
- **Done when:** tokens resolve; a sample `bg-primary text-primary-foreground` renders; RTL layout direction correct.
- **▸ AS-BUILT (2026-06-17, Sonnet):** Canonical prompt run verbatim. Full HSL token set (light + dark via `.dark`) in globals.css; tailwind.config maps all tokens, radius lg/md/sm/full, BETK type scale, semantic shadow aliases; Cairo + IBM Plex Sans Arabic + IBM Plex Mono via next/font; components.json (rtl=true, baseColor=neutral, cssVariables=true); statusColors.ts full 8-domain map. **Deviation (accepted):** `tailwindcss-rtl` NOT installed — Tailwind 3.3+ ships built-in logical utilities (ps/pe/ms/me/start/end), which the prompt explicitly allowed as the "document the convention" branch. `pnpm typecheck` clean. **NOTE for T09:** this task created `app/layout.tsx` (fonts/RTL) — T09 must EXTEND it, not rebuild.

## T04 — Supabase clients + local dev
- **Model:** Sonnet · **Skill:** skill-supabase-engineer, skill-database-engineer
- **Prompt:**
```
Set up Supabase per docs/02-architecture/BETK_ARCHITECTURE.md §2.
Create src/lib/supabase/client.ts (browser, @supabase/ssr createBrowserClient, anon key), server.ts (createServerClient bound to next/headers cookies for RSC + Server Actions), service.ts (service-role client, server-only, with a top-of-file comment: "BYPASSES RLS — never import in client code; re-check ownership in code"). Add a Zod-validated env loader in configs/env.ts that parses process.env against docs/08-deployment/BETK_CONFIGURATION.md and throws on missing required vars; never expose service key to client. Initialize `supabase init` for local dev and link to the staging project. Add .env.example with all keys from CONFIGURATION (no values).
```
- **Files:** `lib/supabase/{client,server,service}.ts`, `configs/env.ts`, `.env.example`, `supabase/config.toml`.
- **Done when:** clients compile; env loader rejects a missing var; service client is server-only (lint guard in T13).
- **▸ AS-BUILT (2026-06-17, Sonnet):** Canonical prompt run verbatim. `configs/env.ts` Zod loader with `server-only` guard, splits clientEnv/serverEnv, throws on missing; client.ts (browser anon), server.ts (async cookie-bound), service.ts (server-only + BYPASSES-RLS comment); types.ts placeholder; `.env.example` 17 var names. `supabase init` run; `.env.local` git-ignored. `pnpm typecheck` clean. **Carry-forward (resolved T11):** required-vs-optional env split was later loosened so service-integration keys are optional (wrappers no-op without keys); core trio (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_KEY`) stayed required.

## T05 — Migrations (full schema + FREEZE DELTAS)  ← the critical task
- **Model:** **Opus 4.8** (DB architect/review) · **Skill:** skill-database-engineer, skill-supabase-engineer · **Source:** `BETK_DATABASE_SCHEMA.sql`, `BETK_ERD.md`, C3 §3/§7
- **Prompt:**
```
Author Supabase migrations under supabase/migrations/ reproducing the full BETK schema from docs/03-database/BETK_DATABASE_SCHEMA.sql and Architecture Conversation 3 §3, in the dependency order of C3 §7 (057 steps), APPLYING the MVP-freeze deltas in SESSION_CONTEXT and BETK_ERD.md §1.2/§5. Group into the migration files listed below. Reproduce every CREATE TABLE verbatim from C3 §3 (all columns/constraints) — do not abbreviate. Resolve the inquiries.converted_to_order_id ↔ orders circular FK via ALTER after both exist. Enforce all DB-layer contract points (unique/check/append-only) from BETK_DATABASE_SCHEMA.sql. Apply to staging and confirm 43 tables exist.
FREEZE DELTAS (must be present, exactly):
- In the enum migration: CREATE TYPE auth_provider AS ENUM ('phone','google');
- betk.users: phone_number VARCHAR(15) UNIQUE NULL  (was NOT NULL);
             add auth_provider auth_provider NOT NULL DEFAULT 'phone';
             add deleted_at TIMESTAMPTZ NULL;
             add anonymized_at TIMESTAMPTZ NULL.
- Transaction gate: on orders/seller_profiles/payouts, add RLS WITH CHECK requiring the acting user has phone_number IS NOT NULL (plus existing ownership). (App layer also enforces in Server Actions — later phases.)
- is_admin() unchanged; login-block logic (later) also checks deleted_at IS NULL.
```
- **Migration file grouping (FK-safe):**
  | File | Steps (C3 §7) | Notes |
  |---|---|---|
  | `0001_extensions_schemas_enums.sql` | 001–003 | + `auth_provider` enum (delta) |
  | `0002_identity.sql` | 004–006 | **users with freeze deltas**, otp_tokens, sessions |
  | `0003_user_seller_store.sql` | 007–013 | buyer_profiles, addresses, seller_*, stores, store_follows |
  | `0004_catalog.sql` | 014–019 | categories…restock_alerts |
  | `0005_messaging_orders.sql` | 020–027 | inquiries, messages, orders, ALTERs (circular FK), order_items, status_history |
  | `0006_payments_delivery.sql` | 028–031 | payments, payouts, shipments, tracking_events |
  | `0007_reviews_disputes.sql` | 032–037 | reviews, photos, rating_aggregates, disputes, evidence, messages |
  | `0008_boosts_admin_analytics.sql` | 038–050 | boost_packages(+seed), boosts, notifications, collections, flagged_content, moderation_logs, whatsapp_templates, admin_settings(+seed), analytics |
  | `0009_triggers.sql` | 051 | search_vector, review deadline, dispute SLA, rating recompute, stock decrement |
  | `0010_indexes.sql` | 052 | all 34 (BETK_ERD §4) |
  | `0011_functions_rls.sql` | 053–055 | is_admin(), my_store_id(); ENABLE RLS; 22 policies + transaction-gate WITH CHECKs |
  | `0012_cron.sql` | 056 | 6 pg_cron jobs (Africa/Cairo) |
  | `0013_grants.sql` | 057 | anon, authenticated, service_role |
- **Files:** the 13 migration files.
- **Done when:** `supabase db push` (staging) succeeds; `SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('betk','betk_analytics')` = 43; freeze deltas verified via `\d betk.users`.
- **▸ AS-BUILT (2026-06-22, Opus 4.8):** Canonical prompt run; built FROM-FILE-ONLY from the authoritative `BETK_DATABASE_SCHEMA.sql` (1256 lines), source order preserved. 13 FK-safe migration files `0001..0013` applied to **staging** via Supabase **MCP** `apply_migration` (not `db push` — MCP path used for the timestamped remote apply). Verified: 43 tables, 34 RLS policies (31 + 3 OD-4 **RESTRICTIVE** phone-gate on orders/seller_profiles/payouts INSERT), 6 pg_cron, **4 triggers**, seeds (3 boost_packages, 11 admin_settings). users freeze deltas confirmed. types.ts regenerated; typecheck clean.
  - **Findings (carry-forward):** (1) **stock-decrement trigger missing from source** — DoD/ERD §7 say 5 triggers, SQL defines only 4 (no `decrement_stock_on_confirm`); NOT invented; DB owner to add to source + migration. (2) `0013_grants.sql` is standard role-grant boilerplate (only non-verbatim file); `betk`/`betk_analytics` must be in `config.toml [api].schemas` — **verified reachable on staging in T11.** (3) Security advisors (RLS-enabled-no-policy on ~21 tables = default-deny by design; `function_search_path_mutable`; `extension_in_public`) — address at security gate.

## T06 — Seed data
- **Model:** Sonnet · **Skill:** skill-database-engineer
- **Prompt:**
```
Add seed inserts (in 0008 or supabase/seed.sql): boost_packages (24h/EGP20, 48h/EGP50, 72h/EGP100, sort_order, is_active true); admin_settings defaults (seller_approval_sla_hours=24, dispute_sla_hours=48, low_stock_default=3, auto_flag_keywords=[], with CHECK on numeric keys per C3 §8.2 RISK 2); a starter categories taxonomy (top-level + a few subcategories with slugs/icons) sized for Egypt's informal creative economy. Idempotent (ON CONFLICT DO NOTHING).
```
- **Done when:** seeds present on staging; packages/settings/categories queryable.
- **▸ AS-BUILT (2026-06-22, Sonnet):** boost_packages (3) + admin_settings (11) already seeded in migration 0008 (T05); this task added **categories only**. New **CLI-first** migration `20260622091700_categories_seed.sql` applied via `supabase db push`: 8 top-level + 31 sub = 39 categories, parent_id resolved by slug join, idempotent (ON CONFLICT DO NOTHING). `migration list` = 14 rows, Local==Remote, no orphans. **Env finding (standing):** `npx supabase` wrapper hangs in this env; use the direct binary `node_modules/.pnpm/@supabase+cli-windows-x64@2.106.0/.../supabase.exe` for all CLI calls. **Migration-path convention set here:** MCP applied the T05 remote timestamped set; CLI-first `db push` is the going-forward standard for developer-owned migrations.

## T07 — Type generation + JSONB interfaces + enum constants
- **Model:** Sonnet · **Skill:** skill-database-engineer
- **Prompt:**
```
Run `supabase gen types typescript --linked --schema betk,betk_analytics > src/lib/supabase/types.ts` and commit. Create constants/enums.ts re-exporting every enum literal union from C3 §2 (mirror exactly, incl. auth_provider). Create src/types/jsonb.ts with hand-written interfaces over the generated Json type: StorePaymentMethods {instapay_handle?, vodafone_cash?, orange_cash?, cod_enabled}, StoreDeliveryOptions, NotificationPrefs {push,sms,whatsapp,email}, NotificationData. Add a typed helper getTyped<T>(json) for JSONB columns. Ensure StatusBadge color map keys (constants/statusColors.ts) match the enums.
```
- **Done when:** `types.ts` reflects 43 tables incl. freeze columns; `pnpm typecheck` clean; CI types-drift (T13) green.
- **▸ AS-BUILT (2026-06-22, Sonnet):** types.ts already current from T05. **Deviation (accepted):** `enums.ts` derives every alias from `Database["betk"]["Enums"]` rather than hand-writing literal unions — eliminates drift, still satisfies "mirror exactly." `jsonb.ts` four interfaces (StorePaymentMethods, StoreDeliveryOptions, NotificationPrefs, NotificationData) + `getTyped<T>()`. statusColors.ts keys tightened to `Record<EnumType, StatusColorPair>` → compile-enforces exhaustive coverage. typecheck clean.
  - **Findings (all resolved by T12):** enum count reported 32 here → **actual 34** confirmed via `pg_type` in T12 (`doc_type` + `doc_review_status` were real, derived correctly; the "32" was a count error). `BETK_ERD §9` (said 30) corrected to 34. `betk_analytics` had no additional enums. `StoreDeliveryOptions.modes` mirrors store-side enum (self_deliver/bosta/pickup/remote), distinct from buyer-side delivery_method — verify before Phase 04/07 consume it.

## T08 — RLS verification harness
- **Model:** **Opus** (security) · **Skill:** skill-security-reviewer · **Source:** BETK_ERD §3, C3 §5
- **Prompt:**
```
Write an integration test (tests/integration/rls.smoke.test.ts) against a test Supabase project that asserts default-deny and core policies: anon CANNOT select a draft/soft-deleted listing but CAN select an active one; a buyer cannot read another buyer's orders; my_store_id()/is_admin() resolve; a non-phone (Google) user is rejected by the transaction-gate WITH CHECK on an orders insert while a phone-verified user passes ownership. Use a deterministic seed honoring RLS; never touch production.
```
- **Done when:** RLS smoke test passes; documents any policy gap as a finding (block if default-deny fails).
- **▸ EXPANDED FOR EXECUTION** — the canonical prompt omits *how* to get a per-user auth context under an OTP-only app. Use GoTrue admin directly (no JWT secret needed). Prompt actually run:
```
Write an RLS verification harness at tests/integration/rls.smoke.test.ts (Vitest) per BETK_ERD.md §3 and C3 §5. Run against the STAGING Supabase project — never production. Deterministic, idempotent seed; tear down all fixtures (incl. auth.users rows) in afterAll.

Auth setup (OTP-only app, but use GoTrue admin directly for tests):
- Read keys via configs/env.ts (serverEnv: SUPABASE_SERVICE_KEY; clientEnv: NEXT_PUBLIC_SUPABASE_URL/ANON_KEY) — not raw process.env.
- Service-role client (lib/supabase/service.ts) seeds fixtures, bypassing RLS.
- For each actor: auth.admin.createUser({ email, email_confirm: true, password }) to mint an auth.users row, then insert the matching betk.users row (same id) with the actor's phone_number/auth_provider/role/status.
- Per-actor RLS context = a fresh createClient(anon) that calls signInWithPassword({ email, password }); its session drives auth.uid().
- Also keep one pure anon client (no session).
- afterAll: delete betk fixture rows, then auth.admin.deleteUser for each created auth user.

Deterministic fixtures: Buyer A (phone set), Buyer B (phone set), Google user G (auth_provider='google', phone_number NULL), Admin (role='admin', status='active'). One active store; listings in active/draft/soft-deleted states; one order owned by Buyer A.

Assertions (log PASS/FAIL with table + policy): 1. anon CAN read active listing, CANNOT read draft/soft-deleted (default-deny). 2. Buyer B CANNOT read Buyer A's order (empty/not-found, no error leak). 3. is_admin() true for Admin/false for buyers; my_store_id() returns seeded store for owner. 4. OD-4 gate (3 RESTRICTIVE phone-gate WITH CHECKs): Google G (phone NULL) REJECTED on orders INSERT; phone-verified actor PASSES. 5. (optional) non-admin UPDATE/DELETE on moderation_logs/order_status_history denied.

If assertion 1 fails, BLOCK the phase + emit a finding. Capture any policy gap as a written finding (e.g. the ~21 RLS-enabled-no-policy tables, missing decrement_stock_on_confirm trigger) rather than silently passing.
CLI note: use the direct supabase binary, not npx (wrapper hangs).
```
- **▸ AS-BUILT (2026-06-22, Opus 4.8):** 6 tests, 5 PASS / 0 FAIL, green vs staging; default-deny holds → phase not blocked. Added STAGING_GUARD project-ref allow-list, per-run unique-suffix idempotency, full auth.users teardown (0 residue verified). Created vitest.config.ts (`@`→src, `server-only`→no-op stub, node env, serial) + tests/setup/env.ts (loads .env.local into test runtime). Assertion 5 made opt-in (`RLS_TEST_APPEND_ONLY=1`) to protect teardown.
  - **MATERIAL carry-forward (Phase 04/07):** the OD-4 phone-gate is **RESTRICTIVE-only with no PERMISSIVE ownership INSERT policy on `orders` and `seller_profiles`** → ALL authenticated inserts to those two tables are currently default-denied. The positive gate path was proven on `payouts` (which has both a permissive `payouts_insert` grant + the restrictive gate) — **`payouts` is the working model.** Phase 07 (checkout/orders) MUST add a permissive ownership INSERT policy to `orders`; Phase 04 (become-seller) MUST add one to `seller_profiles`, else checkout/onboarding hit a silent default-deny. Also: assertion 4's orders-negative passes via default-deny, not the gate itself — gate's *denying* effect is not isolated (optional hardening: payouts negative with a phone-NULL store owner).

## T09 — Root layout, providers, RTL shell
- **Model:** Sonnet · **Skill:** skill-ui-engineer, skill-nextjs-engineer
- **Prompt:**
```
Build app/layout.tsx as the RTL Arabic root: <html dir="rtl" lang="ar">, fonts from T03, globals, and providers — Sentry (client init), PostHog (client provider, no PII), and a Toaster (shadcn) host. Add app/(public)/layout.tsx (PublicShell placeholder: topbar slot + content), and empty loading.tsx/error.tsx/not-found.tsx at the root using EmptyState/ErrorRetryCard placeholders per docs/standards/UI_STATE_STANDARDS.md. No real pages.
```
- **Files:** `app/layout.tsx`, `app/(public)/layout.tsx`, root `loading/error/not-found.tsx`, `services/sentry.ts`+`posthog.ts` init hooks.
- **Done when:** app boots RTL with providers mounted; no console errors.
- **▸ EXPANDED FOR EXECUTION** — canonical says "Build app/layout.tsx," but T03 already built it (fonts/RTL); "build" risks a clobber. Also flag shared-component placeholders as Phase-DS-owned. Prompt run:
```
EXTEND the existing app/layout.tsx (RTL <html dir="rtl" lang="ar"> + the three fonts/CSS vars are already in place from T03 — do not overwrite). Add: Sentry client init, a PostHog client provider (no PII, user id only), a shadcn Toaster host. Keep providers as small "use client" leaves; layout stays a Server Component.
Add app/(public)/layout.tsx (PublicShell placeholder: topbar slot + content). Add root loading.tsx/error.tsx/not-found.tsx wired to EmptyState/ErrorRetryCard per UI_STATE_STANDARDS.
IMPORTANT: EmptyState + ErrorRetryCard live in components/shared = Claude-Design-owned (Phase DS). Create them ONLY as minimal unstyled placeholders marked TODO(Phase DS) — no visual design, no hardcoded colors. No real pages.
```
- **▸ AS-BUILT (Sonnet):** layout.tsx kept as RSC with T03 fonts/RTL intact; providers (SentryProvider, PostHogProvider, Toaster) as client leaves; PostHog autocapture off + identified_only + manual pageview; both no-op without keys. Shared placeholders marked TODO(Phase DS). `components/ui/sonner.tsx` (RTL-aware Toaster). typecheck + lint clean.
  - **Findings:** (1) **Sentry was browser-only** (`Sentry.init` in a client provider) → server/edge/Server-Action errors uncaptured. **Fixed pre-T10** by re-wiring to the current `@sentry/nextjs` instrumentation pattern (instrumentation-client.ts + sentry.server.config.ts + sentry.edge.config.ts + instrumentation.ts `register()`/`onRequestError`), all four placed under **`src/`** (required for src-dir auto-detection; verified `register()` fires runtime=nodejs). SentryProvider reduced to passthrough with TODO(Phase 02) for `setUser`. (2) **T11 collision** — this task created `services/sentry.ts` + `services/posthog.ts` early; T11 must EXTEND not recreate (it did). (3) `withSentryConfig` on next.config still TODO (source-map upload/tunneling) → deploy phase.

## T10 — Auth middleware skeleton
- **Model:** **Opus** (security review) / Sonnet (impl) · **Skill:** skill-security-reviewer, skill-nextjs-engineer
- **Prompt:**
```
Implement src/middleware.ts per BETK_ARCHITECTURE §4 and BETK_PHASES Phase 02 boundary (skeleton only — no OTP UI yet). Use @supabase/ssr to read the session. Gate route groups: (public) open; (buyer) requires auth; (seller)/seller requires role=seller (route pending/rejected sellers to /seller/status); (admin)/admin requires is_admin(). Block users whose users.status != 'active' OR deleted_at IS NOT NULL (R-A05) -> redirect to a blocked page. Leave the verified-phone transaction gate as a documented TODO to be enforced in checkout/seller/payout Server Actions (Phase 04/07/13), referencing OD-4. Do not build login pages here.
```
- **Files:** `src/middleware.ts`, `app/blocked/page.tsx` (minimal).
- **Done when:** unauth access to a (buyer) route redirects to login route; role gates compile; deactivated-user block path exists.
- **▸ EXPANDED FOR EXECUTION** — canonical run essentially verbatim, tightened to repo facts (getUser not getSession; single indexed read; src/ layout). The Sentry "Part B" originally folded here was already done pre-T10, so T10 ran **middleware-only**. Prompt run:
```
Implement src/middleware.ts (skeleton only — no OTP UI, no login pages). Use @supabase/ssr; refresh session via the mutable-cookie pattern; call getUser() (revalidates with Auth server) before gating.
Gates: (public) open; (buyer) requires auth → unauth redirect to login with returnUrl; (seller)/seller requires role=seller, route pending/rejected → /seller/status; (admin)/admin requires is_admin() (role IN admin/superadmin AND status active).
Block (R-A05): status != 'active' OR deleted_at IS NOT NULL → /blocked. Single indexed betk.users(role,status,deleted_at) read on protected routes only; public routes never hit DB. Missing-profile/read-error → login (no leak).
Transaction gate (OD-4): documented TODO only (enforced in Server Actions Phase 04/07/13). Add app/blocked/page.tsx (minimal, reuse EmptyState placeholder). Matcher excludes _next + static.
```
- **▸ AS-BUILT (Opus 4.8):** As specified. `getUser()` (not getSession), refreshed cookies copied across redirects, public routes skip DB, fail-closed to login on missing-profile/read-error. `role IN ('admin','superadmin')` is exact-equivalent to `is_admin()` here only because the block-check runs first (status='active' already guaranteed) — **keep that ordering invariant.** Wrong-role-but-active → redirect to `/` (middleware can't render not-found; leaks nothing). typecheck + lint clean.
  - **Findings:** (1) middleware's live `betk.users` read depends on Data-API schema exposure → **verified on staging in T11** (anon transport reaches `betk`, 0 rows + no PGRST106; service-role round-trip matches gate's read shape; authenticated self-read proven in T08). T05 schema-exposure finding now **resolved**. (2) **Phase 02 TODO:** validate `returnUrl` is a local path (starts `/`, not `//` or full URL) before redirect — open-redirect guard; comment left at redirect site.

## T11 — Service wrappers (typed stubs)
- **Model:** Sonnet · **Skill:** skill-supabase-engineer, skill-api-architect
- **Prompt:**
```
Create typed wrappers in src/services/: resend.ts (sendEmail(to,template,vars)), posthog.ts (capture(event,props)), sentry.ts (captureError/tag), whatsapp.ts (sendTemplate(name,to,vars) — enforces approved-template-only per R-N02, reads whatsapp_templates), sms.ts (sendSms(to,body) for OTP + SLA alerts), courier.ts (createShipment/getTracking — Bosta interface). All read keys via configs/env.ts; in Phase 01 they are wired but guarded to no-op/log in non-production. No business logic.
```
- **Done when:** wrappers compile; misconfigured keys fail safe (log, no throw in dev).
- **▸ EXPANDED FOR EXECUTION** — `sentry.ts` + `posthog.ts` already exist from T09; must EXTEND not recreate. Prompt run:
```
Create typed service wrappers in src/services/. All keys via configs/env.ts; non-production = log + no-op, never throw. No business logic.
EXTEND (exist from T09, keep exports): sentry.ts — add tag/feature-context helper (feature+role tags, ARCHITECTURE §6). posthog.ts — add server capture(event,props) (posthog-node) + identify-by-user-id; no PII beyond user id.
CREATE: resend.ts sendEmail(to,template,vars) typed template names; whatsapp.ts sendTemplate(name,to,vars) enforcing approved-template-only (R-N02) by reading whatsapp_templates; sms.ts sendSms(to,body); courier.ts createShipment/getTracking (Bosta interface, typed stubs).
```
- **▸ AS-BUILT (Sonnet):** T09 exports preserved (`SENTRY_INIT_OPTIONS`/`captureError`, `POSTHOG_CONFIG`). sentry.ts +setTag/setFeatureContext/captureMessage/captureTaggedError. posthog.ts +captureServerEvent/identifyUser via lazy `require('posthog-node')` (keeps node out of client bundle). whatsapp.ts does **live** R-N02 enforcement (queries betk.whatsapp_templates, rejects unapproved/inactive). resend/sms/courier created with no-op-without-key. typecheck + lint clean.
  - **env reconciliation (correct):** service-integration keys made optional (wrappers no-op without them — the no-op path is unreachable if the loader throws at boot). Core trio stays required & fail-fast. **Carry-forwards:** (1) `GOOGLE_CLIENT_ID/SECRET` optional now (unused pre-auth) → **re-tighten to required in Phase 02** when OAuth Server Actions land. (2) Deploy-phase TODO: NODE_ENV-conditional requiredness so prod fails fast on missing Sentry/Resend keys. (3) posthog.ts is dual-purpose (client config + server capture) — split if posthog-node ever leaks client-side.

## T12 — Constants: routes, enums, status colors
- **Model:** Sonnet · **Skill:** skill-ui-engineer
- **Prompt:**
```
Create constants/routes.ts exporting every route from BETK_UI_SPEC.md §2 + §3 as typed builders (e.g. routes.listing(id), routes.seller.orderDetail(id)) so links match the spec exactly. Finalize constants/enums.ts (T07) and constants/statusColors.ts mapping each enum value -> token (background/foreground) for StatusBadge. No components.
```
- **Done when:** routes typed + complete vs UI Spec; status map covers all enum values.
- **▸ EXPANDED FOR EXECUTION** — `enums.ts`/`statusColors.ts` were already built+compile-enforced in T07; scope this task to `routes.ts` + verify-don't-rebuild. Prompt run:
```
PRIMARY: constants/routes.ts — every route from BETK_UI_SPEC §2 + §3 as typed builders (static = string consts; dynamic = (param)=>string), grouped by surface. Cover the full §3 list; cross-check against UI Spec route lines; no trailing-slash drift.
VERIFY (built in T07, do NOT recreate): enums.ts is the final Database["betk"]["Enums"]-derived set; statusColors.ts 8 Record<EnumType,StatusColorPair> maps compile-enforce coverage. Leave as-is unless a gap appears.
```
- **▸ AS-BUILT (Sonnet):** routes.ts = 66 entries (public 5 + checkout 1 + auth 3 + buyer 13 + seller 25 + admin 19); dynamic builders typed; query-param routes handled (`checkout(inquiryId)`→`?inquiry=`, search); WhatsApp-under-settings respected (OD-5, no standalone route). enums.ts/statusColors.ts confirmed final.
  - **Enum-count thread CLOSED here:** `pg_type` query returned **34** enums; `doc_type` + `doc_review_status` confirmed real and derived (not invented). Corrected journal/SESSION_CONTEXT (32→34) **and** `BETK_ERD §9` (30→34); SQL header already correct; §8 cites by name. One number everywhere, anchored to live schema.

## T13 — CI pipeline + guards
- **Model:** Sonnet · **Skill:** skill-test-engineer · **Source:** `08-deployment/CICD_PIPELINE.md`
- **Prompt:**
```
Add .github/workflows/ci.yml per docs/08-deployment/CICD_PIPELINE.md: install -> lint -> typecheck -> vitest -> supabase types drift check (regenerate and git diff --exit-code src/lib/supabase/types.ts) -> build. Add a custom step asserting (a) no client file imports lib/supabase/service.ts, (b) every file under features/*/actions and app/api/* imports a Zod schema (Zod-coverage gate; may be a no-op until those exist). Block merge on any failure. Add Playwright config for later E2E.
```
- **Files:** `.github/workflows/ci.yml`, `scripts/check-service-import.mjs`, `scripts/check-zod-coverage.mjs`, `playwright.config.ts`, `vitest.config.ts`.
- **Done when:** CI green on the skeleton; guards run.
- **▸ EXPANDED FOR EXECUTION** — canonical run with two added decisions: (a) the T08 RLS harness hits live staging, so it must NOT run in default CI; (b) types-drift must fail loud (not silent-skip) when Supabase secrets are absent. vitest.config.ts already exists from T08 — don't overwrite. Prompt run captured those constraints.
- **▸ AS-BUILT (Sonnet):** `.github/workflows/ci.yml` — 7 sequential jobs: install → lint/typecheck → vitest (**unit-only**, `test:unit` excludes tests/integration) + guards → types-drift → build, plus an **opt-in `rls-smoke`** job (develop push + workflow_dispatch only) that fails loud if staging secrets absent. types-drift has explicit `[ -z "$SECRET" ]` guard naming missing secrets (no silent skip). `scripts/check-service-import.mjs` (no app/feature/component file imports lib/supabase/service — passes) + `scripts/check-zod-coverage.mjs` (features/*/actions + app/api importing Supabase must import a Zod schema — near-no-op now, passes). playwright.config.ts (chromium + mobile-chrome, Arabic locale, trace-on-retry; no tests yet). vitest.config.ts untouched from T08. `package.json` +`test:unit`.

## T14 — Phase exit verification
- **Model:** **Opus** (review) · **Skill:** skill-security-reviewer, skill-ui-reviewer
- **Prompt:**
```
Verify Phase 01 against the Definition of Done in this pack and BETK_PHASES Phase 01 Acceptance. Confirm: RTL boot; 43 tables + freeze deltas (\d betk.users shows nullable phone_number + auth_provider/deleted_at/anonymized_at); 34 indexes; 5 triggers; 22 RLS policies + 2 helpers; 6 cron jobs; seeds; types.ts current; middleware gates + deactivated block; services scaffolded; CI gates incl. types-drift + service-import + zod-coverage. Produce a short pass/fail report and update SESSION_CONTEXT.md (Last completed -> Phase 01; Next -> Phase 02 Auth) and append DEVELOPMENT_JOURNAL.md.
```
- **Done when:** all DoD boxes checked; SESSION_CONTEXT + journal updated; sign-off to start Phase 02.
- **▸ EXPANDED FOR EXECUTION (PENDING — run next)** — the canonical DoD numbers are pre-build estimates; reconcile against as-built reality (4 triggers, not 5; 34 RLS policies incl. 3 RESTRICTIVE gates, not 22; CLI via direct binary), and re-surface every logged carry-forward as the Phase-02 entry checklist. Suggested prompt:
```
Verify Phase 01 against this pack's DoD + BETK_PHASES Phase 01 Acceptance. Use the direct supabase binary (npx wrapper hangs). Confirm on staging: RTL boot; 43 tables; users freeze deltas (nullable phone_number + auth_provider/deleted_at/anonymized_at); 34 indexes; **4 triggers (NOT 5 — decrement_stock_on_confirm is a known source gap, see T05 finding; confirm it's still tracked, do not invent it)**; **34 RLS policies incl. the 3 OD-4 RESTRICTIVE phone-gates**; 2 helpers; 6 cron jobs; seeds (3 boost_packages, 11 admin_settings, 39 categories); types.ts current (CI drift green); middleware gates + /blocked; services scaffolded; CI gates (unit + service-import + zod-coverage + types-drift, rls-smoke opt-in).
Produce a pass/fail report. Then write the Phase-02 ENTRY CHECKLIST from Phase-01 carry-forwards: (1) add PERMISSIVE ownership INSERT policy to orders (Phase 07) + seller_profiles (Phase 04) — payouts is the model, else checkout/onboarding silently default-deny; (2) re-tighten GOOGLE_CLIENT_ID/SECRET to required; (3) validate middleware returnUrl is local (open-redirect guard); (4) decrement_stock_on_confirm trigger still owed to source; (5) StoreDeliveryOptions.modes enum alignment check before consume. Update SESSION_CONTEXT (Last completed → Phase 01; Next → Phase 02 Auth) + append DEVELOPMENT_JOURNAL.
```
- **▸ Reconciled DoD deltas vs the checklist at top of this pack:** triggers **4** live (not 5 — `decrement_stock_on_confirm` absent from source, tracked); RLS policies **34** (not 22 — count grew with the 3 RESTRICTIVE gates + per-table policies); seeds include **39 categories**; CLI = direct binary. The "22 policies / 5 triggers" figures in the DoD checklist are pre-build estimates — trust the as-built numbers here.

---

## Freeze-delta SQL (paste reference for T05)
```sql
-- migration 0001 (after the C3 §2 enum block):
CREATE TYPE auth_provider AS ENUM ('phone','google');

-- migration 0002 betk.users (C3 §3 Group A users + freeze deltas):
CREATE TABLE betk.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- mirrors auth.users(id)
  phone_number  VARCHAR(15) UNIQUE,                          -- OD-4: NULLABLE (was NOT NULL); UNIQUE allows multiple NULLs
  auth_provider auth_provider NOT NULL DEFAULT 'phone',      -- OD-4
  role          user_role   NOT NULL DEFAULT 'buyer',
  status        user_status NOT NULL DEFAULT 'active',
  deleted_at    TIMESTAMPTZ,                                 -- OD-2 deactivate-only
  anonymized_at TIMESTAMPTZ,                                 -- OD-2 reserved (post-MVP MW1)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- migration 0011 transaction-gate (add WITH CHECK alongside ownership policies):
-- orders INSERT: actor must have a verified phone
CREATE POLICY orders_insert_phonegate ON betk.orders FOR INSERT
  WITH CHECK (
    buyer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM betk.users u WHERE u.id = auth.uid() AND u.phone_number IS NOT NULL)
  );
-- seller_profiles INSERT (become seller) and payouts INSERT: same phone-present requirement.
-- Server Actions re-assert this and trigger phone+OTP capture when missing (Phase 04/07/13).
```

## Notes for the operator
- Run T05 on a **staging** Supabase project first; production apply is a reviewed manual step (DISASTER_RECOVERY).
- Keep `BETK_DATABASE_SCHEMA.sql` and the migration files in sync; the SQL file is the contract, the migrations are the executable truth.
- Opus owns T05, T08, T10(review), T14; Sonnet builds the rest. No task merges without the relevant review gate (BETK_AI_TEAM).

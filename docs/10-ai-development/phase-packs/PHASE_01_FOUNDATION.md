# PHASE 01 — FOUNDATION · Task Pack
> Execution pack for `BETK_PHASES.md` Phase 01. Drives Opus/Sonnet in Cursor. Every prompt assumes `.cursorrules` + `BETK_MASTER_EXECUTION_PROMPT.md` + `SESSION_CONTEXT.md` are already loaded (they are, via .cursorrules). Build in task order — later tasks depend on earlier. No app features yet; this phase makes the skeleton, the database, and the wiring correct.

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

## T02 — Directory skeleton
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer
- **Prompt:**
```
Create the exact folder skeleton from docs/02-architecture/BETK_CODEBASE_ARCHITECTURE.md §1 under src/:
app/(public) (auth) (buyer) (seller)/seller (admin)/admin api ; features/ with the listed feature folders, each containing empty components/ hooks/ actions/ queries/ types/ index.ts ; components/ui (shadcn target) components/shared ; lib/supabase ; services ; hooks ; types ; validations ; constants ; configs ; tests/{unit,integration,e2e}. Add a README in each top-level folder stating its purpose and that feature folders map to UI Spec areas. Do NOT create any pages/components beyond placeholders.
```
- **Files:** the tree (empty `index.ts` + READMEs).
- **Done when:** tree matches the codebase doc; `pnpm typecheck` clean.

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

## T04 — Supabase clients + local dev
- **Model:** Sonnet · **Skill:** skill-supabase-engineer, skill-database-engineer
- **Prompt:**
```
Set up Supabase per docs/02-architecture/BETK_ARCHITECTURE.md §2.
Create src/lib/supabase/client.ts (browser, @supabase/ssr createBrowserClient, anon key), server.ts (createServerClient bound to next/headers cookies for RSC + Server Actions), service.ts (service-role client, server-only, with a top-of-file comment: "BYPASSES RLS — never import in client code; re-check ownership in code"). Add a Zod-validated env loader in configs/env.ts that parses process.env against docs/08-deployment/BETK_CONFIGURATION.md and throws on missing required vars; never expose service key to client. Initialize `supabase init` for local dev and link to the staging project. Add .env.example with all keys from CONFIGURATION (no values).
```
- **Files:** `lib/supabase/{client,server,service}.ts`, `configs/env.ts`, `.env.example`, `supabase/config.toml`.
- **Done when:** clients compile; env loader rejects a missing var; service client is server-only (lint guard in T13).

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

## T06 — Seed data
- **Model:** Sonnet · **Skill:** skill-database-engineer
- **Prompt:**
```
Add seed inserts (in 0008 or supabase/seed.sql): boost_packages (24h/EGP20, 48h/EGP50, 72h/EGP100, sort_order, is_active true); admin_settings defaults (seller_approval_sla_hours=24, dispute_sla_hours=48, low_stock_default=3, auto_flag_keywords=[], with CHECK on numeric keys per C3 §8.2 RISK 2); a starter categories taxonomy (top-level + a few subcategories with slugs/icons) sized for Egypt's informal creative economy. Idempotent (ON CONFLICT DO NOTHING).
```
- **Done when:** seeds present on staging; packages/settings/categories queryable.

## T07 — Type generation + JSONB interfaces + enum constants
- **Model:** Sonnet · **Skill:** skill-database-engineer
- **Prompt:**
```
Run `supabase gen types typescript --linked --schema betk,betk_analytics > src/lib/supabase/types.ts` and commit. Create constants/enums.ts re-exporting every enum literal union from C3 §2 (mirror exactly, incl. auth_provider). Create src/types/jsonb.ts with hand-written interfaces over the generated Json type: StorePaymentMethods {instapay_handle?, vodafone_cash?, orange_cash?, cod_enabled}, StoreDeliveryOptions, NotificationPrefs {push,sms,whatsapp,email}, NotificationData. Add a typed helper getTyped<T>(json) for JSONB columns. Ensure StatusBadge color map keys (constants/statusColors.ts) match the enums.
```
- **Done when:** `types.ts` reflects 43 tables incl. freeze columns; `pnpm typecheck` clean; CI types-drift (T13) green.

## T08 — RLS verification harness
- **Model:** **Opus** (security) · **Skill:** skill-security-reviewer · **Source:** BETK_ERD §3, C3 §5
- **Prompt:**
```
Write an integration test (tests/integration/rls.smoke.test.ts) against a test Supabase project that asserts default-deny and core policies: anon CANNOT select a draft/soft-deleted listing but CAN select an active one; a buyer cannot read another buyer's orders; my_store_id()/is_admin() resolve; a non-phone (Google) user is rejected by the transaction-gate WITH CHECK on an orders insert while a phone-verified user passes ownership. Use a deterministic seed honoring RLS; never touch production.
```
- **Done when:** RLS smoke test passes; documents any policy gap as a finding (block if default-deny fails).

## T09 — Root layout, providers, RTL shell
- **Model:** Sonnet · **Skill:** skill-ui-engineer, skill-nextjs-engineer
- **Prompt:**
```
Build app/layout.tsx as the RTL Arabic root: <html dir="rtl" lang="ar">, fonts from T03, globals, and providers — Sentry (client init), PostHog (client provider, no PII), and a Toaster (shadcn) host. Add app/(public)/layout.tsx (PublicShell placeholder: topbar slot + content), and empty loading.tsx/error.tsx/not-found.tsx at the root using EmptyState/ErrorRetryCard placeholders per docs/standards/UI_STATE_STANDARDS.md. No real pages.
```
- **Files:** `app/layout.tsx`, `app/(public)/layout.tsx`, root `loading/error/not-found.tsx`, `services/sentry.ts`+`posthog.ts` init hooks.
- **Done when:** app boots RTL with providers mounted; no console errors.

## T10 — Auth middleware skeleton
- **Model:** **Opus** (security review) / Sonnet (impl) · **Skill:** skill-security-reviewer, skill-nextjs-engineer
- **Prompt:**
```
Implement src/middleware.ts per BETK_ARCHITECTURE §4 and BETK_PHASES Phase 02 boundary (skeleton only — no OTP UI yet). Use @supabase/ssr to read the session. Gate route groups: (public) open; (buyer) requires auth; (seller)/seller requires role=seller (route pending/rejected sellers to /seller/status); (admin)/admin requires is_admin(). Block users whose users.status != 'active' OR deleted_at IS NOT NULL (R-A05) -> redirect to a blocked page. Leave the verified-phone transaction gate as a documented TODO to be enforced in checkout/seller/payout Server Actions (Phase 04/07/13), referencing OD-4. Do not build login pages here.
```
- **Files:** `src/middleware.ts`, `app/blocked/page.tsx` (minimal).
- **Done when:** unauth access to a (buyer) route redirects to login route; role gates compile; deactivated-user block path exists.

## T11 — Service wrappers (typed stubs)
- **Model:** Sonnet · **Skill:** skill-supabase-engineer, skill-api-architect
- **Prompt:**
```
Create typed wrappers in src/services/: resend.ts (sendEmail(to,template,vars)), posthog.ts (capture(event,props)), sentry.ts (captureError/tag), whatsapp.ts (sendTemplate(name,to,vars) — enforces approved-template-only per R-N02, reads whatsapp_templates), sms.ts (sendSms(to,body) for OTP + SLA alerts), courier.ts (createShipment/getTracking — Bosta interface). All read keys via configs/env.ts; in Phase 01 they are wired but guarded to no-op/log in non-production. No business logic.
```
- **Done when:** wrappers compile; misconfigured keys fail safe (log, no throw in dev).

## T12 — Constants: routes, enums, status colors
- **Model:** Sonnet · **Skill:** skill-ui-engineer
- **Prompt:**
```
Create constants/routes.ts exporting every route from BETK_UI_SPEC.md §2 + §3 as typed builders (e.g. routes.listing(id), routes.seller.orderDetail(id)) so links match the spec exactly. Finalize constants/enums.ts (T07) and constants/statusColors.ts mapping each enum value -> token (background/foreground) for StatusBadge. No components.
```
- **Done when:** routes typed + complete vs UI Spec; status map covers all enum values.

## T13 — CI pipeline + guards
- **Model:** Sonnet · **Skill:** skill-test-engineer · **Source:** `08-deployment/CICD_PIPELINE.md`
- **Prompt:**
```
Add .github/workflows/ci.yml per docs/08-deployment/CICD_PIPELINE.md: install -> lint -> typecheck -> vitest -> supabase types drift check (regenerate and git diff --exit-code src/lib/supabase/types.ts) -> build. Add a custom step asserting (a) no client file imports lib/supabase/service.ts, (b) every file under features/*/actions and app/api/* imports a Zod schema (Zod-coverage gate; may be a no-op until those exist). Block merge on any failure. Add Playwright config for later E2E.
```
- **Files:** `.github/workflows/ci.yml`, `scripts/check-service-import.mjs`, `scripts/check-zod-coverage.mjs`, `playwright.config.ts`, `vitest.config.ts`.
- **Done when:** CI green on the skeleton; guards run.

## T14 — Phase exit verification
- **Model:** **Opus** (review) · **Skill:** skill-security-reviewer, skill-ui-reviewer
- **Prompt:**
```
Verify Phase 01 against the Definition of Done in this pack and BETK_PHASES Phase 01 Acceptance. Confirm: RTL boot; 43 tables + freeze deltas (\d betk.users shows nullable phone_number + auth_provider/deleted_at/anonymized_at); 34 indexes; 5 triggers; 22 RLS policies + 2 helpers; 6 cron jobs; seeds; types.ts current; middleware gates + deactivated block; services scaffolded; CI gates incl. types-drift + service-import + zod-coverage. Produce a short pass/fail report and update SESSION_CONTEXT.md (Last completed -> Phase 01; Next -> Phase 02 Auth) and append DEVELOPMENT_JOURNAL.md.
```
- **Done when:** all DoD boxes checked; SESSION_CONTEXT + journal updated; sign-off to start Phase 02.

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

# BETK_MASTER_EXECUTION_PROMPT.md
> Step 14 — the brain. Every Cursor/Claude session starts by loading this. Paste/reference it (via `.cursorrules`) at the top of each session.

You are an engineer on **BETK**, an Arabic-first (RTL) digital marketplace for Egypt, built on Next.js 15 + Supabase + Tailwind/shadcn + TypeScript strict. Build only what the docs specify. Scope is FROZEN.

## Product truth
- Scope: `docs/01-product/BETK_MVP_SCOPE.md` (frozen; 56 pages; do not add features).
- PRD: `docs/01-product/BETK_PRD.md` (one FR per page; acceptance criteria in §9).
- UI Spec: `docs/00-design/BETK_UI_SPEC.md` (the ground truth for every page — route, auth gate, components, data, states). **When asked to build a page, reference its UI Spec section explicitly.**

## Technical truth
- Architecture: `docs/02-architecture/BETK_ARCHITECTURE.md` (Supabase JS Client + Zod; PostHog, Resend, Sentry; NO ORM, NO microservices). Decisions in `ADR.md`.
- Codebase: `docs/02-architecture/BETK_CODEBASE_ARCHITECTURE.md` (feature-first; folders map to UI Spec areas).
- Data contract: `docs/03-database/BETK_ERD.md` + `BETK_DATABASE_SCHEMA.sql` (43 tables; migration order; triggers; pg_cron).
- API standards: `docs/04-api/API_STANDARDS.md`.

## Security truth
- Supabase Auth: phone-OTP **+ Google OAuth** (R-A01 amended, OD-4); sessions/OTP hashed; `users.phone_number` nullable; **verified phone required before transacting**.
- RLS strategy per table: `BETK_ERD.md §3` — RLS is the authorization boundary; default-deny; `is_admin()`/`my_store_id()`.
- **Zod validation is REQUIRED on every API route and Server Action** before any DB access.
- Honor the 5 pre-launch security conditions (C3 §8.5) — see `06-security/SECURITY_GUIDELINES.md`.

## Code standards
- Naming: kebab files, PascalCase components, verbNoun actions, getX/listX queries, xSchema Zod.
- Supabase query pattern: handle `{ data, error }`; RLS denial → not-found; money computed server-side.
- TypeScript strict; regenerate `lib/supabase/types.ts` after every migration (CI drift check).
- shadcn/ui: extend, don't override (`components/ui/*` immutable).
- Server vs client: default Server Components; `"use client"` only for interactivity; mutations are Server Actions.
- RTL-first; logical Tailwind utilities; tokens from UI Spec §1.

## Design source of truth
- The visual design system lives in `components/ui` + `components/shared`, owned by **Claude Design** (brief: `docs/00-design/BETK_DESIGN_BRIEF.md`). When building a page, **compose** these shared components and **wire data** (Server Actions/queries) — do NOT restyle or fork them. If a visual change is needed, flag it for Claude Design; don't hardcode colors or override `components/ui/*`. The page's component list + states still come from `BETK_UI_SPEC.md`.

## UI state standards
- Every page implements happy + edge, empty, loading (skeleton vs spinner rule), and error states (`docs/standards/UI_STATE_STANDARDS.md`). Toast = done/recoverable; modal = irreversible/needs consent.

## Testing
- Unit for all utilities; integration for all routes/actions; E2E for critical flows. Map tests to FR/AC ids. A feature is done only when its AC passes review.

## Documentation rule
- After EVERY completed task: update the relevant doc + append to `docs/12-changelog/DEVELOPMENT_JOURNAL.md`. Not at end of sprint.

## AI workflow
- Adopt the agent role for the task (`BETK_AI_TEAM.md`); load its skill file(s) from `BETK_AI_SKILLS/`. Opus = architect/reviewer/security; Sonnet = build. No merge without Security + UI-reviewer + QA pass.

## Session hygiene
- Start each session by reading `SESSION_CONTEXT.md` to restore project state. Update it at session end (current phase, last task, open issues, next task). Do not rely on chat memory.

## Hard rules
- Scope is FROZEN (MVP Freeze 2026-06-13): OD-1 DERIVED, OD-2 deactivate-only + `users.deleted_at`/`anonymized_at`, OD-3 no campaign entity, OD-4 Google OAuth IN (phone nullable, gated to transactions), OD-5 sessions UI OUT / WhatsApp templates under Admin→Settings→Notifications, OD-6 count=43. Do not invent pages, tables, or features beyond this. If something seems missing, stop and flag — don't improvise schema.

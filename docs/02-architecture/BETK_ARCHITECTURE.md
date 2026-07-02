# BETK_ARCHITECTURE.md
> Step 4 of the BETK Dev OS. The confirmed stack. Decisions are logged as ADRs in `11-decisions/ADR.md`.

## 1. Stack (confirmed)

```
Frontend   Next.js 15 (App Router + React Server Components) · shadcn/ui + Tailwind CSS · TypeScript strict
Backend    Next.js API Routes + Server Actions
Database   Supabase PostgreSQL 17 · Supabase JS Client (queries) · Zod (input validation + type safety)
Storage    Supabase Storage (private bucket for seller_documents; public/CDN for listing & review images)
Auth       Supabase Auth (phone OTP + Google OAuth; phone verification gated to transactions — OD-4)
Email      Resend
Analytics  PostHog
Monitoring Sentry
Deploy     Vercel
```

**Explicitly NOT used:** microservices; a separate Express/FastAPI backend; Kubernetes; Prisma or Drizzle ORM (the Supabase JS Client + generated types + Zod is sufficient for MVP). Adding any of these requires an ADR overriding this document.

## 2. Request / data flow

```
Browser (RSC + client islands, RTL)
   │  Server Action / Route Handler (Zod-validated input)
   ▼
Next.js (Vercel)  ──Supabase JS Client──►  Supabase Postgres (RLS enforced)
   │                                          ├─ pg_cron (boosts, levels, snapshots, SLA, suspensions, OTP cleanup)
   │                                          └─ triggers (search_vector, deadlines, rating aggregate, stock)
   ├─ Supabase Auth (phone OTP, sessions)
   ├─ Supabase Storage (signed URLs for ID docs)
   ├─ Resend (transactional email)
   ├─ PostHog (product events)
   └─ Sentry (errors)
```

Two Supabase clients (Dev OS Step 5): browser client (`lib/supabase/client.ts`, anon key, RLS as the user) and server client (`lib/supabase/server.ts`, cookie-bound auth in Server Actions/Components). The **service-role** client is used only in trusted server contexts and background jobs — never shipped to the browser — and bypasses RLS, so every service-role code path must re-implement ownership checks explicitly.

## 3. Server vs client component rules

- **Default to Server Components.** Data fetching happens on the server via the server Supabase client; RLS does the authorization. Pages, layouts, and read-only views are RSC.
- **Client Components (`"use client"`)** only for interactivity: forms, `MessageThread`, filters/sheets, toasts, optimistic UI, anything using hooks/`useState`/browser APIs. Keep them leaf-level and small.
- **Mutations are Server Actions**, never client-side direct DB writes. Every action validates input with Zod first, then calls Supabase, then `revalidatePath`/`revalidateTag`.
- No browser storage for app state in artifacts/components beyond ephemeral UI; session lives in Supabase Auth cookies.

## 4. Authorization model

Authorization is enforced in the database via RLS (`BETK_ERD.md §3`), not only in the UI. The auth gate in the UI (`public | protected | role:seller | role:admin`) is a UX convenience; the security boundary is RLS + `is_admin()`/`my_store_id()`. Server Actions additionally check role before mutating. Suspended/banned/deactivated users are blocked at middleware and re-checked per request (R-A05, now incl. `deleted_at`). Google-OAuth users may browse/wishlist/follow with no phone; checkout, becoming a seller, and payouts require a verified phone (`users.phone_number IS NOT NULL`), enforced in Server Actions and RLS WITH CHECK.

**Locale × gates (OD-7 / ADR-002).** The middleware negotiates the locale (next-intl) and then normalizes it — stripping any `/en` prefix (Arabic is unprefixed) — **before** evaluating `gateFor()`. Gate verdicts are therefore locale-invariant: `/account` and `/en/account` both resolve to the `buyer` gate, `/admin` and `/en/admin` to `admin`, and so on. Redirect targets (login/blocked/role-mismatch/seller-status) are re-localized to the same locale. Adding locale changes **no** authorization outcome.

## 5. Storage architecture

- `seller_documents` → **private** bucket, served only via ≤15-min signed URLs to admins (C3 §8.2 RISK 5). Never a public URL.
- `listing_images`, `review_photos`, `dispute_evidence`, store `avatar/cover` → CDN-delivered; auto WebP conversion + compression; DB stores metadata + `sort_order` only. Deletion cascades to Storage.

## 6. External services

- **Resend** — transactional email channel for `notifications` where `channel='email'` (order/payment/dispute/approval). Templated; from a verified BETK domain.
- **PostHog** — product analytics on key funnels (discovery→inquiry→order, onboarding completion, boost purchase). Client + server capture; no PII beyond user id.
- **Sentry** — error monitoring on client + server + Server Actions; tag by feature + user role; see `ERROR_HANDLING_STANDARDS.md`.
- **WhatsApp / SMS / push** — `notifications` dispatch channels; WhatsApp via approved templates (`whatsapp_templates`, R-N02). Provider wrappers live in `src/services/`.

## 7. Performance & resilience (from C3 §8)

PgBouncer (Supabase pooler) from day 1, TRANSACTION mode for requests / SESSION mode for jobs. Cache homepage endpoint 60s and `rating_aggregates` 5-min (Edge/Redis). All 34 indexes on day 1. Section-level degradation (independent homepage strips). Search safe to ~500K listings on tsvector+GIN; revisit at scale.

## 8. Pre-launch architecture conditions (mandatory — C3 §8.5)

1. Address all 5 security risks (§8.2). 2. PgBouncer enabled. 3. `seller_documents` bucket PRIVATE. 4. All pg_cron jobs tested in staging. 5. `notifications` 90-day archive policy scheduled. These are gates in `LAUNCH_CHECKLIST.md`.

## 9. ADR-002 — Internationalization (AR/EN) & theming (OD-7)

**Status:** Accepted 2026-07-01 (amends scope via OD-7; supersedes the earlier Arabic-only, single-`dir="rtl"` assumption). **Context:** OD-7 makes BETK a bilingual Arabic/English, light/dark app over the existing 56 pages with **no new pages/tables/content columns, no translation service, no new content dependency**.

**Decision.**
- **Library:** `next-intl` (v4) for the UI shell + `next-themes` for theming. These are the only two dependencies OD-7 adds (presentation-layer only).
- **Routing:** locale as a path segment via `src/app/[locale]/`. `localePrefix: 'as-needed'` — **Arabic is the default and unprefixed** (existing URLs + SEO preserved); **English is served under `/en`**. Locale is validated (`∈ {ar, en}` else `notFound()`) both at the layout (`hasLocale`) and via a catch-all so a bad locale is a 404. Config is centralized in `src/i18n/{routing,request,navigation}.ts`.
- **Document shell:** the single `<html>` lives in `src/app/[locale]/layout.tsx` (there is no `src/app/layout.tsx`); `dir`/`lang` derive from the locale (ar→`rtl`/`ar`, en→`ltr`/`en`). `next-themes` uses the class strategy on `<html>` (`attribute="class"`, `.dark`), matching the Phase 01 T03 tokens, with `defaultTheme="system"`. `suppressHydrationWarning` absorbs the pre-hydration theme class.
- **Middleware:** next-intl locale negotiation is **composed** with the existing auth gate; locale is normalized **before** `gateFor()` runs (see §4), and the same response carries both the `NEXT_LOCALE` cookie and the refreshed Supabase auth cookies.
- **Content model (no schema change):**
  - **Shell chrome** (nav, buttons, labels, empty/error states, validation) → `next-intl` catalogs `messages/{ar,en}.json` (BETK-owned EN copy).
  - **Structured lists** (categories, badges, statuses, filters, governorates, delivery) → existing `*_ar`/`*_en` columns.
  - **Names/titles** (listing titles, store/collection/category names) → `localizedName()` = `COALESCE(locale column, other)` so display is never blank (`title_en` stays nullable — no migration). Helper: `src/i18n/localizedName.ts`.
  - **Descriptions / bios / custom-order notes** → a **single field in the author's language, shown as-authored to everyone**. No translation, no fallback logic. An EN user may see an AR description (accepted).
  - **Transactional/structured fields** (price, stock, condition, dates) → language-neutral/enum.
- **Persistence:** locale = URL + `NEXT_LOCALE` cookie; theme = `localStorage` (next-themes). **No user/content DB column.** The switch UI lives in Account → Settings (BL-03).

**Consequences.** URLs stay stable for Arabic; English gains a `/en` mirror. Order-history papercut deferred (`order_items` snapshots only `listing_title_ar` → EN buyers see the AR snapshot; fixing it is a future `_en` column = out of OD-7 scope). Post-MVP: on-demand content translation, per-account persisted preferences, more locales. **Schema change: NO. New dependency: `next-intl` + `next-themes` only (presentation).**

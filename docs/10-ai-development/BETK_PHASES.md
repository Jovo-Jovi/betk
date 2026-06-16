# BETK_PHASES.md
> Step 15 of the BETK Dev OS. Execution phases with BETK's actual feature names (from the UI Spec / PRD), in dependency order. Each phase: Objectives · Tasks · Files · Acceptance (→ UI Spec + PRD) · Tests · Docs to update. Build in this order; later phases depend on earlier.

## Phase 00 — Scope sign-off (gate, no code)
Decide OD-1…OD-6 (MVP Scope §8) and sign. **No development begins until this is signed.** Doc: MVP_SCOPE §8, SESSION_CONTEXT.

## Phase 01 — Foundation
> Task pack: `phase-packs/PHASE_01_FOUNDATION.md` (14 tasks, Cursor prompts, migration grouping, freeze-delta SQL).
- **Objectives:** repo, env, Supabase client setup, full migration + type generation, base layout/RTL, shadcn install, services scaffolding, middleware skeleton.
- **Tasks:** Next.js 15 app + route groups; `lib/supabase/{client,server,service,types}`; run migrations 001–057 (C3 §7) to a staging Supabase **with the MVP-freeze deltas: enum `auth_provider`; `users.phone_number` nullable; add `users.auth_provider`, `users.deleted_at`, `users.anonymized_at`**; `supabase gen types`; Tailwind tokens + shadcn; `services/{resend,posthog,sentry}`; `constants/{routes,enums,statusColors}`; `middleware.ts` (auth gate + role routing + suspended block); CI pipeline.
- **Files:** `app/layout.tsx`, `lib/supabase/*`, `tailwind.config`, `middleware.ts`, `.env.example`, GitHub Actions.
- **Acceptance:** app boots RTL; all 43 tables + RLS + indexes + triggers + pg_cron live in staging; types generated; CI gates green.
- **Tests:** smoke build; types drift check; RLS default-deny sanity.
- **Docs:** ARCHITECTURE, CONFIGURATION, ERD, CICD, DEVELOPMENT_JOURNAL.

## Phase 02 — Authentication & profiles
- Features: FR-AUTH-1..3, FR-BUY-1 (account). Phone-OTP **and Google OAuth** (Supabase Auth, OD-4), OTP page, OAuth callback + find-or-create (`auth_provider`), session creation, role routing, buyer profile creation, account **deactivate** (sets `users.deleted_at`), **phone-required-before-transacting** gate.
- **Acceptance:** AC-AUTH-2 (≤5 attempts, no raw OTP, session created); Google OAuth find-or-create with `phone_number=NULL`; role routing; suspended/deactivated blocked (R-A05 incl. `deleted_at`); transaction gate forces phone+OTP before checkout/become-seller/payout.
- **Tests:** integration (OTP flow, attempts, expiry); E2E auth.
- **Docs:** SECURITY_GUIDELINES, journal.

## Phase 03 — Catalog & Discovery (public)
- Features: FR-PUB-1..5 (Homepage, Search, Category, Listing Detail, Storefront). Categories seed, listings read, tsvector search + filters, collections strip, rating_aggregates display, follow button.
- **Acceptance:** FR-PUB acceptance criteria; search returns active+not-deleted; boosted ranking; suspended store hidden.
- **Tests:** integration (search/filter, RLS public read); E2E browse→listing→storefront.
- **Docs:** CACHING_STRATEGY, journal.

## Phase 04 — Seller Onboarding & Store Management
- Features: FR-SEL-1..7 (onboarding 5-step, status, store/delivery/returns/payments). seller_profiles + stores + seller_documents (private bucket, signed URLs), slug uniqueness/change-once, payment-method gate.
- **Acceptance:** one store/seller (R-S01); slug unique+URL-safe (R-S02), change once (R-S03); ID front+back (R-S05); ≥1 payment method to publish (R-S09); store live only after approval (R-S04).
- **Tests:** integration (onboarding, slug rules, doc upload signed URL); E2E onboarding.
- **Docs:** SECURITY_GUIDELINES (storage), journal.

## Phase 05 — Listings & Inventory
- Features: FR-SEL-8..10 (manage, create/edit, stock). listings CRUD, images (≤5), tags (≤5), publish validation, soft delete, stock lifecycle + low-stock derived (OD-1).
- **Acceptance:** publish needs image+ar title+category (R-L02/03/04); service hides stock (R-L09); 0→sold_out (R-L06); restock→active (R-L07); soft delete (R-L10); search_vector populated.
- **Tests:** integration (publish gates, stock transitions); E2E create→publish.
- **Docs:** journal.

## Phase 06 — Messaging & Inquiries
- Features: FR-BUY-5, FR-SEL-13. inquiries + inquiry_messages threads, confirm→checkout enablement, avg_response_hours update, notify ≤5s (R-N04).
- **Acceptance:** confirmed inquiry enables checkout; response-time metric updates; unread state correct.
- **Tests:** integration (thread, confirm); E2E inquiry→confirm.
- **Docs:** journal.

## Phase 07 — Orders, Checkout & Split Payments
- Features: FR-BUY-6..9, FR-SEL-14..15. Checkout (atomic order + items + two payments), confirmation/instructions, order history, track order, seller order mgmt + status lifecycle + shipment, deposit confirmation gate, COD auto-confirm.
- **Acceptance:** AC-BUY-6 (atomic, 2 payments, only from confirmed inquiry); AC-SEL-14 (confirm→stock decrement→notify; COD skips deposit); cancel only pending (R-O03); status history written.
- **Tests:** integration (checkout atomicity, split payment dedupe, status transitions); E2E full purchase.
- **Docs:** API_STANDARDS, journal.

## Phase 08 — Delivery & Tracking
- Features: shipment create, tracking number/url, shipment_tracking_events, courier (Bosta) webhook, delivery confirmation opens review window (delivered_at).
- **Acceptance:** shipment 1:1 with order; tracking events render in timeline; delivered_at set.
- **Tests:** integration (webhook idempotency, status mapping).
- **Docs:** API_STANDARDS (webhooks), journal.

## Phase 09 — Reviews & Ratings
- Features: FR-BUY-10, FR-SEL-16. Leave review (≤3 photos, 48h edit), one seller reply, rating_aggregates trigger recompute, admin verify/hide later.
- **Acceptance:** AC (one review/order R-O07/R-R02; edit ≤48h R-R03; one immutable reply R-R04; aggregate recompute R-R07).
- **Tests:** integration (eligibility, edit window, aggregate); E2E review.
- **Docs:** journal.

## Phase 10 — Disputes & Buyer Protection
- Features: FR-BUY-11..12, FR-SEL-22, FR-ADM-9. Raise dispute (≤5 evidence), dispute thread, admin resolution + notify both, SLA 48h + 47h alert, refund-type touches payments.
- **Acceptance:** AC-ADM-9 (resolution sets outcome+notes, logs, notifies both; SLA alert at 47h); one active dispute/order (R-O06/R-D06); eligibility delivered/dispatched (R-D01).
- **Tests:** integration (eligibility, resolution, SLA cron); E2E dispute lifecycle.
- **Docs:** journal.

## Phase 11 — Boosts & Promotions
- Features: FR-SEL-11..12, FR-ADM-17. Boost purchase (packages), admin payment confirm→activate, concurrent-boost guard, auto-expire, ROI.
- **Acceptance:** one active boost/listing (R-B01/R-L08); activates ≤5min of confirm (R-B02); auto-expire cron (R-B03); boosted ranking (R-B04).
- **Tests:** integration (concurrency guard, expiry); E2E boost→confirm.
- **Docs:** journal.

## Phase 12 — Buyer extras: Wishlist, Following, Notifications
- Features: FR-BUY-3..4, FR-BUY-13. Wishlist + restock toggle (R-N06), follow stores, notifications center + unread badge, channel prefs.
- **Acceptance:** restock alert fires on stock>0 transition; unread badge accurate; channel prefs honored (R-N01).
- **Tests:** integration (restock trigger, unread index); E2E wishlist/follow.
- **Docs:** journal.

## Phase 13 — Seller Analytics, Earnings & Payouts
- Features: FR-SEL-3,17..21. Dashboard KPIs, earnings, transactions, request payout (min 100), level progress (nightly recalc), analytics charts.
- **Acceptance:** payout ≥ EGP 100 (R-O09), manual processing (R-O10); level thresholds (R-S06); snapshots drive charts.
- **Tests:** integration (payout min, level recalc cron); E2E payout request.
- **Docs:** journal.

## Phase 14 — Admin Console
- Features: FR-ADM-1..8,10..16. Dashboard+SLA, approvals, user/seller mgmt (strikes, ban confirm), listings/reviews/flagged moderation, categories, orders/payments/payouts mgmt, editorial collections, broadcast + templates, settings (CHECK on numeric keys), moderation log.
- **Acceptance:** approval SLA 24h (R-M01); temp suspension auto-lift (R-M03); permanent ban confirm (R-M04); flagged review 24h (R-M05); auto-flag keywords (R-M06); moderation log immutable (R-M02).
- **Tests:** integration (each admin action logs + RLS admin-only); E2E approve seller, resolve flag.
- **Docs:** SECURITY_GUIDELINES, journal.

## Phase DS — Design System & UI Polish (Claude Design)
> Pack: `phase-packs/PHASE_DS_DESIGN_SYSTEM.md`. Brief: `00-design/BETK_DESIGN_BRIEF.md`. Surface: **Claude Design**, not Cursor.
> **Placement (your choice):**
> - **Option A — Early (lower rework, recommended):** run right after Phase 01/03 so page-building phases (04–14) consume finished shared components. The token foundation already lands in Phase 01 (T03); this phase turns it into the full component set.
> - **Option B — Late polish (matches "backend/APIs first"):** run here, after Phase 14, as a consolidated visual pass over the functional UI built in Cursor. Accept some restyle rework on pages already built.
- **Objectives:** stand up the design system in Claude Design from `BETK_DESIGN_BRIEF.md` + the GitHub frontend subfolder; generate/refine the §4 shared components (RTL, tokens, all states); export to a `feature/design-*` branch.
- **Tasks:** see the pack (DS01 set up system · DS02 generate shared components · DS03 page layouts/shells · DS04 export to branch · DS05 Cursor wires data + UI-reviewer gate).
- **Acceptance:** every shared component matches its UI Spec §3/§4 usage, is RTL-correct, uses tokens (no hardcoded colors), extends shadcn, and renders empty/loading/error states; merged via PR through CI + UI-reviewer + Security gates.
- **Tests:** visual review against UI Spec page sections; a11y (focus ring, keyboard, RTL); no console errors.
- **Docs:** BETK_DESIGN_BRIEF, UI_STATE_STANDARDS, BETK_GIT_WORKFLOW, journal.

## Phase N-3 — Testing (full coverage pass)
Close gaps: every utility unit-tested; every action/route integration-tested; all critical E2E green; map all to FR/AC. Doc: TESTING_STRATEGY, journal.

## Phase N-2 — Deployment
Vercel production config, env per environment, migrations applied to prod (reviewed), buckets/privacy verified. Doc: CONFIGURATION, DISASTER_RECOVERY.

## Phase N-1 — Monitoring
Sentry wired (client/server/actions, tagged); PostHog events on key funnels; pg_cron verified in prod; notifications archive job scheduled. Doc: ERROR_HANDLING_STANDARDS, RATE_LIMITING.

## Phase N — Launch + post-launch
Run `LAUNCH_CHECKLIST.md` (incl. the 5 mandatory security conditions, RLS per table, Zod coverage, Core Web Vitals, Resend flows). Post-launch: monitor notifications growth (archive at 90d), watch search/write latency, plan post-MVP items (variants, wallet, multi-store) per C3 §8.4.

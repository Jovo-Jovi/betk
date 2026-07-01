# BETK_MVP_SCOPE.md
> Step 1 of the BETK Dev OS. **Frozen scope.** No feature may be added after sign-off. Every included feature traces to a wireframed page in `BETK_UI_SPEC.md`; anything without a page is excluded or post-MVP.
> Status: DRAFT awaiting sign-off · Source of truth for the PRD (Step 2).

## 1. Product vision

BETK is an Arabic-first, RTL digital marketplace for Egypt's informal creative economy — home-based sellers, handmade artisans, freelancers, and micro-businesses (typically EGP 2,000–5,000/month) — connecting them with local buyers through verified storefronts, local payment methods, neighborhood-level discovery, and structured buyer protection. Free to join, monetized by listing boosts. MVP targets Egypt; architecture must scale to MENA (Sudan, Libya, Jordan, Morocco) without re-architecture.

## 2. Actors

| Actor | Definition | Auth |
|---|---|---|
| Guest | Unauthenticated visitor. Browse/search/view only. Cannot wishlist, follow, inquire, or transact. | public |
| Buyer | Phone-OTP authenticated. Wishlist, follow, inquire, checkout, review, dispute. | protected |
| Seller | Buyer who completed 5-step onboarding and was admin-approved. Owns exactly one store. | role: seller |
| Admin / Superadmin | Internal operator. Approvals, moderation, disputes, payouts, collections, settings, broadcasts. | role: admin |

## 3. Use cases (frozen — 70)

All 70 use cases from the C2 Use Case Coverage Matrix are in scope and 100% covered by the schema. They group as: Auth & profile (Register, Sign In, Forgot Password, Manage Profile, Manage Addresses); Discovery (Browse Homepage, Search, Filter, View Listing, View Storefront, Save to Wishlist, Follow Seller); Buyer transaction (Send Inquiry, Checkout, Select Delivery, Pay split, Track Order, Order History, Cancel, Leave Review, Raise Dispute, Request Return/Refund); Seller operations (Create Storefront, Manage Store/Delivery/Return Policy, Manage Listings, Stock & Inventory, Boost, Manage/Confirm/Update Orders, Process Returns, View Earnings/Transactions, Request Payout, Respond to Inquiry, Reply to Review, Resolve Disputes, Seller Analytics); Admin (Verify Seller/Store/Reviews, Manage Users/Sellers/Listings/Categories/Orders/Disputes/Payments/Payouts, Suspend Seller/Buyer, Remove Review, Editorial Collections, Send Notifications, Admin Analytics); System (WhatsApp confirmations, Payment/Refund processing, Shipping cost, Shipment create/track, Media upload/delete).

## 4. Features included (each = a wireframed page)

In scope iff it maps to a page in `BETK_UI_SPEC.md §3`. The 56 pages across Public/Guest (5), Auth (3), Buyer (13), Seller (22), Admin (18) constitute the complete included feature set. No feature outside this page list is in MVP.

Confirmed stack capabilities in scope: phone-OTP **and Google OAuth** sign-in (Supabase Auth; phone verification gated to transactions — OD-4), split payment (50% deposit upfront via Instapay/Vodafone Cash/Orange Cash + 50% COD; BETK never holds funds), manual seller payment confirmation, Bosta/self-deliver/pickup/remote delivery, 1–2 keyword PostgreSQL full-text search (tsvector + GIN + unaccent), boost promotion (24/48/72h packages, admin-confirmed), admin-curated homepage collections, multi-channel notifications (push/SMS/WhatsApp/email), seller levels (Bronze/Silver/Gold, nightly recalculation), buyer-protection disputes (48h SLA), reviews (48h edit window, one seller reply), soft deletes, RLS on every table.

## 5. Features excluded (post-MVP)

These have no wireframe page and/or are explicitly deferred in the C3 Architect Review §8.4. They are OUT:

| Excluded | Reason | Re-entry condition |
|---|---|---|
| Multi-store per seller | `stores.seller_id` is UQ (1:1). C3 §8.4(1). | Drop UQ + query rework, post-MVP. |
| Platform wallet / escrow | MVP is direct buyer→seller; BETK holds no funds. C3 §8.4(2). | New `wallet_balances` + escrow columns. |
| Product variants (size/color) | No `listing_variants` table. C3 §8.4(3). | Add variants table for fashion/handmade. |
| Multi-listing cart checkout | Inquiry flow is single-listing. C3 §8.4(4). | Add `cart`/`cart_items`. |
| Real-time per-listing analytics / hourly snapshots | Snapshots are daily. C3 §8.4(6). | Add `listing_view_events`. |
| Automated payment-gateway capture & automated payouts | MVP is manual confirmation/processing (R-O05, R-O10). | Gateway integration. |
| Native mobile apps | MVP is responsive web (Next.js). | Separate track. |

## 6. Scope decisions — FROZEN (signed 2026-06-13)

All six resolved per the MVP Freeze Sheet. No further expansion.

- **OD-1 — Inventory alert log: DERIVED.** No `inventory_alerts` table. Low stock computed live from `listings.stock_qty ≤ low_stock_threshold`. No alert history/acknowledgement/lifecycle. Post-MVP: add table when history/analytics/escalation needed. *Schema change: NO.*
- **OD-2 — Account deletion (MW1): DEACTIVATE-ONLY + schema add.** Account can be deactivated; login blocked after; no hard delete; no anonymization. **Add now:** `users.deleted_at TIMESTAMPTZ NULL`, `users.anonymized_at TIMESTAMPTZ NULL` (forward-compat; no MVP behavior beyond deactivation). Post-MVP: full deletion + anonymization + retention. *Schema change: YES (2 nullable columns).*
- **OD-3 — Broadcast tracking (MW4): NO-CAMPAIGN-ENTITY.** Broadcasts create `notifications` rows; per-notification delivery status only. No campaign entity/analytics/dashboard/audience snapshot. Post-MVP: `notification_campaigns` + reporting. *Schema change: NO.*
- **OD-4 — Google OAuth: IN.** Sign-in via phone-OTP **or** Google OAuth (Supabase Auth links both). `users.phone_number` becomes nullable+UNIQUE; `users.auth_provider` records origin. **Verified phone required before transacting** (checkout / become seller / payout). R-A01 amended: "phone-OTP + Google OAuth; phone verification gated to transactions." *Schema change: YES (phone nullable + `auth_provider`).*
- **OD-5 — Sessions UI OUT / WhatsApp templates merged.** No sessions/active-sessions page. WhatsApp template management lives under **Admin → Settings → Notifications** (no standalone page). Post-MVP: security dashboard, session management, advanced template admin. *Schema change: NO.*
- **OD-6 — Table count: 43 (documentation).** Authoritative inventory + counting methodology added to `BETK_ERD.md §1.1`. *Schema change: NO.*
- **OD-7 — Bilingual AR/EN web app + light/dark theme: IN (no translation service).** App becomes bilingual Arabic/English and light/dark themed over the existing 56 pages — no new pages, no new tables, no new content columns, no new dependency.
  - **Shell.** All chrome translated via `next-intl` catalogs (`messages/ar.json`, `messages/en.json`); BETK owns EN UI copy.
  - **Structured content** (categories, badges, statuses, filters, governorates, delivery) bilingual via existing `*_ar`/`*_en` columns; BETK-filled.
  - **Goods** (titles, store names, collection names) bilingual via existing `title_en`/`name_en` columns; display `COALESCE(locale column, other)` (never blank). Populated by BETK for categories/collections and by **sellers** for goods — bilingual seller entry is a listing-form decision (Phase 04+).
  - **Descriptions/bios:** single field, in the author's language, shown as-is to everyone. **No machine translation. No `_en` body columns.**
  - **Transactional/structured fields** (price, stock, condition, dates) language-neutral/enum.
  - **Routing:** path-prefix, `localePrefix:'as-needed'`. Arabic default + unprefixed (existing URLs/SEO preserved); English under `/en`. Locale validated at edge (∈{ar,en} else 404); middleware normalizes locale BEFORE role gates — gate logic unchanged.
  - **Theme:** `next-themes`, class strategy on `<html>`. Tokens shipped Phase 01 T03.
  - **Persistence:** locale URL+cookie, theme localStorage. No user/content DB column.
  - Post-MVP: on-demand content translation; per-account persisted preferences; more locales. *Schema change: NO. New dependency: NONE.*

## 7. Success metrics

| Goal | Metric (launch target) |
|---|---|
| G1 Empower sellers | ≥ 200 approved active stores in first 90 days; seller onboarding completion ≥ 60%. |
| G2 Buyer trust | ≥ 70% of delivered orders reviewed; dispute resolution within 48h SLA ≥ 95%. |
| G3 Local payments | ≥ 90% of orders use a supported local method (Instapay/VF Cash/Orange Cash/COD). |
| G4 Neighborhood discovery | ≥ 40% of searches use a governorate/city filter. |
| G5 Arabic-first | 100% of core flows usable RTL in Arabic; zero LTR layout breakage on key pages. |
| G6 Monetization | ≥ 5% of active sellers purchase ≥ 1 boost in first 90 days. |
| G7 Quality control | Seller approval SLA ≤ 24h ≥ 95%; flagged-content review ≤ 24h ≥ 95%. |
| Platform | Homepage/storefront p95 < 2.5s on Egyptian mobile networks; Core Web Vitals "good". |

## 8. Sign-off

Scope FROZEN and signed 2026-06-13 (OD-1…OD-6); amended OD-7 2026-07-01 — bilingual AR/EN web app + theme, no schema, no new dependency. After sign-off, additions require a written change request and re-baselining of the PRD and phases.

- Product owner: __________  Date: ______
- Tech lead: __________  Date: ______

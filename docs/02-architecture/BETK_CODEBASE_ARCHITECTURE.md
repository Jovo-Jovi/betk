# BETK_CODEBASE_ARCHITECTURE.md
> Step 5 of the BETK Dev OS. Repository structure. Feature folder names map directly to UI Spec sections — not generic names.

## 1. Tree

```
src/
├── app/
│   ├── (public)/            # Guest-readable: /, search, category/[slug], listing/[id], store/[slug]
│   ├── (auth)/              # login, verify, register
│   ├── (buyer)/             # account, addresses, wishlist, following, inbox, checkout, orders, disputes, notifications
│   ├── (seller)/seller/     # onboarding, status, dashboard, store/*, listings/*, inventory, boosts, inbox, orders, reviews, earnings, transactions, payouts, level, analytics, disputes
│   ├── (admin)/admin/       # dashboard, sellers/approvals, users, listings, moderation/*, reviews, categories, orders, disputes, payments, payouts, collections, notifications, settings, boosts
│   └── api/                 # route handlers (webhooks: courier/Bosta tracking, Resend, etc.)
│
├── features/                # one folder per UI Spec area; each: components/ hooks/ actions/ queries/ types/
│   ├── auth/                #   FR-AUTH-1..3
│   ├── discovery/           #   homepage, search, category, listing-detail, storefront (FR-PUB-1..5)
│   ├── buyer-account/       #   profile, addresses, wishlist, following (FR-BUY-1..4)
│   ├── messaging/           #   inquiries + threads (FR-BUY-5, FR-SEL-13)
│   ├── checkout/            #   checkout, confirmation, payments (FR-BUY-6..7)
│   ├── orders/              #   buyer+seller orders, tracking, status (FR-BUY-8..9, FR-SEL-14..15)
│   ├── reviews/             #   leave/reply/moderate (FR-BUY-10, FR-SEL-16, FR-ADM-6)
│   ├── disputes/            #   raise/detail/manage (FR-BUY-11..12, FR-SEL-22, FR-ADM-9)
│   ├── notifications/       #   center + broadcast (FR-BUY-13, FR-ADM-13..14)
│   ├── seller-onboarding/   #   FR-SEL-1..2
│   ├── store-management/    #   store/delivery/returns/payments (FR-SEL-4..7)
│   ├── listings/            #   manage/create/edit/inventory (FR-SEL-8..10)
│   ├── boosts/              #   seller boost + admin approval (FR-SEL-11..12, FR-ADM-17)
│   ├── seller-analytics/    #   dashboard, earnings, transactions, payouts, level, analytics (FR-SEL-3,17..21)
│   └── admin/               #   approvals, users, moderation, categories, orders, payments, payouts, collections, settings, modlog (FR-ADM-1..16)
│
├── components/
│   ├── ui/                  # shadcn/ui base — DO NOT MODIFY; extend via wrappers in shared/
│   └── shared/              # ListingCard, StoreCard, PriceBlock, StatusBadge, StarRating, RatingSummary,
│                            # LevelBadge, VerifiedBadge, MessageThread, ImageUploader, OrderTimeline,
│                            # AddressForm, FilterSheet, SLABadge, EmptyState, SkeletonGrid/Table,
│                            # ErrorRetryCard, ConfirmDialog, Toaster  (see UI Spec §4)
│
├── lib/
│   ├── supabase/{client.ts, server.ts, service.ts, types.ts}   # types.ts via `supabase gen types`
│   └── utils.ts
├── services/{resend.ts, posthog.ts, sentry.ts, whatsapp.ts, sms.ts, courier.ts}
├── hooks/                   # global hooks
├── types/                   # shared TS types incl. hand-written JSONB interfaces over generated Json
├── validations/             # Zod schemas (separate from types) — one per feature
├── constants/               # enums.ts (mirror C3 §2), routes.ts, statusColors.ts
├── configs/
├── middleware.ts            # auth gate + role routing + suspended-user block
└── tests/                   # unit / integration / e2e
```

## 2. Conventions

- **Feature-first.** Code for a page lives in its `features/<area>/`: `components/` (UI), `hooks/` (client logic), `actions/` (Server Actions, Zod-validated), `queries/` (Supabase reads), `types/` (feature types). Pages in `app/` are thin and compose feature modules.
- **shadcn/ui:** never edit `components/ui/*`; extend via `components/shared/` wrappers (Dev OS Step 14 "extend, don't override").
- **Design-system ownership (Claude Design):** `components/ui` (shadcn base) + `components/shared` (design-system components) are the **visual-contract zone owned by Claude Design** (see `00-design/BETK_DESIGN_BRIEF.md`). Feature `components/` only **compose** these and wire data — they do not restyle them. Claude-Design-generated components MUST use the UI Spec §1 CSS-variable tokens (no hardcoded colors), be RTL-first (logical properties), and extend (not override) shadcn. Cursor changes data wiring inside these components, never their visual contract; visual changes go back through Claude Design + the UI-reviewer gate.
- **Naming:** files `kebab-case.ts(x)`; React components `PascalCase`; Server Actions `verbNoun` (e.g. `confirmDepositPayment`); queries `getX`/`listX`; Zod schemas `xSchema`.
- **Type safety:** `tsc --strict`; no `any`; generated Supabase types are the DB shape; Zod guards all inputs; money computed server-side (never float math in the client).
- **Supabase query pattern:** queries return `{ data, error }`; never swallow `error` — map to typed result, log to Sentry, surface via `ErrorRetryCard`/toast. RLS does authorization; queries assume the row scope and handle empty/denied as not-found.
- **Server Action pattern:** `parse input with Zod → check role/ownership → mutate → revalidate → return typed result | error`. No client-side writes.
- **Routes** centralized in `constants/routes.ts` so links match the UI Spec exactly.

## 3. Feature → page → table traceability

Every `features/<area>` folder header comments link its FR IDs (PRD §5), its UI Spec page sections, and the tables it touches (ERD §3), so the UI-reviewer agent can verify wireframe compliance per PR.

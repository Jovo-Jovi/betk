# src/features/

Feature-first code organisation. **Each folder owns one UI Spec area** and contains:

```
<area>/
  components/   UI components (compose from components/shared; never restyle)
  hooks/        Client-side React hooks
  actions/      Server Actions (Zod-validated; mutations only)
  queries/      Supabase read helpers returning { data, error }
  types/        Feature-local TypeScript types
  index.ts      Public barrel — re-export only what pages/other features need
```

Feature folders map to UI Spec areas (docs/00-design/BETK_UI_SPEC.md):

| Folder | UI Spec section | FR IDs |
|---|---|---|
| `auth/` | §3 Auth flows | FR-AUTH-1..3 |
| `discovery/` | §2 Public — home/search/category/listing/store | FR-PUB-1..5 |
| `buyer-account/` | §4.1–4.4 Buyer profile/addresses/wishlist/following | FR-BUY-1..4 |
| `messaging/` | §4.5 Buyer inbox / §5.13 Seller inbox | FR-BUY-5, FR-SEL-13 |
| `checkout/` | §4.6–4.7 Checkout & payments | FR-BUY-6..7 |
| `orders/` | §4.8–4.9 Buyer orders / §5.14–5.15 Seller orders | FR-BUY-8..9, FR-SEL-14..15 |
| `reviews/` | §4.10 Leave review / §5.16 Reply / §6.6 Moderate | FR-BUY-10, FR-SEL-16, FR-ADM-6 |
| `disputes/` | §4.11–4.12 Buyer disputes / §5.22 Seller / §6.9 Admin | FR-BUY-11..12, FR-SEL-22, FR-ADM-9 |
| `notifications/` | §4.13 Notif centre / §6.13–6.14 Admin broadcast | FR-BUY-13, FR-ADM-13..14 |
| `seller-onboarding/` | §5.1–5.2 Become seller / status | FR-SEL-1..2 |
| `store-management/` | §5.4–5.7 Store/delivery/returns/payments | FR-SEL-4..7 |
| `listings/` | §5.8–5.10 Manage/create/edit/inventory | FR-SEL-8..10 |
| `boosts/` | §5.11–5.12 Seller boost / §6.17 Admin approval | FR-SEL-11..12, FR-ADM-17 |
| `seller-analytics/` | §5.3,5.17–5.21 Dashboard/earnings/payouts/level | FR-SEL-3,17..21 |
| `admin/` | §6 Admin — all panels | FR-ADM-1..16 |

Each folder's `index.ts` header comment must list: FR IDs · UI Spec sections · tables touched (ERD §3) — required by the UI-reviewer gate.

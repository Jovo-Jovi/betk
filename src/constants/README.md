# src/constants/

App-wide constant definitions:

| File | Contents |
|---|---|
| `routes.ts` | Typed route builders matching UI Spec §2+§3 exactly (e.g. `routes.listing(id)`) |
| `enums.ts` | Mirror of every DB enum from C3 §2 (incl. `auth_provider`) as TS union literals |
| `statusColors.ts` | StatusBadge color map: enum value → `{ background, foreground }` token pair, keyed by all C3 enums (order/seller/dispute/payment/boost/listing/flag/payout) |

Feature folders map to UI Spec areas — see `src/features/README.md`.

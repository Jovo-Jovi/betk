# src/app/

Next.js 15 App Router root. Route groups map to authentication/role boundaries:

| Group | Access | UI Spec area |
|---|---|---|
| `(public)/` | Guest-readable | §2 Public pages — home, search, category, listing, store |
| `(auth)/` | Unauthenticated only | §3 Auth — login, verify, register |
| `(buyer)/` | Authenticated buyer | §4 Buyer — account, checkout, orders, disputes… |
| `(seller)/seller/` | Role = seller | §5 Seller — dashboard, listings, earnings… |
| `(admin)/admin/` | is_admin() = true | §6 Admin — approvals, moderation, settings… |
| `api/` | Server-only route handlers | Webhooks (Bosta/courier, Resend) |

Pages are **thin**: they import and compose modules from `src/features/<area>/` and never contain business logic. Feature folders map to UI Spec areas — see `src/features/README.md`.

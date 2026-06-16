# ADR.md — Architectural Decision Records
> `11-decisions/` home. One record per major technical choice. Append-only; supersede rather than edit.

### ADR-001 — Supabase JS Client over an ORM
Status: Accepted. Context: MVP needs type-safe DB access without ORM overhead. Decision: Supabase JS Client + `supabase gen types` + Zod; no Prisma/Drizzle. Consequences: regenerate types every migration; RLS is the authorization layer.

### ADR-002 — Split payment, no custody
Status: Accepted. Decision: 50% deposit (Instapay/VF Cash/Orange Cash) + 50% COD; two `payments` rows per order; BETK never holds funds. Consequences: manual seller confirmation; no gateway; wallet/escrow is post-MVP (C3 §8.4).

### ADR-003 — Phone OTP as sole auth
Status: **Superseded by ADR-008** (Google OAuth added per OD-4). Original: Supabase Auth phone OTP only; no passwords (R-A01).

### ADR-004 — tsvector full-text search (no external engine)
Status: Accepted. Decision: Postgres tsvector + GIN + unaccent for 1–2 keyword Arabic search; no Elasticsearch/Typesense at MVP. Consequences: revisit > ~500K listings (C3 §8.1).

### ADR-005 — RLS-first authorization
Status: Accepted. Decision: RLS enabled + default-deny on all 43 tables; UI auth gates are UX only. Consequences: every table needs policies from day 1; helper functions must be indexed/SECURITY DEFINER.

### ADR-006 — Soft delete limited to listings
Status: Accepted. Decision: `deleted_at` on listings only; append-only audit tables; status-hiding for suspensions. Consequences: order_items snapshot listing title/price.

### ADR-007 — Opus = architect/reviewer, Sonnet = builder (Cursor)
Status: Accepted. Decision: Per Dev OS Step 7, use Opus for architecture/security/review and Sonnet for routine implementation; current models Opus 4.8 / Sonnet 4.6. Consequences: cost/latency balance; reviewer pass is mandatory before merge.

### ADR-008 — Google OAuth added (supersedes ADR-003)
Status: Accepted (MVP Freeze 2026-06-13, OD-4). Decision: sign-in via phone-OTP OR Google OAuth (Supabase Auth links identities). `users.phone_number` nullable+UNIQUE; add `users.auth_provider ('phone'|'google')`. R-A01 amended to "phone-OTP + Google OAuth; phone verification gated to transactions." A verified phone is required before checkout, becoming a seller, or payout (Server Action + RLS WITH CHECK). Consequences: easier sign-up (goal of OD-4) without losing COD/notifications/trust which depend on a verified phone; one extra enum + nullable phone; transaction gate must be tested.

### ADR-009 — users.deleted_at / anonymized_at added now (OD-2)
Status: Accepted (MVP Freeze 2026-06-13). Decision: add two nullable timestamps to `users` during initial schema rather than later. MVP behavior = deactivate-only (login blocked when status≠active OR deleted_at set); anonymized_at reserved for post-MVP MW1. Consequences: avoids a future high-cost users migration; no added MVP behavior beyond deactivation.

# SECURITY_GUIDELINES.md
> Auth, RLS, input validation, OWASP basics. Reads with ERD §3 and C3 §8.2.

## Auth
Sign-in via phone-OTP **or Google OAuth** (Supabase Auth, identities linked; R-A01 amended — OD-4). No passwords. OTP hashed (SHA-256), 60s expiry, one active/phone, ≤5 attempts (R-A02). Session tokens hashed; raw returned once. `users.phone_number` nullable+UNIQUE; `auth_provider` records origin. **A verified phone is required before transacting** (checkout / become seller / payout) — enforced in Server Actions and RLS WITH CHECK. Phone read-only post-verification (R-A06). Suspended/banned/**deactivated** (`deleted_at`) blocked at middleware + per request (R-A05).

## Authorization
RLS enabled + default-deny on all 43 tables. UI auth gates are UX only; RLS + `is_admin()`/`my_store_id()` is the boundary. Server Actions re-check role/ownership. Service-role paths bypass RLS → must re-implement checks; service key never reaches the browser.

## Input validation
Zod on every Server Action and API route before any DB access. Mirror DB constraints (E.164 phone, rating 1–5, payout ≥100, photo/tag caps, slug rules). Normalize/trim at the edge.

## Storage
`seller_documents` PRIVATE bucket; admin access via ≤15-min signed URLs only (RISK 5). Media buckets public/CDN, metadata in DB.

## Five mandatory pre-launch conditions (C3 §8.2/§8.5)
1. WhatsApp template changes logged + approval workflow (RISK 1). 2. CHECK constraints on numeric `admin_settings` keys (RISK 2). 3. Trigger validating polymorphic `flagged_content.content_id` (RISK 3). 4. service_role bypass tested for pg_cron jobs (RISK 4). 5. Private docs bucket + short signed URLs (RISK 5).

## OWASP basics
Authz on every mutation; output encoding (RTL-safe); rate limiting on OTP/inquiry/search (`RATE_LIMITING.md`); audit-log admin actions (moderation_logs, R-M02); no secrets in code/logs/URLs.

# SECURITY_GUIDELINES.md
> Auth, RLS, input validation, OWASP basics. Reads with ERD §3 and C3 §8.2.

## Auth
Sign-in via phone-OTP **or Google OAuth** (Supabase Auth, identities linked; R-A01 amended — OD-4). No passwords. OTP hashed (SHA-256), 60s expiry, one active/phone, ≤5 attempts (R-A02). Session tokens hashed; raw returned once. `users.phone_number` nullable+UNIQUE; `auth_provider` records origin. **A verified phone is required before transacting** (checkout / become seller / payout) — enforced in Server Actions and RLS WITH CHECK. Phone read-only post-verification (R-A06). Suspended/banned/**deactivated** (`deleted_at`) blocked at middleware + per request (R-A05).

## Authorization
RLS enabled + default-deny on all 43 tables. UI auth gates are UX only; RLS + `is_admin()`/`my_store_id()` is the boundary. Server Actions re-check role/ownership. Service-role paths bypass RLS → must re-implement checks; service key never reaches the browser.

## Input validation
Zod on every Server Action and API route before any DB access. Mirror DB constraints (E.164 phone, rating 1–5, payout ≥100, photo/tag caps, slug rules). Normalize/trim at the edge.

## Storage
**Bucket division (Phase 04 / T01 + T01-FIX).** Two buckets, settled with the human:
- **`docs` — PRIVATE (`public=false`).** Holds seller national-ID images. `storage.objects` RLS: `docs_insert_own_prefix` (INSERT, `authenticated`, first path segment = `auth.uid()`) + `docs_select_own_or_admin` (SELECT, own-prefix OR `is_admin()`). **NO UPDATE and NO DELETE policy** → default-deny, which is what backs R-S08 retention (see below). Admin review reads via ≤15-min signed URLs only, service-role side (RISK 5). Documents are private end-to-end.
- **`media` — PUBLIC-read (`public=true`).** Holds store avatars/covers (and later listing images — T01 naming decision, reused in Phase 05). RLS: `media_insert_own_prefix` + `media_update_own_prefix` (own-prefix writes) + `media_select_own_prefix` (SELECT, `authenticated`, own-prefix). The broad `media_public_select` (SELECT TO public) was **dropped by T01-FIX** so Data-API `.list()`/enumeration is denied; per-object public-URL reads still serve (the load-bearing app read path) because the bucket stays `public=true`. Hardening removed listing/enumeration, not per-object public reads.

**R-S08 retention semantics (Phase 04 / T05).** A rejected application's resubmission uploads to a NEW object path under the same owner-prefix and repoints the `seller_documents.storage_path`; because the `docs` bucket has no UPDATE/DELETE policy, the ORIGINAL ID objects **persist at their old paths** (recoverable by prefix, never garbage-collected in MVP). This is an accepted PII-lifecycle posture, not a leak: admin review (Phase 14) should know that prior-version ID objects continue to exist at their old paths and account for them in any PII-erasure work.

**Media URL uid posture (Phase 04 / T06).** Public media URLs embed the seller's `uid` in their path (`{uid}/avatar-…`). This is the accepted **id-not-PII** posture (consistent with Sentry id-only): a uid is an opaque identifier, not personal data, so exposing it in a public CDN URL is not a disclosure.

**PII discipline (national IDs, absolute).** No document path, filename, or content is ever written to a log, Sentry event, PostHog property, or error message — the become-seller/resubmit actions stay id-only (grep-proof at T08). Metadata in DB; the bucket names are config, not secrets.

## Five mandatory pre-launch conditions (C3 §8.2/§8.5)
1. WhatsApp template changes logged + approval workflow (RISK 1). 2. CHECK constraints on numeric `admin_settings` keys (RISK 2). 3. Trigger validating polymorphic `flagged_content.content_id` (RISK 3). 4. service_role bypass tested for pg_cron jobs (RISK 4). 5. Private docs bucket + short signed URLs (RISK 5).

## OWASP basics
Authz on every mutation; output encoding (RTL-safe); rate limiting on OTP/inquiry/search (`RATE_LIMITING.md`); audit-log admin actions (moderation_logs, R-M02); no secrets in code/logs/URLs.

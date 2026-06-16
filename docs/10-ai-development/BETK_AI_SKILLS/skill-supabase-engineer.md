# skill-supabase-engineer.md
**Owns:** Auth, Storage, Edge Functions, RLS, JS Client.

- Auth: phone OTP via Supabase Auth; map `auth.users` ↔ `betk.users` (same id); set `last_login_at` on verify; sessions 30d mobile / 24h web.
- Storage: private `seller_documents` (signed URLs ≤15 min for admin review); public `listing-media` (WebP). Delete Storage objects when DB rows are removed.
- pg_cron (6 jobs, Africa/Cairo): expire-boosts (*/15m), recalculate-seller-levels (02:00), daily-platform-snapshot (00:05), dispute-sla-alert (hourly), lift-temp-suspensions (03:00), cleanup-otp-tokens (:30). Test all in staging before prod (C3 §8.5).
- Connection pooling: PgBouncer from day 1 — TRANSACTION mode for requests, SESSION for jobs.
- Edge Functions optional for cached homepage; keep MVP simple — prefer Next.js caching first.

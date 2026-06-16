# LAUNCH_CHECKLIST.md
> Step 16 of the BETK Dev OS. All boxes checked before public launch.

## Mandatory architecture conditions (C3 §8.5 — gates)
- [ ] All 5 security risks addressed (template logging, admin_settings CHECKs, flagged_content content_id trigger, service_role bypass tested, private docs bucket)
- [ ] PgBouncer connection pooling enabled (TRANSACTION mode requests / SESSION jobs)
- [ ] seller_documents Storage bucket is PRIVATE; signed URLs ≤15 min
- [ ] All 6 pg_cron jobs tested in staging
- [ ] notifications 90-day archive job scheduled

## Security & data
- [ ] RLS policy review — every one of the 43 tables
- [ ] API route + Server Action auth coverage
- [ ] Zod validation coverage (every route/action)
- [ ] Phone-OTP hygiene (hash, 60s, ≤5 attempts) verified
- [ ] Supabase migration state verified on production DB
- [ ] Backup/PITR restore tested (DISASTER_RECOVERY)

## Performance & quality
- [ ] All 34 indexes present in production
- [ ] Performance review — Core Web Vitals "good"; homepage/storefront p95 < 2.5s on EG mobile
- [ ] Homepage 60s + rating_aggregates 5-min caching active
- [ ] SEO review (RTL, metadata, sitemaps)

## Observability & comms
- [ ] PostHog events wired on key funnels
- [ ] Sentry error tracking verified (client/server/actions)
- [ ] Resend email flows tested end-to-end
- [ ] WhatsApp templates approved + change logging on
- [ ] SMS (OTP + SLA alerts) tested

## Config
- [ ] Environment variables confirmed in Vercel production (all per CONFIGURATION)
- [ ] .env.example present; no secrets committed

## Scope
- [ ] OD-1..OD-6 reflected in code: no inventory_alerts table; deactivate-only account (`users.deleted_at`/`anonymized_at` present, no anonymization); no campaign entity; **Google OAuth IN** (phone nullable, `auth_provider`, verified-phone gate before checkout/become-seller/payout); sessions UI out + WhatsApp templates under Admin→Settings→Notifications; 43-table types
- [ ] Auth: phone-OTP + Google OAuth both tested; transaction phone-gate enforced in Server Actions AND RLS WITH CHECK; deactivated users (`deleted_at`) blocked at login
- [ ] All 56 UI Spec pages pass their acceptance criteria (QA + UI-reviewer sign-off)

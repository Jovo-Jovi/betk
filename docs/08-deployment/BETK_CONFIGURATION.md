# BETK_CONFIGURATION.md
> Step 11 of the BETK Dev OS. Environment variable inventory. Never commit real values; `.env.local` is git-ignored; production vars live in Vercel.

## Environment variables

| Service | Variable | Scope | Notes |
|---|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` | client | Project URL |
| Supabase | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Anon key — RLS applies |
| Supabase | `SUPABASE_SERVICE_KEY` | server only | Bypasses RLS; background jobs/trusted server only. NEVER expose to browser |
| Google OAuth | `GOOGLE_CLIENT_ID` | server | **Active (OD-4)** — Supabase Auth Google provider |
| Google OAuth | `GOOGLE_CLIENT_SECRET` | server | **Active (OD-4)** — configure in Supabase Auth |
| Resend | `RESEND_API_KEY` | server | Transactional email |
| Resend | `RESEND_FROM_ADDRESS` | server | Verified BETK domain sender |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY` | client | Product analytics |
| PostHog | `NEXT_PUBLIC_POSTHOG_HOST` | client | EU/US host |
| Sentry | `SENTRY_DSN` | server | Server error tracking |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN` | client | Client error tracking |
| Vercel | — | — | All vars synced via Vercel dashboard per environment |
| Storage | `SUPABASE_DOCS_BUCKET` | server | Private bucket name for seller_documents |
| Storage | `SUPABASE_MEDIA_BUCKET` | server | Public/CDN bucket for listing/review images |
| WhatsApp | `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_ID` | server | Approved-template sends (R-N02) |
| SMS | `SMS_PROVIDER_KEY` | server | OTP + SLA/alert SMS |

## Rules
- Secrets handled only via Vercel env / a password manager — never typed into code, logs, URLs, or client bundles. The credential-entry prohibitions in the team rules apply (`AI_DEVELOPMENT_RULES.md`).
- `NEXT_PUBLIC_*` only for values safe in the browser. The service key is server-only; a lint/CI check forbids it in any client path.
- Provide `.env.example` (keys, no values) in the repo root.
- Per-environment values: local / preview / production kept distinct in Vercel.

## Supabase Storage buckets
- `seller_documents` (private): RLS — owner seller + admins; ≤15-min signed URLs (C3 §8.2 RISK 5).
- `listing-media` (public/CDN): WebP, compressed; metadata in `listing_images`/`review_photos`.

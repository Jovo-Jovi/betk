# src/services/

Typed wrappers around third-party integrations. All read keys via `configs/env.ts`. In Phase 01 these are scaffolded; real sends are gated to non-dev environments.

| File | Service | Notes |
|---|---|---|
| `resend.ts` | Resend email | `sendEmail(to, template, vars)` |
| `posthog.ts` | PostHog analytics | `capture(event, props)` — no PII |
| `sentry.ts` | Sentry error tracking | `captureError(err)`, `tag(key, val)` |
| `whatsapp.ts` | WhatsApp (via Supabase `whatsapp_templates`) | Approved-template-only per R-N02 |
| `sms.ts` | SMS (OTP + SLA alerts) | `sendSms(to, body)` |
| `courier.ts` | Bosta delivery | `createShipment`, `getTracking` |

Feature folders map to UI Spec areas — see `src/features/README.md`.

# API_STANDARDS.md
> Route naming, response shapes, error codes, versioning.

- **Surface:** Server Actions for UI mutations; `app/api/*` Route Handlers only for webhooks/integrations (Bosta tracking, Resend events, SMS/WhatsApp callbacks).
- **Result shape:** `{ ok: true, data }` | `{ ok: false, error: { code, message, fields? } }`. No raw throws across the boundary.
- **Error codes:** `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`. RLS denial maps to `NOT_FOUND` (don't leak existence).
- **Order of operations:** authenticate → authorize (role/ownership) → Zod validate → act → revalidate → return.
- **Webhooks:** verify signature; idempotent on external id; respond fast, process async where possible.
- **No PII in URLs/query strings.** Versioning: prefix `app/api/v1/*` for external webhooks; internal Server Actions are versionless (co-located with features).

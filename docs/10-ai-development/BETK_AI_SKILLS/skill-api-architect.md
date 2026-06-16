# skill-api-architect.md
**Owns:** API design, route standards, response shapes.

When designing any Route Handler or Server Action:
- Prefer Server Actions for mutations bound to the UI; reserve `app/api/*` Route Handlers for webhooks (Bosta tracking, Resend events) and any non-form integration.
- Standard result shape: `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Never throw raw across the boundary; map to typed errors. Error codes are stable strings (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`).
- Every input is validated with a Zod schema from `src/validations/` BEFORE any DB call. Reject on parse failure with `VALIDATION` and field errors.
- Authorization order: authenticate → authorize (role/ownership) → validate → act → revalidate. RLS is the backstop, not the only check.
- Idempotency for side-effectful webhooks (dedupe on external id). No PII in URLs/query strings.
- Reference `API_STANDARDS.md`. Match routes to `constants/routes.ts` and the UI Spec exactly.

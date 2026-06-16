# ERROR_HANDLING_STANDARDS.md
> Error boundary patterns, API error shapes, toast vs modal, Sentry tagging.

- **Boundaries:** `error.tsx` per route group + section-level `ErrorRetryCard` so a failed homepage strip/dashboard widget doesn't take down the page. `not-found.tsx` for missing/denied/soft-deleted.
- **API errors:** the `{ ok:false, error:{code,message,fields} }` shape (`API_STANDARDS.md`). Never expose SQL/RLS internals to users.
- **Toast vs modal:** toast = completed/recoverable action with no decision (saved, sent, retry); modal (`ConfirmDialog`) = before irreversible/high-consequence actions (cancel order, delete listing, permanent ban [mandatory R-M04], account deactivate, payout reject, dispute resolution, mass broadcast). Inline validation for form correctness.
- **Sentry:** capture on client + server + Server Actions; tag `feature`, `role`, `route`; scrub PII; breadcrumb the action name. Alert on error-rate spikes.
- **Never lose user input** on failure; preserve form/query state.

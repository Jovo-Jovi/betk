# UI_STATE_STANDARDS.md
> Skeletons, empty states, optimistic updates — derived from the UI Spec §6. Authoritative for every page.

- **Loading:** skeleton for data/navigation loads (match final layout; render progressively, per-section); spinner only for in-place mutations (button submit, inline save, upload, OTP verify). Never a full-page spinner where a skeleton can preview structure.
- **Empty:** one-line plain-Arabic explanation + single primary CTA toward the unblocking action. Distinguish no-data-yet (encouraging) from filtered-no-results (offer "clear filters"). Admin queues use positive empties ("queue is clear").
- **Error:** field-level inline; section-level `ErrorRetryCard`; page-level retry only when the primary resource fails; `404` for missing/denied. Non-technical copy.
- **Optimistic updates:** allowed for low-risk toggles (wishlist, follow, mark-read) with rollback on failure; never for money/order-state transitions (those await server confirmation).
- **Toast vs modal:** see `ERROR_HANDLING_STANDARDS.md`.

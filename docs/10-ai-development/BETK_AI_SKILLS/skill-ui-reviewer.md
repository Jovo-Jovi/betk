# skill-ui-reviewer.md
**Owns:** wireframe compliance checking, UI state coverage.  ← NEW

Ground truth is `BETK_UI_SPEC.md`. For each UI PR, verify against the page's spec section — do NOT accept whatever the model assumed:
- Route + auth gate match the spec.
- Every listed component is present; no invented components or features (scope is frozen in `BETK_MVP_SCOPE.md`).
- Data reads/writes hit exactly the tables in the spec/PRD; no stray fields (every field maps to a real column — ERD).
- All four states implemented: happy path + edge cases, empty, loading (skeleton vs spinner per rule), error.
- RTL correct; tokens used (no hardcoded colors); shadcn extended not overridden.
- Flagged gaps (OD-1 inventory derived, OD-2 deactivate-only, OD-3 no campaign entity, OD-5 sessions/templates) respected — not silently "fixed" by adding unspecified tables/screens.
- Components may be Claude-Design-generated: still verify each against its UI Spec §3 page section (components present, all four states, tokens used not hardcoded, RTL correct, shadcn extended not overridden). Visual contract changes must come from Claude Design via a PR, not ad-hoc Cursor edits.
Reject with the specific spec line that fails.

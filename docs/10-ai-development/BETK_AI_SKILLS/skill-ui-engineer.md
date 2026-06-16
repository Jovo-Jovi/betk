# skill-ui-engineer.md
**Owns:** shadcn/ui, Tailwind, component architecture.  ← NEW

- Build only what `BETK_UI_SPEC.md` specifies for the page. Components come from the UI Spec §4 shared list or the feature's `components/`.
- Use shadcn/ui primitives; never edit `components/ui/*` — extend via `components/shared/` wrappers.
- Polished `components/shared` components may originate from **Claude Design** (`00-design/BETK_DESIGN_BRIEF.md`). Treat their visual contract as fixed: compose them into feature pages and wire data via Server Actions/queries; do not restyle, fork, or hardcode colors. Needed visual changes are raised to Claude Design, not patched here.
- Use design tokens from UI Spec §1 (CSS vars for color, the type scale, radius/spacing/shadow). RTL-first; Arabic display/body faces; mono for refs/OTP/tracking.
- Centralize status→color via `StatusBadge` (one map for all enums). Use `EmptyState`/`SkeletonGrid`/`SkeletonTable`/`ErrorRetryCard`/`ConfirmDialog` per `UI_STATE_STANDARDS.md`.
- Every page implements its empty, loading, and error states (not just the happy path). Toast vs modal per the decision rule (toast = done/recoverable; modal = irreversible/needs consent).
- Accessibility: labels, focus ring (`--ring`), keyboard paths, screen-reader friendly RTL.

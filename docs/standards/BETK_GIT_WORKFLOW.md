# BETK_GIT_WORKFLOW.md
> Step 10 of the BETK Dev OS.

Branches: `main` (production), `develop` (integration), `feature/<name-from-wireframes>` (one per UI Spec feature area / phase task).

Flow: `feature → PR → review → develop → main`. Do this even solo — PRs catch what self-review misses.

- Branch names map to feature folders (`feature/checkout`, `feature/seller-onboarding`, …).
- Every PR passes CI gates (lint, typecheck, tests, types-drift) and the three review gates (Security, UI-reviewer, QA) before merge to `develop`.
- `main` only from `develop` after E2E green + (for releases) launch-checklist items relevant to the change.
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`); reference FR/AC id where relevant.
- Update `docs/12-changelog/DEVELOPMENT_JOURNAL.md` in the same PR as the change.

## Claude Design contributions
Claude Design links to the repo and commits generated/refined components to a `feature/design-*` branch (frontend subfolder only — see BETK_DESIGN_BRIEF.md). That branch goes through the SAME flow: PR → CI gates → **UI-reviewer + Security review** → merge to `develop`. Generated UI is never merged straight to `develop`/`main`. Keep the design system in `components/ui` + `components/shared`; Cursor wires data in feature folders against the merged components.

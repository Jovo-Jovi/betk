# BETK — Documentation Index
> Generated per the BETK Dev OS.

**Read order (understand the project):** `BETK_MASTER_EXECUTION_PROMPT.md` → `BETK_MVP_SCOPE.md` → `BETK_UI_SPEC.md` → `BETK_PRD.md` → `BETK_ERD.md` → `BETK_ARCHITECTURE.md` → `BETK_CODEBASE_ARCHITECTURE.md` → `BETK_PHASES.md`.

**Run the build (AI execution):** read `10-ai-development/HOW_RULES_AUTORUN.md` (how skills auto-attach; you pick the model only) → `SESSION_CONTEXT.md` (live state) → execute the current `phase-packs/PHASE_*.md`.

## Repo root layout
```
<repo root>/
├── .cursor/rules/*.mdc   ← authoritative, auto-attaching Cursor rules (7 files)
├── .cursor/mcp.json      ← optional Supabase MCP (you create; git-ignore the token)
└── docs/                 ← everything below
```
`.cursor/` and `docs/` must both sit at the repo root (same level as `.git`) or the glob rules won't auto-attach.

## docs/ map (Dev OS Step 12 structure)
- `00-design/BETK_UI_SPEC.md` — UI ground truth (59 pages)
- `00-design/BETK_DESIGN_BRIEF.md` — brief for Claude Design setup (tokens, fonts, RTL, component inventory)
- `01-product/BETK_MVP_SCOPE.md` (frozen scope + OD-1…OD-6 decisions) · `BETK_PRD.md` (FRs + acceptance)
- `02-architecture/` — `BETK_ARCHITECTURE.md`, `BETK_CODEBASE_ARCHITECTURE.md`, `ADR.md`
- `03-database/` — `BETK_ERD.md` (RLS/index/type mapping, 43-table inventory) · `BETK_DATABASE_SCHEMA.sql` (contract + freeze deltas)
- `04-api/API_STANDARDS.md`
- `06-security/SECURITY_GUIDELINES.md`
- `07-testing/TESTING_STRATEGY.md`
- `08-deployment/` — `BETK_CONFIGURATION.md`, `CICD_PIPELINE.md`
- `09-monitoring/ERROR_HANDLING_STANDARDS.md`
- `10-ai-development/` — `BETK_MASTER_EXECUTION_PROMPT.md` (the brain), `SESSION_CONTEXT.md` (live state), `HOW_RULES_AUTORUN.md`, `BETK_AI_TEAM.md`, `BETK_PHASES.md`, `AI_DEVELOPMENT_RULES.md`, `BETK_CURSOR_SETUP.md`
- `10-ai-development/BETK_AI_SKILLS/` — 9 skill files (mirrored as `.cursor/rules/`)
- `10-ai-development/phase-packs/` — `PHASE_01_FOUNDATION.md`, `PHASE_DS_DESIGN_SYSTEM.md`
- `11-decisions/` — empty for now; ADRs live in `02-architecture/ADR.md`
- `12-changelog/DEVELOPMENT_JOURNAL.md`
- `standards/` — `UI_STATE_STANDARDS.md`, `CACHING_STRATEGY.md`, `RATE_LIMITING.md`, `DISASTER_RECOVERY.md`, `BETK_GIT_WORKFLOW.md`
- `LAUNCH_CHECKLIST.md`
- `.cursorrules` — **legacy human summary only** (Agent mode ignores it; superseded by `.cursor/rules/00-betk-core.mdc`)

## Status
- **Docs complete.** Scope **FROZEN & signed 2026-06-13** (OD-1…OD-6 in `BETK_MVP_SCOPE.md §6`; includes OD-4 Google OAuth IN and the OD-2 `users.deleted_at`/`anonymized_at` additions).
- **Build underway** — Phase 01 Foundation. **Live phase/task is in `10-ai-development/SESSION_CONTEXT.md`** (this README is not the status tracker).

## Cursor rules (auto-execution)
Authoritative rules live in **`.cursor/rules/*.mdc`** at the repo root: one always-on core rule + glob-scoped rules (database / actions-api / ui / tests) that auto-attach from the files you touch + two agent-requested review rules (security / UI). You only pick the model; the core rule flags a model mismatch. Full mechanism: `10-ai-development/HOW_RULES_AUTORUN.md`.

## Key frozen facts (don't drift)
- 43 physical tables (not "28"). Authoritative inventory: `BETK_ERD.md §1.1`.
- Auth: phone-OTP **+ Google OAuth**; `users.phone_number` nullable; **verified phone required before transacting** (checkout / become-seller / payout).
- Design system (`components/ui` + `components/shared`) owned by Claude Design; Cursor composes + wires data, never restyles.
- Scope is frozen: no new pages/tables/features beyond `BETK_MVP_SCOPE.md`.
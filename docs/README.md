# BETK — Documentation Index
> Generated per the BETK Dev OS. Read order for a new contributor: Master Execution Prompt → MVP Scope → UI Spec → PRD → ERD → Architecture → Codebase → Phases.

## Map (Step 12 structure)
- `00-design/BETK_UI_SPEC.md` — UI ground truth (56 pages)
- `00-design/BETK_DESIGN_BRIEF.md` — brief for Claude Design setup (tokens, fonts, RTL, component inventory)
- `01-product/` — `BETK_MVP_SCOPE.md` (frozen scope), `BETK_PRD.md` (FRs + acceptance)
- `02-architecture/` — `BETK_ARCHITECTURE.md`, `BETK_CODEBASE_ARCHITECTURE.md`, `ADR.md`
- `03-database/` — `BETK_ERD.md` (RLS/index/type mapping), `BETK_DATABASE_SCHEMA.sql` (contract)
- `04-api/API_STANDARDS.md`
- `06-security/SECURITY_GUIDELINES.md`
- `07-testing/TESTING_STRATEGY.md`
- `08-deployment/` — `BETK_CONFIGURATION.md`, `CICD_PIPELINE.md`
- `09-monitoring/ERROR_HANDLING_STANDARDS.md`
- `10-ai-development/phase-packs/` — `PHASE_01_FOUNDATION.md`, `PHASE_DS_DESIGN_SYSTEM.md`
- `10-ai-development/` — `BETK_MASTER_EXECUTION_PROMPT.md` (the brain), `SESSION_CONTEXT.md`, `BETK_AI_TEAM.md`, `BETK_PHASES.md`, `AI_DEVELOPMENT_RULES.md`, `BETK_CURSOR_SETUP.md`, `.cursorrules`, `BETK_AI_SKILLS/` (9)
- `11-decisions/` (ADRs live in 02-architecture/ADR.md for now)
- `12-changelog/DEVELOPMENT_JOURNAL.md`
- `standards/` — `UI_STATE_STANDARDS.md`, `CACHING_STRATEGY.md`, `RATE_LIMITING.md`, `DISASTER_RECOVERY.md`, `BETK_GIT_WORKFLOW.md`
- `LAUNCH_CHECKLIST.md`

## Status
Documentation phase COMPLETE. Gate before code: sign off OD-1…OD-6 (`01-product/BETK_MVP_SCOPE.md §8`), then start `BETK_PHASES.md` Phase 01.

> Cursor rules: the authoritative, auto-attaching rules live in **`.cursor/rules/*.mdc`** at the repo root (already generated). They auto-derive the right skill from the files you touch — you only pick the model. See `10-ai-development/HOW_RULES_AUTORUN.md`. The legacy `docs/.cursorrules` is a human summary only (Agent mode ignores it).

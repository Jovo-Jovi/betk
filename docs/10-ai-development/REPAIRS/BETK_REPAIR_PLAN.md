# BETK_REPAIR_PLAN.md — Pre-T02 Repair & Hygiene Pack
> Generated 2026-07-06 by the review chat from the AUDIT-DEVOS snapshot + SESSION_CONTEXT (post-OD-7 close).
> **Purpose:** everything that should land before Phase 03 T02 (Homepage), packaged as runnable Cursor prompts so it can execute whenever the logo/design work pauses. One task per fresh Cursor window; opener as always: `Read SESSION_CONTEXT.md, then execute R0n`. Paste each output to the review chat for a PASS/FAIL verdict before the next.
>
> **Blocking rule:** R1 is a HARD BLOCKER for any future schema-touching task (including `supabase db push`). R2–R5 are strongly recommended before T02 but not blocking for it (T02 is compose-only). R4 can run anytime (docs-only).

---

## Execution order

| # | Task | Model | Class | Blocks |
|---|---|---|---|---|
| R1 | Migration ledger repair | **Opus** | DB/ledger | Any future `db push` / schema task |
| R2 | `decrement_stock_on_confirm` backfill to source | **Opus** | DB/security | Phase 07 correctness (inert until then) |
| R3 | pg_cron timezone correction | **Opus** | DB/ops | Pre-launch correctness |
| R4 | Docs hygiene batch | **Sonnet** | Docs-only | Nothing (label-only) |
| R5 | Promote rls-smoke on migration PRs | **Opus** | CI/security gate | Nothing (hardening) |

R1 first, always. R2 and R3 can run in either order after R1 (both produce new migrations — R1 must align the ledger before they push). R4 and R5 are independent and can slot anywhere.

---

## R1 — MIGRATION LEDGER REPAIR (Opus) 🔴 blocker

**Why.** The T01-FIX migration exists locally as `supabase/migrations/20260701021800_catalog_public_read_rls.sql`, but the MCP `apply_migration` recorded it in the live `supabase_migrations` ledger under version **`20260630232657`** (its own apply-time stamp). The next `supabase db push` will treat the local file as unapplied and re-run it; `CREATE POLICY` has no `IF NOT EXISTS`, so the push hard-fails on duplicate policies. Also: SESSION_CONTEXT's claim that the migration "won't appear in CLI `migration list`" is factually wrong — it appears, under the other version.

**Prompt:**
```
Read SESSION_CONTEXT.md, then execute R1 — migration ledger repair. DB-ledger task; make NO schema changes, NO policy changes, NO db push.

Context: supabase/migrations/20260701021800_catalog_public_read_rls.sql was applied to staging (sojmjvohiziapiwkzsjg) via MCP apply_migration, which recorded it in the remote supabase_migrations ledger as version 20260630232657. Local filename and remote version must match or the next db push will re-apply it and fail on duplicate CREATE POLICY.

Steps:
1. VERIFY FIRST (read-only): via MCP execute_sql, `select version, name from supabase_migrations.schema_migrations order by version;`. Confirm exactly 15 rows; confirm 20260630232657 is present with the catalog_public_read_rls name; confirm every other version matches a local filename 1:1. STOP-and-flag if the remote set differs from local in ANY way other than this one version (do not repair by pushing or deleting).
2. Rename the local file with git: `git mv supabase/migrations/20260701021800_catalog_public_read_rls.sql supabase/migrations/20260630232657_catalog_public_read_rls.sql`. Do NOT edit the file's contents.
3. Confirm file ordering remains correct (20260630232657 sorts after 20260622091700 and before nothing else — it becomes migration 15 of 15 by timestamp; note that it sorts BEFORE 20260701* would have; verify no local file exists between the two stamps).
4. Re-verify alignment (read-only): if the CLI is linked in this environment, `supabase migration list` must show all 15 aligned Local↔Remote with zero orphans on either side; if the CLI is NOT linked, re-run the MCP read from step 1 and diff against `ls supabase/migrations` — must be a perfect 1:1 match.
5. Update SESSION_CONTEXT.md: correct the "won't appear in CLI migration list — no migration repair" claim in the T01-FIX block (it DOES appear, under 20260630232657; repaired by rename, ledger now aligned); update the filename wherever SESSION_CONTEXT cites it as current state. Do NOT rewrite DEVELOPMENT_JOURNAL history — append a new dated R1 entry instead.
6. Run pnpm typecheck + the 3 guards (nothing should change — this is a rename + docs update).

Done when: git shows a rename (not delete+add of different content); remote ledger and local filenames are a verified 1:1 set of 15; SESSION_CONTEXT corrected; journal appended; CI-relevant checks clean. Output the step-1 and step-4 query results verbatim in your report.
```

**Done-when (review checklist):** rename verified content-identical · 15↔15 alignment proven with pasted query output · SESSION_CONTEXT correction present · journal appended, not edited.

---

## R2 — `decrement_stock_on_confirm` BACKFILL (Opus)

**Why.** ERD §7 and the Phase-01 DoD specify 5 triggers; the authoritative `BETK_DATABASE_SCHEMA.sql` defines only 4. The stock-decrement trigger (R-L05/R-L06) has been "owed to source" since T05, confirmed absent from source **and** live at T14 and again by the audit. It is inert until Phase 07 (no order-confirmation flow exists), which makes now the safest time to land it — it can be verified in isolation with zero behavioral risk.

**Prompt:**
```
Read SESSION_CONTEXT.md, then execute R2 — backfill the decrement_stock_on_confirm trigger to source + a new migration. DB/security-classed. Prereq: R1 is DONE (ledger aligned) — verify this in SESSION_CONTEXT before proceeding; STOP if not.

1. READ THE SPEC FIRST: BETK_ERD.md §7 (triggers) and the R-L05/R-L06 business rules (stock decrement on order confirmation; sold-out behavior R-N06 if specified). Implement EXACTLY what the docs specify. STOP-and-flag (do not improvise) if the docs leave any semantic undefined — e.g. behavior at stock 0, whether listings.status flips to sold_out at 0, whether decrement is per order_item quantity, or which orders.status transition fires it. List each ambiguity instead of choosing.
2. If the spec is complete: add the trigger function + trigger to BETK_DATABASE_SCHEMA.sql in the triggers section (source parity — this file is the authoritative source), then create a NEW migration file (never edit applied migrations) containing the same statements. Match the style of the existing 4 triggers (naming trg_*, SECURITY, search_path pinned per the security-advisor finding pattern).
3. Apply: CLI `supabase db push` if linked; otherwise MCP apply_migration with the migration filename's own timestamp — and immediately re-verify ledger alignment as in R1 step 4 (do not recreate the R1 problem).
4. Verify live (read-only MCP): pg_trigger shows the new trigger on betk.orders (or the specced table); function exists with pinned search_path.
5. Proof test (integration, STAGING_GUARD-gated, service-role seed since orders INSERT is default-denied for authenticated): seed listing with stock N + an order in the pre-confirm status, drive the specced status transition, assert stock decremented exactly per spec (and sold_out flip if specced); clean up to zero residue.
6. pnpm typecheck (types unaffected by triggers — types-drift stays green), lint, guards; update SESSION_CONTEXT (close open-issue #4) + append journal.

Done when: trigger in source AND live AND ledger-aligned; spec ambiguities either none or STOP-flagged; integration proof green; open-issue #4 closed in SESSION_CONTEXT.
```

**Review checklist:** no improvised semantics · source file and migration byte-consistent · ledger alignment re-proven post-apply · test residue zero.

---

## R3 — PG_CRON TIMEZONE CORRECTION (Opus)

**Why.** All 6 jobs are documented Cairo-local in comments but stored as bare cron expressions evaluated in the cluster TZ (UTC on Supabase). The 3 daily jobs fire ~2–3h off intent. Complication: Egypt observes DST (UTC+3 roughly Apr–Oct, UTC+2 otherwise), so a fixed UTC conversion drifts ±1h seasonally — acceptable for overnight batch jobs if the chosen UTC time keeps them in the overnight Cairo window year-round.

**Prompt:**
```
Read SESSION_CONTEXT.md, then execute R3 — pg_cron timezone correction. DB/ops-classed. Prereq: R1 DONE (ledger aligned); verify, STOP if not.

1. Investigate (read-only MCP): `show cron.timezone;` (or query pg_settings) on staging. If the GUC is settable to 'Africa/Cairo' at a level that persists on this Supabase cluster, prefer that single-setting fix and skip rescheduling.
2. If not settable (expected): create ONE new migration that cron.unschedule + cron.schedule the 3 daily jobs with UTC-equivalent expressions chosen to stay in the overnight Cairo window under BOTH UTC+2 and UTC+3 (Egypt DST). Intent map to honor: recalculate-seller-levels ≈ 02:00 Cairo; daily-platform-snapshot ≈ 00:05 Cairo; lift-temp-suspensions ≈ 03:00 Cairo. The hourly/15-min jobs (dispute-sla-alert, cleanup-otp-tokens, expire-boosts) are unaffected — do not touch them.
3. Comment each rescheduled job in the migration with: the UTC expression, the resulting Cairo time in winter (UTC+2) AND summer (UTC+3), and the original intent. Never edit the original applied cron migration; also update the comment block in BETK_DATABASE_SCHEMA.sql's cron section to match (source parity).
4. Apply per the R2 step-3 rule (CLI preferred; MCP fallback + immediate ledger alignment re-check).
5. Verify live (read-only): cron.job rows show the 3 new schedules + unchanged other 3; job names unchanged.
6. Update SESSION_CONTEXT (close the T14 cron-TZ finding, record the winter/summer Cairo times) + append journal.

Done when: 3 daily jobs rescheduled with documented dual-season Cairo times; other 3 untouched; source comment synced; ledger aligned; finding closed.
```

**Review checklist:** DST reasoning present · only the 3 daily jobs touched · dual-season times documented · ledger alignment re-proven.

---

## R4 — DOCS HYGIENE BATCH (Sonnet, docs-only)

**Why.** Accumulated label-only corrections. One important correction to the plan itself: the earlier carry-forward said the OD-7 ADR would renumber to "likely ADR-003" — **that slot is taken** (`ADR.md` already owns ADR-001…ADR-010; ADR-003 is "Phone OTP as sole auth", superseded). The OD-7 i18n/theming decision must become **ADR-011**, registered in `ADR.md` as the single registry.

**Prompt:**
```
Read SESSION_CONTEXT.md, then execute R4 — docs hygiene batch (EXTENDED). Docs + comments ONLY: no code behavior, no schema, no CI logic. Every edit is a label/reference correction.

1. ADR renumber (collision fix): the OD-7 i18n/theming decision labeled "ADR-002" in BETK_ARCHITECTURE.md §9 collides with ADR.md's ADR-002 (Split payment). ADR.md owns ADR-001..ADR-010 → next free slot is ADR-011 (NOT ADR-003 — exists, superseded). (a) Add ADR-011 to docs/02-architecture/ADR.md as the canonical entry (i18n + theming via next-intl/next-themes, presentation-layer only, OD-7), append-only; (b) relabel BETK_ARCHITECTURE.md §9 heading + §4 cross-reference to ADR-011 with a pointer to ADR.md; (c) update "ADR-002" references in BETK_UI_SPEC.md §4, OD7_BILINGUAL_THEME_TRACK.md, and the comment at src/middleware.ts L11 (comment-only, no logic); (d) sweep for stray "ADR-002 (i18n)" mentions. ALSO: commit the pre-existing uncommitted OD7-tracker modified line (it is this same ADR-011 fix, deliberately excluded from the DESIGN-SYNC commit) — fold it into this change, don't leave it dangling.
2. Scope-authority citation: BETK_PHASES.md cites "MVP Scope §8"; core rule + OD-7 use §6. Verify which section BETK_MVP_SCOPE.md actually uses for the OD/freeze block; make all references consistent with reality.
3. Stale counts: current-total statements only — RLS policies "34" → 39 (36 permissive + 3 restrictive, post-T01-FIX); indexes "34 estimated" → 41 non-constraint live (ERD §4 note: over-provisioned, none missing). Do NOT rewrite historical journal/T14 entries — correct at their date; fix only statements presented as current.
4. Empty governance folders: add one-line README pointers — docs/11-decisions/ → "ADRs live in docs/02-architecture/ADR.md"; docs/05-features/ → "feature specs live in the PRD/UI Spec; folder reserved". Do NOT move ADR.md.
5. PHASE-4 FINDINGS (from DESIGN-SYNC, report → now applied): append "bilingual AR/EN + light/dark (OD-7)" per the findings list at — docs/01-product/BETK_PRD.md L6, L10, L14, L97 ("Arabic-first RTL" framings); docs/10-ai-development/phase-packs/PHASE_DS_DESIGN_SYSTEM.md L19 ("All UI is RTL and Arabic by default" → add EN-LTR + light/dark; also add a note that its cited tokens/radius predate the DESIGN-SYNC brief rewrite and are superseded by the brief); docs/10-ai-development/BETK_MASTER_EXECUTION_PROMPT.md L4 ("Arabic-first (RTL) marketplace" → add bilingual + theme). MVP_SCOPE L7 vision string: leave as-is (§6 amends it — per the findings, minor/no-edit).
6. PAGE-COUNT RECONCILIATION (DESIGN-SYNC matrix flag): the docs disagree — "56" headline vs 60 headings / 59 standalone pages vs §4 summing 61. Count the REAL BETK_UI_SPEC.md §3 inventory (standalone routed pages; state your counting rule — e.g. tabs/sections within a page don't count), then fix the headline number everywhere it appears as a current total (UI_SPEC, SESSION_CONTEXT "Docs baseline", any other "56 pages" citations) to the verified count. Screen inventory itself FROZEN — count it, never change it. Ensure the acceptance matrix rows match the verified inventory 1:1.
7. If R1 has not yet run, ALSO apply R1 step 5's SESSION_CONTEXT correction text and note it; if R1 ran, skip.
8. Adopt the consolidated issue register: copy the REG-01..REG-22 table from BETK_REPAIR_PLAN.md into SESSION_CONTEXT (replacing the scattered open-issue #n / T14-findings namespaces as the plan specifies), marking rows closed by completed R-tasks at time of running.
9. Update SESSION_CONTEXT (close REG-04/05/06/07 + this batch) + append journal. Run lint/typecheck (middleware comment edit must not disturb anything). Commit + push.

Done when: exactly one ADR registry with ADR-011; zero "ADR-002 (i18n)" references; tracker line committed; scope citations consistent; counts accurate; pointer READMEs present; Phase-4 findings applied; page count verified + matrix aligned; REG register adopted; CI-relevant checks clean.
```

**Review checklist:** ADR-011 (not -003) · append-only ADR.md · no historical entries rewritten · middleware edit is comment-only.

---

## R5 — PROMOTE RLS-SMOKE ON MIGRATION PRs (Opus, CI gate)

**Why.** RLS is the sole authorization boundary; the policy set just grew to 39; the smoke harness exists and is green — but never runs on the PRs that change policies. Promote it to required exactly where it matters, keep it opt-in elsewhere (cost control).

**Prompt:**
```
Read SESSION_CONTEXT.md, then execute R5 — make rls-smoke required on migration-touching PRs. CI-only change; no test-code changes.

1. In .github/workflows/ci.yml, change the rls-smoke job's condition: in addition to the existing workflow_dispatch + develop-push triggers, run it on pull_request when the diff touches supabase/migrations/** (use a paths-changed detection appropriate to the existing workflow style — e.g. a lightweight changed-files step gating the job, since job-level `paths` filters don't exist). When triggered on a PR, the job is BLOCKING (part of `needs` for nothing downstream is required — instead ensure branch protection can require it; keep it fail-loudly on missing staging secrets, never silent-skip).
2. Preserve current behavior for non-migration PRs (job skipped with an explicit "no migration changes" log line, not a silent absence).
3. Note the residual risk in the job comment: the harness mints/tears down staging auth users; concurrent runs could collide — the existing per-run unique-suffix + sweep design mitigates; concurrency group already cancels in-progress.
4. Update docs/08-deployment/CICD_PIPELINE.md with the new rule; SESSION_CONTEXT + journal entries.

Done when: workflow YAML shows conditional-required rls-smoke on migration-touching PRs; opt-in behavior preserved otherwise; fail-loudly retained; CICD doc updated. Do not run the job as part of this task; the next migration PR proves it.
```

**Review checklist:** paths detection correct · fail-loudly kept · skip is logged, not silent · docs updated.

---

## Consolidated issue register (single namespace)

> This table supersedes the three scattered namespaces (open-issue #n / BL names / T14 findings). Copy it into SESSION_CONTEXT at the next update if adopted.

| REG | Item | Old ref | Owner / gate | Status after this pack |
|---|---|---|---|---|
| REG-01 | Migration ledger mismatch (local `20260701021800` vs remote `20260630232657`) | audit gap #8 | **R1** | Closed by R1 |
| REG-02 | `decrement_stock_on_confirm` owed to source + live | #4 | **R2** | Closed by R2 |
| REG-03 | pg_cron Cairo/UTC offset (3 daily jobs) | T14 finding | **R3** | Closed by R3 |
| REG-04 | ADR numbering collision (OD-7 "ADR-002" → **ADR-011**) | OD-7 carry | **R4** | Closed by R4 |
| REG-05 | MVP_SCOPE §6 vs §8 citation inconsistency | audit gap #12 | **R4** | Closed by R4 |
| REG-06 | Stale current-counts in docs (policies 34→39, indexes 34→41) | T14 corrections | **R4** | Closed by R4 |
| REG-07 | Empty `docs/05-features/`, `docs/11-decisions/` | audit gaps #9–10 | **R4** | Closed by R4 |
| REG-08 | rls-smoke opt-in on migration PRs | standing rec | **R5** | Closed by R5 |
| REG-09 | `orders` permissive ownership INSERT policy missing | #1 | Phase 07 checkout task | Open (owned) |
| REG-10 | `seller_profiles` permissive ownership INSERT policy missing | #1 | Phase 04 become-seller task | Open (owned) |
| REG-11 | Live Google OAuth consent E2E (real PKCE round-trip) | #13 | Pre-launch Playwright gate | Open (owned) |
| REG-12 | Handset SMS delivery + sender `3MS EGY` on device | SMS section | **HARD pre-launch gate** | Open (owned) |
| REG-13 | NTRA/operator sender-ID registration | memory item | **External clock — start NOW**, don't wait for pre-launch | Open — needs a calendar owner |
| REG-14 | `StoreDeliveryOptions.modes` mirrors store-side enum | #5 | Verify before Phase 04/07 consume | Open (owned) |
| REG-15 | `title_en` required-in-form decision (Zod layer; DB stays nullable) | OD-7 note | Phase 04 listing form task | Open (owned) |
| REG-16 | BL-01 locale-preserving Server-Action redirects | OD-7 carry | Optional cleanup, any Sonnet window | Open (optional) |
| REG-17 | BL-02 `errorAr` → `errorMessage` rename | OD-7 carry | Optional cleanup (pairs with REG-16) | Open (optional) |
| REG-18 | StatusBadge `flag`-domain labels (partial map) | OD-7 carry | **Claude Design decision** before any admin moderation badge renders | Open (owned) |
| REG-19 | `betk.users` writes stay service-role (no self-UPDATE policy until grant re-scoped) | #10 | Standing pattern — revisit only deliberately | Standing |
| REG-20 | `NODE_ENV`-conditional env requiredness | deploy TODO | Phase 14 / first prod deploy | Open (owned) |
| REG-21 | GitHub Actions version bumps (Node 20 deprecations) | CI housekeeping | Any convenient window | Open (housekeeping) |
| REG-22 | Live OAuth + config.toml vs dashboard drift is ops-owned | staging-config note | Ops awareness item | Standing |

---

## Guardrails for the in-flight design work (logo + UI spec + design brief)

You're editing `BETK_DESIGN_BRIEF.md` and UI specs while phases are paused — three rules keep this clean:

1. **Ownership flow for visual changes:** brief/token changes → **Claude Design** regenerates or refines the affected `components/shared` / `components/ui` pieces → a Cursor **land task** integrates them mechanically (diff-verified: `components/ui` untouched unless the hand-off says so; token patch additive; no feature-folder restyles). Cursor never interprets the new brief directly.
2. **UI Spec edits have two classes.** §1 (tokens/typography/visual system) edits are design-owned and free. §3 (the 56 pages: routes, gates, components, data) is **frozen scope** — adding/removing/merging pages or changing gates requires an OD amendment, exactly like OD-7. If the redesign wants a structural page change, write the OD first.
3. **The logo lands as an asset + a small DS task** (favicon/OG/nav slot per the brief), not ad-hoc edits inside layouts. If the logo implies token changes (new brand color), that's a brief update → rule 1 flow.

When the design pass ends, hand the updated brief to Claude Design with a short "delta prompt" (what changed vs the previous brief) — the review chat can generate that prompt when you're ready.

---

## Re-entry sequence when you're back

1. Run **R1** (blocker). Paste output → verdict.
2. Run **R2 → R3** (order interchangeable) → verdicts.
3. Run **R4**, **R5** anytime → verdicts.
4. Kick off **REG-13** (NTRA registration) in parallel — it's paperwork, not code.
5. If the design pass produced a component delta: Claude Design delta prompt → land task → verdict.
6. Then **Phase 03 T02 — Homepage** on a clean, aligned `main`.

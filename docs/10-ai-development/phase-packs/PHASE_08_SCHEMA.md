# PHASE 08 — Schema delta

> Scope authority: `BETK_PHASES.md` Phase 08, and `docs/03-database/BETK_V2_SCHEMA_DELTA_PLAN.md` (approved content `3bec2ea`, §10 signed `ac392d8`).
> Goal: apply that plan on staging. N27 forward-migration, ADR-020..025 database objects, and every v2 RLS policy that is not already live and matching. No page.
> Pages: none.
> NOTHING ELSE: `src/` changes only where plan §2.3 and §9 name them (tests and comment barrels, in the same branch as M6). `src/lib/supabase/types.ts` changes only by CI (REG-32). Onboarding `src/` stays untouched (D3, plan §8.2.4).

Branch this pack was written on: `v2-p08-t00`, cut from `origin/main` `a6c90450ef01ed5714a443ca007beed71f43664f` (PR #67 merge).

## 0. Header

The scope sentence above is the whole header. Phase 08 does not add a route. It does not restyle the kit. It does not change the onboarding caller.

**Carried note (CF-10).** `docs/00-design/BETK_DESIGN_BRIEF.md` was not edited. It is Claude Design-owned. `docs/00-design/CD_DELTA_6_HANDOFF.md` §0 already overrides its counts. The stale counts in the brief are a note for the next sanctioned addendum, not a Phase 08 edit.

## 1. Entry checklist

Measured 2026-09-26 on namespace `project-0-BETK-supabase-betk`. Read-only. No migration was applied.

### 1a — REG-77 PASS

All eight names from `.github/workflows/ci.yml` are required. Branch protection supplies each name. Rulesets supply none. Branch rules supply none.

`gh api repos/Jovo-Jovi/betk/branches/main/protection --jq '.required_status_checks.contexts'`

```text
["RLS smoke (staging)","Install","Lint","Typecheck","Vitest (unit)","Guards","Types drift","Build"]
```

`gh api repos/Jovo-Jovi/betk/rulesets`

```text
[]
```

`gh api repos/Jovo-Jovi/betk/rules/branches/main`

```text
[]
```

Each context is `app_id` 15368. REG-77 is CLOSED in the register with this evidence.

### 1b — other §0 rows

| Row | Result | Cite |
|---|---|---|
| B7 merged | Yes. `c88465a` is `Merge pull request #63` and is an ancestor of `a6c9045`. | `BETK_PHASES.md` §0; `git log origin/main` |
| Stage C approved | Yes. Plan §10 says Stage C is APPROVED. Content `3bec2ea`. Approval commit `ac392d8`. Merge `f41e985` is an ancestor of this branch (`merge-base --is-ancestor` exit 0). | Plan §10 |
| Guard set scheduled | Yes. REG-47, REG-67, REG-74, and REG-92 each have one home in §4.e. They are not built in T00. | `BETK_PHASES.md` §0 and §4.e |
| REG-92 is not a typecheck | Acknowledged. The guard is a lint or a runtime test. It is not Typecheck and it is not Types drift. | `BETK_PHASES.md` §0 evidence cell; §4.e REG-92 row; `PRECEDENTS.md` “A column-grant guard is not a typecheck” |

### 1c — ledger 1:1

Local `supabase/migrations` file count **31**. MCP `list_migrations` count **31**. Pairwise versions match. Last on both sides: version `20260723140552`, name `order_payment_write_layer_reg49`. Nothing only-local. Nothing only-remote.

The first 13 remote `name` values still carry `0001_`…`0013_` prefixes. Local filenames omit those prefixes. That drift is the standing fact from Stage A-RESUME (`SESSION_CONTEXT.md` ledger bullet). Version identity is the 1:1 check (REG-24 as practiced; Phase 08 exit check 1). PASS.

### 1d — advisors vs plan §0.9

Security, `get_advisors` `type=security`, `observed_at` **2026-09-26T10:21:09.168Z** on the findings that carry it (the leaked-password finding is in the same payload and has no `observed_at`, same shape as plan §0.9):

| lint | count | plan §0.9 |
|---|---|---|
| `rls_enabled_no_policy` | 8 | 8 |
| `function_search_path_mutable` | 6 | 6 |
| `extension_in_public` | 2 | 2 |
| `anon_security_definer_function_executable` | 2 | 2 |
| `authenticated_security_definer_function_executable` | 2 | 2 |
| `auth_leaked_password_protection` | 1 | 1 |

The eight rls-no-policy tables are `dispute_evidence`, `dispute_messages`, `flagged_content`, `otp_tokens`, `restock_alerts`, `seller_strikes`, `sessions`, `whatsapp_templates`.

Performance, `observed_at` **2026-09-26T10:21:10.030Z**: unindexed FK 37, auth RLS initplan 43, unused index 30, multiple permissive policies 32. Same four counts as plan §0.9 (`2026-09-22T21:56:46.316Z`). No T01 flag.

### Gates still pending

- **Backup.** T03 STEP 0. A human pastes a restorable point into `SESSION_CONTEXT.md` before M1. T00 did not check the plan tier (plan §7.1).
- **Rehearsal cost approval.** The human approves cost when T02 asks. T00 did not create a branch.
- **3f.** Decided 2026-09-26. Rehearse M4–M6 only (plan §7.2). M7–M8 are not run on the rehearsal branch.
- **Rehearsal execution.** Option B (2026-09-26). The human creates the rehearsal branch in the dashboard and runs the SQL. The agent prepares the scripts and checks the pasted results. T02 has not written the scripts. Cost is the usage when the human creates that branch.

### MCP calls in T00

All read-only: `list_migrations`, `get_advisors` security, `get_advisors` performance, `list_branches`, `search_docs` (branching, usage, MCP tool catalog). No `create_branch`, `delete_branch`, `apply_migration`, `get_cost`, or `confirm_cost`.

## 2. Binding rules

- **Per-migration procedure.** Plan §6 header line: MCP `apply_migration`, then rename the local file to the returned version, then ledger 1:1, then backfill `BETK_DATABASE_SCHEMA.sql`, then advisors before and after against §0.9. Typegen is the CI job (REG-32), not a hand edit.
- **SQL source.** The plan’s approved DRAFT SQL, referenced by section. This pack does not contain that SQL.
- **Preconditions.** Each migration re-measures its plan §6 Preconditions. STOP on any mismatch. Do not apply.
- **M2 fail-closed ordering.** Plan §6 “Fail-closed intermediates”. Inside the one M2 transaction, per table: create the table, then enable row level security, then create the policies, then any grant beyond the default ACL. Do not commit a new table with RLS off. `pg_default_acl` on `betk` grants `anon` and `authenticated` table DML at create time (plan §6).
- **Point of no return M5.** Plan §7.3 and the M5 bullet in §6. The five history inserts, and `SET NOT NULL` on `master_order_id`, are forward-fix only. The M5 prompt stops before the first history insert until the human types `GO M5`.
- **No `select *` and no `RETURNING *` on `seller_orders` after M7.** Plan §9 and §8.1. Generated `Row` types still list the hidden columns (REG-92). The grant makes the star form raise `42501`.
- **RLS tests change with M6.** Plan §2.3 and §9. `tests/integration/order.rls.test.ts`, `orders.stockDecrement.test.ts`, `rls.smoke.test.ts`, `discovery.listing.test.ts`, and `discovery.queries.test.ts` change in the same branch as M6. Comment barrels named in §2.3 change in that same branch. They do not execute.
- **Advisors.** Before and after each migration, compare with that migration’s plan §6 expected delta and with §0.9. An unexplained new finding is a STOP.
- **Types-drift window.** After M1 lands on staging, CI regenerates types from the live schema and diffs them against committed `types.ts`. `main` stays drifted until this phase’s PR merges the CI diff (REG-32: apply that diff verbatim; do not hand-edit `types.ts`). Types drift is now a required check (REG-77), so any other open PR fails that check for the same reason. **Recommendation: no other PR merges while Phase 08 migrations are being applied.** Apply each migration from `feature/phase-08-schema` only.

## 3. Register plan

No reservations. Numbers are taken at mint time. P08-T00 re-read the header (REG-01..REG-92, next free REG-93, no REG-93 row) and then minted.

| REG | What this phase does | Cite |
|---|---|---|
| REG-76 | N27. T05 applies M5 and M6. Not closed until exit evidence holds. | Register row; plan §9 |
| REG-24 | Ledger procedure on every apply. Entry 1c passed on versions. | `PRECEDENTS.md`; plan §6 header |
| REG-47 | Guard E. T07. Not an exit blocker of a feature task. | `BETK_PHASES.md` §4.e; §0 |
| REG-67 | Guard F. T07. Physical `page.tsx` count against 79. Phase 08 adds no page. | §4.e; plan §9 |
| REG-74 | Guard G. T07. Suite-start residue detector. The seven ids stay the expected undeletable set. | §4.e; plan §9 |
| REG-92 | Lint or runtime test with the M7 grant, on this same branch, in T07. Not a typecheck. | §4.e; plan §9 |
| REG-77 | CLOSED in T00. Eight required checks. | §1a |
| REG-93..REG-99 | Minted in T00 for empty keys with no owning REG. §5. | Plan §8.2.5 |

Next free after this mint: **REG-100**. Next free OD: **OD-22**. Next free ADR: **ADR-026**.

`price_band_min_egp` and `price_band_max_egp` were not minted. REG-62’s text already covers “price band set”.

## 4. Rehearsal mechanism and backup gate

### 4.1 What the docs and the tool catalog say

**Preview build order is migrate, then seed.** The branching guide’s deployment steps are clone, pull, health, configure, migrate, seed, deploy. Migrate applies pending migrations. Seed runs after migrate. New branches do not copy data from the main project. Cite: [Branching](https://supabase.com/docs/guides/deployment/branching) (“How branching works”, “Deploying to production”); [GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration) (Migrations, Seeding).

**A later push applies only new migrations. It does not re-seed.** “The preview branch has a record of which migrations have been applied, and only applies new migrations for each commit.” Seed runs once, when the preview branch is created. Recreate the branch to seed again. Cite: [Working with branches](https://supabase.com/docs/guides/deployment/branching/working-with-branches) (“Migration and seeding behavior”, “Seeding behavior”).

**MCP `create_branch` applies the main project’s remote migration history, not git.** Tool description: it applies all migrations from the main project onto a fresh branch database, and production data does not carry over. The branch returns its own project ref. The branching guide’s dashboard path pulls migrations from the main project. GitHub integration is the path that clones git. Cite: `create_branch` tool description in namespace `project-0-BETK-supabase-betk`; [Branching](https://supabase.com/docs/guides/deployment/branching) (Pull step, “Branching via Dashboard”).

**Cost.** There is no fixed branch fee. Usage is compute, disk, egress, and storage, and it is not covered by the spend cap. Micro compute is listed from $0.01344 per hour. Cite: [Manage Branching usage](https://supabase.com/docs/guides/platform/manage-your-usage/branching). `create_branch` requires a cost confirmation: `confirm_cost_id` for a client that cannot elicit a form, or an inline form for a client that can. Cite: `create_branch` input schema. `get_cost` and `confirm_cost` are account tools and are disabled when the server is project-scoped. Cite: [Supabase MCP Server](https://supabase.com/docs/guides/ai-tools/mcp) (“Account management”, `project_ref`). This catalog does not list `get_cost` or `confirm_cost`.

**Delete.** `delete_branch` takes `branch_id`. Docs: delete the preview branch; data on it is lost; a recreated branch re-runs migrations and reseeds. Cite: `delete_branch` schema; [Working with branches](https://supabase.com/docs/guides/deployment/branching/working-with-branches) (“Rolling back migrations”); [Troubleshooting](https://supabase.com/docs/guides/deployment/branching/troubleshooting) (“Data persistence”).

### 4.2 Repo seed and branches

`supabase/config.toml` `[db.seed]` is `enabled = true` and `sql_paths = ["./seed.sql"]`. There is no `[remotes]` block and no other branching block. `supabase/seed.sql` is not in the repo. The only `*seed*` SQL file is the ledger migration `20260622091700_categories_seed.sql`, which is not a seed file. A content search of `*seed*` files found no `orders` and no `betk.orders`. **FLAG:** there is no seed-file rename hazard for M6, because there is no seed file. **FLAG:** the preview seed step looks for `./supabase/seed.sql`. That file is absent, so the Phase 08 preview run may fail or no-op its seed step. Do not add that file in this phase to smuggle rehearsal SQL. Preview and the ledger both read `supabase/migrations/`.

`list_branches` returned one branch. Name `main`. Default. Status `FUNCTIONS_DEPLOYED`. `persistent` false. `with_data` false. Preview status `ACTIVE_HEALTHY`. Its project ref is the staging ref and is not written in this section.

### 4.3 GitHub “Supabase Preview”

Measured on the PR head SHAs: #65 `3ebf66b`, #66 `2b6b2bd`, #67 `3860d94`. Check name `Supabase Preview`, conclusion `skipped`, on all three. Those PRs changed docs only.

Docs: the integration can limit itself to Supabase file changes, and it runs the migrations in `supabase/migrations`, then seeds once from `seed.sql`. Cite: [GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration) (“Supabase changes only”, Migrations, Seeding).

**Correction of the expected sentence.** On the Phase 08 PR, once migration files exist, the check should run and replay migrations in order, including M1–M8, then run the seed step once. That seed step is after the full set, not between M3 and M4, and `seed.sql` is absent. The check is a DDL-parse proof of the git migration chain. It is not the §7.2 rehearsal. A later commit on the same preview applies only migrations the branch has not already recorded, and it does not re-seed.

### 4.4 Pinned sequence — and why execution is BLOCKED

Candidate sequence, which the docs do not contradict:

1. Human approves cost (`create_branch` inline form, or `confirm_cost_id` when that tool exists).
2. `create_branch` → a data-less database at the main project’s current migration history.
3. On the branch ref only: apply M1–M3 from the plan’s DRAFT SQL (plan §6 M1, M2, M3); seed the §7.2 shape with `execute_sql` (not a file under `supabase/`); apply M4–M6 (plan §6 M4, M5, M6); assert plan §4.8, §4.9, and every §7.2 bullet against that seed.
4. `delete_branch`.

**This catalog cannot perform step 3.** `execute_sql` and `apply_migration` take a query and, for apply, a name. They take no project ref. The server is project-scoped, so those calls hit staging. `create_branch` says to use the returned ref, and the sibling tools do not accept it. Calling them for rehearsal SQL would target staging. That is forbidden.

**Rehearsal task status.** The human decided on 2026-09-26 (verbatim under the options table): option B, and M4–M6 only. The agent still has no branch-ref argument, so rehearsal SQL is not applied from this catalog. T02 prepares the scripts. The human creates the dashboard branch and runs the SQL. The agent checks the pasted results.

Options:

| Option | What it does | Trade-off |
|---|---|---|
| A. Wait for a tool argument | Same sequence as the candidate, every apply and seed call passing `BRANCH_PROJECT_REF` | Matches §7.2. Not executable on today’s schemas. |
| B. Human runs the SQL on a dashboard branch | Human creates the branch (cost is the usage in §4.1), runs the same M1–M3, seed, M4–M6, asserts, then deletes | Matches §7.2. The agent does not hold a connection to that ref. Evidence is pasted back. **Recommendation.** |
| C. Treat GitHub Preview as the rehearsal | Preview replays git migrations then seeds once | Docs contradict the seed-between-M3-and-M4 shape. This is the DDL-parse proof only. Reject as the rehearsal. |

**Human decision (2026-09-26), verbatim:**

§4.4 = option B: the human creates the rehearsal branch in the dashboard and runs the SQL; the agent prepares the scripts and checks the pasted results.
3f = rehearse M4–M6 only (plan §7.2). M7–M8 are not run on the rehearsal branch.

**Recommendation: B**, until A exists. Do not use C as the rehearsal. The decision above is that recommendation, now chosen.

**Where the rehearsal SQL is staged.** Committed at `docs/03-database/rehearsal/n27-shape.sql`, written by T02, not by T00. Not under `supabase/migrations/` and not on `[db.seed] sql_paths`. The ledger and the preview runner do not apply that path. A never-committed script would not be reviewable. T00 does not write the file, because this pack must not contain the SQL.

**Project id.** Every rehearsal apply, seed, and assert uses `BRANCH_PROJECT_REF`, the ref returned for the rehearsal branch, held as a variable. No rehearsal call targets the staging ref. The scoped server’s ref is not written here and is not that variable.

**Evidence the rehearsal pastes, when it is unblocked.**

- The cost confirmation (form acceptance or confirmation id). No secret.
- Branch id, `BRANCH_PROJECT_REF`, and a healthy status from `list_branches`.
- Migration versions on that ref after M3 and after M6.
- One result per §7.2 bullet, plus the §4.8 and §4.9 checks, against the seed.
- `delete_branch` result, then `list_branches` showing the rehearsal branch gone.

**3f recommendation.** Rehearse M4–M6 only, which is plan §7.2. Do not also run M7–M8 on the rehearsal branch. M7–M8 have no §7.2 assertions. Their DDL-parse proof is the GitHub Preview check on the phase PR (§4.3). The human can override by typing that M7–M8 should run on the branch with no new assertions. Until that sentence is typed, T02 stops at M6.

### 4.5 Backup gate

Plan §7.1. The M1 task’s STEP 0 requires the human’s pasted restorable point (dashboard backup or PITR timestamp) recorded in `SESSION_CONTEXT.md`. No restorable point, no M1. T00 does not check the plan tier and does not record a timestamp.

## 5. `admin_settings` pin owners

Plan M3 and §8.2.5 list nine empty keys. Measured: those nine, no others. Not a FLAG.

Staging rule for every row: a labelled placeholder may be written by the named later task; production needs the pinned value. M3 inserts empty text. M3 does not write the placeholder. The named task is that consumer phase’s T00. The placeholder text must contain `STAGING-PLACEHOLDER` so it cannot be mistaken for a production pin.

| Key | Consumer (§8.2.5) | Owning REG | Pin owner | Before | Staging rule |
|---|---|---|---|---|---|
| `price_band_min_egp` | Phase 09 publish (R-L21, AC-CAT-3) and Phase 10 quote send (R-Q07) | REG-62 (“price band set”; register B7 clause; plan §8.2.5) | Human (product pin) | Phase 09 | Phase 09 T00 may write the labelled placeholder |
| `price_band_max_egp` | Same pair | REG-62, same cite | Human (product pin) | Phase 09 | Phase 09 T00 may write the labelled placeholder |
| `payment_window_minutes` | `checkout_from_cart` writes `payment_deadline` (R-O21). Phase 11 sweeper | REG-93 (minted here; no earlier row) | Human (product pin) | Phase 11 | Phase 11 T00 may write the labelled placeholder |
| `return_window_hours` | Phase 15 return request (R-M07). Not `return_hold_hours` | REG-94 (REG-86 is the other key) | Human (product pin) | Phase 15 | Phase 15 T00 may write the labelled placeholder |
| `food_requirements` | No parser. Food publish stays Phase 09 (R-S10) | REG-95 | Human (product pin) | Phase 09 | Phase 09 T00 may write the labelled placeholder |
| `agreement_buyer_terms_version` | Phase 09 signup (AC-AGR-1, R-G01) | REG-96 (REG-75 and REG-88 do not pin this string) | Human (product pin) | Phase 09 | Phase 09 T00 may write the labelled placeholder |
| `agreement_seller_agreement_version` | Phase 09 onboarding submit (AC-AGR-3, R-G04) | REG-97 | Human (product pin) | Phase 09 | Phase 09 T00 may write the labelled placeholder |
| `agreement_return_policy_version` | Phase 11 checkout, only if REG-88 includes it | REG-98 (REG-88 is set membership) | Human (product pin) | Phase 11 | Phase 11 T00 may write the labelled placeholder |
| `agreement_privacy_version` | Same as the return-policy key | REG-99 | Human (product pin) | Phase 11 | Phase 11 T00 may write the labelled placeholder |

## 6. Task table

Model for every row is Grok 4.7. T01 cuts `feature/phase-08-schema` from `main` after this pack’s PR merges. Later tasks stay on it.

A source row maps to exactly one T below. Where that row also names an earlier migration, the earlier task already applied it. The owner task re-verifies it and does not apply it again.

| T | Work | Migrations | Model | Thinking | Branch |
|---|---|---|---|---|---|
| T00 | This pack | none | Grok 4.7 | High | `v2-p08-t00` |
| T01 | Cut the feature branch. Read-first re-measure of plan §0 | none | Grok 4.7 | Max | creates `feature/phase-08-schema` |
| T02 | Rehearsal. BLOCKED until the human picks §4.4 A or B | none on staging | Grok 4.7 | Max | `feature/phase-08-schema` |
| T03 | M1, M2, M3 | M1 M2 M3 | Grok 4.7 | Max | `feature/phase-08-schema` |
| T04 | M4, CF-1 | M4 | Grok 4.7 | Max | `feature/phase-08-schema` |
| T05 | M5 (GO M5) and M6, including §2.3 test and comment edits | M5 M6 | Grok 4.7 | Max | `feature/phase-08-schema` |
| T06 | M7 and M8 | M7 M8 | Grok 4.7 | Max | `feature/phase-08-schema` |
| T07 | REG-92 and guards E, F, G | none | Grok 4.7 | High | `feature/phase-08-schema` |
| T08 | Exit evidence, nine checks | none | Grok 4.7 | Max | `feature/phase-08-schema` |

### Mapping

| Source row | T |
|---|---|
| `BETK_PHASES.md` Phase 08: T00 write the pack | T00 |
| Plan §9: T00 pack | T00 |
| Phase 08: Read-first | T01 |
| Plan §9: Read-first re-measure | T01 |
| Plan §9: M1–M3 additive | T03 |
| Phase 08: CF-1 | T04 |
| Plan §9: CF-1 detach | T04 |
| Phase 08: N27 / REG-76 | T05 |
| Plan §9: N27 including D1 (M5, M6) | T05 |
| Phase 08: CF-2 | T06 |
| Plan §9: CF-2 (M6 creates and revokes; M7 grants) | T06 |
| Phase 08: CF-3 | T06 |
| Plan §9: CF-3 | T06 |
| Phase 08: CF-4 | T06 |
| Plan §9: CF-4 | T06 |
| Phase 08: ADR-020..025 objects otherwise named | T06 |
| Plan §9: ADR-020 grant and the rest of that row | T06 |
| Phase 08: RLS for the eight new tables and the §8 policies | T06 |
| Plan §9: RLS (M2, M7) | T06 |
| Phase 08: REG-47, REG-67, REG-74, and REG-92 | T07 |
| Plan §9: REG-92 | T07 |
| Plan §9: REG-47, REG-67, REG-74 | T07 |
| Phase 08: Exit evidence | T08 |
| Plan §9: Exit evidence | T08 |

T02 is the rehearsal. It is not a Phase 08 task row and not a §9 row. It sits before T03, which is the first staging apply.

CF-2’s create-and-revoke is M6, applied in T05. T06 does not create the function again. T06 applies M7, whose last statement is the GRANT, and re-reads the function body. The row’s single owner is T06.

The RLS row’s new-table policies are M2, applied in T03 under the §9 M1–M3 row. T06 applies the M7 policies and re-verifies the eight new tables. The RLS row’s single owner is T06.

## 7. Canonical prompts

Shared close for every prompt after T00:

```text
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
git add only the file list in this prompt.
git push -u origin HEAD:feature/phase-08-schema
```

Update `SESSION_CONTEXT.md` and `docs/12-changelog/DEVELOPMENT_JOURNAL.md` in the same commit. Done-when is the prompt’s last bullets before STEP Z.

### T00

```text
Already executed on 2026-09-26. This file is the result. Do not re-run T00.
MODEL: Grok 4.7 · THINKING: High
The human prompt was Phase 08 T00 on branch v2-p08-t00.
```

### T01

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 08 T01 from docs/10-ai-development/phase-packs/PHASE_08_SCHEMA.md.
Branch: cut feature/phase-08-schema from origin/main after the T00 PR is on main. State the SHA.

Read first: plan §0 (tables, enums, policies, triggers, grants, cron, ledger, advisors) against live introspection. Read BETK_ERD.md §8 beside pg_policies. Read the four triggers ADR-025 names.

Steps:
1. Re-measure every plan §0 figure this task’s later migrations will depend on. Paste the method and the value.
2. STOP if the ledger is not version-1:1, if orders are not 7, if payments are not 0, if order_items are not 0, or if the history md5 set in plan §3 differs.
3. Do not apply a migration. Do not create a branch database.

Evidence to paste: the §0 re-measure, the ledger pair, advisor counts with observed_at.
Done-when: the re-measure is in SESSION_CONTEXT and no migration file was added.
STEP Z file list: SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_08_SCHEMA.md.
Commit message: docs(p08-t01): read-first re-measure before any Phase 08 apply
```

### T02

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 08 T02 from docs/10-ai-development/phase-packs/PHASE_08_SCHEMA.md.
Branch: feature/phase-08-schema (already cut by T01).

This task is BLOCKED until the human picks §4.4 option A or B. Do not call create_branch, apply_migration, or execute_sql before that sentence. Do not target the staging ref. BRANCH_PROJECT_REF is a variable from the rehearsal branch. It is never the scoped server’s ref.

If the human has not answered 3f, STOP and ask. Recommendation already recorded: M4–M6 only.

Steps, after the human picks A or B and approves cost:
1. Record the cost confirmation.
2. Create the data-less branch at the main project’s current migration history.
3. On BRANCH_PROJECT_REF only, apply plan §6 M1, then M2 (fail-closed order), then M3. SQL is the plan’s DRAFT for those sections. Do not paste it into the pack.
4. Write docs/03-database/rehearsal/n27-shape.sql with the §7.2 shape and apply that file with execute_sql on BRANCH_PROJECT_REF only. The file stays outside supabase/.
5. Apply plan §6 M4, then M5, then M6 on BRANCH_PROJECT_REF. Assert plan §4.8, §4.9, and every §7.2 bullet against the seed.
6. STOP at M6 unless the human typed that M7–M8 should run on the branch with no new assertions.
7. delete_branch. Paste list_branches showing the rehearsal branch gone.

STOP if any call would omit BRANCH_PROJECT_REF. STOP if a precondition in plan §6 does not match the branch.
Evidence: §4.4 evidence list.
Done-when: the branch is deleted and the assertions are pasted. Staging has no new migration.
STEP Z file list: docs/03-database/rehearsal/n27-shape.sql, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md.
Commit message: docs(p08-t02): record the N27 rehearsal evidence
```

### T03

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 08 T03 from docs/10-ai-development/phase-packs/PHASE_08_SCHEMA.md.
Branch: feature/phase-08-schema.

STEP 0. Read SESSION_CONTEXT for the human’s pasted restorable point (dashboard backup or PITR timestamp). If it is absent, STOP. Do not apply M1. Do not check the plan tier yourself.

Steps, in order, each as its own migration, SQL from the plan section named, never retyped into this pack:
1. Re-measure M1 preconditions (plan §6 M1, §0 enum list). STOP on mismatch. Advisors before. Apply M1. Rename the local file to the returned version. Ledger 1:1. Backfill BETK_DATABASE_SCHEMA.sql. Advisors after. Delta: none (plan §6 M1).
2. Re-measure M2 preconditions (M1 committed, btree_gist absent). STOP on mismatch. Apply M2 with the fail-closed statement order in §2 of this pack. Verify plan §6 M2. Advisor delta: new tables absent from rls-no-policy; unindexed-FK INFO may rise; initplan does not rise.
3. Re-measure M3 preconditions (M2; active listing count). STOP on mismatch. Apply M3. The nine keys in §5 of this pack are inserted empty. Do not write a placeholder. Verify plan §6 M3.

Evidence: version returned for each apply, ledger pair, advisor before/after, the M2 policy presence check, the nine empty keys.
Done-when: local and remote include M1, M2, and M3, and history md5 is unchanged.
STEP Z file list: the three renamed migration files, BETK_DATABASE_SCHEMA.sql, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md.
Commit message: feat(p08-t03): apply M1-M3 additive schema delta
```

### T04

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 08 T04 from docs/10-ai-development/phase-packs/PHASE_08_SCHEMA.md.
Branch: feature/phase-08-schema.

Steps:
1. Re-measure M4 preconditions (plan §6 M4: trigger exists, no backfill has set confirmed). STOP on mismatch.
2. Advisors before. Apply M4 from the plan’s DRAFT. Drop trg_decrement_stock_on_confirm only.
3. Verify plan §6 M4. stock_qty unchanged. Advisors after. Delta: none.

Evidence: pg_trigger absence, stock_qty, ledger pair, advisor counts.
Done-when: the trigger is gone and no row was moved to confirmed.
STEP Z file list: the renamed M4 file, BETK_DATABASE_SCHEMA.sql, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md.
Commit message: feat(p08-t04): detach stock-on-confirm before N27
```

### T05

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 08 T05 from docs/10-ai-development/phase-packs/PHASE_08_SCHEMA.md.
Branch: feature/phase-08-schema.

M5 STOP. Re-measure plan §6 M5 preconditions and paste them: M4 applied, history md5 equals plan §3, payments count 0, items count 0, the five ids still have the statuses §4.9 names. Then STOP. Do not run the first history INSERT until the human types GO M5.

After GO M5:
1. Apply M5 from plan §4.3, §4.9, and §6 M5. Disable only trg_enforce_order_transition around the five updates and five inserts. Not DISABLE TRIGGER ALL. Not session_replication_role.
2. Verify §4.8 and §4.9. Original seven md5s unchanged. Exactly five new history rows.
3. Apply M6 from plan §6 M6 and §2. One transaction: rename, rewrite enforce_payment_update, reschedule the cron command, drop create_order_from_inquiry, create checkout_from_cart, revoke EXECUTE from PUBLIC, anon, and authenticated. No GRANT in M6.
4. In this same branch, edit the test files and comment barrels named in plan §2.3. Do not edit onboarding src/. Do not hand-edit types.ts.
5. Verify the M6 checks in plan §6, including that the function body does not select or return the hidden columns and that authenticated has no EXECUTE.

Evidence: the precondition paste, the human’s GO M5, §4.8 and §4.9 results, ledger pair, the §2.3 diff stat.
Done-when: seller_orders exists, orders does not, the retired RPC is gone, EXECUTE is still revoked.
STEP Z file list: the renamed M5 and M6 files, BETK_DATABASE_SCHEMA.sql, the §2.3 test and comment files, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md.
Commit message: feat(p08-t05): N27 masters, rename seller_orders, revoke checkout execute
```

### T06

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 08 T06 from docs/10-ai-development/phase-packs/PHASE_08_SCHEMA.md.
Branch: feature/phase-08-schema.

Do not re-apply M6. Re-read checkout_from_cart and confirm EXECUTE is still revoked and the body does not select or return the hidden columns. That re-read completes the CF-2 row. The GRANT is M7’s last statement.

Steps:
1. Re-measure M7 preconditions (plan §6 M7). STOP on mismatch. Apply M7 from plan §1.5, §1.6, §1.8, and §6 M7. Column list for the SELECT grant comes from information_schema at apply time, minus delivery_fee and total_amount. Last statement: GRANT EXECUTE to authenticated. Not to anon. Not to PUBLIC.
2. Verify plan §6 M7, including zero policies on sessions and otp_tokens, one modlog_admin_insert, and the six formerly zero-policy tables now policed. Re-verify the eight M2 tables still have policies. Advisor delta: rls-no-policy 8 → 2. Initplan does not rise.
3. Re-measure M8 preconditions (plan §6 M8). STOP on mismatch. Apply M8 from plan §1.7 and §6 M8. CF-3 is both write paths. CF-4 drops the inquiry converted-order writer and keeps the column. Do not recreate create_order_from_inquiry.
4. Verify Phase 08 exit items 6, 8, and 9 as far as the functions allow before T08’s full paste.

Evidence: column_privileges, routine_privileges, policy counts, advisor before/after, pg_proc checks named in plan §6 M8.
Done-when: M7 and M8 are on the ledger and authenticated can execute checkout_from_cart.
STEP Z file list: the renamed M7 and M8 files, BETK_DATABASE_SCHEMA.sql, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md.
Commit message: feat(p08-t06): grants, policies, and the M8 functions
```

### T07

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 08 T07 from docs/10-ai-development/phase-packs/PHASE_08_SCHEMA.md.
Branch: feature/phase-08-schema.

No DDL. M7 is already applied.

Steps:
1. REG-92: a lint or a runtime test that is red on select-star and on RETURNING-star against seller_orders, and green on an explicit column list. tsc staying green is not the evidence. Types drift is not the evidence.
2. REG-47 Guard E: no loading.tsx at or above a segment whose page can reach notFound(). Phase 08 adds no page. The guard still lands.
3. REG-67 Guard F: physical page.tsx count against 79. Phase 08 adds no page.tsx.
4. REG-74 Guard G: suite-start residue detector. The seven ids remain the expected undeletable set. Not a license to delete them.

Evidence: the red/green REG-92 run, and the three guard commands green.
Done-when: the four checks are in CI or in the test suite this branch runs, and none is a typecheck.
STEP Z file list: the guard and test files this task adds, .github/workflows/ci.yml only if a guard job is the chosen home, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md.
Commit message: test(p08-t07): REG-92 and guards E F G
```

### T08

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 08 T08 from docs/10-ai-development/phase-packs/PHASE_08_SCHEMA.md.
Branch: feature/phase-08-schema.

Steps: paste evidence for all nine exit checks in §8 of this pack. STOP if any check has no pasted evidence. Do not add a migration to paper over a miss. A miss is a forward-fix task, not a silent edit.

Evidence: the nine pastes.
Done-when: each §8 row is pasted or green, and SESSION_CONTEXT says Phase 08 exit holds.
STEP Z file list: SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, plus any evidence note this task adds under docs/.
Commit message: docs(p08-t08): Phase 08 exit evidence
```

## 8. Exit gate

`BETK_PHASES.md` Phase 08 lists nine checks. Evidence method:

| # | Check | Evidence |
|---|---|---|
| 1 | `list_migrations` local names equal remote versions after the delta | MCP `list_migrations` paired with the local filename versions, including M1–M8. Cite the phase’s exit line. |
| 2 | The 7 history-bearing order ids from `BETK_ERD.md` §4 still exist, each with a `master_orders` parent. History rules and the NO ACTION history FK are unchanged | Query those ids and `pg_rules` / the history FK. Plan §4.8. |
| 3 | `pg_policies` for every new table and every §8 policy Phase 08 adds. `sessions` and `otp_tokens` stay zero policies | `pg_policies` paste. Do not add a policy to match an empty §8 cell. |
| 4 | `column_privileges`: `authenticated` has no SELECT on `seller_orders.delivery_fee` or `total_amount`, and has SELECT on the other columns present in that migration | `information_schema.column_privileges` after M7. |
| 5 | REG-92 red on `select *` / `RETURNING *`, green on an explicit column list. `tsc` on `select *` is not the evidence | T07 run output. |
| 6 | `pg_proc` slice of `checkout_from_cart`: `delivery_fee` and `total_amount` are inserted from locals; the function does not SELECT or RETURN them | `pg_get_functiondef` after M8. Plan §6 M8. |
| 7 | `trg_decrement_stock_on_confirm` is dropped before any backfill UPDATE that sets `confirmed` | T04 evidence, then M5’s status writes are cancels, not confirms. Phase exit line 7. |
| 8 | `pg_trigger` shows the ADR-023 equality trigger on both `store_pickup_addresses` writes and `stores.governorate` updates | Two triggers after M8. Plan §6 M8. |
| 9 | `pg_proc` has no function that writes `inquiries.converted_to_order_id`. The column and its NO ACTION FK still exist | `to_regprocedure` of `set_inquiry_converted_order` is null. Column and FK still present. Plan §6 M8. |

## 9. Results tracker

| Task | Status | Evidence pointer |
|---|---|---|
| T00 | written 2026-09-26 | this file; REG-77 closed; REG-93..REG-99 minted |
| T01 | done 2026-09-26 | `SESSION_CONTEXT.md` §0 re-measure; branch `feature/phase-08-schema` at `40f5b9c`; no migration file |
| T02 | option B and 3f chosen 2026-09-26; scripts not written | §4.4 human decision |
| T03 | | |
| T04 | | |
| T05 | | |
| T06 | | |
| T07 | | |
| T08 | | |

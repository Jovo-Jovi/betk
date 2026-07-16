# CICD_PIPELINE.md
> GitHub Actions gates. Block merges that fail.

Pipeline (on PR to `develop`/`main`): `install → lint (eslint) → typecheck (tsc --strict) → unit+integration tests → supabase types drift check → build`. A merge is blocked if any stage fails.

- **Types drift check:** run `supabase gen types` and `git diff --exit-code src/lib/supabase/types.ts`; fail if the committed types are stale (ERD §8).
- **Zod coverage check:** custom step asserts every file in `features/*/actions` and `app/api/*` imports a Zod schema (security gate).
- **E2E (critical flows):** Playwright on `develop` merges and pre-prod: auth (OTP), checkout (split payment), seller confirm, dispute resolve.
- **RLS smoke (conditionally required):** the `rls-smoke` job (`tests/integration/rls.smoke.test.ts`) hits live **staging** and mints/tears down real GoTrue auth users. It runs the suite on (1) `workflow_dispatch`, (2) push to `develop`, and (3) **any PR whose diff touches `supabase/migrations/**`** — RLS is the sole authz boundary, so every policy/migration change is smoke-tested before merge. On migration-touching PRs it is a **BLOCKING gate** (mark it *required* in branch protection). The job runs on every PR but self-gates: a non-migration PR logs an explicit `"no migration changes"` line and short-circuits (a logged no-op, **never** a silent job-level skip, so the required check always posts a status). It **fails loudly** if staging secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`) are missing — never a silent pass (so a migration-touching fork PR, which lacks secrets, fails visibly). *Residual risk:* concurrent staging runs could collide on auth users; mitigated by the harness's per-run unique-suffix + prefix-sweep and the workflow `concurrency` group (cancels in-progress runs for the same ref).
- **Deploy:** Vercel auto-deploys preview per PR; production on `main` merge after gates pass.
- **Migrations:** Supabase migrations applied via CI to staging first; production apply is a manual, reviewed step (see `DISASTER_RECOVERY.md`). Any PR touching `supabase/migrations/**` triggers the required `rls-smoke` gate above.

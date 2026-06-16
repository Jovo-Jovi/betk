# CICD_PIPELINE.md
> GitHub Actions gates. Block merges that fail.

Pipeline (on PR to `develop`/`main`): `install → lint (eslint) → typecheck (tsc --strict) → unit+integration tests → supabase types drift check → build`. A merge is blocked if any stage fails.

- **Types drift check:** run `supabase gen types` and `git diff --exit-code src/lib/supabase/types.ts`; fail if the committed types are stale (ERD §8).
- **Zod coverage check:** custom step asserts every file in `features/*/actions` and `app/api/*` imports a Zod schema (security gate).
- **E2E (critical flows):** Playwright on `develop` merges and pre-prod: auth (OTP), checkout (split payment), seller confirm, dispute resolve.
- **Deploy:** Vercel auto-deploys preview per PR; production on `main` merge after gates pass.
- **Migrations:** Supabase migrations applied via CI to staging first; production apply is a manual, reviewed step (see `DISASTER_RECOVERY.md`).

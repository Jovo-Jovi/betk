# src/tests/

Test suites (Vitest + Playwright):

| Folder | Runner | Scope |
|---|---|---|
| `unit/` | Vitest | Pure functions, Zod schemas, utility helpers |
| `integration/` | Vitest | Server Actions and RLS policies against a test Supabase project (incl. `rls.smoke.test.ts`) |
| `e2e/` | Playwright | Full browser flows against a staging environment |

Feature folders map to UI Spec areas — see `src/features/README.md`.

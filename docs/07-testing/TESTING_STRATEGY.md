# TESTING_STRATEGY.md
> What gets unit/integration/E2E tested and why. Map every test to an FR/AC id (PRD §5/§9).

- **Unit (Vitest):** all `lib`/utility functions, Zod schemas, money/total math, status & level logic. Required for every utility.
- **Integration:** every Server Action and API route — authz pass/fail, Zod rejection, success path, RLS denial → not-found. Plus high-risk AC: checkout creates exactly 2 payments atomically; confirm decrements stock; dispute resolve notifies both + logs; OTP attempt cap.
- **E2E (Playwright):** OTP auth; onboarding→approval; inquiry→checkout (split payment); order lifecycle; leave review; raise+resolve dispute; boost→admin confirm.
- **Data:** deterministic seed honoring RLS on a test Supabase project (never prod). 
- **Gate:** a feature is "done" only when its AC passes in a reviewer PR. CI blocks on failing tests.

# skill-test-engineer.md
**Owns:** unit, integration, E2E test strategies.

- Unit (Vitest): all utility/`lib` functions, Zod schemas, money/total calculators, status/level logic. Required for every utility (`TESTING_STRATEGY.md`).
- Integration: every Server Action and API route — authz, validation rejection, success path, RLS denial → not-found, and the high-risk acceptance criteria (checkout creates 2 payments; confirm decrements stock; dispute resolve notifies both).
- E2E (Playwright): critical flows — OTP auth, seller onboarding→approval, inquiry→checkout (split payment), order status lifecycle, leave review, raise+resolve dispute, boost purchase→admin confirm.
- Map each test to its FR/AC id (PRD §5/§9). A feature is "done" only when its AC passes in PR review.
- Seed a deterministic test dataset respecting RLS; run with a test Supabase project, never production.

# PHASE 02 — AUTHENTICATION & PROFILES · Task Pack
> Execution pack for `BETK_PHASES.md` Phase 02. Drives Opus/Sonnet in Cursor. Every prompt assumes `.cursor/rules/*.mdc` + `BETK_MASTER_EXECUTION_PROMPT.md` + `SESSION_CONTEXT.md` are already loaded. Build in task order — later tasks depend on earlier. This is the first phase that ships real user-facing flows; the Foundation skeleton (Phase 01) is complete and signed off.

> **Convention (carried from Phase 01):** each task has a **canonical prompt** (the spec of record). When execution surfaces a concrete repo-state fact that the canonical prompt doesn't cover, an **▸ EXPANDED FOR EXECUTION** block holds the prompt actually run; an **▸ AS-BUILT** line records what shipped + carry-forwards. Run the canonical prompt verbatim unless a concrete fact requires expansion. One task per Cursor window: "Read SESSION_CONTEXT.md, then execute T0n."

---

## Objectives
Phone-OTP **and** Google OAuth sign-in via Supabase Auth (OD-4) · OTP verify with attempt-limiting · OAuth callback + find-or-create on `users` with `auth_provider` · session creation + role routing · buyer profile completion · account **deactivate** (OD-2) · the **verified-phone-before-transacting** gate (app-layer half of the OD-4 RLS gate). Exit when: a user can sign in by phone OR Google, complete a buyer profile, get role-routed, deactivate their account, and a phone-less Google user is correctly forced through phone+OTP before any transaction.

## Authoritative sources (read before building)
- **PRD:** FR-AUTH-1 (`/auth/login`), FR-AUTH-2 (`/auth/verify`), FR-AUTH-3 (`/auth/register`), FR-BUY-1 (`/account`). AC-AUTH-2.
- **Rules:** R-A01 amended (no passwords; OTP + OAuth), R-A02 (60s expiry, one active OTP/phone), R-A03 amended (phone unique+nullable), R-A04 (roles additive), R-A05 (suspended/deactivated blocked incl. `deleted_at`), R-A06 (phone read-only on account). R-S04 (seller status routing).
- **Architecture:** §3 (Server Actions + Zod + RLS), §4 (middleware already built T10), §6 (Sentry tag by feature+role).
- **Security:** C3 §8.2 (hashed OTP & session tokens), SECURITY_GUIDELINES. **Zod on every Server Action** (CI zod-coverage guard enforces this).
- **ERD:** `otp_tokens` (service-only, not client-readable, hourly cron cleanup), `sessions` (self-scope, Auth-managed), `buyer_profiles` (`id = users.id`, `bp_self` policy), `users` freeze deltas.

## ⚠️ KEY ARCHITECTURAL DECISION — resolve in T01 before any code
**Supabase Auth vs. BETK's own `otp_tokens`/`sessions` tables.** Supabase Auth (GoTrue) manages phone OTP, OAuth, and session JWTs/cookies internally — it does NOT write to `betk.otp_tokens` or `betk.sessions`. But the schema defines both tables with hashing requirements (C3 §8.2), and FR-AUTH-2 says "create a session (30d/24h)." These can't both be the source of truth. **Two viable models — T01 must pick one and document it:**
- **Model A (GoTrue-canonical, recommended):** Supabase Auth owns OTP issuance/verify + sessions (cookies). `betk.users` is the find-or-create mirror keyed to `auth.users.id`. `betk.otp_tokens`/`betk.sessions` become either (a) unused-in-MVP (kept for schema parity, fed later) or (b) lightweight audit mirrors written by Server Actions. The "≤5 attempts / 60s expiry / hashed" requirements map to GoTrue's built-in rate-limit + expiry config where possible, with app-layer attempt tracking only if GoTrue's doesn't satisfy AC-AUTH-2.
- **Model B (custom OTP):** BETK issues/verifies OTP itself via `otp_tokens` (hashed, 60s, ≤5 attempts) + the `sms.ts` wrapper, and creates sessions in `betk.sessions`, using Supabase Auth only as a thin identity store. More control, more security surface to own (hashing, timing-safe compare, rate-limit), more code.

This is a real fork with downstream consequences (T02–T04 all change shape based on it). **Do not let the build improvise it** — T01 is explicitly a decide-and-document task. Recommended: **Model A**, since it inherits GoTrue's hardened OTP/session handling and matches "Supabase Auth (OD-4)" in every source doc; reconcile the `otp_tokens`/`sessions` tables as audit-or-deferred. Confirm against `BETK_ARCHITECTURE §3` / `C3 §8.2` and get explicit sign-off in the T01 output before T02.

## PHASE 02 ENTRY DEBTS (Phase 01 carry-forwards due here — schedule into owning tasks, don't lose them)
- **[T03/OAuth] Re-tighten `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to required** (`z.string().min(1)`) in `configs/env.ts` — they're `.optional()` today. Do this in the task that wires Google OAuth Server Actions.
- **[T02/login] Open-redirect guard:** validate the middleware `returnUrl` is a local path (starts with `/`, not `//` or a full URL) before redirecting. Comment already at the redirect site in `src/middleware.ts`. The login page consumes `returnUrl`, so the guard lands here.
- **[T05/profile + T06/deactivate] Sentry `setUser`:** `SentryProvider.tsx` is a passthrough reserved for `Sentry.setUser({ id })` — wire it once a session exists (no PII beyond user id; ARCHITECTURE §6).
- **[server-side analytics] PostHog import rule:** server-side capture (`captureServerEvent`/`identifyUser`) imports from `@/services/posthog.server`, NEVER `@/services/posthog` (client-safe config only). Any auth-funnel event in a Server Action follows this.
- **[NOT due here — parked]** Permissive INSERT on `seller_profiles` is **Phase 04**; on `orders` is **Phase 07**. Phase 02 only builds the *app-layer* phone gate (the `users.phone_number IS NOT NULL` check in Server Actions) and the phone-capture flow — it does NOT add those permissive policies.

## Definition of done (Phase 02 exit checklist)
- [ ] `/auth/login` accepts a phone number → triggers OTP (per chosen model); also offers "Continue with Google".
- [ ] `/auth/verify` verifies OTP with **≤5 attempts**, rejects expired/used tokens, **never persists raw OTP**, creates a session, sets `users.last_login_at` (AC-AUTH-2).
- [ ] Google OAuth callback does **find-or-create** on `users` with `auth_provider='google'`, `phone_number=NULL`; existing users link, not duplicate.
- [ ] Role routing after auth: buyer→`/` (or `returnUrl`), seller→dashboard/`/seller/status` per R-S04, admin→`/admin`.
- [ ] `/auth/register` completes a buyer profile (full_name + governorate required) → `buyer_profiles` row (`id=users.id`).
- [ ] Suspended/deactivated users blocked (R-A05 incl. `deleted_at`) — already at middleware; re-checked in auth Server Actions.
- [ ] `/account` shows profile, phone **read-only** (R-A06), and a **deactivate** action that sets `users.deleted_at` (OD-2; no hard delete).
- [ ] **Transaction phone-gate (app layer):** a Google-only user (phone NULL) attempting checkout/become-seller/payout entry is forced through a phone+OTP capture flow before proceeding; a phone-verified user passes. (RLS half already live from Phase 01; permissive INSERT policies land Phase 04/07.)
- [ ] Every new Server Action is Zod-validated (CI zod-coverage guard green); auth errors tagged in Sentry by feature+role.
- [ ] Integration tests: OTP flow (issue/verify/attempts/expiry), find-or-create, deactivate-blocks-login. E2E: phone sign-in happy path.

---

## T01 — Auth model decision + Supabase Auth configuration
- **Model:** **Opus 4.8** (architecture/security) · **Skill:** skill-security-reviewer, skill-supabase-engineer · **Source:** ARCHITECTURE §3, C3 §8.2, PRD FR-AUTH-1/2
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 02 / T01 — decide the auth model and configure Supabase Auth. NO user-facing pages yet; this task produces a written decision + provider config + the users find-or-create primitive.

1. DECISION (resolve the "Supabase Auth vs betk.otp_tokens/sessions" fork — see the pack's Key Architectural Decision):
   - Evaluate Model A (GoTrue-canonical: Supabase Auth owns OTP + sessions; betk.users mirrors auth.users; otp_tokens/sessions reconciled as audit-or-deferred) vs Model B (custom OTP via otp_tokens + sms.ts + betk.sessions).
   - Recommend one (default A unless a concrete source-doc requirement forbids it). Verify the choice against ARCHITECTURE §3 and C3 §8.2 (hashed OTP/session-token requirements) and AC-AUTH-2 (≤5 attempts, 60s expiry, never persist raw OTP). State EXACTLY how the chosen model satisfies each AC-AUTH-2 clause — if GoTrue's built-in rate-limit/expiry covers it, cite the config; if app-layer attempt tracking is still needed, say so and where it will live.
   - Write the decision as a short ADR-style note (docs/decisions or inline in the journal) so T02–T06 build against it. Flag what happens to betk.otp_tokens/betk.sessions under the chosen model (unused / audit-mirror / canonical).

2. CONFIGURE Supabase Auth on staging (direct supabase binary; npx wrapper hangs):
   - Enable phone OTP and Google OAuth providers. Document the exact dashboard/config settings (OTP length, expiry=60s to match R-A02, rate-limit) and which belong in supabase/config.toml vs the hosted dashboard.
   - Note the Google OAuth redirect/callback URL that T03 will implement; list the GOOGLE_CLIENT_ID/SECRET requirement (these get re-tightened to required in configs/env.ts in T03).

3. BUILD the find-or-create primitive (no UI): a server-only helper (src/features/auth/queries or actions) that, given an authenticated auth.users identity, finds the matching betk.users row by id or creates it (auth_provider set correctly, phone_number from the identity or NULL for Google). Re-check R-A05 (status='active' AND deleted_at IS NULL) here. Zod-validate any input. This is the shared primitive both phone and OAuth sign-in will call in T02/T03.

Do NOT build login/verify/register pages or the deactivate flow yet. Output: the written decision, the provider config notes, and the find-or-create helper. pnpm typecheck clean.
```
- **Files:** decision note (journal/ADR), `supabase/config.toml` (auth block if applicable), `src/features/auth/{queries,actions}/findOrCreateUser.ts` (or similar).
- **Done when:** auth model decided + documented with AC-AUTH-2 mapping; Supabase Auth providers enabled on staging; find-or-create primitive compiles + re-checks R-A05. **Gate: do not start T02 until the model decision is signed off** (paste it for review).

## T02 — Phone-OTP sign-in + verify (`/auth/login`, `/auth/verify`)
- **Model:** Sonnet (impl) · **Skill:** skill-nextjs-engineer, skill-ui-engineer, skill-supabase-engineer · **Source:** FR-AUTH-1, FR-AUTH-2, AC-AUTH-2
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 02 / T02 — phone-OTP sign-in + verify, per the T01 auth-model decision (read it first; build to that model, not a different one).

Pages (real, RTL Arabic; use components/shared + components/ui placeholders — do NOT restyle, Phase DS owns visuals):
- /auth/login (public): phone-number entry (Egyptian format validation via Zod), submit → request OTP through the T01 model. Also render a "Continue with Google" button that initiates the OAuth flow wired in T03 (button + handler stub is fine here; full callback is T03). One active OTP per phone (R-A02).
- /auth/verify (public): OTP entry (6-digit), verify through the T01 model. Enforce AC-AUTH-2: ≤5 attempts per token, reject expired (60s, R-A02) / used tokens, NEVER persist or log the raw OTP. On success: session created (per model), set users.last_login_at, call the T01 find-or-create, then role-route (buyer → returnUrl or /; seller → dashboard or /seller/status per R-S04; admin → /admin).

Server Actions: all Zod-validated (the CI zod-coverage guard will fail otherwise). Re-check R-A05 (active + deleted_at IS NULL) on verify — a deactivated user must not get a session. Tag auth errors in Sentry by feature ('auth') + role via services/sentry.ts setFeatureContext.

ENTRY DEBT — open-redirect guard: validate returnUrl is a local path (starts with '/', not '//' or a full URL) before redirecting. There's a TODO comment at the redirect site in src/middleware.ts; implement the shared validator and use it here and there.

Wire Sentry.setUser({ id }) once the session exists (the SentryProvider passthrough from T09 is reserved for this; user id only, no PII).

No deactivate flow, no profile completion yet. pnpm typecheck + lint clean.
```
- **Files:** `app/(auth)/login/page.tsx`, `app/(auth)/verify/page.tsx`, `src/features/auth/actions/*`, `src/features/auth/components/*`, a shared `returnUrl` validator (`lib/` or `features/auth`).
- **Done when:** phone → OTP → verify creates a session and role-routes; ≤5 attempts + expiry enforced; raw OTP never persisted; returnUrl guarded; deactivated user blocked at verify. Integration test for the OTP flow.

## T03 — Google OAuth callback + find-or-create
- **Model:** **Opus** (security review on the callback) · **Skill:** skill-security-reviewer, skill-supabase-engineer, skill-nextjs-engineer · **Source:** FR-AUTH-1 (OD-4), ERD §1.2 (auth_provider)
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 02 / T03 — Google OAuth callback + find-or-create, per the T01 model.

ENTRY DEBT first: re-tighten GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in configs/env.ts from .optional() to required (z.string().min(1)) — OAuth now depends on them. Confirm they're set in .env.local (staging values) so dev works; the loader must fail fast if absent.

Implement the OAuth callback route (app/(auth)/callback or app/auth/callback per Next 15 route-handler convention + the redirect URL documented in T01). On callback:
- Exchange the code for a session (Supabase Auth).
- find-or-create the betk.users row (reuse the T01 primitive): existing identity → link to the existing users row (do NOT duplicate); new → create with auth_provider='google', phone_number=NULL.
- Re-check R-A05 (active + deleted_at IS NULL) — a deactivated user signing in via Google must be blocked, not resurrected.
- Role-route as in T02. If the new Google user has no buyer_profile, route to /auth/register (T04).
- Validate any input with Zod; tag Sentry by feature 'auth-oauth' + role; Sentry.setUser({ id }).

Security focus (this is why it's Opus-reviewed): the callback is an unauthenticated entry point. Verify state/PKCE handling is left to Supabase Auth (don't hand-roll), the code exchange happens server-side only, no tokens leak to the client, and the find-or-create can't be used to hijack an existing phone-based account (match strictly on auth.users.id, never on email alone collapsing into a phone account).

pnpm typecheck + lint clean. Add an integration test for find-or-create (new google user → row with phone NULL + auth_provider google; returning user → no duplicate).
```
- **Files:** `app/(auth)/callback/route.ts` (or per convention), `configs/env.ts` (re-tighten), `src/features/auth/*`, test.
- **Done when:** Google sign-in creates/links one users row with `auth_provider='google'`, `phone_number=NULL`; no duplicate on return; deactivated blocked; env vars required again; callback reviewed for the hijack/leak vectors above.

## T04 — Complete buyer profile (`/auth/register`)
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer, skill-ui-engineer · **Source:** FR-AUTH-3
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 02 / T04 — buyer profile completion.

/auth/register (protected — middleware already requires auth on this route group; confirm): a form collecting full_name (required) + governorate (required; use the Egypt governorate list — source it from constants if present, else add a constants/governorates.ts with the 27 governorates, Arabic + English). Optional fields per buyer_profiles schema only (do not invent columns).

On submit (Zod-validated Server Action): create/update the buyer_profiles row with id = users.id (the bp_self RLS policy governs this — verify an authenticated user can insert their own profile; if buyer_profiles lacks a permissive ownership INSERT policy like orders/seller_profiles did, FLAG IT as a finding and STOP — do not add the policy without review, it may be an intended Phase-01 gap). Then route to returnUrl or /.

This page is shown when a newly-authed user has no buyer_profile (T02/T03 route here). Returning users with a profile skip it. pnpm typecheck + lint clean. Integration test: profile creation writes buyer_profiles with id=users.id.
```
- **Files:** `app/(auth)/register/page.tsx`, `src/features/auth/actions/completeProfile.ts`, possibly `constants/governorates.ts`.
- **Done when:** profile form creates a `buyer_profiles` row keyed to the user id; full_name + governorate required; routed onward. **Watch:** if `buyer_profiles` INSERT is default-denied (same RESTRICTIVE/no-permissive pattern as orders), that's a finding to surface, not silently patch.

## T05 — Account page + profile read (`/account`)
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer, skill-ui-engineer · **Source:** FR-BUY-1, R-A06
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 02 / T05 — account/profile page (read + edit, NO deactivate yet — that's T06).

/account (protected): display the user's buyer_profile + users fields. phone_number is READ-ONLY (R-A06) — render it, never editable. Allow editing the editable buyer_profiles fields only (full_name, governorate, any optional schema fields) via a Zod-validated Server Action. Show auth_provider (how they signed in) as read-only info. If a Google user has phone_number NULL, show a non-blocking "add phone to transact" affordance that initiates the phone-capture flow (the flow itself is T07; here it's an entry point/link).

Use components/shared placeholders; do not restyle. pnpm typecheck + lint clean.
```
- **Files:** `app/(buyer)/account/page.tsx`, `src/features/buyer-account/{actions,queries,components}/*`.
- **Done when:** account shows profile with phone read-only; editable fields update via validated action; phone-NULL Google users see a (non-blocking) path to add a phone.

## T06 — Account deactivation (OD-2)
- **Model:** **Opus** (security/data review) · **Skill:** skill-security-reviewer, skill-supabase-engineer · **Source:** OD-2, FR-BUY-1, R-A05
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 02 / T06 — account deactivation (DEACTIVATE-only, OD-2; NO hard delete, NO anonymization behavior in MVP).

On /account, add a deactivate action (Zod-validated Server Action, confirmation required in UI): sets users.deleted_at = now() for the current user. Do NOT delete the row, do NOT touch anonymized_at (reserved, post-MVP). After deactivation: sign the user out (clear the Supabase Auth session) and redirect to a public page.

Verify the loop closes with R-A05: a user with deleted_at set must be blocked from signing in again (middleware already checks deleted_at IS NOT NULL → /blocked; T02/T03 re-check at verify/callback). Add an integration test proving deactivate → subsequent login attempt is blocked.

Security review focus: the action must only ever set deleted_at for auth.uid() (never another user); confirm RLS on users UPDATE permits self-deactivation but not editing other users or other columns through the same path. If self-UPDATE on users isn't permitted by an existing policy, FLAG it as a finding (the deactivate path may need a scoped permissive UPDATE policy) — surface it, recommend the minimal policy, but get review before applying.

pnpm typecheck + lint clean.
```
- **Files:** `src/features/buyer-account/actions/deactivate.ts`, `/account` UI addition, test.
- **Done when:** deactivate sets `deleted_at`, signs out, and the user is blocked on re-login (R-A05 loop verified end-to-end). Any missing self-UPDATE policy surfaced as a finding, not silently added.

## T07 — Verified-phone transaction gate (app layer) + phone-capture flow
- **Model:** **Opus** (security) · **Skill:** skill-security-reviewer, skill-supabase-engineer, skill-nextjs-engineer · **Source:** OD-4, ARCHITECTURE §3, PRD FR-AUTH-1 ("prompted for phone+OTP at that point")
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 02 / T07 — the app-layer verified-phone gate + the phone-capture flow for Google-only users. (The RLS WITH CHECK half is already live from Phase 01; this is the Server-Action half + the UX that lets a phone-NULL user obtain a phone.)

1. Shared guard: a server-only helper requireVerifiedPhone() (src/features/auth) that loads the current user and throws/redirects if users.phone_number IS NULL. This is the canonical check the transaction entry points (checkout [Phase 07], become-seller [Phase 04], payout request [Phase 13]) will call. Build it now, with a clear exported contract, so those phases consume it rather than re-implementing.

2. Phone-capture flow: a reusable flow that lets an authenticated phone-NULL (Google) user add + verify a phone via OTP (reuse the T01 model + T02 verify primitives — do NOT fork a second OTP path). On success, set users.phone_number (UNIQUE — handle the collision case where the phone already belongs to another account: reject cleanly, do not merge accounts). auth_provider stays 'google' (it records origin, not current capability).

3. Wire requireVerifiedPhone() into the /account "add phone" entry point from T05 as the first live consumer + proof. Do NOT wire checkout/become-seller/payout here (those are their own phases) — but leave the helper exported and documented so they can.

IMPORTANT — do NOT add the permissive ownership INSERT policies to orders/seller_profiles here. Those are Phase 07 / Phase 04 respectively (see entry debts). T07 is the app-layer gate + phone capture only. If you find yourself needing those policies to test, that confirms the parked dependency — note it, don't add it.

Zod on all actions; phone uniqueness collision tested; tag Sentry 'auth-phone-gate'. pnpm typecheck + lint clean. Integration test: phone-NULL user blocked by requireVerifiedPhone(); after capture+verify, passes; duplicate-phone capture rejected.
```
- **Files:** `src/features/auth/{actions,queries}/requireVerifiedPhone.ts`, phone-capture flow components/actions, `/account` wiring, tests.
- **Done when:** `requireVerifiedPhone()` exists + is exported for Phase 04/07/13; a phone-NULL user can add+verify a phone (no second OTP path); UNIQUE collision rejected cleanly; account page proves the gate. Parked policies explicitly NOT added.

## T08 — Phase 02 exit verification
- **Model:** **Opus** (review) · **Skill:** skill-security-reviewer · **Source:** this pack's DoD + BETK_PHASES Phase 02 Acceptance
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 02 / T08 — exit verification. Use the direct supabase binary.

Verify against this pack's DoD + BETK_PHASES Phase 02 Acceptance + AC-AUTH-2:
- Phone sign-in: login → OTP → verify creates a session, sets last_login_at, role-routes. ≤5 attempts enforced; expired/used token rejected; raw OTP never persisted (grep the codebase + check logs/DB — the OTP value must not be stored in plaintext anywhere).
- Google OAuth: callback find-or-creates one users row (auth_provider='google', phone NULL); returning user does not duplicate; deactivated user blocked.
- Buyer profile: /auth/register writes buyer_profiles (id=users.id); full_name + governorate required.
- Role routing correct for buyer/seller(/seller/status per R-S04)/admin.
- R-A05: suspended AND deactivated (deleted_at) users blocked at middleware + re-checked at verify/callback. Prove deactivate → re-login blocked.
- /account: phone read-only (R-A06); deactivate sets deleted_at (no hard delete).
- Transaction gate: requireVerifiedPhone() blocks phone-NULL users; phone-capture flow sets phone (UNIQUE collision rejected); RLS WITH CHECK still intact from Phase 01.
- Every new Server Action Zod-validated (CI zod-coverage green); CI fully green; auth E2E passes.

Confirm the Phase-02 entry debts were cleared: GOOGLE_* required again; returnUrl open-redirect guard live; Sentry.setUser wired; posthog.server used for any server capture. Confirm the PARKED items are still correctly parked (no permissive INSERT added to orders/seller_profiles).

Produce a PASS/FAIL report per line. Block sign-off only on hard failures (raw OTP persisted, deactivated user can log in, OAuth account hijack possible, a Server Action missing Zod, default-deny broken). Log doc/ops mismatches as corrections. Then write the Phase-03 entry checklist from any Phase-02 carry-forwards, update SESSION_CONTEXT (Last completed → Phase 02; Next → Phase 03 Catalog & Discovery) + append DEVELOPMENT_JOURNAL. Do not start Phase 03.
```
- **Done when:** all DoD lines PASS or doc-corrected; entry debts confirmed cleared; parked items confirmed parked; SESSION_CONTEXT + journal updated; sign-off to start Phase 03.

---

## Cross-cutting reminders for every Phase 02 task
- **Zod on every Server Action** — non-negotiable, the CI `zod-coverage` guard fails the build otherwise. This is also the C3 §8.5 security condition.
- **RLS is the security boundary, UI gating is UX** (ARCHITECTURE §4). Server Actions re-check role; never trust the client.
- **Raw OTP never persisted or logged** (AC-AUTH-2) — applies to console.log, Sentry breadcrumbs, and DB alike.
- **Sentry:** tag by feature + role (`setFeatureContext`); `setUser({ id })` once authed; no PII.
- **PostHog server capture** from `@/services/posthog.server` only.
- **CLI:** direct supabase binary, not `npx` (wrapper hangs in this env).
- **Visuals are Phase-DS-owned** — compose `components/ui`/`components/shared` placeholders, wire data, never restyle.
- **One task per Cursor window;** close-out rhythm: update SESSION_CONTEXT + DEVELOPMENT_JOURNAL → commit → new window.

## Open dependencies into later phases (set up here, consumed later)
- `requireVerifiedPhone()` (T07) → consumed by checkout (Phase 07), become-seller (Phase 04), payout (Phase 13).
- Permissive ownership INSERT policies on `seller_profiles` (Phase 04) and `orders` (Phase 07) — **still parked**, Phase 02 does not touch them.
- `buyer_profiles` INSERT policy — if T04 finds it default-denied, that's the same pattern; surface for the owning gate.

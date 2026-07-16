# ADR.md — Architectural Decision Records
> `11-decisions/` home. One record per major technical choice. Append-only; supersede rather than edit.

### ADR-001 — Supabase JS Client over an ORM
Status: Accepted. Context: MVP needs type-safe DB access without ORM overhead. Decision: Supabase JS Client + `supabase gen types` + Zod; no Prisma/Drizzle. Consequences: regenerate types every migration; RLS is the authorization layer.

### ADR-002 — Split payment, no custody
Status: Accepted. Decision: 50% deposit (Instapay/VF Cash/Orange Cash) + 50% COD; two `payments` rows per order; BETK never holds funds. Consequences: manual seller confirmation; no gateway; wallet/escrow is post-MVP (C3 §8.4).

### ADR-003 — Phone OTP as sole auth
Status: **Superseded by ADR-008** (Google OAuth added per OD-4). Original: Supabase Auth phone OTP only; no passwords (R-A01).

### ADR-004 — tsvector full-text search (no external engine)
Status: Accepted. Decision: Postgres tsvector + GIN + unaccent for 1–2 keyword Arabic search; no Elasticsearch/Typesense at MVP. Consequences: revisit > ~500K listings (C3 §8.1).

### ADR-005 — RLS-first authorization
Status: Accepted. Decision: RLS enabled + default-deny on all 43 tables; UI auth gates are UX only. Consequences: every table needs policies from day 1; helper functions must be indexed/SECURITY DEFINER.

### ADR-006 — Soft delete limited to listings
Status: Accepted. Decision: `deleted_at` on listings only; append-only audit tables; status-hiding for suspensions. Consequences: order_items snapshot listing title/price.

### ADR-007 — Opus = architect/reviewer, Sonnet = builder (Cursor)
Status: Accepted. Decision: Per Dev OS Step 7, use Opus for architecture/security/review and Sonnet for routine implementation; current models Opus 4.8 / Sonnet 4.6. Consequences: cost/latency balance; reviewer pass is mandatory before merge.

### ADR-008 — Google OAuth added (supersedes ADR-003)
Status: Accepted (MVP Freeze 2026-06-13, OD-4). Decision: sign-in via phone-OTP OR Google OAuth (Supabase Auth links identities). `users.phone_number` nullable+UNIQUE; add `users.auth_provider ('phone'|'google')`. R-A01 amended to "phone-OTP + Google OAuth; phone verification gated to transactions." A verified phone is required before checkout, becoming a seller, or payout (Server Action + RLS WITH CHECK). Consequences: easier sign-up (goal of OD-4) without losing COD/notifications/trust which depend on a verified phone; one extra enum + nullable phone; transaction gate must be tested.

### ADR-009 — users.deleted_at / anonymized_at added now (OD-2)
Status: Accepted (MVP Freeze 2026-06-13). Decision: add two nullable timestamps to `users` during initial schema rather than later. MVP behavior = deactivate-only (login blocked when status≠active OR deleted_at set); anonymized_at reserved for post-MVP MW1. Consequences: avoids a future high-cost users migration; no added MVP behavior beyond deactivation.

### ADR-010 — GoTrue-canonical auth (Model A); otp_tokens = attempt-limiter, sessions = unused
Status: **Accepted** (Phase 02 / T01, 2026-06-24, Opus 4.8). Supersedes the implicit "custom OTP" reading of C3 §8.2 for MVP. **Decision gate: T02–T06 build against this record.**

**Context.** The schema defines `betk.otp_tokens` (hashed token, 60s expiry, `chk_otp_attempts CHECK(attempt_count<=5)`) and `betk.sessions` (hashed session token), while every source doc (OD-4, FR-AUTH-1/2, ARCHITECTURE §2/§3, ERD §1.2, SECURITY_GUIDELINES) names **Supabase Auth (GoTrue)** as the identity provider for phone-OTP *and* Google OAuth. GoTrue manages OTP issuance/verify, OAuth, and session JWTs/refresh-cookies internally and does **not** write to `betk.otp_tokens` / `betk.sessions`. Both cannot be the source of truth — T01 must pick one.

**Decision — Model A (GoTrue-canonical).** Supabase Auth owns OTP issuance + verification, OAuth code-exchange, and session cookies/JWTs. `betk.users` is a **find-or-create mirror** keyed 1:1 to `auth.users.id` (same UUID; no FK — provisioned by the app at first sign-in, see the T01 primitive). Rejected **Model B (custom OTP)** because it re-owns hardened security surface (OTP generation, SHA-256 hashing, timing-safe compare, single-active enforcement, per-IP rate-limit, session-token minting/rotation) that GoTrue already provides and that no source doc *requires* us to hand-roll — C3 §8.2's "OTP hashed / session tokens hashed" is satisfied by GoTrue's own hashed storage, so the security intent is met without the extra attack surface. Model B remains a documented fallback if a future requirement forbids GoTrue OTP.

**AC-AUTH-2 conformance (each clause, exactly):**
1. **"never persists the raw OTP"** — ✅ satisfied structurally. The app **never writes the OTP anywhere**. GoTrue stores only a hashed confirmation token in `auth.*`; our verify Server Action (T02) receives the 6-digit code transiently, forwards it to `supabase.auth.verifyOtp(...)`, and never logs/persists it (no `console.log`, no Sentry breadcrumb, no DB column). `betk.otp_tokens.token_hash` will **never** hold the OTP value.
2. **"expired/used tokens rejected"** — ✅ satisfied by GoTrue. OTPs are single-use and expiry-checked server-side (`isOtpExpired(sentAt, SMS_OTP_EXP)`; `verify.go`). Expiry = **60s** to match **R-A02**: GoTrue's `SMS_OTP_EXP` **defaults to 60** (confirmed in `internal/conf/configuration.go`) and is pinned explicitly (config below). "One active OTP per phone / 60s resend window" = `SMS_MAX_FREQUENCY=60s`.
3. **"success creates a session"** — ✅ satisfied by GoTrue (sets the auth cookie/JWT on `verifyOtp` success; `@supabase/ssr` middleware already refreshes it, T10). `last_login_at` is set by the T02 verify action (not by this primitive).
4. **"≤5 attempts per token"** — ⚠️ **NOT covered by GoTrue** — this is the one clause needing app-layer work. GoTrue invalidates OTPs **only by expiry/single-use**; it has **no per-token failed-attempt counter**. Its only throttle is a **per-IP** verification rate-limit (`token_verifications`, project-wide), which is a brute-force backstop, not a per-token cap. **Where it lives:** an app-layer attempt counter in the **T02 `/auth/verify` Server Action**, backed by **`betk.otp_tokens`** (increment `attempt_count` per failed `verifyOtp` for the phone's current challenge; reject the 6th; the existing `chk_otp_attempts CHECK(attempt_count<=5)` is the DB backstop). The row stores **only** the phone + an opaque, non-reversible challenge reference + `expires_at` + `attempt_count` — **never the OTP**. Implementation note for T02: `otp_tokens.token_hash` is `NOT NULL VARCHAR(64)`; populate it with a SHA-256 of a server-generated per-challenge **nonce** (or `phone||issued_at`), *not* the OTP. If that proves awkward, T02 may **flag** a one-line migration to make `token_hash` nullable / add a `purpose` column — surface for review, do not silently apply.

**Fate of the two tables under Model A:**
- **`betk.otp_tokens` → repurposed as an app-layer attempt-limiter / audit mirror** (NOT the canonical OTP store; never holds a raw or usable OTP). Written by the T02 verify action only. The existing hourly `cleanup-otp-tokens` pg_cron already purges it.
- **`betk.sessions` → UNUSED in MVP.** GoTrue owns sessions (cookies/JWT/refresh-rotation; `config.toml` `enable_refresh_token_rotation=true`). OD-5 already froze the sessions UI OUT. Kept for schema parity; may become an audit mirror post-MVP. **No Phase-02 code writes it.**

**Provisioning constraint discovered in T01 (drives the primitive's shape):** `betk.users` has RLS enabled with **only `users_self` (FOR SELECT)** — there is **no permissive INSERT and no permissive UPDATE policy** (matches ERD §3 "users INSERT = (Supabase Auth)"). So the authenticated cookie client can read its own row but **cannot create it** (default-denied). The find-or-create CREATE branch therefore runs through a **trusted server path** (`src/services/authUsers.ts`, service-role, behind the `check-service-import` guard's allowed `src/services/` location) that inserts **only** with `id = the verified auth uid` (never a client-supplied id). **Carry-forward FINDING:** the same missing-policy gap blocks **self-UPDATE** — so `last_login_at` (T02), `deleted_at` deactivation (T06), and phone-capture `phone_number` set (T07) must each use the trusted path **or** a scoped permissive UPDATE policy must be added (surface for review per the T06 prompt; do not silently add).

Consequences: minimal new security surface; one shared `findOrCreateUser` primitive for both phone (T02) and Google (T03); the only bespoke OTP code is the ≤5 attempt-limiter; staging provider enablement is a hosted-dashboard step (see config notes below / DEVELOPMENT_JOURNAL T01).

### ADR-011 — Internationalization (AR/EN) & theming (OD-7)
Status: Accepted 2026-07-01 (amends scope via OD-7; supersedes the earlier Arabic-only, single-`dir="rtl"` assumption). Context: OD-7 makes BETK a bilingual Arabic/English, light/dark app over the existing frozen page inventory (see `BETK_UI_SPEC.md §3`), with no new pages/tables/content columns and no translation service. Decision: `next-intl` (v4) for the UI shell + `next-themes` for theming — the only two dependencies OD-7 adds, both presentation-layer only; locale as a path segment (`src/app/[locale]/`, `localePrefix: 'as-needed'` — Arabic unprefixed/default, English under `/en`); the single `<html>` (`dir`/`lang` derived from locale) lives in `src/app/[locale]/layout.tsx`; `next-themes` uses the class strategy (`attribute="class"`, `.dark`); the middleware composes next-intl's locale negotiation with the existing auth gate, normalizing locale BEFORE `gateFor()` runs so every gate verdict is locale-invariant; no schema change — shell chrome uses `next-intl` catalogs, structured lists keep existing `*_ar`/`*_en` columns, names/titles use a `COALESCE(locale column, other)` helper, and descriptions/bios render as-authored (no translation/fallback). Full decision record (routing, content model, consequences) lives in `BETK_ARCHITECTURE.md §9`, which this entry is the canonical registry record for — that section must cite **ADR-011**, never a second "ADR-002". Consequences: URLs stay stable for Arabic; English gains a `/en` mirror; schema change NO; new dependency = `next-intl` + `next-themes` only.

**Numbering-collision note (docs-hygiene, 2026-07-16):** this decision was originally mislabeled "ADR-002" directly in `BETK_ARCHITECTURE.md §9`, colliding with this file's own, unrelated ADR-002 ("Split payment, no custody"). Corrected to **ADR-011** (the next free slot in this registry — ADR-003 was already taken/superseded) as part of the R4 docs-hygiene batch; `ADR.md` is the single ADR registry, `BETK_ARCHITECTURE.md §9` now only cross-references it.

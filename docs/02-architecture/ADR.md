# ADR.md — Architectural Decision Records
> `11-decisions/` home. One record per major technical choice. Append-only; supersede rather than edit.

## B5 disposition (2026-09-22)

Mint re-read before taking: this file ended at ADR-019. No ADR-020 row. **Took ADR-020..ADR-025.** Next free **ADR-026**. One verdict each. Original text below is kept.

| ADR | Verdict | Reason |
|---|---|---|
| ADR-001 | **HOLDS** | `BETK_ARCHITECTURE.md` still specifies the Supabase JS client + Zod and names Prisma/Drizzle as not used. |
| ADR-002 | **SUPERSEDED** (ADR-016) | Already marked. No-custody split payment is not the v2 model (`BETK_MVP_SCOPE.md` §4.1 OD-8). |
| ADR-003 | **SUPERSEDED** (ADR-008) | Already marked. Phone OTP is not the sole auth (OD-4; `BETK_PRD.md` FR-AUTH-1). |
| ADR-004 | **HOLDS** | Live `trg_listing_search_vector` still maintains `listings` tsvector. ERD §7 keeps that trigger. |
| ADR-005 | **HOLDS WITH AMENDMENT** | RLS stays the authorization boundary (ERD §8). “All 43 tables” is amended by OD-20 = 51. `is_admin()` / `my_store_id()` stay DEFINER helpers. That is not a DEFINER RPC (ADR-012). |
| ADR-006 | **HOLDS** | `listings` DELETE stays none (soft delete, ERD §8). `users.deleted_at` is OD-2 deactivation, which is ADR-009. |
| ADR-007 | **HOLDS WITH AMENDMENT** | The Opus = architect/reviewer, Sonnet = builder split still stands (`.cursor/rules/00-betk-core.mdc`). The names “Opus 4.8 / Sonnet 4.6” are not a freeze; the human picks the model. |
| ADR-008 | **HOLDS** | OD-4 holds unchanged. Sign-in is phone-OTP or Google OAuth (`BETK_PRD.md` FR-AUTH-1). |
| ADR-009 | **HOLDS** | OD-2 holds unchanged: deactivate-only, `deleted_at` / `anonymized_at`. |
| ADR-010 | **HOLDS** | GoTrue remains canonical (SESSION_CONTEXT standing fact). `betk.sessions` stays unused (OD-5). |
| ADR-011 | **HOLDS** | OD-7 holds unchanged: `next-intl` + `next-themes`, no schema change for i18n. OD-20 / OD-21 added tables and pages for product scope, not for locale. |
| ADR-012 | **HOLDS** | Live `submit_seller_application` is INVOKER (`prosecdef` false), `search_path` pinned, EXECUTE to `authenticated` only. No decision below adds a DEFINER RPC. DEFINER triggers with EXECUTE revoked stay the permitted kind. |
| ADR-013 | **HOLDS** | ERD §7 adds no listing-create RPC. A draft with partial children is still a valid resting state. |
| ADR-014 | **HOLDS** | Live `inquiries.buyer_first_message` still exists. Quote columns and `cart_items.inquiry_id` do not turn creation into a multi-table write. The conversion link is ADR-025. |
| ADR-015 | **HOLDS** | Live `authenticated` has no table-level UPDATE on `inquiry_messages`; column UPDATE is `is_read` only. ADR-020 uses that same grant shape for SELECT. |
| ADR-016 | **HOLDS WITH AMENDMENT** | Custody holds. Operative amendments are already in `BETK_MVP_SCOPE.md` §4.1: InstaPay-only buyer rail, commission on subtotal, one admin verification, no seller acceptance, courier-collected balance. The “43 tables / 59 pages / seller acceptance” sentences in this record are historical. |
| ADR-017 | **SUPERSEDED** (ADR-025) | v2 checkout does not write `converted_to_order_id` (R-O11). The trigger is dropped. The column stays. |
| ADR-018 | **SUPERSEDED** (ADR-025) | `create_order_from_inquiry` is replaced by one INVOKER `checkout_from_cart`. |
| ADR-019 | **HOLDS WITH AMENDMENT** | The three-layer model holds. ADR-021 drops `proof_path` and `transfer_reference` from the `authenticated` UPDATE grant on `payments`. ADR-025 reworks who may change `orders.status`. |

### ADR-001 — Supabase JS Client over an ORM
Status: Accepted. **B5 verdict: HOLDS** (table above). Context: MVP needs type-safe DB access without ORM overhead. Decision: Supabase JS Client + `supabase gen types` + Zod; no Prisma/Drizzle. Consequences: regenerate types every migration; RLS is the authorization layer.

### ADR-002 — Split payment, no custody
Status: **Superseded by ADR-016** (custodial payments per OD-8, 2026-07-23). **B5 verdict: SUPERSEDED (successor ADR-016).** Decision: 50% deposit (Instapay/VF Cash/Orange Cash) + 50% COD; two `payments` rows per order; BETK never holds funds. Consequences: manual seller confirmation; no gateway; wallet/escrow is post-MVP (C3 §8.4).

### ADR-003 — Phone OTP as sole auth
Status: **Superseded by ADR-008** (Google OAuth added per OD-4). **B5 verdict: SUPERSEDED (successor ADR-008).** Original: Supabase Auth phone OTP only; no passwords (R-A01).

### ADR-004 — tsvector full-text search (no external engine)
Status: Accepted. **B5 verdict: HOLDS.** Decision: Postgres tsvector + GIN + unaccent for 1–2 keyword Arabic search; no Elasticsearch/Typesense at MVP. Consequences: revisit > ~500K listings (C3 §8.1).

### ADR-005 — RLS-first authorization
Status: Accepted. **B5 verdict: HOLDS WITH AMENDMENT** — RLS-first holds; “43 tables” is now OD-20 = 51. Decision: RLS enabled + default-deny on all 43 tables; UI auth gates are UX only. Consequences: every table needs policies from day 1; helper functions must be indexed/SECURITY DEFINER.

### ADR-006 — Soft delete limited to listings
Status: Accepted. **B5 verdict: HOLDS.** Decision: `deleted_at` on listings only; append-only audit tables; status-hiding for suspensions. Consequences: order_items snapshot listing title/price.

### ADR-007 — Opus = architect/reviewer, Sonnet = builder (Cursor)
Status: Accepted. **B5 verdict: HOLDS WITH AMENDMENT** — the role split holds; “Opus 4.8 / Sonnet 4.6” is not a pinned model freeze. Decision: Per Dev OS Step 7, use Opus for architecture/security/review and Sonnet for routine implementation; current models Opus 4.8 / Sonnet 4.6. Consequences: cost/latency balance; reviewer pass is mandatory before merge.

### ADR-008 — Google OAuth added (supersedes ADR-003)
Status: Accepted (MVP Freeze 2026-06-13, OD-4). **B5 verdict: HOLDS.** Decision: sign-in via phone-OTP OR Google OAuth (Supabase Auth links identities). `users.phone_number` nullable+UNIQUE; add `users.auth_provider ('phone'|'google')`. R-A01 amended to "phone-OTP + Google OAuth; phone verification gated to transactions." A verified phone is required before checkout, becoming a seller, or payout (Server Action + RLS WITH CHECK). Consequences: easier sign-up (goal of OD-4) without losing COD/notifications/trust which depend on a verified phone; one extra enum + nullable phone; transaction gate must be tested.

### ADR-009 — users.deleted_at / anonymized_at added now (OD-2)
Status: Accepted (MVP Freeze 2026-06-13). **B5 verdict: HOLDS.** Decision: add two nullable timestamps to `users` during initial schema rather than later. MVP behavior = deactivate-only (login blocked when status≠active OR deleted_at set); anonymized_at reserved for post-MVP MW1. Consequences: avoids a future high-cost users migration; no added MVP behavior beyond deactivation.

### ADR-010 — GoTrue-canonical auth (Model A); otp_tokens = attempt-limiter, sessions = unused
Status: **Accepted** (Phase 02 / T01, 2026-06-24, Opus 4.8). **B5 verdict: HOLDS.** Supersedes the implicit "custom OTP" reading of C3 §8.2 for MVP. **Decision gate: T02–T06 build against this record.**

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
Status: Accepted 2026-07-01 (amends scope via OD-7; supersedes the earlier Arabic-only, single-`dir="rtl"` assumption). **B5 verdict: HOLDS.** Context: OD-7 makes BETK a bilingual Arabic/English, light/dark app over the existing frozen page inventory (see `BETK_UI_SPEC.md §3`), with no new pages/tables/content columns and no translation service. Decision: `next-intl` (v4) for the UI shell + `next-themes` for theming — the only two dependencies OD-7 adds, both presentation-layer only; locale as a path segment (`src/app/[locale]/`, `localePrefix: 'as-needed'` — Arabic unprefixed/default, English under `/en`); the single `<html>` (`dir`/`lang` derived from locale) lives in `src/app/[locale]/layout.tsx`; `next-themes` uses the class strategy (`attribute="class"`, `.dark`); the middleware composes next-intl's locale negotiation with the existing auth gate, normalizing locale BEFORE `gateFor()` runs so every gate verdict is locale-invariant; no schema change — shell chrome uses `next-intl` catalogs, structured lists keep existing `*_ar`/`*_en` columns, names/titles use a `COALESCE(locale column, other)` helper, and descriptions/bios render as-authored (no translation/fallback). Full decision record (routing, content model, consequences) lives in `BETK_ARCHITECTURE.md §9`, which this entry is the canonical registry record for — that section must cite **ADR-011**, never a second "ADR-002". Consequences: URLs stay stable for Arabic; English gains a `/en` mirror; schema change NO; new dependency = `next-intl` + `next-themes` only.

**Numbering-collision note (docs-hygiene, 2026-07-16):** this decision was originally mislabeled "ADR-002" directly in `BETK_ARCHITECTURE.md §9`, colliding with this file's own, unrelated ADR-002 ("Split payment, no custody"). Corrected to **ADR-011** (the next free slot in this registry — ADR-003 was already taken/superseded) as part of the R4 docs-hygiene batch; `ADR.md` is the single ADR registry, `BETK_ARCHITECTURE.md §9` now only cross-references it.

### ADR-012 — Seller-application submit is an atomic SECURITY INVOKER RPC (not sequential writes, not SECURITY DEFINER)
Status: **Accepted** (Phase 04 / T03, 2026-07-20, Opus 4.8). **B5 verdict: HOLDS.** This record constrains ADR-020..ADR-025: no `SECURITY DEFINER` RPC. Decision gate: the become-seller submit + all resubmission/store-write work builds against this record.

**Context.** Becoming a seller writes FOUR things: `betk.seller_profiles` (1:1 with `users.id`), `betk.stores` (1:1 with the seller), TWO `betk.seller_documents` rows (national-ID front/back), and the `betk.users.role` flip `buyer → seller`. PostgREST offers no client-side multi-table transaction, so the naive shape is a sequence of separate authenticated-client writes. Two failure modes make that shape unsafe: (1) **partial residue** — a `uq_stores_slug` (R-S02) collision on the store INSERT *after* the `seller_profiles` INSERT already committed leaves an orphan profile, and `seller_profiles` has **no DELETE policy** (compensation would require the service-role client, and any compensation is best-effort — a crash between steps still strands rows); (2) **the role-flip ordering risk** — `role='seller'` with no `seller_profiles` row strands the user at the middleware seller-gate (T02), so the flip must be LAST and the profile must exist first, *or the whole thing must be atomic*.

**Options evaluated.**
- **(a) Sequential authenticated-client writes + compensating cleanup.** Rejected: `seller_profiles` has no DELETE policy, so compensation needs service-role reach-around (bypasses RLS) and is still non-atomic (a crash mid-sequence leaves residue the compensation never runs for). Fails the "no partial residue" invariant.
- **(b-DEFINER) One `SECURITY DEFINER` RPC** taking the validated payload (search_path pinned, EXECUTE revoked from PUBLIC, granted to `authenticated` — the R2 pattern). Rejected for TWO reasons: (i) **it defeats the phone gate by construction** — `SECURITY DEFINER` bypasses RLS, so the RESTRICTIVE `seller_profiles_phone_gate` (OD-4 / REG-10) would NOT bite; honoring it would require a hand-rolled `phone_number IS NOT NULL` check inside the function, and a botched/omitted check silently defeats REG-10 in a definer context; (ii) **it adds a new security-advisor finding** — a `SECURITY DEFINER` function granted to `authenticated` triggers advisor **0029** (`authenticated_security_definer_function_executable`), which the "advisor-clean, no new findings" bar (R2 discipline) forbids. The decrement-stock precedent stays clean only because it is trigger-only and revokes EXECUTE from *all* roles; an rpc that authenticated must call cannot.

**Decision — (b-INVOKER): one atomic `SECURITY INVOKER` rpc, `betk.submit_seller_application(...)`.** A PL/pgSQL function runs inside PostgREST's per-request transaction, so all three of `seller_profiles` + `stores` + 2×`seller_documents` commit together or roll back together — the store-slug collision leaves **zero rows** (the no-partial-residue invariant, proven by the slug-collision integration test). Because it is `SECURITY INVOKER`, RLS is **not** bypassed: the RESTRICTIVE `seller_profiles_phone_gate` bites naturally on the first INSERT (OD-4 / REG-10 honored at the DB layer with **no** hand-rolled check), and `sp_insert` / `stores_insert` / `sdoc_own` WITH CHECKs enforce `id`/`seller_id = auth.uid()` ownership. The function `SET search_path = betk, public` (clears advisor 0011), and EXECUTE is revoked from PUBLIC + granted only to `authenticated`. Post-apply advisor sweep = byte-identical to baseline: the function appears in **neither** 0011 **nor** 0028/0029. Uniqueness is authoritative via 23505: the EXCEPTION handler translates `uq_stores_slug` → `BETK_SLUG_TAKEN` (field-level) and `seller_profiles_pkey`/`uq_stores_seller`/`uq_seller_doc_type` → `BETK_APPLICATION_EXISTS` (R-S01), re-raising so the transaction still aborts (no partial commit).

**The role flip stays OUT of the rpc — and runs LAST.** `betk.users` has no permissive UPDATE policy (REG-19 / ADR-010), so a `SECURITY INVOKER` function cannot update it anyway. The `submitSellerApplication` Server Action calls the column-scoped service-role helper `setUserRole(uid, 'seller')` (`src/services/authUsers.ts`) **after** the rpc commits — so the `seller_profiles` row provably exists before the flip (satisfies the ordering requirement) and the only `betk.users` write remains the trusted service-role path (REG-19). Residual (documented, benign + self-healing): if `setUserRole` fails after the rpc commits, the user has a pending application but `role='buyer'` (the *safe* strand direction — never `role='seller'` with no profile). A re-submit hits the rpc's `BETK_APPLICATION_EXISTS` guard, on which the action re-invokes `setUserRole` (idempotent heal) and routes to `/seller/status`.

**Consequences.** One additive migration (`20260720083710_seller_application_submit_rpc.sql`, MCP-applied, ledger 23→24 1:1, source-backfilled, advisor-clean). The action's upload step stays client-side (T04 ImageUploader writes the 2 ID files to the `docs` bucket under the caller's own prefix via T01 storage RLS *before* calling the action); the action receives storage PATHS and validates prefix ownership (`path`'s first folder = `auth.uid()`) server-side, never accepting a path outside the caller's prefix. Resubmission (T05) will reuse this rpc pattern or extend it for the `rejected → pending` transition; store-settings updates (T06/T07) are plain `stores_manage` UPDATEs, not this rpc.

### ADR-013 — Listing create/publish is a draft-first decomposition (NO rpc), not an atomic multi-table transaction
Status: **Accepted** (Phase 05 / T02, 2026-07-21, Opus 4.8). **B5 verdict: HOLDS.** Decision gate: the T02 write layer and all T03/T04/T05 consumers build against this record. **Outcome: NO rpc, NO migration.**

**Context.** A "full" listing touches three tables — `betk.listings` (the parent) plus N `listing_images` rows and N `listing_tags` rows. The ADR-012 precedent (seller-application submit) chose an atomic `SECURITY INVOKER` rpc because a partial write there is an *invalid, stranded* state (a `seller_profiles` row with no `stores` row leaves the user wedged at the seller-gate, and `seller_profiles` has no DELETE policy to compensate). T02 must decide whether listing creation carries the same invariant, or whether the ADR-012 machinery is unnecessary here.

**Decision — (a) DRAFT-FIRST DECOMPOSITION.** A create is a single-table INSERT of the listing as `status='draft'` — atomic on its own. Image and tag rows are added afterward as **independent, RLS-authorized single-row writes** (T01/REG-34 `listing_images_seller` / `listing_tags_seller`, FOR ALL, parent-scoped). **The key difference from ADR-012: a draft with partial (or zero) children is a fully VALID resting state**, not stranded residue — the seller is mid-edit, and the Listings Management "draft" tab is exactly where such rows live. Completeness is not a create-time invariant; it is a **publish-time** one. `publishListing` is therefore a validated single-table status UPDATE `draft→active` whose gate (`evaluatePublishRequirements`, R-L02/03/04 + R-S09) reads the current children/store state and refuses the transition until every requirement is met, returning the unmet checklist rather than throwing. Because every step is a single-table write already covered by existing RLS, **no cross-table transaction is needed, so no rpc and no migration land in T02** — the additive-migration authorization the Phase-05 pack conditionally granted for T02 goes unused (by design).

**Why (b) an INVOKER rpc was NOT needed.** Option (b) (mirror ADR-012 with a `create_listing(...)` rpc) was evaluated and rejected: it buys atomicity for an invariant that does not exist here. There is no "orphan" failure mode — a listing with no images is a legal draft, and a failed image INSERT after the listing INSERT simply leaves a draft the seller can add an image to later (the publish gate blocks going live regardless). Adding an rpc would introduce a new migration, a REG-32 types-regen cycle, and rpc-hardening surface to protect against a state that is not actually harmful. It is not justified.

**Media / images posture (T02 FLAG-1, deliberate).** `removeListingImage` deletes the `listing_images` ROW only (via `listing_images_seller` FOR ALL); the underlying storage OBJECT in the `media` bucket is **retained at its path** — the T01-verified store-avatar / R-S08 posture (media has **no** storage DELETE policy, by design). Image *replacement* is likewise row-remove + new-upload-to-a-new-path, never an in-place object overwrite or delete. No storage DELETE policy is improvised. A candidate orphaned-object cleanup job is a **post-MVP note, not built**. Each image action header states this retained-object posture.

**REG-15 (bilingual title) — schema half CLOSED here.** The create/edit Zod schema was authored in T02 (`src/validations/listings.ts`), so per REG-15 the title is **required in BOTH `titleAr` and `titleEn`** at the form/validation layer (`min(1)` each). `betk.listings.title_en` stays **NULLABLE in the DB — no schema change**; the bilingual requirement lives only at the Zod layer, and the T04 create/edit form mirrors this schema (single source of truth). Note the publish gate (R-L03) still keys on `title_ar` only; `title_en` is a form requirement, not a publish gate.

**R-L07 restock + R-L10 soft delete (app-layer, cited).** There is **no DB trigger** for restock — `updateStock` performs the R-L07 `sold_out → active` flip in the action when stock goes `>0` (returns `restocked: true`). R-L10 soft delete sets **both** `status='removed'` AND `deleted_at=now()`: `deleted_at IS NULL` keeps it out of public reads (a public 404), while `status='removed'` keeps it visible in the seller's "removed" tab and editable via owner reads; inventory excludes it. No seller-side restore (admin-only, Phase 14).

**Consequences.** Zero migrations, zero rpcs in T02 — a pure application-layer write layer over the T01 RLS foundation. Ownership is enforced twice (RLS `listings_seller`/children + a server-verified own-store pin, `resolveCallerStoreId`); no service-role. Every action Zod-validates before any DB call and returns a discriminated union (never throws to the client). Proven on staging: create→draft (+ search_vector trigger), service stock-strip (R-L09), image own-prefix/forbidden/limit + row-remove, publish happy + per-requirement block (incl. R-S09), soft-delete visibility split (R-L10), restock flip (R-L07), and cross-seller denial — 10/10, zero residue.

### ADR-014 — Inquiry creation is a single-table INSERT (no rpc, no migration); the opening message lives on `inquiries.buyer_first_message`
Status: **Accepted** (Phase 06 / T02, 2026-07-22, Opus 4.8). **B5 verdict: HOLDS.** Decision gate: the T02 messaging write layer and all T03/T04/T05 consumers + Phase 07 build against this record. **Outcome: NO rpc, NO migration.**

**Context.** The Phase-06 pack asked T02 to decide inquiry-creation shape against the ADR-012 (atomic INVOKER rpc) vs ADR-013 (draft-first decomposition) precedents. The expected shape was "single-table INSERT into `inquiries` + a first `inquiry_messages` row" — i.e. potentially TWO writes, which (mirroring ADR-012) would demand atomicity if an inquiry-with-zero-messages were an *invalid, stranded* state (and `inquiries` has **no DELETE policy** — ERD §3 row 51 DELETE = "—" — so a buyer could not compensate a stranded row). The deciding question: is an inquiry with zero `inquiry_messages` a valid resting state?

**The schema answers it.** `betk.inquiries.buyer_first_message` is **`TEXT NOT NULL`** (`BETK_DATABASE_SCHEMA.sql` L373). The buyer's opening message is captured *on the inquiry row itself* in the single `inquiries` INSERT — it is not a separate `inquiry_messages` row. `inquiry_messages` (L379) is the **reply thread**: the seller's reply is its first row. The composer fields from `BETK_UI_SPEC.md` L108-110 (`quantity`, `delivery_preference`, `special_requests`) are likewise columns on `inquiries` (L368-370), and `avg_response_hours` is defined as the gap between `inquiries.created_at` and the seller's first `inquiry_messages` reply (UI_SPEC L482) — all three facts confirm the opening lives on the parent row and the thread starts empty.

**Decision — (a) SINGLE-TABLE INSERT (ADR-013-class, degenerate to one write).** `createInquiry(listingId, message, …)` is one atomic `betk.inquiries` INSERT: `buyer_id = auth.uid()` (RLS `inq_insert` WITH CHECK), `store_id` resolved SERVER-SIDE from the listing (never client-supplied — the buyer reads the listing via `listings_public` and takes its `store_id`), `buyer_first_message = message`, optional `quantity`/`delivery_preference`/`special_requests`, `status` defaults `'open'`. **An inquiry with zero `inquiry_messages` IS a valid resting state** (buyer has sent, seller has not yet replied) — so there is no orphan/stranded invariant, no cross-table transaction, and therefore **no rpc and no migration**. T03/T04's `MessageThread` renders the opening bubble from `inquiries.buyer_first_message` (+ `created_at`, implicitly `sender_type='buyer'`) followed by the `inquiry_messages` rows.

**Why (b) an INVOKER rpc was NOT needed.** Option (b) (an ADR-012-style `create_inquiry_with_first_message(...)` INVOKER rpc writing `inquiries` + a first `inquiry_messages` row atomically) was evaluated and rejected. It buys atomicity for an invariant that does not exist: because `buyer_first_message` is NOT NULL, the opening is captured atomically by the single INSERT, so there is never an "inquiry with no opening message." Duplicating that opening into a first `inquiry_messages` row would be redundant, and an rpc would add a migration, a REG-32 types-regen cycle, and rpc-hardening surface for no benefit. This is the same reasoning as ADR-013 (do not add DB machinery for a non-existent failure mode); it does not resemble ADR-012 (whose `seller_profiles`/`stores` orphan genuinely strands the user with no DELETE-policy compensation).

**Consequences.** Zero migrations, zero rpcs. `createInquiry` is a server-verified single-table write over the T01 RLS foundation (`inq_insert`); no service-role; `requireActiveUser` gates it (NOT `requireVerifiedPhone` — inquiries are pre-transaction, ERD §1.2 gates only orders/seller_profiles/payouts). `last_message_at` is left at its INSERT default per REG-43 / DECISION 4 (derive-at-read). Proven on staging: create→readable-thread, both parties message, outsider denied, confirm happy + buyer-cannot-confirm + idempotent re-confirm. **Phase 06 / T05 exit-gate re-confirmation (2026-07-22, Opus):** the throwaway lifecycle E2E re-proved the single-table create + server-resolved `store_id` + the confirm→checkout state end-to-end on staging (zero residue). ADR-014 stands **Accepted, unchanged.**

### ADR-015 — Inquiry mark-as-read is a column-level GRANT + a receiver RLS policy (DECISION 3 REVISED; supersedes the T02 defer; not a broad grant, not a DEFINER rpc)
Status: **Accepted** (Phase 06 / T02-FIX, 2026-07-22, Opus 4.8). **B5 verdict: HOLDS.** Supersedes the T02 **DECISION 3 = (a) DEFER** design note (REG-42). Enabled by an **authorized ERD §3 row-52 amendment** (BETK_ERD.md §3, 2026-07-22, REG-42) — the human authorized the amendment; without it the defer would still stand.

**Context.** T01 pinned the unread mechanism as `inquiry_messages.is_read` (`BOOLEAN NOT NULL DEFAULT false`) and flagged **REG-42**: ERD §3 row 52 originally read UPDATE = "sender", so a RECEIVER could not flip `is_read` on the OTHER party's messages (integration-proven at T01: seller's UPDATE of the buyer's message → 0 rows) — yet the receiver is exactly who marks a message read. T02 could not stretch a cite (no ERD/UI_SPEC text distinguished content-edit from read-state rights), so it **deferred** (DECISION 3(a)): no `markInquiryRead`, no unread indicator. The amendment resolves the cite gap by recording that the row's "sender" wording described **content-edit** rights and that `is_read` is **definitionally receiver-driven** (a sender flipping read-state on their own message is a semantic no-op).

**Decision — (b) receiver write, made safe by a COLUMN-LEVEL GRANT + a receiver RLS policy (migration `20260722124510_inquiry_read_receipt_rls`).** Column safety and row safety are split across the two mechanisms Postgres provides:
- **Column safety = GRANT.** `REVOKE UPDATE ON betk.inquiry_messages FROM authenticated; GRANT UPDATE(is_read) ON betk.inquiry_messages TO authenticated`. An authenticated caller can now UPDATE **only** the `is_read` column — a `body`/content edit is **denied by the grant** (error `42501`, asserted in `inquiry.readReceipt.test.ts`), not merely filtered to zero rows. This also NARROWS the pre-existing sender policy `inq_msg_update` (sender content-edit becomes a no-op), which is the intended effect of the amendment. `service_role`/`postgres`/`anon` grants are untouched.
- **Row safety = policy.** A permissive `inq_msg_read_receipt` (`FOR UPDATE TO authenticated`) authorizes the row when the caller is a party to the parent inquiry **AND** `sender_id <> auth.uid()` (the receiver). OR-combined with `inq_msg_update` (sender), each party may write only the OTHER party's rows' `is_read`.

`markInquiryRead(inquiryId)` (server action, Zod-first, `requireActiveUser`, discriminated union, **no service-role**) flips `is_read=true` on every message in the inquiry not sent by the caller; idempotent (already-read → `{ ok:true, markedCount:0 }`); outsider → `not_found`. The three read queries surface `unreadCount` (inbox rows) / per-message `isRead` + thread `unreadCount` (thread).

**Why (a) DEFER was superseded.** The only blocker was the missing cite; the authorized amendment supplies it. Deferring further would ship a spec'd-but-dead unread column and no read receipts — a worse outcome now that the write is both authorized and provably safe.

**Why (c) a `SECURITY DEFINER mark_inquiry_read` rpc is STILL rejected.** A DEFINER function granted to `authenticated` reintroduces advisor **0029** (`authenticated_security_definer_function_executable`) — the exact finding **ADR-012** rejected DEFINER over. The GRANT+policy path is advisor-clean (0 new findings vs the post-T01 baseline of 13 `rls_no_policy` INFO). Rejected.

**Why NOT a broad receiver UPDATE grant/policy.** A general `FOR UPDATE` to the receiver without the column GRANT would expose `body` to the other party (message tampering). The column-level GRANT is what makes the receiver write safe; a broad grant is explicitly the non-sanctioned shape (a plain BEFORE UPDATE trigger rejecting non-`is_read` changes by a non-sender was the sanctioned fallback had the grant proven unworkable — it did not).

**Consequences.** One additive migration (ledger 27→28), no rpc, no DEFINER, no service-role, no new advisor finding. REG-42 CLOSED. Proven on staging (`inquiry.readReceipt.test.ts`, 10/10): receiver flips `is_read` both directions; receiver/sender `body` edit → `42501`; sender own `is_read` harmless; idempotent; outsider → not_found + 0 rows; anon → 0 rows; no DELETE; T01's 13 assertions unregressed (the one T01 assertion that encoded the now-closed REG-42 gap was revised to the amended behavior). **Phase 06 / T05 exit-gate re-confirmation (2026-07-22, Opus):** the lifecycle E2E re-proved receiver-flips-the-other-party's-`is_read` while the caller's OWN messages stay untouched (the `sender_id <> auth.uid()` half) live; DB live-state re-verified the column GRANT (`authenticated` = `is_read` only) + the `inq_msg_read_receipt` policy ERD-verbatim. ADR-015 stands **Accepted, unchanged.**

### ADR-016 — Custodial payments with platform commission (supersedes ADR-002)

> The registry is **append-only; supersede rather than edit** — so ADR-002 stays in place and gains a "Superseded by ADR-016" marker, mirroring the ADR-003 → ADR-008 precedent.

**Status:** Accepted (OD-8, 2026-07-23). Supersedes ADR-002. **B5 verdict: HOLDS WITH AMENDMENT.** Custody holds. The operative amendments are `BETK_MVP_SCOPE.md` §4.1: InstaPay-only buyer deposit, commission on subtotal only, one admin verification, no seller acceptance (AC-SEL-14 retired), courier-collected COD balance. Sentences below that keep seller acceptance, three buyer rails, or “table count 43 / page count 59” are historical and are not deleted.

**Context.** ADR-002 established a no-custody model: the buyer transferred the deposit directly to
the seller's own handle, and BETK never touched the money. That model gives BETK no leverage over
transaction completion, no commission mechanism, and no buyer protection beyond the dispute process —
in an informal-seller market where trust is the core product problem.

**Decision.** The buyer pays BETK. BETK settles to the seller net of a flat percentage commission
computed on `subtotal` and snapshotted onto the order at creation. Deposit verification is performed
by **admin** against a buyer-uploaded transfer screenshot (`payments.status`); order acceptance
remains the **seller's** act (`orders.status`). The seller's balance is **derived**, not persisted —
no wallet or ledger table.

**Consequences.**
- BETK takes legal custody of buyer funds (see OD-8 §11).
- Manual verification moves from seller to admin; `/admin/payments` becomes an operational surface.
- BETK becomes merchant of record with the courier (Phase 08).
- Three additive columns; no new table; table count 43 and page count 59 both hold.
- R-O04 (COD auto-confirm) is retired; R-O05's confirming actor becomes admin.
- Payment gateways, automated capture, and automated payouts remain out of scope — unchanged
  from ADR-002.
- A persisted ledger remains post-MVP (OD-8 §6).

### ADR-017 — `converted_to_order_id` is written by a SECURITY DEFINER AFTER-INSERT trigger

> Recorded **retroactively**. CORRECTION-01 §E1 confirmed Phase-07 T01 landed this object without an
> ADR; the decision existed only in the SESSION_CONTEXT contract block and the journal.

**Status:** **Superseded by ADR-025** (B5, 2026-09-22). The original decision is kept below and is not deleted. Landed in migration `20260723074953` (Phase 07 / T01, 2026-07-23). v2 checkout does not write `inquiries.converted_to_order_id` (R-O11). The column stays nullable for rows that already have it. The inquiry reaches a cart line through `cart_items.inquiry_id`.

**Context.** Checkout is buyer-driven, but `inquiries` UPDATE is restricted to store/admin
(`inq_update`, ERD §3 row 51). The buyer therefore cannot write `inquiries.converted_to_order_id`
when their order is created, and broadening the policy to admit a buyer UPDATE would violate the
ERD row and expose the whole inquiry row to buyer writes.

**Decision.** A hardened `SECURITY DEFINER` AFTER-INSERT trigger on `betk.orders` performs the write:
`search_path` pinned, `EXECUTE` revoked from `PUBLIC`/`anon`/`authenticated`.

**Distinction from ADR-012's rejection.** ADR-012 rejected a `SECURITY DEFINER` **rpc** because a
PostgREST-exposed DEFINER function is API-callable and trips advisor 0029. A trigger function is
never API-exposed and carries no such surface — confirmed by the post-migration advisor sweep, which
recorded zero new findings. The REG-43 rejection of a DEFINER trigger also does not apply: that was
DB machinery proposed for a read-ordering concern the query layer could already serve, whereas this
write is structurally unreachable through RLS.

**Consequences.** One permanent DEFINER object on the orders write path. Idempotency is
integration-proven. No broad buyer UPDATE policy on `inquiries` exists or is needed.

### ADR-018 — Checkout is an atomic SECURITY INVOKER RPC (`create_order_from_inquiry`)

> **Status: Superseded by ADR-025** (B5, 2026-09-22). Original text kept. The live object remains `betk.create_order_from_inquiry` until Stage C replaces it. Landed in migration `20260723140552_order_payment_write_layer_reg49` (Phase 07 /
> T02b, 2026-07-23, Opus 4.8). Drafted at T02a's read-first audit; accepted here once the rpc was built,
> the signature backfilled into `src/lib/supabase/types.ts` (REG-32; the MCP generator emits only the
> empty `public` schema, so the hand-maintained `betk` block is the source of record), and the write
> layer applied + advisor-swept (8/6/2/4/1 UNCHANGED). Companion decision **ADR-019** (below) records the
> three-layer write model landed in the same migration.

**Context.** A single checkout writes, in one logical act: `betk.orders` (1 row) + N `betk.order_items`
+ **exactly two** `betk.payments` rows (deposit + balance, `uq_payment_type_per_order`) + an initial
`betk.order_status_history` row. **AC-BUY-6 says an order is created ONLY from a seller-confirmed
inquiry and the create is ATOMIC.** T02 must decide the write shape against the two standing precedents:
ADR-012 (atomic `SECURITY INVOKER` rpc, chosen when a partial write is *invalid stranded residue*) vs
ADR-013 / ADR-014 (draft-first decomposition / single-INSERT, chosen when a partial write is a *valid
resting state*).

**The deciding question: is an order with no items / no payments a valid resting state?** No. Unlike a
`draft` listing with zero children (ADR-013 — a legal mid-edit state gated at publish time) or an
inquiry whose thread is empty because the opening lives in `inquiries.buyer_first_message NOT NULL`
(ADR-014 — degenerate to one INSERT), an order with zero `order_items` has nothing to fulfil and an
order with fewer than two `payments` rows has nowhere to pay — a broken, unusable record. And
`orders` **DELETE = "—"** (ERD §3 row 54; live: no DELETE policy), so a stranded order **cannot be
compensated** by the buyer, exactly the ADR-012 no-DELETE-policy condition. Decomposition therefore
does **not** survive AC-BUY-6 here; atomicity is required.

**Options.**
- **(a) Sequential authenticated-client writes + compensating cleanup.** Rejected: a failure after the
  `orders` INSERT (e.g. a `payments` INSERT error, or a crash between writes) strands an itemless /
  paymentless order with no DELETE policy to clean it up — compensation would need a service-role
  reach-around (bans RLS) and is still non-atomic. Fails the AC-BUY-6 invariant. (ADR-012 reasoning.)
- **(b) One `SECURITY DEFINER` rpc.** Rejected for the two ADR-012 / ADR-015 reasons: (i) it **defeats
  the verified-phone gate** — `orders_phone_gate` is a RESTRICTIVE INSERT policy; a DEFINER function
  bypasses RLS, so honoring OD-4 would require a hand-rolled `phone_number IS NOT NULL` check inside
  the function (a botched/omitted check silently defeats the gate); (ii) it trips security-advisor
  **0029** (`authenticated_security_definer_function_executable`) because `authenticated` must be able
  to call it — violating the standing advisor-clean bar.
- **(c) One atomic `SECURITY INVOKER` rpc — CHOSEN.** `betk.create_order_from_inquiry(...)` runs inside
  PostgREST's per-request transaction, so all writes commit or roll back together (the 23505 BETK-ref
  retry and any child-write failure leave **zero rows** — the no-partial-residue invariant). Because it
  is INVOKER, **RLS is not bypassed**: `orders_insert` (`buyer_id = auth.uid()`) + the RESTRICTIVE
  `orders_phone_gate` (verified phone, OD-4) + `order_items_insert` + the new `payments_insert` all bite
  **through the invoker as the buyer**, with **no hand-rolled checks**. `SET search_path = betk, public`;
  `REVOKE EXECUTE FROM PUBLIC`; `GRANT EXECUTE TO authenticated`. Advisor-clean (INVOKER → neither 0028
  nor 0029; search_path set → no 0011). Signature via **REG-32 CI-typegen — never hand-added**; budget
  the boundary-cast iteration. This is the ADR-012 pattern applied to checkout.

**Amounts are server-authoritative, never client-supplied.** The rpc resolves listing/store/price and
computes `subtotal` from `order_items.unit_price × quantity` server-side; `delivery_fee` and the BETK
deposit handles are read per **TRAP 1's resolution** (see below); `total_amount = subtotal +
delivery_fee` is validated by the live `chk_order_total` CHECK; the deposit/balance 50/50 split
(`deposit = round(total_amount/2, 2)`, `balance = total_amount − deposit`) is computed in SQL. Order
INSERTs `status='pending'`; **no auto-confirm**; `converted_to_order_id` is left to ADR-017's trigger.

**Commission is NOT computed in the rpc.** It is snapshotted by a hardened `SECURITY DEFINER` BEFORE
INSERT trigger on `orders` (TRAP 1, option i) — the buyer never reads `commission_rate_pct`. See the
companion decision below.

**Companion decision — ADR-019 (below, Accepted): the `payments` / `orders` UPDATE write-authorization
model** — the *three-layer actor↔column control* (column `REVOKE`/`GRANT` + a permissive row policy + an
`OLD`-aware `BEFORE UPDATE` trigger that RAISEs on illegal actor↔column / transition combinations), plus
the TRAP-1 commission `BEFORE INSERT` DEFINER trigger, plus the (now human-authorized) `admin_settings`
buyer-read broadening. These are distinct from checkout atomicity but co-land in the same migration, so
they are recorded as the separate ADR-019 (the substance of the T02a audit report + the T02b corrections).
PRECEDENTS.md row: *three-layer actor↔column write control*.

**Consequences (as landed).** One additive migration (`20260723140552`) carries the rpc + the REG-49
policies / grants / triggers; ledger 30→31; **security advisor UNCHANGED at 8/6/2/4/1** (INVOKER rpc +
policies on already-policied tables + search_path-pinned, EXECUTE-revoked DEFINER triggers add nothing —
0 new security findings). Performance advisor gained exactly the 5 findings its policies imply (4
`auth_rls_initplan` in the house bare-`auth.uid()` style, 1 `multiple_permissive_policies` on
`admin_settings {authenticated, SELECT}` = the intended REG-69 buyer-read broadening) — all attributed,
none unexplained. No service-role anywhere. **UNPINNED engineering decision (cite-or-flag):** nothing in
the frozen scope pins whether the flat delivery fee applies to pickup/remote; the rpc applies it
uniformly to all delivery methods (documented in the rpc header). **REG-32:** the MCP type generator
returns only the empty `public` schema, so the rpc signature was backfilled into the hand-maintained
`betk` block of `src/lib/supabase/types.ts` (`create_order_from_inquiry`, Returns `string`/uuid).

### ADR-019 — The `payments` / `orders` write-authorization model: three-layer actor↔column control + commission BEFORE-INSERT trigger + authorized `admin_settings` buyer-read broadening

> **Status: Accepted. B5 verdict: HOLDS WITH AMENDMENT.** The three-layer model holds. **ADR-021** amends the `payments` `authenticated` UPDATE grant: drop `proof_path` and `transfer_reference`. **ADR-025** amends `enforce_order_transition`: no seller acceptance; buyer cancel only before proof. The original grant list below is kept. Landed in the same migration `20260723140552_order_payment_write_layer_reg49`
> (Phase 07 / T02b, 2026-07-23, Opus 4.8). Companion to ADR-018 (checkout atomicity); recorded as ONE
> decision because the three concerns co-land and are jointly load-bearing for the custodial write path.
> `019` confirmed next-free (ADR-001…018 occupied). PRECEDENTS.md row: *three-layer actor↔column write
> control*.

**Context.** ADR-018 makes order *creation* atomic. It does not govern the subsequent *mutations* —
the buyer attaching a transfer proof, the admin confirming a deposit, the seller accepting / preparing,
the buyer cancelling while pending — nor the commission snapshot, nor the buyer's need to *read* BETK's
payment handles + the flat fee at checkout. `WITH CHECK` on a permissive policy cannot see `OLD`, so it
cannot express transition legality (pending→confirmed only) or actor↔column legality (only admin may
move `payments.status`; only the buyer may attach proof). A broad column grant would let any party
rewrite money columns; a `SECURITY DEFINER` mutation rpc granted to `authenticated` would trip advisor
0029 (the ADR-012/ADR-015 rejection). The three concerns are distinct from checkout atomicity but share
one migration and one authorization posture.

**Decision — three mechanisms, composed.**
1. **Three-layer actor↔column write control** (the load-bearing pattern, applied to both `payments`
   UPDATE and `orders` UPDATE):
   - **Layer 1 — column GRANT** (REG-42 pattern). `REVOKE UPDATE … FROM authenticated` then
     `GRANT UPDATE(<writable cols>)`. `payments` → `{status, confirmed_by, confirmed_at, notes,
     proof_path, transfer_reference}` **(amended by ADR-021: `authenticated` loses `proof_path` and `transfer_reference`; the buyer writes those on `master_orders`, and a DEFINER trigger copies them)**; `orders` → `{status, cancellation_reason}`. Money / identity /
     ref columns (`amount`, `payment_type`, `order_id`, `method`; `total_amount`, `subtotal`,
     `betk_ref`, `buyer_id`, `store_id`, `delivery_fee`, …) become **untouchable** — a forbidden write
     is `42501`, not a silent 0-row no-op. **F1:** `orders.cancelled_by` is deliberately **NOT** granted
     — it is trigger-stamped like `confirmed_at`.
   - **Layer 2 — permissive row policy** scoping the parties. `payments_update` = `is_admin()` OR
     buyer-of-parent (**the seller gets NO `payments` UPDATE**). `orders_update` = buyer own OR store OR
     `is_admin()` — **SUB-DECISION A:** admin is KEPT in the *policy* (ERD §3 row 54 "store/admin"
     verbatim) but DROPPED from the trigger's actor checks; the trigger, not the policy, scopes the
     Phase-07 transitions. Phase 14 amends the trigger for admin-forced cancellation.
   - **Layer 3 — `OLD`-aware `BEFORE UPDATE` DEFINER trigger** (search_path pinned, EXECUTE revoked
     PUBLIC/anon/authenticated; never PostgREST-exposed → no advisor 0028/0029). `enforce_payment_update`:
     admin-only columns require `is_admin()`; **F2** the ONLY legal status change is `pending→confirmed`
     (anything else — incl. admin reverting to pending or setting refunded/failed, which are Phase 10/14 —
     RAISEs `BETK_ILLEGAL_PAYMENT_TRANSITION`); proof-attach only on the caller's own pending deposit row.
     `enforce_order_transition`: **F1** cancel-metadata (`cancelled_by`/`cancellation_reason`) may change
     ONLY on a genuine `pending→cancelled` transition (`BETK_CANCEL_METADATA_FORBIDDEN` otherwise, guarded
     OUTSIDE the status branch); accept = store-only + the **AC-SEL-14 custodial gate** (deposit row
     `status='confirmed'`, DB-authoritative) + stamps `confirmed_at`; preparing = store-only; cancel =
     `pending`-only (R-O03) + buyer-only + stamps `cancelled_by='buyer'` (enum members verified live:
     `buyer,seller,admin,system`); everything else RAISEs.
2. **Commission snapshot via a `SECURITY DEFINER` `BEFORE INSERT` trigger on `orders`** (TRAP 1 (i);
   ADR-017 precedent — a trigger is never API-exposed, so no advisor 0029). Reads
   `admin_settings.commission_rate_pct` server-side (the buyer never reads the rate) and stamps
   `commission_rate` + `commission_amount = round(rate/100 * subtotal, 2)` (base = **subtotal**, never
   `total_amount`). **F5:** an ABSENT `commission_rate_pct` row RAISEs `BETK_COMMISSION_CONFIG_MISSING`
   (a missing key is a config fault, not 0%); an explicit `'0'` passes through as 0.
3. **Authorized `admin_settings` buyer-read broadening** (TRAP 1 (ii); **REG-69, STANDING**). A narrow
   `settings_payment_config_read` (`FOR SELECT TO authenticated`) over EXACTLY the 4 keys
   `{betk_instapay_handle, betk_vodafone_cash, betk_orange_cash, delivery_fee_flat_egp}`. `commission_rate_pct`
   and `return_hold_hours` are DELIBERATELY excluded. **REG-69 is standing:** the `key IN (…)` allow-list
   is LITERAL — it must NEVER become a prefix/pattern (`key LIKE 'betk_%'`) or a `NOT-IN`, and NO secret
   may EVER be stored under those 4 keys. This is the one broadening on an admin table; it was authorized
   by the human this session, not applied unilaterally.

**F3 (moderation_logs INSERT, #14-class, REG-68).** ERD §3 row 71 specs INSERT=admin; live only
`modlog_admin` (SELECT) existed (INSERT default-denied for everyone incl. admin). `moderation_logs.admin_id`
is `NOT NULL FK→users` (an actor column exists), so `modlog_admin_insert` pins
`WITH CHECK (is_admin() AND admin_id = auth.uid())` per the `inq_msg_insert` pinned-actor precedent — a
*tightening* (an admin cannot forge a log attributed to another admin), not a broadening.

**anon grant retention (ADR-015 precedent).** The pre-existing table-wide `UPDATE` grant to `anon` on
`orders`/`payments` is left in place (harmless: both new UPDATE policies are `TO authenticated`, RLS is
on, and `auth.uid()` is null for anon so it matches no row). **Recorded hazard:** any FUTURE `TO public`
UPDATE policy on these tables would inherit anon's column grant silently — such a policy MUST be
`TO authenticated` or must first re-scope anon's grant.

**Consequences.** One additive migration (shared with ADR-018). Security advisor UNCHANGED at 8/6/2/4/1
(0 new). Performance advisor +5, all attributed (see ADR-018 consequences). Two permanent `BEFORE UPDATE`
DEFINER triggers + one `BEFORE INSERT` DEFINER trigger on the order/payment write path, all
search_path-pinned + EXECUTE-revoked. No service-role. Grant-level denials (`42501`) and trigger RAISEs
are integration-proven, not asserted by row count. REG-49 CLOSED; REG-68 minted+CLOSED; REG-69 minted
STANDING.

### ADR-020 — Hide `seller_orders.delivery_fee` and `total_amount` from the whole `authenticated` role

**Status:** Accepted (B5, 2026-09-22). Implements the REG-90 grant. Columns stay stored (R-O14).

**Recommendation accepted.** No `authenticated` reader needs the stored columns. The buyer reads one combined delivery total from `master_orders` (`BETK_PRD.md` R-K03, R-O13, R-O28). Admin reconstructs a child’s total and fee from `payments`, which admin already may read. A security-definer view, a definer function, and a new table were rejected: advisor `security_definer_view`, ADR-012, and OD-20.

**Verification (1) — every operative PRD / UI spec read, and the other source.**

| Read | Source | Alternative |
|---|---|---|
| Seller never sees the fee or the order total | `BETK_PRD.md` R-V02, R-O28, R-K04, FR-SEL-14/15/17/18, AC-VIS-1; `BETK_UI_SPEC.md` seller deny-list and P38/P39/P41/P42 | Subtotal, commission, `refunded_subtotal`, and the derived net. The seller has no `payments` SELECT in the v2 map (ERD §8), so the seller cannot reconstruct the fee. |
| Buyer sees one combined delivery total and one order total, not the per-seller fee | `BETK_UI_SPEC.md` §4.j, checkout binding, order-detail data (`combined_delivery_total` once; child columns listed are `status`, `subtotal`, `display_ref`) | `master_orders.combined_delivery_total`. The order total is that figure plus the child subtotals. R-O28. |
| Admin order drawer shows the per-seller fee and the child total | `BETK_UI_SPEC.md` P55 | Admin reads `payments` (`payments_access` OR `is_admin()`, measured). Child total = deposit `amount` + balance `amount`. Fee = that sum − `subtotal`. `chk_order_total` is `total_amount = subtotal + delivery_fee` (measured). `payments.amount` is not in the `authenticated` UPDATE grant (ADR-019), and `refunded_amount` is a separate column (ERD §6.3), so a refund does not rewrite `amount`. |
| `platform_snapshots.gmv_egp` may be `SUM(total_amount)` | ERD §3.10 / §6.4 | The writer is cron, not `authenticated` (ERD §8). A role grant does not bind the table owner. |
| v1 checkout appendix still names `delivery_fee` and `total_amount` | `BETK_UI_SPEC.md` historical checkout block | Not an operative v2 read. The v2 checkout is the §4 / §5 pages above. `delivery_fee_flat_egp` is an `admin_settings` key, not this column. |

Live payments do not yet demonstrate the sum. Measured this session: `betk.orders` = 7 rows, `betk.payments` = 0 rows, so zero pairs exist to mismatch. The identity is the CHECK plus ADR-022, which Stage C writes. P55 displays the derived numbers and does not `SELECT` the two columns.

**Verification (2) — policies and functions.** The only `pg_policy` expression that contains the letters `delivery_fee` is `settings_payment_config_read` on `admin_settings` (`key = delivery_fee_flat_egp`). No `orders` policy USING or WITH CHECK names `delivery_fee` or `total_amount`. Measured `orders_access`, `orders_insert`, `orders_phone_gate`, `orders_update`: buyer / store / admin only. Across `betk`, `public`, and `betk_analytics`, the only function whose body names either column is `create_order_from_inquiry`. It does not use them in an UPDATE WHERE. No other function does.

**Verification (3) — checkout does not SELECT them.** Measured slice of `create_order_from_inquiry` (INVOKER, returns `uuid`): the fee is read from `admin_settings` into `v_fee`; `v_total` and the split are locals; the INSERT writes `delivery_fee` and `total_amount` from those locals; `RETURNING id` only. `chk_order_total` is a table CHECK. `set_order_commission_snapshot` is a DEFINER trigger (`prosecdef` true, `authenticated` EXECUTE false) and reads `subtotal`, not these two columns as a caller SELECT. INSERT privilege on `authenticated` is table-level (measured), so the INSERT does not need SELECT.

**Mechanism.** `authenticated` and `anon` both have table-level SELECT on `betk.orders` (measured `table_privileges`). A column-level REVOKE does nothing while that grant exists. The live counter-example is `inquiry_messages` (ADR-015): `authenticated` has no table-level UPDATE, and column UPDATE is `is_read` only. Stage C, on the renamed `seller_orders`: `REVOKE SELECT ON seller_orders FROM authenticated, anon`; then `GRANT SELECT (<every other column then present>) TO authenticated`. Do not grant those two columns back. Do not grant column SELECT to `anon`. `anon`’s table-level UPDATE on `orders` / `payments` is unchanged (ADR-019 hazard: a future `TO public` UPDATE policy would inherit it).

**Hazards (REG-92, open).** (i) `select *` or `RETURNING *` raises `42501` instead of omitting the columns, so every query lists columns. (ii) A column added later is invisible to `authenticated` until that migration grants it. The two hidden columns stay ungranted.

**ERD sentences amended in place.** “Buyer and admin may read” them was the open grant note (ERD §3.10, §6.2, §8). This record closes it: no `authenticated` role reads the stored columns. Admin display is the derivation above.

### ADR-021 — The buyer writes one proof on the master; a trigger copies it onto each deposit row

**Status:** Accepted (B5, 2026-09-22). Amends ADR-019’s `payments` grant. Does not supersede the three-layer model.

**Recommendation accepted.** The buyer writes `proof_path` and `transfer_reference` once, on `master_orders` (N22, R-O18, ERD §3.2). At the single admin verification (R-O19), a `SECURITY DEFINER` trigger, `search_path` pinned, EXECUTE revoked from `PUBLIC` / `anon` / `authenticated`, copies both onto every child deposit row and stamps `proof_snapshot_at`. That is the permitted DEFINER kind (ADR-012, ADR-017’s distinction): a trigger is not an RPC. The buyer no longer writes `payments.proof_path`.

**Live grant this amends.** `information_schema.column_privileges` for `betk.payments`, grantee `authenticated`, privilege `UPDATE`: `confirmed_at`, `confirmed_by`, `notes`, `proof_path`, `status`, `transfer_reference`. That matches ADR-019’s list `{status, confirmed_by, confirmed_at, notes, proof_path, transfer_reference}`. Stage C drops `proof_path` and `transfer_reference` from that grant. `status` stays, so admin confirmation is still an `authenticated` UPDATE, and the trigger performs the copy. `anon` still has table-level UPDATE on every `payments` column, including those two (measured). ADR-019’s recorded hazard stands: do not add a `TO public` UPDATE policy.

`master_orders` does not exist yet (measured: no relation). The buyer UPDATE of its proof columns is the ERD §8 three-layer path (`enforce_master_proof_update`), not a new table.

### ADR-022 — Master deposit rounding and largest-remainder child allocation

**Status:** Accepted (B5, 2026-09-22). **Closes REG-89.**

**Recommendation accepted.** One transfer covers the master (R-O18). `master_deposit = round(master_total / 2, 2)` with PostgreSQL `numeric` rounding (half away from zero; measured `round(10.005, 2) = 10.01`). Each child’s exact share is `child_total / 2`, floored to the piastre. Leftover piastres go one each to the children with the largest fractional remainders, tiebreak `seller_order` id ascending. `child_balance = child_total - child_deposit`.

**Three examples, computed in SQL this session.** Both invariants held on every row: `sum(child_deposit) = master_deposit`, and `child_deposit + child_balance = child_total`.

| Example | Child total | Remainder | Deposit | Balance |
|---|---|---|---|---|
| 1 odd piastre. Master 20.01, deposit 10.01, leftover 1 | 10.01 | 0.005 | 5.01 | 5.00 |
| 1 | 10.00 | 0 | 5.00 | 5.00 |
| 2 three-seller tie. Master 30.03, deposit 15.02, leftover 2. Equal remainders; the two lowest ids receive the piastre | 10.01 (id …bbb1) | 0.005 | 5.01 | 5.00 |
| 2 | 10.01 (id …bbb2) | 0.005 | 5.01 | 5.00 |
| 2 | 10.01 (id …bbb3) | 0.005 | 5.00 | 5.01 |
| 3 uneven. Master 175.03, deposit 87.52, leftover 1, given to the only non-zero remainder | 100.00 | 0 | 50.00 | 50.00 |
| 3 | 50.01 | 0.005 | 25.01 | 25.00 |
| 3 | 25.02 | 0 | 12.51 | 12.51 |

The checkout page shows the master 50% and does not encode the child allocation (`BETK_UI_SPEC.md` checkout binding). Stage C computes it inside `checkout_from_cart`.

### ADR-023 — Rate-lookup origin is `stores.governorate`

**Status:** Accepted (B5, 2026-09-22). **Closes REG-91.** The public origin-zone column was not needed.

**Recommendation accepted.** Origin for `courier_rates` is `stores.governorate`. The street never participates (R-V03, AC-VIS-2).

**Live evidence.** `stores.governorate` and `stores.city` exist (`varchar`). There is no street column on `stores`. `stores_public` is SELECT for an active store, the owner, or admin, with no column list, so governorate is already public. `store_pickup_addresses` does not exist yet. `create_order_from_inquiry` is INVOKER (`prosecdef` false), so it runs as the buyer and cannot read a table the buyer cannot select. ERD §8 buyer SELECT on `store_pickup_addresses` is none. The v2 checkout stays INVOKER (ADR-012, ADR-025), so it has the same limit. R-K02 is origin governorate × destination × weight. R-K05 is collection from the pickup address; that address is not the rate key.

**Edge, now closed.** `store_pickup_addresses.governorate` must equal `stores.governorate`, enforced by a trigger, not by a new column. A seller who ships from another governorate updates the store’s governorate (the public storefront zone and the rate origin are the same value). P27 still edits the pickup street on `store_pickup_addresses`. Its governorate is not an independent zone.

### ADR-024 — No courier principal; the handoff branch is not chosen

**Status:** Accepted (B5, 2026-09-22). Records both branches. **Does not pick one.**

**Principle, closed (REG-78, AC-COU-6, OD-17, N28).** The courier is not an app user, not a `user_role`, and not an RLS policy. There is no `courier_label_payload` function. The label is assembled from data an admin can already read: `master_orders` recipient snapshot and `store_pickup_addresses` (ERD §3.1, `BETK_UI_SPEC.md` P76). Shipment status writes stay admin.

**Branch 1 — admin-initiated handoff.** The admin server action reads under the admin session’s own RLS. No `SECURITY DEFINER`. No service role.

**Branch 2 — automated handoff with no admin session.** A server-side service-role read. Still no `SECURITY DEFINER`. AC-COU-6 still holds: the courier has no login.

Which branch ships is the courier gate (hard pre-launch, R-K09). This record does not choose the gate. **REG-78:** the principle stays closed; the mechanism stays open under that gate.

### ADR-025 — v2 checkout, stock, transition, and the inquiry link

**Status:** Accepted (B5, 2026-09-22). **Supersedes ADR-017 and ADR-018.** Decision level only. Stage C writes the SQL. ADR-012 holds: the checkout RPC is INVOKER. Stock and transition mutations that must bypass the caller’s RLS stay DEFINER triggers with `search_path` pinned and EXECUTE revoked, not RPCs.

**Checkout.** Live object replaced: `betk.create_order_from_inquiry(uuid, uuid, delivery_preference, payment_method) → uuid`. Measured: INVOKER, `search_path = betk, public`, EXECUTE true for `authenticated`, false for `anon`. One new atomic INVOKER rpc, `checkout_from_cart`, writes the master, N seller orders, items, a deposit row and a balance row per child, and decrements stock in that same transaction (OD-15, R-O12, R-L05). Fee and amounts are resolved in the function, never taken as client parameters (the same rule ADR-018 stated, now for the cart). It replaces `create_order_from_inquiry`. **N27:** ERD §4.1 — the live function names `buyer_id`, `delivery_address_id`, and `betk_ref`. Those columns stay. N27 copies existing rows onto a synthetic master; it does not call this rpc. Drop `create_order_from_inquiry` in the migration that adds `checkout_from_cart`, so two checkout paths do not both exist. Do not drop the three columns in front of that replacement.

**Stock.** Live object replaced: `decrement_stock_on_confirm()` / `trg_decrement_stock_on_confirm`. Measured: DEFINER, EXECUTE revoked from `anon` and `authenticated`, `AFTER UPDATE OF status` when `NEW.status = 'confirmed'`. Detach that trigger. Decrement inside `checkout_from_cart`. Restore on cancel or payment-window expiry. Do not restore on `returned` (R-L12). Out-of-stock escalation sets `stock_qty = 0` (R-L13). NULL stock stays untracked (R-L15). **N27:** ERD §4 says detach is a trigger drop and the rows stay. Detach the confirm trigger before any backfill UPDATE that would pass through `status = 'confirmed'`, or a historical confirmed row decrements stock again. The new decrement runs only for a new checkout.

**`enforce_order_transition`.** Live object reworked, not replaced by a second function: `enforce_order_transition()` / `trg_enforce_order_transition`, BEFORE UPDATE on `orders`, DEFINER, EXECUTE revoked (measured). Buyer cancel only while the master proof is null (REG-73, R-O03). No seller acceptance (`pending → confirmed` is admin release only; AC-SEL-14 stays retired). That one verification releases every child (R-O19). The seller’s only exit is escalation (OD-14, R-E01). Target table is ERD §7.1. **N27:** the live function reads `OLD.buyer_id`. The column stays, so this rework is not sequenced in front of a drop (ERD §4.1, §7.1). If a later task reopens that drop, rework the function first.

**`converted_to_order_id`.** Live object dropped: `set_inquiry_converted_order()` / `trg_set_inquiry_converted_order`. Measured: DEFINER, EXECUTE revoked, `AFTER INSERT` on `orders` when `inquiry_id` is not null. v2 checkout does not write the column (R-O11, ERD §6.3, §7). The inquiry feeds a cart line through `cart_items.inquiry_id`, copied onto `order_items.inquiry_id` (ERD §3.3). The column stays nullable. Rows that already point at an order keep the pointer; the FK stays NO ACTION. No new writer. **N27:** dropping the trigger does not require dropping the column or the FK (ERD §4). Rename of `orders` to `seller_orders` keeps that FK on the same relation.


# ADR.md — Architectural Decision Records
> `11-decisions/` home. One record per major technical choice. Append-only; supersede rather than edit.

### ADR-001 — Supabase JS Client over an ORM
Status: Accepted. Context: MVP needs type-safe DB access without ORM overhead. Decision: Supabase JS Client + `supabase gen types` + Zod; no Prisma/Drizzle. Consequences: regenerate types every migration; RLS is the authorization layer.

### ADR-002 — Split payment, no custody
Status: **Superseded by ADR-016** (custodial payments per OD-8, 2026-07-23). Decision: 50% deposit (Instapay/VF Cash/Orange Cash) + 50% COD; two `payments` rows per order; BETK never holds funds. Consequences: manual seller confirmation; no gateway; wallet/escrow is post-MVP (C3 §8.4).

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

### ADR-012 — Seller-application submit is an atomic SECURITY INVOKER RPC (not sequential writes, not SECURITY DEFINER)
Status: **Accepted** (Phase 04 / T03, 2026-07-20, Opus 4.8). Decision gate: the become-seller submit + all resubmission/store-write work builds against this record.

**Context.** Becoming a seller writes FOUR things: `betk.seller_profiles` (1:1 with `users.id`), `betk.stores` (1:1 with the seller), TWO `betk.seller_documents` rows (national-ID front/back), and the `betk.users.role` flip `buyer → seller`. PostgREST offers no client-side multi-table transaction, so the naive shape is a sequence of separate authenticated-client writes. Two failure modes make that shape unsafe: (1) **partial residue** — a `uq_stores_slug` (R-S02) collision on the store INSERT *after* the `seller_profiles` INSERT already committed leaves an orphan profile, and `seller_profiles` has **no DELETE policy** (compensation would require the service-role client, and any compensation is best-effort — a crash between steps still strands rows); (2) **the role-flip ordering risk** — `role='seller'` with no `seller_profiles` row strands the user at the middleware seller-gate (T02), so the flip must be LAST and the profile must exist first, *or the whole thing must be atomic*.

**Options evaluated.**
- **(a) Sequential authenticated-client writes + compensating cleanup.** Rejected: `seller_profiles` has no DELETE policy, so compensation needs service-role reach-around (bypasses RLS) and is still non-atomic (a crash mid-sequence leaves residue the compensation never runs for). Fails the "no partial residue" invariant.
- **(b-DEFINER) One `SECURITY DEFINER` RPC** taking the validated payload (search_path pinned, EXECUTE revoked from PUBLIC, granted to `authenticated` — the R2 pattern). Rejected for TWO reasons: (i) **it defeats the phone gate by construction** — `SECURITY DEFINER` bypasses RLS, so the RESTRICTIVE `seller_profiles_phone_gate` (OD-4 / REG-10) would NOT bite; honoring it would require a hand-rolled `phone_number IS NOT NULL` check inside the function, and a botched/omitted check silently defeats REG-10 in a definer context; (ii) **it adds a new security-advisor finding** — a `SECURITY DEFINER` function granted to `authenticated` triggers advisor **0029** (`authenticated_security_definer_function_executable`), which the "advisor-clean, no new findings" bar (R2 discipline) forbids. The decrement-stock precedent stays clean only because it is trigger-only and revokes EXECUTE from *all* roles; an rpc that authenticated must call cannot.

**Decision — (b-INVOKER): one atomic `SECURITY INVOKER` rpc, `betk.submit_seller_application(...)`.** A PL/pgSQL function runs inside PostgREST's per-request transaction, so all three of `seller_profiles` + `stores` + 2×`seller_documents` commit together or roll back together — the store-slug collision leaves **zero rows** (the no-partial-residue invariant, proven by the slug-collision integration test). Because it is `SECURITY INVOKER`, RLS is **not** bypassed: the RESTRICTIVE `seller_profiles_phone_gate` bites naturally on the first INSERT (OD-4 / REG-10 honored at the DB layer with **no** hand-rolled check), and `sp_insert` / `stores_insert` / `sdoc_own` WITH CHECKs enforce `id`/`seller_id = auth.uid()` ownership. The function `SET search_path = betk, public` (clears advisor 0011), and EXECUTE is revoked from PUBLIC + granted only to `authenticated`. Post-apply advisor sweep = byte-identical to baseline: the function appears in **neither** 0011 **nor** 0028/0029. Uniqueness is authoritative via 23505: the EXCEPTION handler translates `uq_stores_slug` → `BETK_SLUG_TAKEN` (field-level) and `seller_profiles_pkey`/`uq_stores_seller`/`uq_seller_doc_type` → `BETK_APPLICATION_EXISTS` (R-S01), re-raising so the transaction still aborts (no partial commit).

**The role flip stays OUT of the rpc — and runs LAST.** `betk.users` has no permissive UPDATE policy (REG-19 / ADR-010), so a `SECURITY INVOKER` function cannot update it anyway. The `submitSellerApplication` Server Action calls the column-scoped service-role helper `setUserRole(uid, 'seller')` (`src/services/authUsers.ts`) **after** the rpc commits — so the `seller_profiles` row provably exists before the flip (satisfies the ordering requirement) and the only `betk.users` write remains the trusted service-role path (REG-19). Residual (documented, benign + self-healing): if `setUserRole` fails after the rpc commits, the user has a pending application but `role='buyer'` (the *safe* strand direction — never `role='seller'` with no profile). A re-submit hits the rpc's `BETK_APPLICATION_EXISTS` guard, on which the action re-invokes `setUserRole` (idempotent heal) and routes to `/seller/status`.

**Consequences.** One additive migration (`20260720083710_seller_application_submit_rpc.sql`, MCP-applied, ledger 23→24 1:1, source-backfilled, advisor-clean). The action's upload step stays client-side (T04 ImageUploader writes the 2 ID files to the `docs` bucket under the caller's own prefix via T01 storage RLS *before* calling the action); the action receives storage PATHS and validates prefix ownership (`path`'s first folder = `auth.uid()`) server-side, never accepting a path outside the caller's prefix. Resubmission (T05) will reuse this rpc pattern or extend it for the `rejected → pending` transition; store-settings updates (T06/T07) are plain `stores_manage` UPDATEs, not this rpc.

### ADR-013 — Listing create/publish is a draft-first decomposition (NO rpc), not an atomic multi-table transaction
Status: **Accepted** (Phase 05 / T02, 2026-07-21, Opus 4.8). Decision gate: the T02 write layer and all T03/T04/T05 consumers build against this record. **Outcome: NO rpc, NO migration.**

**Context.** A "full" listing touches three tables — `betk.listings` (the parent) plus N `listing_images` rows and N `listing_tags` rows. The ADR-012 precedent (seller-application submit) chose an atomic `SECURITY INVOKER` rpc because a partial write there is an *invalid, stranded* state (a `seller_profiles` row with no `stores` row leaves the user wedged at the seller-gate, and `seller_profiles` has no DELETE policy to compensate). T02 must decide whether listing creation carries the same invariant, or whether the ADR-012 machinery is unnecessary here.

**Decision — (a) DRAFT-FIRST DECOMPOSITION.** A create is a single-table INSERT of the listing as `status='draft'` — atomic on its own. Image and tag rows are added afterward as **independent, RLS-authorized single-row writes** (T01/REG-34 `listing_images_seller` / `listing_tags_seller`, FOR ALL, parent-scoped). **The key difference from ADR-012: a draft with partial (or zero) children is a fully VALID resting state**, not stranded residue — the seller is mid-edit, and the Listings Management "draft" tab is exactly where such rows live. Completeness is not a create-time invariant; it is a **publish-time** one. `publishListing` is therefore a validated single-table status UPDATE `draft→active` whose gate (`evaluatePublishRequirements`, R-L02/03/04 + R-S09) reads the current children/store state and refuses the transition until every requirement is met, returning the unmet checklist rather than throwing. Because every step is a single-table write already covered by existing RLS, **no cross-table transaction is needed, so no rpc and no migration land in T02** — the additive-migration authorization the Phase-05 pack conditionally granted for T02 goes unused (by design).

**Why (b) an INVOKER rpc was NOT needed.** Option (b) (mirror ADR-012 with a `create_listing(...)` rpc) was evaluated and rejected: it buys atomicity for an invariant that does not exist here. There is no "orphan" failure mode — a listing with no images is a legal draft, and a failed image INSERT after the listing INSERT simply leaves a draft the seller can add an image to later (the publish gate blocks going live regardless). Adding an rpc would introduce a new migration, a REG-32 types-regen cycle, and rpc-hardening surface to protect against a state that is not actually harmful. It is not justified.

**Media / images posture (T02 FLAG-1, deliberate).** `removeListingImage` deletes the `listing_images` ROW only (via `listing_images_seller` FOR ALL); the underlying storage OBJECT in the `media` bucket is **retained at its path** — the T01-verified store-avatar / R-S08 posture (media has **no** storage DELETE policy, by design). Image *replacement* is likewise row-remove + new-upload-to-a-new-path, never an in-place object overwrite or delete. No storage DELETE policy is improvised. A candidate orphaned-object cleanup job is a **post-MVP note, not built**. Each image action header states this retained-object posture.

**REG-15 (bilingual title) — schema half CLOSED here.** The create/edit Zod schema was authored in T02 (`src/validations/listings.ts`), so per REG-15 the title is **required in BOTH `titleAr` and `titleEn`** at the form/validation layer (`min(1)` each). `betk.listings.title_en` stays **NULLABLE in the DB — no schema change**; the bilingual requirement lives only at the Zod layer, and the T04 create/edit form mirrors this schema (single source of truth). Note the publish gate (R-L03) still keys on `title_ar` only; `title_en` is a form requirement, not a publish gate.

**R-L07 restock + R-L10 soft delete (app-layer, cited).** There is **no DB trigger** for restock — `updateStock` performs the R-L07 `sold_out → active` flip in the action when stock goes `>0` (returns `restocked: true`). R-L10 soft delete sets **both** `status='removed'` AND `deleted_at=now()`: `deleted_at IS NULL` keeps it out of public reads (a public 404), while `status='removed'` keeps it visible in the seller's "removed" tab and editable via owner reads; inventory excludes it. No seller-side restore (admin-only, Phase 14).

**Consequences.** Zero migrations, zero rpcs in T02 — a pure application-layer write layer over the T01 RLS foundation. Ownership is enforced twice (RLS `listings_seller`/children + a server-verified own-store pin, `resolveCallerStoreId`); no service-role. Every action Zod-validates before any DB call and returns a discriminated union (never throws to the client). Proven on staging: create→draft (+ search_vector trigger), service stock-strip (R-L09), image own-prefix/forbidden/limit + row-remove, publish happy + per-requirement block (incl. R-S09), soft-delete visibility split (R-L10), restock flip (R-L07), and cross-seller denial — 10/10, zero residue.

### ADR-014 — Inquiry creation is a single-table INSERT (no rpc, no migration); the opening message lives on `inquiries.buyer_first_message`
Status: **Accepted** (Phase 06 / T02, 2026-07-22, Opus 4.8). Decision gate: the T02 messaging write layer and all T03/T04/T05 consumers + Phase 07 build against this record. **Outcome: NO rpc, NO migration.**

**Context.** The Phase-06 pack asked T02 to decide inquiry-creation shape against the ADR-012 (atomic INVOKER rpc) vs ADR-013 (draft-first decomposition) precedents. The expected shape was "single-table INSERT into `inquiries` + a first `inquiry_messages` row" — i.e. potentially TWO writes, which (mirroring ADR-012) would demand atomicity if an inquiry-with-zero-messages were an *invalid, stranded* state (and `inquiries` has **no DELETE policy** — ERD §3 row 51 DELETE = "—" — so a buyer could not compensate a stranded row). The deciding question: is an inquiry with zero `inquiry_messages` a valid resting state?

**The schema answers it.** `betk.inquiries.buyer_first_message` is **`TEXT NOT NULL`** (`BETK_DATABASE_SCHEMA.sql` L373). The buyer's opening message is captured *on the inquiry row itself* in the single `inquiries` INSERT — it is not a separate `inquiry_messages` row. `inquiry_messages` (L379) is the **reply thread**: the seller's reply is its first row. The composer fields from `BETK_UI_SPEC.md` L108-110 (`quantity`, `delivery_preference`, `special_requests`) are likewise columns on `inquiries` (L368-370), and `avg_response_hours` is defined as the gap between `inquiries.created_at` and the seller's first `inquiry_messages` reply (UI_SPEC L482) — all three facts confirm the opening lives on the parent row and the thread starts empty.

**Decision — (a) SINGLE-TABLE INSERT (ADR-013-class, degenerate to one write).** `createInquiry(listingId, message, …)` is one atomic `betk.inquiries` INSERT: `buyer_id = auth.uid()` (RLS `inq_insert` WITH CHECK), `store_id` resolved SERVER-SIDE from the listing (never client-supplied — the buyer reads the listing via `listings_public` and takes its `store_id`), `buyer_first_message = message`, optional `quantity`/`delivery_preference`/`special_requests`, `status` defaults `'open'`. **An inquiry with zero `inquiry_messages` IS a valid resting state** (buyer has sent, seller has not yet replied) — so there is no orphan/stranded invariant, no cross-table transaction, and therefore **no rpc and no migration**. T03/T04's `MessageThread` renders the opening bubble from `inquiries.buyer_first_message` (+ `created_at`, implicitly `sender_type='buyer'`) followed by the `inquiry_messages` rows.

**Why (b) an INVOKER rpc was NOT needed.** Option (b) (an ADR-012-style `create_inquiry_with_first_message(...)` INVOKER rpc writing `inquiries` + a first `inquiry_messages` row atomically) was evaluated and rejected. It buys atomicity for an invariant that does not exist: because `buyer_first_message` is NOT NULL, the opening is captured atomically by the single INSERT, so there is never an "inquiry with no opening message." Duplicating that opening into a first `inquiry_messages` row would be redundant, and an rpc would add a migration, a REG-32 types-regen cycle, and rpc-hardening surface for no benefit. This is the same reasoning as ADR-013 (do not add DB machinery for a non-existent failure mode); it does not resemble ADR-012 (whose `seller_profiles`/`stores` orphan genuinely strands the user with no DELETE-policy compensation).

**Consequences.** Zero migrations, zero rpcs. `createInquiry` is a server-verified single-table write over the T01 RLS foundation (`inq_insert`); no service-role; `requireActiveUser` gates it (NOT `requireVerifiedPhone` — inquiries are pre-transaction, ERD §1.2 gates only orders/seller_profiles/payouts). `last_message_at` is left at its INSERT default per REG-43 / DECISION 4 (derive-at-read). Proven on staging: create→readable-thread, both parties message, outsider denied, confirm happy + buyer-cannot-confirm + idempotent re-confirm. **Phase 06 / T05 exit-gate re-confirmation (2026-07-22, Opus):** the throwaway lifecycle E2E re-proved the single-table create + server-resolved `store_id` + the confirm→checkout state end-to-end on staging (zero residue). ADR-014 stands **Accepted, unchanged.**

### ADR-015 — Inquiry mark-as-read is a column-level GRANT + a receiver RLS policy (DECISION 3 REVISED; supersedes the T02 defer; not a broad grant, not a DEFINER rpc)
Status: **Accepted** (Phase 06 / T02-FIX, 2026-07-22, Opus 4.8). Supersedes the T02 **DECISION 3 = (a) DEFER** design note (REG-42). Enabled by an **authorized ERD §3 row-52 amendment** (BETK_ERD.md §3, 2026-07-22, REG-42) — the human authorized the amendment; without it the defer would still stand.

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

**Status:** Accepted (OD-8, 2026-07-23). Supersedes ADR-002.

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

**Status:** Accepted. Landed in migration `20260723074953` (Phase 07 / T01, 2026-07-23).

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

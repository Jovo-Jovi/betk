# PHASE_04_SELLER.md — Seller Onboarding & Store Management

> Step 15 task pack (BETK Dev OS). FR-SEL-1..2, 4..7: Onboarding (5-step), Application Status, Store Profile, Delivery, Returns, Payments — plus the minimal `/seller` landing shell.
> Generated 2026-07-19 by the Phase-03 review chat after Phase 03 sign-off.
> **Bilingual + themed (OD-7):** every page in this pack is authored AR-RTL + EN-LTR × light/dark from day one — `next-intl` namespaces both locales (Guard D parity), names via `localizedName` COALESCE, descriptions/bios as-authored, `.dark` via next-themes. Wherever this pack says "Arabic-first / RTL", read it as "+ EN shell + bilingual names + light/dark".
> **Design placement:** Option A holds — Phase 04 composes *real* Claude-Design components. Missing component/state → **STOP and flag to Claude Design** (T00 gate), never improvise styled UI in a feature folder.

---

## Phase scope & invariants

- **Surfaces (all under `src/app/[locale]/(seller)/seller/…` except onboarding entry):** `/seller/onboarding` (any authenticated user — becomes seller on submit), `/seller/status`, `/seller` (landing shell), `/seller/store`, `/seller/store/delivery`, `/seller/store/returns`, `/seller/store/payments`.
- **FR-SEL-3 (Dashboard KPIs) is NOT in this phase.** BETK_PHASES lists FR-SEL-3 under Phase 13 (snapshots/KPIs) while Phase 04's feature list omits it; the numeric range "FR-SEL-1..7" is reconciled in favor of the explicit feature lists. Phase 04 ships `/seller` as the UI-Spec **empty-state** landing only ("No activity yet — add your first listing" + CTA); Phase 13 fills the widgets. This reconciliation is recorded, not assumed silently.
- **Writes this phase:** seller application submit (`seller_profiles` + `stores` + 2 × `seller_documents` + `betk.users.role` flip), resubmission (MW2), store settings updates, storage uploads (ID docs, avatar/cover).
- **OD-4 transaction gate:** become-seller REQUIRES a verified phone. Consume the canonical `requireVerifiedPhone()` from `src/features/auth` (Phase 02 T07) — do NOT re-implement. The RESTRICTIVE `seller_profiles_phone_gate` RLS policy is the DB half; both halves must hold.
- **REG-19 standing:** ALL `betk.users` writes (the role flip) go through a column-scoped service-role helper keyed to the session-verified uid — no self-UPDATE policy exists and none is added.
- **PII discipline (national IDs):** `seller_documents` and the docs bucket are PRIVATE, always. No document content, storage path, or filename in logs, Sentry, PostHog, or error messages. Sentry stays id-only.
- **Compose, don't restyle.** `components/ui`/`components/shared` are Claude-Design-owned. Visual gaps → STOP-and-flag (T00/CD-DELTA-4), never patch in-repo.
- **Frozen scope (OD-1..7):** no new pages/tables/content columns. Additive migrations are authorized ONLY where this pack explicitly says so (T01), each via MCP `apply_migration` (REG-24) + local-file rename to the MCP-recorded version + ledger↔local 1:1 re-verify + `BETK_DATABASE_SCHEMA.sql` source backfill (R1/R2 discipline).
- **Binding rules carried from Phase 03:** no `loading.tsx` at any segment wrapping a `notFound()`-capable route (in-page Suspense + kit skeletons only); pre-check SELECTs are UX-only and the 23505 catch is the authoritative uniqueness guard; hard-404 checks are by status code, not content.
- **Seller pages are dynamic (authed)** — no ISR; standard `no-store` semantics via the cookie client.

## Data model (read before building)

- `seller_profiles` — id = `users.id` (1:1), `status` (pending → active / rejected / suspended / banned), `level` ('bronze' at creation), `submitted_at`, `approved_at`, `rejected_reason`. Live policies today: `sp_select` / `sp_update` + RESTRICTIVE `seller_profiles_phone_gate` on INSERT; **NO permissive INSERT (REG-10 — T01 closes it)**.
- `stores` — `seller_id` UNIQUE (R-S01), `slug` UNIQUE + URL-safe (R-S02), `slug_changed_at` (R-S03 change-once), `name_ar` NOT NULL, `name_en` nullable (COALESCE display set), `bio`, `category_primary`/`category_secondary` (**free-text columns, NOT FKs — Phase 03 T01 finding**; store the picker's chosen value as text per schema), `governorate`/`city`, `payment_methods` JSONB (`StorePaymentMethods`), `delivery_options` JSONB (`StoreDeliveryOptions` — REG-14), `return_policy` TEXT NULL, `avatar_url`/`cover_url`, `min_order_egp`, `status` (mirrors seller status; `stores_public` exposes active only).
- `seller_documents` — two rows per application: `doc_type` `national_id_front`/`national_id_back` (enum), `storage_path`, `review_status='pending'` (enum), retained on rejection (R-S08 / MW2).
- `categories` — read-only pickers (bilingual controlled list).
- **Storage (does not exist yet):** private docs bucket + public-read media bucket, names from `SUPABASE_DOCS_BUCKET` / `SUPABASE_MEDIA_BUCKET` env (currently optional + unset — T01 settles values with the human; never hardcode names in code).

## Business rules referenced

- **R-S01** one store per seller (DB UNIQUE on `seller_id`; 23505 authoritative).
- **R-S02** slug unique + URL-safe (DB UNIQUE; availability pre-check is UX-only — `stores_public` only exposes ACTIVE stores, so a pre-check can never see pending/suspended slugs; the 23505 catch is the real guard. Do not add a policy to widen slug reads).
- **R-S03** slug change once (`slug_changed_at`).
- **R-S04** store live only after approval — middleware already routes non-active sellers to `/seller/status`; approval itself is Phase 14 (admin).
- **R-S05** national ID front + back required to submit.
- **R-S08 / MW2** rejection retains documents; resubmission flow.
- **R-S09** ≥1 payment method required **to publish a listing** — the ENFORCEMENT point is the Phase 05 publish gate; Phase 04 ships the config page + the warning banner only.
- **R-M01** 24h approval SLA (displayed on the status page; enforcement is admin-side).
- **R-A01 (OD-4 amended)** verified phone before become-seller.

## Register items owned / corrected by this pack

- **REG-10** — permissive ownership INSERT on `seller_profiles` → **T01**.
- **REG-14** — `StoreDeliveryOptions.modes` vs the store-side enum (`self_deliver`/`bosta`/`pickup`/`remote`) → **verified in T01**, consumed in T07.
- **REG-15 — OWNER CORRECTION:** the bilingual-title Zod rule belongs to the **Phase 05 listing form** (FR-SEL-9), not Phase 04, per the BETK_PHASES feature split. T08 updates the register row; nothing in this pack implements it.
- ERD §3 13-table absent-policy map: none of Phase 04's tables are on it (`seller_profiles` INSERT = REG-10, already known). T01 re-verifies live state anyway before touching anything.

---

## Task list

| Task | Surface | Model | What |
|---|---|---|---|
| T00 | **Claude Design** (CD project, new chat) | — | CD-DELTA-3: Stepper + Phase-04 kit coverage gate |
| T01 | Cursor | **Opus** | DB & storage foundation (REG-10, stores INSERT verify, buckets + storage RLS, REG-14) |
| T02 | Cursor | **Opus** | Middleware onboarding gate + seller shell (ConsoleSidebar wiring) |
| T03 | Cursor | **Opus** | Onboarding queries + submit Server Action (ADR-012 atomicity decision) |
| T04 | Cursor | Sonnet | Onboarding wizard UI (5-step Stepper) |
| T05 | Cursor | Sonnet | Application status + resubmission (MW2) |
| T06 | Cursor | Sonnet | Store profile settings (slug change-once, avatar/cover) |
| T07 | Cursor | Sonnet | Delivery / Returns / Payments settings (3 forms, one window) |
| T08 | Cursor | **Opus** | Phase exit verification + consolidated PR |

Branch: `feature/phase-04-seller` cut from current `origin/main` (T01 step 0; fold in the owed `feature/phase-03-catalog` containment-check + delete). One task per Cursor window; commits per task, pushed after each PASS verdict; `main` untouched until the T08 gate PR. Migrations present → the R5 RLS-smoke job MUST fire on that PR.

---

## T00 — CD-DELTA-3: Stepper + kit coverage gate
- **Surface:** **Claude Design** (existing CD project, NEW chat) · **Source:** `BETK_DESIGN_BRIEF.md` (locked + addendum), `BETK_UI_SPEC.md §3` Seller Onboarding / Status / Store Settings screens
- **Why:** the DS-REGEN inventory has no `Stepper` (the 5-step wizard's spine), and the Phase-04 screens must be walked against the emitted kit BEFORE Cursor composes them, so gaps surface as one delta instead of five mid-task STOPs.
- **Prompt (paste in a new chat in the CD project; prepend the standing context line about emission conventions):**
```
CD-DELTA-3 — Phase 04 kit gate. Two parts; the attached BETK_DESIGN_BRIEF.md
(locked, addendum'd) remains the sole value source.

1. COVERAGE WALK (report first, before emitting anything): map every Phase-04
   screen — Seller Onboarding 5-step wizard, Application Status, /seller
   empty-state landing, Store Profile, Delivery Settings, Return Policy,
   Payment Methods — against the emitted shared kit + ui/* primitives. For each
   screen list: components it composes (exists ✓) and components/states it
   needs that do NOT exist. Expected known gap: Stepper. If the brief does not
   author an anatomy for a needed component, STOP on that item and ask the
   designer (generator rule) — do not invent anatomy.

2. EMIT (repo format, additive-only) after the walk is confirmed: Stepper.tsx
   (per the brief's authored anatomy or the designer's sign-off from part 1 —
   numbered steps, current/complete/upcoming states, labels as string props,
   RTL-canonical progression, both themes) + any other component the walk
   surfaced AND the designer signed off. Barrel delta strict-superset.
   Standing self-audit grep (white|black|#|rgb|hsl() — only hsl(var(--…))
   allowed) pasted per emitted file. Four-context verification per component.
   CHANGELOG-DELTA: signatures, message-key names for Cursor, sign-offs
   recorded. Zip the delta only.
```
- **Done when:** coverage report reviewed; every gap either emitted (signed off) or explicitly deferred with an owner; delta zip extracted to `docs/handoff/cd-delta-3/`. **Gate:** T04/T05/T06/T07 do not start until this lands (T01–T03 may run in parallel with it — no UI in them).

## T01 — DB & storage foundation
- **Model:** **Opus** · **Skill:** skill-supabase-engineer, skill-security-reviewer · **Source:** ERD §3 (seller rows), SECURITY_GUIDELINES (storage), REG-10/14/24
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 04 / T01 — DB & storage foundation.

STEP 0: git fetch; verify Phase 03's PR is merged into origin/main and
feature/phase-03-catalog is fully contained (git log origin/main..branch empty)
→ delete it local+remote. Cut feature/phase-04-seller from current origin/main.
Confirm base SHA.

STEP 1 — LIVE STATE FIRST (pg_policies via MCP execute_sql, read-only): paste
the current policy sets for seller_profiles, stores, seller_documents. Expected:
seller_profiles = sp_select + sp_update + RESTRICTIVE phone-gate, NO permissive
INSERT (REG-10); stores = stores_public + stores_manage (paste the exact
stores_manage predicate + which commands it covers); seller_documents = report
what exists. Compare each against the ERD §3 matrix rows VERBATIM.

STEP 2 — ONE additive migration restoring exactly what ERD §3 speccs and live
is missing (the #14/REG-29 class — completing planned work, not new access):
- seller_profiles: the permissive ownership INSERT (ERD-verbatim WITH CHECK,
  expected id = auth.uid()) — it COMBINES with the RESTRICTIVE phone-gate,
  which is the point (REG-10).
- stores / seller_documents: ONLY if step 1 shows an ERD-specced policy absent
  or a command uncovered (e.g. stores INSERT, seller_documents self INSERT/
  SELECT) — restore ERD-verbatim. If live already matches the ERD, touch
  NOTHING and say so. Paste old→new per policy.

STEP 3 — STORAGE (same or second migration, stated): confirm no buckets exist
(storage.buckets). Settle bucket NAMES with the human from
SUPABASE_DOCS_BUCKET / SUPABASE_MEDIA_BUCKET env (both currently optional/unset
— ask, do not invent or hardcode; then set .env.local + .env.example names).
Create: docs bucket PRIVATE (public=false, sensible file_size_limit +
allowed_mime_types for ID photos) + media bucket public-read. storage.objects
RLS: docs — INSERT own-prefix (first path folder = auth.uid()::text) +
SELECT own-prefix OR betk.is_admin(), NO public, NO UPDATE (re-upload = new
object or defined overwrite path — state which per the spec's resubmit flow);
media — public SELECT, INSERT/UPDATE own-prefix. Signed URLs are the read
mechanism for admin review (Phase 14 consumes).

STEP 4 — REG-14 VERIFY (read-only): compare src/types/jsonb.ts
StoreDeliveryOptions.modes against the store-side enum values
(self_deliver/bosta/pickup/remote) in the live schema + ERD. Report MATCH or
the exact drift; if drifted, fix the TYPE (types-only change, no schema) and
state it — REG-14 closes either way with evidence.

APPLY via MCP apply_migration (REG-24); rename local files to MCP versions;
ledger↔local 1:1 (paste count). Backfill everything into
BETK_DATABASE_SCHEMA.sql (new Storage section + amended policy blocks).
pg_policies after-state pasted. Integration tests (staging, seeded+cleaned):
phone-verified user CAN insert own seller_profiles row + phone-NULL user
CANNOT (proves permissive+restrictive combination); cross-user insert denied;
docs-bucket: owner uploads + reads own object, anon and another authed user
get NOTHING, admin path readable; media: public read works.
typecheck · lint · 4 guards · test:unit · build. Close-out → SESSION_CONTEXT
(REG-10 closed, REG-14 closed-with-evidence) + journal → commit + push. HOLD.
```
- **Done when:** REG-10 closed ERD-verbatim with the positive+negative proven; storage buckets + RLS live and negative-tested; REG-14 evidenced; ledger 1:1; source backfilled. No policy beyond what the ERD speccs.

## T02 — Middleware onboarding gate + seller shell
- **Model:** **Opus** (middleware = security-sensitive; BL-01 gate-regression discipline applies) · **Skill:** skill-security-reviewer, skill-nextjs-engineer
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 04 / T02 — middleware onboarding
gate + seller shell. Branch feature/phase-04-seller (continue).

A. MIDDLEWARE: today ALL /seller* requires role='seller', which locks buyers
out of /seller/onboarding (spec: "protected — becomes seller on submit").
Amend gateFor()/the seller branch so /seller/onboarding (both locales) requires
AUTHENTICATION ONLY; an existing seller hitting it redirects per their status
(active → /seller, else → /seller/status). Every other /seller* rule unchanged.
The phone gate is NOT enforced at the page (requireVerifiedPhone runs in the
T03 submit action + the page renders a phone-capture pointer for phone-NULL
users) — middleware stays role/status logic only, per the Phase-02 boundary.
GATE-REGRESSION TABLE (the BL-05 bar): paste verdicts for /seller,
/seller/status, /seller/onboarding, /admin, /account × {guest, buyer,
pending-seller, active-seller} × {AR, /en} — every pre-existing verdict must
be provably unchanged; only the onboarding rows may differ.

B. SELLER SHELL: wire ConsoleSidebar (seller variant) into
src/app/[locale]/(seller)/layout.tsx via an app-layer wrapper (AppChrome
pattern: @/i18n/navigation, callbacks, activePath; mobile behavior per the
component's open/onClose contract). Nav items = ONLY routes that exist now
(dashboard-landing, status, store + 3 sub-settings) from constants/routes —
later-phase routes are NOT added dead. Labels via a console.* (or extended
chrome.*) namespace BOTH locales — paste parity count. Zero ui/*/shared/*
edits (diff proof).

VERIFY: typecheck · lint · 4 guards · test:unit · build (both locales).
Runtime smoke: buyer reaches /seller/onboarding (200, both locales, correct
dir/lang, sidebar absent there per AuthShell layout); buyer hitting /seller →
unchanged prior verdict; pending seller → /seller/status with shell rendered.
Close-out → commit + push. HOLD.
```
- **Done when:** onboarding reachable by any authed user; all other gate verdicts byte-unchanged (table pasted); seller shell renders bilingual both themes; no dead nav items.

## T03 — Onboarding queries + submit action
- **Model:** **Opus** (multi-table write + role flip + phone gate = the phase's security core) · **Skill:** skill-security-reviewer, skill-supabase-engineer
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 04 / T03 — seller application
submit (queries + Server Action; UI is T04). Branch feature/phase-04-seller.

DECISION FIRST — ADR-012 (record in docs/02-architecture/ADR.md, next free
slot): the submit writes seller_profiles + stores + 2 seller_documents + the
betk.users.role flip. PostgREST gives no client-side multi-table transaction.
Evaluate (a) sequential authenticated-client writes with compensating cleanup
vs (b) one SECURITY DEFINER RPC (search_path pinned, EXECUTE revoked from
PUBLIC and granted to authenticated — the R2 hardening pattern) taking the
validated payload. Decide against the ARCHITECTURE/ADR precedents; the ROLE
FLIP ordering risk is decisive input: role='seller' with no seller_profiles
row strands the user at the middleware seller-gate, so the flip must be LAST
and the profile row must exist first — or the whole thing is atomic. State
the decision + rationale; if (b), it is an additive migration (MCP path,
ledger, source backfill, advisor-clean like R2).

ACTION submitSellerApplication (src/features/seller-onboarding/actions/,
"use server", Zod full-payload schema):
1. requireVerifiedPhone() FIRST (canonical gate — R-A05 order then phone;
   typed errors route to /blocked, /auth/phone, /auth/login).
2. Uploads: the 2 ID files land in the docs bucket under the user's own
   prefix via the authenticated client (T01 storage RLS) BEFORE row creation;
   the action receives storage paths, validates prefix ownership server-side,
   and writes seller_documents rows referencing them. Never accept a path
   outside auth.uid()'s prefix.
3. Creates seller_profiles (status='pending', level='bronze', submitted_at)
   + stores (validated slug, name_ar required / name_en optional, category
   text values from the picker, JSONB payment/delivery per the typed
   interfaces) + 2 seller_documents (front+back, review_status='pending').
4. Role flip LAST via a new column-scoped service-role helper
   setUserRole(id,'seller') in src/services/authUsers.ts (REG-19 pattern —
   sets ONLY role, keyed to the session-verified uid).
5. Uniqueness: slug 23505 → clean bilingual "slug taken" (field-level);
   seller_id 23505 / existing profile → R-S01 "application already exists"
   → route to /seller/status. Pre-checks are UX-only.
6. Sentry feature tag ('seller-onboarding', id-only) + PostHog
   seller_application_submitted. NO document paths in any log/event.
Queries: getOwnSellerApplication() (profile + store + documents under
self-scope RLS) for status/resume use.

TESTS (integration, staging, minted GoTrue users, seeded+cleaned): phone-NULL
user → PhoneRequiredError, ZERO rows created; happy path → exactly 1+1+2 rows
+ role='seller' + status='pending'; slug collision → clean error, no partial
residue (proves the ADR-012 mechanism's cleanup/atomicity); second application
→ R-S01 rejection; deactivated user blocked; cross-user isolation on
getOwnSellerApplication. check-zod-coverage green with the new action.
typecheck · lint · 4 guards · test:unit · build. Close-out (+ADR-012) →
commit + push. HOLD.
```
- **Done when:** ADR-012 recorded; phone gate proven at the action; happy path atomic-or-compensated with the no-partial-residue test; role flip last; 23505 paths clean; PII discipline holds.

## T04 — Onboarding wizard UI (5-step)
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer, skill-ui-engineer · **Source:** UI_SPEC Seller Onboarding, T00 Stepper
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 04 / T04 — onboarding wizard UI at
/seller/onboarding. Branch feature/phase-04-seller. Compose-only; T00 kit
(Stepper) + ImageUploader + ui primitives; missing state → STOP-and-flag.

Page (AuthShell-style layout per spec, not the seller sidebar): 5-step Stepper
— (1) Identity: store name_ar (required) + name_en (optional, COALESCE set) +
bio (as-authored, single language); (2) Category: primary + optional secondary
from the bilingual categories list + governorate/city (constants); (3) Payment
config: instapay_handle / vodafone_cash / orange_cash / cod_enabled (display
handles, not secrets — spec note rendered); (4) Delivery config: the 4 modes +
per-governorate est days + default fee (REG-14-verified shape); (5) National
ID front + back via ImageUploader → docs bucket own-prefix (T01/T03 path),
per-file retry, R-S05 both required. Slug picker with availability UX
pre-check (best-effort; 23505 from submit is authoritative — render its
field-level error). Per-step Zod (client mirror of the T03 schema slices);
final submit calls submitSellerApplication and routes to /seller/status.

RESUME: CONFIRM against UI_SPEC — per-step server persistence is NOT pinned
(only "resume incomplete wizard" as an edge). Implement client-state resume
within the session; do NOT invent draft rows. Flag the cross-session resume
question as a product decision in the close-out.

Phone-NULL users see the non-blocking capture pointer → /auth/phone (T07-auth
pattern) before the wizard advances to submit.

i18n: seller.onboarding.* namespace BOTH locales (paste parity count).
generateMetadata both locales. VERIFY: typecheck · lint · 4 guards ·
test:unit · build. Runtime smoke: wizard renders AR + /en, both themes wiring
intact; step validation blocks advance; uploader states render.
Zero ui/*/shared/* edits. Close-out → commit + push. HOLD.
```
- **Done when:** 5 steps compose the kit; AR-required/EN-optional naming; uploads own-prefix; slug UX + 23505 authoritative; resume behavior confirmed-not-invented; parity reported.

## T05 — Application status + resubmission (MW2)
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer, skill-supabase-engineer
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 04 / T05 — /seller/status +
resubmission. Branch feature/phase-04-seller.

Status page (seller shell): banner per seller_profiles.status (pending /
rejected + rejected_reason / suspended restricted view / approved CTA →
/seller), R-M01 24h SLA note, submitted_at display. Data via
getOwnSellerApplication (T03).

RESUBMIT (MW2, rejected only): CONFIRM the exact state semantics against
UI_SPEC + ERD before writing — R-S08 says previous documents are RETAINED on
rejection; determine from the schema whether resubmission INSERTs new
seller_documents rows (retention = old rows kept) or re-uploads to new
storage paths with new rows, and what flips status back to 'pending' +
refreshes submitted_at. STATE the confirmed model with citations; if the
docs do not pin it, STOP-and-flag — do not invent the state machine.
Implement per the confirmed model: re-upload via ImageUploader (own-prefix),
edit-store link (T06 page), resubmitSellerApplication action (Zod,
requireVerifiedPhone NOT re-required — already a seller — but R-A05 status
checks apply; rejected-only guard server-side).

TESTS (integration): rejected seller resubmits → status pending + new docs
per the confirmed model + old rows retained; non-rejected statuses cannot
resubmit; cross-user denied. i18n seller.status.* both locales (parity).
typecheck · lint · 4 guards · test:unit · build · runtime smoke both locales.
Zero ui/*/shared/* edits. Close-out → commit + push. HOLD.
```
- **Done when:** every status renders; resubmit follows a CITED state model (or STOPped); R-S08 retention proven; guards green.

## T06 — Store profile settings
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer, skill-supabase-engineer · **Source:** FR-SEL-4, UI_SPEC Store Profile
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 04 / T06 — /seller/store profile
settings. Branch feature/phase-04-seller.

Form (seller shell; own store via stores_manage RLS, authenticated client):
name_ar/name_en, bio, avatar upload (validate ≥200×200) + cover (≥1200×400)
→ MEDIA bucket own-prefix, store public URL on the row; category primary/
secondary (bilingual picker → text columns per schema); governorate/city;
min_order_egp (Zod numeric bounds).

SLUG CHANGE-ONCE (R-S03): slug editable ONLY while slug_changed_at IS NULL;
the update action sets slug + slug_changed_at=now() together, server-side
guarded (reject if already set — do not trust the UI lock); UI shows the
lock indicator once spent; 23505 → field-level taken error. CONFIRM whether
any DB-level guard (trigger/constraint) exists for R-S03 — if the app layer
is the only guard, STATE that as a finding for the register (candidate
hardening), do not add DB objects here.

updateStoreProfile action: Zod, own-row only (RLS enforced + server-verified),
Sentry/PostHog per pattern, save toast via Toaster. i18n seller.store.* both
locales (parity count). TESTS: own-row update works; cross-user denied by
RLS; second slug change rejected server-side; dimension validation.
typecheck · lint · 4 guards · test:unit · build · smoke both locales/themes.
Zero ui/*/shared/* edits. Close-out → commit + push. HOLD.
```
- **Done when:** profile edits under RLS; slug change-once enforced server-side with the app-only-guard finding recorded if true; media uploads validated; parity reported.

## T07 — Delivery / Returns / Payments settings
- **Model:** Sonnet · **Skill:** skill-nextjs-engineer · **Source:** FR-SEL-5/6/7, UI_SPEC (3 screens)
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 04 / T07 — the three store
settings pages. Branch feature/phase-04-seller. One window, three sibling
forms, one action file each (Zod, stores_manage RLS, own-row).

/seller/store/delivery: 4 mode toggles (REG-14-verified StoreDeliveryOptions
shape — consume the typed interface, no reshaping), per-governorate est days,
default fee; disabling ALL modes → warning (spec edge), still saveable if the
spec doesn't forbid it — state which. /seller/store/returns: return_policy
text editor, NULL allowed, placeholder template suggestion, "shown publicly on
your storefront" note (T06-Phase-03 accordion renders it). /seller/store/
payments: instapay/vodafone/orange handles + COD toggle; "add a payment
method to start selling" warning banner while all empty; R-S09 enforcement
itself is the Phase 05 publish gate — here it's config + banner ONLY (say so
in a code comment at the banner).

i18n: extend seller.store.* both locales (parity count). TESTS: each form
round-trips its JSONB/text under RLS; cross-user denied; delivery shape
matches the REG-14 interface exactly. typecheck · lint · 4 guards ·
test:unit · build · smoke: all three pages AR + /en, both themes wiring.
Zero ui/*/shared/* edits. Close-out → commit + push. HOLD.
```
- **Done when:** three forms persist their exact schema shapes; R-S09 banner present with enforcement explicitly deferred; parity reported.

## T08 — Phase 04 exit verification + consolidated PR
- **Model:** **Opus** · **Skill:** skill-security-reviewer, skill-ui-reviewer · **Source:** this pack's DoD + BETK_PHASES Phase 04 Acceptance
- **Prompt:**
```
Read SESSION_CONTEXT.md, then execute Phase 04 / T08 — exit verification +
consolidated PR. Verification + docs + PR; zero feature code changes (trivial-
and-safe fixes stated, else FLAG).

1. DoD LEDGER (PASS/FAIL per line): R-S01 one-store (second application
   blocked, 23505); R-S02 slug unique + URL-safe (Zod pattern + 23505); R-S03
   change-once (server-guarded second change rejected); R-S04 approval gates
   go-live (simulate approval via SERVICE-ROLE status flip in the test harness
   — legitimate test setup, admin UI is Phase 14 — then prove middleware
   routes the active seller to /seller and the store becomes publicly visible
   at /store/[slug]); R-S05 front+back required; R-S08 resubmit retains docs;
   R-S09 banner-only with enforcement deferred to Phase 05 (cited); OD-4
   phone gate proven at action + RLS levels; REG-19 role flip service-role
   column-scoped.
2. E2E-SHAPED INTEGRATION (staging, minted users, seeded+cleaned, zero
   residue pasted): fresh phone-verified buyer → submit application → rows
   1+1+2 + role flip → status pending → service-role approve → /seller
   reachable + storefront public → then negative sweep (phone-NULL, dup slug,
   dup application, cross-user reads/writes, doc-bucket anon+other-user
   denials, signed-URL read works).
3. DB LIVE STATE: pg_policies for the phase's tables match ERD-verbatim
   expectations; storage buckets + policies as T01 left them; migration
   ledger ↔ local 1:1 (paste count); no drift elsewhere vs the Phase-03 gate
   numbers.
4. BILINGUAL/THEME: every Phase-04 screen AR + /en spot-checked (dir/lang +
   keyed copy, no hardcoded literals — Guards C/D green); dark = wiring
   verified (interactive flip stays in the pre-launch Playwright basket);
   UI_SPEC acceptance matrix rows marked with the honest footnote.
5. REGISTER + DOCS: REG-10/14 closed with evidence; REG-15 row corrected to
   Phase 05; new findings minted (e.g. R-S03 app-only guard if T06 flagged
   it); Phase-05 ENTRY CHECKLIST written (REG-15 title rule; R-S09 publish
   gate consumes the payments config; listings_seller RLS expectations;
   low-stock DERIVED per OD-1). SECURITY_GUIDELINES storage section updated;
   PHASE_04 results tracker final; SESSION_CONTEXT + journal.
6. CI + PR: typecheck · lint · 4 guards · test:unit · full integration ·
   build. Push; open the consolidated PR feature/phase-04-seller → main
   ("Phase 04: Seller Onboarding & Store Management") — migrations present,
   so the RLS-smoke job MUST fire; report its trigger condition. DO NOT
   MERGE — hold for the review verdict.
```
- **Done when:** every DoD line has a verdict; the full onboarding→approval→public-storefront path is proven end-to-end on staging; register + entry checklist written; PR open with RLS-smoke firing; merge held.

---

## Definition of Done (phase)

- A phone-verified user completes the 5-step wizard and lands on `/seller/status` as a pending seller with exactly 1 `seller_profiles` + 1 `stores` + 2 `seller_documents` rows and `role='seller'` (flip last / atomic per ADR-012).
- A phone-NULL user cannot submit (action gate + RLS gate both proven); a deactivated/suspended user is blocked (R-A05).
- REG-10 closed ERD-verbatim; storage buckets live with negative-tested RLS; documents private end-to-end; REG-14 closed with evidence.
- Slug: unique, URL-safe, change-once server-enforced; all uniqueness authoritative via 23505.
- Rejected sellers resubmit per a **cited** state model with documents retained (R-S08).
- All store settings persist their exact schema shapes under `stores_manage`; R-S09 is configured + bannered here, enforced in Phase 05.
- Every screen bilingual (Guard D parity) + theme-wired; seller shell live; middleware gate-regression table clean.
- Migration ledger 1:1; schema source backfilled; consolidated PR open with the RLS-smoke job fired; `main` untouched until the gate verdict.

## Docs to update
`SECURITY_GUIDELINES` (storage + PII section) · `ADR.md` (ADR-012) · `BETK_DATABASE_SCHEMA.sql` (policies + storage backfill) · `SESSION_CONTEXT.md` · `DEVELOPMENT_JOURNAL.md` · `BETK_UI_SPEC.md` acceptance matrix · this pack's results tracker.

## Results tracker

| Task | Model | Status | Commit | Verdict | Notes |
|---|---|---|---|---|---|
| T00 CD-DELTA-3 | CD | — | — | — | |
| T01 DB+storage | Opus | ✅ DONE | `feature/phase-04-seller` | HOLD (review) | REG-10 closed (`sp_insert`) + REG-31 minted+closed (`stores_insert`) via `20260719133011`; `docs`/`media` buckets + storage RLS via `20260719133052`; ledger 20→22 (1:1); REG-14 MATCH (T07 = 3 toggles not 4); integration 7/7 + full CI green; advisor WARN `public_bucket_allows_listing` on media → **RESOLVED by T01-FIX (not carried)** |
| T01-FIX media listing hardening | Opus | ✅ DONE | `feature/phase-04-seller` | HOLD (review) | DB-only. Migration `20260719134903_media_select_own_prefix_rls`: DROP `media_public_select` (broad SELECT TO public) + CREATE `media_select_own_prefix` (SELECT TO authenticated, own-prefix); bucket stays `public=true`. Ledger 22→23 (1:1). Advisor `public_bucket_allows_listing` WARN GONE, no new findings. Media integration case extended (public-URL bytes load-bearing + `.list()` denials); full CI green. Boundary flag: per-object public read stays open on a public bucket (enumeration hardened, not object reads) |
| T02 middleware+shell | Opus | — | — | — | |
| T03 submit action | Opus | — | — | — | ADR-012 |
| T04 wizard UI | Sonnet | — | — | — | |
| T05 status+resubmit | Sonnet | — | — | — | |
| T06 store profile | Sonnet | — | — | — | |
| T07 settings ×3 | Sonnet | — | — | — | |
| T08 exit gate | Opus | — | — | — | |

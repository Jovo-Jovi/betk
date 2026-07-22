# PHASE 06 — Messaging & Inquiries

> Scope authority: `BETK_PHASES.md` Phase 06 = **FR-BUY-5 + FR-SEL-13 ONLY** — inquiries + inquiry_messages
> threads, confirm→checkout ENABLEMENT (the contract Phase 07 consumes; checkout itself is Phase 07),
> `avg_response_hours` update, notify ≤5s (R-N04, delivery = Phase-12 dependency).
> Acceptance (BETK_PHASES): confirmed inquiry enables checkout · response-time metric updates · unread state correct.
> Pages: `/inbox`, `/inbox/[id]` (buyer, protected) · `/seller/inbox`, `/seller/inbox/[id]` (seller shell).
> NOTHING ELSE: no order_messages (Phase 07), no notifications-table delivery (Phase 12), no realtime
> subscriptions unless `BETK_UI_SPEC.md` explicitly pins them (cite-or-flag; default = refresh/poll-free
> server-rendered state + `router.refresh()` after mutations, the T03-Phase-05 pattern).

## Binding rules (all standing rules apply; phase-specific highlights)
- Compose-only: zero `components/ui/*` / `components/shared/*` edits. The kit already carries the purpose-built
  `MessageThread` plus `Tabs`/`Alert`/`ConfirmDialog`/`SLABadge`/`EmptyState` — **no CD-DELTA expected this phase**.
  A visual gap → STOP-and-flag to Claude Design, never patch in-repo.
- Server Action imports by FILE PATH, never the feature barrel (barrel `next/headers` leak — T03/T04-Phase-05 precedent).
- No `loading.tsx` on any segment whose page calls `notFound()` (BL-01-FIX class); in-page `<Suspense>` only.
- Pre-checks are UX-only; DB constraints (23505 etc.) authoritative.
- Migrations: MCP `apply_migration` (REG-24) → local file named to the MCP version → ledger 1:1 re-verified →
  `BETK_DATABASE_SCHEMA.sql` backfill → advisor sweep vs baseline (0 new). Any rpc → REG-32 procedure
  (CI types-drift emits the signature; apply its printed diff verbatim, never hand-add).
- Any new ISR route: explicit locale threading (REG-40). (No ISR expected this phase — inbox pages are authed/dynamic.)
- OD-4 phone gate applies to orders/seller_profiles/payouts ONLY (ERD §1.2). Inquiries are pre-transaction —
  do NOT add `requireVerifiedPhone` to inquiry/message actions; `requireActiveUser` (R-A05) is the gate.
- No service-role in any inquiry/message read or write path — RLS self/thread scope is the authz boundary.
- Cite-or-flag: every schema fact (enum members, unread mechanism, `last_message_at` maintenance,
  `converted_to_order_id` semantics) is cited from `BETK_DATABASE_SCHEMA.sql` + live DB, never assumed.
- i18n: new keys under `inbox.*` (buyer) and `seller.inbox.*`; reuse `common.*`/existing keys where they fit;
  parity guard must stay green. Windows/PowerShell, no `&&`. Human opens + merges the consolidated PR.

## Register plan
- **REG-41 — RESERVED for T01:** `inquiries` seller-side/admin SELECT + buyer INSERT + store/admin UPDATE and the
  FULL `inquiry_messages` policy set (thread parties SELECT/INSERT, sender UPDATE, no DELETE) are ERD §3-specced
  (rows: `inquiries` = "buyer or store or admin / buyer / store-admin / —", basis `inq_buyer`;
  `inquiry_messages` = "thread parties / thread parties / sender / — via inquiry") but ABSENT live — 5th instance
  of the #14 / REG-29 / REG-31 / REG-34 class. Do NOT mint REG-41 elsewhere.
- Further mints (e.g. an `avg_response_hours` deferral, an unread-mechanism gap) start at **REG-42+**.
- Closes/updates owed at T05: REG-41 closed ERD-verbatim; Phase-06 entry checklist all-✅; Phase-07 entry
  checklist written (REG-09 orders INSERT + order-children policies + checkout consumes the T02 confirm contract
  + `requireVerifiedPhone` at checkout + `converted_to_order_id` write ownership).

## Task table
| Task | Executor | Model | Scope |
|---|---|---|---|
| T00 | Cursor | Sonnet | Post-Phase-05 housekeeping + branch cut + commit this pack |
| T01 | Cursor | **Opus** | DB & RLS foundation (REG-41) + contract pinning (confirm state, unread, metric) — read-first, one migration |
| T02 | Cursor | **Opus** | Messaging write layer: queries + Server Actions + the confirm→checkout transition + `avg_response_hours` decision (ADR-014 candidate) |
| T03 | Cursor | Sonnet | Buyer inbox `/inbox` + `/inbox/[id]` + listing-detail Inquiry CTA wiring |
| T04 | Cursor | Sonnet | Seller inbox `/seller/inbox` + `/seller/inbox/[id]` + confirm UI + nav |
| T05 | Cursor | **Opus** | Exit verification + E2E inquiry→confirm + consolidated PR prep |

---

## T00 — Housekeeping + branch cut (Sonnet)
```
Read SESSION_CONTEXT.md, then execute Phase 06 T00 — post-Phase-05 close + branch cut.
Docs + git only; zero src/ changes.
1. git checkout main → git pull; confirm the PR #46 merge commit is present; record its SHA.
2. Containment: git log origin/main..feature/phase-05-listings MUST be empty (local + remote refs).
   If NOT empty → STOP and report, delete nothing. If empty → delete the branch local + remote.
3. SESSION_CONTEXT.md: Phase 05 marked MERGED + SIGNED OFF @ <SHA> (PR #46, 10/10 checks incl. the R5
   RLS-smoke job FIRED + passed on migration 20260721111355 — record that the R5 gate is now proven live);
   branch deleted; correct the stale "Next task"/phase-pointer lines that still say Phase-05 T03/T06 NEXT;
   flip "Next task" → Phase 06 per PHASE_06_MESSAGING.md (FR-BUY-5 + FR-SEL-13 only). Journal append.
   Commit "docs: Phase 05 merged + signed off; Phase 06 next" → push main.
4. git checkout -b feature/phase-06-messaging from the fresh main tip → push -u.
5. Add docs/10-ai-development/phase-packs/PHASE_06_MESSAGING.md (this file) on the branch if untracked →
   commit "docs: commit Phase-06 pack" → push.
6. Report: merge SHA, containment, branch states, pack status. STOP — no Phase-06 task.
```
**Done when:** merge SHA recorded; `feature/phase-05-listings` gone both sides; SESSION_CONTEXT drift lines
corrected; `feature/phase-06-messaging` tracking; pack committed.

## T01 — DB & RLS foundation + contract pinning (Opus)
```
Read SESSION_CONTEXT.md, then execute Phase 06 T01 — inquiry RLS (REG-41) + contract pinning.
Branch feature/phase-06-messaging. Opus. READ-FIRST, then ONE additive migration.

STEP 1 — READ-ONLY STATE (MCP execute_sql; paste evidence):
(a) pg_policies for inquiries + inquiry_messages vs ERD §3 (expect: inquiries = inq_buyer SELECT only;
    inquiry_messages = zero policies). Quote inq_buyer's actual USING clause — determine whether it already
    OR-covers store/admin or is buyer-only; do not assume.
(b) CITE from BETK_DATABASE_SCHEMA.sql + live pg_enum/information_schema:
    - the inquiry status enum: exact name + members. The CONFIRM→CHECKOUT CONTRACT = the member that marks
      a seller-confirmed inquiry. If no member plausibly means "confirmed" → STOP and flag (do not invent).
    - the UNREAD mechanism: which column(s) on inquiries/inquiry_messages carry read state (e.g. is_read /
      unread counts / read_at). If NONE exists → STOP-and-flag with a REG-42 candidate + a proposed
      derivation (unread = messages newer than the caller's last own message is NOT valid without a spec
      cite — flag, don't improvise).
    - last_message_at: confirm the column + whether ANY trigger maintains it (expect none → app-layer write
      in T02, stated).
    - converted_to_order_id: confirm the column + FK; Phase 06 NEVER writes it (Phase-07 checkout owns the
      write) — record as part of the contract.
    - avg_response_hours (seller_profiles): re-confirm no trigger/function maintains it (T06-Phase-05
      already verified; re-cite).

STEP 2 — MIGRATION (mint REG-41, ERD §3 row-verbatim, additive only):
- inquiries: buyer INSERT (WITH CHECK buyer_id = auth.uid(), phone gate NOT added — ERD gates only
  orders/seller_profiles/payouts); store/admin SELECT if not already OR-covered by inq_buyer (additive
  second permissive policy preferred; never DROP inq_buyer); store/admin UPDATE (the confirm transition
  surface — scope via my_store_id() OR is_admin(); no bare auth.* beyond the helpers/auth.uid() patterns
  already used, consistent with existing policy style; REG-36 wrap stays that batch's, not smuggled here).
- inquiry_messages: thread-parties SELECT + INSERT (participant = the parent inquiry's buyer_id OR the
  parent inquiry's store via my_store_id() OR is_admin(); INSERT additionally pins sender to the caller);
  sender UPDATE (own rows only — the read-state/unread column per STEP 1(b), if that's where it lives);
  NO DELETE (ERD).
- No other table touched. order_messages stays Phase 07. notifications stays Phase 12.
Apply via MCP → local file to MCP version → ledger 26→27 1:1 → schema-source backfill → advisor sweep =
exact baseline, 0 new.

STEP 3 — INTEGRATION (staging, minted + cleaned, zero residue):
Both-direction proofs: buyer creates own inquiry + reads it; owning seller reads the same inquiry;
UNRELATED seller/buyer read → zero rows; anon → zero rows; both parties INSERT messages into their thread;
outsider message INSERT denied; sender-only UPDATE holds (other party's update → 0 rows); no DELETE path;
seller UPDATE on inquiry status allowed, buyer UPDATE on status denied (ERD: UPDATE = store/admin).

VERIFY: full CI (typecheck · lint 0 new · 4 guards · unit · build) + integration N/N + ledger + advisor.
CLOSE: REG-41 minted + closed ERD-verbatim in SESSION_CONTEXT; the pinned CONTRACT block (confirm member,
unread mechanism, last_message_at ownership, converted_to_order_id = Phase-07-write) recorded verbatim in
SESSION_CONTEXT for T02–T05 + Phase 07 to cite. Commit + push. HOLD — do not start T02.
```
**Done when:** REG-41 closed both-direction-proven; ledger 27/27; advisor baseline; contract block recorded
with citations (or STOPs raised); `restock_alerts`/`order_messages`/`notifications` untouched.

## T02 — Messaging write layer (Opus)
```
Read SESSION_CONTEXT.md, then execute Phase 06 T02 — queries + Server Actions.
Branch feature/phase-06-messaging. Opus. Cite T01's CONTRACT block throughout.

DECISION 1 (record in ADR.md as ADR-014 if a real alternative exists, else a cited design note):
inquiry creation shape. Expected: single-table INSERT into inquiries + first inquiry_messages row.
If that is two writes, decide decomposition vs rpc AGAINST the ADR-012/ADR-013 precedents: is an
inquiry-with-zero-messages a valid resting state? If NO (spec implies every inquiry opens with a message),
atomicity matters → SECURITY INVOKER rpc (ADR-012 pattern, REG-32 types procedure, EXECUTE authenticated-only);
if YES, draft-first decomposition (ADR-013 pattern). Decide from the UI_SPEC's composer shape — cite it.

DECISION 2 — avg_response_hours (entry-checklist item, REG-26-class):
Option A: app-layer recompute inside the seller reply action (UPDATE seller_profiles.avg_response_hours for
the caller's own profile — check whether sp_update RLS permits the caller's own row; if it does NOT cover
this column path, do NOT reach for service-role: flag + defer). Formula must be cited from PRD/UI_SPEC if
pinned; if no formula is pinned anywhere, a simple running metric is an ENGINEERING choice — state it
explicitly as such in the action header + ADR/design note. Option B: formally defer — mint REG-42, render
the static/NULL value. Pick ONE, record WHY.

ACTIONS (src/features/messaging/actions/, "use server", Zod-before-DB, discriminated unions, no throw to
client, no service-role, requireActiveUser NOT requireVerifiedPhone):
- createInquiry(listingId, message) — buyer; resolves the listing's store server-side (never client-supplied
  storeId); per DECISION 1; sets last_message_at (app-layer, T01-cited).
- sendInquiryMessage(inquiryId, body) — either party; RLS thread scope + server-verified participation;
  updates last_message_at; if DECISION 2 = A and the sender is the seller and this is their first reply,
  the metric update rides here.
- markInquiryRead(inquiryId) — per the T01-cited unread mechanism ONLY (if T01 flagged it absent, this
  action is NOT built — the flag stands).
- confirmInquiry(inquiryId) — SELLER ONLY: own-store pin + RLS; transitions status to the T01-cited
  confirmed member; idempotent (already-confirmed → typed already_confirmed); does NOT touch
  converted_to_order_id (Phase 07). THIS IS THE CHECKOUT-ENABLEMENT WRITE — header comment says so and
  points Phase 07 at it.
- Additional status transitions (decline/close) ONLY if the enum + UI_SPEC pin them — cite-or-omit.
R-N04: at message-send + confirm, capture the PostHog event + a code comment citing R-N04 with delivery
deferred to Phase 12 (notifications infra). NO notifications-table writes, NO WhatsApp/email sends.

QUERIES: getOwnInquiries (buyer, last_message_at DESC, unread state per contract), getInquiryThread
(participant-scoped, messages ASC, 404-null for outsiders), getStoreInquiries (seller, status filter),
lean + typed, injectable client param (T01-Phase-03 convention).

TESTS: unit (any pure rules) + integration on staging, zero residue: create→thread; both parties message;
outsider denied; confirm happy + buyer-cannot-confirm + idempotent re-confirm; unread flips if built;
metric updates if DECISION 2 = A. Full CI green. Docs: ADR/design note + SESSION_CONTEXT + journal.
Commit + push. HOLD — do not start T03.
```
**Done when:** both decisions recorded with reasoning; confirm transition proven both directions;
no service-role; no phone gate; R-N04 event-only with Phase-12 pointer; CI + integration green.

## T03 — Buyer inbox (Sonnet)
```
Read SESSION_CONTEXT.md, then execute Phase 06 T03 — /inbox + /inbox/[id].
Branch feature/phase-06-messaging. Sonnet. Compose-only.

- /inbox: thread list from getOwnInquiries — listing thumb + localizedName COALESCE title, store name,
  last message preview, last_message_at, unread indicator (per contract; omit if T01 flagged absent —
  state it), status badge (StatusBadge with string-prop labels). Empty state via EmptyState. Pagination
  only if the query layer pages (follow T02's shape; do not invent).
- /inbox/[id]: getInquiryThread; outsider/unknown/malformed id → hard notFound() (NO loading.tsx on the
  segment); compose the shared MessageThread AS-IS (string props, own/other alignment per its API) + a
  composer client component calling sendInquiryMessage (file-path import) + router.refresh() on success;
  mark-read on view if the mechanism exists.
- CONFIRMED-STATE CTA: when status = the confirmed member, render the "proceed to checkout" banner as
  GUIDANCE-ONLY (no link — /checkout is Phase 07; dead-link rule; /seller-landing precedent). Code
  comment: Phase 07 wires routes.checkout here.
- LISTING-DETAIL WIRING: ListingActionButtons' Inquiry CTA (login-redirect entry point since Phase-03 T05)
  now routes an AUTHED buyer into the real flow (inline composer or /inbox redirect after createInquiry —
  follow UI_SPEC's pinned shape, cite it); guests keep the /auth/login?returnUrl= redirect. A seller
  tapping inquiry on their OWN listing: follow spec if pinned, else disable with a stated reason.
- Buyer nav: wire the inbox entry per the existing MobileBottomNav items (chrome.nav.inbox key exists) —
  app-layer only. i18n inbox.* both locales, reuse before minting.
VERIFY: full CI + runtime smoke (minted buyer+seller staging fixture, forged @supabase/ssr cookie,
throwaway script deleted): both locales 200 + dir/lang; thread renders both parties' messages; composer
round-trip DB-verified; confirmed banner shows on a confirmed fixture; outsider thread → 404.
Commit + push. HOLD — do not start T04.
```
**Done when:** list + thread + composer live both locales; hard 404 for outsiders; confirmed
guidance-CTA (no dead link); listing CTA wired for authed buyers; zero ui/shared edits.

## T04 — Seller inbox (Sonnet)
```
Read SESSION_CONTEXT.md, then execute Phase 06 T04 — /seller/inbox + /seller/inbox/[id].
Branch feature/phase-06-messaging. Sonnet. Compose-only, seller shell.

- /seller/inbox: getStoreInquiries; status filter via the shared Tabs ({id,label,count} — T03-Phase-05
  pattern; counts via a lean additive head-count query if cheap, else omit counts and state it); rows =
  listing + buyer display name + preview + last_message_at + unread + status.
- /seller/inbox/[id]: MessageThread + reply composer (sendInquiryMessage, file-path import); CONFIRM
  action via ConfirmDialog → confirmInquiry → router.refresh(); confirmed state renders a "buyer can now
  checkout" note (guidance, no link — Phase 07). Additional transitions only if T02 built them.
- avg_response_hours: display per DECISION 2 (live value if A; static/NULL + REG-42 note if B).
- Nav: add inbox to SellerChrome (route exists after this task — the T03-Phase-05/T05 deferral pattern,
  no dead links). i18n seller.inbox.* both locales, reuse listing/status keys where they fit.
VERIFY: full CI + runtime smoke (minted pair, both locales): tabs filter; reply round-trip DB-verified;
CONFIRM flips the status in DB + the buyer-side thread now shows the confirmed banner (cross-surface
proof); cross-seller thread → 404. Commit + push. HOLD — do not start T05.
```
**Done when:** seller list/thread/reply/confirm live; cross-surface confirm proof; nav extended;
zero ui/shared edits; parity green.

## T05 — Exit verification + consolidated PR prep (Opus)
```
Read SESSION_CONTEXT.md, then execute Phase 06 T05 — exit gate. Opus. ZERO feature-code changes
(docs-only + throwaway E2E, deleted).

1. DoD ledger, evidence per line: REG-41 ERD-verbatim (live pg_policies pasted) · confirm→checkout
   contract written + proven (confirmInquiry transitions the cited member; converted_to_order_id
   untouched/NULL) · buyer-cannot-confirm · outsider isolation on inquiries AND messages · unread
   correct (or the flag stands, restated) · avg_response_hours per DECISION 2 (updates proven if A) ·
   R-N04 event-only + Phase-12 pointer · no phone gate on messaging (grep + code cite) · no service-role
   (guard) · no order_messages/notifications writes (grep) · binding rules held (no loading.tsx on
   notFound() segments; file-path imports; compose-only diff proof).
2. E2E (staging throwaway, minted + cleaned, residue re-queried = 0): buyer opens inquiry from a real
   listing → seller reads + replies (metric updates if A) → buyer replies → seller CONFIRMS → status =
   confirmed member, buyer thread shows checkout-enabled state → outsider still sees nothing.
3. DB live state (MCP): ledger 27/27 1:1; inquiries + inquiry_messages policies ERD-verbatim;
   advisor sweep = exact baseline.
4. Register + docs: REG-41 close; REG-42 if minted; Phase-06 entry checklist all-✅ with evidence;
   PHASE-07 ENTRY CHECKLIST written (REG-09 orders permissive INSERT + requireVerifiedPhone at checkout;
   order_items/order_status_history/order_messages/payments/shipments policy rows from the ERD §3 map;
   checkout consumes the confirm contract + writes converted_to_order_id; AC-BUY-6 atomic order + 2
   payments — ADR-012-class decision owed); UI_SPEC acceptance matrix rows; ADR/design notes confirmed;
   SESSION_CONTEXT + journal + pack tracker.
5. Full CI green (typecheck · lint 0 new · 4 guards + parity count · unit · integration full suite ·
   build both locales). Push. Open consolidated PR feature/phase-06-messaging → main titled
   "Phase 06: Messaging & Inquiries (T01–T04 + REG-41)" — ONE+ migration present → the R5 RLS-smoke job
   MUST fire; state the expectation in the body. HOLD — human merges.
```
**Done when:** all ledger lines PASS; E2E lifecycle proven zero-residue; Phase-07 checklist written;
PR open + held.

## Results tracker
| Task | Model | Status | Branch | Gate | Notes |
|---|---|---|---|---|---|
| T00 housekeep+cut | Sonnet | ✅ DONE | feature/phase-06-messaging | — | branch cut @ `acb3f1f`; pack committed |
| T01 DB+RLS | Opus | ✅ DONE | feature/phase-06-messaging | CI green · integ 13/13 · ledger 27/27 · advisor 0-new | REG-41 closed ERD-verbatim (mig `20260722115026`); REG-42 (unread reader-write) + REG-43 (buyer last_message_at bump) flagged; CONTRACT block pinned |
| T02 write layer | Opus | ✅ DONE | feature/phase-06-messaging | CI green · unit 120/120 · integ 14/14 · advisor baseline (0 mig) | ADR-014 (single-table create, no rpc); DEC2=A (avg_response_hours app-layer recompute); DEC3=(a) DEFER REG-42; DEC4=(a) DERIVE-AT-READ REG-43; declineInquiry built (UI_SPEC L481); REG-44 minted (buyer-name RLS gap) |
| T02-FIX REG-42 | Opus | ✅ DONE | feature/phase-06-messaging | CI green · unit 120/120 · integ 37/37 (readReceipt 10 + rls 13 + writeLayer 14) · ledger 28/28 · advisor post-T01 baseline (13), 0 new | **REG-42 CLOSED** — DECISION 3 REVISED (3a superseded) under AUTHORIZED ERD §3 row-52 amendment; mig `20260722124510` (column GRANT `UPDATE(is_read)` + `inq_msg_read_receipt` policy); `markInquiryRead` + `unreadCount` wired into 3 queries; ADR-015; body-edit denied by grant (42501) |
| T03 buyer inbox | Sonnet | — | — | — | — |
| T04 seller inbox | Sonnet | — | — | — | — |
| T05 exit gate | Opus | — | — | — | PR held for human |

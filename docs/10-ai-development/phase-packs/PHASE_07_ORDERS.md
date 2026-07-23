# PHASE 07 — Orders, Checkout & Split Payments

> Generated 2026-07-22 by the Phase-06 review chat after Phase 06 sign-off (PR #47 merged).
> Scope authority: `BETK_PHASES.md` Phase 07 = **FR-BUY-6..9 + FR-SEL-14..15 ONLY** — checkout (atomic
> order + items + two payments), confirmation/deposit instructions, order history, order detail/track,
> seller order management + status lifecycle, deposit confirmation gate, COD auto-confirm.
> Acceptance (BETK_PHASES): AC-BUY-6 (atomic, 2 payments, only from confirmed inquiry) · AC-SEL-14
> (confirm→stock decrement→notify; COD skips deposit) · cancel only pending (R-O03) · status history written.
> Pages: `/checkout` · `/checkout/confirmation/[id]` (buyer) · `/orders` · `/orders/[id]` (buyer) ·
> `/seller/orders` · `/seller/orders/[id]` (seller shell).
> NOT THIS PHASE: shipment creation / tracking events / Bosta webhook (**Phase 08** — T01 decides the
> read-policy question, see below) · reviews (09) · disputes (10) · notifications delivery (12) ·
> payouts (13). Review/dispute/tracking entry points on `/orders/[id]` render per UI_SPEC but
> guidance-only/empty-state (dead-link rule, /seller-landing precedent).

## Binding rules (all standing rules + PRECEDENTS.md apply; phase-specific highlights)
- **`requireVerifiedPhone()` at checkout** — THE consuming phase for the Phase-02 T07 gate (OD-4).
  `phone_required` outcome routes to `/auth/phone`; the full Google-user phone-capture loop is finally
  end-to-end. Seller/status-transition actions use `requireActiveUser` (they are not the OD-4 trio).
- **Confirm contract (Phase-06 T01, cited):** an order is created ONLY from `inquiries.status='confirmed'`
  (R-O01) and checkout writes `converted_to_order_id` — see the NAMED TENSION below.
- **NAMED TENSION (T01 pins before T02 codes):** `converted_to_order_id` is buyer-driven at checkout, but
  `inquiries` UPDATE RLS = store/admin only (`inq_update`). The buyer CANNOT write it under current RLS.
  Candidate shapes for T01 to decide with cites: (a) hardened SECURITY DEFINER trigger on `orders` INSERT
  copying the new order id onto the source inquiry (fires exactly once, DB-authoritative — the REG-43
  4(b) shape, justified here by a real linkage invariant); (b) column-grant re-scope + guarded buyer
  policy (the REG-42 pattern — but `status` must stay seller-only, and grants are per-role not
  per-policy, so this likely needs a trigger guard anyway); (c) defer the write to seller confirm.
  Do NOT smuggle a broad buyer UPDATE policy on `inquiries`.
- **NAMED TRAP (COD × R-L06):** `decrement_stock_on_confirm` is `AFTER UPDATE OF status` firing on the
  transition INTO `'confirmed'` (R2, live-verified). An order INSERTed directly as `'confirmed'` NEVER
  fires it. R-O04 COD auto-confirm must INSERT `pending` then UPDATE→`confirmed` inside the same
  transaction (or cite an alternative that provably fires the trigger — prove it either way in tests).
- **Identity transition (REG-44 resolves here, human-authorized):** the order exposes buyer name +
  delivery address to the seller for fulfilment. Pre-order opacity stays everywhere else. One code
  comment at the seller order-detail citing REG-44's posture change.
- **Split payment = ADR-002 (no custody) + C2 §3.8** — two payment rows, display/instructions only.
  NO payment gateway, NO processing, NO custody. Cite-or-flag anything implying otherwise.
- **Money discipline:** cite the actual column types (expect numeric); no float arithmetic on money in
  app code; totals computed server-side, client display-only.
- Migrations per REG-24 + schema-source backfill + advisor sweep vs the stated baseline. Any rpc →
  REG-32 CI-typegen procedure. No `loading.tsx` above any `notFound()`-capable segment (REG-46/47
  class — sweep the new (buyer) order segments AND (seller) before building). File-path action imports.
  Pre-checks UX-only, 23505/constraints authoritative. i18n `checkout.*` / `orders.*` /
  `seller.orders.*`, parity pasted per task. Windows/PowerShell, no `&&`. Human opens + merges the PR.
- **Effort rule (T00-recorded):** every task runs at its assigned model + thinking level (table below).

## Register plan
- **REG-09 — CLOSES at T01:** `orders` permissive ownership INSERT (`WITH CHECK buyer_id = auth.uid()`,
  ERD-verbatim). The RESTRICTIVE `orders_phone_gate` finally has something to restrict — prove BOTH
  halves (the REG-10 pattern): phone-verified buyer inserts own order; phone-NULL user DENIED (gate
  bites); cross-user DENIED. This also flips the RLS-smoke harness's standing A4b FINDING to a PASS.
- **REG-48 — RESERVED for T01:** the order-children policy set (`order_items`, `order_status_history`,
  `order_messages`, + `shipments`/`shipment_tracking_events` READ if T01's decision lands it) —
  ERD §3-specced, ABSENT live (next instances of the #14 / REG-29/31/34/41 class). Do NOT mint elsewhere.
- **REG-44:** resolved-by-design at T02/T05 (identity transition recorded). **REG-45:** the
  contact-exchange PRODUCT DECISION (unlock at confirm vs at order) is owed FROM THE HUMAN at T02 —
  record the answer in the register; build nothing for it this phase unless the decision + UI_SPEC align.
- **REG-47** stays record-only (Guard E candidate — do not build here). Further mints **REG-49+**.
- Closes/updates owed at T06: REG-09/48 closed with evidence; Phase-07 entry checklist all-✅;
  **Phase-08 entry checklist written** (shipments/tracking write policies + Bosta webhook idempotency +
  `delivered_at` opens the review window + whatever T01's shipments decision deferred).

## Task table
| Task | Executor | Model | Thinking | Scope |
|---|---|---|---|---|
| T00 | Cursor | Sonnet | High | Post-Phase-06 close + SESSION_CONTEXT reorg + PRECEDENTS.md + effort rule + branch cut + pack commit |
| T01 | Cursor | **Opus** | **Max** | DB & RLS (REG-09 + REG-48) + contract pinning (enum, payments shape, BETK-ref, tension + trap resolution shapes) |
| T02 | Cursor | **Opus** | **Max** | Checkout/order write layer — ADR-016 atomic order + status lifecycle + cancel + COD interplay |
| T03 | Cursor | Sonnet | Medium | `/checkout` + `/checkout/confirmation/[id]` + wire the Phase-06 checkout CTA |
| T04 | Cursor | Sonnet | Medium | Buyer `/orders` + `/orders/[id]` (OrderTimeline, cancel, payments, order thread) |
| T05 | Cursor | Sonnet | Medium | Seller `/seller/orders` + `/seller/orders/[id]` (deposit gate + confirm UI + nav) |
| T06 | Cursor | **Opus** | **Max** | Exit gate + full-purchase E2E + consolidated PR prep |

---

## T00 — Housekeeping + docs reorg + branch cut (Sonnet, High)
```
Read SESSION_CONTEXT.md, then execute Phase 07 T00 — post-Phase-06 close + docs reorganization + branch cut.
Docs + git only; zero src/ changes. Sonnet, thinking HIGH (the preservation guards matter).

1. git checkout main → git pull; confirm the PR #47 merge commit; record its SHA. Containment:
   git log origin/main..feature/phase-06-messaging MUST be empty (local + remote refs); if not → STOP,
   delete nothing. If empty → delete the branch local + remote.
2. REGISTER CLOSURES (evidence supplied by the human, 2026-07-22):
   - REG-12 → CLOSED: real OTP delivered to a physical handset; message rendered with sender "3MS EGY"
     (TorvoSMS log: 2 sends Jun 30, status sent, 58 chars/1 seg Arabic route; human confirmed on-device
     display). The hard pre-launch SMS gate is retired.
   - REG-13 → CLOSED-WITH-EVIDENCE: sender ID "3MS EGY" active at the aggregator (created Jun 29 2026)
     AND operator-rendered verbatim on device — registration provably propagated. Standing note: if the
     sender ID ever changes or shows an expiry, this re-opens; re-verify on any provider change.
   - Verify REG-47 (Guard E candidate, record-only) is present from the Phase-06 T05 close.
3. SESSION_CONTEXT REORGANIZATION — the file has grown into a second journal; slim it to live state.
   PRESERVE VERBATIM (byte-identical): the full REG register table (every row) · Frozen decisions
   (OD-1..7 + schema deltas) · every pinned CONTRACT block (confirm→checkout contract, ADR-010 note) ·
   the ERD §3 owning-phase map · the Phase-07 entry checklist (written at Phase-06 T05) · standing
   facts (counts, guard suite, storage posture, REG-40 rule).
   MOVE (never delete) to DEVELOPMENT_JOURNAL.md under a dated heading "SESSION_CONTEXT archive fold
   (2026-07-22)": the per-task "Last completed" narratives and archived phase histories from Phases
   01–06. Before moving each block, CHECK whether the journal already carries an equivalent dated entry
   — if yes, drop the SESSION_CONTEXT copy and state "already in journal"; if no, append it. State the
   verdict per block moved.
   KEEP a "Recent work" section: the last 3 tasks only, one short paragraph each.
   TARGET STRUCTURE (~≤400 lines): Project state (one-paragraph pointer + next task) · Standing facts ·
   Consolidated register · Frozen decisions · Contract blocks · ERD owning-phase map · Phase-07 entry
   checklist · Precedents pointer (→ docs/PRECEDENTS.md) · Recent work (3) · Update template.
   GUARD (paste the answers): line count before/after; every REG row present post-edit (count them);
   every OD present; contract blocks diff-identical; entry checklist diff-identical; journal grew by
   what SESSION_CONTEXT lost (state the moved-block list).
4. CREATE docs/PRECEDENTS.md — a compact table (Precedent | Rule (one line) | Established / instances)
   covering at minimum: BL-01-FIX class (no loading.tsx at/above any notFound()-capable segment — 3
   instances: BL-01-FIX, (public) T04-P03, (buyer) REG-46; Guard E = REG-47) · file-path Server-Action
   imports (feature barrel leaks next/headers) · pre-checks UX-only / 23505 + DB constraints
   authoritative · the #14 RLS class (ERD-specced-but-absent policy → mint REG, close additively,
   never broaden) · REG-24 migration procedure (MCP apply → rename local → ledger 1:1 → schema backfill
   → advisor vs stated baseline) · REG-32 rpc typegen (CI types-drift emits; apply printed diff
   verbatim; boundary-cast nullables) · REG-19 betk.users writes stay service-role · REG-40 explicit
   locale threading on ISR · REG-42 column-grant pattern (row-scoped RLS cannot confine columns; grant
   re-scope is the tool; WITH CHECK cannot see OLD) · throwaway-smoke pattern (minted staging users +
   forged @supabase/ssr cookie + real next start + DELETE before commit + zero residue re-queried) ·
   blanket html.includes()/.Contains false-positives on hydration payloads (T07-P03 + T04-P06 harness
   bugs) · compose-only / Claude-Design ownership / STOP-and-flag · guidance-only dead-link rule ·
   cite-or-flag on every schema fact · advisor-baseline discipline (baseline is STATED per task and
   re-stated at every migration).
5. EFFORT RULE — record in SESSION_CONTEXT standing facts (and DEV_OS_REFERENCE.md if convenient):
   Opus+Max = exit gates, RLS/policy design, ADR decisions, read-first audits · Opus+High = write
   layers, migrations, security review · Sonnet+Medium = compose-only UI on a settled query layer ·
   Sonnet+High = delicate docs/preservation work · Sonnet+Low = mechanical housekeeping. Every future
   pack task row carries model + thinking.
6. Commit to main: "docs: Phase 06 signed off; SESSION_CONTEXT reorg + PRECEDENTS + effort rule;
   Phase 07 next" → push. Journal append included.
7. git checkout -b feature/phase-07-orders from the fresh main tip → push -u. Add
   docs/10-ai-development/phase-packs/PHASE_07_ORDERS.md (this file) if untracked → commit
   "docs: commit Phase-07 pack" → push.
8. Report: merge SHA · containment · register closures · line counts + preservation-guard answers ·
   PRECEDENTS.md created · branch/pack status. STOP — no Phase-07 task.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
**Done when:** merge SHA recorded; branch gone both sides; REG-12/13 closed with the stated evidence;
SESSION_CONTEXT ≤~400 lines with ALL preservation guards answered; PRECEDENTS.md live; effort rule
recorded; `feature/phase-07-orders` tracking; pack committed.

## T01 — DB & RLS foundation + contract pinning (Opus, Max)
```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T01 — order RLS (REG-09/48) +
contract pinning. Branch feature/phase-07-orders. Opus, thinking MAX. READ-FIRST, then ONE additive
migration. State the advisor baseline you start from (expect the post-Phase-06 13 rls-no-policy INFO)
and the NEW baseline you end on (children gaining policies REDUCES the count — state the number).

STEP 1 — READ-ONLY STATE (MCP execute_sql; paste evidence):
(a) pg_policies vs ERD §3 for: orders (expect orders_access SELECT + RESTRICTIVE orders_phone_gate
    INSERT, NO permissive INSERT = REG-09) · order_items / order_status_history / order_messages
    (expect ZERO policies) · shipments / shipment_tracking_events (expect ZERO) · payments (expect
    PRESENT per the Phase-03 audit — verify shape vs ERD, touch nothing if correct) · addresses
    (expect present). Quote each.
(b) order_status_history + moderation_logs append-only DO INSTEAD NOTHING rules: confirm live; record
    how they interact with any INSERT policy you add (rules fire regardless of policy).
(c) CONTRACT PINNING — cite from BETK_DATABASE_SCHEMA.sql + live pg_enum/information_schema/pg_trigger;
    record the block verbatim in SESSION_CONTEXT for T02–T06 + Phase 08:
    - order_status enum: exact members + intended lifecycle order (known partial: pending, confirmed
      exist; NO 'paid' — Phase-05 T06 cite). Which member(s) mean cancelled/dispatched/delivered.
      Which transitions are Phase 07's (AC-SEL-14 + R-O03) vs Phase 08's (delivery) — cite BETK_PHASES.
    - payments: table columns, payment-type/method enums, and the EXACT two-row split shape per
      C2 §3.8 + ADR-002 (deposit row + remainder row? amounts derivation? status per row?). If the
      split shape is not pinned in C2/ERD → STOP-and-flag, do not invent percentages.
    - R-O02 BETK-ref: the order reference mechanism (column, default, format, uniqueness) — cite or flag.
    - delivery_method (buyer-side enum) members + mapping to StoreDeliveryOptions.modes (REG-14
      sibling — cite both sides; do not conflate).
    - money column types (expect numeric) — record the no-float rule against them.
    - THE TRIGGER TRAP: quote decrement_stock_on_confirm's definition (AFTER UPDATE OF status, WHEN
      transition INTO 'confirmed') and record the INSERT-pending-then-UPDATE COD shape as contract.
    - THE TENSION: converted_to_order_id writer. Buyer-driven checkout vs inq_update = store/admin.
      Evaluate the pack's candidate shapes (DEFINER trigger on orders INSERT / column-grant re-scope +
      guard / defer-to-confirm) with cites; PIN ONE as the contract T02 implements. If a DEFINER object
      is chosen: full hardening set (search_path pinned, EXECUTE revoked PUBLIC, advisor-clean) + the
      explicit argument for why RLS-bypass is warranted here (distinguish from ADR-012's rejection).
    - SHIPMENTS DECISION: ERD §3 map says Phase 07 owns shipments/shipment_tracking_events policies;
      BETK_PHASES says shipment CREATE is Phase 08; FR-BUY-9 READS them on /orders/[id]. Decide: land
      the buyer/seller READ policies now (tracking section renders empty until Phase 08) and defer
      writes to Phase 08, OR defer the whole row set — cite, pick, record for the Phase-08 checklist.

STEP 2 — MIGRATION (one, additive, ERD §3 row-verbatim):
- orders: permissive ownership INSERT (REG-09 close) — WITH CHECK buyer_id = auth.uid(); the
  RESTRICTIVE phone gate COMBINES (subtractive). No other orders policy touched.
- order_items: parent-scoped via the owning order (buyer own + store via my_store_id() + is_admin()),
  commands per the ERD row exactly.
- order_status_history: parties READ via parent order; INSERT per the ERD row (writer = the app layer
  on each transition unless a trigger is specced — cite; append-only rules already block UPDATE/DELETE).
- order_messages: thread parties SELECT/INSERT pinned-sender, sender-or-grant read-state per the ERD
  row (the inquiry_messages sibling — if the row mirrors it, reuse the REG-42 column-grant pattern
  ONLY if the ERD/spec pins a read-state; cite-or-omit).
- shipments/shipment_tracking_events per the STEP-1 decision. Plus the TENSION resolution object if
  T01 pinned a DB-side shape. Nothing else touched.
Apply via MCP → local file to MCP version → ledger 28→29 1:1 (pre-T01 state is 28/28 — expansion vs
the pack's "29→(count)" wording, flagged in the review chat) → schema backfill → advisor sweep,
state old + new baselines, 0 unexplained findings.

STEP 3 — INTEGRATION (staging, minted + cleaned, zero residue):
REG-09 BOTH HALVES (REG-10 pattern): phone-verified buyer INSERTs own order · phone-NULL user DENIED
(the gate finally bites — this flips the RLS-smoke A4b FINDING to a PASS; update the harness
expectation) · cross-user buyer_id DENIED. Children both-direction: buyer + owning seller read; outsider
+ anon zero rows; item INSERT scoping; status-history append-only proven (UPDATE/DELETE no-op);
order_messages party isolation. Tension-object proof if a DB shape landed.

VERIFY: full CI + integration N/N + ledger + advisor. CLOSE: REG-09 + REG-48 closed in the register;
contract block recorded verbatim; RLS-smoke harness A4b updated. Commit + push. HOLD — do not start T02.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
**Done when:** REG-09 both-halves proven; REG-48 closed ERD-verbatim; contract block (enum, split shape,
BETK-ref, trap, tension resolution, shipments decision) recorded with cites or STOPs; ledger 1:1;
baselines stated; A4b flipped.

## T02 — Checkout/order write layer (Opus, Max)
```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T02 — queries + Server Actions.
Branch feature/phase-07-orders (continue; git pull first). Opus, thinking MAX. Cite T01's CONTRACT
block throughout.

ADR-016 (record in ADR.md, confirm next free number): checkout atomicity. A checkout touches orders +
N order_items + 2 payments + the converted_to_order_id write (per T01's pinned shape) + a status-history
row (+ the COD pending→confirmed transition). AC-BUY-6 says ATOMIC and an order without items/payments
is NOT a valid resting state → the ADR-013 draft-first escape does NOT apply; expected outcome =
SECURITY INVOKER rpc (ADR-012 pattern: phone gate + REG-09 policies bite through INVOKER; PostgREST
wraps in one transaction; REG-32 CI-typegen procedure; EXECUTE authenticated-only, PUBLIC revoked;
search_path pinned). Evaluate honestly; if decomposition genuinely survives AC-BUY-6, argue it — else
land the rpc + its migration per REG-24.

PRODUCT DECISION (ask the human via the review chat BEFORE building anything for it — expected answer
recorded in the register only): REG-45 contact exchange — unlock at inquiry-confirm or at order? This
phase BUILDS NOTHING for it either way unless UI_SPEC pins a surface; record the answer.

ACTIONS (src/features/checkout/ + src/features/orders/, "use server", Zod-before-DB, discriminated
unions, no throw, file-path imports for consumers):
- createOrderFromInquiry(inquiryId, addressId, deliveryMethod, ...) — buyer; requireVerifiedPhone()
  FIRST (typed phone_required/unauthenticated/blocked outcomes for T03 routing); R-O01 gate: the source
  inquiry is status='confirmed' AND the caller's own AND not already converted (converted_to_order_id
  NULL — idempotency: already-converted → typed already_converted, return the existing order id);
  resolves listing/store/price server-side (never client-supplied amounts); R-O02 BETK-ref per T01's
  cite; address = caller's own row (RLS + server pin); delivery method validated against the store's
  enabled modes (REG-14 mapping per T01); builds the two payment rows per T01's pinned split shape;
  COD path: R-O04 auto-confirm via INSERT-pending-then-UPDATE-confirmed INSIDE the transaction — the
  R-L06 trigger MUST fire (assert stock decremented in the tests; also assert sold_out flip at 0 and
  the CHECK(stock_qty>=0) oversell rollback rolls the WHOLE checkout back).
- cancelOrder(orderId) — buyer, own order, R-O03 pending-only (typed not_cancellable otherwise);
  status-history row written per T01's writer contract.
- confirmOrder(orderId) — SELLER, own-store pin + RLS; the deposit-received gate (AC-SEL-14): pending →
  confirmed → trigger fires (assert decrement + the oversell-rollback path here too); COD orders are
  already confirmed → typed already_confirmed. Idempotent.
- Further transitions (e.g. dispatched) ONLY those T01 pinned as Phase 07's — cite-or-omit; each writes
  its status-history row.
- R-N04-class notify: PostHog events on create/confirm/cancel + Phase-12 delivery pointer comments.
  NO notifications-table writes.
QUERIES: getOwnOrders (buyer) · getOrderDetail (participant-scoped: buyer own OR owning seller; 404-null
outsiders; items + payments + status history + order messages per T01 policies) · getStoreOrders (seller,
status filter) — lean, typed, injectable client.
ORDER MESSAGES: send action mirroring the inquiry pattern IF the ERD/UI_SPEC pins the thread this phase
(FR-BUY-9 lists order_messages) — cite; reuse the messaging shapes, do not fork conventions.

TESTS (unit + integration on staging, zero residue): full checkout happy path exact-row-counts (1 order,
N items, 2 payments, history row, converted_to_order_id set, inquiry linkage); ATOMICITY proof (force a
mid-transaction failure — e.g. oversell — assert ZERO residue across all five tables = the ADR-012-class
rollback proof); non-confirmed inquiry rejected (R-O01); already-converted idempotency; phone-NULL
rejected at BOTH layers; COD fires the trigger (stock decremented, sold_out at 0); deposit-path order
stays pending until seller confirm, then decrements; cancel pending-only both directions; cross-user
isolation on every query/action; split-payment DEDUPE (BETK_PHASES: re-submission cannot create a second
payment pair). Full CI green. Docs: ADR-016 + SESSION_CONTEXT + journal. Commit + push. HOLD — no T03.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
**Done when:** ADR-016 recorded; atomicity + rollback proven with zero residue; COD trigger interplay
proven; both gates (R-O01 + phone) proven both layers; dedupe proven; no service-role; CI green.

## T03 — Checkout UI (Sonnet, Medium)
```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T03 — /checkout +
/checkout/confirmation/[id]. Branch feature/phase-07-orders (continue). Sonnet, Medium. Compose-only.

STEP 0 (REG-46/47 lesson): sweep for loading.tsx at/above every segment this task creates that calls
notFound() — state the finding.
- /checkout: entry shape per UI_SPEC (cite — expect ?inquiry= param via routes.checkout builder);
  non-confirmed/foreign/converted inquiry → per spec (expect redirect or notFound — cite). Compose
  AddressForm/AddressSelect (kit) for select-or-create (writes under the existing addresses RLS,
  max-one-default respected); delivery method limited to the store's enabled modes (REG-14 mapping);
  order summary with server-computed totals + the two-payment split displayed per T01's shape; submit →
  createOrderFromInquiry (file-path import) routing EVERY typed outcome: ok → confirmation page ·
  phone_required → /auth/phone (the OD-4 loop, live at last) · already_converted → the existing order ·
  not_confirmed → back to the thread · blocked → /blocked.
- /checkout/confirmation/[id]: deposit path = instructions composing the SELLER's payment handles
  (stores.payment_methods — the R-S09 data, displayed not processed, ADR-002) + BETK-ref prominently
  (R-O02) + "seller confirms once deposit received" state; COD path = auto-confirmed state, no deposit
  instructions (R-O04). Outsider/unknown id → hard notFound() by status code.
- WIRE THE PHASE-06 CTA: the buyer-thread confirmed banner's guidance-only note becomes the real
  routes.checkout link (the "Phase 07 wires here" comment — remove it, link it). Disable/annotate when
  already converted (per the T02 idempotency outcome).
- i18n checkout.* both locales, parity pasted. Zero ui/shared edits (diff proof).
VERIFY: full CI + runtime smoke (minted confirmed-inquiry fixture, forged @supabase/ssr cookie,
throwaway deleted, zero residue): both locales 200 + dir/lang; address select + create; COD submit →
confirmation reflects auto-confirm AND DB shows the decremented stock; deposit submit → instructions
render the seller's real handles + BETK-ref; phone-NULL user → routed to /auth/phone; foreign inquiry →
per-spec rejection; confirmation hard-404 for outsiders. Commit + push. HOLD — no T04.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
**Done when:** both pages live both locales; every typed outcome routed; Phase-06 CTA wired (comment
retired); deposit vs COD states proven live; zero ui/shared diff.

## T04 — Buyer orders (Sonnet, Medium)
```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T04 — /orders + /orders/[id].
Branch feature/phase-07-orders (continue). Sonnet, Medium. Compose-only. STEP 0 loading.tsx sweep first.
- /orders: getOwnOrders — BETK-ref, listing summary (localizedName COALESCE), store, total, StatusBadge
  (order domain — label every enum member T01 cited), date. EmptyState; pagination only if the query
  pages.
- /orders/[id]: getOrderDetail; outsider/unknown/malformed → hard notFound() by status code. Compose
  OrderTimeline (kit, AS-IS) from order_status_history; items; the two payment rows + their states per
  T01's shape; delivery address; cancel (pending-only per R-O03) via ConfirmDialog → cancelOrder →
  router.refresh(); order-messages thread via MessageThread + composer IF T02 built it (else omit,
  stated). Review/dispute CTAs = guidance-only (Phase 09/10, dead-link rule, code comments); tracking
  section = keyed empty state (Phase 08) IF T01 landed the read policies, else omitted (stated).
- i18n orders.* both locales, parity pasted. Zero ui/shared edits (diff proof).
VERIFY: full CI + runtime smoke (minted fixtures across statuses incl. a cancelled + a confirmed order,
both locales): timeline renders history; cancel round-trip DB-verified on a pending order + the button
absent/disabled on non-pending; hard 404s. Commit + push. HOLD — no T05.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
**Done when:** list + detail live; cancel proven both directions; timeline from real history; dead-link
rule held; zero ui/shared diff.

## T05 — Seller orders (Sonnet, Medium)
```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T05 — /seller/orders +
/seller/orders/[id]. Branch feature/phase-07-orders (continue). Sonnet, Medium. Compose-only, seller
shell. STEP 0 loading.tsx sweep first.
- /seller/orders: getStoreOrders; status filter via shared Tabs ({id,label,count} — lean head-count
  query if cheap, else omit counts, stated); rows = BETK-ref + listing + BUYER NAME (REG-44 resolves
  HERE — identity is now legitimately exposed for fulfilment; code comment citing the posture
  transition) + total + StatusBadge + date.
- /seller/orders/[id]: full detail incl. buyer name + delivery address (REG-44) + payment rows/deposit
  state; CONFIRM via ConfirmDialog → confirmOrder → router.refresh() — the AC-SEL-14 gate: render the
  deposit-received framing per UI_SPEC (cite); COD orders show already-confirmed (no confirm CTA);
  any further T02-built transitions wired the same way; terminal states render read-only. Cross-seller →
  hard notFound() by status code. Order-messages thread if built (T04 parity).
- Nav: add orders to SellerChrome (route exists after this task — deferral-closing pattern).
- i18n seller.orders.* both locales, parity pasted. Zero ui/shared edits (diff proof).
VERIFY: full CI + runtime smoke (minted buyer+seller pair, both locales): tabs filter; CONFIRM flips
status in DB AND stock decrements (the trigger, proven from the UI path) AND the buyer /orders/[id]
timeline shows it (cross-surface); COD order renders confirmed with no CTA; cross-seller 404.
Commit + push. HOLD — no T06.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
**Done when:** seller list/detail/confirm live; trigger proven from the UI; cross-surface proof; REG-44
transition commented; nav extended; zero ui/shared diff.

## T06 — Exit verification + consolidated PR prep (Opus, Max)
```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T06 — exit gate. Opus, MAX. ZERO
feature-code changes (docs-only + throwaway E2E, deleted).
1. DoD ledger, evidence per line: REG-09 both halves (phone gate bites — A4b now PASS in the harness) ·
   REG-48 ERD-verbatim (pg_policies pasted) · AC-BUY-6 atomic + 2 payments + only-from-confirmed +
   rollback zero-residue · converted_to_order_id written per T01's pinned shape + idempotent ·
   AC-SEL-14 confirm→decrement (trigger, both COD-at-create and deposit-at-confirm paths) · R-O02
   BETK-ref · R-O03 cancel pending-only · R-O04 COD skips deposit · status history written on every
   transition · split-payment dedupe · REG-44 identity transition recorded + buyer identity STILL
   grep-absent from all PRE-order seller surfaces · money no-float (grep) · requireVerifiedPhone at
   checkout only (grep: not on seller transitions) · no service-role · binding rules held (loading.tsx
   sweep, file-path imports, compose-only diff, dead-link rule for Phase 08/09/10 surfaces).
2. E2E FULL PURCHASE (staging throwaway, minted + cleaned, residue re-queried = 0), BOTH payment paths:
   (deposit) inquiry→confirm→checkout→pending + instructions→seller confirms→trigger decrements→buyer
   timeline updates; (COD) checkout→auto-confirmed→stock already decremented→sold_out flip at 0 →
   REG-25 public detail still renders; cancel path on a fresh pending order; outsider sees nothing
   anywhere.
3. DB live state (MCP): ledger 1:1 (state count); all Phase-07 policies ERD-verbatim; advisor = the
   T01-stated new baseline, 0 new; any rpc/trigger INVOKER-or-argued + hardened.
4. Register + docs: REG-09/48 CLOSED; REG-44 resolution recorded; REG-45 product-decision answer
   recorded (or restated owed); PHASE-08 ENTRY CHECKLIST written (shipments/tracking write policies +
   whatever T01 deferred; Bosta webhook idempotency; delivered_at opens the review window — Phase-09
   dependency; courier service wrapper exists at services/courier.ts); Phase-07 entry checklist all-✅;
   UI_SPEC acceptance matrix rows (6 screens); ADR-016 confirmed; API_STANDARDS updated per
   BETK_PHASES' docs line; SESSION_CONTEXT (slim discipline holds — recent-work rotation, no narrative
   regrowth) + journal + pack tracker.
5. Full CI green (typecheck · lint 0 new · 4 guards + parity · unit · integration full suite · build
   both locales + route count). Push. Open consolidated PR feature/phase-07-orders → main titled
   "Phase 07: Orders, Checkout & Split Payments (T01–T05 + REG-09/48)" — migrations present → the R5
   RLS-smoke job MUST fire (and A4b now passes inside it); flag the checkout rpc + the
   converted_to_order_id mechanism as the security-relevant changes to review first. HOLD — human merges.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```
**Done when:** all ledger lines PASS; both-path E2E zero-residue; Phase-08 checklist written; SESSION_CONTEXT
stays slim; PR open + held.

## Definition of Done (phase)
- A buyer with a verified phone converts a confirmed inquiry into an atomic order (items + 2 payments +
  history + inquiry linkage) — and NOTHING else can create one (non-confirmed, foreign, phone-NULL,
  re-submission all provably rejected with zero residue).
- COD auto-confirms at create and provably fires the stock decrement; deposit orders decrement at
  seller confirm; oversell rolls the whole checkout back.
- Cancel = pending-only; every transition writes status history; timelines render it on both surfaces.
- REG-09 + REG-48 closed ERD-verbatim; the RLS-smoke A4b finding is retired.
- Buyer identity exposed to the seller ON the order only (REG-44 posture transition, commented).
- Split payments are display/instruction rows per ADR-002 — no processing, no custody, no gateway.
- Every screen bilingual + theme-wired; ledger 1:1; schema backfilled; consolidated PR open with
  RLS-smoke fired; `main` untouched until the gate verdict.

## Docs to update
`ADR.md` (ADR-016 + any T01 shape) · `BETK_DATABASE_SCHEMA.sql` (REG-09/48 + rpc/trigger backfill) ·
`API_STANDARDS.md` · `SESSION_CONTEXT.md` · `DEVELOPMENT_JOURNAL.md` · `PRECEDENTS.md` (if a new
precedent lands) · `BETK_UI_SPEC.md` acceptance matrix · this pack's results tracker.

## Results tracker
| Task | Model | Thinking | Status | Branch | Gate | Notes |
|---|---|---|---|---|---|---|
| T00 housekeep+reorg | Sonnet | High | — | — | — | SESSION_CONTEXT slim + PRECEDENTS + effort rule |
| T01 DB+RLS | Opus | Max | ✅ 2026-07-23 | feature/phase-07-orders | CI green · ledger 29 · advisor 8 INFO (was 13) | REG-09/48 CLOSED, REG-49 opened; migration `20260723074953`; ORDER-SET CONTRACT pinned; tension=DEFINER-trigger; shipments=READ-now/WRITE-Phase-08; order.rls 15/15+1 opt-in; A4b→PASS |
| T02 write layer | Opus | Max | — | — | — | ADR-016 · REG-45 product decision asked |
| T03 checkout UI | Sonnet | Medium | — | — | — | Phase-06 CTA wired |
| T04 buyer orders | Sonnet | Medium | — | — | — | — |
| T05 seller orders | Sonnet | Medium | — | — | — | REG-44 transition |
| T06 exit gate | Opus | Max | — | — | — | PR held for human |

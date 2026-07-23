# PHASE_07_ORDERS.md — Orders, Checkout & Split Payments (CUSTODIAL)

> **REGENERATED 2026-07-23 for the custodial model (OD-8 / ADR-016). Closes REG-57.**
> T00 ✅ and T01 ✅ are DONE and survive intact (CORRECTION-01 §G3) — their sections are unchanged and
> live above the regenerated task set in the repo copy of this file. Everything from T02 down is
> rebuilt: payee = BETK, admin deposit verification, commission snapshot, no COD auto-confirm, no
> pure-COD path, derived closure.
>
> Pages (all 7 already in the frozen 59-page inventory — **page count 59 HOLDS, no OD required**):
> `/checkout` · `/checkout/confirmation/[id]` · `/orders` · `/orders/[id]` (buyer) ·
> `/seller/orders` · `/seller/orders/[id]` (seller) · **`/admin/payments` (deposit-verification slice only)**.
>
> NOT THIS PHASE: shipment create / tracking events / Bosta webhook (Phase 08) · reviews (09) ·
> disputes (10) · notifications delivery (12) · seller earnings + derived-balance query + payouts (13) ·
> the rest of `/admin/payments` and the whole admin console (14). Entry points to those render
> guidance-only / empty-state per the dead-link rule.

---

## §0 — NAMED DECISION (ANSWERED — do not re-litigate)

**Under custody, admin deposit confirmation is required for the order lifecycle to advance at all: the
seller cannot accept until the deposit lands. Resolution = (c), narrowly.**

**Phase 07 builds the deposit-verification SLICE of `/admin/payments`, not the page's full spec.**

| | |
|---|---|
| **IN Phase 07 (T05)** | pending-deposit queue (`proof_path IS NOT NULL AND status='pending'`, plus proof-less pending rows shown as awaiting-buyer) · signed-URL proof view from the private `docs` bucket · **confirm deposit** → `payments.status='confirmed'` + `confirmed_by` + `confirmed_at` · `moderation_logs` write **iff** an admin INSERT policy exists (cite-or-flag) |
| **DEFERRED → Phase 14** | full payment ledger across all orders/statuses · filters · refund action (`status='refunded'`) · the admin console shell, nav, dashboard, SLA counters · every other `/admin/*` page |
| **DEFERRED → Phase 08+** | **COD-balance confirm** — unexercisable here: it follows courier remittance on a `delivered` order, and `dispatched`/`delivered` are Phase-08 transitions |
| **NOT BUILT, EVER (REG-56)** | **no order-closure action and no close button.** Closure is DERIVED: both payment rows `confirmed` AND `orders.status='delivered'`. `order_status` has no terminal `closed` member and none may be invented |
| **REJECT the deposit?** | **Not built.** The escape hatch already exists without it: the admin simply does not confirm, and the buyer re-uploads (`proof_path` is buyer-writable on their own deposit row). A `status='failed'` reject path is Phase-14's — state this in the T05 report rather than improvising |

**Grounds (cite these, do not re-derive):** `BETK_PHASES.md` Phase 07 = "…**admin deposit-verification
gate → seller acceptance**" and AC-SEL-14 = "seller confirm→stock decrement→notify, **gated on the
admin-verified deposit**". The gate is Phase 07's own acceptance criterion. `/admin/payments` is
already in the frozen inventory (FR-ADM-10) so the slice costs no scope.

**Chrome:** if `AdminShell`/`AdminSidebar` are absent from `components/shared`, the page ships
**functional-but-unshelled** and the shell is routed to Claude Design (CD-DELTA queue) — the REG-59
(`/account` unstyled) precedent. **Cursor never authors a shell.** This is not a blocker.

---

## §1 — NAMED TRAPS (T02 resolves both before writing any action)

### TRAP 1 — `admin_settings` is not proven readable by a buyer

Checkout must render **BETK's payment handles** and the **flat delivery fee** to a *buyer*, and must
snapshot **commission** onto the order. `admin_settings` RLS is `settings_admin` (admin-scoped). A
`SECURITY INVOKER` rpc does **not** help — RLS still evaluates as the buyer.

Candidate shapes, in preference order — **T02 picks one with live evidence and records why**:

- **(i) Commission via a DEFINER BEFORE-INSERT trigger on `orders`.** Reads `commission_rate_pct`
  server-side and sets `NEW.commission_rate` + `NEW.commission_amount`. The buyer never reads the
  rate, and the snapshot becomes DB-authoritative (REG-33's lesson: an app-only guard breaks at the
  first second writer). Hardened exactly like ADR-017 / `decrement_stock_on_confirm`:
  `SET search_path=betk,public`, `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`. A *trigger*
  function is never PostgREST-exposed → **no advisor 0029**, distinct from ADR-012's rejected DEFINER
  *rpc*. This covers commission and, if it also computes `delivery_fee`/`total_amount`, the write side
  of the fee too.
- **(ii) The handles still need a buyer READ path** — trigger (i) cannot solve this, because the buyer
  must *see* where to transfer before paying. Either an additive **narrowly-scoped SELECT policy on
  `admin_settings` restricted to the payment-config key set**, or a hardened accessor. A new policy on
  an admin table is a **broadening → STOP-and-flag and get authorization before applying it**; do not
  land it silently.
- **(iii) Do NOT reach for service-role** (standing rule) and do NOT hardcode the handles.

**If neither (i) nor (ii) is cleanly authorizable, STOP.** Do not proceed to T03 with an improvised
read path.

### TRAP 2 — the REG-42 column-GRANT pattern does not separate two actors

`payments` UPDATE must split **by column AND by actor**: admin writes `status`/`confirmed_by`/
`confirmed_at`/`notes`; the buyer attaches `proof_path`/`transfer_reference` to **their own order's
deposit row only**. But:

- `WITH CHECK` cannot see `OLD` (PRECEDENTS) → transition legality and column confinement are not
  expressible in a policy predicate.
- **GRANTs are per-ROLE, not per-policy.** Admin and buyer are both `authenticated`. One
  `GRANT UPDATE(cols)` is necessarily the UNION of both column sets, so the grant alone would let a
  buyer touch `status`.

**Required shape = three layers, all of them:**

1. **Column GRANT** — `REVOKE UPDATE ON betk.payments FROM authenticated;` then
   `GRANT UPDATE(status, confirmed_by, confirmed_at, notes, proof_path, transfer_reference) TO authenticated`.
   This makes `amount`, `payment_type`, `order_id`, `method` **untouchable by anyone authenticated** —
   that is the load-bearing win.
2. **Row policy** — permissive UPDATE scoped to parties via the parent order (`buyer_id = auth.uid()`
   OR `betk.is_admin()`; the seller gets **no** `payments` UPDATE).
3. **`BEFORE UPDATE` trigger** — sees `OLD`, so it enforces actor↔column legality and RAISEs (a real
   error, not a silent 0-row no-op): a `status`/`confirmed_*`/`notes` change requires
   `betk.is_admin()`; a `proof_path`/`transfer_reference` change requires the caller to be the parent
   order's buyer AND `payment_type='deposit'` AND `OLD.status='pending'`.

**The same three layers apply to `orders` UPDATE.** Without a column grant, a buyer could UPDATE
`total_amount` on their own `pending` order. Grant only what Phase 07 writes —
`status`, `cancelled_by`, `cancellation_reason` — and leave `delivered_at`/tracking columns to Phase 08.
**Before revoking, state the current grants and confirm no existing code path UPDATEs `orders`**
(Phase 07 is the first writer; verify, don't assume).

---

## §2 — Binding rules (standing rules + PRECEDENTS.md apply; phase-specific)

- **Custody.** Buyer pays **BETK**. Deposit → BETK's `admin_settings` handles, buyer uploads an
  Instapay screenshot to the private `docs` bucket. Balance → COD collected by the courier and
  **remitted to BETK**. `stores.payment_methods` is the BETK→seller **settlement** destination and is
  **never rendered to a buyer** (REG-55 closed — do not regress it).
- **Two signals, two actors.** **ADMIN** confirms the deposit (`payments.status`). **SELLER** accepts
  the order (`orders.status: pending→confirmed`, fires `decrement_stock_on_confirm`).
  **AC-SEL-14's actor is UNCHANGED.** Seller acceptance is gated on the admin-confirmed deposit.
- **No pure-COD path, no auto-confirm (OD-8 §3.1/§3.2).** Every order = exactly two `payments` rows.
  Every order INSERTs `pending` and reaches `confirmed` only through the seller's UPDATE — so the
  trigger fires **naturally**. **The old INSERT-pending-then-UPDATE-in-one-transaction workaround is
  OBSOLETE; do not carry it forward. The Phase-07 NAMED TRAP is GONE.**
- **Commission** = flat % of **`subtotal`** (never `total_amount` — the delivery fee is courier
  pass-through), snapshotted at creation into `orders.commission_rate` + `orders.commission_amount`.
  Rounding 2dp half-up, `numeric` throughout, computed in SQL (`round(numeric,2)`), never in JS.
- **Closure is DERIVED (REG-56).** No close action, no close button, no new enum member.
- **Seller balance is DERIVED and is NOT built here** — Phase 13. Record the rule in the Phase-13
  entry checklist at the exit gate; build no balance query in Phase 07.
- **`requireVerifiedPhone()` at CHECKOUT ONLY** (the OD-4 trio). `requireActiveUser` on seller
  transitions. **`requireAdmin`** (new, built in T02) on the admin action.
- **Money = `numeric` columns.** No float arithmetic in app code, no `::float`, no JS `number` math on
  amounts. Live CHECKs: `chk_order_total (total_amount = subtotal + delivery_fee)`,
  `chk_order_item_subtotal`, `payments.amount > 0`, `chk_commission_rate_range`,
  `chk_commission_amount_nonneg`.
- **Empty-config path (REG-62).** With the three BETK handles empty, checkout must return a typed
  **`payment_config_missing`** outcome and **refuse to create an order** — never a blank instructions
  panel and never an order with nowhere to pay. `commission_rate_pct = 0` does **not** block (0 is a
  valid if unintended config) — it is surfaced at the exit gate as the REG-62 gate, not enforced as a
  business rule.
- **`converted_to_order_id` needs NO work.** T01's DEFINER AFTER-INSERT trigger (ADR-017) writes it.
  Do not re-solve, do not write it from the app.
- **Communication posture.** In-app only. No off-platform counterparty contact affordance anywhere in
  this phase. Courier reaches the parties **only via the BETK-generated shipping label**.
- **REG-44 resolves here, narrowly:** the seller order surfaces expose the buyer's **name + delivery
  address** because fulfilment requires them. One code comment at the seller order detail citing the
  posture. **No contact-exchange decision is owed** (REG-45 is closed-as-not-a-defect).
- **No `loading.tsx` at or above any segment whose page can reach `notFound()`** — sweep per task,
  state the finding (REG-46/47 class).
- **Shipments:** buyer/seller READ policies landed at T01. WRITE deferred to Phase 08 — record in the
  Phase-08 entry checklist at the exit gate. `/orders/[id]` tracking renders empty until then.
- **Standing:** cite-or-flag every schema fact · STOP-and-flag over improvisation · security findings
  surface as findings, never silently patched · file-path action imports · pre-checks UX-only, 23505
  authoritative · compose-only (`components/ui`/`components/shared` are Claude Design's — zero diff,
  proven) · any new rpc → CI-authoritative typegen (REG-32), never hand-edited · migrations via MCP
  `apply_migration` → rename local file to the MCP version → ledger 1:1 → schema backfill → advisor
  baseline stated before **and** after (REG-24) · Windows/PowerShell, no `&&` · no credentials in
  prompts or chat · human opens and merges PRs.

---

## §3 — Starting state every task states before it begins

Ledger **30/30** · advisor **8 rls-no-policy INFO / 6 search_path WARN / 2 extension WARN /
4 sec-definer-exec WARN / 1 leaked-password WARN** · 43 tables · 59 pages · guards **4/4**
(i18n **730/730**) · unit **111/111** · integration **188 passed + 2 skipped** (25 files) ·
build **44 routes** both locales · ADR-001…017 occupied, **next free = ADR-018**.

Expected end state: ledger **31/31** · advisor **unchanged at 8/6/2/4/1** (adding policies to tables
that already carry policies resolves nothing and should create nothing; a hardened DEFINER *trigger*
adds no sec-definer-exec WARN — T01/ADR-017 precedent) · build **~51 routes** (7 new pages — verify,
do not assert).

---

## §4 — Register plan

**Canonical namespace REG-01..REG-64. `REG-65` is RESERVED** for the seller-onboarding dead
delivery-fee-field mint (kickoff §4, post-Phase-07 onboarding pass). **Phase-07 mints start at REG-66.**

- **REG-49 — owned by T02.** `payments` INSERT/UPDATE + `orders` UPDATE. Close it there with evidence;
  do not mint it elsewhere.
- **Pre-reserved mint candidates (mint only if live evidence shows the gap):**
  - **REG-66** — `moderation_logs` admin INSERT policy absent (would be the 7th #14-class instance).
    If ERD §3 specs it, close it in T02's migration ERD-verbatim; if not, defer and have T05's admin
    action skip the log write with a stated reason.
  - **REG-67** — `admin_settings` buyer-read gap, if TRAP 1 lands as a flagged broadening.
  - **REG-68** — admin console shell absent (`AdminShell`/`AdminSidebar`), CD-DELTA-owned, REG-59 class.
- **Closes owed at the exit gate:** REG-49 closed with evidence · REG-56 restated as satisfied-by-design
  (no close action built) · REG-44 resolution recorded · Phase-07 entry checklist all-✅ ·
  **Phase-08 entry checklist written** (shipments/tracking WRITE policies, Bosta webhook idempotency,
  `delivered_at` opens the review window, COD-balance confirm) · **Phase-13 entry checklist written**
  (derived seller balance formula + `return_hold_hours` gate) · **Phase-14 entry checklist written**
  (the deferred `/admin/payments` remainder + the rest of the console).

---

## §5 — Task table

| Task | Executor | Model | Thinking | Scope |
|---|---|---|---|---|
| T01b | Cursor | Sonnet | **High** | Branch re-cut from fresh `main` · close PR #48 · verify UNIT-COUNT-CHECK · OD-8 doc-residue sweep (4 stale blocks) |
| T02 | Cursor | **Opus** | **Max** | Write layer + **REG-49** policies/grants/triggers + ADR-018 atomicity + TRAP 1 + TRAP 2 |
| T03 | Cursor | Sonnet | Medium | `/checkout` + `/checkout/confirmation/[id]` + proof upload + wire the Phase-06 CTA |
| T04 | Cursor | Sonnet | Medium | Buyer `/orders` + `/orders/[id]` |
| T05 | Cursor | Sonnet | **High** | **`/admin/payments` deposit-verification slice** (first admin-gated route + signed URL) |
| T06 | Cursor | Sonnet | Medium | Seller `/seller/orders` + `/seller/orders/[id]` + accept + nav |
| T07 | Cursor | **Opus** | **Max** | Exit gate + full-lifecycle E2E + consolidated PR prep |

Order rationale: T05 precedes T06 so the seller-accept task can prove the **admin-confirm → seller-accept
→ stock-decrement** chain from the UI in one window.

---

## T01b — Branch hygiene + verification + OD-8 doc-residue sweep (Sonnet, High)

```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T01b — branch hygiene +
verification + OD-8 doc-residue sweep. Sonnet, thinking HIGH (preservation work). Docs + git only;
ZERO src/ changes.

1. GIT. git checkout main; git pull. Confirm PR #49 is merged and record its SHA.
   feature/phase-07-orders was merged into main via #49 — do NOT continue on the merged branch.
   Containment: git log origin/main..feature/phase-07-orders MUST be empty (local + remote). If NOT
   empty → STOP and report, delete nothing. If empty → delete it local + remote, then re-cut
   feature/phase-07-orders from the fresh main tip and push -u.
   Draft PR #48 (opened only to obtain CI's types-drift diff): if #49 superseded it, close it. Report
   the state of both PRs.

2. UNIT-COUNT-CHECK. Unit went 120 → 111 across CORRECTION-02B while a test was ADDED (~10 tests
   unaccounted). If that read-only report is not yet verified, verify it now: enumerate
   tests/unit/*.test.ts with per-file test counts on this branch, diff against the pre-CORRECTION-02B
   commit, and account for EVERY delta (file deleted / tests removed / suite renamed / genuinely
   dropped). Paste the accounting. A missing test that was silently dropped is a FINDING — surface it,
   do not re-add it in this task.

3. DOC-RESIDUE SWEEP (SESSION_CONTEXT.md only; preserve every other line byte-for-byte):
   (a) ORDER-SET CONTRACT → order_status bullet: delete "COD auto-confirm (R-O04 — COD skips the
       deposit gate)" from Phase 07's owned transitions. Phase 07 owns pending→confirmed (AC-SEL-14,
       seller, gated on the admin-confirmed deposit), confirmed→preparing, and →cancelled from
       pending only (R-O03).
   (b) ORDER-SET CONTRACT → "THE TRIGGER TRAP": keep the live trigger definition verbatim; REPLACE the
       prescription. Under OD-8 §3.1 every order INSERTs 'pending' and reaches 'confirmed' only via
       the seller's UPDATE, so the trigger fires naturally. Mark the INSERT-pending-then-UPDATE
       workaround HISTORICAL/RETIRED. Rename the block "THE TRIGGER (trap retired)".
   (c) Phase 07 entry checklist → DELETE the "[FLAGGED] pre-transaction identity opacity … REG-44 +
       REG-45 = ONE POSTURE … A PRODUCT DECISION is owed" bullet. Replace with: REG-44 resolves at the
       seller order surfaces (buyer name + address for fulfilment); REG-45 is CLOSED-as-not-a-defect;
       NO product decision is owed.
   (d) REG-49 register row → strike "the COD INSERT-pending-then-UPDATE two-step" from the owed-work
       wording; the owed work is: orders UPDATE (seller accept + buyer cancel-while-pending) and
       payments INSERT/UPDATE (two-row create + buyer proof attach + admin confirm).
   Do NOT restructure, re-order, or "tidy" any other line. Paste a diff of exactly what changed.

4. Record in SESSION_CONTEXT: Phase-07 pack REGENERATED (REG-57 closed), the §0 NAMED DECISION
   verdict (c) verbatim, REG-65 reserved / Phase-07 mints start at REG-66, and the re-cut branch SHA.
   Journal append. Commit "docs: Phase 07 pack regenerated for OD-8; branch re-cut; doc-residue swept"
   → push.

5. Report: PR #49 SHA · PR #48 state · containment result · branch SHA · the unit accounting ·
   the 4-item doc diff. HOLD — do not start T02.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```

**Done when:** branch re-cut from the fresh `main` tip and pushed; #48 resolved; every unit-count delta
accounted for (or the shortfall surfaced as a FINDING); all 4 doc residues corrected with a pasted diff
and nothing else touched; REG-57 closed.

---

## T02 — Checkout/order write layer + REG-49 (Opus, Max)

```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T02 — write layer + REG-49.
Branch feature/phase-07-orders (git pull first). Opus, thinking MAX. Cite T01's ORDER-SET CONTRACT
block throughout — do not re-derive it.

STATE THE ADVISOR BASELINE YOU START FROM (expect 8 rls-no-policy INFO / 6 search_path WARN /
2 extension WARN / 4 sec-definer-exec WARN / 1 leaked-password WARN) and the baseline you end on.
Ledger 30 → expect 31.

STEP 1 — READ-ONLY LIVE STATE (MCP execute_sql; paste every result verbatim):
(a) pg_policies + table/column GRANTs for: payments (expect payments_access SELECT ONLY — quote its
    USING; INSERT/UPDATE ABSENT = REG-49) · orders (expect orders_access SELECT + orders_insert
    permissive INSERT + RESTRICTIVE orders_phone_gate; UPDATE ABSENT) · admin_settings (expect
    settings_admin — quote it; THIS IS TRAP 1) · moderation_logs (INSERT policy present or absent?) ·
    storage.objects docs bucket policies (expect docs_insert_own_prefix + docs_select_own_or_admin —
    confirm NO new storage policy is needed, per CORRECTION-01 §D2).
(b) Current column-level GRANTs on betk.payments and betk.orders for role authenticated
    (information_schema.column_privileges). You are about to REVOKE — prove what you are revoking.
(c) grep the repo: does ANY existing code path UPDATE betk.orders or betk.payments? Expect none
    (Phase 07 is the first writer). If any exists, STOP and report before revoking.
(d) Re-confirm the 6 admin_settings payment-config keys exist with their seeded values and that
    decrement_stock_on_confirm's definition is unchanged.

STEP 2 — TRAP 1 (admin_settings readability). Decide with the STEP-1 evidence, record WHY:
  (i) commission snapshot via a hardened DEFINER BEFORE-INSERT trigger on betk.orders
      (search_path pinned, EXECUTE revoked PUBLIC/anon/authenticated — ADR-017 precedent, no advisor
      0029 because a trigger is never PostgREST-exposed). Sets commission_rate + commission_amount
      (= round(commission_rate/100 * subtotal, 2), SQL not JS). Consider having it own delivery_fee /
      total_amount too — argue either way.
  (ii) The buyer STILL needs to READ the BETK handles (and the fee, pre-submit) to pay. If no
      buyer-visible read path exists, this is a POLICY BROADENING on an admin table → STOP AND FLAG
      with the exact proposed policy text and wait for authorization. Do NOT apply it unilaterally.
      Do NOT use service-role. Do NOT hardcode handles.
  If TRAP 1 cannot be resolved cleanly, STOP — do not proceed to the actions.

STEP 3 — ADR-018 (record in ADR.md; confirm 018 is next free): checkout atomicity. A checkout touches
orders + N order_items + 2 payments + a status-history row. AC-BUY-6 says ATOMIC and an order without
items/payments is NOT a valid resting state, so the ADR-013 draft-first escape does not apply →
expected outcome = SECURITY INVOKER rpc (ADR-012 pattern: orders_insert + orders_phone_gate + the new
payments INSERT policy all bite THROUGH invoker; PostgREST wraps one transaction; EXECUTE granted to
authenticated only, PUBLIC revoked; search_path pinned; REG-32 CI-typegen — NEVER hand-add the
signature, budget the boundary-cast iteration). Evaluate honestly; if decomposition genuinely survives
AC-BUY-6, argue it. If a second distinct decision emerges (e.g. the orders transition trigger), record
it as ADR-019.

STEP 4 — MIGRATION (ONE, additive; REG-49; ERD §3 rows 54/57-58 + the OD-8 §10 amendment):
  payments INSERT — buyer of the parent order (EXISTS on betk.orders … buyer_id = auth.uid()), plus
    is_admin() if the ERD row carries it. Quote the ERD row; do not broaden.
  payments UPDATE — the THREE-LAYER shape (TRAP 2), all three:
    1. REVOKE UPDATE ON betk.payments FROM authenticated;
       GRANT UPDATE(status, confirmed_by, confirmed_at, notes, proof_path, transfer_reference)
       ON betk.payments TO authenticated;
       (amount / payment_type / order_id / method become untouchable by authenticated — that is the
       load-bearing win. service_role/postgres/anon grants untouched; state them before and after.)
    2. permissive UPDATE policy scoped to parties via the parent order (buyer_id = auth.uid() OR
       betk.is_admin()). The SELLER gets NO payments UPDATE.
    3. BEFORE UPDATE trigger enforcing actor↔column legality against OLD, RAISING (not a silent
       0-row no-op): status/confirmed_by/confirmed_at/notes changed → require betk.is_admin();
       proof_path/transfer_reference changed → require caller = parent order's buyer AND
       payment_type='deposit' AND OLD.status='pending'.
  orders UPDATE — same three layers:
    1. REVOKE UPDATE ON betk.orders FROM authenticated; GRANT UPDATE(status, cancelled_by,
       cancellation_reason) TO authenticated. (delivered_at/tracking columns stay ungranted — Phase 08.)
    2. permissive UPDATE policy: buyer own OR store via betk.my_store_id() OR betk.is_admin().
    3. BEFORE UPDATE trigger for transition legality (WITH CHECK cannot see OLD): pending→confirmed
       only by the store AND only when the order's deposit payment row is status='confirmed'
       (AC-SEL-14 custodial gate, DB-authoritative — REG-33's lesson about app-only guards);
       →cancelled only from pending and only by the buyer (R-O03); confirmed→preparing store-only;
       everything else RAISEs. Phase-08 transitions are NOT admitted here.
  Plus the TRAP-1 commission trigger if STEP 2 chose (i). Plus moderation_logs INSERT ONLY if ERD §3
  specs it (else mint REG-66 and defer). NOTHING ELSE TOUCHED — do not smuggle the REG-36 initplan
  wrap, do not touch shipments (Phase 08), do not add a storage policy.
  Apply via MCP apply_migration → rename the local file to the MCP-recorded version → ledger 30→31 1:1
  (paste) → backfill BETK_DATABASE_SCHEMA.sql → advisor sweep, state old + new baselines, 0 unexplained
  findings.

STEP 5 — ACTIONS (src/features/checkout/ + src/features/orders/, "use server", Zod-before-DB,
discriminated unions, never throw to the client, no service-role, file-path imports for consumers,
check-zod-coverage must cover all):
- createOrderFromInquiry(inquiryId, addressId, deliveryMethod, depositMethod) — BUYER.
  requireVerifiedPhone() FIRST (typed phone_required / unauthenticated / blocked for T03 routing).
  R-O01: source inquiry status='confirmed' AND caller's own AND converted_to_order_id IS NULL
  (already-converted → typed already_converted + the existing order id, idempotent).
  payment_config_missing: if ZERO BETK handles are set, return that typed outcome and CREATE NOTHING.
  Resolves listing/store/price/subtotal server-side — never client-supplied amounts. delivery_fee from
  admin_settings; whether the flat fee applies to pickup/remote is NOT pinned anywhere → CITE-OR-FLAG,
  do not invent (if unpinned, state your choice explicitly as an engineering decision in the action
  header). R-O02 BETK-ref BETK-YYYYMMDD-XXXX, app-generated, retry on 23505.
  Address = caller's own row. delivery_method validated against the store's enabled modes (REG-14).
  TWO payments rows, always: deposit = round(total_amount/2, 2) with method = the buyer's chosen BETK
  handle (instapay|vodafone_cash|orange_cash — offer only handles that are non-empty); balance =
  total_amount − deposit with method='cod'. Both status='pending'. NO pure-COD path.
  Order INSERTs status='pending'. Do NOT write converted_to_order_id (ADR-017's trigger owns it).
  Do NOT auto-confirm anything.
- attachDepositProof(orderId, storagePath, transferReference?) — BUYER; writes proof_path +
  transfer_reference on their OWN order's deposit row only; server re-checks the path is under the
  caller's own auth.uid() prefix in the docs bucket (the T03-Phase-04 contract); idempotent re-upload
  allowed while status='pending' (R-S08: a new upload is a new path, the prior object persists).
- cancelOrder(orderId) — BUYER, own order, pending only (R-O03), typed not_cancellable otherwise;
  writes cancelled_by + cancellation_reason + a status-history row.
- confirmDepositPayment(paymentId) — ADMIN. Build requireAdmin() here (new gate; mirror the
  requireActiveUser/requireVerifiedPhone shape, back it with the same authority is_admin() encodes —
  cite the existing helper, do not invent a second source of truth). Sets status='confirmed',
  confirmed_by, confirmed_at. Idempotent (already-confirmed → typed already_confirmed). Writes
  moderation_logs only if the policy exists.
- acceptOrder(orderId) — SELLER (own-store pin + RLS), requireActiveUser. AC-SEL-14: pending→confirmed
  → decrement_stock_on_confirm fires naturally. Typed deposit_unconfirmed when the deposit row is not
  yet confirmed (mirrors the DB trigger — the app check is for UX, the trigger is authoritative).
  Assert in tests: stock decremented, sold_out flip at 0, and the CHECK(stock_qty>=0) oversell path
  rolls the whole accept back. Idempotent. Writes a status-history row.
- markOrderPreparing(orderId) — SELLER, confirmed→preparing, status-history row.
- NO further transitions (dispatched/delivered/returned are Phase 08 — cite BETK_PHASES, omit).
R-N04-class: capture a PostHog event at order-create, deposit-confirm and accept, each with a code
comment citing Phase 12 for delivery. NO notifications-table writes, NO WhatsApp/email sends.

STEP 6 — QUERIES (lean, typed, injectable client param): getCheckoutContext(inquiryId) (order summary
+ the BETK handles + fee, per TRAP 1's resolution) · getOwnOrders / getOrderDetail (buyer) ·
getStoreOrders / getStoreOrderDetail (seller — includes buyer name + address per REG-44, and the
deposit state for the accept gate) · getPendingDepositPayments (admin queue). NO seller-balance query
(Phase 13).

TESTS — unit (pure rules: split arithmetic, commission rounding, BETK-ref format, transition legality)
+ integration on staging (minted fixtures, cleaned, zero residue re-queried):
  REG-49 both directions on every leg — buyer INSERTs 2 payments on own order / cross-user DENIED;
  buyer attaches proof to own deposit row / to the BALANCE row DENIED / to another buyer's DENIED /
  after confirmation DENIED; buyer UPDATE of payments.status DENIED BY THE TRIGGER (assert the raised
  error, not 0 rows); buyer UPDATE of payments.amount DENIED BY THE GRANT (42501); admin confirms;
  seller has NO payments UPDATE; seller accept BLOCKED while the deposit is pending and ALLOWED after
  (both directions, DB-level); buyer cancel from pending OK, from confirmed DENIED; buyer UPDATE of
  orders.total_amount DENIED BY THE GRANT (42501); stock decrement + sold_out flip + oversell rollback;
  commission snapshot present and correct on the created order; converted_to_order_id written once by
  the ADR-017 trigger.
VERIFY: full CI (typecheck 0 · lint 0 new · guards 4/4 + parity count · unit · integration full suite ·
build both locales + route count) + ledger 31/31 + advisor baselines stated.
CLOSE: REG-49 CLOSED with pasted pg_policies + column_privileges evidence; ADR-018 (+019 if needed)
recorded; TRAP 1 + TRAP 2 resolutions recorded in SESSION_CONTEXT; any REG-66/67/68 minted.
Commit + push. HOLD — do not start T03.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```

**Done when:** TRAP 1 resolved or escalated (never improvised); TRAP 2 landed as all three layers with
grant-level denials proven by error code, not row count; REG-49 closed ERD-verbatim; ADR-018 recorded;
ledger 31/31; advisor 8/6/2/4/1 unchanged or every move explained; both custodial gates
(deposit-before-accept, no pure-COD) proven at the DB level; no service-role anywhere.

---

## T03 — `/checkout` + `/checkout/confirmation/[id]` + proof upload (Sonnet, Medium)

```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T03 — /checkout +
/checkout/confirmation/[id]. Branch feature/phase-07-orders (continue). Sonnet, Medium. COMPOSE-ONLY.

STEP 0: sweep for loading.tsx at/above every segment this task creates that can reach notFound() —
state the finding. Do not add one; delete if found (BL-01-FIX precedent).

/checkout:
- Entry shape per UI_SPEC (cite — expect ?inquiry= via the routes.checkout builder). Non-confirmed /
  foreign / already-converted inquiry → per spec (cite: redirect or notFound).
- Compose the kit AddressForm/AddressSelect for select-or-create (existing addresses RLS, max-one-default
  respected). Delivery method limited to the store's enabled modes (REG-14).
- Order summary with SERVER-computed totals: subtotal, delivery fee, total, and the 50/50 split shown
  explicitly. Commission is NOT shown to the buyer (it is a BETK↔seller concern) — state this.
- Deposit method picker: only BETK handles that are actually configured. If NONE are configured, render
  the payment_config_missing state (typed outcome from T02) and DISABLE submit — never a blank panel.
- Submit → createOrderFromInquiry (file-path import), routing EVERY typed outcome: ok → confirmation ·
  phone_required → /auth/phone (the OD-4 loop, live at last) · already_converted → the existing order ·
  not_confirmed → back to the thread · payment_config_missing → the disabled state · blocked → /blocked.

/checkout/confirmation/[id]:
- Deposit instructions compose BETK's handles from admin_settings (NOT stores.payment_methods —
  custodial, OD-8/ADR-016; displayed, never processed). BETK-ref prominent (R-O02, LTR island in RTL).
- Buyer transfer-screenshot upload → docs bucket under the caller's own auth.uid() prefix → then
  attachDepositProof. PRIVATE bucket: never render a public URL. Re-upload allowed while pending.
- State machine, rendered explicitly: no proof yet → "upload your transfer screenshot" ·
  proof_path NOT NULL AND status='pending' → "awaiting BETK verification" (the binding OD-8 §5
  convention — cite it) · confirmed → "verified, awaiting seller acceptance".
  The verifying actor is BETK/ADMIN, never the seller — the copy must not say "the seller will confirm".
- Outsider / unknown id → hard notFound() by STATUS CODE (assert the code, not the content).

WIRE THE PHASE-06 CTA: the buyer-thread confirmed banner's guidance-only note becomes the real
routes.checkout link (remove the "Phase 07 wires here" comment). Disable/annotate when already converted.

i18n checkout.* both locales, parity pasted. ZERO components/ui + components/shared edits (git diff
--stat proof).
VERIFY: full CI + runtime smoke on next start (minted confirmed-inquiry fixture, forged @supabase/ssr
cookie per the throwaway-smoke precedent, script deleted, residue re-queried = 0): both locales 200 +
correct lang/dir; address select + create; submit creates EXACTLY 1 order + 2 payments + commission
snapshot in the DB; confirmation renders BETK's handles (assert the seller's handles are ABSENT from
the DOM — script/style stripped first, hydration-payload precedent); proof upload writes proof_path and
flips the panel to awaiting-verification; phone-NULL user → /auth/phone; foreign inquiry → per spec;
confirmation hard-404 for outsiders. Commit + push. HOLD — no T04.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```

**Done when:** checkout creates exactly one order + two payments with the commission snapshot; BETK's
handles render and the seller's do not (DOM-proven); proof upload round-trips into the private bucket;
payment_config_missing renders as a real disabled state; the OD-4 phone loop proven end-to-end; hard
404 by status code; zero ui/shared diff.

---

## T04 — Buyer `/orders` + `/orders/[id]` (Sonnet, Medium)

```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T04 — buyer orders.
Branch feature/phase-07-orders (continue). Sonnet, Medium. COMPOSE-ONLY. STEP 0 loading.tsx sweep first.

/orders: getOwnOrders — BETK-ref (LTR island) + listing + localizedName COALESCE + total + StatusBadge +
date. Status filter via the shared Tabs if UI_SPEC pins one (cite; counts only if a lean head-count
query is cheap, else omit and say so). EmptyState from the kit.
/orders/[id]: getOrderDetail — items, address, delivery method, the TWO payment rows with their
individual states (deposit: pending / awaiting verification / confirmed; balance: cod, collected on
delivery and remitted to BETK), OrderTimeline built from REAL order_status_history rows (never
synthesized), cancel action via ConfirmDialog → cancelOrder → router.refresh() (visible only while
pending, R-O03).
- Re-upload path: while the deposit is pending, the buyer can replace the proof (attachDepositProof).
- Tracking section: renders EMPTY-STATE (Phase 08 owns shipment writes) — guidance-only, no fabricated
  route. Review / dispute entry points likewise per the dead-link rule (Phase 09/10).
- NO close/complete affordance anywhere — closure is DERIVED (REG-56). NO seller-balance or earnings
  figure (Phase 13).
- Order-messages thread ONLY if UI_SPEC pins it on this screen — cite-or-omit. Do not conflate
  order_messages with the Phase-06 inquiry thread.
- Outsider / unknown id → hard notFound() by status code.
i18n orders.* both locales, parity pasted. ZERO ui/shared edits (diff proof).
VERIFY: full CI + runtime smoke (minted buyer + order, both locales): list renders; detail shows both
payment rows with correct states; timeline matches the actual history rows in the DB; cancel from
pending flips status in the DB AND writes a history row; cancel absent on a confirmed order; outsider
→ 404 by status code. Commit + push. HOLD — no T05.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```

**Done when:** list + detail live both locales; both payment rows and their custodial states render
correctly; timeline is from real history rows; cancel proven both directions; dead-link rule held for
Phase 08/09/10 surfaces; no closure affordance; zero ui/shared diff.

---

## T05 — `/admin/payments` deposit-verification slice (Sonnet, High)

```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T05 — /admin/payments deposit
verification. Branch feature/phase-07-orders (continue). Sonnet, thinking HIGH (first admin-gated route
+ private-bucket signed URLs). COMPOSE-ONLY over T02's action + query.

SCOPE IS THE §0 SLICE AND NOTHING MORE. Build: the pending-deposit queue, the proof viewer, and the
confirm action. Do NOT build: the full payment ledger, filters, refunds, COD-balance confirm, order
closure (there is no close action — REG-56), or any other /admin/* page. State the deferral in your
report; it goes into the Phase-14 entry checklist at the exit gate.

STEP 0: loading.tsx sweep. Then check whether AdminShell / AdminSidebar exist in components/shared.
  - If they exist: compose them AS-IS.
  - If they DO NOT: STOP-and-flag, mint REG-68, and ship the page functional-but-unshelled composed
    from existing kit primitives (Card/Table/Button/StatusBadge/EmptyState/ConfirmDialog) — the REG-59
    (/account unstyled) precedent. DO NOT author a shell. DO NOT restyle anything.

AUTH GATE: role admin, using T02's requireAdmin() at the route level AND the action level. A non-admin
authenticated user and an anonymous visitor must BOTH get the spec'd rejection — assert the status code.
Do not rely on RLS alone to hide the page.

QUEUE: getPendingDepositPayments — deposit rows with status='pending', newest first. Two visually
distinct groups: proof_path NOT NULL (awaiting BETK verification — actionable) and proof_path IS NULL
(awaiting the buyer's upload — not actionable). Row = BETK-ref + buyer + store + amount + submitted-at.
EmptyState when clear.

PROOF VIEWER: signed URL from the PRIVATE docs bucket via the ADMIN's own session client —
docs_select_own_or_admin already grants admin read, so NO service-role and NO new storage policy
(cite CORRECTION-01 §D2). Short expiry. Never render a public URL, never proxy the bytes through a
public route, never log the URL.

CONFIRM: ConfirmDialog → confirmDepositPayment → router.refresh(). Success copy states the consequence
("the seller can now accept this order"). Idempotent re-confirm handled. NO reject action this phase —
the buyer re-uploads and the admin simply does not confirm; say so in the empty/edge copy.

i18n admin.payments.* both locales, parity pasted. ZERO components/ui + components/shared edits (diff
proof — the shell decision above must not become a shared-kit edit).
VERIFY: full CI + runtime smoke (minted admin + buyer + seller + an order with an uploaded proof, both
locales, throwaway deleted, zero residue): admin sees the queue; NON-ADMIN authenticated user and anon
are BOTH rejected with the correct status code; the signed URL resolves for the admin and a raw public
URL for the same object does NOT; confirm flips payments.status + confirmed_by + confirmed_at in the DB;
the seller-side accept gate (queried directly) flips from blocked to allowed as a result — the
cross-surface proof. Commit + push. HOLD — no T06.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```

**Done when:** the queue, proof viewer and confirm are live and admin-gated; non-admin and anon both
rejected by status code; the signed URL works for admin while the object stays private; confirm is
DB-proven and demonstrably unblocks seller acceptance; the Phase-14 deferral list is written; shell
decision recorded (composed or REG-68 flagged); zero ui/shared diff.

---

## T06 — Seller `/seller/orders` + `/seller/orders/[id]` + accept (Sonnet, Medium)

```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T06 — seller orders.
Branch feature/phase-07-orders (continue). Sonnet, Medium. COMPOSE-ONLY, seller shell.
STEP 0 loading.tsx sweep first.

/seller/orders: getStoreOrders — status filter via the shared Tabs ({id,label,count}; counts only if a
lean head-count query is cheap, else omit and state it). Rows = BETK-ref + listing + BUYER NAME + total
+ StatusBadge + date. REG-44 resolves HERE: one code comment citing the posture — fulfilment requires
the buyer's name and address, pre-order opacity holds everywhere else.

/seller/orders/[id]: full detail incl. buyer name + delivery address (REG-44) + both payment rows.
- ACCEPT (AC-SEL-14, the seller's act — unchanged actor) via ConfirmDialog → acceptOrder →
  router.refresh(). GATED on the admin-confirmed deposit: while the deposit is pending, render the
  gate state ("awaiting BETK deposit verification") with the CTA disabled and the reason stated —
  never a silent no-op, never a fabricated "confirm payment" affordance for the seller. The seller has
  no payments write path at all (T02 RLS) — do not build one.
- Also wire markOrderPreparing (confirmed→preparing). Terminal states render read-only. NO dispatched/
  delivered/returned actions (Phase 08). NO close action (REG-56). NO earnings/balance figure (Phase 13).
- The seller's own settlement handles are NOT shown here; if any copy on this screen implies the buyer
  paid the seller, it is wrong — flag it rather than reword shared-kit strings.
- Cross-seller / unknown id → hard notFound() by status code.
- Nav: add orders to SellerChrome (the route exists after this task — deferral-closing pattern).
i18n seller.orders.* both locales, parity pasted. ZERO ui/shared edits (diff proof).
VERIFY: full CI + runtime smoke (minted buyer + seller + admin, both locales): tabs filter; ACCEPT is
DISABLED with the gate reason while the deposit is pending; after the admin confirms via /admin/payments
(T05, from the UI), ACCEPT succeeds → orders.status='confirmed' in the DB AND stock decrements via the
trigger AND the buyer's /orders/[id] timeline reflects it — the full cross-surface chain; oversell path
returns the typed outcome and rolls back; cross-seller → 404 by status code.
Commit + push. HOLD — no T07.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```

**Done when:** seller list/detail/accept live; the custodial gate is visibly enforced (disabled + reason,
not a silent failure); admin-confirm → seller-accept → stock-decrement → buyer-timeline proven from the
UI in one chain; REG-44 comment present and pre-order opacity unregressed; nav extended; zero ui/shared
diff.

---

## T07 — Exit verification + consolidated PR prep (Opus, Max)

```
Read SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 07 T07 — exit gate. Opus, MAX.
ZERO feature-code changes (docs-only + a throwaway E2E that is deleted).

1. DoD LEDGER — PASS/FAIL with evidence per line:
   REG-49 closed ERD-verbatim (pg_policies + column_privileges pasted) · grant-level denials proven by
   ERROR CODE 42501 not row count · the payments and orders BEFORE UPDATE triggers RAISE on illegal
   actor↔column combinations · AC-BUY-6 atomic (order + items + 2 payments, rollback leaves zero
   residue) + only-from-confirmed · exactly TWO payments rows per order, NO pure-COD order anywhere
   (query the whole table) · commission snapshotted on subtotal (not total_amount), rate + amount both
   present, arithmetic re-verified in SQL · R-O02 BETK-ref format + uniqueness · R-O03 cancel
   pending-only · AC-SEL-14 seller-accept gated on the admin-confirmed deposit, DB-authoritative ·
   NO auto-confirm anywhere (grep + DB) · stock decrement fires on the natural pending→confirmed
   UPDATE · status history written on EVERY transition · REG-56 respected: NO close action, NO invented
   enum member (re-quote pg_enum) · buyer never sees stores.payment_methods (grep + DOM) ·
   requireVerifiedPhone at checkout ONLY (grep: absent from seller/admin transitions) · requireAdmin on
   both the /admin/payments route and the action · money no-float (grep for ::float / Number( on
   amounts) · no service-role (guard) · proof_path objects are in the PRIVATE docs bucket and
   unreachable publicly · REG-44 recorded + buyer identity STILL grep-absent from all PRE-order seller
   surfaces · binding rules held (loading.tsx sweep whole-app, file-path imports, compose-only diff,
   dead-link rule for Phase 08/09/10/13/14 surfaces).
2. E2E FULL CUSTODIAL LIFECYCLE (staging throwaway, minted + cleaned, residue re-queried = 0):
   inquiry → seller confirms → checkout → order pending + 2 payments pending + commission snapshot →
   buyer uploads proof → seller accept BLOCKED (assert) → admin confirms deposit → seller accepts →
   stock decrements → sold_out flip at 0 → REG-25 public detail still renders → buyer timeline updated
   → seller marks preparing. Plus: cancel path on a fresh pending order; payment_config_missing path
   with handles blanked (restore after); outsider sees nothing on any of the 7 surfaces.
3. DB LIVE STATE (MCP): ledger 31/31 1:1; every Phase-07 policy + grant + trigger quoted; advisor =
   the T02-stated baseline, 0 new; every DEFINER object search_path-pinned + EXECUTE-revoked.
4. REGISTER + DOCS: REG-49 CLOSED · REG-57 confirmed closed · REG-56 restated as satisfied-by-design ·
   REG-62 RESTATED AS THE STANDING HARD PRE-LAUNCH GATE with the current values of all six keys read
   live (commission 0 = revenue leak; empty handles = no checkout destination — say so plainly) ·
   REG-44 resolution recorded · any REG-66/67/68 recorded · Phase-07 entry checklist all-✅ ·
   PHASE-08 ENTRY CHECKLIST written (shipments/tracking WRITE policies, Bosta webhook idempotency,
   delivered_at opens the review window, COD-balance confirm, the dispatched/delivered/returned
   transitions + their column grants) · PHASE-13 ENTRY CHECKLIST written (derived seller balance:
   subtotal − commission_amount, approved = delivered AND both payments confirmed AND
   delivered_at + return_hold_hours < now() AND no active dispute, minus processed payouts; NO ledger
   table) · PHASE-14 ENTRY CHECKLIST written (the deferred /admin/payments remainder: ledger, filters,
   refunds, COD-balance confirm, reject/failed path, moderation surface; plus the admin shell if
   REG-68 was minted) · UI_SPEC acceptance matrix rows (7 screens) · ADR-018 (+019) confirmed ·
   API_STANDARDS per BETK_PHASES' docs line · SESSION_CONTEXT (slim discipline — rotate recent-work,
   no narrative regrowth) + journal + this pack's results tracker.
5. Full CI green (typecheck · lint 0 new · guards 4/4 + parity · unit · integration full suite · build
   both locales + route count — state the new count). Push. Open the consolidated PR
   feature/phase-07-orders → main titled "Phase 07: Orders, Checkout & Custodial Split Payments
   (T01b–T06 + REG-49)" — a migration is present so the R5 RLS-smoke job MUST fire; state that
   expectation in the body, and state REG-62 in the body as the outstanding pre-launch gate.
   HOLD — the human merges.
Env: Windows/PowerShell — no &&. No credentials in output or chat.
```

**Done when:** every ledger line PASSes with evidence; the full custodial lifecycle is proven
zero-residue including the blocked-then-unblocked accept; ledger 31/31 and advisor at baseline; the
Phase-08, Phase-13 and Phase-14 entry checklists are written; REG-62 restated as the live pre-launch
gate; PR open and held.

---

## §6 — Docs to update across the phase

`ADR.md` (ADR-018 atomicity, ADR-019 if a second decision lands) · `BETK_DATABASE_SCHEMA.sql` (REG-49
policies + grants + triggers + any rpc) · `API_STANDARDS.md` · `SESSION_CONTEXT.md` ·
`DEVELOPMENT_JOURNAL.md` · `PRECEDENTS.md` (candidate new row: *three-layer actor↔column write
control* — grant + policy + OLD-aware trigger — if T02 lands it) · `BETK_UI_SPEC.md` acceptance matrix ·
this pack's results tracker.

## §7 — Results tracker

| Task | Model | Thinking | Status | Branch | Gate | Notes |
|---|---|---|---|---|---|---|
| T00 housekeep+reorg | Sonnet | High | ✅ 2026-07-22 | — | — | SESSION_CONTEXT slim + PRECEDENTS + effort rule |
| T01 DB+RLS | Opus | Max | ✅ 2026-07-23 | feature/phase-07-orders | CI green · ledger 29 · advisor 8 INFO | REG-09/48 CLOSED, REG-49 opened; mig `20260723074953`; ORDER-SET CONTRACT pinned; ADR-017 trigger; shipments READ-now/WRITE-Phase-08 |
| T01b hygiene+sweep | Sonnet | High | — | — | — | branch re-cut from post-#49 main; unit accounting; 4 OD-8 doc residues |
| T02 write layer + REG-49 | **Opus** | **Max** | — | — | — | TRAP 1 + TRAP 2; ADR-018; ledger 30→31 |
| T03 checkout UI | Sonnet | Medium | — | — | — | BETK handles + proof upload + awaiting-ADMIN state |
| T04 buyer orders | Sonnet | Medium | — | — | — | two payment rows + derived states; no closure affordance |
| T05 admin deposit verification | Sonnet | **High** | — | — | — | §0 slice ONLY; first admin-gated route; signed URL |
| T06 seller orders + accept | Sonnet | Medium | — | — | — | accept gated on admin-confirmed deposit; REG-44 |
| T07 exit gate | **Opus** | **Max** | — | — | — | full custodial E2E; Phase-08/13/14 checklists; PR held |

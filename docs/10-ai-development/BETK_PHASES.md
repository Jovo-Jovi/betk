# BETK_PHASES.md
> Step 15 of the BETK Dev OS. **v2 build plan (B6, 2026-09-22).** Phases, entry criteria, evidence exit gates, and headline tasks. Each phase’s **T00 writes that phase’s pack**. This file does not write packs and does not write the Stage C schema delta.
>
> **Authority, in order:** [`BETK_PRD.md`](../01-product/BETK_PRD.md) → [`BETK_ERD.md`](../03-database/BETK_ERD.md) (tables **FROZEN at 51**, OD-20) → [`BETK_UI_SPEC.md`](../00-design/BETK_UI_SPEC.md) (pages **FROZEN at 79**, OD-21; cite §0–§9) → [`BETK_MVP_SCOPE.md`](../01-product/BETK_MVP_SCOPE.md) → [`ADR.md`](../02-architecture/ADR.md) (ADR-001..025) → [`BETK_V2_STAGE_A_BRANCH_DISPOSITION.md`](./BETK_V2_STAGE_A_BRANCH_DISPOSITION.md). The historical block at the bottom is the **v1 plan being rewritten**, not the target.
>
> **Layer:** phase order, who owns each frozen item, and the headline task that a later T00 expands. **No `src/`.** **No SQL.** Planning does not add a table, a page, or a requirement.
>
> **Numbers taken at mint (re-read 2026-09-22 before taking):** register header `REG-01..REG-92; next free = REG-93`. No `REG-93` row. **None taken.** No new OD. Next free stays **REG-93**. Next free ADR stays **ADR-026**.

---

> ## TABLES ARE FROZEN at 51 (OD-20). PAGES ARE FROZEN at 79 (OD-21).
>
> Live physical tables **today** remain **43** until Phase 08. That figure is **TRUE TODAY**. The v2 target is **51**.

---

## Numbering

**Operative phases are 01–06 (signed), 07 (retired hole), and 08–20 (v2 execution).**

| Numbers | What they are |
|---|---|
| **01–06** | Signed history on `main`. They keep their numbers and their already-shipped scope. v2 does not reopen them. |
| **07** | **Retired. Never reused.** Tag `archive/phase-07-v1-single-seller`. SESSION_CONTEXT: do not resume Phase 07 as written. A new pack numbered 07 would point at that archive. |
| **08–20** | The v2 build, in dependency order below. **08 is the next integer after the hole.** |
| **§H headings 08–14, DS, N-3, N-2, N-1, N** | The unbuilt **v1** sequence. Superseded in place. They are **not** these phases. A journal line that says “Phase 08 owns shipment write” means that unbuilt v1 heading. |

Why this and not a second series: one integer sequence, with a permanent hole at 07, is the rule a later T00 can follow without inventing a prefix. v1’s 08–14 were never executed, so keeping those integers for new work would make one number mean two plans. The hole is only at 07, because that number is an archived branch. The v1 08–14 text stays in §H under renamed headings so the operative `## Phase 08` is unique.

**Task rows.** Model is **Grok 4.7 (high)**. **CF-9:** that tier satisfies every former Opus row. Tiers are **Max / High / Medium / Low**. **SUPERSEDED in place:** “the 2026-07-22 effort rule’s job split” named Opus and Sonnet. The job split itself is unchanged: **Max** = exit gates, RLS, read-first audits · **High** = migrations, write layers, security review, salvage, T00 packs · **Medium** = compose-only UI on a settled query layer · **Low** = mechanical housekeeping. Do not report a model mismatch because the window is Grok 4.7. T00 writes the pack from this section. T00 does not add scope.

**Page owner** = the phase that creates the route, or the signed phase that already shipped it when v2 does not change the route’s behaviour. A later phase may add one named control on that route (disabled until then — guidance-only dead-link rule). It does not become a second owner.

**PRD owner** = the phase that makes the operative v2 text true. A superseded or retired code is owned by the phase that implements the successor and must not rebuild the retired behaviour. Implied same-ID ACs (`BETK_PRD.md` §1.3) inherit the parent FR’s phase and are listed on that phase’s `CODES:` line so they are not dropped.

**Table first write** = the phase that first inserts domain rows under the v2 contract. Signed phases keep that role when the write path already shipped. **RLS phase** = the phase that lands the v2 policy in `BETK_ERD.md` §8. If the live policy already matches §8, the signed phase that landed it stays the RLS phase. If §8 adds or reworks the policy, **Phase 08 lands it before any later phase reads or writes the table.** No table reaches its write phase with a specced policy still absent (the #14 class).

---

## 0. Build-start entry criteria

Nothing in Phase 08 starts until the rows whose “Before” cell is **Phase 08** are true. The Claude Design rows are in this list because the first **UI** phase needs them; they do not block the schema phase.

| Criterion | Owner | Before | Evidence it is true |
|---|---|---|---|
| **B7 merged** to `main` | B7 | Phase 08 | `main` contains the B7 merge commit. **SUPERSEDED in place (B7, 2026-09-23):** “B7 still owns the REG-65 register gap (no row). This plan does not mint it.” B7 wrote the row. It is **open**, v2 owner **Phase 09**. The number stays burnt. Next free stays **REG-93**. The criterion “B7 merged before Phase 08” stays. |
| **Stage C schema-delta plan approved** | Stage C author + human approval | Phase 08 | A written Stage C plan exists and is approved. This file names what that plan must contain. It does not write the SQL. |
| **REG-77 ruleset live** | Human — GitHub branch protection or ruleset | Phase 08 | Required checks are **all eight** names from `.github/workflows/ci.yml`: `Install` · `Lint` · `Typecheck` · `Vitest (unit)` · `Guards` · `Types drift` · `Build` · `RLS smoke (staging)`. A list of one (`RLS smoke (staging)`) does not satisfy this row. |
| **Guard set scheduled** | This plan (the schedule). Phase 08 builds them. | Phase 08 (schedule must already name an owner; the build is a Phase 08 task) | REG-47 (Guard E), REG-67 (Guard F), REG-74 (Guard G), and REG-92 each have one owner in §4. They are not built inside a feature task. |
| **REG-92 is not a typecheck** | Phase 08 | The guard lands with the ADR-020 grant | Generated `Row` types still list `delivery_fee` and `total_amount` after `REVOKE SELECT`. `tsc` stays green on `select *` / `RETURNING *`, and Postgres raises `42501` at runtime. The guard is a **lint or a runtime test**. It is not `Typecheck` and it is not Types-drift. A later `ADD COLUMN` on `seller_orders` is invisible to `authenticated` until that same migration grants it; the two hidden columns stay ungranted. |
| **Claude Design deliverables the first UI phase needs** | Stage D (Claude Design) | **Phase 09**, the first UI phase | The §8 rows named on Phase 09’s block line exist in `components/ui` or `components/shared`. Cursor composes them. Cursor does not restyle the kit to fill a gap. |

---

## 1. v2 phases

Dependency order: **08 schema → 09 signed-surface delta → 10 cart → 11 checkout → 12 deposit → 13 seller orders → 14 courier → 15 returns → 16 reviews and disputes → 17 notifications → 18 admin → 19 earnings and analytics.** **Phase 20 (boosts)** may start after Phase 09’s exit, in parallel with 10–19. It does not sit on the order path.

### Phase 08 — Schema delta (Stage C execution)

- **Goal.** Apply the approved Stage C plan on staging: N27 forward-migration, ADR-020..025 database objects, and every v2 RLS policy that is not already live and matching. No page.
- **Entry.** §0 rows whose Before cell is Phase 08. Ledger is 1:1 before the first new migration (REG-24). Do not resume Phase 07.
- **Exit gate (evidence).** All of the following, pasted or green, not asserted:
  1. `list_migrations` local names equal remote versions after the delta.
  2. The 7 history-bearing order ids from `BETK_ERD.md` §4 still exist, each with a `master_orders` parent. `no_update_order_history` / `no_delete_order_history` and the NO ACTION history FK are unchanged.
  3. `pg_policies` for every new table and for every §8 policy Phase 08 adds. `sessions` and `otp_tokens` stay **zero policies** (the §8 cell is “none for clients”; service role bypasses RLS). Do not add a permissive policy to match the “must be added” list when the cell is empty.
  4. `column_privileges`: `authenticated` has no SELECT on `seller_orders.delivery_fee` or `total_amount`, and has SELECT on the other columns present in that migration.
  5. REG-92 lint or runtime test **red** on `select *` / `RETURNING *`, **green** on an explicit column list. `tsc` on a `select *` is not the evidence.
  6. `pg_proc` slice of **`checkout_from_cart`**: `delivery_fee` and `total_amount` are inserted from locals; the function does not SELECT or RETURN them. B5 measured that shape only on `create_order_from_inquiry`.
  7. Migration order: `trg_decrement_stock_on_confirm` is dropped **before** any backfill `UPDATE` that sets `confirmed`.
  8. `pg_trigger` shows the ADR-023 equality trigger on **both** `store_pickup_addresses` writes and `stores.governorate` updates.
  9. `pg_proc` has **no** function that writes `inquiries.converted_to_order_id`. The column and its NO ACTION FK still exist.
- **Owns.** No pages. Codes, tables, and ADR-020..025 as in §4. The four B5 carry-forwards are tasks below, not a later phase.
- **Salvage.** `modlog_admin_insert` is **already live** on `main` (migration `20260723140552`). Do not restore it from the archive and do not add a second policy. Exit evidence re-reads `pg_policies`.

| Task | Model | Thinking |
|---|---|---|
| T00 write `phase-packs/PHASE_08_SCHEMA.md` from this section only | Grok 4.7 | High |
| Read-first: live policies vs `BETK_ERD.md` §8, grants, the four triggers ADR-025 names | Grok 4.7 | Max |
| N27 / REG-76: rename `orders` → `seller_orders`, synthetic master per existing row including the **7 zombie orders**, copy `buyer_id`, `delivery_address_id`, `betk_ref` onto the master, do not drop them from the child | Grok 4.7 | Max |
| **CF-1.** ADR-025 sequencing: detach `decrement_stock_on_confirm` before any backfill that sets `confirmed` | Grok 4.7 | Max |
| **CF-2.** ADR-020 on the **new** `checkout_from_cart`: insert `delivery_fee` and `total_amount` from locals; never SELECT or RETURN them | Grok 4.7 | Max |
| **CF-3.** ADR-023: pickup `governorate` = `stores.governorate` on pickup-address writes **and** on `stores.governorate` updates | Grok 4.7 | Max |
| **CF-4.** Drop `trg_set_inquiry_converted_order`. Keep `converted_to_order_id` as a legacy column with **no writer** | Grok 4.7 | Max |
| ADR-020..025 objects otherwise named in ADR.md (grant revoke + column grant, proof-copy trigger, ADR-022 allocation inside `checkout_from_cart`, `enforce_order_transition` rework, `enforce_payment_update` writes `refunded_subtotal` as the goods portion, payout INSERT cap, REG-69 allow-list becomes exactly `betk_instapay_handle`, `order_status.ready` only, `storage.objects` seller-NO on the `docs` bucket) | Grok 4.7 | Max |
| RLS for the eight new tables and for §8 policies that are absent or rebuilt (`dispute_evidence`, `dispute_messages`, `flagged_content`, `restock_alerts`, `seller_strikes`, `whatsapp_templates`, rebuilt order/payment/shipment policies). Confirm zero policies on `sessions` and `otp_tokens` | Grok 4.7 | Max |
| REG-47, REG-67, REG-74, and the REG-92 lint or runtime test | Grok 4.7 | High |
| Exit evidence in the pack’s gate note | Grok 4.7 | Max |

`CODES:` R-L05, R-L11, R-L12, R-L13, R-L14, R-L15, FR-STK-1, AC-STK-1, AC-STK-2, AC-STK-3, AC-STK-4, AC-STK-5, R-O03, R-O16, R-O22, R-O27, R-O28, FR-COM-1, AC-COM-1, AC-COM-2, R-K02, R-K04

### Phase 09 — v2 delta on signed 01–06 surfaces

- **Goal.** T&C at signup. Catalogue: products only, fixed price, shipping attributes, store categories max 3, food branch. Onboarding: pickup address, seller agreement, delivery-mode toggles retired. REG-51 and REG-72 through the §8 gap list (compose, do not restyle).
- **Entry.** Phase 08 exit evidence. **Pins before this phase’s agreements work:** REG-75 (backfill vs forced re-accept) and REG-88 (which of the four documents are in the completion gate — do not hard-code the set). **REG-85:** do not state how `stores.return_policy` relates to `/legal/returns`. P05 and P28 keep showing store policy with that relationship unstated.
- **Exit gate (evidence).** Integration or HTTP proof, per surface: signup without current Buyer T&C creates no usable account (AC-AGR-1); onboarding submit without a seller-agreement acceptance row is refused (AC-AGR-3); a service listing publish is refused (AC-CAT-1); a listing without weight or dimensions is refused (AC-CAT-2); a fourth store category is refused (AC-CAT-4); food publish without food approval is refused (R-S10); P23 and P27 render no `{delivery, pickup, remote}` toggles and onboarding no longer stores a delivery fee (REG-65; close by deletion under OD-10, baseline §11); P04 share and P01–P05 store-name navigation use the Stage D components (DOM has the control, not only the hydration string).
- **Owns.** Pages and codes on the `PAGES:` / `CODES:` lines.
- **Blocked.** Stage D: **ShareButton** (REG-51; P04, P05), **Navigable store identity** (REG-72; P01, P02, P04, P05), **DataTable** (P33), **ProofViewer** (P49). Stage E / legal gate: lawyer-reviewed **Buyer T&C, Seller Agreement, Return & Refund Policy, Privacy Policy** before P67–P70, the signup acceptance, and the seller e-sign show that prose. REG-62’s **price band** blocks **launch** of publish (AC-CAT-3). Building against a sentinel is not launch.

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| P08 + P67–P70 acceptance capture (prose is Stage E; engineering is the record) | Grok 4.7 | Medium |
| P23 pickup, categories ≤3, seller agreement, food artefacts; P27 is pickup address; delivery-mode toggles removed | Grok 4.7 | Medium |
| P31, P32, P33 catalogue rules (products, fixed price, shipping attributes, prep cap, approved categories) | Grok 4.7 | Medium |
| P49 food and seller approval, composing ProofViewer | Grok 4.7 | Medium |
| P01, P02, P04, P05: guest cannot add to cart; service filter removed; share and store-name link composed | Grok 4.7 | Medium |
| P29 settlement copy (REG-64). REG-53 closes by R-K01 (modes are retired; do not derive a mode from category) | Grok 4.7 | Low |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P01, P02, P04, P05, P08, P23, P27, P29, P31, P32, P33, P49, P67, P68, P69, P70

`CODES:` FR-PUB-1, FR-PUB-2, FR-PUB-4, FR-PUB-5, AC-PUB-1, AC-PUB-2, AC-PUB-4, AC-PUB-5, FR-AUTH-3, AC-AUTH-3, FR-SEL-1, FR-SEL-5, FR-SEL-7, FR-SEL-9, FR-SEL-10, AC-SEL-1, AC-SEL-5, AC-SEL-7, AC-SEL-9, AC-SEL-10, FR-CAT-1, AC-CAT-1, AC-CAT-2, AC-CAT-3, AC-CAT-4, AC-CAT-5, AC-CAT-6, R-L01, R-L04, R-L09, R-L16, R-L17, R-L18, R-L19, R-L20, R-L21, R-L22, R-S10, R-K01, R-V03, AC-VIS-2, FR-AGR-1, R-G01, R-G02, R-G03, R-G04, R-G05, R-G06, R-G07, R-G08, AC-AGR-1, AC-AGR-2, AC-AGR-3, AC-AGR-4, AC-AGR-5, FR-ADM-2, AC-ADM-2, R-M01

### Phase 10 — Cart and quoting

- **Goal.** Account before add-to-cart. Seller quote (band, 24h, prep) writes a cart line. No confirmed-inquiry checkout CTA.
- **Entry.** Phase 09 exit evidence. **REG-79 is pinned** (add-to-cart vs checkout). This phase does not choose the trigger and does not encode one. If the pin says add-to-cart requires a verified phone, Phase 11 implements that check (it owns FR-AUTH-4) and may edit the cart action. CartLine is in the kit.
- **Exit gate (evidence).** AC-CART-1..7 and AC-QTE-1..6 as integration tests: guest add leaves zero `cart_items`; over-stock add is refused; quote accept inserts one line at the quoted price; expired quote blocks the line; payment-window expiry restores fixed-price lines and restores a custom line only while `quote_expires_at` is in the future (REG-82). Quote expiry is derived from `quote_expires_at` at read (R-Q06); it is not a cron. The production payment-window sweeper is Phase 11 (§8). This exit’s evidence is the integration test.
- **Owns.** P13, P14, P36, P37, P66 and the cart/quote codes.
- **Blocked.** Stage D: **CartLine** (P66, and the checkout page’s lines when Phase 11 starts).

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| Quote write on P37; accept on P14 inserts `cart_items` | Grok 4.7 | High |
| P66 cart, composing CartLine; P13 list drops the checkout CTA | Grok 4.7 | Medium |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P13, P14, P36, P37, P66

`CODES:` FR-CART-1, FR-BUY-5, FR-SEL-13, FR-QTE-1, R-C01, R-C02, R-C03, R-C04, R-C05, R-C06, R-C07, R-Q01, R-Q02, R-Q03, R-Q04, R-Q05, R-Q06, R-Q07, R-Q08, AC-CART-1, AC-CART-2, AC-CART-3, AC-CART-4, AC-CART-5, AC-CART-6, AC-CART-7, AC-QTE-1, AC-QTE-2, AC-QTE-3, AC-QTE-4, AC-QTE-5, AC-QTE-6, AC-BUY-5, AC-SEL-13

### Phase 11 — Checkout

- **Goal.** One cart checkout writes one master, N seller orders, N shipments, and two payment rows per child, or nothing. Version gate before completion. No delivery-mode picker.
- **Entry.** Phase 10 exit evidence. **REG-81 pinned** (child `display_ref` format — do not invent `BETK-2026-000123`). REG-88 still pinned (Phase 09 did not hard-code the document set). CheckoutSellerSections is in the kit. Stage E prose for whichever documents the pin puts in the gate.
- **Exit gate (evidence).** One integration test: N-seller cart → 1 `master_orders` + N `seller_orders` + N `shipments` + 2N `payments`, stock decremented, `converted_to_order_id` unchanged. A second test: the same attempt rolled back leaves zero of those rows (AC-CHK-1, AC-CHK-2). A buyer with a missing required acceptance gets no master (AC-CHK-4). Response JSON has one combined delivery total and no per-seller fee (AC-CHK-6). Phone-NULL submit navigates to `/auth/phone` (rewired unit test). A further test sets `payment_deadline` in the past and runs the sweeper: the master is cancelled, tracked stock is restored, the cart is restored per REG-82, and one in-app `notifications` row exists for the buyer. Cadence is every minute (§8). SMS is Phase 17.
- **Owns.** P10, P15. **Restores** from `archive/phase-07-v1-single-seller`: `src/features/buyer-account` address query/action + `validations/address.ts`, and `tests/unit/checkoutForm.phoneGate.navigate.unit.test.ts` (rewire call sites; do not merge the rest of that tree).
- **Blocked.** Stage D: **CheckoutSellerSections**. Legal gate: the documents REG-88 names, published. REG-62 **commission %** blocks **launch** (a snapshot of the sentinel `0` is not launch).

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| Restore the address query/action from the archive tag; P10 address book | Grok 4.7 | High |
| P15 checkout calling `checkout_from_cart` only (no `create_order_from_inquiry`) | Grok 4.7 | High |
| Rewire the phone-gate unit test | Grok 4.7 | High |
| Version-gate panel; document set comes from the REG-88 pin | Grok 4.7 | Medium |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P10, P15

`CODES:` FR-CHK-1, FR-BUY-2, FR-BUY-6, FR-AUTH-4, R-A07, R-O01, R-O02, R-O11, R-O12, R-O13, R-O14, R-O15, R-O17, R-O21, R-K03, AC-AUTH-4, AC-BUY-2, AC-BUY-6, AC-CHK-1, AC-CHK-2, AC-CHK-3, AC-CHK-4, AC-CHK-5, AC-CHK-6, AC-COM-3, AC-COU-1, AC-COU-2

### Phase 12 — Deposit and admin verification

- **Goal.** One InstaPay proof on the master. One admin action confirms every child deposit and releases every child. Buyer history is the master. No seller acceptance. COD-balance confirm stays **disabled** on P58 until Phase 14 (stated reason: courier remit is not built).
- **Entry.** Phase 11 exit evidence. **Restores `requireAdmin`** from the archive tag before the first admin write. ProofViewer is in the kit.
- **Exit gate (evidence).** Integration: one `confirm` on a 3-seller master sets three deposit rows confirmed and three seller orders `confirmed` (AC-PAY-4 / AC-ADM-18). A seller `UPDATE` of `pending → confirmed` is refused. Proof reject cancels the children and restores tracked stock (AC-PAY-5). Buyer order detail does not offer cancel after proof (HTTP or action result, R-O22). P58 has no enabled COD-confirm control (DOM). Release inserts one in-app `notifications` row per seller (R-F05: order ref, item count, ready-by). That row is the evidence. SMS is Phase 17.
- **Owns.** P16, P17, P18, P58.
- **Blocked.** Stage D: **ProofViewer**. REG-62 **`betk_instapay_handle` set** blocks **launch** of payment instructions. An empty handle is not a business value.

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| Restore `requireAdmin` / `requireAdminForUser` from the archive tag | Grok 4.7 | High |
| Buyer proof on the master; confirmation page P16 | Grok 4.7 | High |
| P58 one-action release; audit write uses the live `modlog_admin_insert` only if `moderation_target` already allows it (REG-70: do not add an enum member) | Grok 4.7 | High |
| P17, P18 master history; review, dispute, and return controls disabled with a stated reason | Grok 4.7 | Medium |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P16, P17, P18, P58

`CODES:` FR-PAY-1, FR-ADM-10, FR-ADM-18, FR-BUY-7, FR-BUY-8, FR-BUY-9, R-O05, R-O18, R-O19, R-O23, R-O24, AC-PAY-1, AC-PAY-2, AC-PAY-3, AC-PAY-4, AC-PAY-5, AC-PAY-6, AC-PAY-8, AC-ADM-10, AC-ADM-18, AC-BUY-7, AC-BUY-8, AC-BUY-9

### Phase 13 — Seller orders, prep SLA, escalation

- **Goal.** Released orders arrive committed. Seller moves preparing → ready only. Escalation is the only seller exit. Seller sees the §4.a allow-list (subtotal, commission, `refunded_subtotal`, net) and no buyer identity.
- **Entry.** Phase 12 exit evidence. SellerOrderMoney and DataTable are in the kit. `display_ref` renders only when non-null (REG-81 already pinned).
- **Exit gate (evidence).** Seller order JSON for a fixture order **lacks** `delivery_fee`, `total_amount`, buyer name, phone, address, and city, and **includes** subtotal, commission, and net (AC-VIS-1). Seller cancel and seller `pending → confirmed` are refused (AC-SEL-14 retired — the test is the refusal). A 50% and an 80% clock on one order produce two in-app `notifications` rows and then an escalation row (AC-SLA-3). The ladder is a new `pg_cron` every 15 minutes (§8). SMS is Phase 17. Out-of-stock escalation sets `stock_qty = 0` (AC-STK, enforced by the Phase 08 trigger; this phase’s test is the seller action that reaches it).
- **Owns.** P25, P38, P39, P55, P75.
- **Blocked.** Stage D: **SellerOrderMoney** (P25, P38, P39), **DataTable** (P38, P55, P75).

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| P38, P39 seller orders; P25 drops the acceptance queue | Grok 4.7 | Medium |
| Prep deadline and the 50/80 ladder | Grok 4.7 | High |
| P75 escalation queue; no automatic strike (R-E04) | Grok 4.7 | High |
| P55 admin order drawer; fee and child total derived from `payments`, not selected from the hidden columns | Grok 4.7 | High |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P25, P38, P39, P55, P75

`CODES:` FR-SEL-3, FR-SEL-14, FR-SEL-15, FR-SLA-1, FR-ESC-1, FR-ADM-8, FR-ADM-20, FR-VIS-1, R-E01, R-E02, R-E03, R-E04, R-E05, R-F01, R-F02, R-F03, R-F04, R-F05, R-V02, R-V04, AC-SEL-3, AC-SEL-14, AC-SEL-15, AC-SLA-1, AC-SLA-2, AC-SLA-3, AC-SLA-4, AC-SLA-5, AC-ESC-1, AC-ESC-2, AC-ESC-3, AC-ESC-4, AC-ESC-5, AC-ADM-8, AC-ADM-20, AC-VIS-1, AC-VIS-4

### Phase 14 — Courier handoff and COD

- **Goal.** Admin ready-for-pickup queue and the label. COD balance confirmed only after remit. No courier login.
- **Entry.** Phase 13 exit evidence (seller can mark ready). **Courier gate** (below) blocks **launch**, including the REG-78 mechanism choice. The phase may build the admin-RLS read (ADR-024 branch 1) before the gate picks; it must not build a definer, a courier role, or a service-role path until the gate picks branch 2.
- **Exit gate (evidence).** A seller order in `ready` appears on P76; one not in `ready` does not (AC-COU-3 / AC-ADM-19). The handoff test fixture has **no** courier `auth.users` row (AC-COU-6). After the admin handoff the shipment is `dispatched` and the seller cannot set that status (AC-COU-4). Label payload is assembled from `master_orders` and `store_pickup_addresses` under the admin session. P58’s COD confirm, enabled only in this phase, confirms one child’s balance and leaves a sibling’s balance pending (AC-COU-5).
- **Owns.** P63 (settings, including the rate-matrix tab and the WhatsApp-templates tab), P76.
- **Blocked.** Stage D: **RateMatrixEditor** (P63 Rates tab), **CourierLabelSheet** (P76; the component must be unable to mount on a seller route). **Courier gate** blocks launch: rate-matrix numbers, coverage map, and the REG-78 mechanism (admin RLS read, or service-role read — ADR-024, not both, not a definer).

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| P63 rate matrix; REG-69 allow-list stays the single InstaPay key | Grok 4.7 | High |
| P76 queue and label, admin session only, until the courier gate picks | Grok 4.7 | High |
| Enable COD confirm on P58 (page owner remains Phase 12) | Grok 4.7 | High |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P63, P76

`CODES:` FR-COU-1, FR-PAY-2, FR-ADM-14, FR-ADM-15, FR-ADM-19, R-K05, R-K06, R-K07, R-K08, R-K09, R-O04, R-O20, R-V01, R-M07, R-M08, R-N02, AC-PAY-7, AC-COU-3, AC-COU-4, AC-COU-5, AC-COU-6, AC-ADM-14, AC-ADM-15, AC-ADM-19, AC-VIS-3

### Phase 15 — Returns

- **Goal.** Buyer requests a return on a delivered seller order with dedicated evidence. Seller accept leads to refund; seller reject leads to a dispute. Stock does not restore.
- **Entry.** Phase 14 exit is **not** required for the request form. Entry is Phase 12 (a delivered seller order can exist only after the delivery path). **Practical entry: Phase 14 exit**, because delivery is what makes a return eligible. **REG-85 pinned** before this phase says how store policy relates to the platform policy. Do not invent that sentence here if the pin is still open — the phase waits.
- **Exit gate (evidence).** A return insert with evidence lands on `return_evidence` and not on `dispute_evidence` (AC-RET-2). Seller accept does not change `stock_qty` (AC-RET-5 / AC-STK-2). Admin partial refund changes one child and not its sibling (AC-RET-4).
- **Owns.** P71, P72, P73, P74.
- **Blocked.** Stage E: **Return & Refund Policy** (its rules drive the flow). Stage D: **ProofViewer** (P74), **DataTable** (P73).

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| P71 request + evidence; P72 buyer status | Grok 4.7 | Medium |
| Seller accept/reject on P39 (page owner stays Phase 13; this phase adds the return block) | Grok 4.7 | High |
| P73, P74 admin refund | Grok 4.7 | High |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P71, P72, P73, P74

`CODES:` FR-RET-1, R-U01, R-U02, R-U03, R-U04, R-U05, R-O08, AC-RET-1, AC-RET-2, AC-RET-3, AC-RET-4, AC-RET-5

### Phase 16 — Reviews and disputes

- **Goal.** One review per seller order. One dispute per seller order. No master-level review or dispute. Reviews render no buyer name and no buyer location.
- **Entry.** Phase 12 shipped P18, so the review and dispute entry points exist as disabled controls. Enable them here. A delivered or dispatched seller order is required, so Phase 14’s delivery path is the practical predecessor for eligibility. Dispute SLA does not need the courier gate’s mechanism choice.
- **Exit gate (evidence).** Two seller orders under one master accept two reviews and refuse a second review on the same seller order (R-O07). A dispute insert on a master id fails. Resolution writes outcome, a moderation log, and one in-app `notifications` row to each party (AC-ADM-9). The 47h alert is the live hourly `dispute-sla-alert` job (§8); Phase 16’s evidence is the row. The live job sets `channel` to `sms`. SMS delivery is Phase 17. This phase does not rewrite that SQL. The review DOM has the neutral buyer label and no `buyer_profiles` name (REG-44).
- **Owns.** P19, P20, P21, P40, P47, P53, P56, P57.
- **Blocked.** Stage D: **DataTable** (P56).

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| P19, P40, P53 reviews | Grok 4.7 | Medium |
| P20, P21, P47, P56, P57 disputes, including the 47h alert | Grok 4.7 | High |
| Enable the review and dispute controls on P18 | Grok 4.7 | Medium |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P19, P20, P21, P40, P47, P53, P56, P57

`CODES:` FR-BUY-10, FR-BUY-11, FR-BUY-12, FR-SEL-16, FR-SEL-22, FR-ADM-6, FR-ADM-9, R-O06, R-O07, R-R01, R-R02, R-R03, R-R04, R-R05, R-R06, R-R07, R-D01, R-D02, R-D03, R-D04, R-D05, R-D06, R-N05, AC-ADM-6, AC-ADM-9, AC-BUY-10, AC-BUY-11, AC-BUY-12, AC-SEL-16, AC-SEL-22

### Phase 17 — Notifications and buyer saves

- **Goal.** Notification center, wishlist, followed stores, and admin broadcast (fan-out, no campaign table). Launch channel is SMS (R-N07). WhatsApp templates stay on P63 (v2 Phase 14, the courier settings page). Earlier phases insert `notifications` rows as their exit evidence (§8). This phase adds the center and SMS delivery. It does not take over the payment-window sweeper or the prep-SLA ladder.
- **Entry.** Inquiry notifications already exist (Phase 06). This phase adds the center, the restock subscription, and the v2 event set. Navigable store identity is in the kit before P12 wires it.
- **Exit gate (evidence).** A restock from `sold_out` to stock > 0 inserts one notification for a subscriber (R-N06). Unread badge count equals unread rows for that user. Broadcast creates N notification rows and zero campaign rows (OD-3). Channel preference off means that channel is not sent (R-N01).
- **Owns.** P11, P12, P22, P62.
- **Blocked.** Stage D: **Navigable store identity** (P12).

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| P22 center; SMS as the launch channel | Grok 4.7 | Medium |
| P11 wishlist and P12 following | Grok 4.7 | Medium |
| P62 broadcast fan-out | Grok 4.7 | High |
| `restock_alerts` subscribe path (RLS already landed in Phase 08) | Grok 4.7 | High |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P11, P12, P22, P62

`CODES:` FR-BUY-3, FR-BUY-4, FR-BUY-13, FR-ADM-13, R-N01, R-N03, R-N04, R-N06, R-N07, R-N08, AC-BUY-3, AC-BUY-4, AC-BUY-13, AC-ADM-13

### Phase 18 — Admin console

- **Goal.** The remaining admin routes: dashboard, users, listings, flags, categories, collections, moderation log, seller performance. No new table for performance (FR-ADM-21 is derived).
- **Entry.** The domains those screens read have exited (sellers from 09, orders from 13, disputes from 16). DataTable is in the kit. REG-18 stays the decided keep-partial flag labels when a moderation badge first renders. REG-70: do not add a `moderation_target` member.
- **Exit gate (evidence).** Non-admin GET of each new admin route is the not-found status, not 200 (Guard E applies if the page calls `notFound()`). A strike insert is an admin action and does not fire from an SLA breach job (R-E04 already tested in Phase 13; this phase’s test is the P50 action). P77 renders stock-touch and escalation counts with no performance table in `pg_tables` (count stays 51).
- **Owns.** P48, P50, P51, P52, P54, P60, P61, P64, P77.
- **Blocked.** Stage D: **DataTable** (P50, P51, P64).

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| P48, P50, P51, P52, P54 | Grok 4.7 | Medium |
| P60, P61 collections | Grok 4.7 | Medium |
| P64 moderation log (append-only; `modlog_admin_insert` already live) | Grok 4.7 | High |
| P77 derived performance | Grok 4.7 | Medium |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P48, P50, P51, P52, P54, P60, P61, P64, P77

`CODES:` FR-ADM-1, FR-ADM-3, FR-ADM-4, FR-ADM-5, FR-ADM-7, FR-ADM-12, FR-ADM-16, FR-ADM-21, R-M02, R-M03, R-M04, R-M05, R-M06, AC-ADM-1, AC-ADM-3, AC-ADM-4, AC-ADM-5, AC-ADM-7, AC-ADM-12, AC-ADM-16, AC-ADM-21

### Phase 19 — Earnings and analytics

- **Goal.** Derived seller balance, payout request, level, transactions, and seller analytics. No wallet table. `revenue_egp` stays the subtotal-based definition; its writer stays unpinned and must match that definition (do not invent a writer).
- **Entry.** Phase 15 (refunds change the net) and Phase 12 (commission snapshot exists). SellerOrderMoney, DataTable, and ChartSeries are in the kit. REG-86: do **not** add `return_hold_hours` to the REG-62 gate. R-O29 still waits for that window.
- **Exit gate (evidence).** Earnings for a fixture equal `subtotal − commission_amount − refunded_subtotal` and move when `refunded_subtotal` changes, with no ledger row as the source (AC-CLO-3). A payout insert above that net is refused. The seller’s transactions response has no `payments` row and no fee column. P46 chart renders from `seller_snapshots` without selecting `delivery_fee`.
- **Owns.** P41, P42, P43, P44, P45, P46, P59.
- **Blocked.** Stage D: **ChartSeries** (P46), **SellerOrderMoney** (P41, P42, P43), **DataTable** (P42).

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack | Grok 4.7 | High |
| P41, P42, P43, P44 derived net and payout cap | Grok 4.7 | High |
| P45 level; P46 analytics | Grok 4.7 | Medium |
| P59 admin payout processing (manual) | Grok 4.7 | Medium |
| REG-26: spec the `view_count` increment in this pack or record it still open with a named mechanism. Do not invent a service-role write in the task. | Grok 4.7 | High |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P41, P42, P43, P44, P45, P46, P59

`CODES:` FR-SEL-17, FR-SEL-18, FR-SEL-19, FR-SEL-20, FR-SEL-21, FR-CLO-1, FR-ADM-11, R-O09, R-O10, R-O25, R-O26, R-O29, R-S06, AC-CLO-1, AC-CLO-2, AC-CLO-3, AC-SEL-17, AC-SEL-18, AC-SEL-19, AC-SEL-20, AC-SEL-21, AC-ADM-11

### Phase 20 — Boosts (retained v1 scope)

- **Goal.** Ship the retained v1 boost path (REG-80). Do not add a boost requirement.
- **Entry.** Phase 09 exit (listings are products at a fixed price). **Parallel** with Phases 10–19. Not on the order critical path.
- **Exit gate (evidence).** One active boost per listing is enforced by the existing partial unique index (a second insert fails). Admin confirm moves a boost to active. The expire job sets it expired. That job is the live `expire-boosts` schedule, every 15 minutes (§8). No notification row is required for this exit. P02 ranking puts an active boost above an otherwise equal unboosted listing (R-B04). No new boost table in `pg_tables`.
- **Owns.** P34, P35, P65.
- **Blocked.** None on Stage D or Stage E. Boost approval does not need a new kit row in §8.

| Task | Model | Thinking |
|---|---|---|
| T00 write the pack from the retained v1 text | Grok 4.7 | High |
| P34, P35 seller boost purchase and list | Grok 4.7 | Medium |
| P65 admin confirm | Grok 4.7 | Medium |
| Exit evidence | Grok 4.7 | Max |

`PAGES:` P34, P35, P65

`CODES:` FR-SEL-11, FR-SEL-12, FR-ADM-17, R-B01, R-B02, R-B03, R-B04, R-B05, R-L08, AC-SEL-11, AC-SEL-12, AC-ADM-17

---

## 2. Signed phases 01–06

These phases are done. v2 does not add tasks. They remain the owners of the unchanged scope below. Amended pages and amended codes moved to §1.

| Phase | Still owns |
|---|---|
| **01 — Foundation** | RLS for the tables in §4 whose live policy already matches §8 and is not rewritten. No v2 page. No v2 PRD code (feature codes landed in later signed phases). |
| **02 — Auth** | P06, P07, P09, P78, P79. Phone and Google sign-in, OTP, account deactivate, blocked screen. The v2 phone-gate **trigger** is REG-79; the asserted holds are Phase 11. |
| **03 — Catalog** | P03 only. Public category browse and suspended-store hiding on the storefront path that did not move. |
| **04 — Seller** | P24, P26, P28. One store, slug, documents, approval status, store profile, store return-policy **text** (the relationship to the platform policy stays REG-85). |
| **05 — Listings** | P30. Image, Arabic title, soft-delete, sold-out, restock. The v2 catalogue gates are Phase 09. |
| **06 — Messaging** | The inquiry thread tables and their live policies. The quote behaviour and the inbox routes moved to Phase 10. `inquiries.last_message_at` stays unmaintained (REG-43, closed): sort from `max(inquiry_messages.sent_at)`. |

Phase 02 `PAGES:` P06, P07, P09, P78, P79

Phase 02 `CODES:` R-A01, R-A02, R-A03, R-A04, R-A05, R-A06, FR-AUTH-1, FR-AUTH-2, FR-BUY-1, AC-AUTH-1, AC-AUTH-2, AC-BUY-1

Phase 03 `PAGES:` P03

Phase 03 `CODES:` FR-PUB-3, AC-PUB-3, R-S07

Phase 04 `PAGES:` P24, P26, P28

Phase 04 `CODES:` R-S01, R-S02, R-S03, R-S04, R-S05, R-S08, R-S09, FR-SEL-2, FR-SEL-4, FR-SEL-6, AC-SEL-2, AC-SEL-4, AC-SEL-6

Phase 05 `PAGES:` P30

Phase 05 `CODES:` R-L02, R-L03, R-L06, R-L07, R-L10, FR-SEL-8, AC-SEL-8

Phase 06 `PAGES:` none

Phase 06 `CODES:` none

---

## 3. Phase 07 — retired

**Do not resume. Do not number new work 07.** Tag: `archive/phase-07-v1-single-seller`.

The only register item that still said “regenerate the Phase 07 pack” was **REG-57**. **SUPERSEDED (B7, 2026-09-23):** the row is superseded. Phase 07 owns nothing. A retired phase owns no open item. No v2 page, table, or PRD code is owned by 07. Owning one would resume it.

Salvage from that tag is named on Phases 11 and 12. `modlog_admin_insert` is not salvaged; it is already on `main`.

---

## 4. Ownership matrices

### 4.a PRD code → one phase

Every code appears on exactly one `CODES:` line in §1 or §2. Implied ACs are on those lines. Retired and superseded codes:

| Code | Phase | Why that phase |
|---|---|---|
| R-O01, FR-BUY-6, AC-BUY-6 | 11 | Superseded by cart checkout. Phase 11 must not build inquiry-only checkout. |
| R-O04 | 14 | COD auto-confirm stays retired. Balance confirmation is the remit action. |
| AC-SEL-14 | 13 | Seller acceptance stays retired. The exit test is the refusal. |

### 4.b Page → one phase

| Phase | Pages |
|---|---|
| 02 | P06, P07, P09, P78, P79 |
| 03 | P03 |
| 04 | P24, P26, P28 |
| 05 | P30 |
| 09 | P01, P02, P04, P05, P08, P23, P27, P29, P31, P32, P33, P49, P67, P68, P69, P70 |
| 10 | P13, P14, P36, P37, P66 |
| 11 | P10, P15 |
| 12 | P16, P17, P18, P58 |
| 13 | P25, P38, P39, P55, P75 |
| 14 | P63, P76 |
| 15 | P71, P72, P73, P74 |
| 16 | P19, P20, P21, P40, P47, P53, P56, P57 |
| 17 | P11, P12, P22, P62 |
| 18 | P48, P50, P51, P52, P54, P60, P61, P64, P77 |
| 19 | P41, P42, P43, P44, P45, P46, P59 |
| 20 | P34, P35, P65 |

79 pages. P58 stays Phase 12 when Phase 14 enables COD confirm. P18 stays Phase 12 when Phase 16 enables review and dispute. P39 stays Phase 13 when Phase 15 adds the return block.

### 4.c Table → first write, and the phase that lands RLS

| Table | First write | RLS |
|---|---|---|
| `users` | 02 | 01 |
| `otp_tokens` | 02 | 08 (confirm zero client policies; do not add one) |
| `sessions` | 01 (no domain writer; OD-5) | 08 (confirm zero policies) |
| `buyer_profiles` | 02 | 01 |
| `addresses` | 11 | 01 |
| `seller_profiles` | 04 | 04 |
| `seller_documents` | 04 | 04 |
| `seller_strikes` | 18 | 08 |
| `stores` | 04 | 04 |
| `store_pickup_addresses` | 09 | 08 |
| `store_follows` | 03 | 03 |
| `store_categories` | 09 | 08 |
| `categories` | 01 | 01 |
| `listings` | 05 | 05 |
| `listing_images` | 05 | 05 |
| `listing_tags` | 05 | 05 |
| `wishlists` | 03 | 01 |
| `restock_alerts` | 17 | 08 |
| `cart_items` | 10 | 08 |
| `inquiries` | 06 | 06 |
| `inquiry_messages` | 06 | 06 |
| `master_orders` | 08 | 08 |
| `seller_orders` | 08 | 08 |
| `order_items` | 11 | 08 |
| `order_status_history` | 08 | 08 |
| `order_messages` | 13 | 08 |
| `payments` | 11 | 08 |
| `payouts` | 19 | 01 |
| `shipments` | 11 | 08 |
| `shipment_tracking_events` | 14 | 08 |
| `courier_rates` | 14 | 08 |
| `reviews` | 16 | 01 |
| `review_photos` | 16 | 01 |
| `rating_aggregates` | 16 | 01 |
| `returns` | 15 | 08 |
| `return_evidence` | 15 | 08 |
| `disputes` | 16 | 01 |
| `dispute_evidence` | 16 | 08 |
| `dispute_messages` | 16 | 08 |
| `agreement_acceptances` | 09 | 08 |
| `boost_packages` | 20 | 01 |
| `boosts` | 20 | 01 |
| `notifications` | 06 | 01 |
| `collections` | 18 | 01 |
| `collection_listings` | 18 | 01 |
| `flagged_content` | 18 | 08 |
| `moderation_logs` | 18 | 08 (re-read the live `modlog_admin_insert`; do not add a second policy) |
| `whatsapp_templates` | 14 | 08 |
| `admin_settings` | 01 | 08 (REG-69 allow-list rewrite) |
| `seller_snapshots` | 19 | 01 |
| `platform_snapshots` | 19 | 01 |

51 rows. For every row, the RLS phase is the write phase or an earlier one. Phase 08 is earlier than 09–20.

### 4.d ADR-020..025 → implementing phase

| ADR | Phase | What that phase proves |
|---|---|---|
| ADR-020 | 08 | Grant plus REG-92. CF-2 proves the new function does not SELECT the hidden columns. |
| ADR-021 | 08 | Buyer writes the master proof columns; the verification trigger copies them; `payments` authenticated UPDATE no longer includes `proof_path` or `transfer_reference`. |
| ADR-022 | 08 | Allocation inside `checkout_from_cart`. Sum of child deposits equals the master deposit. |
| ADR-023 | 08 | Origin is `stores.governorate`. CF-3 is both write paths. |
| ADR-024 | 08 | No courier role, no courier policy, no definer label function. The mechanism is not chosen here. |
| ADR-025 | 08 | Replace `create_order_from_inquiry`, detach the confirm stock trigger (CF-1), rework `enforce_order_transition`, CF-4 on the inquiry column. |

Phase 14 consumes ADR-024’s open branch. It is not a second implementer of the ADR. The courier gate owns the choice.

### 4.e OPEN REG → one home

Open means the register status is not closed. Standing rules (REG-19, REG-22, REG-24, REG-40, REG-69) stay open with a standing pin and are not re-homed. REG-43’s derive-at-read warning stays with that closed row. **SUPERSEDED (B7):** “REG-65 has no row; B7 reconciles it. This plan does not mint it.” B7 wrote the row. It is open. Owner is Phase 09.

| REG | Home |
|---|---|
| REG-11 | Pre-launch pin. Playwright OAuth. Blocks launch, not a build phase. |
| REG-16 | Phase 09, optional, not an exit blocker. |
| REG-17 | Phase 09, optional, with REG-16. |
| REG-20 | Named pin: first production deploy. No deploy phase in this plan. |
| REG-21 | Phase 08, optional housekeeping, not an exit blocker. |
| REG-23 | Stage D pin. Design-repo URL and SHA. Does not block Phase 09 compose of the kit already in the repo. |
| REG-26 | Phase 19. |
| REG-30 | Named pin: re-verify on every Next upgrade. |
| REG-33 | Named pin: candidate slug trigger. Not in the Phase 08 migration. |
| REG-36 | Named pin: dedicated initplan pass. Not folded into Phase 08 (it would rewrite every policy). |
| REG-37 | Named pin: FK-index leg only (caching leg is closed). Before scale. Not a Phase 08 index migration. |
| REG-47 | Phase 08 (Guard E). Scheduled in §0. |
| REG-50 | Named pin: no support page. A page would be a new OD. None is authorized. |
| REG-51 | Phase 09, blocked on ShareButton. |
| REG-52 | Phase 09 composes `Select`. Not a §8 component. Does not block the phase. |
| REG-53 | Phase 09 closes the decision by R-K01. No mode derivation. |
| REG-54 | Phase 08 doc sweep when the rename lands. Docs only. |
| REG-56 | Phase 19. Derived closure. No new enum member. |
| REG-57 | **Superseded (B7).** Not open. Phase 07 owns nothing. Successor work is v2 Phases 11, 12, 13, and 14. |
| REG-58 | Stage D pin. Existing `SearchBar`. Does not block Phase 09. |
| REG-59 | Stage D pin. P09 shell. Page owner stays Phase 02. |
| REG-60 | Stage D pin. Seller chrome logo. Not REG-72. |
| REG-62 | Launch gate. See §5. Not a build phase. |
| REG-63 | Named pin: do not drop `cod_enabled` in a v2 phase. Removal is a shape change this plan does not authorize. |
| REG-64 | Phase 09 (P29 copy). |
| REG-65 | **Open (B7).** Phase 09. Onboarding dead delivery-fee field. Close by deletion under OD-10. Number burnt. |
| REG-67 | Phase 08 (Guard F). Scheduled in §0. |
| REG-70 | Named pin: no new `moderation_target` member. Phase 18 and Phase 12 obey it. |
| REG-72 | Phase 09, blocked on Navigable store identity. Phase 17 wires P12 after the component exists. |
| REG-74 | Phase 08 (Guard G). Scheduled in §0. |
| REG-75 | Pin **before Phase 09** agreements work. |
| REG-76 | Phase 08. |
| REG-77 | Build-start. Human. Before Phase 08. |
| REG-78 | Principle closed (ADR-024, Phase 08). **Mechanism** is the courier gate, blocking Phase 14 **launch**. |
| REG-79 | Pin **before Phase 10**. |
| REG-81 | Pin **before Phase 11**. |
| REG-85 | Pin **before Phase 15**, and before any edit that relates store policy to the platform policy. Tied to Stage E. |
| REG-86 | Named pin beside REG-62. Do not add `return_hold_hours` to that gate. Phase 19 still honours R-O29. |
| REG-87 | **Closed (B7).** Master prompt now says 79 pages (OD-21) and the §0 counting rule. Not a build phase. |
| REG-88 | Pin **before Phase 09** agreements work. Tied to Stage E. Phase 11 reads the pin; it does not choose the set. |
| REG-92 | Phase 08. Lint or runtime test. Not a typecheck. |

### 4.f Product pins owed before their phase

| Pin | Before | If it is still open |
|---|---|---|
| REG-79 phone-gate trigger | Phase 10 | Cart does not encode a trigger. Phase 11 owns the asserted holds. |
| REG-75 backfill vs forced re-accept | Phase 09 agreements work | Do not invent a backfill. |
| REG-81 `display_ref` format | Phase 11 | Checkout stores null rather than an invented format. Seller pages render only non-null. |
| REG-85 store policy vs platform policy | Phase 15, and any Phase 09 edit of that relationship | Leave the relationship unstated. |
| REG-88 which documents gate completion | Phase 09 agreements work | Do not hard-code the four names into the gate. |
| REG-93 `payment_window_minutes` | Phase 11 | Value empty after M3; consumer fails closed (plan §8.2.5). Staging may use a labelled placeholder written by a named task. Production needs the pinned value. |
| REG-94 `return_window_hours` | Phase 15 | Value empty after M3; consumer fails closed (plan §8.2.5). Staging may use a labelled placeholder written by a named task. Production needs the pinned value. |
| REG-95 `food_requirements` | Phase 09 | Value empty after M3; consumer fails closed (plan §8.2.5). Staging may use a labelled placeholder written by a named task. Production needs the pinned value. |
| REG-96 `agreement_buyer_terms_version` | Phase 09 | Value empty after M3; consumer fails closed (plan §8.2.5). Staging may use a labelled placeholder written by a named task. Production needs the pinned value. |
| REG-97 `agreement_seller_agreement_version` | Phase 09 | Value empty after M3; consumer fails closed (plan §8.2.5). Staging may use a labelled placeholder written by a named task. Production needs the pinned value. |
| REG-98 `agreement_return_policy_version` | Phase 11 | Value empty after M3; consumer fails closed (plan §8.2.5). Staging may use a labelled placeholder written by a named task. Production needs the pinned value. |
| REG-99 `agreement_privacy_version` | Phase 11 | Value empty after M3; consumer fails closed (plan §8.2.5). Staging may use a labelled placeholder written by a named task. Production needs the pinned value. |

---

## 5. Gates and parallel tracks

### Hard pre-launch gates

Launch is blocked until all three are true (`BETK_MVP_SCOPE.md` §9). They block **launch** of the phase named here. They do not forbid building the phase against sentinels on staging.

| Gate | Blocks launch of | What must be true |
|---|---|---|
| **REG-62 (narrowed)** | Phase 09 (price band, or publish refuses the catalogue), Phase 11 (commission % snapshotted at checkout), Phase 12 (`betk_instapay_handle` on the payment instructions) | Those three values are set. Flat `delivery_fee_flat_egp`, VF/Orange BETK handles, and `return_hold_hours` are **not** this gate (REG-86). |
| **Courier gate** | Phase 14 | Rate-matrix numbers, coverage map, and the REG-78 mechanism: branch 1 admin RLS read, or branch 2 service-role read. Not a courier user. Not a definer. Not both branches. |
| **Legal gate** | Phase 09 (signup and the four public documents), Phase 11 (the version gate shows lawyer text), Phase 15 (return rules) | Buyer T&C, Seller Agreement, Return & Refund Policy, and Privacy Policy are lawyer-reviewed and published. |

### Stage D blocks (Claude Design)

| Phase | §8 item |
|---|---|
| 09 | ShareButton, Navigable store identity, DataTable, ProofViewer |
| 10 | CartLine |
| 11 | CheckoutSellerSections |
| 12 | ProofViewer |
| 13 | SellerOrderMoney, DataTable |
| 14 | RateMatrixEditor, CourierLabelSheet |
| 15 | ProofViewer, DataTable |
| 16 | DataTable |
| 17 | Navigable store identity |
| 18 | DataTable |
| 19 | ChartSeries, SellerOrderMoney, DataTable |
| 20 | none |

REG-52, REG-58, REG-59, and REG-60 stay open Stage D pins and do not block a phase exit.

### Stage E blocks (legal prose)

| Phase | Document |
|---|---|
| 09 | Buyer T&C, Seller Agreement, Return & Refund Policy, Privacy Policy |
| 11 | Whichever of those four REG-88 puts in the completion gate |
| 15 | Return & Refund Policy |

### Parallel

- **Stage D and Stage E** run beside the build. A blocked phase does not start its UI task until the named item exists.
- **Phase 20** starts after Phase 09. It does not wait for Phase 19.
- **Guards** are Phase 08 work, scheduled before that phase starts, built before Phases 09–20.

---

## 6. Stage A salvage

| Artifact | Fate in this plan |
|---|---|
| `requireAdmin` / `requireAdminForUser` | **Phase 12** restores the file from `archive/phase-07-v1-single-seller`. It is absent on `main`. |
| Buyer address query/action + `validations/address.ts` | **Phase 11** restores them. P10 and P15 both need the address. |
| `tests/unit/checkoutForm.phoneGate.navigate.unit.test.ts` | **Phase 11** rewires it. The assertion stays phone-NULL → `/auth/phone`. |
| `modlog_admin_insert` | **Already live** on `main`. No restore. Phase 08 re-reads it. Phase 18 is the first writer of `moderation_logs` in v2. |

Other Stage A rows marked SURVIVES (ADR-019’s pattern, PRECEDENTS, the journal, the guard scripts) are already on `main`. They are not a restore task.

---

## 7. Reverse check

Counted from the `CODES:` lines, the page table, and the 51-row table in this file:

- Every operative phase **01–06 and 08–20** owns at least one page, code, or table.
- **Phase 07** owns nothing. **SUPERSEDED (B7):** “owns REG-57 and nothing else, on purpose.” REG-57 is superseded.
- Pages P01–P79 appear once.
- ADR-020..025 appear once, all on Phase 08.
- Open REGs in §4.e appear once.

A missing code, a second owner, or a phase with an empty owns-set is a **STOP**. Do not paper over it with a new table, page, or requirement.

---

## 8. Time-driven work (B7)

**Choice.** Earlier phases write in-app `notifications` rows as their exit evidence. Phase 17 adds the notification center and SMS delivery. The payment-window sweeper stays in Phase 11. The prep-SLA ladder stays in Phase 13. The `notifications` table already exists (first write Phase 06, RLS Phase 01). This section does not move those jobs into Phase 17 and does not add a table.

Cadences below were re-read at B7 from `supabase/migrations/20260622083154_cron.sql` and `supabase/migrations/20260716130533_reschedule_daily_cron_utc.sql` (the `cron.schedule` calls). The UTC migration retimes only the three daily jobs. `expire-boosts` stays `*/15 * * * *`. `dispute-sla-alert` stays `0 * * * *`. `cleanup-otp-tokens` stays `30 * * * *`. This is not a live `cron.job` query. The daily jobs are too coarse for a payment window and for a prep-SLA ladder. They stay daily where the work is nightly.

| Behaviour | Owner | Mechanism | Cadence | Evidence before Phase 17 |
|---|---|---|---|---|
| Deposit-window expiry and cart/stock restore (REG-82, R-O21, R-C07) | Phase 11 writes the deadline at checkout and owns the sweeper. Phase 10’s exit tests restore as a function. | New `pg_cron` sweeper | Every minute (`* * * * *`). A launch window of about 30 minutes cannot use a daily job. | One in-app `notifications` row for the buyer, plus the cancelled master and the restored stock and cart. |
| Quote expiry at 24h (R-Q06) | Phase 10 | Derived at read from `quote_expires_at` | No cron | The integration test that an expired quote blocks the line. No notification row. |
| Prep SLA at 50% and 80%, then breach escalation (R-F03, AC-SLA-3, OD-16) | Phase 13 | New `pg_cron` | Every 15 minutes, the same grain as live `expire-boosts` | Two in-app notification rows, then an escalation row. SMS is Phase 17. |
| Seller notified when the order is released (R-F05) | Phase 12 | The admin confirm action. Not a cron. | On that action | One in-app row per seller (order ref, item count, ready-by). |
| Dispute alert about one hour before the SLA (R-N05, AC-ADM-9) | Phase 16 | Live job `dispute-sla-alert` | Hourly `0 * * * *` | The `notifications` row. The live body sets `channel` to `sms` and is not rewritten here. A sent SMS is not the Phase 16 gate. SMS delivery is Phase 17. |
| Boost expiry (R-B03) | Phase 20 | Live job `expire-boosts` | `*/15 * * * *` | Status becomes expired. No notification row for the exit. |
| Seller level recalculation | Phase 19 | Live job `recalculate-seller-levels` | Daily `0 0 * * *` UTC | The level rows. Daily is the right grain. |
| Platform snapshot | Phase 19 | Live job `daily-platform-snapshot` | Daily `5 22 * * *` UTC | The snapshot row. The `revenue_egp` writer stays unpinned (REG-26). |
| Seller snapshots | Phase 19 | A new daily job of the same class. It is not one of the six live jobs. | Daily | The snapshot row. No finer cadence. |
| Temporary suspension lift (R-M03) | Phase 18 | Live job `lift-temp-suspensions` | Daily `0 1 * * *` UTC | The status flip. No new notification requirement. |
| OTP token cleanup | Signed Phase 02 | Live job `cleanup-otp-tokens` | Hourly `30 * * * *` | Already live. Not a v2 task. No Phase 17 dependency. |
| Approval SLA of 24h (R-M01 / G7) | Phase 09 for the approval action. Phase 18 if a dashboard shows the figure. | A clock-measured metric. Not a sweeper. | No cron | Not a notification exit. |
| Archive notifications at 90 days | Not a v2 phase | v1 §H only | Not added | Adding it would add scope. Not added. |

---

## H. Historical v1 phase plan (superseded in place — not deleted)

> **SUPERSEDED (B6, 2026-09-22).** The text below is the v1 execution plan. Phases 01–06 of that plan were signed and remain the signed phases in §2. Its Phase 07 was started and then stopped; that number is retired. Its Phases 08–14, DS, and N-* were never executed. The v2 contract is the sections above. Headings in this block are prefixed so they are not the operative phase IDs. The sentences are the v1 text.

### Historical v1 plan — Phase 00 — Scope sign-off (gate, no code)
Decide OD-1…OD-6 (MVP Scope §6) and sign. **No development begins until this is signed.** Doc: MVP_SCOPE §6, SESSION_CONTEXT.

### Historical v1 plan — Phase 01 — Foundation
> Task pack: `phase-packs/PHASE_01_FOUNDATION.md` (14 tasks, Cursor prompts, migration grouping, freeze-delta SQL).
- **Objectives:** repo, env, Supabase client setup, full migration + type generation, base layout/RTL, shadcn install, services scaffolding, middleware skeleton.
- **Tasks:** Next.js 15 app + route groups; `lib/supabase/{client,server,service,types}`; run migrations 001–057 (C3 §7) to a staging Supabase **with the MVP-freeze deltas: enum `auth_provider`; `users.phone_number` nullable; add `users.auth_provider`, `users.deleted_at`, `users.anonymized_at`**; `supabase gen types`; Tailwind tokens + shadcn; `services/{resend,posthog,sentry}`; `constants/{routes,enums,statusColors}`; `middleware.ts` (auth gate + role routing + suspended block); CI pipeline.
- **Files:** `app/layout.tsx`, `lib/supabase/*`, `tailwind.config`, `middleware.ts`, `.env.example`, GitHub Actions.
- **Acceptance:** app boots RTL; all 43 tables + RLS + indexes + triggers + pg_cron live in staging; types generated; CI gates green.
- **Tests:** smoke build; types drift check; RLS default-deny sanity.
- **Docs:** ARCHITECTURE, CONFIGURATION, ERD, CICD, DEVELOPMENT_JOURNAL.

### Historical v1 plan — Phase 02 — Authentication & profiles
- Features: FR-AUTH-1..3, FR-BUY-1 (account). Phone-OTP **and Google OAuth** (Supabase Auth, OD-4), OTP page, OAuth callback + find-or-create (`auth_provider`), session creation, role routing, buyer profile creation, account **deactivate** (sets `users.deleted_at`), **phone-required-before-transacting** gate.
- **Acceptance:** AC-AUTH-2 (≤5 attempts, no raw OTP, session created); Google OAuth find-or-create with `phone_number=NULL`; role routing; suspended/deactivated blocked (R-A05 incl. `deleted_at`); transaction gate forces phone+OTP before checkout/become-seller/payout.
- **Tests:** integration (OTP flow, attempts, expiry); E2E auth.
- **Docs:** SECURITY_GUIDELINES, journal.

### Historical v1 plan — Phase 03 — Catalog & Discovery (public)
- Features: FR-PUB-1..5 (Homepage, Search, Category, Listing Detail, Storefront). Categories seed, listings read, tsvector search + filters, collections strip, rating_aggregates display, follow button.
- **Acceptance:** FR-PUB acceptance criteria; search returns active+not-deleted; boosted ranking; suspended store hidden.
- **Tests:** integration (search/filter, RLS public read); E2E browse→listing→storefront.
- **Docs:** CACHING_STRATEGY, journal.

### Historical v1 plan — Phase 04 — Seller Onboarding & Store Management
- Features: FR-SEL-1..7 (onboarding 5-step, status, store/delivery/returns/payments). seller_profiles + stores + seller_documents (private bucket, signed URLs), slug uniqueness/change-once, payment-method gate.
- **Acceptance:** one store/seller (R-S01); slug unique+URL-safe (R-S02), change once (R-S03); ID front+back (R-S05); ≥1 payment method to publish (R-S09); store live only after approval (R-S04).
- **Tests:** integration (onboarding, slug rules, doc upload signed URL); E2E onboarding.
- **Docs:** SECURITY_GUIDELINES (storage), journal.

### Historical v1 plan — Phase 05 — Listings & Inventory
- Features: FR-SEL-8..10 (manage, create/edit, stock). listings CRUD, images (≤5), tags (≤5), publish validation, soft delete, stock lifecycle + low-stock derived (OD-1).
- **Acceptance:** publish needs image+ar title+category (R-L02/03/04); service hides stock (R-L09); 0→sold_out (R-L06); restock→active (R-L07); soft delete (R-L10); search_vector populated.
- **Tests:** integration (publish gates, stock transitions); E2E create→publish.
- **Docs:** journal.

### Historical v1 plan — Phase 06 — Messaging & Inquiries
- Features: FR-BUY-5, FR-SEL-13. inquiries + inquiry_messages threads, confirm→checkout enablement, avg_response_hours update, notify ≤5s (R-N04).
- **Acceptance:** confirmed inquiry enables checkout; response-time metric updates; unread state correct.
- **Tests:** integration (thread, confirm); E2E inquiry→confirm.
- **Docs:** journal.

### Historical v1 plan — Phase 07 — Orders, Checkout & Split Payments
- Features: FR-BUY-6..9, FR-SEL-14..15. Checkout (atomic order + items + two payments, **payee = BETK / custodial per OD-8/ADR-016; commission snapshotted on the order**), confirmation/instructions (**BETK's handles from `admin_settings` + buyer proof-upload**), order history, track order, seller order mgmt + status lifecycle + shipment, **admin deposit-verification gate → seller acceptance** (R-O04 COD auto-confirm retired — no pure-COD path).
- **Acceptance:** AC-BUY-6 (atomic, 2 payments, only from confirmed inquiry); AC-SEL-14 (**seller** confirm→stock decrement→notify, gated on the **admin-verified deposit**); cancel only pending (R-O03); status history written.
- **Tests:** integration (checkout atomicity, split payment dedupe, status transitions); E2E full purchase.
- **Docs:** API_STANDARDS, journal.

### Historical v1 plan — Phase 08 (v1 heading, §H) — Delivery & Tracking
- Features: shipment create, tracking number/url, shipment_tracking_events, courier (Bosta) webhook, delivery confirmation opens review window (delivered_at).
- **Acceptance:** shipment 1:1 with order; tracking events render in timeline; delivered_at set.
- **Tests:** integration (webhook idempotency, status mapping).
- **Docs:** API_STANDARDS (webhooks), journal.

### Historical v1 plan — Phase 09 (v1 heading, §H) — Reviews & Ratings
- Features: FR-BUY-10, FR-SEL-16. Leave review (≤3 photos, 48h edit), one seller reply, rating_aggregates trigger recompute, admin verify/hide later.
- **Acceptance:** AC (one review/order R-O07/R-R02; edit ≤48h R-R03; one immutable reply R-R04; aggregate recompute R-R07).
- **Tests:** integration (eligibility, edit window, aggregate); E2E review.
- **Docs:** journal.

### Historical v1 plan — Phase 10 (v1 heading, §H) — Disputes & Buyer Protection
- Features: FR-BUY-11..12, FR-SEL-22, FR-ADM-9. Raise dispute (≤5 evidence), dispute thread, admin resolution + notify both, SLA 48h + 47h alert, refund-type touches payments.
- **Acceptance:** AC-ADM-9 (resolution sets outcome+notes, logs, notifies both; SLA alert at 47h); one active dispute/order (R-O06/R-D06); eligibility delivered/dispatched (R-D01).
- **Tests:** integration (eligibility, resolution, SLA cron); E2E dispute lifecycle.
- **Docs:** journal.

### Historical v1 plan — Phase 11 (v1 heading, §H) — Boosts & Promotions
- Features: FR-SEL-11..12, FR-ADM-17. Boost purchase (packages), admin payment confirm→activate, concurrent-boost guard, auto-expire, ROI.
- **Acceptance:** one active boost/listing (R-B01/R-L08); activates ≤5min of confirm (R-B02); auto-expire cron (R-B03); boosted ranking (R-B04).
- **Tests:** integration (concurrency guard, expiry); E2E boost→confirm.
- **Docs:** journal.

### Historical v1 plan — Phase 12 (v1 heading, §H) — Buyer extras: Wishlist, Following, Notifications
- Features: FR-BUY-3..4, FR-BUY-13. Wishlist + restock toggle (R-N06), follow stores, notifications center + unread badge, channel prefs.
- **Acceptance:** restock alert fires on stock>0 transition; unread badge accurate; channel prefs honored (R-N01).
- **Tests:** integration (restock trigger, unread index); E2E wishlist/follow.
- **Docs:** journal.

### Historical v1 plan — Phase 13 (v1 heading, §H) — Seller Analytics, Earnings & Payouts
- Features: FR-SEL-3,17..21. Dashboard KPIs, earnings, transactions, request payout (min 100), level progress (nightly recalc), analytics charts.
- **Acceptance:** payout ≥ EGP 100 (R-O09), manual processing (R-O10); level thresholds (R-S06); snapshots drive charts.
- **Tests:** integration (payout min, level recalc cron); E2E payout request.
- **Docs:** journal.

### Historical v1 plan — Phase 14 (v1 heading, §H) — Admin Console
- Features: FR-ADM-1..8,10..16. Dashboard+SLA, approvals, user/seller mgmt (strikes, ban confirm), listings/reviews/flagged moderation, categories, orders/payments/payouts mgmt, editorial collections, broadcast + templates, settings (CHECK on numeric keys), moderation log.
- **Acceptance:** approval SLA 24h (R-M01); temp suspension auto-lift (R-M03); permanent ban confirm (R-M04); flagged review 24h (R-M05); auto-flag keywords (R-M06); moderation log immutable (R-M02).
- **Tests:** integration (each admin action logs + RLS admin-only); E2E approve seller, resolve flag.
- **Docs:** SECURITY_GUIDELINES, journal.

### Historical v1 plan — Phase DS — Design System & UI Polish (Claude Design)
> Pack: `phase-packs/PHASE_DS_DESIGN_SYSTEM.md`. Brief: `00-design/BETK_DESIGN_BRIEF.md`. Surface: **Claude Design**, not Cursor.
> **Placement (your choice):**
> - **Option A — Early (lower rework, recommended):** run right after Phase 01/03 so page-building phases (04–14) consume finished shared components. The token foundation already lands in Phase 01 (T03); this phase turns it into the full component set.
> - **Option B — Late polish (matches "backend/APIs first"):** run here, after Phase 14 (v1 heading, §H), as a consolidated visual pass over the functional UI built in Cursor. Accept some restyle rework on pages already built.
- **Objectives:** stand up the design system in Claude Design from `BETK_DESIGN_BRIEF.md` + the GitHub frontend subfolder; generate/refine the §4 shared components (RTL, tokens, all states); export to a `feature/design-*` branch.
- **Tasks:** see the pack (DS01 set up system · DS02 generate shared components · DS03 page layouts/shells · DS04 export to branch · DS05 Cursor wires data + UI-reviewer gate).
- **Acceptance:** every shared component matches its UI Spec §3/§4 usage, is RTL-correct, uses tokens (no hardcoded colors), extends shadcn, and renders empty/loading/error states; merged via PR through CI + UI-reviewer + Security gates.
- **Tests:** visual review against UI Spec page sections; a11y (focus ring, keyboard, RTL); no console errors.
- **Docs:** BETK_DESIGN_BRIEF, UI_STATE_STANDARDS, BETK_GIT_WORKFLOW, journal.

### Historical v1 plan — Phase N-3 — Testing (full coverage pass)
Close gaps: every utility unit-tested; every action/route integration-tested; all critical E2E green; map all to FR/AC. Doc: TESTING_STRATEGY, journal.

### Historical v1 plan — Phase N-2 — Deployment
Vercel production config, env per environment, migrations applied to prod (reviewed), buckets/privacy verified. Doc: CONFIGURATION, DISASTER_RECOVERY.

### Historical v1 plan — Phase N-1 — Monitoring
Sentry wired (client/server/actions, tagged); PostHog events on key funnels; pg_cron verified in prod; notifications archive job scheduled. Doc: ERROR_HANDLING_STANDARDS, RATE_LIMITING.

### Historical v1 plan — Phase N — Launch + post-launch
Run `LAUNCH_CHECKLIST.md` (incl. the 5 mandatory security conditions, RLS per table, Zod coverage, Core Web Vitals, Resend flows). Post-launch: monitor notifications growth (archive at 90d), watch search/write latency, plan post-MVP items (variants, wallet, multi-store) per C3 §8.4.

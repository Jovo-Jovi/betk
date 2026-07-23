# OD-8 — Custodial Payments & Platform Commission

> **Status: DRAFT — awaiting scope-owner signature.** Nothing in this document is applied to any
> repo file, migration, or code path until signed. Authored 2026-07-23 by the review chat from the
> CORRECTION-01 audit evidence. Follows the OD-7 track-file precedent
> (`OD7_BILINGUAL_THEME_TRACK.md`).
>
> Governing clause: `BETK_MVP_SCOPE.md §8` — *"After sign-off, additions require a written change
> request and re-baselining of the PRD and phases."* This document is that change request.

---

## 1. The amendment

**BETK moves from a no-custody model to a custodial model.** The buyer pays BETK; BETK settles to
the seller net of a platform commission.

This supersedes three frozen assertions:

| Location | Superseded text |
|---|---|
| `docs/02-architecture/ADR.md` ADR-002 | "BETK never holds funds" |
| `BETK_MVP_SCOPE.md` L26 | "BETK never holds funds), manual seller payment confirmation" |
| `BETK_MVP_SCOPE.md` L35 | "MVP is direct buyer→seller; BETK holds no funds" (out-of-scope row) |
| `BETK_PRD.md` L14 | "a 50/50 split-payment model … where BETK never holds funds" |

**What does NOT change:** no payment gateway, no automated capture, no automated payouts. Payment
remains manual transfer + manual verification. The 50/50 deposit/balance split is unchanged. The
frozen table count (43) and page count (59) are unchanged.

---

## 2. Money flow

```
Buyer  →  BETK      total_amount (= subtotal + delivery_fee)
                    ├─ 50% deposit — Instapay/VF Cash/Orange Cash to BETK's own handles;
                    │                buyer uploads transfer screenshot; ADMIN verifies
                    └─ 50% balance — COD; courier collects and remits to BETK

BETK   →  Courier   delivery_fee                     (Phase 08 — BETK is merchant of record)
BETK   retains      commission = rate × subtotal      (snapshotted at order creation)
BETK   →  Seller    subtotal − commission_amount      (payouts → stores.payment_methods)
```

**Worked example.** `subtotal` 1000.00, `delivery_fee` 50.00, `total_amount` 1050.00, commission
rate 10%:

- `commission_amount` = 100.00 (10% of **subtotal**, not of total)
- deposit row = 525.00, balance row = 525.00 (50/50 of `total_amount`)
- seller net = 900.00 · BETK retains 100.00 · courier receives 50.00
- Reconciliation: 900 + 100 + 50 = 1050 ✓

**Commission base is `subtotal`, never `total_amount`.** The delivery fee is pass-through to the
courier; commissioning it would mean taking a cut of BETK's own cost.

---

## 3. Order lifecycle (TWO signals)

The deposit confirmation and the order acceptance are **two distinct acts by two distinct actors**,
recorded on two distinct rows. No new enum member and no new status column is required.

| # | Act | Actor | Writes |
|---|---|---|---|
| 1 | Order placed from a confirmed inquiry | Buyer | `orders` (`status='pending'`), 2 `payments` rows (both `pending`), commission snapshot |
| 2 | Deposit transferred + proof uploaded | Buyer | `payments.proof_path` on the deposit row |
| 3 | **Deposit verified** | **Admin** | `payments.status='confirmed'` + `confirmed_by` + `confirmed_at` on the deposit row. **`orders.status` untouched.** |
| 4 | **Order/service accepted** | **Seller** | `orders.status: pending→confirmed` → fires `trg_decrement_stock_on_confirm` |
| 5 | Dispatch / delivery | Seller / courier | Phase 08 |
| 6 | Courier remits the COD balance to BETK | Admin | `payments.status='confirmed'` on the balance row |
| 7 | **Order closed** | **Admin** | Terminal `orders.status` transition — the settlement signal, surfaced on the seller board |
| 8 | Return-hold window elapses | (derived) | Seller balance moves pending → approved |
| 9 | Payout requested + processed | Seller / Admin | `payouts` |

**The COD balance is confirmed only after delivery**, when the courier remits to BETK — never at
order creation. Admin then closes the order, which is the seller-visible signal that the transaction
is settled.

⚠️ **The terminal `order_status` member for step 7 is UNPINNED.** T01 pinned the enum in the
SESSION_CONTEXT ORDER-SET CONTRACT, but CORRECTION-01 did not re-quote that section. The member
must be **cited from the pinned enum, not invented** — if no terminal member exists beyond
`delivered`, closure is expressed as a derived condition (both payment rows `confirmed` AND
`delivered`) and that fact is recorded rather than papered over with a new enum member.

**AC-SEL-14 survives with its actor UNCHANGED.** The seller still performs the `pending→confirmed`
transition; only the *deposit* confirmation moves to admin. Step 4 is gated on step 3 — the seller
cannot accept until the deposit is admin-confirmed, so the seller never commits stock against
unverified money.

**R-O05 amended:** "manual seller payment confirmation" → "manual **admin** payment confirmation."

### 3.1 Consequence — R-O04 COD auto-confirm is retired

With the seller always performing acceptance, an order cannot auto-confirm at creation. **R-O04 is
amended: no order auto-confirms.** Every order is INSERTed as `pending` and UPDATEd to `confirmed`
by the seller.

**This dissolves the Phase-07 NAMED TRAP.** `decrement_stock_on_confirm` is `AFTER UPDATE OF status`
and never fires on an INSERT — the pack's required `INSERT-pending-then-UPDATE-inside-one-transaction`
workaround is no longer needed anywhere.

### 3.2 OPEN — pure-COD orders  ⚠️ needs sign-off

Under custody the deposit is paid to **BETK's** rails, not the store's, so
`stores.payment_methods.cod_enabled` loses its buyer-facing meaning. A 100%-COD order would give
BETK no security and the seller no assurance — the deposit is precisely what secures the order.

**DECIDED 2026-07-23: there is no pure-COD path. Every order carries the 50/50 split.**

Consequences:
- `/checkout` has no deposit-free path; every order produces exactly two `payments` rows.
- `stores.payment_methods.cod_enabled` no longer gates anything buyer-facing — the deposit rails are
  BETK's, not the store's.
- ⚠️ **R-S09 knock-on (code, not just docs).** The publish gate is currently
  `hasPaymentMethod = "≥1 handle set OR cod_enabled"` (`src/features/listings/listingRules.ts`).
  Under §7 the column is the **BETK→seller settlement destination**, so `cod_enabled` alone means the
  seller has no way to be paid. The gate must become **"≥1 settlement handle set"**; `cod_enabled`
  no longer satisfies it. Any seller onboarded with COD-only would newly fail the publish gate.

---

## 4. Commission

- **Basis:** percentage of `subtotal`.
- **Timing:** computed and **snapshotted at order creation**.
- **Rate:** flat, platform-wide, held as an `admin_settings` row. Per-seller/per-category rates are
  explicitly out of scope for MVP; the snapshot design means they can be introduced later without
  touching historical orders.
- **Stored as two columns**, not one: `orders.commission_rate` (the rate in force at creation) and
  `orders.commission_amount` (the computed value). Storing only the amount makes the figure
  unauditable; storing only the rate lets a later rate change silently rewrite history.
- **Seller net is derived** (`subtotal − commission_amount`) — no third column.
- **Rounding:** 2 decimal places (piastres), half-up, `numeric` throughout. The existing no-float
  rule applies unchanged.

---

## 5. Payment proof

The buyer uploads an Instapay transfer screenshot; the admin verifies against it.

- **Bucket: `docs`** (PRIVATE), not `media` (PUBLIC — would expose financial evidence via a public URL).
- **No new storage policy is required.** CORRECTION-01 §D2 established that
  `docs_insert_own_prefix` grants **any authenticated user** — buyer included — INSERT under their own
  `auth.uid()` prefix, and `docs_select_own_or_admin` already grants admin read. Buyer uploads,
  admin reads, seller cannot. This is the correct visibility for the model.
- **Path recorded on** `payments.proof_path` (new nullable column on the deposit row).
- **No new `payment_status` enum member.** "Awaiting admin review" is expressed by the convention
  **`proof_path IS NOT NULL AND status = 'pending'`**. This convention is binding and must be cited
  wherever the state is rendered.

---

## 6. Seller balance — DERIVED, not persisted

**No balance, wallet, or ledger table is created. The table count stays 43 (OD-6 holds.)**

`BETK_MVP_SCOPE.md` L35 froze `wallet_balances` out *as the cost of custody*. That row is amended to
record that custody is now IN scope while a persisted balance remains OUT. The balance is computed
at read time from facts already stored, consistent with the ADR-013 / ADR-014 / REG-43 precedent of
not adding DB machinery for a derivable value.

**Approved (payable to the seller):** orders **closed by admin** (§3 step 7), **and**
`delivered_at + return_hold_hours < now()`, **and** no active dispute or return exists, **and** both
payment rows are `confirmed` — summed as `(subtotal − commission_amount)`, minus all `processed`
payouts.

Admin closure is the primary signal; the hold window is the secondary guard. Both are required —
closure proves the money reached BETK, the window absorbs a late return.

**Pending (held):** the same population where the hold window has not yet elapsed, or an active
dispute/return exists, or a payment row is not yet `confirmed`.

**Accepted trade-off (recorded, not hidden):** a derived balance recomputes from mutable rows, so a
later correction restates history rather than appending to it. A persisted immutable ledger is the
correct answer at scale. The derived model can be materialised into a ledger later without data
loss; a ledger cannot easily be un-materialised. Revisit trigger: the first time a reconciliation
dispute cannot be settled from the derived figures.

---

## 7. `stores.payment_methods` — repurposed  ✅ confirmed 2026-07-23

**Today it is the buyer-facing pay-to handle.** CORRECTION-01 §C1 found it rendered to buyers on the
public storefront at `src/app/[locale]/(public)/store/[slug]/page.tsx:297` and specified as checkout
instructions at `BETK_UI_SPEC.md` L249.

**Under custody that is an active leak:** a buyer who sees the seller's handle can pay the seller
directly, bypassing BETK and its commission entirely.

- **Repurposed as the BETK→seller settlement destination** (the same role `payouts.account_details`
  plays per request).
- **Removed from every buyer-facing surface** — the storefront About tab and the checkout
  instructions. This is a small Phase-04 code change and belongs in the correction cascade, not
  deferred.
- **R-S09 publish gate keeps its meaning**, re-worded from "seller can receive payment from buyers"
  to "**seller can be paid**."
- `cod_enabled` loses its buyer-facing meaning (see §3.2).

**BETK's own receive handles** — where buyers actually pay — become `admin_settings` rows. Data, not
DDL.

---

## 8. Delivery fee

`chk_order_total` enforces `total_amount = subtotal + delivery_fee`, and the two payment rows must
sum to `total_amount`. A fee value must therefore exist **at order creation** — it cannot be deferred
to Phase 08, because retro-fitting it would require rewriting `total_amount` and both payment rows,
which are the buyer's committed amounts.

- **Phase 07: a flat BETK-configured fee**, held as an `admin_settings` row. Appropriate now that
  BETK owns the courier relationship.
- **Phase 08: replaced by the courier API** (Bosta), computed per address.
- Per-governorate rates are a later refinement, not MVP.

---

## 9. Schema delta

**Additive columns on existing tables only. No new table. No new enum member. Table count 43 holds.**

| # | Object | Type | Purpose |
|---|---|---|---|
| 1 | `betk.payments.proof_path` | `VARCHAR` NULL | Buyer's transfer-screenshot path in the `docs` bucket |
| 2 | `betk.orders.commission_rate` | `NUMERIC(5,2)` NULL | Rate in force at creation (snapshot) |
| 3 | `betk.orders.commission_amount` | `NUMERIC(10,2)` NULL | Computed commission (snapshot) |

Nullable + app-enforced, consistent with the project's additive-migration discipline. Recommended
CHECKs: `commission_amount >= 0`; `commission_rate BETWEEN 0 AND 100`.

**Already satisfied — no new object required:** `payments.confirmed_by`, `payments.confirmed_at`,
`payments.transfer_reference`, the `docs` bucket policies, `payouts` in full.

### 9.1 New `admin_settings` rows (data, not DDL)

| key | purpose |
|---|---|
| `commission_rate_pct` | Flat platform commission rate |
| `return_hold_hours` | Window after delivery before a balance becomes approved |
| `delivery_fee_flat_egp` | Phase-07 flat delivery fee (retired at Phase 08) |
| `betk_instapay_handle` | BETK's deposit-receipt handle |
| `betk_vodafone_cash` | BETK's deposit-receipt handle |
| `betk_orange_cash` | BETK's deposit-receipt handle |

---

## 10. RLS consequences (REG-49 — design changes, still owed by Phase-07 T02)

- `payments` INSERT — buyer, scoped via the parent order.
- `payments` UPDATE — **split by column and actor.** Admin confirms (`status`, `confirmed_by`,
  `confirmed_at`, `notes`); the buyer attaches `proof_path` + `transfer_reference` to their own
  order's deposit row only. `WITH CHECK` cannot see `OLD`, so column confinement uses the **REG-42
  column-GRANT pattern**, not policy predicates alone.
- `orders` UPDATE — seller (own store) for the acceptance transition; buyer for cancel while
  `pending`. Transition legality is **not** expressible in RLS for the same `OLD`-invisibility reason
  and requires a trigger or column grant.

---

## 11. Regulatory risk — RECORDED

Holding customer funds in Egypt implicates Central Bank payment-services regulation. The scope owner
has been advised of this and has elected to proceed. This entry exists so the decision is recorded
rather than lost, and so that a future licensing or PSP-intermediary requirement is understood as
foreseen, not discovered. **Not legal advice; local counsel is the correct source.**

An alternative shape — a licensed PSP as collecting agent, with BETK controlling release but never
holding funds — was presented and not selected.

---

## 12. Open items carried out of OD-8

| # | Item | Owner |
|---|---|---|
| 1 | ~~Pure-COD orders~~ — **DECIDED 2026-07-23, retired (§3.2)** | Closed |
| 1b | Terminal `order_status` member for admin closure (§3 step 7) — cite from T01's pinned enum, never invent | CORRECTION-02 (read + record) |
| 1c | R-S09 publish gate: `cod_enabled` no longer satisfies "seller can be paid" (§3.2) — a `listingRules.ts` change | CORRECTION-02B |
| 2 | What BETK **pays** the courier vs what it **charges** the buyer; whether `shipments` needs a cost column | Phase 08 (requires a `shipments` column read, not performed in CORRECTION-01) |
| 3 | Per-governorate / API-computed delivery rates | Phase 08 |
| 4 | Per-seller or per-category commission rates | Post-MVP |
| 5 | Materialising the derived balance into a ledger | Post-MVP, on the §6 revisit trigger |

---

## 13. Sign-off

Scope amended from the 2026-06-13 freeze (OD-1…OD-6) and the 2026-07-01 OD-7 amendment.
Re-baselines: `BETK_PRD.md`, `BETK_MVP_SCOPE.md`, `BETK_UI_SPEC.md`, `BETK_PHASES.md`,
`docs/02-architecture/ADR.md`, `BETK_ERD.md`, `SESSION_CONTEXT.md`, `PHASE_07_ORDERS.md`.

- Product owner: __________  Date: ______
- Tech lead: __________  Date: ______

---
---

# ADR-016 — Custodial payments with platform commission (supersedes ADR-002)

> To be appended to `docs/02-architecture/ADR.md`. The registry is **append-only; supersede rather
> than edit** — so ADR-002 stays in place and gains a "Superseded by ADR-016" marker, mirroring the
> ADR-003 → ADR-008 precedent.

**Status:** Accepted (pending OD-8 signature). Supersedes ADR-002.

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

---

# ADR-017 — `converted_to_order_id` is written by a SECURITY DEFINER AFTER-INSERT trigger

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

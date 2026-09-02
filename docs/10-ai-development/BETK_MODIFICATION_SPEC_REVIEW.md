# BETK — Review of the Modifications & New Business Rules spec

> **Status:** REVIEW ONLY. Nothing here is authorized, nothing is planned yet. This document confirms
> what I understood, names what conflicts, and proposes how to sequence the re-baseline.
> **Requested next step:** you confirm/correct §2, answer **Q0**, and rule on the **Q-register** in §4.
> Then I write the detailed plan.

---

## 1. Headline

This is a **re-baseline of the order domain**, not an amendment to it. Rough magnitude:

| | Now | After (estimate) |
|---|---|---|
| Tables | 43 | ~50 |
| Pages | 59 | ~72 |
| Order model | `orders` → `order_items` | `cart` → `master_order` → `seller_order` → `items` |
| Order creation | Only from a seller-confirmed inquiry (AC-BUY-6) | From a cart |
| Sellers per order | 1 | N |

The spec is **internally coherent** — removing services and quote pricing is precisely what makes a
cart viable, and a cart is what buyers expect. The concern is not the direction; it is that treating
this as "modifications" will bolt a multi-seller model onto single-seller foundations.

**OD-9/OD-10 are the wrong instrument.** What's needed is a scope re-baseline: PRD, MVP_SCOPE,
UI_SPEC, ERD and BETK_PHASES all restated, then phases re-planned from 07 onward.

---

## 2. Confirmation of understanding

Grouped as you organized them. **Status** = NEW (not in scope today) · REPLACES (supersedes an
existing decision) · REDUCES (removes scope) · ALIGNS (already built or planned).

### 2.1 Marketplace scope

| # | Item | Status | Impact |
|---|---|---|---|
| 1.1 | Physical products only; services postponed | **REDUCES** | `listings.type='service'` blocked at app layer (enum member stays — PG cannot drop). R-L09 service/stock rule dormant. Simplifies pricing materially |
| 1.1 | Architecture must allow services later | Constraint | Keep `type` and the enum; block at validation, never at schema |
| 1.2 | Products must fall in a BETK-approved price range | **NEW** | New `admin_settings` keys + publish-gate rule. **Q7**: per product, per category, or global? |
| 1.2 | Range is admin-configurable and changes with campaigns/season | **NEW** | Config-driven, not hard-coded |

### 2.2 Legal & policy

| # | Item | Status | Impact |
|---|---|---|---|
| 2.1 | Buyer Terms & Conditions, BETK as intermediary | **NEW** | New public page(s). Content is lawyer-authored, not an engineering deliverable |
| 2.2 | Seller Agreement, e-signed at onboarding | **NEW** | New page + **acceptance capture**: version, timestamp, seller id, agreement status, optionally IP/device. Needs a table or columns. Versioning implies re-acceptance on change |
| 2.3 | Return & Refund Policy, incl. who pays return shipping | **NEW** | New page + the operational rules feed §2.8 |
| — | Wording must be lawyer-reviewed; not "zero responsibility" | Noted | Correct. Also note a Privacy Policy is likely required and isn't listed |

### 2.3 Cart & multi-seller

| # | Item | Status | Impact |
|---|---|---|---|
| 3.1 | Full cart: add, remove, change qty, subtotal, delivery, total | **NEW** | New page + table(s). **Q1**: persisted cart (table) or session/local? Persisted is required if the cart must survive device switches |
| 3.2 | Cart may contain products from multiple sellers | **NEW — the structural change** | Drives everything in §4 |
| 4 | Master Order → Seller Orders → Items → Shipments → Payment allocation | **REPLACES** | The current `orders` table becomes the *seller order*; a new master sits above it. Every order-set RLS policy, the rpc, ADR-017's trigger and ADR-018 are re-scoped |
| 4 | Buyer sees one order; BETK tracks N internally | **NEW** | Buyer order history renders master; seller console renders its own seller order only |
| 5 | Order number format `BETK-2026-000123` | **REPLACES** | Current R-O02 is `BETK-YYYYMMDD-XXXX`. **Q8**: which format, and do master and seller orders each get one? |
| 5 | ~30 stored/displayed order fields | Mostly ALIGNS | Most exist. Genuinely new: return status, refund status, estimated delivery date, seller preparation time |

### 2.4 Payment flow

| # | Item | Status | Impact |
|---|---|---|---|
| 6.1 | 15-minute payment window, admin-configurable | **NEW** | Needs a minute-granularity scheduled job (pg_cron exists, currently 3 daily jobs) **and** stock reservation — see **Q3** |
| 6.1 | Statuses: Awaiting Payment → Proof Submitted → Awaiting Admin → Confirmed | **REPLACES** | New `order_status` / payment-status members. Enum additions = schema change |
| 6.1 | Timer expiry auto-cancels the order | **NEW** | First auto-transition in the system; everything else is actor-driven |
| 6 | Timer never auto-confirms payment; admin always verifies | **ALIGNS** | Exactly OD-8. Unchanged |
| 6 | §6 names InstaPay only | **Q9** | OD-8 has three rails (instapay, vodafone_cash, orange_cash). Narrowing to InstaPay only, or is §6 shorthand? |

### 2.5 Cancellation, returns, disputes

| # | Item | Status | Impact |
|---|---|---|---|
| 7 | Buyer may cancel **before** payment confirmation only | **ALIGNS — answers D6** | Matches the recommendation; closes the money hole |
| 7 | After confirmation → return/refund/dispute path | **NEW** | Requires §8 to exist before this rule is safe |
| 7 | **Seller may never cancel**; must escalate to admin | **REPLACES — answers D7** | Rejects the seller-decline action. **Q4**: the escalation surface doesn't exist — new seller page + admin queue + a status for "escalated" |
| 7 | Admin may intervene (unavailable, emergency, safety, fraud) | **NEW** | Admin-forced cancellation from non-pending states |
| 8 | Return → reason → evidence → seller response → accept/reject → dispute → admin | **NEW** | `disputes` exists; **returns do not**. New table(s) + pages for buyer, seller and admin |
| 8 | Nine dispute reason categories incl. food safety | **NEW** | Enum or lookup |

### 2.6 Seller onboarding

| # | Item | Status | Impact |
|---|---|---|---|
| 9 | Seller picks up to 3 categories; limit admin-configurable | **NEW** | Today `stores` carries primary/secondary. N-up-to-limit needs a new structure |
| 9 | Listings restricted to approved categories, enforced at create/edit/change | **NEW** | Publish-gate + validation rule |
| 9 | Extra categories require admin approval, possibly a contract update | **NEW** | Another admin queue |
| 10 | Food categories trigger extra onboarding requirements | **NEW** | First conditional onboarding branch |
| 10 | Food sellers must show an active FB/IG/WhatsApp business presence | **NEW** ⚠️ | **Verification data for admin only — must never render to a buyer**, or it becomes the off-platform contact channel the posture prohibits |
| 10 | Photos: product, packaging, label, expiry, production date | **NEW** | New `seller_documents` types + admin review |
| 11 | Food listings blocked until food onboarding is approved | **NEW** | Category-conditional publish gate |

### 2.7 Notifications

| # | Item | Status | Impact |
|---|---|---|---|
| 12 | Notifications begin at proof upload; 7 buyer stages through delivery | **ALIGNS (Phase 12)** | Supersedes the D11 draft table. Adds an **"Order Ready"** stage with no matching `order_status` member |
| 12 | Seller and admin notification sets | **ALIGNS (Phase 12)** | Admin adds: food onboarding review, expired payment windows, seller-unable-to-fulfil, suspicious activity |

### 2.8 Delivery

| # | Item | Status | Impact |
|---|---|---|---|
| 13 | Per-seller shipments, per-seller ETA, "Partially Fulfilled" master status | **NEW** | Master order needs a derived aggregate status |
| 13 | Each seller has its own delivery fee | **REPLACES ⚠️** | **Reverses OD-8 §8** — see **Q2** |

### 2.9 Admin configuration (§14)

Accepted as configurable: category limit, payment window, deposit percentage, price range, return
window, food requirements.

**Two I'd push back on:**

- **"Order Statuses — Admin configurable"** — not implementable. Status drives RLS policies, the
  transition trigger and the stock decrement. It is a code-level contract, not config.
- **"Seller Cancellation / Buyer Cancellation After Payment — Disabled" as runtime toggles** —
  configurable money-flow rules multiply the state space and every combination needs testing.
  Recommend hard-coding the policy and making only the **numbers** configurable.

---

## 3. Q0 — the gating question

**Does the inquiry survive, and what is it for?**

Phase 06 exists solely to serve inquiry-first ordering. A cart bypasses it.

| Option | Model | Cost | Consequence |
|---|---|---|---|
| **A** | Cart replaces it; inquiries become pre-purchase questions that never create an order | Largest write-off — Phase 06's confirm mechanism becomes dead code | Cleanest single path |
| **B** | Cart primary; inquiry retained for made-to-order/custom items | Two order-creation paths to build and maintain | Preserves the informal-seller fit and keeps availability confirmation for custom work |
| **C** | Cart only, no exceptions; custom work leaves the platform | Same write-off as A | Simplest; closes a seller segment |

**My lean: B** — because of Q5 below. But this is a product call and it is yours.

**Nothing else can be planned until Q0 is answered.**

---

## 4. Open questions register

| Q | Question | Why it blocks |
|---|---|---|
| **Q0** | Does the inquiry survive? (§3) | Determines whether Phase 06 is retained, retired or forked |
| **Q1** | Cart persisted in DB or session-only? | Persisted = new table(s) + RLS; session = no schema, no cross-device |
| **Q2** | **Per-seller delivery fee vs OD-8's flat platform fee** | §4/§13 require per-seller fees. OD-8 §8 made the fee a flat `admin_settings` value, and REG-65/D9 were about to delete the seller-set fields as dead. Those fields become load-bearing again. Pick one |
| **Q3** | **Multi-seller COD: how is the balance split across shipments?** | Three sellers ship on three days. One 50% deposit was paid. Does the courier collect ⅓ of the balance per delivery, or the full balance at the first? **The hardest unsolved problem in the spec** — it drives the payments table shape, the courier brief and reconciliation |
| **Q4** | Where does the seller escalation live? | §7 forbids seller cancellation and requires escalation, but no page, queue or order status exists for it |
| **Q5** | **Stock reservation + oversell** | Cart-first removes the seller's availability confirmation. Stock is trusted from `stock_qty`, maintained by informal sellers. Does checkout reserve stock? For how long? What happens when one seller in a 3-seller order is out of stock — partial order, or whole-order failure? |
| **Q6** | 15-minute window at 2am | A hard auto-cancel on a manual bank transfer will cost conversions outside banking hours. Fixed 15 min, or longer/adaptive? |
| **Q7** | Price range: per product, per category, or global? | §1.2 is ambiguous |
| **Q8** | Order number format, and do master + seller orders each get one? | Conflicts with R-O02 |
| **Q9** | InstaPay only, or all three OD-8 rails? | §6 names only InstaPay |
| **Q10** | Payment allocation: 2 payment rows per **master** order, or 2 per **seller** order? | Determines proof upload count, admin verification actions, and commission attribution. Follows from Q3 |
| **Q11** | Does commission stay a single flat platform rate, or vary by category/seller? | Not addressed; §1.2's campaign logic implies it may need to vary |
| **Q12** | Legal content timeline | Lawyer-authored T&C / Seller Agreement / Return Policy block the onboarding rebuild. Start this in parallel — it has the longest external lead time |

---

## 5. What survives, what's invalidated

### Survives — carry forward, do not rebuild

- **Custodial principle** — buyer pays BETK, admin verifies deposit, seller fulfils, commission on subtotal
- **ADR-019 three-layer write model** — column GRANT + row policy + OLD-aware BEFORE trigger. The
  pattern re-applies directly to the new tables
- **Admin deposit verification** + the `/admin/payments` slice
- **`requireAdmin` / `requireVerifiedPhone` / `requireActiveUser`** gates
- **Private-bucket proof upload** (`docs`, own-prefix INSERT, admin read, signed URL)
- **Derived seller balance** and no-ledger-table rule
- **Derived closure** (REG-56) — needs restating for master vs seller order (**Q13**)
- **REG-62** payment-config gate; all Phase 01–05 work; the entire design system
- **Every process artifact** — PRECEDENTS, the register, the guard suite, migration discipline

### Invalidated or materially reworked

| Artifact | Fate |
|---|---|
| `AC-BUY-6` (order only from confirmed inquiry) | **Retired** or forked, per Q0 |
| `create_order_from_inquiry` rpc | Rewritten — cart-sourced, multi-seller, master+children |
| **ADR-017** `converted_to_order_id` trigger | Rework or retire (Q0) |
| **ADR-018** atomicity | Redo — one transaction now spans master + N seller orders + N item sets + payments |
| **REG-49** policies | Re-scope to the new tables; the *reasoning* survives intact |
| `/checkout` (T03) | Rebuilt cart-based. Address, deposit-rail picker and proof upload are reusable |
| `/orders`, `/orders/[id]` (T04) | Rebuilt — master view + per-seller-order sections |
| Phase 06 messaging | Retained / repurposed / dead, per Q0 |
| `order_status` enum | New members needed: awaiting-payment, proof-submitted, ready, escalated |
| Phase 08 shipments plan | Re-planned around per-seller-order shipments |

---

## 6. Proposed sequence

**Do not continue Phase 07 into T05.** T05 (admin deposit verification) is the *least* affected task,
but building further on a superseded order shape adds to the write-off.

**Stop cleanly where you are.** The branch is in a good holding state — ledger 31/31, advisor stable,
zero residue, nothing half-applied.

1. **Answer Q0.** Everything downstream branches on it.
2. **Rule on the Q-register** (Q1–Q13). Several are business decisions only you can make; I'll
   recommend on each once Q0 lands.
3. **Start the legal track in parallel — today.** Q12 has the longest external lead time and blocks
   the onboarding rebuild. It needs no engineering decision to begin.
4. **Re-baseline the scope documents** — PRD, MVP_SCOPE, UI_SPEC, ERD, BETK_PHASES restated as a v2
   scope, with new page and table counts frozen the way 59/43 were.
5. **Re-plan the phases** from 07 onward against the new model.
6. **Decide the Phase-07 branch's fate** — which commits survive into the new plan and which are
   reverted. Note the T02b migration is already applied to staging; those policies remain valid on
   tables that still exist, so nothing needs rolling back today.
7. **Then resume building.**

**One suggestion on scope discipline.** §15's P0 list contains 17 items — cart, multi-seller orders,
returns, disputes, legal, notifications. That is not an MVP; it is a full marketplace. Worth asking
which of those are needed to take the **first real order from a real buyer**, and which can follow.
Returns and disputes, for instance, are only reachable after something has been delivered — they can
ship weeks after the first order does, provided the policy exists and support can act manually.

---

## 7. What I need to write the plan

1. **Q0** answered (A, B or C)
2. Rulings on **Q1–Q13**, or a note on which you want to talk through first
3. Confirmation or correction of **§2** — tell me anything I misread
4. Whether the legal track starts now in parallel
5. Whether §15's P0 stays as-is or gets split into launch-blocking vs fast-follow

With those, I can produce: the v2 scope re-baseline, the revised page/table inventory, the phase
re-plan from 07 onward, and the disposition of every existing ADR, OD and REG entry.

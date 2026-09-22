# BETK_MVP_SCOPE.md
> Step 1 of the BETK Dev OS. Source of truth for **scope and the OD set** — not the PRD. B2 (PRD) cites this document section-by-section. Functional requirements, R-codes, and AC-codes are **out of this document** except where a v1 AC is named as **retired**.
>
> **Authority (v2):** [`docs/10-ai-development/BETK_V2_SCOPE_BASELINE.md`](../10-ai-development/BETK_V2_SCOPE_BASELINE.md) + [`docs/10-ai-development/BETK_V2_ROLE_JOURNEYS.md`](../10-ai-development/BETK_V2_ROLE_JOURNEYS.md). The v1 text of this file is the **source being rewritten**, not the target. Every v2 assertion below cites an authority line. Facts not citable from those docs or live introspection are **FLAGGED**, never invented.
>
> **Status:** v2 rewrite (B1, 2026-09-19). The 2026-06-13 freeze (OD-1…OD-6) and the OD-7 / OD-8 amendments remain historical record; their v2 fate is §4. Signed N-decisions (N21, N22, N23, N25, N26, N27, N28) are **inputs** — do not re-open (§8).
>
> **How B2 cites this file:** §1 vision · §2 actors · §3 core model (one subsection per load-bearing rule) · §4 OD register · §5 in-scope · §6 out-of-scope · §7 retired v1 scope · §8 signed N-inputs · §9 hard pre-launch gates · §10 success metrics · §11 history / sign-off.

---

> ## COUNTS ARE UNFROZEN pending B3 (tables) and B4 (pages)
>
> The v1 freeze of **43 tables** and **59 pages** is **SUPERSEDED**. It is not the v2 inventory.
>
> Live introspection **today** (B1 session, 2026-09-19, MCP `list_tables` on schemas `betk` + `betk_analytics`, namespace `project-0-BETK-supabase-betk`) still measures **43** physical tables: `betk` **41** + `betk_analytics` **2**. That figure is **TRUE TODAY**. OD-6 is superseded because the **count is unfrozen pending B3**, not because 43 was wrong.
>
> The figures **~50 tables** and **~73 pages** (`BETK_V2_SCOPE_BASELINE.md` §1 table, §10) are **ESTIMATES** only. They MUST NOT be cited as frozen. B3 freezes tables. B4 freezes pages. This document does not freeze either.

---

## 1. Product vision

BETK is an Arabic-first, RTL digital marketplace for Egypt's informal creative economy — home-based sellers, handmade artisans, and micro-businesses (typically EGP 2,000–5,000/month) — connecting them with local buyers through verified storefronts, local payment methods, neighborhood-level discovery, and structured buyer protection. Free to join. MVP targets Egypt; architecture must scale to MENA (Sudan, Libya, Jordan, Morocco) without re-architecture.

**v2 catalogue constraint (does not rewrite the vision sentence above):** marketplace listings in this MVP are **physical products only**; `listings.type='service'` is blocked at the app layer and the enum member is retained so services can return without a schema change (`BETK_V2_SCOPE_BASELINE.md` §2.1). Services are postponed, not deleted from the long-term vision.

**Unchanged and load-bearing** (`BETK_V2_SCOPE_BASELINE.md` §1, “Unchanged and load-bearing”): custodial model (buyer pays BETK, BETK settles net of commission) · admin verifies the deposit · no gateway, no automated capture, no automated payouts · in-app communication only, no counterparty contact affordance · bilingual AR/EN presentation-layer only · light/dark theming · Claude Design owns the component kit.

## 2. Actors

| Actor | Definition | Auth |
|---|---|---|
| Guest | Unauthenticated visitor. Browse, search, filter, view any listing or storefront, read every legal page, share a public link. **Cannot** add to cart, request a price, follow, or wishlist (`BETK_V2_ROLE_JOURNEYS.md` §5.1). | public |
| Buyer | Authenticated. Cart, custom-item quote request, checkout, master-order tracking, return request, review, dispute. An **account is required before the first add-to-cart** (N21; `BETK_V2_SCOPE_BASELINE.md` §13). | protected |
| Seller | Buyer who completed onboarding (including pickup address and seller-agreement e-signature) and was admin-approved. Owns exactly one store. Sees order ref + items + prep deadline only — **never** buyer name, phone, address, or city (N28; `BETK_V2_ROLE_JOURNEYS.md` §5.4). **Cannot cancel** an order (`BETK_V2_SCOPE_BASELINE.md` §2.6). | role: seller |
| Admin / Superadmin | Internal operator. Seller/food approval, **one** deposit verification across all deposit rows under a master, courier handoff, escalations, returns/disputes, payouts, performance audit, configuration, moderation. Only admin (plus the courier) sees addresses (`BETK_V2_SCOPE_BASELINE.md` §2.5). | role: admin |

**FLAG (courier is not a new authenticated actor) — REG-78.** `BETK_V2_ROLE_JOURNEYS.md` §5.6 treats Courier as a fulfilment participant; `BETK_V2_SCOPE_BASELINE.md` §12 Courier gate names “order-handoff mechanism (API or manual)”. Authority does **not** pin a courier login, courier role, or courier-facing page inventory. N28/OD-17 still requires courier-visible addresses. **B3 must resolve how RLS expresses the courier principal.** B1 does not invent a courier app role.

v1 “Guest cannot wishlist, follow, inquire, or transact” is **held** and **extended** by N21 (account before add-to-cart) and by §5.1 (guest cannot request a price).

## 3. v2 core model

Cite this section from B2. Each subsection is one load-bearing rule. Schema inventory is **not frozen here**.

### 3.1 One cart → one master order → N seller orders → N shipments

> `BETK_V2_ROLE_JOURNEYS.md` “The v2 core concept” and §5.3 (canonical structural diagram). Ownership rules: `BETK_V2_SCOPE_BASELINE.md` §3.

The buyer experiences a single purchase. BETK operates N independent fulfilments underneath it.

| Level | Owns (`BETK_V2_SCOPE_BASELINE.md` §3; `BETK_V2_ROLE_JOURNEYS.md` §5.3 Ownership) |
|---|---|
| **Master order** | Buyer · delivery address · the single payment proof · aggregate status · the buyer-facing combined delivery total · the order number |
| **Seller order** | Items · its own delivery fee · its commission snapshot · its prep deadline · its shipment · its two payment rows · its escalation record · its cancellation and refund |

A single-order model cannot express partial fulfilment; partial fulfilment is the normal case in a multi-seller cart (`BETK_V2_ROLE_JOURNEYS.md` §5.3 “Why the split is load-bearing”).

Cart is persisted per buyer. Add · remove · change quantity · view subtotal, delivery and total. Quantity is bounded by live `stock_qty`. A line becomes **blocked** when the item sells out or a custom quote expires; blocked lines must be cleared before checkout. Prices are **snapshotted at add time** (`BETK_V2_SCOPE_BASELINE.md` §2.3).

Master status is **derived, never written directly** (`BETK_V2_SCOPE_BASELINE.md` §4.2). Seller-order `confirmed` means **admin-approved and with the seller** — it no longer means seller-accepted (`BETK_V2_SCOPE_BASELINE.md` §4.1).

**OD:** OD-9.

### 3.2 Money (custodial, amended)

> `BETK_V2_SCOPE_BASELINE.md` §2.4. Disposition: §11 “OD-8 … Amended”. Unchanged load-bearing from §1: buyer pays BETK; admin verifies; no gateway / no automated capture / no automated payouts.

| Rule | v2 value | Authority |
|---|---|---|
| Buyer rail | **InstaPay only**, to BETK's own handle | §2.4 |
| Deposit | 50% of **(subtotal + delivery)**, one transfer covering the whole master order | §2.4 |
| Balance | 50%, **COD**, collected by the courier **per shipment** at its own delivery | §2.4; §4.3 |
| Payment rows | **2 per seller order** — one deposit, one balance | §2.4; §4.3 |
| Proof | **One** screenshot for the master order | §2.4; **N22** (§13) |
| Verification | **One** admin action confirms every deposit row under that master | §2.4; §4.3 |
| Commission | Single flat % of **subtotal only** (never delivery — courier pass-through), admin-configurable, **snapshotted per seller order** at creation | §2.4 |
| Settlement | BETK → seller via the seller's own handles (InstaPay / Vodafone Cash / Orange Cash) | §2.4 |
| Seller balance | **Derived**, never a ledger table | §2.4; §1 unchanged |

**N22 (DIRECTION, B3 validates — do not treat as frozen schema):** ONE payment proof at **master-order** level. DIRECTION: each child seller order's deposit row SNAPSHOTS the proof reference at verification time. B3 (ERD rewrite) VALIDATES this against the existing architecture and may override it only with a stated, cited reason (`BETK_V2_SCOPE_BASELINE.md` §13 N22).

**OD:** OD-8 HOLDS WITH AMENDMENT (amendment text in §4.1). Derived balance restated with derived closure in OD-18.

### 3.3 Delivery — courier only + rate matrix

> `BETK_V2_SCOPE_BASELINE.md` §2.5.

- **Courier only.** No pickup, no remote, no self-delivery.
- Fee from the **courier rate matrix** — origin governorate × destination governorate × weight band. Computed **per seller order**; the buyer sees **one combined delivery total**; each seller order stores its own fee for refund and reconciliation.
- Courier collects from the seller's pickup address and delivers to the buyer.
- Delivery-method selection at checkout is **removed** (`BETK_V2_SCOPE_BASELINE.md` §10 “Removed”). `/seller/store/delivery` is **repurposed** to a pickup-address page (same §10).

**FLAG for B3 / Stage C — `delivery_preference` schema tension (do not resolve here).** Live v1 enum (REG-14, ERD, `SESSION_CONTEXT.md`) is `{delivery, pickup, remote}`. v2 makes the mode single-valued / information-free (`BETK_V2_SCOPE_BASELINE.md` §2.5: “`delivery_preference` becomes single-valued and therefore carries no information”; §10 Dead: retained but blocked at the app layer, REG-63 pattern; §11 REG-14 and REG-53 **Close**). Whether B3 collapses the enum, keeps dead members, or replaces the column is **not decided here**.

**OD:** OD-10.

### 3.4 Custom-item quoting is price discovery, feeding a cart line

> `BETK_V2_SCOPE_BASELINE.md` §1 (inquiry role), §2.2; N23 in §13; `BETK_V2_ROLE_JOURNEYS.md` §5.2 QUOTE.

Inquiry is **not** the ordering mechanism. It is **price discovery for custom items**, feeding the cart.

| Rule | Value | Authority |
|---|---|---|
| Quote floor | The listing's own fixed price | §2.2; N23 |
| Quote ceiling | **2 × the listing price** (asymmetric, admin-configurable) | §2.2; N23 |
| Band | `[listing price, 2 × listing price]` — never below the listing price | N23 |
| Validity | **24 hours** (admin-configurable) | §2.2; N23 |
| Quote carries | Firm price **and** prep time for that item | §2.2; N23 |
| On acceptance | Line enters the cart with the quoted price snapshotted and flagged custom | §2.2 |
| On expiry | Cart line becomes blocked and must be cleared or re-quoted before checkout | §2.2 |

The quote is validated against the tolerance band at send time, so quoting cannot route around the marketplace eligibility policy (`BETK_V2_SCOPE_BASELINE.md` §2.2).

**OD:** OD-11.

### 3.5 Cancellation and escalation

> `BETK_V2_SCOPE_BASELINE.md` §2.6; `BETK_V2_ROLE_JOURNEYS.md` §5.4 “ESCALATION — the only exit”, §5.2 (buyer cancel only before proof).

| Actor | May cancel | Condition | Authority |
|---|---|---|---|
| **Buyer** | Yes | Only before uploading payment proof | §2.6; §5.2 |
| **System** | Yes | Payment window expires with no proof | §2.6 |
| **Admin** | Yes | Proof rejected · escalation resolution · exceptional circumstances | §2.6 |
| **Seller** | **Never** | Must escalate | §2.6 |

Escalation is the **only** seller exit (seller-reported or SLA auto-breach). After the deposit is confirmed the buyer's exit is return/refund/dispute, never cancellation (`BETK_V2_ROLE_JOURNEYS.md` §5.2). Every cancellation restores stock (see §3.6), notifies the buyer, and — where a deposit was already confirmed — triggers a refund (`BETK_V2_SCOPE_BASELINE.md` §2.6). Escalation is **columns on the seller order**, not a table (`BETK_V2_SCOPE_BASELINE.md` §10).

**OD:** OD-14.

### 3.6 Stock lifecycle

> `BETK_V2_SCOPE_BASELINE.md` §2.7; escalation stock rule `BETK_V2_ROLE_JOURNEYS.md` §5.5.

- **Decrements at checkout**, inside the order-creation transaction.
- **Restores** on any transition into `cancelled` from a pre-delivery state.
- **Does not restore** on `returned` — a returned good may be damaged; restocking is a seller decision.
- **Out-of-stock escalation sets `stock_qty = 0`** rather than restoring — restoring would re-list a phantom.
- Made-to-order and custom items carry `stock_qty NULL` and are skipped entirely.

Any other escalation reason restores normally (`BETK_V2_ROLE_JOURNEYS.md` §5.5).

**OD:** OD-15.

### 3.7 Prep SLA

> `BETK_V2_SCOPE_BASELINE.md` §2.8; `BETK_V2_ROLE_JOURNEYS.md` §5.4 Prep SLA.

- Seller sets **prep days per listing**, capped at **3** (admin-configurable) for catalogue items.
- **Custom items are exempt** — prep time comes from the quote.
- Seller-order deadline = `confirmed_at + MAX(prep_days across its items)` (max, not sum — seller prepares in parallel).
- Ladder: reminder at **50%** elapsed · urgent at **80%** · **breach auto-creates an escalation record**.
- Breach resolution: that seller order is cancelled, the buyer refunded and sent an apology notification, and the seller's performance record is affected. **No automatic strike** — admin judgement.

Handoff 2 (Admin → Seller release) is the risk the v2 model created by removing seller acceptance; the SLA ladder exists specifically to close it (`BETK_V2_ROLE_JOURNEYS.md` §5.6).

**OD:** OD-16.

### 3.8 Address visibility

> `BETK_V2_SCOPE_BASELINE.md` §2.5; N28 in §13; `BETK_V2_ROLE_JOURNEYS.md` §5.2, §5.4.

Addresses are **never** exposed to buyer or seller. **Only admin and the courier** see them.

Sellers see **NO** buyer location — not address, not city. Order ref + items + prep deadline only (N28). Buyer never sees any seller address (`BETK_V2_ROLE_JOURNEYS.md` §5.2). BETK generates the courier's label; the seller labels the box with the order reference only (`BETK_V2_ROLE_JOURNEYS.md` §5.4).

This **supersedes** the v1 communication-posture clause that a self-delivering seller “IS the courier” and therefore reads the label (REG-14). Self-delivery is out (OD-10).

**OD:** OD-17.

### 3.9 Derived closure and derived seller balance

> Closure: `BETK_V2_SCOPE_BASELINE.md` §4.2 last paragraph; §11 REG-56 **Amend**. Balance: §2.4; §1 unchanged. No invented enum member: REG-56 standing rule, reaffirmed.

- **Seller order** closes when both its payment rows are confirmed **and** it is delivered.
- **Master** closes when every child has reached a terminal state.
- There is **no close action** and **no invented `order_status` member** for “closed” / “settled”.
- Seller balance remains **derived** at read time from stored order/payment facts. No wallet / ledger table (`BETK_V2_SCOPE_BASELINE.md` §2.4; v1 OD-8 §6 held).

**OD:** OD-18.

### 3.10 Catalogue constraints

> `BETK_V2_SCOPE_BASELINE.md` §2.1.

- **Physical products only.** `listings.type='service'` blocked at the app layer; enum member stays.
- **Every listing carries a fixed price.** No null-price, no ranged, no `starting_from`, no `per_hour`.
- **Custom items** (`is_made_to_order = true` or the custom-order toggle) additionally permit a quote (§3.4).
- **Marketplace price eligibility band** — admin-configurable min/max. A listing outside the band cannot publish.
- **Shipping attributes are mandatory to publish:** weight, and length/width/height.
- **Specs block** — free-form key/value pairs on the listing for buyer-facing detail.
- **Seller categories:** up to **3** (admin-configurable limit), approved at onboarding. A listing outside the seller's approved categories cannot be created, edited into, or published.

**OD:** OD-19.

### 3.11 Returns (dedicated evidence table)

> N25 (`BETK_V2_SCOPE_BASELINE.md` §13); flow: `BETK_V2_ROLE_JOURNEYS.md` §5.2 RETP, §5.6 return opt. Stock: §3.6 (no restore on return).

Buyer requests a return with reason + evidence. Seller accepts → return → refund; seller rejects → dispute → admin decides. Refund may be full or partial **per seller order** (`BETK_V2_ROLE_JOURNEYS.md` §5.5 Q5).

**N25 (signed):** returns get a **dedicated** returns-evidence table. Do **not** reuse `dispute_evidence`.

**OD:** OD-12.

### 3.12 Agreements / T&C

> `BETK_V2_SCOPE_BASELINE.md` §8; N26 in §13.

| Document | Engineering surface | Authority |
|---|---|---|
| Buyer Terms & Conditions | Public page · acceptance captured | §8; N26 |
| Seller Agreement | Public page · **e-signature at onboarding**: version, timestamp, seller id, status, optional IP/device | §8 |
| Return & Refund Policy | Public page · its rules drive the return flow | §8 |
| Privacy Policy | Public page — required, and absent from the v1 spec | §8 |

**N26 (signed):** terms acceptance at **SIGNUP**, and **version-gated re-confirmation before any order can complete**. `agreement_acceptances` covers **buyers as well as sellers**. Versioning implies re-acceptance when a version changes. Content is lawyer-authored; engineering owns the pages, the capture, and the version gate. Longest external lead time (`BETK_V2_SCOPE_BASELINE.md` §8).

**OD:** OD-13.

## 4. Scope-decision register

### 4.0 Occupied numbers and mint method (B1)

**Method (this session, 2026-09-19):**
1. Read this file's v1 §6 (OD-1…OD-8) and `SESSION_CONTEXT.md` “Frozen decisions” (OD-1…OD-8).
2. Repo-wide search for `OD-9` / `OD-10` / higher: **no minted OD above OD-8**. The only `OD-9` strings are (a) REG-50's **hypothesis** that a support page “would be OD-9” (never minted, never authorized) and (b) `BETK_MODIFICATION_SPEC_REVIEW.md` stating “OD-9/OD-10 are the wrong instrument”.
3. Therefore **occupied at mint time = OD-1…OD-8**. **Next free at mint time = OD-9.** REG-50 did **not** reserve OD-9.

**Took at mint time: OD-9 through OD-19.** Next free after this mint = **OD-20**.

### 4.1 v1 OD dispositions (OD-1…OD-8)

Each row is exactly one verdict. Disposition authority: `BETK_V2_SCOPE_BASELINE.md` §11 “Scope decisions”, plus the cited rule sections. Historical v1 text is retained under each row and marked where superseded.

| OD | v1 decision (historical) | v2 verdict | Cited reason |
|---|---|---|---|
| **OD-1** | Inventory alert log **DERIVED**. No `inventory_alerts` table. Low stock computed live from `listings.stock_qty ≤ low_stock_threshold`. Schema: NO. | **HOLDS UNCHANGED** | `BETK_V2_SCOPE_BASELINE.md` §11: “OD-1, OD-2, OD-3, OD-4, OD-5, OD-7 — Hold unchanged”. Low-stock notification remains a signal (`BETK_V2_SCOPE_BASELINE.md` §7). |
| **OD-2** | Account = **DEACTIVATE-ONLY** + `users.deleted_at` / `users.anonymized_at` (nullable; no MVP behavior beyond deactivation). Schema: YES. | **HOLDS UNCHANGED** | Same §11 row. |
| **OD-3** | Broadcast = **no campaign entity** (fan-out to `notifications`). Schema: NO. | **HOLDS UNCHANGED** | Same §11 row. |
| **OD-4** | Google OAuth **IN**. `users.phone_number` nullable+UNIQUE; `auth_provider`. Phone-OTP + Google OAuth. **Verified phone required before transacting** (v1 named surfaces: checkout / become seller / payout). Schema: YES. | **HOLDS UNCHANGED** | Same §11 row. **FLAG on *where* the verified-phone gate bites — see below. This FLAG is not an amendment.** |
| **OD-5** | Sessions UI **OUT**; WhatsApp templates under Admin → Settings → Notifications. Schema: NO. | **HOLDS UNCHANGED** | Same §11 row. Launch notification channel is SMS (`BETK_V2_SCOPE_BASELINE.md` §7); WhatsApp remains a BETK→user template surface, not a conversation. |
| **OD-6** | Table count **43** (documentation). Authoritative inventory in `BETK_ERD.md` §1.1. Schema: NO. | **SUPERSEDED** | `BETK_V2_SCOPE_BASELINE.md` §11: “OD-6 (43 tables) — Superseded by the v2 count”. **43 is TRUE TODAY** (live: `betk` 41 + `betk_analytics` 2 = 43, MCP `list_tables` 2026-09-19). **Superseded means the count is UNFROZEN pending B3, NOT that 43 was wrong.** No v2 table count is frozen in this document. The ~50 figure in baseline §1 / §10 is an **ESTIMATE**. |
| **OD-7** | Bilingual AR/EN + light/dark theme. Presentation-layer only. Schema: NO. | **HOLDS UNCHANGED** | Same §11 row; also §1 “Unchanged and load-bearing”. |
| **OD-8** | Custodial payments & platform commission **IN** (signed 2026-07-23; ADR-016). Buyer pays BETK; admin deposit verification; seller acceptance stays the seller's act; derived seller balance; 50/50 split; no pure-COD. Schema: YES (3 additive columns landed). | **HOLDS WITH AMENDMENT** | `BETK_V2_SCOPE_BASELINE.md` §11: “OD-8 custodial payments — Amended — still custodial; now InstaPay-only, 2 rows per *seller order*, deposit on subtotal+delivery, **no seller acceptance gate**”. Amendment text in the next block. |

#### OD-4 FLAG — where the verified-phone gate bites (not an amendment)

- **v1 (holds as named):** verified phone required before transacting, named surfaces = **checkout / become-seller / payout** (this file's v1 §6 OD-4; `SESSION_CONTEXT.md` Frozen decisions).
- **N21 (signed, do not re-open):** **No guest cart. An account is required before the first add-to-cart** (`BETK_V2_SCOPE_BASELINE.md` §13). Account ≠ verified phone: OD-4 still allows `phone_number` NULL on Google OAuth users.
- **Journeys diagram** (`BETK_V2_ROLE_JOURNEYS.md` §5.1) draws add-to-cart → AUTHENTICATION BOUNDARY → OTP → “verified phone required before transacting (OD-4)” → Buyer, and the prose says guest cannot add to cart. That drawing **does not pin** whether add-to-cart is now a “transaction” that requires verified phone.
- **`BETK_V2_ROLE_JOURNEYS.md` §5.1 still says “Open — N21”.** That line is **stale**. N21 is **ANSWERED** in `BETK_V2_SCOPE_BASELINE.md` §13. Do not re-open N21.
- **Authority does not pin** the verified-phone gate moving from checkout to add-to-cart. B2 must **not** invent that move. Become-seller and payout remain named v1 surfaces and are not relocated by the authority docs. Register home: **REG-79**.

#### OD-8 amendment text (exactly what changes under v2)

Custody **holds**. The following change:

1. **Per-seller-order commission snapshot** — commission is a flat % of **subtotal only** (never delivery), snapshotted **per seller order** at creation (`BETK_V2_SCOPE_BASELINE.md` §2.4). v1 snapshotted onto the single `orders` row.
2. **InstaPay-ONLY deposit rail** — buyer pays BETK via InstaPay only (`BETK_V2_SCOPE_BASELINE.md` §2.4). v1 buyer rails were InstaPay · Vodafone Cash · Orange Cash. Seller **settlement** handles remain InstaPay / Vodafone Cash / Orange Cash (same §2.4 Settlement).
3. **ONE admin verification across all deposit rows** — one admin action confirms every deposit row under that master (`BETK_V2_SCOPE_BASELINE.md` §2.4, §4.3; `BETK_V2_ROLE_JOURNEYS.md` §5.5 Q2).
4. **No seller acceptance** — admin approval **releases** the order to the seller (`BETK_V2_SCOPE_BASELINE.md` §1 table “Seller acceptance”, §4.1 “there is no seller acceptance”; `BETK_V2_ROLE_JOURNEYS.md` §5.4 “ORDER ARRIVES ALREADY COMMITTED”). **AC-SEL-14 is retired** (§7).
5. **Courier-collected balance per shipment** — the 50% COD balance is collected by the courier **per shipment** at its own delivery; admin confirms that seller order's balance row after the courier remits (`BETK_V2_SCOPE_BASELINE.md` §2.4, §4.3).

Also restated by the same amendment (baseline §2.4 / §11): **2 payment rows per seller order**; deposit = 50% of **(subtotal + delivery)** for that seller order; one transfer covering the whole master. Proof placement is **N22 DIRECTION**, validated by B3 — not frozen here.

v1 OD-8 sentences that **no longer hold:** “order acceptance stays the seller's act”; “Table count 43 and page count 59 both HOLD”; buyer rails including Vodafone Cash / Orange Cash.

### 4.2 v2 ODs minted this session

Schema marker is YES/NO only. **No table count and no page count is asserted.** Indicative names in `BETK_V2_SCOPE_BASELINE.md` §10 are **ESTIMATES** for B3.

| OD | One-line decision | Authority | Schema |
|---|---|---|---|
| **OD-9** | Order shape is **one cart → one master order → N seller orders → N shipments**. Master owns buyer, address, the single proof, aggregate status, combined delivery total. Seller order owns items, own delivery fee, commission snapshot, prep deadline, shipment, two payment rows, escalation. | `BETK_V2_ROLE_JOURNEYS.md` core concept + §5.3; `BETK_V2_SCOPE_BASELINE.md` §3, §4.1–§4.2 | **YES** — new tables / rename / FKs. Indicative names in baseline §10 (`cart_items`, `master_orders`; `orders` → `seller_orders`). Live today already has `shipments` / `shipment_tracking_events` (MCP `list_tables` 2026-09-19). B3 freezes the inventory. |
| **OD-10** | **Courier-only delivery.** Fee from origin × destination × weight **rate matrix**, computed per seller order; buyer sees **one combined total**; each seller order stores its own fee. No pickup, remote, or self-delivery. | `BETK_V2_SCOPE_BASELINE.md` §2.5, §1 table | **YES** — indicative `courier_rates` (baseline §10). **`delivery_preference` tension FLAGGED for B3/Stage C** (§3.3). |
| **OD-11** | Custom-item quoting is **price discovery** feeding a cart line. Band = `[listing price, 2 × listing price]` (N23), valid 24h, carries prep time. Inquiry is not the ordering mechanism. | `BETK_V2_SCOPE_BASELINE.md` §1, §2.2, §13 N23; `BETK_V2_ROLE_JOURNEYS.md` §5.2 | **YES** — indicative inquiry quote columns (baseline §10: `quoted_price`, `quote_expires_at`, `quoted_prep_days`). |
| **OD-12** | Returns are in scope with a **dedicated evidence table**. Do not reuse `dispute_evidence` (N25). | `BETK_V2_SCOPE_BASELINE.md` §13 N25; `BETK_V2_ROLE_JOURNEYS.md` §5.2 RETP | **YES** — indicative `returns` + dedicated returns-evidence table (baseline §10; N25). |
| **OD-13** | Agreements / T&C: capture at **signup**; **version-gate** before any order can complete; `agreement_acceptances` covers **buyers and sellers** (N26). Seller Agreement e-signed at onboarding. | `BETK_V2_SCOPE_BASELINE.md` §8, §13 N26; `BETK_V2_ROLE_JOURNEYS.md` §5.4 ONB (seller-agreement e-signature) | **YES** — indicative `agreement_acceptances` (baseline §10). |
| **OD-14** | **Escalation is the only seller exit.** Seller can never cancel. Buyer may cancel only before proof upload. | `BETK_V2_SCOPE_BASELINE.md` §2.6; `BETK_V2_ROLE_JOURNEYS.md` §5.4 | **YES** — escalation is **columns on the seller order**, not a table (baseline §10). |
| **OD-15** | Stock **decrements at checkout**, **restores** on cancel/expiry from a pre-delivery state, **does not restore** on return, **sets `stock_qty = 0`** on out-of-stock escalation. Custom/MTO skipped (`stock_qty` NULL). | `BETK_V2_SCOPE_BASELINE.md` §2.7; `BETK_V2_ROLE_JOURNEYS.md` §5.5 stock rule | **NO** — behavior of existing `listings.stock_qty`. |
| **OD-16** | Prep SLA: deadline = `confirmed_at + MAX(prep_days)` across that seller order's items; 50% reminder · 80% urgent · **breach auto-escalates**. Catalogue cap 3 days; custom prep comes from the quote. | `BETK_V2_SCOPE_BASELINE.md` §2.8; `BETK_V2_ROLE_JOURNEYS.md` §5.4 | **YES** — indicative `listings.prep_days` and seller-order deadline (baseline §10). |
| **OD-17** | Addresses visible to **admin + courier only**. Seller sees no buyer identity or location (not name, not phone, not address, not city) (N28). Buyer never sees seller address. | `BETK_V2_SCOPE_BASELINE.md` §2.5, §13 N28; `BETK_V2_ROLE_JOURNEYS.md` §5.2, §5.4 | **NO** — read restriction / RLS. Indicative store pickup-address **columns** are listed in baseline §10; B3 owns them. This OD does not freeze that column list. Courier principal for RLS = **REG-78**. |
| **OD-18** | Closure is **derived** (seller order: both payment rows confirmed AND delivered; master: every child terminal). Seller balance is **derived**. **No close action. No invented enum member.** | `BETK_V2_SCOPE_BASELINE.md` §4.2, §2.4; §11 REG-56 Amend; `BETK_V2_ROLE_JOURNEYS.md` §5.4 PAYS (derived balance) | **NO** — derived; forbids a new `order_status` member. |
| **OD-19** | Catalogue: **products only**; **fixed price** on every listing; shipping attributes mandatory; seller categories capped at 3; eligibility band. | `BETK_V2_SCOPE_BASELINE.md` §2.1 | **YES** — indicative `store_categories`, listing shipping/specs columns; dead `price_type` / `type='service'` members blocked at the app layer (baseline §10). B3 freezes. |

### 4.3 Historical v1 freeze text (superseded in place — not deleted)

The 2026-06-13 freeze sheet and the OD-7 / OD-8 amendment blocks that previously lived in this file's §6 are **historical**. Their operative fate is §4.1. They are not re-frozen.

<details>
<summary>v1 §6 freeze sheet (signed 2026-06-13; OD-7 2026-07-01; OD-8 2026-07-23) — historical</summary>

- **OD-1 — Inventory alert log: DERIVED.** No `inventory_alerts` table. Low stock computed live from `listings.stock_qty ≤ low_stock_threshold`. No alert history/acknowledgement/lifecycle. Post-MVP: add table when history/analytics/escalation needed. *Schema change: NO.*
- **OD-2 — Account deletion (MW1): DEACTIVATE-ONLY + schema add.** Account can be deactivated; login blocked after; no hard delete; no anonymization. **Add now:** `users.deleted_at TIMESTAMPTZ NULL`, `users.anonymized_at TIMESTAMPTZ NULL` (forward-compat; no MVP behavior beyond deactivation). Post-MVP: full deletion + anonymization + retention. *Schema change: YES (2 nullable columns).*
- **OD-3 — Broadcast tracking (MW4): NO-CAMPAIGN-ENTITY.** Broadcasts create `notifications` rows; per-notification delivery status only. No campaign entity/analytics/dashboard/audience snapshot. Post-MVP: `notification_campaigns` + reporting. *Schema change: NO.*
- **OD-4 — Google OAuth: IN.** Sign-in via phone-OTP **or** Google OAuth (Supabase Auth links both). `users.phone_number` becomes nullable+UNIQUE; `users.auth_provider` records origin. **Verified phone required before transacting** (checkout / become seller / payout). *Schema change: YES (phone nullable + `auth_provider`).*
- **OD-5 — Sessions UI OUT / WhatsApp templates merged.** No sessions/active-sessions page. WhatsApp template management lives under **Admin → Settings → Notifications** (no standalone page). *Schema change: NO.*
- **OD-6 — Table count: 43 (documentation).** Authoritative inventory + counting methodology added to `BETK_ERD.md §1.1`. *Schema change: NO.* **SUPERSEDED — count UNFROZEN pending B3; 43 remains true of today's live schema.**
- **OD-7 — Bilingual AR/EN web app + light/dark theme: IN (no translation service).** App becomes bilingual Arabic/English and light/dark themed over the then-existing page set — no new pages, no new tables, no new content columns, no new dependency. (v1 “over the existing 59 pages” is a **count that is UNFROZEN**; the presentation-layer rule HOLDS.)
- **OD-8 — Custodial payments & platform commission: IN (amended 2026-07-23).** Historical full record: `docs/10-ai-development/OD8_CUSTODIAL_PAYMENTS.md`. v2 operative text is §4.1 amendment. Sentences in that record that freeze table count 43 / page count 59, keep seller acceptance, or keep three buyer rails are **superseded** by this file.

</details>

## 5. Features included (in scope)

In scope iff it is authorized by this file + the two authority docs. **Page inventory is UNFROZEN** — B4 freezes pages against `BETK_UI_SPEC.md`. The v1 “59 pages” freeze is **SUPERSEDED**. Baseline §10 lists an **ESTIMATE** of ~14 new pages → **~73** total; that is an estimate, not a freeze.

**v2-authorized capabilities (cite §3 / §4):**

- Guest browse / search / category / listing / storefront / legal pages / public-link share (`BETK_V2_ROLE_JOURNEYS.md` §5.1).
- Account-gated cart (N21) · custom-item quote channel (OD-11) · checkout creating master + N seller orders + 2N payments in one transaction (OD-9; ADR-018 **Redo** is recorded in baseline §11, not designed here).
- Custodial InstaPay deposit + courier COD balance (OD-8 amended) · one proof · one admin verification (N22 DIRECTION).
- Courier-only fulfilment + rate matrix (OD-10) · admin ready-for-pickup queue · courier handoff (API or manual).
- Prep SLA ladder + auto-escalation (OD-16, OD-14) · returns with dedicated evidence (OD-12) · agreements + version-gate (OD-13).
- Derived seller balance + derived closure (OD-18) · manual payouts · seller performance audit with stock-accuracy leading (`BETK_V2_SCOPE_BASELINE.md` §6).
- Catalogue constraints (OD-19) · seller onboarding with pickup address, up to 3 categories, seller-agreement e-signature, food-docs branch (`BETK_V2_ROLE_JOURNEYS.md` §5.4).
- Phone-OTP **and Google OAuth** (OD-4, holds) · deactivate-only accounts (OD-2, holds) · bilingual AR/EN + light/dark (OD-7, holds) · in-app communication only (baseline §1 unchanged).
- Admin configuration listed in `BETK_V2_SCOPE_BASELINE.md` §9 (price band, commission %, quote tolerance/validity, payment window, prep cap, category limit, courier matrix, return window, food requirements, low-stock threshold default). **Deliberately NOT configurable:** order statuses · whether sellers may cancel · whether buyers may cancel after payment (same §9).

**Survives from phases 01–05** (baseline §11 Build): design system, process artifacts, `requireAdmin` / `requireVerifiedPhone` / `requireActiveUser`, private-bucket proof upload, admin deposit-verification slice, derived-balance rule. **Repurposed:** Phase 06 messaging becomes the quote channel. **Rebuilt:** `create_order_from_inquiry` rpc, `/checkout`, `/orders`, order-set RLS, `order_status` enum (baseline §11). Those rebuilds are **in scope as work**, not a license to invent pages or tables.

**v1 capability list (historical — SUPERSEDED in part).** The v1 §4 paragraph named 59 pages, three buyer rails, Bosta/self-deliver/pickup/remote, and inquiry-to-order. Counts are unfrozen; rails and delivery modes are retired per §7. Capabilities v2 does **not** contradict (boost packages, seller levels, disputes, reviews, collections, 1–2 keyword search, wishlists, follows, soft deletes, RLS on every table) remain in scope **until B4/B3 say otherwise**. This is preserve-where-untouched, not a new freeze.

<details>
<summary>v1 §3 “70 use cases” and v1 §4 “59 pages” — SUPERSEDED counts, retained as history</summary>

v1 claimed “Use cases (frozen — 70)” and “59 pages across Public/Guest (5), Auth (3), Buyer (13), Seller (22), Admin (16)”. **Those counts are UNFROZEN.** B2 rewrites the FR set against §3 and §4; B4 freezes pages. The v1 grouping (Auth & profile / Discovery / Buyer transaction / Seller operations / Admin / System) is a historical inventory, not a freeze.

</details>

## 6. Features excluded (post-MVP / out of scope)

| Excluded | Reason | Re-entry condition |
|---|---|---|
| Multi-store per seller | `stores.seller_id` is UQ (1:1). C3 §8.4(1). v2 does not lift this (`BETK_V2_SCOPE_BASELINE.md` does not authorize multi-store). | Drop UQ + query rework, post-MVP. |
| Platform wallet / escrow (**persisted** balance ledger) | Custody is IN (OD-8 holds); seller balance is **DERIVED** (OD-18). A persisted ledger stays OUT (`BETK_V2_SCOPE_BASELINE.md` §2.4; v1 OD-8 §6). | New ledger table — post-MVP, on the OD-8 §6 revisit trigger. |
| Product variants (size/color) | No `listing_variants` table. C3 §8.4(3). v2 does not add variants. | Add variants table for fashion/handmade. |
| **~~Multi-listing cart checkout~~** | **SUPERSEDED — now IN** (OD-9; baseline §1, §2.3). Historical C3 §8.4(4) exclusion is retired. | — |
| Real-time per-listing analytics / hourly snapshots | Snapshots are daily. C3 §8.4(6). v2 does not add `listing_view_events`. | Add `listing_view_events`. |
| Automated payment-gateway capture & automated payouts | Explicitly unchanged (`BETK_V2_SCOPE_BASELINE.md` §1). | Gateway integration. |
| Native mobile apps | MVP is responsive web (Next.js). | Separate track. |
| **Services as listings** | Postponed. `listings.type='service'` blocked at the app layer; enum retained (`BETK_V2_SCOPE_BASELINE.md` §2.1). | Unblock the enum member + product decision. |
| **Guest cart** | N21: no guest cart. | Re-open N21 (not authorized). |
| **Seller cancellation of orders** | OD-14: seller never cancels; must escalate. | Re-open OD-14 (not authorized). |
| **Pickup / remote / self-delivery** | OD-10: courier only. | Re-open OD-10 (not authorized). |
| **Buyer Vodafone Cash / Orange Cash deposit rails** | OD-8 amendment: InstaPay only on the buyer side. Seller settlement handles still include VF/Orange (`BETK_V2_SCOPE_BASELINE.md` §2.4). | Re-open the buyer-rail amendment. |
| **Persisted “closed” order status** | OD-18 / REG-56: derived; no invented enum member. | An OD amendment that adds a member — not invented here. |
| Dedicated web-app **support page** | REG-50: Help center stays unrouted; support is a BETK→user WhatsApp deep-link. **Not OD-9** (that number is now the cart/order-shape decision). A support page would take the **next free OD at mint time**. | New OD at mint time + B4 page freeze. |

## 7. Retired v1 scope

Each killed v1 element has a v2 replacement. Named v1 AC ids appear **only** as retired artifacts.

| Retired v1 element | Replacement | Authority |
|---|---|---|
| **AC-BUY-6** — order only from a seller-confirmed inquiry | Cart → checkout → master + N seller orders. Inquiry is **price discovery** for custom items, feeding a cart line (OD-9, OD-11). | Baseline §1 “Order creation” / “Inquiry role” |
| **AC-SEL-14** — seller acceptance advances the order | **Removed.** Admin deposit verification **releases** the order to the seller already committed (OD-8 amendment item 4, OD-14). `confirmed` = admin-approved, not seller-accepted. | Baseline §1 “Seller acceptance”; §4.1 |
| **Single-seller order shape** | One cart → one master → N seller orders → N shipments (OD-9). | Journeys core concept + §5.3 |
| **Flat delivery fee** (`admin_settings` `delivery_fee_flat_egp`) | Courier **rate matrix** origin × destination × weight; combined buyer total; per-seller-order fee storage (OD-10). | Baseline §1 “Delivery fee”; §2.5 |
| **Pickup / remote / self-delivery** (REG-14 `delivery_preference` `{delivery, pickup, remote}`; v1 “Bosta/self-deliver/pickup/remote”) | **Courier-only** (OD-10). **FLAG:** schema tension for B3/Stage C — see §3.3. Not resolved here. | Baseline §1 “Delivery modes”; §2.5; §10 Dead; §11 REG-14/REG-53 Close |
| **Pure-COD** (order with no deposit row / COD auto-confirm) | **Already retired** by v1 OD-8 (no pure-COD path; every order carries the 50/50 split). v2 **holds** that retirement and places the COD leg on the **per-shipment balance** collected by the courier (OD-8 amendment item 5). | v1 OD-8; baseline §2.4 |
| Inquiry as **the ordering mechanism** | Inquiry as **quote channel** (OD-11). Phase 06 messaging is repurposed (baseline §11). | Baseline §1; §11 Build |
| Stock decrement **on seller accept** | Stock decrement **at checkout** (OD-15). | Baseline §1 “Stock decrement”; §2.7 |
| Four `price_type` variants (null / ranged / starting_from / per_hour) | **Fixed price on every listing** (OD-19). Other members retained but blocked at the app layer (baseline §10). | Baseline §1 “Pricing”; §2.1 |
| Products **+ services** as live listing types | **Products only**; services postponed (OD-19). | Baseline §1 “Item catalogue”; §2.1 |
| Buyer sees seller address via shipping label **because a self-delivering seller IS the courier** (REG-14) | Buyer **never** sees seller address; seller **never** sees buyer location; admin + courier only (OD-17, N28). | Baseline §1 “Buyer sees seller address”; §2.5; N28 |
| Three buyer deposit rails (InstaPay / VF Cash / Orange Cash) | **InstaPay only** (OD-8 amendment item 2). | Baseline §1 “Buyer payment rails”; §2.4 |
| Delivery-method **selection at checkout** | Removed (baseline §10). | Baseline §10 “Removed” |

## 8. Signed N-decisions (inputs — do not re-open, re-litigate, or soften)

Copied from `BETK_V2_SCOPE_BASELINE.md` §13 (signed 2026-09-03, V2-STATE-RECORD). N22 carries a **DIRECTION** that B3 validates.

| # | Decision | Status |
|---|---|---|
| **N21** | No guest cart. An account is required before the first add-to-cart. | **ANSWERED.** Do not re-open. |
| **N22** | ONE payment proof at **MASTER-ORDER** level. **DIRECTION:** each child seller order's deposit row SNAPSHOTS the proof reference at verification time, giving durable per-order traceability for later disputes, rather than resolving it only through the parent by join. **B3 (the ERD rewrite) VALIDATES** this against the existing architecture and may override it only with a stated, cited reason. | **ANSWERED-WITH-DIRECTION** (pending B3). Recorded as direction, not as a frozen schema fact. |
| **N23** | Custom-item quoting: the seller may quote up to 2× the original/requested listing price. Band = `[listing price, 2× listing price]`. Never below the listing price. Valid 24h. The quote also states that item's prep time. | **ANSWERED.** Do not re-open. |
| **N25** | Returns get a **dedicated** returns-evidence table. Do **not** reuse `dispute_evidence`. | **ANSWERED.** Do not re-open. |
| **N26** | Terms acceptance at **SIGNUP**, and version-gated re-confirmation before any order can complete. `agreement_acceptances` therefore covers **buyers** as well as sellers. | **ANSWERED.** Do not re-open. (Operational backfill of pre-N26 users is REG-75, not a re-opening.) |
| **N27** | Staging **MIGRATES**, it does not reset. Preserve current state and migrate it, so the migration path itself is validated. | **ANSWERED.** Do not re-open. (Migration design is REG-76, owned by Stage C.) |
| **N28** | Sellers see **NO** buyer location — not address, not city. Order ref + items + prep deadline only. | **ANSWERED.** Do not re-open. |

N24 is unused in the signed set (gap in numbering). Not invented here.

## 9. Hard pre-launch gates

Three gates. Launch is blocked until all three are satisfied. Authority: `BETK_V2_SCOPE_BASELINE.md` §12.

| Gate | Content |
|---|---|
| **REG-62 (narrowed)** | `betk_instapay_handle` set · **commission %** set · **price band** set. v1 REG-62 also named `delivery_fee_flat_egp`, `return_hold_hours`, and VF/Orange BETK handles. Those extras are **not** this narrowed gate: the delivery number moves to the **Courier gate** (rate matrix); buyer rail is InstaPay-only (OD-8 amendment). `return_hold_hours` is not named in baseline §12. **FLAG for B3:** whether `return_hold_hours` remains a separate pre-launch setting is unpinned by §12; do not invent it back into REG-62 here. |
| **Courier gate (N1/N15)** | Rate matrix numbers · order-handoff mechanism (API or manual) · coverage map. |
| **Legal gate (Q12)** | Buyer T&C · Seller Agreement · Return Policy · Privacy Policy, lawyer-reviewed and published. |

`0` and `''` sentinels on payment-config keys remain “not yet configured”, not business decisions (historical REG-62). The narrowed gate does not authorize going live on sentinels.

## 10. Success metrics

Preserved from v1 (v2 does not replace this table). G3's “supported local method” list is read **through OD-8 amended**: the buyer-facing rail is InstaPay + COD-balance; VF/Orange remain seller-settlement handles, not buyer deposit rails.

| Goal | Metric (launch target) |
|---|---|
| G1 Empower sellers | ≥ 200 approved active stores in first 90 days; seller onboarding completion ≥ 60%. |
| G2 Buyer trust | ≥ 70% of delivered orders reviewed; dispute resolution within 48h SLA ≥ 95%. |
| G3 Local payments | ≥ 90% of orders use a supported local method (InstaPay deposit + COD balance; seller settlement may use InstaPay / VF Cash / Orange Cash). |
| G4 Neighborhood discovery | ≥ 40% of searches use a governorate/city filter. |
| G5 Arabic-first | 100% of core flows usable RTL in Arabic; zero LTR layout breakage on key pages. |
| G6 Monetization | ≥ 5% of active sellers purchase ≥ 1 boost in first 90 days. |
| G7 Quality control | Seller approval SLA ≤ 24h ≥ 95%; flagged-content review ≤ 24h ≥ 95%. |
| Platform | Homepage/storefront p95 < 2.5s on Egyptian mobile networks; Core Web Vitals "good". |

**REG-80 — CLOSED (2026-09-22, scope owner):** G6 (boosts) is **IN for v2 MVP as retained v1 scope**. `BETK_V2_SCOPE_BASELINE.md` does not mention boosts; that silence is not an exclusion. The v1 boost text stands. B4 maps those retained capabilities and must not drop them or invent additional boost requirements. Any boost schema question is B3’s (REG-78-class flag), not a new requirement. Phases 01–05 survive (baseline §11) and `boosts` / `boost_packages` exist live today (MCP `list_tables` 2026-09-19).

## 11. Sign-off / supersession history

- **2026-06-13** — Scope FROZEN (OD-1…OD-6).
- **2026-07-01** — Amended OD-7 (bilingual AR/EN + theme).
- **2026-07-23** — Amended OD-8 (custodial payments). Historical record: `OD8_CUSTODIAL_PAYMENTS.md`. Sentences in that record that freeze 43/59, keep seller acceptance, or keep three buyer rails are superseded by §4.1.
- **2026-09-03** — V2-STATE-RECORD. v1 freeze (43 tables · 59 pages · OD-1…OD-8 · AC-BUY-6) recorded SUPERSEDED. Scope temporarily UNFROZEN pending rewritten ERD (tables) and UI_SPEC (pages). N21–N23, N25–N28 signed. Authority = the two v2 docs.
- **2026-09-19 — B1.** This file rewritten. OD-1…OD-8 dispositions recorded. **OD-9…OD-19 minted.** Counts remain **UNFROZEN** pending B3 (tables) and B4 (pages). Next: B2 (PRD rewrite) cites §1–§11; B2 does not mint ODs.
- **2026-09-19 — B1-FIX.** OD-9…OD-19 authority citations confirmed in §4.2. Communication-posture + PRECEDENTS self-delivery-as-courier clause marked **SUPERSEDED in place** (seller sees no buyer identity or location). Minted **REG-78** (courier RLS principal), **REG-79** (OD-4 gate location), **REG-80** (boosts in-or-out).
- **2026-09-22 — B2-FIX.** REG-80 closed by the scope owner: boosts are in for v2 MVP as retained v1 scope. The §10 flag no longer says in-or-out is undecided. No boost requirement was added.

After this rewrite, additions still require a written change request and re-baselining of the PRD and phases. B2 writes FRs/ACs against this scope; B3 freezes tables; B4 freezes pages.

- Product owner: __________  Date: ______
- Tech lead: __________  Date: ______

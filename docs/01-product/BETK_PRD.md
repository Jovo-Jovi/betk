# BETK_PRD.md
> Step 2 of the BETK Dev OS. **v2 rewrite (B2, 2026-09-19).** Functional requirements (R / FR / AC) for the v2 marketplace. B3 (ERD) and B4 (UI Spec) cite this file **section-by-section**.
>
> **Authority, in this order:** [`docs/01-product/BETK_MVP_SCOPE.md`](./BETK_MVP_SCOPE.md) §1–§11 (B1 — the OD register is binding), then [`docs/10-ai-development/BETK_V2_SCOPE_BASELINE.md`](../10-ai-development/BETK_V2_SCOPE_BASELINE.md) + [`docs/10-ai-development/BETK_V2_ROLE_JOURNEYS.md`](../10-ai-development/BETK_V2_ROLE_JOURNEYS.md). The v1 text of this file is the **source being rewritten**, not the target. Every v2 requirement cites an MVP_SCOPE section. Facts not citable are **FLAGGED**, never invented.
>
> **Layer:** this document writes **observable behaviour**. It does **not** design tables, columns, enums, policies, or RLS (B3). It does **not** enumerate or count pages (B4). Domain words (cart line, master order, seller order, shipment, deposit obligation, COD-balance obligation) are product concepts from MVP_SCOPE §3; storage and routes are out of this layer.
>
> **Status:** v2 rewrite (B2). N-decisions N21, N22, N23, N25, N26, N27, N28 are **signed inputs** — do not re-open. REG-79 (OD-4 verified-phone gate location under N21) is **OPEN** — this file does not pick add-to-cart vs checkout. REG-78 (courier principal) **principle is closed** (no courier login, ADR-024); the handoff mechanism stays **open under the courier gate**. Courier requirements in this file stay **what the courier must do**. REG-80 (boosts) is **CLOSED** (2026-09-22, scope owner) — boosts are in for v2 MVP as retained v1 scope; those codes are **RETAINED** (v1 text stands), neither rewritten nor expanded.

---

> ## TABLES ARE FROZEN at 51 (OD-20). PAGES ARE FROZEN at 79 (OD-21).
>
> The v1 freeze of **43 tables** and **59 pages**, and the v1 PRD framing “one FR per wireframed page”, are **SUPERSEDED**. They are not the v2 inventory.
>
> Live introspection still measures **43** physical tables (`betk` 41 + `betk_analytics` 2). That figure is **TRUE TODAY** (B3, 2026-09-22, `pg_tables`). It is not the v2 target.
>
> **B3 froze the target table count at 51** (`betk` 49 + `betk_analytics` 2) under **OD-20**, which supersedes OD-6. **B4 froze the page count under OD-21, corrected in place to 79** (B4-FIX2) (`BETK_UI_SPEC.md` §0). The ~50 / ~73 figures in `BETK_V2_SCOPE_BASELINE.md` §1 and §10 stay **estimates**. This document still does not enumerate routes; B4 does.

---

## How B3 and B4 cite this file

| Cite | For |
|---|---|
| §0 | Occupied code namespace + mint method (do not re-mint occupied IDs) |
| §1 | v1 requirement disposition (every v1 R / FR / spelled-out AC) |
| §2 | Actors (behaviour; courier is not an authenticated app role) |
| §3 | v2 functional requirements by domain — **one subsection per load-bearing capability** |
| §4 | Non-functional requirements |
| §5 | Security requirements (REG-79 OPEN) |
| §6 | New and amended acceptance criteria (testable) |
| §7 | Bidirectional cross-check (OD → requirement, requirement → MVP_SCOPE) |
| §8 | STOP-and-flags |
| §9 | Historical v1 PRD (superseded in place — not deleted) |
| §10 | Sign-off / supersession history |

---

## 0. Code namespace (mint time, this session)

**Method (2026-09-19, B2):**

1. Occupied = a minted ID in the v1 PRD + the C1 rule IDs actually cited across `docs/` (not the journal). Extracted with `rg -o --no-filename` of `\bR-[A-Z][0-9]{2}\b`, `\bFR-[A-Z]+-\d+\b`, `\bAC-[A-Z]+-\d+\b` on `docs/` excluding `docs/12-changelog/**`, then `Sort-Object -Unique`.
2. v1 PRD §9 says each FR has a generic same-ID AC (“page renders…”). Those implied ACs were **never minted as distinct spelled-out codes**. Occupied **spelled-out** ACs are only the four named in v1 §9. Implied same-ID ACs **inherit the parent FR’s verdict** (see §1.3) so none are silently dropped.
3. Next free in an existing family = **max occupied + 1**. New families start at `-1`. Numbers are taken at mint, never reserved by mention (PRECEDENTS: numbers-taken-at-mint-time).

### 0.1 Occupied before this mint

| Family | Occupied | Next free **before** this mint |
|---|---|---|
| **R-A** | R-A01–R-A06 | R-A07 |
| **R-S** | R-S01–R-S09 | R-S10 |
| **R-L** | R-L01–R-L10 | R-L11 |
| **R-O** | R-O01–R-O10 (R-O04 already retired in v1 OD-8) | R-O11 |
| **R-R** | R-R01–R-R07 | R-R08 |
| **R-D** | R-D01–R-D06 | R-D07 |
| **R-N** | R-N01–R-N06 | R-N07 |
| **R-M** | R-M01–R-M06 | R-M07 |
| **R-B** | R-B01–R-B05 | R-B06 |
| **FR-PUB** | FR-PUB-1–5 | FR-PUB-6 |
| **FR-AUTH** | FR-AUTH-1–3 | FR-AUTH-4 |
| **FR-BUY** | FR-BUY-1–13 | FR-BUY-14 |
| **FR-SEL** | FR-SEL-1–22 | FR-SEL-23 |
| **FR-ADM** | FR-ADM-1–17 | FR-ADM-18 |
| **AC** (spelled-out) | AC-BUY-6, AC-SEL-14, AC-ADM-9, AC-AUTH-2 | next in each family below |
| **AC-PUB / AC-BUY / AC-SEL / AC-ADM** implied | same-ID as FR (generic criterion only) | not a mint; inherit FR verdict |

No pre-existing **R-C / R-Q / R-E / R-F / R-U / R-G / R-K / R-V** families. No pre-existing **FR-CART / FR-CHK / FR-PAY / FR-QTE / FR-SLA / FR-ESC / FR-STK / FR-RET / FR-AGR / FR-COU / FR-VIS / FR-CLO / FR-COM / FR-CAT** families.

### 0.2 Took at mint time

| Family | Took | Next free **after** this mint |
|---|---|---|
| R-A | **R-A07** | R-A08 |
| R-S | **R-S10** | R-S11 |
| R-L | **R-L11–R-L22** | R-L23 |
| R-O | **R-O11–R-O29** | R-O30 |
| R-N | **R-N07–R-N08** | R-N09 |
| R-M | **R-M07–R-M08** | R-M09 |
| R-C (new) | **R-C01–R-C07** | R-C08 |
| R-Q (new) | **R-Q01–R-Q08** | R-Q09 |
| R-E (new) | **R-E01–R-E05** | R-E06 |
| R-F (new) | **R-F01–R-F05** | R-F06 |
| R-U (new) | **R-U01–R-U05** | R-U06 |
| R-G (new) | **R-G01–R-G08** | R-G09 |
| R-K (new) | **R-K01–R-K09** | R-K10 |
| R-V (new) | **R-V01–R-V04** | R-V05 |
| FR-AUTH | **FR-AUTH-4** | FR-AUTH-5 |
| FR-ADM | **FR-ADM-18–FR-ADM-21** | FR-ADM-22 |
| FR-CART (new) | **FR-CART-1** | FR-CART-2 |
| FR-CHK (new) | **FR-CHK-1** | FR-CHK-2 |
| FR-PAY (new) | **FR-PAY-1–2** | FR-PAY-3 |
| FR-QTE (new) | **FR-QTE-1** | FR-QTE-2 |
| FR-SLA (new) | **FR-SLA-1** | FR-SLA-2 |
| FR-ESC (new) | **FR-ESC-1** | FR-ESC-2 |
| FR-STK (new) | **FR-STK-1** | FR-STK-2 |
| FR-RET (new) | **FR-RET-1** | FR-RET-2 |
| FR-AGR (new) | **FR-AGR-1** | FR-AGR-2 |
| FR-COU (new) | **FR-COU-1** | FR-COU-2 |
| FR-VIS (new) | **FR-VIS-1** | FR-VIS-2 |
| FR-CLO (new) | **FR-CLO-1** | FR-CLO-2 |
| FR-COM (new) | **FR-COM-1** | FR-COM-2 |
| FR-CAT (new) | **FR-CAT-1** | FR-CAT-2 |
| AC-AUTH | **AC-AUTH-4** | AC-AUTH-5 |
| AC-CART (new) | **AC-CART-1–7** | AC-CART-8 |
| AC-CHK (new) | **AC-CHK-1–6** | AC-CHK-7 |
| AC-PAY (new) | **AC-PAY-1–8** | AC-PAY-9 |
| AC-QTE (new) | **AC-QTE-1–6** | AC-QTE-7 |
| AC-SLA (new) | **AC-SLA-1–5** | AC-SLA-6 |
| AC-ESC (new) | **AC-ESC-1–5** | AC-ESC-6 |
| AC-STK (new) | **AC-STK-1–5** | AC-STK-6 |
| AC-RET (new) | **AC-RET-1–5** | AC-RET-6 |
| AC-AGR (new) | **AC-AGR-1–5** | AC-AGR-6 |
| AC-COU (new) | **AC-COU-1–6** | AC-COU-7 |
| AC-VIS (new) | **AC-VIS-1–4** | AC-VIS-5 |
| AC-CLO (new) | **AC-CLO-1–3** | AC-CLO-4 |
| AC-COM (new) | **AC-COM-1–3** | AC-COM-4 |
| AC-CAT (new) | **AC-CAT-1–6** | AC-CAT-7 |
| AC-ADM | **AC-ADM-18–21** | AC-ADM-22 |

**Not taken:** R-B06, FR-PUB-6, FR-BUY-14, FR-SEL-23, any new boost AC. Boost families are **RETAINED** (REG-80 closed); no new boost ID was minted.

**R-R08 / R-D07** not taken as new IDs. **REG-83 closed (2026-09-22):** one buyer review per **seller order**. **REG-84 closed (2026-09-22):** no master-level dispute. R-O07 and R-O06 carry those pins.

---

## 1. v1 requirement disposition

Exactly one verdict per v1 code: **HOLDS UNCHANGED** / **HOLDS WITH AMENDMENT** / **SUPERSEDED** / **RETIRED** / **RETAINED**. **RETAINED** means the v1 text stands (REG-80 closed 2026-09-22 — boosts in for v2 MVP). Amendment rows state the **text**, not just “amended”.

### 1.1 Business rules (R-*)

| Code | v1 (historical) | Verdict | Cited reason + amendment text where applicable |
|---|---|---|---|
| **R-A01** | Phone-OTP + Google OAuth; no passwords (OD-4) | **HOLDS UNCHANGED** | MVP_SCOPE §4.1 OD-4 HOLDS UNCHANGED. Gate *location* is R-A07 / REG-79, not an amendment of R-A01. |
| **R-A02** | 60s OTP expiry, one active per phone, ≤5 attempts | **HOLDS UNCHANGED** | Untouched by v2 ODs. |
| **R-A03** | Phone unique, nullable | **HOLDS UNCHANGED** | OD-4 holds. |
| **R-A04** | Roles additive | **HOLDS UNCHANGED** | §2 actors unchanged in kind (courier is **not** a new authenticated role — REG-78). |
| **R-A05** | Suspended / deactivated blocked | **HOLDS UNCHANGED** | OD-2 holds. |
| **R-A06** | Phone read-only post-verify | **HOLDS UNCHANGED** | OD-4 holds. |
| **R-S01** | One store per seller | **HOLDS UNCHANGED** | §6 multi-store still out. |
| **R-S02** | Unique URL-safe slug | **HOLDS UNCHANGED** | Untouched. |
| **R-S03** | Slug change once | **HOLDS UNCHANGED** | Untouched. |
| **R-S04** | Approval gates go-live | **HOLDS UNCHANGED** | Untouched. |
| **R-S05** | National ID front+back | **HOLDS UNCHANGED** | Untouched. |
| **R-S06** | Seller level thresholds | **HOLDS UNCHANGED** | Untouched. |
| **R-S07** | Suspended store hidden | **HOLDS UNCHANGED** | Untouched. |
| **R-S08** | Resubmit retains docs | **HOLDS UNCHANGED** | Untouched. |
| **R-S09** | ≥1 settlement handle to publish | **HOLDS UNCHANGED** | Already OD-8-amended in v1 (REG-61). v2 does not reopen. |
| **R-L01** | Category required | **HOLDS WITH AMENDMENT** | **Amendment:** category is required **and** must be one of the seller’s approved set (cap 3, admin-configurable) — MVP_SCOPE §3.10. Creating, editing into, or publishing outside that set is refused. |
| **R-L02** | ≥1 image to publish | **HOLDS UNCHANGED** | §3.10 does not retire it. |
| **R-L03** | Arabic title to publish | **HOLDS UNCHANGED** | Untouched. |
| **R-L04** | Category to publish | **HOLDS WITH AMENDMENT** | **Amendment:** same approved-set rule as R-L01; additional publish gates in R-L18 and R-L21 (shipping attributes, eligibility band) — §3.10. |
| **R-L05** | Stock decremented on seller confirm, not at checkout | **HOLDS WITH AMENDMENT** | **Amendment:** stock **decrements at checkout**, inside the order-creation attempt (all-or-nothing). It does **not** decrement on seller acceptance (acceptance is retired, AC-SEL-14). MVP_SCOPE §3.6, §7. |
| **R-L06** | Stock 0 → sold_out | **HOLDS UNCHANGED** | Still the observable effect when tracked stock reaches zero, including after checkout decrement or out-of-stock escalation zeroing — §3.6. |
| **R-L07** | Restock → active | **HOLDS UNCHANGED** | Untouched. |
| **R-L08** | One active boost per listing | **RETAINED** | v1 text stands. REG-80 closed 2026-09-22 (scope owner): boosts are in for v2 MVP as retained v1 scope. Not rewritten, not expanded. |
| **R-L09** | Service listings hide/omit stock; four `price_type` variants | **HOLDS WITH AMENDMENT** | **Amendment:** `type='service'` is **blocked at the app layer** (enum member retained for later — B3 owns storage). Custom / made-to-order items remain **untracked** (skipped by decrement / restore / zeroing). Four price variants are **retired** in favour of fixed price (R-L17). MVP_SCOPE §3.6, §3.10, §7. |
| **R-L10** | Soft-delete; removed → public 404 | **HOLDS UNCHANGED** | Untouched. |
| **R-O01** | Order only from a seller-confirmed inquiry | **SUPERSEDED** | Replaced by R-O11 (cart → checkout). Inquiry is price discovery (OD-11). MVP_SCOPE §7 AC-BUY-6 retired row; §3.1, §3.4. |
| **R-O02** | BETK-ref `BETK-YYYYMMDD-XXXX` on the (single) order | **HOLDS WITH AMENDMENT** | **Amendment:** the buyer-facing order number is owned by the **master** (§3.1). Child seller-order identifier **shape** is unpinned (**OPEN REG-81**). The journeys §5.3 example `BETK-2026-000123` is **illustrative**, not a format pin. |
| **R-O03** | Buyer cancel only while pending | **HOLDS WITH AMENDMENT** | **Amendment:** buyer may cancel the **master** **only before uploading payment proof**. After proof upload, buyer cancel is refused. After deposit confirmation, the buyer’s exit is return / refund / dispute, never cancellation. **Citation (resolves REG-73):** `BETK_V2_ROLE_JOURNEYS.md` §5.2 — “Buyer may cancel only before uploading proof. After the deposit is confirmed the exit is return/refund/dispute, never cancellation.” Cancel-window row: `BETK_V2_SCOPE_BASELINE.md` §2.6 — Buyer / Yes / “Only before uploading payment proof.” MVP_SCOPE §3.5 repeats that pin. |
| **R-O04** | COD auto-confirm | **RETIRED** | Already retired by v1 OD-8. v2 **holds that retirement**. MVP_SCOPE §7. |
| **R-O05** | Admin verifies the deposit (v1: one order, one deposit row) | **HOLDS WITH AMENDMENT** | **Amendment:** **one** admin action confirms **every** deposit obligation under that master **and RELEASES** every child seller order (status meaning: admin-approved and with the seller — not seller-accepted). MVP_SCOPE §3.2, §4.1 OD-8 items 3–4. |
| **R-O06** | One active dispute per order | **HOLDS WITH AMENDMENT** | **Amendment:** one active dispute per **seller order** (the unit that owns cancellation and refund — §3.1). **REG-84 closed (2026-09-22, scope owner):** there is **no** master-level dispute. |
| **R-O07** | One review per order | **HOLDS WITH AMENDMENT** | **Amendment (REG-83 closed 2026-09-22, scope owner):** one buyer review attaches to **each seller order**. There is no master-level review. |
| **R-O08** | Return only after delivered | **HOLDS WITH AMENDMENT** | **Amendment:** return is requested against a **delivered seller order**; evidence is **dedicated returns evidence** (N25), not dispute evidence. Stock is **not** restored on return (R-L12). MVP_SCOPE §3.11, §3.6. |
| **R-O09** | Payout min EGP 100 | **HOLDS UNCHANGED** | Untouched. |
| **R-O10** | Payouts processed manually | **HOLDS UNCHANGED** | Baseline §1 unchanged: no automated payouts. |
| **R-R01** | Review only if delivered + buyer match | **HOLDS WITH AMENDMENT** | Delivered + buyer match holds. The order in that test is the **seller order** (REG-83 closed 2026-09-22). |
| **R-R02** | One review per order | **HOLDS WITH AMENDMENT** | **Amendment (REG-83 closed 2026-09-22):** one review per **seller order**, same pin as R-O07. |
| **R-R03** | Edit ≤48h | **HOLDS UNCHANGED** | Untouched. |
| **R-R04** | One immutable seller reply | **HOLDS UNCHANGED** | Untouched. |
| **R-R05** | Review goes live ~5 min | **HOLDS UNCHANGED** | Untouched. |
| **R-R06** | Hide via is_visible | **HOLDS UNCHANGED** | Untouched. |
| **R-R07** | Aggregate recompute | **HOLDS UNCHANGED** | Untouched. |
| **R-D01** | Dispute only delivered/dispatched | **HOLDS WITH AMENDMENT** | **Amendment:** eligibility is on the **seller order** that was dispatched or delivered — §3.1 independent fulfilment. |
| **R-D02** | Dispute SLA 48h | **HOLDS UNCHANGED** | Untouched. |
| **R-D03** | Resolution outcomes | **HOLDS UNCHANGED** | Untouched. |
| **R-D04** | Resolution notifies both | **HOLDS UNCHANGED** | Untouched. |
| **R-D05** | ≤5 dispute evidence | **HOLDS UNCHANGED** | Untouched. (UI Spec once grouped this with R-N05 — that grouping is a mis-cite; R-N05 remains the 47h admin alert.) |
| **R-D06** | One active dispute per order | **HOLDS WITH AMENDMENT** | Same amendment as R-O06. |
| **R-N01** | Channel prefs | **HOLDS UNCHANGED** | OD-5 holds. |
| **R-N02** | WhatsApp templates | **HOLDS UNCHANGED** | OD-5 holds; launch channel is SMS (R-N07). |
| **R-N03** | Status-change notify | **HOLDS WITH AMENDMENT** | **Amendment:** notifications follow **seller-order** and **master** events (released, dispatched, delivered, cancelled, SLA, escalation, return). Launch channel SMS (R-N07). MVP_SCOPE §3.5, §3.7, §5. |
| **R-N04** | Inquiry notify ≤5s | **HOLDS WITH AMENDMENT** | **Amendment:** the inquiry channel is **quoting** (quote received / accepted), not confirm-to-checkout. MVP_SCOPE §3.4, §7. |
| **R-N05** | Dispute SLA alert 47h | **HOLDS UNCHANGED** | Untouched. |
| **R-N06** | Sold-out restock CTA | **HOLDS UNCHANGED** | Untouched. |
| **R-M01** | Seller-approval SLA 24h | **HOLDS UNCHANGED** | Untouched. |
| **R-M02** | Moderation log immutable | **HOLDS UNCHANGED** | Untouched. |
| **R-M03** | Temp suspension auto-lifts | **HOLDS UNCHANGED** | Untouched. |
| **R-M04** | Permanent ban needs confirm | **HOLDS UNCHANGED** | Untouched. |
| **R-M05** | Flagged-content review 24h | **HOLDS UNCHANGED** | Untouched. |
| **R-M06** | Auto-flag keywords | **HOLDS UNCHANGED** | Untouched. |
| **R-B01** | One active boost per listing | **RETAINED** | v1 text stands. REG-80 closed 2026-09-22 (scope owner). Not rewritten, not expanded. |
| **R-B02** | Activates within 5 min of admin confirm | **RETAINED** | Same — v1 text stands. |
| **R-B03** | Auto-expire | **RETAINED** | Same — v1 text stands. |
| **R-B04** | Boosted ranking | **RETAINED** | Same — v1 text stands. |
| **R-B05** | Boost ROI | **RETAINED** | Same — v1 text stands. |

### 1.2 Functional requirements (FR-*)

v1 FRs were **one block per page**. That framing is superseded. Each code still gets a verdict so B4 can map surviving capabilities onto pages without silently dropping a v1 ID.

| Code | v1 (historical, page-framed) | Verdict | Cited reason + amendment text |
|---|---|---|---|
| **FR-PUB-1** | Homepage (collections, new arrivals, boosted strip) | **HOLDS WITH AMENDMENT** | Discovery holds (§5 survive 01–05). **Boosted strip = RETAINED** (v1 text stands; REG-80 closed 2026-09-22). Guest write-actions still redirect to login; guest **cannot add to cart** (N21, R-C01). |
| **FR-PUB-2** | Search & filter, boosted ranking | **HOLDS WITH AMENDMENT** | 1–2 keyword + governorate/city/price/category hold (§5, §10 G4). **R-B04 ranking = RETAINED** (v1 text stands; REG-80 closed 2026-09-22). Service-type filter is **retired** (products only, §3.10). |
| **FR-PUB-3** | Category browse; inactive → 404 | **HOLDS UNCHANGED** | Untouched. |
| **FR-PUB-4** | Listing detail; price_type; restock CTA | **HOLDS WITH AMENDMENT** | **Amendment:** listing always presents a **fixed price**, plus weight, dimensions, specs, prep days; custom items additionally present **Request price**. Guest cannot add to cart or request a price (§2, N21). Four `price_type` presentations **retired** (§7). R-L10 / R-N06 hold. |
| **FR-PUB-5** | Public storefront; suspended hidden | **HOLDS WITH AMENDMENT** | R-S07 holds. **Amendment:** buyer **never** sees seller address (§3.8). Store “delivery methods” as a purchase-mode picker is **retired** (courier-only, §3.3). |
| **FR-AUTH-1** | Phone / Google sign-in | **HOLDS UNCHANGED** | OD-4 holds. Phone-gate **location** vs add-to-cart is R-A07 / FR-AUTH-4 / REG-79 (not an amendment). |
| **FR-AUTH-2** | OTP verify | **HOLDS UNCHANGED** | Untouched. AC-AUTH-2 holds. |
| **FR-AUTH-3** | Complete buyer profile | **HOLDS WITH AMENDMENT** | **Amendment:** current Buyer T&C version is accepted **at signup** (N26, §3.12). Name + governorate remain required. |
| **FR-BUY-1** | Account / profile; deactivate | **HOLDS UNCHANGED** | OD-2 holds. |
| **FR-BUY-2** | Address book | **HOLDS UNCHANGED** | Buyer still **has** addresses; **visibility** of those addresses to counterparties is R-V01 (§3.8), not a deletion of the address book. |
| **FR-BUY-3** | Wishlist + restock | **HOLDS UNCHANGED** | Guest still cannot wishlist (§2). |
| **FR-BUY-4** | Followed sellers | **HOLDS UNCHANGED** | Guest still cannot follow (§2). |
| **FR-BUY-5** | Buyer inbox; confirmed inquiry → checkout CTA | **HOLDS WITH AMENDMENT** | **Amendment:** inbox is the **quote channel** for custom items. The **confirmed-inquiry → checkout CTA is retired** (AC-BUY-6 retired, §7). Quote accept feeds a cart line (R-Q05). |
| **FR-BUY-6** | Checkout from confirmed inquiry; flat fee; three rails; stock not here | **SUPERSEDED** | Replaced by FR-CHK-1 + FR-PAY-1 + FR-COU-1. AC-BUY-6 **RETIRED**. MVP_SCOPE §7. |
| **FR-BUY-7** | Confirmation / deposit instructions / proof | **HOLDS WITH AMENDMENT** | **Amendment:** instructions show **BETK’s InstaPay handle only** (VF/Orange buyer rails retired). **One** proof on the **master**. Awaiting-review = proof present and not yet admin-verified. Admin verification is FR-PAY-1 / R-O19. MVP_SCOPE §3.2, N22. |
| **FR-BUY-8** | Order history | **HOLDS WITH AMENDMENT** | **Amendment:** history is of **master** purchases with **per-seller-order** progress visible as independent sections (§3.1). |
| **FR-BUY-9** | Order detail / track; cancel while pending; pickup/remote no shipment | **HOLDS WITH AMENDMENT** | **Amendment:** buyer sees the master + per-seller sections, both payment states per seller order, combined delivery total, full timeline. Cancel = R-O03 amended (before proof). Pickup/remote “no shipment” empty-state is **retired** (courier-only, every seller order has a shipment — §3.1, §3.3). Review is per seller order (REG-83 closed). Dispute is per seller order only (REG-84 closed). |
| **FR-BUY-10** | Leave review | **HOLDS WITH AMENDMENT** | One review per **seller order** (REG-83 closed 2026-09-22). |
| **FR-BUY-11** | Raise dispute (also covered return/refund in v1) | **HOLDS WITH AMENDMENT** | **Amendment:** **returns are a dedicated flow** (FR-RET-1, OD-12), not a dispute-reason alias. Dispute path remains for post-delivery disagreements (§3.11 reject → dispute). |
| **FR-BUY-12** | Dispute detail | **HOLDS UNCHANGED** | Untouched. |
| **FR-BUY-13** | Notifications | **HOLDS UNCHANGED** | Event set expands via R-N03 amendment / R-N07; the surface holds. |
| **FR-SEL-1** | Onboarding 5-step incl. delivery-mode toggles | **HOLDS WITH AMENDMENT** | **Amendment:** onboarding captures **pickup address**, **up to 3 categories** (approved at onboarding), **Seller Agreement e-signature**, and the **food-docs branch** when a food category is selected (R-S10). Delivery-mode toggles `{delivery, pickup, remote}` are **retired** (§3.3, §7). |
| **FR-SEL-2** | Application status | **HOLDS UNCHANGED** | Untouched. |
| **FR-SEL-3** | Seller dashboard | **HOLDS WITH AMENDMENT** | **Amendment:** there is **no acceptance queue**. Released orders arrive already committed (§3.5, OD-8 item 4). |
| **FR-SEL-4** | Store profile; slug once | **HOLDS UNCHANGED** | Untouched. |
| **FR-SEL-5** | Delivery settings (`delivery_options` modes) | **HOLDS WITH AMENDMENT** | **Amendment:** this capability is **pickup address**, not mode selection. Pickup / remote / self-delivery configuration is **retired** (§3.3, §7). Schema fate of the old mode field is B3 (F-MODE, in-task — not a REG). |
| **FR-SEL-6** | Store return policy | **HOLDS UNCHANGED** | Preserve-where-untouched (§5). **OPEN REG-85:** relationship to the platform Return & Refund Policy (OD-13) is unpinned — not invented. |
| **FR-SEL-7** | Settlement handles | **HOLDS UNCHANGED** | Seller settlement remains InstaPay / VF / Orange (§3.2 Settlement). |
| **FR-SEL-8** | Listings management | **HOLDS UNCHANGED** | Untouched. |
| **FR-SEL-9** | Create/edit listing; service hides stock | **HOLDS WITH AMENDMENT** | **Amendment:** products only; **fixed price**; shipping attributes mandatory; specs allowed; prep days (cap 3 except custom); category in approved set; eligibility band. Service listing create/publish is **refused** (§3.10). |
| **FR-SEL-10** | Stock & inventory; 0 → sold_out | **HOLDS WITH AMENDMENT** | R-L06/R-L07/OD-1 hold. **Amendment:** decrement now happens at checkout (R-L05 amended); out-of-stock escalation zeroes tracked stock (R-L13); custom/MTO untracked (R-L15). |
| **FR-SEL-11** | Boost listing | **RETAINED** | v1 text stands. REG-80 closed 2026-09-22 (scope owner). Not rewritten, not expanded. |
| **FR-SEL-12** | Boost management | **RETAINED** | v1 text stands. REG-80 closed 2026-09-22 (scope owner). Not rewritten, not expanded. |
| **FR-SEL-13** | Seller inbox; confirm → checkout | **HOLDS WITH AMENDMENT** | **Amendment:** seller **quotes** within the band (R-Q*). Confirm-inquiry-to-enable-checkout is **retired** (§7). |
| **FR-SEL-14** | Orders management; **seller accepts** pending→confirmed | **HOLDS WITH AMENDMENT** | **Amendment:** **seller acceptance is retired** (AC-SEL-14 RETIRED). Orders arrive committed after admin deposit verification. Seller cannot cancel (R-E01). Seller sees ref + items + deadline, plus **subtotal, commission, and net only** (R-V02, **REG-90**). Never the delivery fee. Never the order total. Escalation is the only exit (FR-ESC-1). |
| **FR-SEL-15** | Seller order detail; status changes; shipments | **HOLDS WITH AMENDMENT** | **Amendment:** seller may move **preparing → ready**. Seller **never** sees buyer name, phone, address, or city (N28). Seller **never** sees the delivery fee or the order total (**REG-90**); the money on this surface is subtotal, commission, and net. Seller labels the box with the **order reference only** (R-K07). Courier collection is courier behaviour (R-K05), not a seller “I am the courier” read of the label (that v1 clause is superseded). |
| **FR-SEL-16** | Reviews management | **HOLDS WITH AMENDMENT** | Seller reviews are per **seller order** (REG-83 closed 2026-09-22). The response still must not include buyer name, phone, address, or city (R-V02). |
| **FR-SEL-17** | Earnings | **HOLDS WITH AMENDMENT** | **Amendment:** displayed balance is **derived** (R-O26) as `subtotal − commission_amount − refunded_subtotal` (**REG-90**, B4-FIX). `refunded_subtotal` is the goods portion, fee-free by definition (`BETK_ERD.md` §3.10). The seller can compute it without reading `payments`. No delivery fee. No order total. Eligibility waits for the return-hold window after delivery (R-O29). OPEN REG-86 on whether return-hold is a REG-62 launch key. Do not invent it back into REG-62. |
| **FR-SEL-18** | Transactions | **HOLDS WITH AMENDMENT** | **Amendment:** unit is the **seller order** (§3.1). Each row shows subtotal, commission, `refunded_subtotal`, and net (**REG-90**). It does not show the delivery fee, the order total, or a buyer payment leg. |
| **FR-SEL-19** | Request payout | **HOLDS UNCHANGED** | R-O09/R-O10 hold. |
| **FR-SEL-20** | Level progress | **HOLDS UNCHANGED** | Untouched. |
| **FR-SEL-21** | Seller analytics (includes boosts) | **HOLDS WITH AMENDMENT** | Non-boost analytics hold. **Boost analytics clause = RETAINED** (v1 text stands; REG-80 closed 2026-09-22). |
| **FR-SEL-22** | Seller dispute detail | **HOLDS UNCHANGED** | Untouched. |
| **FR-ADM-1** | Admin dashboard / SLA panel | **HOLDS UNCHANGED** | Untouched; SLA panel gains escalation/SLA-breach signals via FR-ADM-20 without retiring this code. |
| **FR-ADM-2** | Seller approval queue | **HOLDS WITH AMENDMENT** | **Amendment:** queue also reviews **food-verification** artefacts when the food branch applies (R-S10, §5). |
| **FR-ADM-3** | User & seller mgmt | **HOLDS UNCHANGED** | Untouched. No automatic strike on SLA breach (R-E04, R-F04). |
| **FR-ADM-4** | Listings moderation | **HOLDS UNCHANGED** | Untouched. |
| **FR-ADM-5** | Flagged content | **HOLDS UNCHANGED** | Untouched. |
| **FR-ADM-6** | Reviews moderation | **HOLDS UNCHANGED** | Untouched. |
| **FR-ADM-7** | Categories | **HOLDS UNCHANGED** | Untouched. |
| **FR-ADM-8** | Orders mgmt | **HOLDS WITH AMENDMENT** | **Amendment:** admin operates on **master + child seller orders** (§3.1). Admin (with the courier) sees addresses (R-V01). |
| **FR-ADM-9** | Disputes mgmt | **HOLDS WITH AMENDMENT** | **Amendment:** returns/disputes include return evidence (dedicated, N25). Refund may be full or partial **per seller order** (§3.11). |
| **FR-ADM-10** | Payments mgmt; verify deposit; confirm COD; **close the order** | **HOLDS WITH AMENDMENT** | **Amendment:** **one** verify action confirms **all** deposit obligations under the master and **releases** children (R-O19). Admin confirms each COD-balance obligation after courier remit (R-O20). **There is no close action** and no invented closed status (R-O25, OD-18). |
| **FR-ADM-11** | Payouts mgmt | **HOLDS UNCHANGED** | Manual; net of commission on subtotal (R-O27). |
| **FR-ADM-12** | Editorial collections | **HOLDS UNCHANGED** | Untouched. |
| **FR-ADM-13** | Notifications broadcast | **HOLDS UNCHANGED** | OD-3 holds (no campaign entity). |
| **FR-ADM-14** | WhatsApp templates merged into Settings | **HOLDS UNCHANGED** | OD-5 holds. |
| **FR-ADM-15** | Admin settings (incl. boost packages) | **HOLDS WITH AMENDMENT** | **Amendment:** configurable set is R-M07; **not** configurable is R-M08. **`boost_packages` clause = RETAINED** (v1 text stands; REG-80 closed 2026-09-22). Flat delivery-fee setting is **retired** as the buyer fee source (replaced by the rate matrix, §3.3). |
| **FR-ADM-16** | Moderation log | **HOLDS UNCHANGED** | Untouched. |
| **FR-ADM-17** | Boost approval | **RETAINED** | v1 text stands. REG-80 closed 2026-09-22 (scope owner). Not rewritten, not expanded. |

### 1.3 Acceptance criteria (AC-*)

**Spelled-out v1 ACs:**

| Code | v1 (historical) | Verdict | Cited reason |
|---|---|---|---|
| **AC-BUY-6** | Order only from confirmed inquiry; one `orders` row + items + two payments | **RETIRED** | MVP_SCOPE §7. Replaced by AC-CHK-* / AC-PAY-*. |
| **AC-SEL-14** | Seller pending→confirmed (acceptance); stock trigger; gated on admin deposit | **RETIRED** | MVP_SCOPE §7, §4.1 OD-8 item 4. Replaced by R-O19 (admin release) + FR-ESC-1. |
| **AC-ADM-9** | Dispute resolution writes resolution + log + notifies; 47h alert | **HOLDS UNCHANGED** | Dispute SLA untouched. Returns are additional (AC-RET-*), not a replacement of this AC. |
| **AC-AUTH-2** | ≤5 attempts; expired/used rejected; session created; raw OTP never persisted | **HOLDS UNCHANGED** | Untouched. |

**Implied same-ID ACs** (v1 §9 generic “page renders at its route…”): **AC-PUB-1–5, AC-AUTH-1, AC-AUTH-3, AC-BUY-1–5, AC-BUY-7–13, AC-SEL-1–13, AC-SEL-15–22, AC-ADM-1–8, AC-ADM-10–17** inherit the parent FR verdict in §1.2. None are dropped. B4 replaces the generic page-criterion with per-page scripts when pages freeze; B2 does not count those pages.

---

## 2. Actors

Cite MVP_SCOPE §2. Identity remains unified; roles remain additive (R-A04).

| Actor | Behaviour this PRD requires | Auth (product, not schema) |
|---|---|---|
| **Guest** | Browse, search, filter, view listings/storefronts, read legal documents, share a public link. **Cannot** add to cart, request a price, follow, or wishlist. | public |
| **Buyer** | Account-gated cart, quote request, checkout, master-order tracking, return request, review, dispute. Account required before first add-to-cart (N21). | protected |
| **Seller** | One store; pickup address; ≤3 categories; agreement e-signature; food branch when applicable. Sees **order ref + items + prep deadline only**. **Cannot cancel.** | role: seller |
| **Admin / Superadmin** | Seller/food approval, **one** deposit verification across a master, courier handoff, escalations, returns/disputes, payouts, performance audit, configuration, moderation. Sees addresses. | role: admin |
| **Courier** | Fulfilment **participant**. Collects from seller pickup, delivers to buyer, collects COD per shipment, remits COD to BETK. Reads the BETK-generated label. **Not** an authenticated app role (ADR-024). The handoff mechanism is not picked. | *principle closed; mechanism open — REG-78* |

---

## 3. v2 functional requirements

Each block: rules (R) → capability (FR) → MVP_SCOPE cite. Testable ACs are in §6. **No page list. No table/column/enum design.**

Seller-order **lifecycle** (product states, storage is B3): checkout → awaiting payment → (proof) → admin verifies → **confirmed = released to seller** → preparing → ready → courier collects (dispatched) → delivered → (optional) returned. Cancel paths: buyer pre-proof, window expiry, admin reject, admin via escalation. `confirmed` does **not** mean seller-accepted. Cite MVP_SCOPE §3.1 (status meaning) + baseline §4.1 as authority for the state names; B3 owns representation.

Master **aggregate** (derived, never written as a close action): awaiting payment / payment submitted / in progress / completed (all children delivered) / partially completed / cancelled (all children cancelled). Cite §3.1, §3.9.

### 3.1 Cart lifecycle — FR-CART-1

**Cite:** MVP_SCOPE §2, §3.1, §5, §8 N21.

| ID | Requirement |
|---|---|
| **R-C01** | An **account** is required before the first add-to-cart. A guest add-to-cart attempt creates **no** cart line and is sent to authentication. (N21. This is **not** the verified-phone gate — see R-A07 / REG-79.) |
| **R-C02** | The cart is persisted per authenticated buyer. |
| **R-C03** | The buyer may add a line, change quantity, remove a line, and see running subtotal, delivery, and total. |
| **R-C04** | Quantity of a **tracked-stock** line is bounded by live available stock. Custom / made-to-order (untracked) lines are not stock-bounded (R-L15). |
| **R-C05** | A line becomes **blocked** when the item sells out or a custom quote expires. Checkout is refused until blocked lines are cleared or re-quoted. |
| **R-C06** | Unit price is **snapshotted** at add time (or at quote-accept time for custom lines). A later listing or quote edit does not silently change the line. |
| **R-C07** | When the payment window expires with no proof, tracked stock is restored (R-L11) and the cart is restored. **Amended 2026-09-22 (REG-82 closed, scope owner):** fixed-price lines restore as-is (snapshotted quantity and unit price). Custom-quote lines restore only if that quote is still inside its 24h validity; otherwise the line is dropped and the buyer is prompted to request a new quote. |

**FR-CART-1** — Cart lifecycle as R-C01–R-C07. B4 maps the surface; B2 does not name a route.

**REG-79 / R-A07:** whether add-to-cart also requires a **verified phone** is **OPEN**. Do not test either direction as required.

### 3.2 Checkout shape — FR-CHK-1

**Cite:** MVP_SCOPE §3.1 (OD-9), §3.6, §3.12, §7.

| ID | Requirement |
|---|---|
| **R-O11** | Checkout consumes the buyer’s **cart**, not a seller-confirmed inquiry. (Supersedes R-O01.) |
| **R-O12** | One checkout attempt produces **one master order**, **N seller orders** (one per distinct seller in the cart), and **N shipments**, or **none** of them (no partial create). |
| **R-O13** | The **master** owns: the buyer, the delivery address, the single payment proof, the aggregate status, the buyer-facing combined delivery total, and the buyer-facing order number. |
| **R-O14** | Each **seller order** owns: its items, its own delivery fee, its commission snapshot, its prep deadline, its shipment, its two payment obligations, its escalation, its cancellation and refund. |
| **R-L05** (amended) | Tracked stock decrements as part of the successful checkout attempt, not later. |

**FR-CHK-1** — Cart checkout to master + N seller orders + N shipments, all-or-nothing, stock decrement at checkout, T&C version-gate before completion (R-G02), courier-only (no delivery-method picker).

### 3.3 Money — FR-PAY-1, FR-PAY-2, FR-ADM-18

**Cite:** MVP_SCOPE §3.2, §4.1 OD-8 amendment, §8 N22.

Custody **holds**: buyer pays BETK; admin verifies; no gateway; no automated capture; no automated payouts.

| ID | Requirement |
|---|---|
| **R-O15** | Buyer deposit rail is **InstaPay only**, to BETK’s own handle. Vodafone Cash / Orange Cash are **not** buyer deposit rails (they remain seller **settlement** handles — §3.2 Settlement). |
| **R-O16** | Deposit is **50% of (subtotal + delivery)** covering the **whole master**, paid as **one** transfer. |
| **R-O17** | Each seller order has **two** payment obligations: a deposit (InstaPay) and a balance (COD). |
| **R-O18** | **One** payment proof is captured for the master (N22). **DIRECTION (not frozen here):** each child deposit obligation may snapshot a proof reference at verification time. **B3 validates** and may override only with a stated, cited reason. |
| **R-O19** | **One** admin action confirms **every** deposit obligation under that master **and RELEASES** every child seller order to the seller already committed. Seller is not asked to accept. |
| **R-O20** | The **courier** collects the COD balance **per shipment** at that shipment’s delivery and **remits** it to BETK. Admin confirms that seller order’s balance obligation **after** remit. (Courier **authentication** is REG-78 / B3 — not specified here.) |
| **R-O21** | A payment window starts at checkout (duration admin-configurable; launch recommendation 30 minutes — baseline §9, cited via MVP_SCOPE §5). If no proof arrives before it ends, the system cancels, restores stock, restores the cart per amended R-C07 (REG-82: fixed-price lines as-is; custom-quote lines only while the quote is still valid), and notifies. |
| **R-O22** | After proof upload the buyer cannot cancel. After deposit confirmation the buyer’s exit is return / refund / dispute, never cancellation. |
| **R-O23** | Admin may cancel on proof rejected, escalation resolution, or exceptional circumstances. Proof rejection cancels, restores stock, refunds if the transfer was taken, and notifies. |
| **R-O24** | Every cancellation where a deposit was already confirmed **triggers a refund**. The refund path is **launch-blocking**, not fast-follow (cite §3.5; journeys §5.6 handoff 5). |

**FR-PAY-1** — Buyer InstaPay deposit: one transfer, one proof, one admin verification that releases.  
**FR-PAY-2** — COD balance collected by courier per shipment, remitted to BETK, admin-confirmed.  
**FR-ADM-18** — Admin actor surface of FR-PAY-1 / R-O19 / R-O20 / R-O23 (verify, reject, confirm remitted COD). No close action (R-O25).

### 3.4 Custom-item quoting — FR-QTE-1

**Cite:** MVP_SCOPE §3.4 (OD-11), §8 N23, §2.

| ID | Requirement |
|---|---|
| **R-Q01** | Inquiry is **price discovery** for custom items, feeding a cart line. It is **not** the ordering mechanism. |
| **R-Q02** | Quote band = **[listing price, 2 × listing price]**. Never below the listing price. Ceiling is admin-configurable. |
| **R-Q03** | Quote validity = **24 hours** (admin-configurable). |
| **R-Q04** | The quote carries a firm price **and** that item’s prep time. |
| **R-Q05** | On buyer accept: a cart line is created with the quoted price snapshotted and the line flagged custom. |
| **R-Q06** | On expiry: that cart line becomes blocked; it must be cleared or re-quoted before checkout (R-C05). |
| **R-Q07** | The quote is validated against the band **at send time**, so quoting cannot route around the eligibility band (R-L21). |
| **R-Q08** | A guest cannot request a price (§2). |

**FR-QTE-1** — Custom quoting as R-Q01–R-Q08.

### 3.5 Prep SLA — FR-SLA-1

**Cite:** MVP_SCOPE §3.7 (OD-16).

| ID | Requirement |
|---|---|
| **R-F01** | Seller-order deadline = the **release instant** (admin deposit verification) plus the **maximum** prep days across that seller order’s items (max, not sum — items prepare in parallel). |
| **R-F02** | Catalogue items: seller-set prep days, **capped at 3** (admin-configurable). **Custom items are exempt** — prep comes from the accepted quote (R-Q04). |
| **R-F03** | Ladder: reminder at **50%** elapsed; urgent at **80%** if not yet ready; **breach auto-creates an escalation** on that seller order. |
| **R-F04** | Breach resolution: **that** seller order is cancelled, the buyer is refunded and sent an **apology** notification, and the seller’s performance record is affected. **No automatic strike** — admin judgement (R-E04). |
| **R-F05** | On release the seller is notified with order ref, item count, and ready-by date. |

**FR-SLA-1** — Prep SLA as R-F01–R-F05. This ladder exists specifically because seller acceptance was removed (MVP_SCOPE §3.7 last paragraph).

### 3.6 Escalation — FR-ESC-1, FR-ADM-20

**Cite:** MVP_SCOPE §3.5 (OD-14), §3.6, §3.7.

| ID | Requirement |
|---|---|
| **R-E01** | The **seller can never cancel** a seller order. |
| **R-E02** | **Escalation** (seller-reported or SLA auto-breach) is the **only** seller exit. |
| **R-E03** | Seller-reported reasons include out of stock, damaged, and cannot fulfil. |
| **R-E04** | Admin resolution is one of: cancel + refund + apply the stock rule (R-L11–R-L14); reinstate with a new deadline; cancel + strike. Strike is **never automatic**. |
| **R-E05** | Escalation is recorded **against that seller order**. Representation (columns vs entity) is **B3** — not designed here. |

**FR-ESC-1** — Seller-facing: report a problem; cannot cancel.  
**FR-ADM-20** — Admin-facing: seller-reported + SLA-breach queue and R-E04 resolutions.

### 3.7 Stock lifecycle — FR-STK-1

**Cite:** MVP_SCOPE §3.6 (OD-15).

| ID | Requirement |
|---|---|
| **R-L11** | Tracked stock **restores** on any transition into cancelled from a **pre-delivery** state (buyer pre-proof, window expiry, admin reject, admin cancel via escalation except R-L13). |
| **R-L12** | Tracked stock **does not restore** on returned. Restocking is a seller decision (R-L07 remains the restock act). |
| **R-L13** | An **out-of-stock** escalation sets tracked stock to **zero** rather than restoring (restoring would re-list a phantom). |
| **R-L14** | Any **other** escalation reason restores normally (R-L11). |
| **R-L15** | Custom / made-to-order items are **untracked** and are skipped by decrement, restore, and zeroing. |

**FR-STK-1** — Stock lifecycle as amended R-L05 + R-L11–R-L15. OD-1 low-stock **derived** still holds (no alert-log entity).

### 3.8 Returns — FR-RET-1

**Cite:** MVP_SCOPE §3.11 (OD-12), §8 N25.

| ID | Requirement |
|---|---|
| **R-U01** | Buyer may request a return on a **delivered seller order** with reason + evidence. |
| **R-U02** | Returns evidence is **dedicated** and **not** the dispute-evidence collection (N25). Representation is B3. |
| **R-U03** | Seller accept → return → refund. Seller reject → dispute → admin decides. |
| **R-U04** | Refund may be full or partial **per seller order**. |
| **R-U05** | Stock is not auto-restored on return (R-L12). |

**FR-RET-1** — Returns as R-U01–R-U05. Dispute evidence rules (R-D05) are unchanged and **separate**.

### 3.9 Agreements / T&C — FR-AGR-1

**Cite:** MVP_SCOPE §3.12 (OD-13), §8 N26, §9 Legal gate.

| ID | Requirement |
|---|---|
| **R-G01** | Current Buyer Terms & Conditions are accepted **at signup**. |
| **R-G02** | A **version gate** blocks order **completion** until the buyer has accepted the current required versions. |
| **R-G03** | Acceptance records cover **buyers and sellers**. |
| **R-G04** | Seller Agreement is **e-signed at onboarding** (version, timestamp, seller identity, status; optional IP/device as in §3.12). |
| **R-G05** | Four public legal documents exist: Buyer T&C, Seller Agreement, Return & Refund Policy, Privacy Policy. Content is lawyer-authored. |
| **R-G06** | A version change requires re-acceptance. |
| **R-G07** | Engineering owns capture and the version gate, not the legal prose. |
| **R-G08** | Backfill of users who signed up before N26 is **REG-75**, not a reopening of N26. |

**FR-AGR-1** — Agreements as R-G01–R-G08. B4 maps public legal surfaces; B2 does not count them.

### 3.10 Courier delivery and rate matrix — FR-COU-1, FR-ADM-19

**Cite:** MVP_SCOPE §3.3 (OD-10), §2 FLAG / REG-78, §5, §9 Courier gate.

| ID | Requirement |
|---|---|
| **R-K01** | Fulfilment is **courier only**. Pickup, remote, and self-delivery are **retired**. Delivery-method selection at checkout is **removed**. |
| **R-K02** | Fee is computed from a **rate matrix**: origin governorate × destination governorate × weight band, **per seller order**. |
| **R-K03** | The buyer sees **one combined delivery total**. |
| **R-K04** | Each seller order **records its own fee** (refunds and courier reconciliation). The buyer does not see that split (R-O28). **Recording is not a seller-facing display (REG-90):** the seller does not see that fee or the order total. |
| **R-K05** | The courier **collects** from the seller’s pickup address and **delivers** to the buyer. |
| **R-K06** | The courier **collects the COD balance** at each delivery (same act as R-O20’s collect half). |
| **R-K07** | BETK generates the courier label (buyer name + phone + address). The seller labels the box with the **order reference only**. |
| **R-K08** | The courier **remits** collected COD to BETK. **How the courier is authenticated is not specified here (REG-78, B3).** |
| **R-K09** | Admin operates a **ready-for-pickup** queue and hands the seller order to the courier (API or manual — mechanism is the Courier gate, §9, not designed here). |

**FR-COU-1** — Rate matrix, combined total, courier collect / deliver / COD / remit as behaviour.  
**FR-ADM-19** — Ready-for-pickup queue + handoff (admin actor).

### 3.11 Address visibility — FR-VIS-1

**Cite:** MVP_SCOPE §3.8 (OD-17), §2, §8 N28.

| ID | Requirement |
|---|---|
| **R-V01** | Addresses are **never** exposed to buyer or seller. **Only admin and the courier** see them. |
| **R-V02** | Seller sees **no** buyer identity or location — not name, not phone, not address, not city. Seller sees **order ref + items + prep deadline** (N28). **Amended 2026-09-22 (REG-90 closed, scope owner):** the seller also sees **subtotal, commission, and net only**. Never the delivery fee. Never the order total. The fee is a function of origin × destination × weight, so a seller-visible fee lets the seller infer the buyer’s destination zone, which N28 forbids. Commission is on subtotal only, so the net needs neither the fee nor the total. |
| **R-V03** | Buyer never sees any seller address. |
| **R-V04** | Seller cannot see the buyer’s **other** seller orders under the same master. Cite §3.1 (independent fulfilments) + §3.8. |

**FR-VIS-1** — Address / identity visibility as R-V01–R-V04. This **supersedes** the v1 “self-delivering seller IS the courier and reads the label” clause.

### 3.12 Derived closure and derived seller balance — FR-CLO-1

**Cite:** MVP_SCOPE §3.9 (OD-18).

| ID | Requirement |
|---|---|
| **R-O25** | A seller order is **closed** when **both** payment obligations are confirmed **and** it is delivered. The master is **closed** when **every** child has reached a terminal state. There is **no close action**. There is **no invented “closed” / “settled” status**. |
| **R-O26** | Seller balance is **derived** at read time from stored order/payment facts. No persisted wallet / ledger. |
| **R-O29** | Manual payout (R-O09 / R-O10) becomes eligible only after the **return-hold window** following delivery. **OPEN REG-86:** window duration is admin-configurable (MVP_SCOPE §5 → baseline §9) but is **not** named in the narrowed REG-62 gate (MVP_SCOPE §9). Do not invent it back into REG-62. |

**FR-CLO-1** — Derived closure + derived balance as R-O25–R-O26, R-O29.

### 3.13 Commission — FR-COM-1

**Cite:** MVP_SCOPE §3.2, §4.1 OD-8 amendment item 1.

| ID | Requirement |
|---|---|
| **R-O27** | Commission is a single **flat % of SUBTOTAL only** (never delivery — courier pass-through), admin-configurable, **snapshotted per seller order at creation**. |
| **R-O28** | The **buyer never sees** commission or the per-seller delivery-fee breakdown. **Amended 2026-09-22 (REG-90):** the **seller never sees** the delivery fee or the order total either. The seller sees subtotal, commission, and net. |

**FR-COM-1** — Commission as R-O27–R-O28.

### 3.14 Catalogue — FR-CAT-1

**Cite:** MVP_SCOPE §3.10 (OD-19), §1 catalogue constraint.

| ID | Requirement |
|---|---|
| **R-L16** | Marketplace listings in this MVP are **physical products only**. Service listings are blocked at the app layer. |
| **R-L17** | Every listing carries a **fixed price**. No null-price, ranged, starting-from, or per-hour offering. |
| **R-L18** | **Shipping attributes are mandatory to publish:** weight, and length / width / height. |
| **R-L19** | A specs block (free-form key/value) is allowed for buyer-facing detail. |
| **R-L20** | Seller categories: up to **3** (admin-configurable), approved at onboarding. A listing outside that set cannot be created, edited into, or published. |
| **R-L21** | Marketplace **price eligibility band** (admin min/max). A listing outside the band cannot publish. |
| **R-L22** | Catalogue prep days per listing, capped at **3** (admin-configurable); custom prep comes from the quote (R-F02). |
| **R-S10** | If a **food** category is selected at onboarding, food-verification artefacts (packaging, label, expiry photos) plus a social-presence URL (admin-only) are required before approval. Publishing food without food approval is refused. Cite §5. |

**FR-CAT-1** — Catalogue constraints as R-L16–R-L22.  
Food branch is also an amendment of FR-SEL-1 / FR-ADM-2.

### 3.15 Verified-phone gate — FR-AUTH-4  **OPEN (REG-79)**

**Cite:** MVP_SCOPE §4.1 OD-4 FLAG, §8 N21. **Do not re-open N21. Do not pick a gate location.**

| ID | Requirement |
|---|---|
| **R-A07** | **Verified phone is required before transacting** (OD-4 HOLDS). The gate **surface** is `/auth/phone` and `/auth/verify` (P78, P07). Named holds that **HOLD:** **checkout**, **become-seller**, **payout**. **N21** pins **account** before first add-to-cart, **not** verified phone. Whether add-to-cart is a “transaction” that requires verified phone is **OPEN — REG-79**. An implementation that gates verified phone at add-to-cart, and one that leaves that gate at checkout, are **both currently legal** under this PRD. **This file does not choose the trigger.** Become-seller and payout are **not** relocated. |

**FR-AUTH-4** — Records R-A07 as an OPEN requirement. AC-AUTH-4 is the testable split (named surfaces HOLD; add-to-cart phone-gate is not asserted).

### 3.16 Notifications (launch channel)

**Cite:** MVP_SCOPE §5 (in-scope), §4.1 OD-5 holds.

| ID | Requirement |
|---|---|
| **R-N07** | Launch notification channel is **SMS**. WhatsApp and email follow. WhatsApp remains a BETK→user template surface (OD-5), never a conversation. |
| **R-N08** | SLA 50% / 80% reminders go to the **seller**. Breach notifies **buyer, seller, and admin**. Cancellation with apology notifies the buyer (R-F04, R-O21, R-O23). |

Event catalogue in baseline §7 is in-scope as BETK→user notifications. B4 maps copy; B2 does not invent a campaign entity (OD-3).

### 3.17 Admin configuration — amendment of FR-ADM-15

**Cite:** MVP_SCOPE §5.

| ID | Requirement |
|---|---|
| **R-M07** | Configurable: price eligibility band, commission %, custom-quote tolerance (default 2×), quote validity (24h), payment window, prep cap (3 days), seller category limit (3), courier rate matrix, return window, food requirements, low-stock threshold default. |
| **R-M08** | **Not** configurable: order statuses, whether sellers may cancel, whether buyers may cancel after payment. |

### 3.18 Seller performance audit — FR-ADM-21

**Cite:** MVP_SCOPE §5 (performance audit; stock-accuracy leading).

**FR-ADM-21** — Admin can audit seller performance. **Stock accuracy leads** (escalation rate, out-of-stock escalations, recency of stock touch). Fulfilment, quote responsiveness, quality, compliance (including agreement version), and activity signals follow. SLA breach feeds the record; it does **not** auto-issue a strike (R-F04, R-E04).

### 3.19 Boosts — RETAINED (REG-80 closed)

**Cite:** MVP_SCOPE §10 G6. REG-80 closed 2026-09-22 by the scope owner.

v1 **R-B01–R-B05**, **R-L08**, **FR-SEL-11**, **FR-SEL-12**, **FR-ADM-17**, and the boost clauses of **FR-PUB-1**, **FR-PUB-2**, **FR-SEL-21**, **FR-ADM-15** are **RETAINED**. The v1 text stands. They are not rewritten and not expanded. **No new boost R/FR/AC is minted.** B4 maps these retained capabilities onto pages and must not add boost requirements. Any boost schema question is B3’s and is flagged at that time (REG-78-class cite-or-flag), not written here as a requirement.

---

## 4. Non-functional requirements

**HOLDS UNCHANGED** from v1 except where a count freeze appeared:

- **Performance:** homepage/storefront p95 < 2.5s on Egyptian mobile networks; cache homepage (60s TTL) and rating aggregates (5-min TTL); PgBouncer from day 1.
- **Localization:** Arabic-first RTL; bilingual AR/EN + light/dark (OD-7 HOLDS); LTR islands for digits/refs; `unaccent` search.
- **Availability:** Supabase managed Postgres; Vercel; graceful section-level degradation.
- **Scale assumptions:** v1 figures (< 50K listings, < 100K orders/month) remain planning assumptions, **not** a frozen table/page inventory.
- **Accessibility:** WCAG AA targets; keyboard + screen-reader; focus ring on `--ring`.
- **Observability:** Sentry; PostHog on key funnels.

v1 sentence “bounded exactly by the 59 pages … and the 43-table schema” is **SUPERSEDED**. Tables are frozen at 51 (OD-20). Pages are frozen at 79 (OD-21). The v1 59 was a heading count.

---

## 5. Security requirements

Phone-OTP **and Google OAuth** (R-A01, OD-4 HOLDS); phone nullable+UNIQUE; **verified phone required before transacting** with **gate location OPEN under N21 (R-A07, REG-79)**; hashed OTP and session tokens; private storage for identity documents with short-lived signed URLs; **RLS is the authorization boundary** (design is B3 — this PRD states the behaviours RLS must eventually express, including R-V01 and REG-78); Zod validation on **every** Server Action and API route; append-only moderation and status-history; admin actions logged.

The five pre-launch security conditions in C3 §8.5 remain mandatory gates.

Courier address visibility (R-V01, R-K07) must be enforceable without inventing a courier login in this document (REG-78).

---

## 6. Acceptance criteria (testable)

Each AC is **observable behaviour**. None restates its FR in different words. None requires a particular table, column, enum member, policy, or page.

### 6.1 Cart — AC-CART-1–7  (FR-CART-1)

| ID | Criterion |
|---|---|
| **AC-CART-1** | Given a guest, when they attempt to add a listing to a cart, **no cart line exists afterwards** and they are sent to authentication. |
| **AC-CART-2** | Given an authenticated buyer and live tracked stock S, when they add qty S+1, the add is **refused** and the cart is unchanged. When they add qty ≤ S, the line exists at that qty. |
| **AC-CART-3** | Given a cart line snapshotted at price P, when the listing’s price later changes to P′, the cart line still shows **P** until the buyer removes it. |
| **AC-CART-4** | Given a custom quote that expires, the corresponding cart line is **blocked**. Checkout while it remains is **refused** and identifies that line. Clearing or a fresh in-band quote unblocks. |
| **AC-CART-5** | Given a tracked-stock line whose listing reaches zero availability, the line becomes **blocked** and checkout is refused until it is cleared. |
| **AC-CART-6** | Changing qty (within stock) or removing a line **changes** the running subtotal (and the displayed delivery/total once those are computed). |
| **AC-CART-7** | Given checkout then payment-window expiry with no proof: tracked stock is restored and the cart is restored per R-C07 (**REG-82 closed 2026-09-22**). A fixed-price line reappears with its snapshotted price and quantity. A custom-quote line reappears only while that quote is still inside its 24h validity; otherwise it is absent and the buyer is prompted to request a new quote. |

### 6.2 Checkout — AC-CHK-1–6  (FR-CHK-1)

| ID | Criterion |
|---|---|
| **AC-CHK-1** | Given a cart with items from **N** distinct sellers and no blocked lines, a successful checkout produces **one** master, **N** seller orders, and **N** shipments. A failed checkout produces **zero** of those. |
| **AC-CHK-2** | Given two buyers who together would exceed live tracked stock, **at most one** checkout succeeds; the other is refused; resulting availability never goes negative. |
| **AC-CHK-3** | Checkout with any blocked line is refused (AC-CART-4/5). |
| **AC-CHK-4** | Given a buyer who has not accepted the **current** required agreement versions, checkout **does not complete** (R-G02). After acceptance, the same cart can complete (other gates equal). |
| **AC-CHK-5** | Checkout offers **no** pickup / remote / self-delivery choice. The only fulfilment is courier. |
| **AC-CHK-6** | The buyer is shown **one** delivery total equal to the sum of the per-seller-order fees, and is **not** shown the per-seller split or any commission figure. |

### 6.3 Money — AC-PAY-1–8  (FR-PAY-1, FR-PAY-2, FR-ADM-18)

| ID | Criterion |
|---|---|
| **AC-PAY-1** | Deposit instructions display **BETK’s InstaPay handle** and do **not** display Vodafone Cash / Orange Cash as buyer deposit rails, and do **not** display the seller’s settlement handles. |
| **AC-PAY-2** | The deposit amount shown equals **50% of (subtotal + combined delivery)** for that master. |
| **AC-PAY-3** | The buyer can supply **one** proof for the master. Admin verification is **one** action, not N per seller order. |
| **AC-PAY-4** | After that one admin confirm: **every** child deposit obligation is confirmed **and every** child seller order is released to the seller (confirmed = with the seller). The seller is **not** prompted to accept. A seller attempt to “decline” or “cancel” is refused (AC-ESC-1). |
| **AC-PAY-5** | Admin **reject** of the proof: all children cancelled, tracked stock restored (unless R-L13 applies, which it does not on reject), refund if the transfer was taken, buyer notified. |
| **AC-PAY-6** | Before proof upload, the buyer **can** cancel. After proof upload, buyer cancel is **refused**. After release, buyer cancel is **refused** (return path is AC-RET-*). |
| **AC-PAY-7** | On delivery of a shipment, the courier is expected to have **collected that shipment’s COD balance**. The corresponding balance obligation stays **unconfirmed** until admin records the remit. |
| **AC-PAY-8** | Admin cannot treat a seller order as **closed** (derived) until it is delivered **and** both of its payment obligations are confirmed. There is **no** control whose only job is “close order”. |

### 6.4 Quoting — AC-QTE-1–6  (FR-QTE-1)

| ID | Criterion |
|---|---|
| **AC-QTE-1** | A guest “request price” attempt creates **no** quote thread and is sent to authentication. |
| **AC-QTE-2** | A seller quote **below** the listing price is **refused**. A quote **above 2×** (or the configured ceiling) is **refused**. A quote on the closed interval succeeds. |
| **AC-QTE-3** | A quote that omits prep time is **refused**. |
| **AC-QTE-4** | After buyer accept, a cart line exists at the quoted price, flagged custom. The listing’s current price changing does not change that line (AC-CART-3). |
| **AC-QTE-5** | After validity elapses without accept, accept is **refused**. If a line was already in the cart, it is blocked (AC-CART-4). |
| **AC-QTE-6** | Completing a **fixed-price** (non-custom) purchase does **not** require a prior inquiry. A custom item **cannot** enter the cart at an unquoted price. |

### 6.5 Prep SLA — AC-SLA-1–5  (FR-SLA-1)

| ID | Criterion |
|---|---|
| **AC-SLA-1** | Given items with prep days {1, 3} on one seller order, the ready-by instant is release + **3 days**, not +4. |
| **AC-SLA-2** | A custom line’s prep is the **quoted** prep, even if that exceeds the catalogue cap of 3. |
| **AC-SLA-3** | At 50% elapsed, the seller has received a reminder. At 80% elapsed and not ready, the seller has received an urgent reminder. |
| **AC-SLA-4** | At breach with the seller order still not ready, an escalation exists **without** a seller “report” act, and the buyer and admin have been notified. |
| **AC-SLA-5** | Resolving a breach by cancel **does not** create a seller strike unless an admin separately issues one. |

### 6.6 Escalation — AC-ESC-1–5  (FR-ESC-1, FR-ADM-20)

| ID | Criterion |
|---|---|
| **AC-ESC-1** | Any seller cancel attempt on a released (or later non-terminal) seller order is **refused**. |
| **AC-ESC-2** | A seller “report a problem” act creates an escalation admin can see, for that seller order only. |
| **AC-ESC-3** | Admin cancel-via-escalation cancels **that** seller order, not automatically the whole master (siblings continue). |
| **AC-ESC-4** | Admin reinstate assigns a **new** deadline and the SLA ladder runs from the new deadline. |
| **AC-ESC-5** | Out-of-stock resolution zeroes tracked stock for that listing (AC-STK-3). A non-OOS resolution restores stock (AC-STK-1). |

### 6.7 Stock — AC-STK-1–5  (FR-STK-1)

| ID | Criterion |
|---|---|
| **AC-STK-1** | After a successful checkout of qty Q of tracked listing L, L’s availability is reduced by Q. After a pre-delivery cancel of that seller order, availability is increased by Q. |
| **AC-STK-2** | After a **return** of a delivered seller order, availability is **unchanged** by the return itself. A later seller restock (R-L07) may increase it. |
| **AC-STK-3** | After an **out-of-stock** escalation is resolved against listing L, L’s tracked availability is **0** (and it presents as sold out), not the pre-checkout quantity. |
| **AC-STK-4** | Checkout of a custom / MTO line does **not** change any listing’s tracked availability. |
| **AC-STK-5** | Low stock is **shown as derived** from live availability vs threshold. No separate alert-log write is required (OD-1). |

### 6.8 Returns — AC-RET-1–5  (FR-RET-1)

| ID | Criterion |
|---|---|
| **AC-RET-1** | A return request on a seller order that is **not** delivered is refused. |
| **AC-RET-2** | A return request without evidence is refused. Evidence stored on a **dispute** artefact is **not** accepted as returns evidence (N25). |
| **AC-RET-3** | Seller accept → the seller order is on the return path and a refund can be issued. Seller reject → a dispute exists for admin decision. |
| **AC-RET-4** | Admin can refund **less than 100%** of that seller order without changing sibling seller orders. |
| **AC-RET-5** | Completing a return does **not** increase tracked stock (AC-STK-2). |

### 6.9 Agreements — AC-AGR-1–5  (FR-AGR-1)

| ID | Criterion |
|---|---|
| **AC-AGR-1** | Signup without accepting the current Buyer T&C does **not** create a usable buyer account. |
| **AC-AGR-2** | After a T&C version change, a buyer who accepted only the previous version **cannot complete** checkout until they re-accept (AC-CHK-4). |
| **AC-AGR-3** | Seller onboarding cannot be submitted without an e-signed current Seller Agreement. |
| **AC-AGR-4** | The four legal documents in R-G05 are readable **without** an account (guest can read them — §2). |
| **AC-AGR-5** | A seller acceptance record is **not** a substitute for a buyer acceptance record, and vice versa (R-G03). |

### 6.10 Courier / delivery — AC-COU-1–6  (FR-COU-1, FR-ADM-19)

| ID | Criterion |
|---|---|
| **AC-COU-1** | Two seller orders with different origin×destination×weight bands produce **different** stored fees when the matrix says so; the buyer still sees **one** sum (AC-CHK-6). |
| **AC-COU-2** | Changing only the destination governorate **recomputes** the combined total before checkout completes. |
| **AC-COU-3** | After a seller marks **ready**, the seller order appears on the admin ready-for-pickup queue. |
| **AC-COU-4** | After handoff, the courier **can** collect from the pickup address (observable: dispatched). A seller **cannot** mark dispatched as a substitute for collection. |
| **AC-COU-5** | After delivery, COD for **that** shipment is the outstanding balance; a sibling undelivered shipment still has its own outstanding COD. |
| **AC-COU-6** | These ACs pass **without** specifying a courier login. A test that requires a courier user role is **out of this PRD** (REG-78). |

### 6.11 Visibility — AC-VIS-1–4  (FR-VIS-1)

| ID | Criterion |
|---|---|
| **AC-VIS-1** | Given a seller viewing their seller order, the response **does not include** buyer name, phone, address, or city, **and does not include** the delivery fee or the order total (**REG-90**). It **does** include order ref, items/qty, prep deadline, subtotal, commission, `refunded_subtotal`, and net. |
| **AC-VIS-2** | Given a buyer viewing the master, the response **does not include** any seller pickup or store street address. |
| **AC-VIS-3** | Given an admin (or the courier participant) viewing the same order, buyer delivery address **is** available, and seller pickup address **is** available. |
| **AC-VIS-4** | Given seller A on a two-seller master, seller A **cannot** read seller B’s seller order. |

### 6.12 Closure / balance — AC-CLO-1–3  (FR-CLO-1)

| ID | Criterion |
|---|---|
| **AC-CLO-1** | A delivered seller order with an unconfirmed COD-balance obligation still **does not** count as closed. Confirming that obligation (after remit) makes that seller order closed **without** an extra “close” act. |
| **AC-CLO-2** | A master with one child delivered and one child cancelled presents as **partially completed**, not completed and not fully cancelled. |
| **AC-CLO-3** | Seller earnings equal **sum over eligible seller orders of (subtotal − snapshotted commission − `refunded_subtotal`)** and change when a refund posts, **without** a wallet credit row being written as the source of truth. **Amended B4-FIX (REG-90):** `refunded_subtotal` is the goods portion of the refund, fee-free in the database (`BETK_ERD.md` §3.10). The seller reads that column. The seller does not read the delivery fee, the order total, or `payments.refunded_amount`. |

### 6.13 Commission — AC-COM-1–3  (FR-COM-1)

| ID | Criterion |
|---|---|
| **AC-COM-1** | Given subtotal 1000 and delivery 50 and rate 10%, snapshotted commission is **100**, not 105. |
| **AC-COM-2** | After checkout, changing the platform rate does **not** change that seller order’s snapshotted commission. |
| **AC-COM-3** | Buyer-facing totals **never** include a commission line (AC-CHK-6). |

### 6.14 Catalogue — AC-CAT-1–6  (FR-CAT-1)

| ID | Criterion |
|---|---|
| **AC-CAT-1** | Publishing a service listing is **refused**. |
| **AC-CAT-2** | Publishing without weight or without length/width/height is **refused**. Publishing with all four present (and other gates) can succeed. |
| **AC-CAT-3** | Publishing a price outside the eligibility band is **refused**. |
| **AC-CAT-4** | Creating or publishing a listing in a category the seller was **not** approved for is **refused**. |
| **AC-CAT-5** | Setting catalogue prep days to 4 (when cap is 3) is **refused**. A custom quote may still carry prep > 3 (AC-SLA-2). |
| **AC-CAT-6** | A listing without a fixed price cannot publish. |

### 6.15 Verified phone — AC-AUTH-4  (FR-AUTH-4)  **OPEN split**

| ID | Criterion |
|---|---|
| **AC-AUTH-4** | Given a signed-in user with **no** verified phone: **become-seller** is refused until phone is verified; **payout** is refused until phone is verified; **checkout** is refused until phone is verified. **Add-to-cart is not asserted either way** (REG-79 OPEN). A suite that fails an implementation solely for gating phone at add-to-cart, or solely for not gating it there, **does not** test this AC. |

### 6.16 Admin extras — AC-ADM-18–21

| ID | Criterion |
|---|---|
| **AC-ADM-18** | One admin confirm on a 3-seller master confirms **three** deposit obligations and releases **three** seller orders (AC-PAY-4). A second confirm is not required per child. |
| **AC-ADM-19** | A seller order not yet marked ready does **not** appear as ready-for-pickup. After ready, it does (AC-COU-3). |
| **AC-ADM-20** | Admin can complete R-E04 on an SLA-breach escalation without the seller having reported (AC-SLA-4 + AC-ESC-3). |
| **AC-ADM-21** | The performance audit surfaces **stock-accuracy** signals (including out-of-stock escalation count / recency of stock touch) without requiring a strike to have been issued. |

---

## 7. Cross-check

### 7.1 OD → requirement (every OD-9..OD-19 and every OD-8 amendment)

| Authority item | ≥1 requirement | Notes |
|---|---|---|
| **OD-8 am.1** Per-seller-order commission snapshot on **subtotal only** | R-O27, FR-COM-1, AC-COM-1 | |
| **OD-8 am.2** InstaPay-ONLY buyer deposit rail | R-O15, FR-PAY-1, AC-PAY-1 | Seller settlement VF/Orange **held** (FR-SEL-7) |
| **OD-8 am.3** ONE admin verification across all deposit rows | R-O19, FR-ADM-18, AC-PAY-3, AC-ADM-18 | |
| **OD-8 am.4** No seller acceptance; admin release | R-O19, AC-SEL-14 **RETIRED**, AC-PAY-4, R-E01 | |
| **OD-8 am.5** Courier-collected COD per shipment | R-O20, R-K06, FR-PAY-2, AC-PAY-7 | |
| **OD-8 restated** 2 payment obligations per seller order | R-O17 | |
| **OD-8 restated** Deposit 50% of (subtotal+delivery); one transfer covering the master | R-O16, AC-PAY-2 | |
| **OD-9** One cart → one master → N seller orders → N shipments | R-C*, R-O11–R-O14, FR-CHK-1, AC-CHK-1 | |
| **OD-10** Courier-only + rate matrix; combined total; per-seller fee | R-K01–R-K04, FR-COU-1, AC-COU-1 | |
| **OD-11** Custom quoting → cart line (N23 band, 24h, prep) | R-Q01–R-Q07, FR-QTE-1, AC-QTE-* | |
| **OD-12** Returns + dedicated evidence (N25) | R-U01–R-U02, FR-RET-1, AC-RET-2 | |
| **OD-13** T&C at signup + version-gate; buyers included (N26) | R-G01–R-G03, FR-AGR-1, AC-AGR-1–2 | |
| **OD-14** Escalation only seller exit; seller never cancels | R-E01–R-E02, FR-ESC-1, AC-ESC-1 | |
| **OD-15** Stock: decrement at checkout; restore cancel; not on return; ZERO on OOS escalation | R-L05 am., R-L11–R-L13, FR-STK-1, AC-STK-* | |
| **OD-16** Prep SLA: release + MAX(prep); 50/80; breach auto-escalates | R-F01–R-F04, FR-SLA-1, AC-SLA-* | |
| **OD-17** Addresses admin+courier only; seller no identity/location (N28) | R-V01–R-V03, FR-VIS-1, AC-VIS-* | |
| **OD-18** Derived closure + derived seller balance; no close action | R-O25–R-O26, FR-CLO-1, AC-CLO-*, AC-PAY-8 | |
| **OD-19** Products only; fixed price; shipping attrs; ≤3 categories; eligibility band | R-L16–R-L21, FR-CAT-1, AC-CAT-* | |

**No gap** on this direction.

### 7.2 New requirement → MVP_SCOPE section

Every newly minted R / FR in §3 cites a section in the tables above. Compact:

| New IDs | MVP_SCOPE |
|---|---|
| R-C01–R-C07, FR-CART-1 | §2, §3.1, §5, §8 N21 |
| R-O11–R-O14, FR-CHK-1 | §3.1, §7 |
| R-O15–R-O24, FR-PAY-1–2, FR-ADM-18 | §3.2, §3.5, §4.1, §8 N22 |
| R-Q01–R-Q08, FR-QTE-1 | §2, §3.4, §8 N23 |
| R-F01–R-F05, FR-SLA-1 | §3.7 |
| R-E01–R-E05, FR-ESC-1, FR-ADM-20 | §3.5, §3.6, §3.7 |
| R-L11–R-L22, FR-STK-1, FR-CAT-1 | §3.6, §3.10 |
| R-U01–R-U05, FR-RET-1 | §3.11, §8 N25 |
| R-G01–R-G08, FR-AGR-1 | §3.12, §8 N26, §9 |
| R-K01–R-K09, FR-COU-1, FR-ADM-19 | §2, §3.3, §5, §9 |
| R-V01–R-V04, FR-VIS-1 | §2, §3.1, §3.8, §8 N28 |
| R-O25–R-O29, FR-CLO-1, FR-COM-1 | §3.2, §3.9, §4.1, §5, §9 |
| R-A07, FR-AUTH-4 | §4.1 OD-4 FLAG, §8 N21 |
| R-N07–R-N08 | §5, §4.1 OD-5 |
| R-M07–R-M08 | §5 |
| R-S10 | §5 |
| FR-ADM-21 | §5 |

**No silent fill.** Flags that are **not** gaps in this table are listed in §8 (they are unpinned facts, not missing OD coverage).

---

## 8. STOP-and-flags

| ID | Item | Why it is not invented | Owner |
|---|---|---|---|
| **REG-79** | Verified-phone gate trigger | **OPEN.** The gate **surface** is `/auth/phone` and `/auth/verify`. The **trigger point** (add-to-cart vs checkout) is not decided. R-A07 / FR-AUTH-4 / AC-AUTH-4. | Product pin |
| **REG-78** | Courier authenticated principal | **Principle CLOSED** (ADR-024): no courier login, no RLS principal, no definer. **Mechanism OPEN** under the courier gate: admin-initiated handoff is the admin’s own RLS read; automated handoff, if the gate picks it, is a service-role read. Neither branch was picked. AC-COU-6 holds. | Principle closed — mechanism open |
| **REG-80** | Boosts in for v2 MVP | **CLOSED** 2026-09-22 (scope owner). v1 boost text **RETAINED**. No new boost requirements. Schema questions are B3, REG-78-class, not new FRs. | Closed — B4 maps retained v1 boost capabilities |
| **F-MODE** | `delivery_preference` schema tension | Courier-only is the behaviour (R-K01). **B3 resolved:** enum and `delivery_method` kept; `pickup` / `remote` dead; existing order values not rewritten (`BETK_ERD.md` §3.5). | Closed in the ERD |
| **F-N22** | Child deposit snapshot of the proof reference | **B3 validated** the direction. Canonical proof on the master; each child deposit row snapshots the reference at verification (`BETK_ERD.md` §3.2). | Closed in the ERD — ADR candidate (amends ADR-019’s buyer-writes-deposit-proof sentence) |
| **REG-81** | Child seller-order identifier format (was F-REF) | Master owns the buyer-facing number (R-O02 amended). Child shape unpinned. Journeys example is not a pin. | Product pin — B3 must not invent |
| **REG-82** | Cart restore on payment-window expiry (was F-CART) | **CLOSED** 2026-09-22 (scope owner). Cart restores. Fixed-price lines as-is. Custom-quote lines only while the quote is still valid; otherwise dropped with a request-a-new-quote prompt. R-C07 and AC-CART-7 amended. | Closed — schema path in `BETK_ERD.md` §3.3 |
| **REG-83** | Review unit under a multi-seller master (was F-REV) | **CLOSED** 2026-09-22 (scope owner). One buyer review per **seller order**. No master review. R-O07 / R-R01 / R-R02 amended. | Closed — B4 maps pages against this unit |
| **REG-84** | Whether a master-level dispute is wanted (was F-DSP) | **CLOSED** 2026-09-22 (scope owner). **No** master-level dispute. R-O06 holds at the seller order only. | Closed |
| **REG-85** | Store-level return policy vs platform Return Policy (was F-POL) | FR-SEL-6 HOLDS. Relationship unpinned. | Product / **B4** |
| **REG-86** | `return_hold_hours` vs narrowed REG-62 (was F-HOLD) | R-O29 states the behaviour. Launch-gate membership unpinned (MVP_SCOPE §9). Do not invent it back into REG-62. | Product / launch gate |
| **REG-87** | Master execution prompt still says 59 pages / one FR per page (was F-PROMPT) | Out of B2’s rewrite set. Stale. **B4** froze pages under OD-21. **B4-FIX2** corrected that count in place to **79**. The prompt was not edited. Do not treat that prompt as the v2 inventory. | Later docs sweep |
| **REG-90** | Seller order money visibility | **CLOSED** 2026-09-22 (scope owner). **B4-FIX:** `refunded_subtotal`, `revenue_egp`, and the payout cap are fee-free by definition in `BETK_ERD.md` §3.10 and §6.4. **B5 ADR-020:** no `authenticated` SELECT of `delivery_fee` or `total_amount`. Guard is REG-92. | Closed — grant is ADR-020 |
| **REG-91** | Buyer-safe combined delivery total | **CLOSED** 2026-09-22 (ADR-023). Origin is public `stores.governorate`. INVOKER checkout cannot read `store_pickup_addresses`. Pickup street never participates. Pickup governorate equals the store governorate (trigger). Not a new table and not a new column. | Closed — ADR-023 |
| **REG-73** | Buyer cancel vs already-confirmed deposit | **CLOSED.** R-O03 quotes journeys §5.2, which covers the deposit-confirmed case. | Closed — orders rebuild implements R-O03 |

N24 remains unused in the signed set (MVP_SCOPE §8). Not invented.

---

## 9. Historical v1 PRD (superseded in place — not deleted)

The 2026-06-13 / OD-7 / OD-8 page-framed PRD follows. Operative v2 text is §0–§8. Individual code fates are §1.

<details>
<summary>v1 BETK_PRD.md (source rewritten by B2, 2026-09-19) — historical</summary>

Step 2 of the BETK Dev OS. Functional requirements are derived **one block per wireframed page** in `BETK_UI_SPEC.md`; each maps to an acceptance criterion. Business rules are quoted by ID from the C1 Business Rules catalog (R-Axx … R-Bxx). Reads with `BETK_MVP_SCOPE.md` (frozen) and `BETK_ERD.md` (data contract).

**§1 Executive summary (v1).** BETK is an Arabic-first RTL marketplace for Egypt's informal creative economy — bilingual Arabic/English with light/dark theming (OD-7), Arabic-first by default. Sellers get free verified storefronts; buyers get neighborhood discovery, local split-payment, and structured buyer protection. Monetization is via listing boosts **and a platform commission on custodial orders (OD-8 — buyer pays BETK, which settles to the seller net of commission)**. The product is a responsive Next.js 15 web app on Supabase (Postgres + Auth + Storage), deployed on Vercel. This PRD defines what to build for MVP — bounded exactly by the 59 pages of the UI Spec and the 43-table schema. **SUPERSEDED:** the 59-page / 43-table freeze; split-payment rails and order shape as rewritten in §3. **Boosts RETAINED** (REG-80 closed 2026-09-22; v1 text stands).

**§2 Problem statement (v1).** 50.7M Egyptian social users sell informally over WhatsApp/Instagram with no trust layer, no structured payments, no discovery, and no buyer protection. No single platform serves products *and* services in one Arabic-first marketplace (bilingual AR/EN + light/dark, OD-7). Buyers cannot verify sellers, track orders, or recover from bad transactions; sellers cannot build durable storefronts or reputation. **SUPERSEDED in part:** services postponed (OD-19); the problem sentence is otherwise historical colour, not a requirements freeze.

**§3 Solution (v1).** A verified-storefront marketplace: phone-OTP identity, admin-gated seller verification (national ID), Arabic-first listings (products and services; bilingual AR/EN + light/dark, OD-7), 1–2 keyword full-text search with governorate/city filters, structured inquiries that convert to orders, a 50/50 split-payment model (deposit upfront + COD) that is **custodial — the buyer pays BETK, which settles to the seller net of a platform commission (OD-8/ADR-016)**, courier integration (Bosta) plus self-deliver/pickup/remote, reviews and seller levels for trust, admin-mediated disputes with a 48h SLA, and boosts for monetization. **SUPERSEDED:** inquiry-to-order; Bosta/self-deliver/pickup/remote; services as live listings; three buyer rails. **HELD:** custodial split, reviews, levels, disputes, bilingual+theme, search, and boosts (**RETAINED** — REG-80 closed 2026-09-22; v1 text stands).

**§4 Actors (v1).** As defined in `BETK_MVP_SCOPE.md §2`: Guest (public), Buyer (protected), Seller (role: seller, status-gated), Admin/Superadmin (role: admin). Identity is unified in `users`; `buyer_profiles`/`seller_profiles` extend 1:1. Roles are additive over time (R-A04). **SUPERSEDED in part:** guest “cannot inquire” is extended (guest cannot request a price / add to cart). Courier is a fulfilment participant, not a fifth authenticated role (REG-78).

**§5 Functional requirements (v1 — one block per page).** Format: **FR-[area]-[n]** → page (UI Spec §3) · auth gate · primary tables · key rules. Acceptance criterion is in v1 §9 with the same ID.

*Public / Guest*

- **FR-PUB-1 Homepage** — `/` · public · `collections`/`collection_listings`/`listings`/`listing_images`/`rating_aggregates`/`categories`/`boosts` · live collections by `homepage_position`; new arrivals; boosted strip; guest write-actions redirect to login.
- **FR-PUB-2 Search & Filter** — `/search` · public · `listings.search_vector` (tsvector/GIN/unaccent), `categories`, `stores` · 1–2 keyword search; filters category/type/governorate/city/price; boosted ranking (R-B04).
- **FR-PUB-3 Category Browse** — `/category/[slug]` · public · `categories` (self-ref), `listings` · inactive category → 404.
- **FR-PUB-4 Listing Detail** — `/listing/[id]` · public · `listings`,`listing_images`,`listing_tags`,`stores`,`seller_profiles`,`rating_aggregates`,`reviews`,`review_photos`,`wishlists`,`restock_alerts` · `view_count` increment; price_type handling (R-L09); sold_out → restock CTA (R-N06); removed → 404 (R-L10).
- **FR-PUB-5 Public Storefront** — `/store/[slug]` · public · `stores`,`seller_profiles`,`rating_aggregates`,`listings`,`reviews`,`store_follows` · suspended store hidden (R-S07).

*Auth*

- **FR-AUTH-1 Phone Entry / Sign-in** — `/auth/login` · public · `otp_tokens`,`users` · OTP **or Google OAuth** (OD-4); no passwords (R-A01 amended); 60s OTP expiry, one active per phone (R-A02); phone unique but **nullable** (R-A03 amended); `auth_provider` records origin; suspended/deactivated blocked (R-A05). **Verified phone required before transacting** (checkout/become-seller/payout) — Google-only users are prompted for phone+OTP at that point.
- **FR-AUTH-2 OTP Verify** — `/auth/verify` · public · `otp_tokens`,`sessions`,`users` · hash compare; ≤5 attempts; on success create session (30d mobile/24h web), set `last_login_at`; role routing.
- **FR-AUTH-3 Complete Buyer Profile** — `/auth/register` · protected · `buyer_profiles`,`categories` · full_name + governorate required.

*Buyer*

- **FR-BUY-1 Account/Profile** — `/account` · protected · `buyer_profiles`,`users` · phone read-only (R-A06); deactivate per OD-2.
- **FR-BUY-2 Address Book** — `/account/addresses` · protected · `addresses` · max one `is_default` per buyer.
- **FR-BUY-3 Wishlist** — `/wishlist` · protected · `wishlists`,`listings`,`restock_alerts` · restock toggle on sold_out (R-N06).
- **FR-BUY-4 Followed Sellers** — `/account/following` · protected · `store_follows`,`stores` · new-listing indicator vs `followed_at`.
- **FR-BUY-5 Buyer Inbox** — `/inbox`,`/inbox/[id]` · protected · `inquiries`,`inquiry_messages` · confirmed inquiry → checkout CTA.
- **FR-BUY-6 Checkout** — `/checkout` · protected · `orders`,`order_items`,`addresses`,`payments`,`admin_settings` · order only from confirmed inquiry (R-O01); BETK-ref (R-O02); two payment rows split, **payee = BETK (custodial, OD-8/ADR-016) — BETK's deposit rails + commission rate + flat delivery fee read from `admin_settings`; `commission_rate`/`commission_amount` snapshotted on the order at creation**; stock decremented on seller confirm not here (R-L05).
- **FR-BUY-7 Order Confirmation** — `/checkout/confirmation/[id]` · protected · `orders`,`payments`,`admin_settings` · deposit instructions render **BETK's** handles (`admin_settings`, not the store's); buyer uploads the transfer screenshot to `payments.proof_path` (private `docs` bucket, own-prefix); awaiting-review convention = `proof_path IS NOT NULL AND status='pending'`; **deposit verified by admin** (R-O05 amended; R-O04 COD auto-confirm retired — every order carries the split).
- **FR-BUY-8 Order History** — `/orders` · protected · `orders`,`order_items`.
- **FR-BUY-9 Order Detail / Track** — `/orders/[id]` · protected · `orders`,`order_status_history`,`order_items`,`payments`,`shipments`,`shipment_tracking_events`,`order_messages` · cancel only while pending (R-O03); review only if delivered+window (R-R01/03); dispute only delivered/dispatched (R-D01).
- **FR-BUY-10 Leave Review** — `/orders/[id]/review` · protected · `reviews`,`review_photos`,`rating_aggregates` · one per order (R-O07/R-R02); ≤3 photos; edit ≤48h (R-R03); aggregate recompute (R-R07).
- **FR-BUY-11 Raise Dispute** — `/orders/[id]/dispute/new` · protected · `disputes`,`dispute_evidence` · one active per order (R-O06/R-D06); ≤5 evidence (R-D05); SLA 48h (R-D02).
- **FR-BUY-12 Dispute Detail** — `/disputes/[id]` · protected · `disputes`,`dispute_evidence`,`dispute_messages` · resolution notifies both (R-D04).
- **FR-BUY-13 Notifications** — `/notifications` · protected · `notifications` · unread badge via partial index.

*Seller*

- **FR-SEL-1 Onboarding (5-step)** — `/seller/onboarding` · protected→seller · `seller_profiles`,`stores`,`seller_documents`,`categories` · one store per seller (R-S01); unique URL-safe slug (R-S02); ID front+back (R-S05).
- **FR-SEL-2 Application Status** — `/seller/status` · role:seller · `seller_profiles`,`seller_documents`,`stores` · approval gates go-live (R-S04); resubmit retains docs (R-S08); SLA 24h (R-M01).
- **FR-SEL-3 Dashboard** — `/seller` · role:seller(active) · `seller_analytics_snapshots`,`rating_aggregates`,`seller_profiles`,`orders`,`inquiries`,`listings`.
- **FR-SEL-4 Store Profile** — `/seller/store` · role:seller · `stores` · slug change once (R-S03).
- **FR-SEL-5 Delivery Settings** — `/seller/store/delivery` · role:seller · `stores.delivery_options`.
- **FR-SEL-6 Return Policy** — `/seller/store/returns` · role:seller · `stores.return_policy`.
- **FR-SEL-7 Payment Methods** — `/seller/store/payments` · role:seller · `stores.payment_methods` · ≥1 method required to publish (R-S09).
- **FR-SEL-8 Listings Management** — `/seller/listings` · role:seller · `listings`,`listing_images` · soft delete (R-L10).
- **FR-SEL-9 Create/Edit Listing** — `/seller/listings/new|[id]/edit` · role:seller · `listings`,`listing_images`,`listing_tags`,`categories` · publish needs ≥1 image (R-L02) + ar title (R-L03) + category (R-L04); service hides stock (R-L09).
- **FR-SEL-10 Stock & Inventory** — `/seller/inventory` · role:seller · `listings`,`restock_alerts` · 0 → sold_out (R-L06); restock → active (R-L07); low-stock DERIVED (OD-1).
- **FR-SEL-11 Boost Listing** — `/seller/listings/[id]/boost` · role:seller · `boosts`,`boost_packages` · one active boost per listing (R-B01/R-L08); activates within 5 min of admin confirm (R-B02). **RETAINED (REG-80 closed 2026-09-22; v1 text stands).**
- **FR-SEL-12 Boost Management** — `/seller/boosts` · role:seller · `boosts`,`boost_packages` · ROI (R-B05); auto-expire (R-B03). **RETAINED (REG-80 closed 2026-09-22; v1 text stands).**
- **FR-SEL-13 Seller Inbox** — `/seller/inbox`,`/seller/inbox/[id]` · role:seller · `inquiries`,`inquiry_messages` · confirm→enables checkout; reply updates `avg_response_hours`; notify ≤5s (R-N04).
- **FR-SEL-14 Orders Management** — `/seller/orders` · role:seller · `orders`,`payments`,`order_status_history` · **seller accepts** pending→confirmed (AC-SEL-14, fires the stock trigger), gated on the **admin-confirmed deposit** (R-O05 amended: admin verifies the deposit, not the seller); R-O04 COD auto-confirm retired.
- **FR-SEL-15 Order Detail** — `/seller/orders/[id]` · role:seller · `orders`,`payments`,`order_status_history`,`shipments`,`shipment_tracking_events`,`order_messages` · status changes notify (R-N03).
- **FR-SEL-16 Reviews Management** — `/seller/reviews` · role:seller · `reviews`,`review_photos`,`rating_aggregates` · one immutable reply (R-R04).
- **FR-SEL-17 Earnings** — `/seller/earnings` · role:seller · `seller_analytics_snapshots`,`payouts`,`payments`.
- **FR-SEL-18 Transactions** — `/seller/transactions` · role:seller · `payments`,`orders`.
- **FR-SEL-19 Request Payout** — `/seller/payouts`,`/seller/payouts/new` · role:seller · `payouts` · min EGP 100 (R-O09); manual processing (R-O10).
- **FR-SEL-20 Level Progress** — `/seller/level` · role:seller · `seller_profiles`,`rating_aggregates` · thresholds (R-S06); nightly recalc.
- **FR-SEL-21 Seller Analytics** — `/seller/analytics` · role:seller · `seller_analytics_snapshots`,`rating_aggregates`,`boosts`.
- **FR-SEL-22 Dispute Detail (Seller)** — `/seller/disputes/[id]` · role:seller · `disputes`,`dispute_evidence`,`dispute_messages`.

*Admin*

- **FR-ADM-1 Dashboard** — `/admin` · role:admin · `platform_analytics_snapshots`,`seller_analytics_snapshots`,`seller_profiles`,`disputes`,`flagged_content` · SLA panel.
- **FR-ADM-2 Seller Approval Queue** — `/admin/sellers/approvals` · role:admin · `seller_profiles`,`seller_documents`(signed URL),`stores`,`moderation_logs` · 24h SLA (R-M01); approve flips to active (R-S04).
- **FR-ADM-3 User & Seller Mgmt** — `/admin/users` · role:admin · `users`,`seller_profiles`,`seller_strikes`,`moderation_logs`,`notifications` · temp suspension auto-lifts (R-M03); permanent ban needs confirm (R-M04).
- **FR-ADM-4 Listings Moderation** — `/admin/listings` · role:admin · `listings`,`flagged_content`,`moderation_logs` · auto-flag keywords (R-M06).
- **FR-ADM-5 Flagged Content Queue** — `/admin/moderation/flags` · role:admin · `flagged_content`,`listings`,`reviews`,`moderation_logs` · 24h review (R-M05).
- **FR-ADM-6 Reviews Moderation** — `/admin/reviews` · role:admin · `reviews`,`review_photos`,`flagged_content`,`moderation_logs` · hide via is_visible (R-R06); recompute (R-R07).
- **FR-ADM-7 Categories Mgmt** — `/admin/categories` · role:admin · `categories`.
- **FR-ADM-8 Orders Mgmt** — `/admin/orders` · role:admin · `orders`,`order_items`,`payments`,`order_status_history`,`shipments`,`moderation_logs`.
- **FR-ADM-9 Disputes Mgmt** — `/admin/disputes`,`/admin/disputes/[id]` · role:admin · `disputes`,`dispute_evidence`,`dispute_messages`,`orders`,`payments`,`moderation_logs` · SLA 48h (R-D02); outcomes (R-D03); notify both (R-D04); SLA alert 47h (R-N05).
- **FR-ADM-10 Payments Mgmt** — `/admin/payments` · role:admin · `payments`,`orders`,`disputes`,`moderation_logs` · **admin verifies the deposit against the buyer's uploaded proof (`proof_path`) → `payments.status='confirmed'` + `confirmed_by`/`confirmed_at`; confirms the COD balance after courier remittance; closes the order (settlement signal, OD-8 §3)**; refund → status refunded.
- **FR-ADM-11 Payouts Mgmt** — `/admin/payouts` · role:admin · `payouts`,`moderation_logs` · manual (R-O10); **payouts settle BETK→seller net of commission (seller net = `subtotal − commission_amount`, OD-8/ADR-016); the seller's `stores.payment_methods` is now that settlement destination, not a buyer-facing handle**.
- **FR-ADM-12 Editorial Collections** — `/admin/collections`,`/admin/collections/[id]` · role:admin · `collections`,`collection_listings`,`listings` · scheduling via publish_at/archive_at.
- **FR-ADM-13 Notifications Broadcast** — `/admin/notifications` · role:admin · `notifications`,`whatsapp_templates`,audience tables · channel prefs (R-N01); WhatsApp templates (R-N02); MW4 no campaign entity (OD-3).
- **FR-ADM-14 WhatsApp Templates** — **merged into Admin → Settings → Notifications** (no standalone route; OD-5) · role:admin · `whatsapp_templates` · template CRUD + activate/deactivate within the Settings page.
- **FR-ADM-15 Admin Settings** — `/admin/settings` · role:admin(super for sensitive) · `admin_settings`,`boost_packages` · SLA + auto-flag keywords; add CHECK on numeric keys (C3 §8.2 RISK 2).
- **FR-ADM-16 Moderation Log** — `/admin/moderation/log` · role:admin · `moderation_logs` · immutable, read-only (R-M02).
- **FR-ADM-17 Boost Approval** — `/admin/boosts` · role:admin · `boosts`,`boost_packages`,`moderation_logs` · confirm payment activates (R-B02, MW3). **RETAINED (REG-80 closed 2026-09-22; v1 text stands).**

**v1 §6 Non-functional requirements** — held as §4 of this file except the 59/43 bounding sentence.

**v1 §7 Business rules** — “Authoritative rule set is the C1 catalog … reproduced in `BETK_ERD.md §Business Rule Enforcement Map`.” **FLAG:** that ERD heading is **absent** today (ERD TOC is §1–§9). Occupied R-IDs were recovered from citation across `docs/` (§0 method), not from a missing map. B3 may restore an enforcement map; B2 does not invent one.

**v1 §8 Security requirements** — held as §5 except REG-79 OPEN on gate location.

**v1 §9 Acceptance criteria** — generic page criterion + four spelled-out ACs. **AC-BUY-6 RETIRED. AC-SEL-14 RETIRED. AC-ADM-9 HOLDS. AC-AUTH-2 HOLDS.**

- **AC-BUY-6 (Checkout):** Given a *confirmed* inquiry, placing an order atomically creates one `orders` row (valid `betk_ref`, **with `commission_rate`+`commission_amount` snapshotted**), its `order_items`, and exactly two `payments` rows (deposit+balance) **whose payee is BETK (custodial, OD-8/ADR-016)**; a non-confirmed inquiry is rejected; no partial writes on failure. **RETIRED.**
- **AC-SEL-14 (Confirm order):** The **seller** transitions pending→confirmed (order/service acceptance — actor UNCHANGED), which writes `order_status_history`, decrements `listings.stock_qty` (→ sold_out at 0), and notifies the buyer. The seller cannot accept until the **admin** has confirmed the deposit (`payments.status='confirmed'`, OD-8 §3 — only the *deposit confirmation* moved to admin, not the acceptance); R-O04 COD auto-confirm retired — every order carries the split. **RETIRED.**
- **AC-ADM-9 (Resolve dispute):** Resolution sets `resolution`+`resolution_notes`, writes `moderation_logs`, and dispatches push+SMS to both parties; SLA alert fires at 47h for unresolved disputes.
- **AC-AUTH-2 (OTP):** ≤5 attempts per token; expired/used tokens rejected; success creates a session and never persists the raw OTP.

</details>

---

## 10. Sign-off / supersession history

- **2026-06-13** — v1 PRD (page-framed FRs; 59/43 freeze).
- **2026-07-01** — OD-7 (bilingual + theme) applied to v1 copy.
- **2026-07-23** — OD-8 custodial payments applied to v1 copy (AC-BUY-6 still inquiry-to-order; AC-SEL-14 seller acceptance held).
- **2026-09-03** — V2-STATE-RECORD. v1 freeze (43 · 59 · AC-BUY-6) recorded SUPERSEDED.
- **2026-09-19 — B1.** `BETK_MVP_SCOPE.md` rewritten; OD-9…OD-19 minted; counts unfrozen.
- **2026-09-19 — B1-FIX.** REG-78, REG-79, REG-80 minted.
- **2026-09-19 — B2.** This file rewritten. v1 codes dispositioned. New R/FR/AC minted at mint time (§0). REG-79 written **OPEN**. REG-78 behaviour-not-principal. REG-80 boost codes left **PENDING** in place (closed by B2-FIX). Counts still **UNFROZEN**. Next: **B3** (ERD) cites §3 domain-by-domain; **B4** (UI Spec) maps capabilities to pages without treating this file as a page inventory.
- **2026-09-22 — B2-FIX.** REG-80 closed by the scope owner: boosts are in for v2 MVP; listed boost codes flipped **PENDING → RETAINED** (v1 text stands; no new boost requirement). R-O03 cites `BETK_V2_ROLE_JOURNEYS.md` §5.2; that citation closes REG-73. F-flags normalised: took REG-81..REG-87 at mint (next free was REG-81); F-MODE left as a B3 in-task note. Counts still **UNFROZEN**.
- **2026-09-22 — B3.** REG-82, REG-83, REG-84 closed as product pins. R-C07, R-O21, and AC-CART-7 amended for REG-82. R-O06 / R-O07 / R-R01 / R-R02 and the review/dispute FR rows amended where an OPEN line contradicted REG-83 or REG-84. Table count **FROZEN at 51 (OD-20)**. Pages still unfrozen. Schema is `BETK_ERD.md`, not this file.
- **2026-09-22 — B4.** Page count **FROZEN at 77 (OD-21)**. **REG-90 CLOSED** (seller sees subtotal, commission, and net only; never delivery fee, never order total). Propagated to R-V02, R-O28, AC-VIS-1, AC-CLO-3, FR-SEL-14, FR-SEL-15, FR-SEL-17, FR-SEL-18. **REG-91 OPEN** (buyer-safe delivery total). This file still does not enumerate routes. Routes are `BETK_UI_SPEC.md`.
- **2026-09-22 — B4-FIX.** REG-90’s seller-readable refund, revenue, and payout cap are fee-free in the database (`BETK_ERD.md` §3.10, §6.4). AC-CLO-3 and FR-SEL-17 cite `refunded_subtotal`. REG-91 stays open with the INVOKER origin candidate. No new REG. OD-21 not amended.
- **2026-09-22 — B4-FIX2.** OD-21 corrected in place to **79**. Gate surface for REG-79 is `/auth/phone` and `/auth/verify`. Trigger point stays OPEN. No new REG.
- **2026-09-22 — B5.** ADR-020..ADR-025. REG-89 and REG-91 closed. REG-90 grant is ADR-020. REG-78 principle stays closed; the handoff mechanism stays open under the courier gate. REG-92 minted (column-grant build guard). No new table. No new page. OD-21 stays 79. OD-20 stays 51.

- Product owner: __________  Date: ______
- Tech lead: __________  Date: ______

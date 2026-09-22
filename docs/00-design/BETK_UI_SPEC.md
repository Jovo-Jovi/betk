# BETK_UI_SPEC.md
> Step 4 of the BETK Dev OS. **v2 rewrite (B4, 2026-09-22).** Pages, routes, roles, data requirements, states, and acceptance. B6 (phases) and the build cite this file **section-by-section**.
>
> **Authority, in order:** [`docs/01-product/BETK_PRD.md`](../01-product/BETK_PRD.md) → [`docs/03-database/BETK_ERD.md`](../03-database/BETK_ERD.md) (tables **FROZEN at 51** under OD-20) → [`docs/01-product/BETK_MVP_SCOPE.md`](../01-product/BETK_MVP_SCOPE.md) → [`docs/10-ai-development/BETK_V2_SCOPE_BASELINE.md`](../10-ai-development/BETK_V2_SCOPE_BASELINE.md) + [`docs/10-ai-development/BETK_V2_ROLE_JOURNEYS.md`](../10-ai-development/BETK_V2_ROLE_JOURNEYS.md). The historical block at the bottom is the **v1 source being rewritten** (59-page headline), not the target.
>
> **Layer:** routes, roles, which ERD columns a page may read, states, and which shared components it composes. **No visual design.** `components/ui` and `components/shared` are owned by Claude Design. A missing component is a **gap** (§8), never a style spec. **No schema. No ADR.**
>
> **Numbers taken at mint (re-read 2026-09-22 before taking):** occupied ODs ended at OD-20 (next free **OD-21**). Occupied REGs ended at REG-89 (next free **REG-90**). **Took REG-90** (seller order money pin, closed) and **OD-21** (this page freeze). **Took REG-91** (open: buyer-safe delivery total). Did **not** take an ADR. Next free after this mint: **OD-22**, **REG-92**. Next free ADR for B5 stays **ADR-020**.

---

> ## TABLES ARE FROZEN at 51 (OD-20). PAGES ARE FROZEN at 77 (OD-21).
>
> Live physical tables **today** remain **43** (`betk` 41 + `betk_analytics` 2) until Stage C. That figure is **TRUE TODAY**. The v2 target table inventory is **51**.
>
> The v2 page inventory is **77** route patterns under the counting rule in §0. **OD-21 supersedes** the v1 headline of 59. The baseline ~73 figure was an estimate (§2.4). It is not this freeze.
>
> Cite v2 sections §0–§9. Do not cite the historical block as the v2 page inventory.

---

## How B6 cites this file

| Cite | For |
|---|---|
| §0 | The counting rule. Do not recount under a different unit. |
| §1 | What v1 measured, and why 59 and 77 are different units. |
| §2 | Disposition of every v1 route pattern, plus the new patterns. |
| §3 | The frozen inventory (OD-21). |
| §4 | Binding UI inputs (N28, REG-90, REG-44, REG-79, REG-82, REG-83, REG-84, REG-85, posture, bilingual). |
| §5 | Per-page spec. Build a page only from its §5 block. |
| §6 | Seller-page proof: no buyer identity, no delivery fee, no order total. |
| §7 | Acceptance matrix, both directions. |
| §8 | Claude Design gap list. Compose what exists. Do not restyle the kit to fill a gap. |
| §9 | STOP-and-flags. Do not fill them. |

---

## 0. Counting rule (written before any count)

**One page is one route pattern on one role surface, counted once across locales.**

1. Strip the locale prefix. Arabic is unprefixed and English is `/en/…` (OD-7). Those two URLs are **one** page.
2. A route pattern is the path template with dynamic segments left as `[param]`. Two templates are two pages. `/inbox` and `/inbox/[inquiryId]` are two. `/seller/listings/new` and `/seller/listings/[id]/edit` are two. `/seller/payouts` and `/seller/payouts/new` are two. `/admin/disputes` and `/admin/disputes/[id]` are two. `/admin/collections` and `/admin/collections/[id]` are two.
3. Tabs, modals, drawers, steppers, and query strings **inside one pattern do not count.** The five-step onboarding wizard is one page. WhatsApp templates live on the Notifications tab of `/admin/settings` (OD-5) and are **not** a page. A filter `?status=` is not a page. The checkout version-gate is a panel on `/checkout`, not a page. The seller escalation form is on `/seller/orders/[id]`, not a page. The courier rate matrix is a tab of `/admin/settings`, not a page.
4. A role prefix that changes the actor is a different page. Buyer `/disputes/[id]`, seller `/seller/disputes/[id]`, and admin `/admin/disputes/[id]` are three.
5. A redirect-only alias is not a page. A `notFound()` page still counts.
6. Replacing a param name inside the same responsibility (`/orders/[id]` → `/orders/[masterId]`) does **not** add a page. Adding a new template does.

This rule is the unit for §1, §2, and the OD-21 freeze. Do not mix it with the v1 heading count.

---

## 1. v1 measured under §0

The v1 document (historical block) has **60** `###` page headings. One of them, WhatsApp Templates, is a tab of `/admin/settings` (OD-5) and is **not** a page under §0. The other 59 headings are the historical “59”.

Six headings each contain **two** route patterns. Under §0 those six extra patterns count. Measured v1 total = **65**.

| Bundled heading (counted as 1 in the 59) | Second pattern §0 counts |
|---|---|
| Buyer Inbox | `/inbox/[inquiryId]` |
| Create / Edit Listing | `/seller/listings/[id]/edit` |
| Seller Inbox | `/seller/inbox/[inquiryId]` |
| Request Payout | `/seller/payouts/new` |
| Disputes Management (Admin) | `/admin/disputes/[id]` |
| Editorial Collections | `/admin/collections/[id]` |

**Reconciliation with 59.** 60 headings − 1 merged tab = **59**. 59 + 6 bundled second patterns = **65**. The older headlines 56 and 61 were already rejected inside the v1 acceptance matrix (2026-07-16, R4) as arithmetic errors on the heading inventory. **59 was a heading count, not a route-pattern count.** It is not wrong for that unit. It is the wrong unit for this freeze. Nothing in v1 was added or removed to produce 65; the unit changed.

### 1.1 The 65 v1 patterns

| # | Pattern | Heading |
|---|---|---|
| 1 | `/` | Homepage |
| 2 | `/search` | Search & Filter Results |
| 3 | `/category/[slug]` | Category Browse |
| 4 | `/listing/[id]` | Listing Detail |
| 5 | `/store/[slug]` | Public Storefront |
| 6 | `/auth/login` | Phone Entry |
| 7 | `/auth/verify` | OTP Verification |
| 8 | `/auth/register` | Complete Buyer Profile |
| 9 | `/account` | Account / Profile |
| 10 | `/account/addresses` | Address Book |
| 11 | `/wishlist` | Wishlist & Saved |
| 12 | `/account/following` | Followed Sellers |
| 13 | `/inbox` | Buyer Inbox list |
| 14 | `/inbox/[inquiryId]` | Buyer Inbox thread |
| 15 | `/checkout` | Checkout |
| 16 | `/checkout/confirmation/[orderId]` | Order Confirmation |
| 17 | `/orders` | Order History |
| 18 | `/orders/[id]` | Order Detail |
| 19 | `/orders/[id]/review` | Leave Review |
| 20 | `/orders/[id]/dispute/new` | Raise Dispute |
| 21 | `/disputes/[id]` | Dispute Detail (Buyer) |
| 22 | `/notifications` | Notifications Center |
| 23 | `/seller/onboarding` | Seller Onboarding |
| 24 | `/seller/status` | Seller Application Status |
| 25 | `/seller` | Seller Dashboard |
| 26 | `/seller/store` | Store Profile Settings |
| 27 | `/seller/store/delivery` | Delivery Settings |
| 28 | `/seller/store/returns` | Return Policy Settings |
| 29 | `/seller/store/payments` | Payment Methods Settings |
| 30 | `/seller/listings` | Listings Management |
| 31 | `/seller/listings/new` | Create Listing |
| 32 | `/seller/listings/[id]/edit` | Edit Listing |
| 33 | `/seller/inventory` | Stock & Inventory |
| 34 | `/seller/listings/[id]/boost` | Boost Listing |
| 35 | `/seller/boosts` | Boost Management |
| 36 | `/seller/inbox` | Seller Inbox list |
| 37 | `/seller/inbox/[inquiryId]` | Seller Inbox thread |
| 38 | `/seller/orders` | Orders Management (Seller) |
| 39 | `/seller/orders/[id]` | Order Detail (Seller) |
| 40 | `/seller/reviews` | Reviews Management (Seller) |
| 41 | `/seller/earnings` | Earnings |
| 42 | `/seller/transactions` | Transactions |
| 43 | `/seller/payouts` | Payout list |
| 44 | `/seller/payouts/new` | Request Payout |
| 45 | `/seller/level` | Level Progress |
| 46 | `/seller/analytics` | Seller Analytics |
| 47 | `/seller/disputes/[id]` | Dispute Detail (Seller) |
| 48 | `/admin` | Admin Dashboard |
| 49 | `/admin/sellers/approvals` | Seller Approval Queue |
| 50 | `/admin/users` | User & Seller Management |
| 51 | `/admin/listings` | Listings Moderation |
| 52 | `/admin/moderation/flags` | Flagged Content Queue |
| 53 | `/admin/reviews` | Reviews Moderation |
| 54 | `/admin/categories` | Categories Management |
| 55 | `/admin/orders` | Orders Management (Admin) |
| 56 | `/admin/disputes` | Disputes queue |
| 57 | `/admin/disputes/[id]` | Dispute detail (Admin) |
| 58 | `/admin/payments` | Payments Management |
| 59 | `/admin/payouts` | Payouts Management |
| 60 | `/admin/collections` | Collections list |
| 61 | `/admin/collections/[id]` | Collection editor |
| 62 | `/admin/notifications` | Notifications Broadcast |
| 63 | `/admin/settings` | Admin Settings |
| 64 | `/admin/moderation/log` | Moderation Log |
| 65 | `/admin/boosts` | Boost Approval |

WhatsApp Templates: **not a pattern.** MERGED into `/admin/settings` (OD-5, FR-ADM-14). It stays a tab.

---

## 2. Page disposition

Every v1 pattern has exactly one verdict. A new pattern cites at least one PRD code. Retired **flows** that were never their own pattern are listed in §2.2 so they are not quietly kept inside an amended page.

### 2.1 v1 patterns

| # | Pattern | Verdict | Cited reason |
|---|---|---|---|
| 1 | `/` | **AMENDED** | FR-PUB-1. Boosted strip **KEPT** (REG-80). Guest add-to-cart creates no line (R-C01). |
| 2 | `/search` | **AMENDED** | FR-PUB-2. Service-type filter **retired**. Boosted ranking **KEPT** (REG-80, R-B04). |
| 3 | `/category/[slug]` | **KEPT** | FR-PUB-3 holds unchanged. |
| 4 | `/listing/[id]` | **AMENDED** | FR-PUB-4. Fixed price, shipping attributes, specs, prep days, Request price (FR-QTE-1). Four `price_type` presentations retired. |
| 5 | `/store/[slug]` | **AMENDED** | FR-PUB-5. No seller street address (R-V03). Delivery-method picker **retired**. Return-policy block **OPEN REG-85**. |
| 6 | `/auth/login` | **KEPT** | FR-AUTH-1. Also the verified-phone gate surface with #7. Trigger point **OPEN REG-79**. |
| 7 | `/auth/verify` | **KEPT** | FR-AUTH-2. Gate surface; trigger **OPEN REG-79**. |
| 8 | `/auth/register` | **AMENDED** | FR-AUTH-3. Current Buyer T&C accepted here (R-G01, FR-AGR-1). |
| 9 | `/account` | **KEPT** | FR-BUY-1. OD-2 deactivate-only. |
| 10 | `/account/addresses` | **KEPT** | FR-BUY-2. Buyer reads own addresses (ERD §3.9). |
| 11 | `/wishlist` | **KEPT** | FR-BUY-3. |
| 12 | `/account/following` | **KEPT** | FR-BUY-4. |
| 13 | `/inbox` | **AMENDED** | FR-BUY-5. Quote channel. Confirmed-inquiry → checkout CTA **retired** (§2.2). |
| 14 | `/inbox/[inquiryId]` | **AMENDED** | FR-QTE-1, FR-BUY-5. Accept writes a cart line (R-Q05). No checkout CTA. |
| 15 | `/checkout` | **AMENDED** | FR-CHK-1 supersedes FR-BUY-6. Cart, not a confirmed inquiry (R-O11). No delivery-mode picker (R-K01). |
| 16 | `/checkout/confirmation/[orderId]` | **AMENDED** | Param is the **master** id. FR-BUY-7, FR-PAY-1. One InstaPay proof on the master (N22). |
| 17 | `/orders` | **AMENDED** | FR-BUY-8. History is of **master** purchases. |
| 18 | `/orders/[id]` | **AMENDED** | Param is `[masterId]`. FR-BUY-9. Per-seller sections on this route. Pickup/remote empty state **retired**. |
| 19 | `/orders/[id]/review` | **AMENDED** | Pattern becomes `/orders/[masterId]/[sellerOrderId]/review`. FR-BUY-10, REG-83. |
| 20 | `/orders/[id]/dispute/new` | **AMENDED** | Pattern becomes `/orders/[masterId]/[sellerOrderId]/dispute/new`. FR-BUY-11, REG-84. Not the return flow. |
| 21 | `/disputes/[id]` | **KEPT** | FR-BUY-12. The linked order is a seller order (REG-84). |
| 22 | `/notifications` | **KEPT** | FR-BUY-13. Event set grows (R-N07, R-N08); the surface holds. |
| 23 | `/seller/onboarding` | **AMENDED** | FR-SEL-1, FR-CAT-1, R-S10, R-G04. Pickup address, up to 3 categories, Seller Agreement e-sign, food branch. Delivery-mode toggles **retired**. |
| 24 | `/seller/status` | **KEPT** | FR-SEL-2. |
| 25 | `/seller` | **AMENDED** | FR-SEL-3. No acceptance queue (§2.2). Recent orders obey §4.a. |
| 26 | `/seller/store` | **KEPT** | FR-SEL-4. Approved categories are read-only here; the write is onboarding (#23) into `store_categories`. |
| 27 | `/seller/store/delivery` | **AMENDED** | FR-SEL-5. This route is now the **pickup address**, not mode selection. |
| 28 | `/seller/store/returns` | **KEPT** | FR-SEL-6 holds. Relationship to the platform policy is **OPEN REG-85**. |
| 29 | `/seller/store/payments` | **KEPT** | FR-SEL-7. Settlement handles, not buyer rails. |
| 30 | `/seller/listings` | **KEPT** | FR-SEL-8. |
| 31 | `/seller/listings/new` | **AMENDED** | FR-SEL-9, FR-CAT-1. Products only, fixed price, shipping attributes, prep cap, approved categories. |
| 32 | `/seller/listings/[id]/edit` | **AMENDED** | Same as #31. |
| 33 | `/seller/inventory` | **AMENDED** | FR-SEL-10, FR-STK-1. Decrement is at checkout. Low stock stays derived (OD-1). No `inventory_alerts` table. |
| 34 | `/seller/listings/[id]/boost` | **KEPT** | FR-SEL-11 **RETAINED** (REG-80). v1 text stands. Not expanded. |
| 35 | `/seller/boosts` | **KEPT** | FR-SEL-12 **RETAINED** (REG-80). |
| 36 | `/seller/inbox` | **AMENDED** | FR-SEL-13. Seller quotes. Confirm-to-enable-checkout **retired**. Neutral buyer label (§4.b). |
| 37 | `/seller/inbox/[inquiryId]` | **AMENDED** | FR-QTE-1. Band, 24h, prep time. No buyer name, phone, address, or city. |
| 38 | `/seller/orders` | **AMENDED** | FR-SEL-14. Acceptance **retired**. §4.a money and identity. |
| 39 | `/seller/orders/[id]` | **AMENDED** | FR-SEL-15, FR-ESC-1, FR-SLA-1, FR-RET-1 (seller accept/reject). preparing → ready only. No shipment write. No buyer identity. §4.a. |
| 40 | `/seller/reviews` | **AMENDED** | FR-SEL-16, REG-44, REG-83. No buyer name and no buyer location. |
| 41 | `/seller/earnings` | **AMENDED** | FR-SEL-17, FR-CLO-1, REG-90. Subtotal, commission, net. No fee, no order total. |
| 42 | `/seller/transactions` | **AMENDED** | FR-SEL-18, REG-90. Unit is the seller order. Seller cannot read `payments`. |
| 43 | `/seller/payouts` | **AMENDED** | FR-SEL-19 behaviour holds. The balance it draws on is the REG-90 net (§9 flag on `refunded_amount`). |
| 44 | `/seller/payouts/new` | **AMENDED** | Same as #43. Phone gate **holds** here (AC-AUTH-4). |
| 45 | `/seller/level` | **KEPT** | FR-SEL-20. |
| 46 | `/seller/analytics` | **AMENDED** | FR-SEL-21. Boost clause **RETAINED** (REG-80). `revenue_egp` display is flagged (§9). |
| 47 | `/seller/disputes/[id]` | **AMENDED** | FR-SEL-22 behaviour holds. The thread label is the neutral buyer label (R-V02). No master dispute (REG-84). |
| 48 | `/admin` | **KEPT** | FR-ADM-1. Escalation signals link to #75; they do not add a second dashboard. |
| 49 | `/admin/sellers/approvals` | **AMENDED** | FR-ADM-2, R-S10. Food artefacts when the food branch applies. |
| 50 | `/admin/users` | **KEPT** | FR-ADM-3. No automatic strike (R-E04). |
| 51 | `/admin/listings` | **KEPT** | FR-ADM-4. |
| 52 | `/admin/moderation/flags` | **KEPT** | FR-ADM-5. |
| 53 | `/admin/reviews` | **AMENDED** | FR-ADM-6. The review surface still renders no buyer name and no buyer location (REG-44). |
| 54 | `/admin/categories` | **KEPT** | FR-ADM-7. |
| 55 | `/admin/orders` | **AMENDED** | FR-ADM-8. Master + children. Detail is a **drawer on this route** (not a new pattern). Admin sees addresses (R-V01). |
| 56 | `/admin/disputes` | **AMENDED** | FR-ADM-9. Per seller order (REG-84). |
| 57 | `/admin/disputes/[id]` | **AMENDED** | FR-ADM-9, AC-ADM-9. Refund is per seller order. |
| 58 | `/admin/payments` | **AMENDED** | FR-ADM-10, FR-ADM-18, FR-PAY-1, FR-PAY-2. **One** confirm releases every child. **No close control** (R-O25). This is the deposit-verification queue. |
| 59 | `/admin/payouts` | **KEPT** | FR-ADM-11. |
| 60 | `/admin/collections` | **KEPT** | FR-ADM-12. |
| 61 | `/admin/collections/[id]` | **KEPT** | FR-ADM-12. |
| 62 | `/admin/notifications` | **KEPT** | FR-ADM-13. OD-3: no campaign entity. |
| 63 | `/admin/settings` | **AMENDED** | FR-ADM-15, R-M07, R-M08. Notifications tab still holds WhatsApp templates (FR-ADM-14). **Courier rate matrix is a tab of this route** (FR-COU-1), not a new page. Flat `delivery_fee_flat_egp` is not the buyer fee source. |
| 64 | `/admin/moderation/log` | **KEPT** | FR-ADM-16. |
| 65 | `/admin/boosts` | **KEPT** | FR-ADM-17 **RETAINED** (REG-80). |

### 2.2 Retired behaviours (not pages)

These had no route pattern of their own. They are **RETIRED** inside the amended pages above. Do not rebuild them.

| Behaviour | Verdict | Where it used to live | Cited reason |
|---|---|---|---|
| Confirmed-inquiry → checkout CTA | **RETIRED** | #13, #14, #15 | FR-BUY-5 amendment, FR-BUY-6 superseded, AC-BUY-6 retired, R-O11. |
| Seller acceptance queue / pending→confirmed by the seller | **RETIRED** | #25, #38, #39 | FR-SEL-3, FR-SEL-14, AC-SEL-14 retired. `confirmed` means admin release. |
| Delivery-mode picker `{delivery, pickup, remote}` | **RETIRED** | #5, #15, #23, #27 | R-K01, FR-SEL-1, FR-SEL-5, FR-PUB-5. |
| Pickup / remote “no shipment” empty state | **RETIRED** | #18, #39 | FR-BUY-9. Courier-only; every seller order has a shipment. The seller still does not read `shipments` (ERD §8). |

### 2.3 New patterns

| # | Pattern | PRD |
|---|---|---|
| 66 | `/cart` | FR-CART-1, R-C01–R-C07, REG-82 |
| 67 | `/legal/terms` | FR-AGR-1, R-G05, AC-AGR-4 |
| 68 | `/legal/seller-agreement` | FR-AGR-1, R-G04, R-G05 |
| 69 | `/legal/returns` | FR-AGR-1, R-G05. **Policy document.** Not a return case. |
| 70 | `/legal/privacy` | FR-AGR-1, R-G05 |
| 71 | `/orders/[masterId]/[sellerOrderId]/return` | FR-RET-1, R-U01, R-U02 |
| 72 | `/returns/[id]` | FR-RET-1. Buyer status of one `returns` row. |
| 73 | `/admin/returns` | FR-RET-1, FR-ADM-9 |
| 74 | `/admin/returns/[id]` | FR-ADM-9, R-U04 |
| 75 | `/admin/escalations` | FR-ADM-20, FR-ESC-1, R-E04 |
| 76 | `/admin/ready-for-pickup` | FR-ADM-19, FR-COU-1, R-K07, R-K09 |
| 77 | `/admin/sellers/[id]/performance` | FR-ADM-21 |

Not added, on purpose:

- No `/seller/returns` and no `/seller/returns/[id]`. Seller accept/reject is on #39 (the return hangs off that seller order; `returns` has no UNIQUE, so #39 lists the rows).
- No `/returns` index. Same shape as disputes: entry from the master seller-order section, detail at #72.
- No `/orders/[masterId]/[sellerOrderId]` drill-in. Per-seller sections are on #18.
- No courier login (AC-COU-6, REG-78).
- No support page (REG-50). Its old “OD-9” note is void; OD-9 is the cart model.
- No second deposit-verification route. #58 is that queue.
- No `/auth/phone`. The gate reuses #6 and #7.

### 2.4 Why this is not ~73

`BETK_V2_SCOPE_BASELINE.md` §10 estimated **~73** = the old headline 59 + about 14 names. Under §0 the v1 base is **65**, not 59 (+6). Against the estimate’s 14 names this freeze drops four (`/returns` list, `/seller/returns`, `/seller/returns/[id]`, `/orders/[masterId]/[sellerOrderId]`) and adds two the estimate did not split out (`/admin/returns/[id]`, the buyer return-request pattern). 65 + 12 = **77**. 73 + 6 − 4 + 2 = 77. The estimate is not corrected into 77; it was a different unit plus a different split.

---

## 3. Freeze (OD-21)

**OD-21.** v2 page count is **77** route patterns under §0. This supersedes the v1 headline of 59. Tables stay **51** under OD-20. Taken at mint 2026-09-22 (next free OD was OD-21).

v1 under §0 is 5 public + 3 auth + 14 buyer + 25 seller + 18 admin = **65**. v2 adds 4 legal pages (public), the cart, the return request, and the return detail (buyer +3), and 5 admin queues. 65 + 4 + 3 + 5 = **77**.

| Band | Patterns | Count |
|---|---|---|
| Public | 1–5 and 67–70 | 9 |
| Auth | 6–8 | 3 |
| Buyer | 9–22, 66, 71, 72 | 17 |
| Seller | 23–47 | 25 |
| Admin | 48–65, 73–77 | 23 |
| **Total** | | **77** |

9+3+17+25+23 = **77**. Buyer is the v1 14 plus cart, return request, and return detail. The four legal pages sit in Public, not in Buyer. Admin is the v1 18 plus returns queue, return detail, escalations, ready-for-pickup, and performance.

---

## 4. Binding UI inputs

### 4.a N28 + REG-90 (seller pages)

Closed product pin **REG-90** (2026-09-22, scope owner): the seller sees **subtotal, commission, and net only**. Never the delivery fee. Never the order total. The fee is origin × destination × weight, so a seller-visible fee lets the seller infer the buyer’s destination zone, which N28 forbids. Commission is on subtotal only (R-O27), so the net does not need the fee or the total.

**Net displayed** = `seller_orders.subtotal − seller_orders.commission_amount`. Do not subtract `refunded_amount` on screen while §9’s flag is open.

**Seller order allow-list** (columns a seller page may render): `seller_orders.display_ref` (REG-81: render only when non-null; do not invent a format; legacy `betk_ref` may show on historical rows — it is an order number, ERD §3.6), `status`, `prep_deadline`, `confirmed_at`, `delivered_at`, `balance_confirmed_at`, `payout_eligible_at`, `commission_rate`, `commission_amount`, `subtotal`, `escalated_at`, `escalation_reason`, `escalation_note`, `escalation_resolved_at`, `cancellation_reason`, `created_at`. Items from `order_items`: `listing_title_ar`, `listing_title` snapshot columns the ERD already has, `quantity`, `unit_price`, `subtotal`, `is_custom`, `prep_days_snapshot`.

**Seller order deny-list** (do not render, do not join): `delivery_fee`, `total_amount`, `buyer_id`, `delivery_address_id`, `master_orders` (seller SELECT is none, ERD §8), `payments` (seller SELECT is none), `shipments` (seller SELECT is none), `addresses`, `buyer_profiles`, `users.phone_number`. No buyer name, phone, address, city, or governorate (R-V02, AC-VIS-1).

`buyer_id` and `delivery_address_id` may exist on the row (ERD §4.1). The page does not render them.

### 4.b REG-44 (reviews)

Reviews render **no buyer name and no buyer location**. Use a neutral keyed label. Precedent: Phase 06 T04 `t("buyerLabel")`. Applies on #4, #5, #40, #47, #53, and #18’s review entry. Do not join `reviews.buyer_id` to `buyer_profiles`.

### 4.c REG-79 (phone gate) — OPEN

The gate **surface** is #6 and #7. Named holds that stay: checkout (#15), become-seller (#23), payout (#44) — AC-AUTH-4. **Where** verified phone is required relative to add-to-cart is **OPEN**. Do not encode the trigger. Do not add `/auth/phone`.

### 4.d REG-82 (cart restore)

On #66, after payment-window expiry: fixed-price lines return as snapshotted. Custom-quote lines return only while `inquiries.quote_expires_at` is still in the future; otherwise the line is absent and the page prompts a new quote (R-C07, AC-CART-7).

### 4.e REG-83 / REG-84

Review entry is on the seller-order **section** of #18, and the form is #19. Dispute entry is on that same section, and the form is #20. There is **no** master-level review and **no** master-level dispute control.

### 4.f REG-85 — OPEN

#5 and #28 may show `stores.return_policy`. How that text relates to `/legal/returns` (OD-13) is **not decided**. Do not invent override, replacement, or a dual-display rule.

### 4.g Communication posture

Buyer↔seller stays in-app. A page may offer **share** of a public link (REG-51, gap §8), a **BETK→user notification**, or nothing. It may not offer counterparty WhatsApp, phone, or address. **No support page** (REG-50). Footer contact is not given a route here.

### 4.h Bilingual

One page, two locales. `ar` unprefixed, `en` under `/en`. RTL is canonical; logical Tailwind utilities; LTR islands for refs, money, phones, OTP. Shell chrome is `next-intl`. Listing titles use the locale column with fallback. Descriptions and bios render as authored. A locale outside `{ar, en}` is not a page.

### 4.i States and Guard E

Every page below names empty, error, and whether it can reach `notFound()`. **Guard E / REG-47:** if `notFound(): yes`, no `loading.tsx` may sit at that segment or any ancestor, including `[locale]`. RLS denial is not-found, not forbidden.

Default empty copy is one plain-Arabic line plus one CTA, with an English catalog string (historical §6, still the standard). Admin queues use a positive empty (“queue is clear”).

### 4.j Server-computed buyer delivery (REG-91, OPEN)

#66 and #15 show **one** delivery figure and **one** total (R-C03, R-K03, AC-CHK-6). They do **not** show the per-seller split or commission (R-O28). They do **not** read `store_pickup_addresses` (buyer SELECT is none). The figure is a server projection. REG-91 is open; do not invent the function here and do not add a table.

---

## 5. Per-page spec

Kit names below are components that already exist under `components/shared` or `components/ui`. Anything else is §8, not a spec.

**i18n** on every page is §4.h unless the block says otherwise.

### 5.1 Public and legal

#### P01 Homepage — `/`
- **v1 #1 AMENDED.** FR-PUB-1, R-B04 RETAINED, R-C01.
- **Role:** public.
- **Data:** `collections` where `status='live'` ordered by `homepage_position`; `collection_listings.sort_order`; `listings` (`status='active'`, `deleted_at` null) for new arrivals; `boosts.status='active'` joined to listings for the boosted strip; `listing_images`; `categories` (`is_active`, `sort_order`, `icon_url`); `stores` (`name_ar`, `name_en`, `avatar_url`, `slug`) and `seller_profiles.level`; `rating_aggregates`.
- **States:** no live collections → new-arrivals only; zero listings → empty with become-a-seller CTA; section error with retry. **notFound(): no.**
- **Composes:** `AppTopbar`, `MobileBottomNav`, `CategoryGrid`, `CollectionStrip`, `ListingCard`, `StoreCard`, `Footer`, `EmptyState`, `ErrorRetryCard`.
- **Binding:** guest wishlist/cart/quote sends the guest to #6 and writes nothing (R-C01, R-Q08). Boosted strip stays.

#### P02 Search — `/search`
- **v1 #2 AMENDED.** FR-PUB-2, R-B04 RETAINED.
- **Role:** public.
- **Data:** `listings.search_vector`, `price`, `category_id`; `categories`; `stores.governorate`, `stores.city` (store location, not the buyer’s); `boosts`; `listing_images`; `rating_aggregates`. No `type=service` filter (R-L16).
- **States:** empty results; filter-empty with clear; error retry. **notFound(): no.**
- **Composes:** `SearchBar`, `FilterSheet`, `FilterChips`, `ListingCard`, `EmptyState`, `ErrorRetryCard`.
- **Gap:** REG-58 stays a kit defect on `SearchBar` (§8). It is not restated as styling.

#### P03 Category — `/category/[slug]`
- **v1 #3 KEPT.** FR-PUB-3.
- **Role:** public.
- **Data:** `categories` by `slug` and children by `parent_id`; active `listings`; `listing_images`; `rating_aggregates`.
- **States:** empty category; error retry. **notFound(): yes** when missing or `is_active=false`. **Guard E.**
- **Composes:** `FilterSheet`, `ListingCard`, `EmptyState`, `ErrorRetryCard`.

#### P04 Listing detail — `/listing/[id]`
- **v1 #4 AMENDED.** FR-PUB-4, FR-QTE-1, FR-CAT-1, R-L10, R-N06, REG-44, REG-51.
- **Role:** public. Writes need an account.
- **Data:** `listings` (`price`, `price_type` rendered only as fixed, `weight_g`, `length_mm`, `width_mm`, `height_mm`, `specs`, `prep_days`, `stock_qty`, `is_made_to_order`, `title_ar`, `title_en`, `description_ar`); `listing_images`; `listing_tags`; `stores` + `seller_profiles` (`level`, `is_verified`, `avg_response_hours`) — **no pickup street**; `rating_aggregates`; `reviews` (`is_visible`, `rating`, `body`, `seller_reply`) with **no buyer name or location**; `review_photos`; `wishlists`; `restock_alerts`.
- **States:** no reviews → empty copy; sold out → restock CTA; removed → not found; error retry. **notFound(): yes.** **Guard E.**
- **Composes:** `ImageGallery`, `PriceBlock` (fixed only), `WishlistButton`, `SellerMiniCard`, `StarRating`, `RatingSummary`, `StockBadge`.
- **Binding:** Add to cart and Request price require an account (#6), not a verified phone (REG-79 OPEN). Request price creates an `inquiries` row and opens #14. Share is the gap in §8 (REG-51). Store name navigation is the gap in §8 (REG-72).

#### P05 Storefront — `/store/[slug]`
- **v1 #5 AMENDED.** FR-PUB-5, R-S07, R-V03, REG-85, REG-51, REG-44.
- **Role:** public.
- **Data:** `stores` by `slug` (`name_ar`, `name_en`, `bio_ar`, `avatar_url`, `cover_url`, `governorate`, `city`, `return_policy`, `status`). **Do not render** `payment_methods` or `delivery_options` or `store_pickup_addresses`. `seller_profiles` (`level`, `is_verified`, `avg_response_hours`); `rating_aggregates`; active `listings`; visible `reviews` with no buyer name or location; `store_follows`; `store_categories` ids for display of approved categories (public read of ids, ERD §8).
- **States:** no listings; no reviews; suspended or unknown → not found. **notFound(): yes.** **Guard E.**
- **Composes:** `FollowButton`, `ListingCard`, `StarRating`, `RatingSummary`, `LevelBadge`, `VerifiedBadge`, `Tabs`.
- **Binding:** REG-85 OPEN on the return-policy block. No delivery-mode picker. Share is §8.

#### P67 Buyer terms — `/legal/terms`
- **NEW.** FR-AGR-1, R-G05, R-G01, AC-AGR-4.
- **Role:** public.
- **Data:** lawyer-authored body is not a table. Current version label is the admin setting key the ERD already reserves for agreement versions (`admin_settings`, admin-only). The public page renders the prose artifact engineering is given. It does not invent prose (R-G07).
- **States:** prose not yet supplied → empty “not published”, not a fake policy. Error retry. **notFound(): no.**
- **Composes:** `AppTopbar`, `Footer`.
- **Binding:** #8 links here and records `agreement_acceptances` (`document` buyer terms, `version_label`).

#### P68 Seller agreement — `/legal/seller-agreement`
- **NEW.** FR-AGR-1, R-G04, R-G05, AC-AGR-4.
- **Role:** public (readable without an account). Signature happens on #23.
- **Data:** same as P67 for the seller-agreement version. Acceptance row is written from #23, not from this page.
- **States:** unpublished empty. **notFound(): no.**
- **Composes:** `AppTopbar`, `Footer`.

#### P69 Return & refund policy — `/legal/returns`
- **NEW.** FR-AGR-1, R-G05, AC-AGR-4. This is the **platform policy page**, not #71 and not #28.
- **Role:** public.
- **Data:** lawyer prose plus its version label. **REG-85 OPEN:** do not decide whether #28’s `stores.return_policy` overrides, repeats, or sits beside this page.
- **States:** unpublished empty. **notFound(): no.**
- **Composes:** `AppTopbar`, `Footer`.

#### P70 Privacy — `/legal/privacy`
- **NEW.** FR-AGR-1, R-G05, AC-AGR-4.
- **Role:** public.
- **Data:** lawyer prose plus its version label.
- **States:** unpublished empty. **notFound(): no.**
- **Composes:** `AppTopbar`, `Footer`.

### 5.2 Auth

#### P06 Phone entry — `/auth/login`
- **v1 #6 KEPT.** FR-AUTH-1, R-A01, R-A03, OD-4. Gate surface for FR-AUTH-4.
- **Role:** public.
- **Data:** `users.phone_number` uniqueness branch; `otp_tokens` create (`token_hash`, `expires_at`, `attempt_count`). Google OAuth find-or-create. No password.
- **States:** invalid phone; rate limit; suspended (R-A05). **notFound(): no.**
- **Composes:** `Button`, `Input`. Auth shell is existing layout, not a new kit component.
- **Binding:** REG-79 does not add a trigger on this page. The page only verifies a phone when some held surface sends the user here.

#### P07 OTP — `/auth/verify`
- **v1 #7 KEPT.** FR-AUTH-2, AC-AUTH-2.
- **Role:** public, mid-auth.
- **Data:** `otp_tokens` (`token_hash`, `expires_at`, `is_used`, `attempt_count` ≤ 5). Success sets `users.last_login_at`. Sessions UI stays out (OD-5); do not build a sessions page.
- **States:** expired; lockout. **notFound(): no.**
- **Composes:** `Input`, `Button`.
- **i18n:** OTP digits are an LTR island.

#### P08 Complete profile — `/auth/register`
- **v1 #8 AMENDED.** FR-AUTH-3, R-G01, AC-AGR-1.
- **Role:** authenticated, profile incomplete.
- **Data:** insert `buyer_profiles` (`full_name`, `governorate`, `city`, `interests`, `notification_prefs`); `categories` for interests; insert `agreement_acceptances` for the current buyer-terms `version_label`. Signup without that acceptance does not finish (AC-AGR-1).
- **States:** validation errors. **notFound(): no.**
- **Composes:** `Input`, `Select`, `Button`. Link to P67.
- **Binding:** which of the four documents are in the **checkout** gate is REG-88, not this page. This page always takes buyer terms (R-G01).

### 5.3 Buyer

#### P09 Account — `/account`
- **v1 #9 KEPT.** FR-BUY-1, OD-2.
- **Role:** authenticated buyer.
- **Data:** `buyer_profiles` own row; `users.phone_number` read-only (R-A06); `users.deleted_at` for deactivate. No anonymize action.
- **States:** save error. **notFound(): no.**
- **Composes:** `Input`, `Select`, `ConfirmDialog`, `Button`.
- **Gap:** REG-59 (`/account` unstyled) stays open CD-DELTA-5. Do not restyle it here.

#### P10 Addresses — `/account/addresses`
- **v1 #10 KEPT.** FR-BUY-2, ERD §3.9.
- **Role:** authenticated buyer.
- **Data:** `addresses` own CRUD (`label`, `governorate`, `city`, `street_address`, `building_notes`, `is_default`).
- **States:** empty list + add CTA; save/delete error. **notFound(): no.**
- **Composes:** `AddressForm`, `EmptyState`, `ConfirmDialog`.

#### P11 Wishlist — `/wishlist`
- **v1 #11 KEPT.** FR-BUY-3, R-N06.
- **Role:** authenticated.
- **Data:** `wishlists` → `listings`, `listing_images`, `rating_aggregates`; `restock_alerts`.
- **States:** empty; tombstone for a removed listing; error retry. **notFound(): no.**
- **Composes:** `ListingCard`, `WishlistButton`, `EmptyState`, `ErrorRetryCard`.

#### P12 Following — `/account/following`
- **v1 #12 KEPT.** FR-BUY-4.
- **Role:** authenticated.
- **Data:** `store_follows` → `stores`, `seller_profiles.level`, `rating_aggregates`.
- **States:** empty; suspended store hidden. **notFound(): no.**
- **Composes:** `StoreCard`, `EmptyState`, `ErrorRetryCard`. Store-name navigation is §8 (REG-72).

#### P13 Buyer inbox — `/inbox`
- **v1 #13 AMENDED.** FR-BUY-5, FR-QTE-1.
- **Role:** authenticated buyer.
- **Data:** `inquiries` where `buyer_id` is self (`status`, `last_message_at` is unmaintained — derive order from `inquiry_messages.sent_at`, REG-43); `inquiry_messages.is_read`; `listings` and `stores` for context. **No** `converted_to_order_id` checkout CTA (v2 checkout does not write it, ERD §6.3).
- **States:** empty; error retry. **notFound(): no.**
- **Composes:** `EmptyState`, `ErrorRetryCard`, `StatusBadge`.
- **Binding:** no off-platform contact (§4.g).

#### P14 Buyer quote thread — `/inbox/[inquiryId]`
- **v1 #14 AMENDED.** FR-QTE-1, R-Q05, R-Q06, AC-QTE-4, AC-QTE-5.
- **Role:** authenticated buyer, party to the thread.
- **Data:** `inquiries` (`quoted_price`, `quoted_prep_days`, `quote_expires_at`, `status`); `inquiry_messages`; `listings.price` (the floor of the band, shown as the listing price). Accept inserts `cart_items` (`is_custom=true`, `inquiry_id`, `unit_price` = quoted price).
- **States:** declined/expired read-only; accept refused after expiry; error on send. **notFound(): yes** if not the buyer’s thread. **Guard E.**
- **Composes:** `MessageThread`, `Button`, `ErrorRetryCard`.
- **Binding:** no checkout button. No seller phone. Accept goes to #66.

#### P66 Cart — `/cart`
- **NEW.** FR-CART-1, R-C02–R-C07, AC-CART-1–7, REG-82, REG-91.
- **Role:** authenticated buyer. Guest never has rows (R-C01).
- **Data:** `cart_items` (`quantity`, `unit_price`, `is_custom`, `inquiry_id`, `listing_id`); `listings` (`title_ar`, `title_en`, `stock_qty`, `weight_g`, `status`, `store_id`); `inquiries.quote_expires_at` for custom lines; `stores` name only. Blocked is **derived** (stock or quote expiry), not a column. Delivery figure is the REG-91 projection, not a `cart_items` column and not `store_pickup_addresses`.
- **States:** empty cart; blocked line named in the error; custom line dropped after restore with a request-a-new-quote prompt (REG-82); error retry. **notFound(): no.**
- **Composes:** `EmptyState`, `ErrorRetryCard`, `Button`, `ConfirmDialog` for remove. **Gap:** cart line (§8). Do not reuse `ListingCard` as a qty line.
- **Binding:** running subtotal, one delivery figure, one total (R-C03, AC-CHK-6). No per-seller fee. No commission. Phone gate not encoded (REG-79).

#### P15 Checkout — `/checkout`
- **v1 #15 AMENDED.** FR-CHK-1, FR-PAY-1, FR-AGR-1, FR-COU-1, FR-COM-1, R-O11–R-O16, R-G02, AC-CHK-1–6, AC-PAY-1, AC-PAY-2, AC-AGR-2, REG-88, REG-89, REG-91, AC-AUTH-4.
- **Role:** authenticated buyer. Verified phone **holds** on this surface.
- **Data:** reads `cart_items` and the same joins as #66. Reads own `addresses`. Reads `agreement_acceptances` for the current versions. Writes, all or nothing: `master_orders` (`buyer_id`, `betk_ref`, `delivery_address_id`, recipient snapshot columns, `combined_delivery_total`, `payment_deadline`), N `seller_orders`, N `order_items`, N `shipments`, 2 `payments` per seller order. Stock decrement is part of that write (R-L05). **Does not read** a confirmed `inquiries.status`.
- **States:** blocked line refuses checkout (AC-CHK-3); version gate blocks completion until acceptance (AC-CHK-4) — the **set** of documents is **OPEN REG-88**, so the panel lists the four R-G05 documents as available and does not hard-code which subset blocks; phone missing → #6 (held); no address → inline add via `AddressForm`; place-order failure leaves no partial master. **notFound(): no.**
- **Composes:** `AddressForm`, `Button`, `ConfirmDialog`. **Gaps:** checkout seller sections, agreement panel (§8).
- **Binding:** one master, N seller **sections** (items only), **one** combined delivery total, one order total, deposit = 50% of (subtotal + combined delivery). No delivery-mode picker. No commission line. Rounding of the single transfer across children is **REG-89 OPEN** — the page shows the master 50% and does not encode an allocation. Buyer does not see seller pickup street (AC-VIS-2).

#### P16 Payment instructions — `/checkout/confirmation/[masterId]`
- **v1 #16 AMENDED.** FR-BUY-7, FR-PAY-1, R-O15, R-O18, R-O21, R-O22, AC-PAY-1, AC-PAY-3, AC-PAY-6, N22.
- **Role:** the master buyer.
- **Data:** `master_orders` (`betk_ref`, `combined_delivery_total`, `proof_path`, `transfer_reference`, `proof_uploaded_at`, `payment_deadline`); `admin_settings.betk_instapay_handle` only (REG-69 literal key). Child `payments.proof_path` is written at admin verification, not by this page. Proof file goes to the buyer’s own prefix in the `docs` bucket (`storage.objects`). Seller has no page that reads that object (§9).
- **States:** instructions always reachable from #18; upload error; window expired → explain restore (REG-82) and link #66. **notFound(): yes** if not the buyer’s master. **Guard E.**
- **Composes:** `ImageUploader`, `Button`, `ErrorRetryCard`.
- **Binding:** InstaPay only. No Vodafone/Orange buyer rails. No seller handles. One proof. Cancel offered only before proof upload (AC-PAY-6).

#### P17 Order history — `/orders`
- **v1 #17 AMENDED.** FR-BUY-8, AC-CLO-2.
- **Role:** authenticated buyer.
- **Data:** `master_orders` (`betk_ref`, `created_at`, `combined_delivery_total`); child `seller_orders.status` to derive the master aggregate (no status column on the master, ERD §6.1). Preview from `order_items`.
- **States:** empty; filter empty; error retry. **notFound(): no.**
- **Composes:** `StatusBadge`, `EmptyState`, `ErrorRetryCard`, `Tabs`.

#### P18 Master order — `/orders/[masterId]`
- **v1 #18 AMENDED.** FR-BUY-9, FR-VIS-1, FR-PAY-2, REG-83, REG-84, R-O03, R-O22, AC-CLO-2, AC-VIS-2.
- **Role:** the master buyer.
- **Data:** `master_orders` (buyer snapshot columns — this buyer typed them — and `combined_delivery_total` **once**); child `seller_orders` (`status`, `subtotal`, `display_ref`) — **do not render** each child’s `delivery_fee` (R-O28); `order_items`; `payments` for this buyer (deposit + balance status per seller order); `order_status_history`; `order_messages`; whether a `reviews` / `disputes` / `returns` row exists per seller order. **Do not render** any seller pickup street (`store_pickup_addresses` buyer SELECT is none).
- **States:** no messages → empty thread prompt. **No** pickup/remote empty shipment state (§2.2). Error retry. **notFound(): yes** if not own. **Guard E.**
- **Composes:** `OrderTimeline`, `StatusBadge`, `MessageThread`, `Button`.
- **Binding:** sections per seller order. Review entry on the section → #19 (REG-83). Dispute entry on the section → #20 (REG-84). Return entry on the section → #71, only when that child is `delivered`. Cancel only before proof. No close button. No master-level dispute. Tracking events are buyer-readable via `shipment_tracking_events`; the seller is not the actor who writes them.

#### P19 Review — `/orders/[masterId]/[sellerOrderId]/review`
- **v1 #19 AMENDED.** FR-BUY-10, R-R01–R-R03, R-O07, REG-83, REG-44.
- **Role:** buyer of that delivered seller order.
- **Data:** insert `reviews` (`order_id` = seller order, UNIQUE, `rating`, `body`, `store_id`); `review_photos` ≤ 3. One review per seller order. No master review.
- **States:** already reviewed → edit if inside `edit_deadline`, else read-only; not delivered → blocked error. **notFound(): yes** if the seller order is not this buyer’s. **Guard E.**
- **Composes:** `StarRating`, `ImageUploader`, `Button`.
- **Binding:** the form does not ask for a public name or a location. The published review uses `buyerLabel`.

#### P20 Raise dispute — `/orders/[masterId]/[sellerOrderId]/dispute/new`
- **v1 #20 AMENDED.** FR-BUY-11, R-D01, R-O06, REG-84.
- **Role:** buyer of that seller order.
- **Data:** insert `disputes` (`order_id` = seller order, UNIQUE, `reason`, `description`, `store_id`) and `dispute_evidence`. **Do not** offer return/refund as a dispute reason alias. Returns are #71 (`return_evidence`, not `dispute_evidence`, N25).
- **States:** ineligible status → blocked error; existing dispute → go to #21. **notFound(): yes** if not own. **Guard E.**
- **Composes:** `Select`, `Textarea`, `ImageUploader`, `Button`.

#### P21 Buyer dispute — `/disputes/[id]`
- **v1 #21 KEPT.** FR-BUY-12, R-D04.
- **Role:** the dispute’s buyer.
- **Data:** `disputes`, `dispute_evidence`, `dispute_messages`, seller-order summary (`display_ref` or master `betk_ref` for the buyer’s own master — the buyer may see their master ref). Resolution and `resolution_notes`.
- **States:** no messages yet; resolved → read-only thread. **notFound(): yes** if not own. **Guard E.**
- **Composes:** `MessageThread`, `StatusBadge`, `SLABadge`, `ErrorRetryCard`.

#### P71 Return request — `/orders/[masterId]/[sellerOrderId]/return`
- **NEW.** FR-RET-1, R-U01, R-U02, AC-RET-1, AC-RET-2.
- **Role:** buyer of that seller order.
- **Data:** insert `returns` (`seller_order_id`, `buyer_id`, `store_id`, `reason`, `status='requested'`) and `return_evidence.storage_path`. Evidence is dedicated. A dispute photo does not count.
- **States:** not delivered → blocked (AC-RET-1); no evidence → refused; submit error. **notFound(): yes** if not own. **Guard E.**
- **Composes:** `Textarea`, `ImageUploader`, `Button`.
- **Binding:** success goes to #72. No buyer name field. Stock is not a control on this page (R-U05).

#### P72 Buyer return — `/returns/[id]`
- **NEW.** FR-RET-1, R-U03.
- **Role:** the return’s buyer.
- **Data:** `returns` (`reason`, `status`, `created_at`, `resolved_at`); `return_evidence`; linked seller-order ref. Seller decision and any later dispute id (`disputes.return_id`) as a link to #21 when present.
- **States:** waiting on seller; accepted; rejected → dispute link. **notFound(): yes** if not own. **Guard E.**
- **Composes:** `StatusBadge`, `EmptyState`, `ErrorRetryCard`.

#### P22 Notifications — `/notifications`
- **v1 #22 KEPT.** FR-BUY-13, R-N07, R-N08, R-F05.
- **Role:** the signed-in user (buyer or seller; same pattern, own rows).
- **Data:** `notifications` (`type`, `channel`, `title`, `body`, `data`, `is_read`, `read_at`).
- **States:** empty; stale deep link → fallback copy; error retry. **notFound(): no.**
- **Composes:** `EmptyState`, `ErrorRetryCard`. Bell dropdown is not a page.
- **Binding:** SMS is the launch channel (R-N07). WhatsApp is not a conversation. SLA reminders and breach notices arrive here; they are not their own routes.

### 5.4 Seller

Seller pages P23–P47 are the §6 proof set. Each one obeys §4.a even when it shows no order.

#### P23 Onboarding — `/seller/onboarding`
- **v1 #23 AMENDED.** FR-SEL-1, FR-CAT-1, R-L20, R-S10, R-G04, AC-AGR-3, AC-AUTH-4, FR-COU-1 (pickup, not modes).
- **Role:** authenticated user becoming a seller. Verified phone **holds**.
- **Data:** `seller_profiles`; `stores` (name, bio, slug, public `governorate`/`city`); `store_pickup_addresses` (the pickup street — this seller’s own row); `store_categories` up to the `admin_settings` category limit (default 3, R-M07) — the cap is the setting, not a hardcoded CHECK; `seller_documents` national id, plus food types and `food_social_url` when a food category is selected (R-S10; the URL is admin-only via document policy, not a public profile column); `agreement_acceptances` seller agreement; `categories` picker.
- **States:** slug taken; missing settlement handle later blocks publish (the handle itself is #29); resume wizard. **notFound(): no.** Stepper is one route.
- **Composes:** `Stepper`, `Input`, `ImageUploader`, `Select`, `Button`. Link to P68.
- **Binding:** delivery-mode toggles are absent. Categories are the store-category surface (max 3). Agreement e-sign is required before submit (AC-AGR-3).

#### P24 Application status — `/seller/status`
- **v1 #24 KEPT.** FR-SEL-2, R-S08.
- **Role:** seller whose `seller_profiles.status` is not active.
- **Data:** `seller_profiles.status`, `rejected_reason`, `submitted_at`; `seller_documents` for resubmit.
- **States:** pending; rejected with resubmit; suspended. **notFound(): no.**
- **Composes:** `StatusBadge`, `ImageUploader`, `Button`, `ErrorRetryCard`.

#### P25 Dashboard — `/seller`
- **v1 #25 AMENDED.** FR-SEL-3, FR-SLA-1, REG-90, §9 `revenue_egp`.
- **Role:** active seller.
- **Data:** `seller_snapshots` (`profile_views`, `listing_views`, `inquiries_received`, `orders_confirmed`). **`revenue_egp` is not rendered** until §9 closes. `rating_aggregates`; `seller_profiles` (`level`, `level_score`, `avg_response_hours`); recent `seller_orders` on the §4.a allow-list only; low stock derived from `listings.stock_qty` and `low_stock_threshold` (OD-1).
- **States:** no listings yet → empty CTA; per-widget error. **notFound(): no.**
- **Composes:** `LevelBadge`, `RatingSummary`, `EmptyState`, `ErrorRetryCard`. **Gap:** seller money trio (§8) for any order row.
- **Binding:** no acceptance queue. No buyer column. No fee. No order total.

#### P26 Store profile — `/seller/store`
- **v1 #26 KEPT.** FR-SEL-4, R-S03.
- **Role:** seller.
- **Data:** `stores` (`name_ar`, `name_en`, `bio_ar`, `avatar_url`, `cover_url`, `slug`, `slug_changed_at`, public `governorate`, `city`, `min_order_egp`). Approved `store_categories` **read-only** (writes are #23 / admin approval).
- **States:** slug locked. **notFound(): no.**
- **Composes:** `Input`, `ImageUploader`, `Button`.

#### P27 Pickup address — `/seller/store/delivery`
- **v1 #27 AMENDED.** FR-SEL-5, R-K05, R-V03.
- **Role:** seller.
- **Data:** `store_pickup_addresses` (`governorate`, `city`, `street_address`, `building_notes`). Do not write `stores.delivery_options`. Do not offer mode toggles.
- **States:** save error. **notFound(): no.**
- **Composes:** `AddressForm` only if its fields match this table; otherwise `Input` + `Select`. A mismatch is not a restyle — map fields at the composition boundary.
- **Binding:** this address is never shown to buyers.

#### P28 Store return policy — `/seller/store/returns`
- **v1 #28 KEPT.** FR-SEL-6. **OPEN REG-85.**
- **Role:** seller.
- **Data:** `stores.return_policy` text. Rendered on #5. Do not decide its relationship to P69.
- **States:** null allowed; save error. **notFound(): no.**
- **Composes:** `Textarea`, `Button`.

#### P29 Settlement — `/seller/store/payments`
- **v1 #29 KEPT.** FR-SEL-7, R-S09.
- **Role:** seller.
- **Data:** `stores.payment_methods` (`instapay_handle`, `vodafone_cash`, `orange_cash`). `cod_enabled` stays dead (REG-63) and is not a publish gate. These are BETK→seller settlement destinations.
- **States:** empty warning until one handle exists. **notFound(): no.**
- **Composes:** `Input`, `Button`.

#### P30 Listings — `/seller/listings`
- **v1 #30 KEPT.** FR-SEL-8, R-L10.
- **Role:** seller.
- **Data:** own `listings` (`title_ar`, `price`, `stock_qty`, `status`, `view_count`, `deleted_at`); `listing_images` hero.
- **States:** empty CTA; error retry. **notFound(): no.**
- **Composes:** `StatusBadge`, `EmptyState`, `Tabs`, `ConfirmDialog`. **Gap:** data table (§8).

#### P31 Create listing — `/seller/listings/new`
- **v1 #31 AMENDED.** FR-SEL-9, FR-CAT-1, AC-CAT-1–6, R-L16–R-L22, R-S09.
- **Role:** seller.
- **Data:** insert `listings` (`type='product'` only, `price_type='fixed'`, `price`, `title_ar`, `title_en`, `description_ar`, `category_id` ∈ approved `store_categories`, `weight_g`, `length_mm`, `width_mm`, `height_mm`, `specs`, `prep_days`, `stock_qty`, `is_made_to_order`, `low_stock_threshold`); `listing_images`; `listing_tags`. Service publish refused. Prep above the cap refused. Price outside the band refused. The band keys are admin settings, not shown as a seller-editable rate.
- **States:** draft skips publish checks; publish checklist inline. **notFound(): no.**
- **Composes:** `Input`, `Textarea`, `Select`, `ImageUploader`, `PriceBlock`, `Button`.

#### P32 Edit listing — `/seller/listings/[id]/edit`
- **v1 #32 AMENDED.** Same PRD and data as P31, update path.
- **Role:** owning seller.
- **States:** same checklist. **notFound(): yes** if not this store’s listing. **Guard E.**
- **Composes:** same as P31.

#### P33 Inventory — `/seller/inventory`
- **v1 #33 AMENDED.** FR-SEL-10, FR-STK-1, AC-STK-5, OD-1, R-L07.
- **Role:** seller.
- **Data:** `listings.stock_qty`, `low_stock_threshold`, `is_made_to_order`, `status`, `stock_touched_at`. Restock is the seller’s R-L07 act. No `inventory_alerts` table. Waiting buyers are a count of `restock_alerts`, not their identities.
- **States:** no tracked products → empty. **notFound(): no.**
- **Composes:** `StockBadge`, `Input`, `Button`, `EmptyState`. **Gap:** data table (§8).

#### P34 Boost listing — `/seller/listings/[id]/boost`
- **v1 #34 KEPT.** FR-SEL-11, R-B01, R-B02, REG-80. Not expanded.
- **Role:** seller.
- **Data:** `boost_packages` (`duration_hours`, `price_egp`, `is_active`); insert `boosts` (`listing_id`, `store_id`, `package_id`, `payment_method`, `amount_paid`, `status='pending_payment'`).
- **States:** active boost already → blocked. **notFound(): yes** if not own listing. **Guard E.**
- **Composes:** `Button`, `ErrorRetryCard`.
- **Binding:** v1 package copy stands. This is the seller’s own boost payment, not an order fee. Do not add fields.

#### P35 Boost history — `/seller/boosts`
- **v1 #35 KEPT.** FR-SEL-12, R-B05, REG-80.
- **Role:** seller.
- **Data:** own `boosts` (`status`, `starts_at`, `expires_at`, `views_during_boost`, `amount_paid`); `boost_packages`; `listings` title.
- **States:** empty. **notFound(): no.**
- **Composes:** `StatusBadge`, `EmptyState`, `ErrorRetryCard`.

#### P36 Seller inbox — `/seller/inbox`
- **v1 #36 AMENDED.** FR-SEL-13, FR-QTE-1, R-V02.
- **Role:** seller.
- **Data:** `inquiries` for `store_id = my_store_id()` (`status`, `quoted_at`); `inquiry_messages`; `listings` title. **No buyer name.** Label is `buyerLabel`. Do not join `buyer_id`.
- **States:** empty. **notFound(): no.**
- **Composes:** `StatusBadge`, `EmptyState`. No confirm-order action.

#### P37 Seller quote — `/seller/inbox/[inquiryId]`
- **v1 #37 AMENDED.** FR-QTE-1, R-Q02–R-Q04, R-Q07, AC-QTE-2, AC-QTE-3.
- **Role:** the store on the inquiry.
- **Data:** update `inquiries.quoted_price`, `quoted_prep_days`, `quote_expires_at`, `quoted_at`. Band is `[listings.price, ceiling]` with ceiling from admin settings (default 2×). Quote below the listing price or above the ceiling is refused. Prep is required. `inquiry_messages` body. Sender label `buyerLabel`.
- **States:** send error; band error inline. **notFound(): yes** if not this store. **Guard E.**
- **Composes:** `MessageThread`, `Input`, `Button`.
- **Binding:** no checkout-enable control. No buyer phone, address, city, or governorate. The quoted price is a goods price, not a delivery fee.

#### P38 Seller orders — `/seller/orders`
- **v1 #38 AMENDED.** FR-SEL-14, FR-VIS-1, FR-SLA-1, REG-90, AC-VIS-1, AC-VIS-4.
- **Role:** seller.
- **Data:** own `seller_orders` on the §4.a allow-list; `order_items` preview. **Deny-list enforced.** No accept action. No `payments` columns.
- **States:** empty. **notFound(): no.**
- **Composes:** `StatusBadge`, `EmptyState`. **Gaps:** data table, seller money trio (§8).
- **Binding:** columns on screen are order ref, items, prep deadline, subtotal, commission, net. Nothing else about the buyer or the fee.

#### P39 Seller order — `/seller/orders/[id]`
- **v1 #39 AMENDED.** FR-SEL-15, FR-ESC-1, FR-SLA-1, FR-RET-1, R-E01–R-E03, R-U03, R-K07, AC-ESC-1, AC-ESC-2, AC-COU-4, AC-VIS-1.
- **Role:** the store on that seller order.
- **Data:** §4.a allow-list; `order_items`; `order_messages` with `buyerLabel`; `order_status_history`; `returns` for this seller order (`status`, `reason`) and `return_evidence` (seller may accept or reject — R-U03); escalation columns the seller may set: `escalated_at`, `escalation_reason`, `escalation_note`. Seller status writes are only `preparing` and `ready`.
- **States:** no messages → empty prompt; cancel attempt → refused inline (AC-ESC-1). **notFound(): yes** if not this store. **Guard E.**
- **Composes:** `OrderTimeline`, `StatusBadge`, `MessageThread`, `Button`, `ConfirmDialog`, `Textarea`. **Gap:** seller money trio (§8).
- **Binding:** no buyer name, phone, address, city, governorate. No `delivery_fee`, no `total_amount`. No shipment panel and no tracking writer (`shipments` seller SELECT is none). The page shows the order ref and tells the seller to write that ref on the box (R-K07). It does not render the courier label. No sibling seller orders (R-V04: do not read other rows, and do not join `master_orders`). Return reject creates a dispute path for admin; it does not show the buyer. **Do not render `refunded_amount`** (§9).

#### P40 Seller reviews — `/seller/reviews`
- **v1 #40 AMENDED.** FR-SEL-16, R-R04, REG-44, REG-83.
- **Role:** seller.
- **Data:** `reviews` for the store (`rating`, `body`, `seller_reply`, `is_visible`); `review_photos`; `rating_aggregates`. Reply once. **No buyer name, no buyer location, no governorate.**
- **States:** empty; already replied → read-only. **notFound(): no.**
- **Composes:** `StarRating`, `RatingSummary`, `Textarea`, `Button`, `EmptyState`.

#### P41 Earnings — `/seller/earnings`
- **v1 #41 AMENDED.** FR-SEL-17, FR-CLO-1, R-O26, R-O29, AC-CLO-3, REG-90, REG-86.
- **Role:** seller.
- **Data:** derived from own `seller_orders` (`subtotal`, `commission_amount`, `confirmed_at`, `balance_confirmed_at`, `delivered_at`, `payout_eligible_at`) and own `payouts`. Eligible display uses subtotal − commission for seller orders whose `payout_eligible_at` has passed and whose balance is confirmed, minus `payouts` in `processed`. **Do not read `payments`.** **Do not read `return_hold_hours`** (admin-only, REG-86). **Do not render `revenue_egp`.** **Do not subtract `refunded_amount`** while §9 is open — say the refund adjustment is not on this screen yet, do not invent a second figure.
- **States:** no earnings → empty; per-widget error. **notFound(): no.**
- **Composes:** `EmptyState`, `ErrorRetryCard`. **Gap:** seller money trio (§8).
- **Binding:** subtotal, commission, net. No fee. No order total. No close control.

#### P42 Transactions — `/seller/transactions`
- **v1 #42 AMENDED.** FR-SEL-18, REG-90.
- **Role:** seller.
- **Data:** one row per own `seller_orders`: ref, `subtotal`, `commission_amount`, net, `status`, `confirmed_at`, `balance_confirmed_at`. Not `payments.amount`, not `payment_type`, not `delivery_fee`, not `total_amount`.
- **States:** empty; error retry. **notFound(): no.**
- **Composes:** `StatusBadge`, `EmptyState`. **Gaps:** data table, seller money trio (§8).

#### P43 Payout list — `/seller/payouts`
- **v1 #43 AMENDED.** FR-SEL-19, R-O09, R-O10, REG-90.
- **Role:** seller.
- **Data:** own `payouts` (`amount`, `method`, `status`, `rejection_reason`, `requested_at`). The available figure is the same derived net as #41.
- **States:** empty. **notFound(): no.**
- **Composes:** `StatusBadge`, `EmptyState`. **Gap:** seller money trio for the available figure (§8).

#### P44 Request payout — `/seller/payouts/new`
- **v1 #44 AMENDED.** FR-SEL-19, R-O09, AC-AUTH-4.
- **Role:** seller. Verified phone **holds**.
- **Data:** insert `payouts` (`amount` ≥ `min_payout_egp`, `method`, `account_details`). Amount cannot exceed the derived net from #41.
- **States:** below minimum → inline; submit error. **notFound(): no.**
- **Composes:** `Input`, `Select`, `Button`.
- **Binding:** `payouts.amount` is the number the seller types. It is not a delivery fee. The cap it is checked against must stay fee-free (§4.a net).

#### P45 Level — `/seller/level`
- **v1 #45 KEPT.** FR-SEL-20, R-S06.
- **Role:** seller.
- **Data:** `seller_profiles` (`level`, `level_score`, `total_orders_completed`, `total_reviews_count`, `avg_response_hours`); `rating_aggregates.average_rating`.
- **States:** new seller at bronze. **notFound(): no.**
- **Composes:** `LevelBadge`, `ErrorRetryCard`.

#### P46 Analytics — `/seller/analytics`
- **v1 #46 AMENDED.** FR-SEL-21, REG-80 boost clause retained, REG-90.
- **Role:** seller.
- **Data:** `seller_snapshots` (`profile_views`, `listing_views`, `inquiries_received`, `orders_confirmed`, `snapshot_date`). **Omit `revenue_egp`** (§9). `boosts.views_during_boost` for the retained boost ROI clause. Do not chart `total_amount`.
- **States:** no snapshots yet → empty. **notFound(): no.**
- **Composes:** `EmptyState`, `ErrorRetryCard`. Charts are composition of existing layout, not a new visual spec. If a chart component is required, it is §8 only when the kit cannot draw a series — **flagged** as ChartSeries in §8 because the kit has none.

#### P47 Seller dispute — `/seller/disputes/[id]`
- **v1 #47 AMENDED.** FR-SEL-22, R-V02, REG-84, REG-44 if a review is linked.
- **Role:** the store on the dispute.
- **Data:** `disputes`, `dispute_evidence`, `dispute_messages`, seller-order allow-list for the linked order. Sender label `buyerLabel`. Admin resolution is read-only.
- **States:** awaiting seller; resolved → read-only. **notFound(): yes** if not this store. **Guard E.**
- **Composes:** `MessageThread`, `StatusBadge`, `SLABadge`.
- **Binding:** no buyer name, phone, address, city. No fee, no order total on the linked summary.

### 5.5 Admin

Admin may see buyer identity and both fees (R-V01, journeys §5.5). That permission does not leak onto seller pages.

#### P48 Admin dashboard — `/admin`
- **v1 #48 KEPT.** FR-ADM-1.
- **Role:** admin.
- **Data:** `platform_snapshots`; live counts `seller_profiles` pending, `disputes` near `sla_deadline`, `flagged_content` pending, seller orders with `escalated_at` set and `escalation_resolved_at` null (link to #75).
- **States:** no snapshot yet; per-widget error. **notFound(): no.**
- **Composes:** `SLABadge`, `ErrorRetryCard`, `EmptyState`.

#### P49 Seller approvals — `/admin/sellers/approvals`
- **v1 #49 AMENDED.** FR-ADM-2, R-S10, R-M01.
- **Role:** admin.
- **Data:** `seller_profiles` pending; `stores`; `seller_documents` including food types; `store_categories`; `agreement_acceptances` seller agreement; `store_pickup_addresses` so approval can see the pickup. Signed URLs for documents. Writes `moderation_logs`.
- **States:** empty queue; signed-URL error. **notFound(): no** on the queue. A missing application inside a drawer is an error, not a new route.
- **Composes:** `SLABadge`, `ImageUploader` is the wrong tool for a signed view — use a read-only preview. **Gap:** document viewer (§8) if the kit cannot show a signed image without upload chrome.
- **Binding:** `food_social_url` stays on this admin surface only.

#### P50 Users — `/admin/users`
- **v1 #50 KEPT.** FR-ADM-3, R-M03, R-M04.
- **Role:** admin.
- **Data:** `users`; `seller_profiles`; `seller_strikes`; `moderation_logs`.
- **States:** filter empty. **notFound(): no.**
- **Composes:** `ConfirmDialog`, `StatusBadge`. **Gap:** data table (§8).

#### P51 Listings moderation — `/admin/listings`
- **v1 #51 KEPT.** FR-ADM-4, R-L10.
- **Role:** admin.
- **Data:** all `listings`; `flagged_content`; `moderation_logs`.
- **States:** filter empty. **notFound(): no.**
- **Composes:** `StatusBadge`. **Gap:** data table (§8).

#### P52 Flags — `/admin/moderation/flags`
- **v1 #52 KEPT.** FR-ADM-5, R-M05, R-M06.
- **Role:** admin.
- **Data:** `flagged_content`; resolved `listings` or `reviews` by `content_id`. Review content still has no buyer name (REG-44).
- **States:** empty “queue is clear”. **notFound(): no.**
- **Composes:** `SLABadge`, `EmptyState`.

#### P53 Review moderation — `/admin/reviews`
- **v1 #53 AMENDED.** FR-ADM-6, R-R06, REG-44.
- **Role:** admin.
- **Data:** `reviews` (`admin_verified`, `is_visible`, `rating`, `body`); `review_photos`. Identity of the author is **not** rendered. Moderate the text and photos. The user record stays on #50.
- **States:** empty. **notFound(): no.**
- **Composes:** `StarRating`, `Button`.

#### P54 Categories — `/admin/categories`
- **v1 #54 KEPT.** FR-ADM-7.
- **Role:** admin.
- **Data:** `categories` CRUD.
- **States:** empty seed prompt; slug collision. **notFound(): no.**
- **Composes:** `Input`, `Button`.

#### P55 Admin orders — `/admin/orders`
- **v1 #55 AMENDED.** FR-ADM-8, R-V01, AC-VIS-3. Detail is a **drawer**, one route.
- **Role:** admin.
- **Data:** `master_orders` including recipient snapshot and `combined_delivery_total`; child `seller_orders` including `delivery_fee` and `total_amount` (admin may see both); `order_items`; `payments`; `order_status_history`; `shipments`; `store_pickup_addresses`.
- **States:** filter empty. **notFound(): no** (unknown id inside the drawer is an inline error).
- **Composes:** `StatusBadge`, `OrderTimeline`. **Gap:** data table (§8).
- **Binding:** this is where per-seller fees are visible. Do not reuse this drawer on a seller route.

#### P56 Admin disputes — `/admin/disputes`
- **v1 #56 AMENDED.** FR-ADM-9, REG-84.
- **Role:** admin.
- **Data:** `disputes` queue (`reason`, `status`, `sla_deadline`, `assigned_to`). Each row is one seller order.
- **States:** empty. **notFound(): no.**
- **Composes:** `SLABadge`, `EmptyState`. **Gap:** data table (§8).

#### P57 Admin dispute detail — `/admin/disputes/[id]`
- **v1 #57 AMENDED.** FR-ADM-9, AC-ADM-9, R-U04, R-D03.
- **Role:** admin.
- **Data:** `disputes`, `dispute_evidence`, `dispute_messages`, `seller_orders`, `payments` for refund context, `moderation_logs`. Refund is full or partial **for that seller order**.
- **States:** resolution error. **notFound(): yes** if the id does not exist. **Guard E.**
- **Composes:** `MessageThread`, `SLABadge`, `Select`, `Textarea`, `ConfirmDialog`.

#### P58 Payments / deposit queue — `/admin/payments`
- **v1 #58 AMENDED.** FR-ADM-10, FR-ADM-18, FR-PAY-1, FR-PAY-2, R-O19, R-O20, R-O23, R-O25, AC-PAY-3–8, AC-ADM-18, AC-CLO-1.
- **Role:** admin.
- **Data:** `master_orders.proof_path` (signed URL from `storage.objects` in the `docs` bucket), `transfer_reference`, `proof_uploaded_at`; child `payments` (`payment_type`, `amount`, `status`, `method`). **One** confirm action copies the proof onto every deposit row and releases every child (`seller_orders.confirmed_at`, `prep_deadline`). Reject cancels, restores tracked stock, refunds if the transfer was taken. Separate action confirms a child’s COD balance **after** remit (`balance_confirmed_at`). **No control whose only job is “close”.**
- **States:** filter empty; illegible proof → reject path. **notFound(): no.**
- **Composes:** `Button`, `ConfirmDialog`, `StatusBadge`. **Gap:** proof viewer (§8) — admin must see the screenshot; the kit’s uploader is the wrong chrome.
- **Binding:** this is the only deposit-verification queue. Seller pages do not link to the proof object.

#### P59 Admin payouts — `/admin/payouts`
- **v1 #59 KEPT.** FR-ADM-11, R-O10, R-O27.
- **Role:** admin.
- **Data:** `payouts`. Manual process or reject. Net of commission is already in the seller’s derived balance; this page does not recompute a fee.
- **States:** empty. **notFound(): no.**
- **Composes:** `StatusBadge`, `ConfirmDialog`, `Button`.

#### P60 Collections — `/admin/collections`
- **v1 #60 KEPT.** FR-ADM-12.
- **Role:** admin.
- **Data:** `collections`.
- **States:** empty. **notFound(): no.**
- **Composes:** `EmptyState`, `Button`.

#### P61 Collection editor — `/admin/collections/[id]`
- **v1 #61 KEPT.** FR-ADM-12.
- **Role:** admin.
- **Data:** `collections`; `collection_listings`; `listings` picker.
- **States:** save error. **notFound(): yes** if missing. **Guard E.**
- **Composes:** `Input`, `Button`.

#### P62 Broadcast — `/admin/notifications`
- **v1 #62 KEPT.** FR-ADM-13, OD-3, R-N02.
- **Role:** admin.
- **Data:** fan-out `notifications`. `whatsapp_templates` for the WhatsApp channel selector. No campaign table.
- **States:** confirm before a large send. **notFound(): no.**
- **Composes:** `Select`, `Textarea`, `ConfirmDialog`, `Button`.

#### P63 Admin settings — `/admin/settings`
- **v1 #63 AMENDED.** FR-ADM-15, FR-ADM-14, FR-COU-1, R-M07, R-M08, REG-80 boost-package clause retained.
- **Role:** admin. Sensitive keys superadmin, as v1.
- **Data:** `admin_settings` keys named by R-M07 (price band, commission %, quote ceiling, quote validity, payment window, prep cap, seller category limit, return window, food requirements, low-stock default). **Not** status enums and **not** a “sellers may cancel” switch (R-M08). `whatsapp_templates` on the Notifications **tab** (not a page). `boost_packages` management stays, v1 text, not expanded. `courier_rates` (`origin_governorate`, `destination_governorate`, `weight_min_g`, `weight_max_g`, `fee_egp`) on a **Rates tab** of this same route.
- **States:** per-key validation; empty template list on the notifications tab. **notFound(): no.**
- **Composes:** `Tabs`, `Input`, `Button`. **Gap:** rate matrix editor (§8).
- **Binding:** `delivery_fee_flat_egp` is not the control that sets the buyer fee. Do not delete the key row (ERD §6.3); do not present it as the live fee.

#### P64 Moderation log — `/admin/moderation/log`
- **v1 #64 KEPT.** FR-ADM-16, R-M02.
- **Role:** admin.
- **Data:** `moderation_logs` read-only.
- **States:** empty. **notFound(): no.**
- **Composes:** `EmptyState`. **Gap:** data table (§8).

#### P65 Boost approval — `/admin/boosts`
- **v1 #65 KEPT.** FR-ADM-17, R-B02, REG-80. Not expanded.
- **Role:** admin.
- **Data:** `boosts` where `status='pending_payment'`; `boost_packages`.
- **States:** empty. **notFound(): no.**
- **Composes:** `Button`, `StatusBadge`, `EmptyState`.

#### P73 Admin returns queue — `/admin/returns`
- **NEW.** FR-RET-1, FR-ADM-9.
- **Role:** admin.
- **Data:** `returns` (`status`, `reason`, `seller_order_id`, `created_at`).
- **States:** empty queue. **notFound(): no.**
- **Composes:** `StatusBadge`, `EmptyState`. **Gap:** data table (§8).

#### P74 Admin return detail — `/admin/returns/[id]`
- **NEW.** FR-ADM-9, R-U04, AC-RET-4, N25.
- **Role:** admin.
- **Data:** `returns`; `return_evidence` (not `dispute_evidence`); linked `seller_orders`; `payments.refunded_amount` for the partial or full refund of **that** child. Sibling seller orders stay untouched.
- **States:** decision error. **notFound(): yes** if missing. **Guard E.**
- **Composes:** `Button`, `Input`, `ConfirmDialog`. **Gap:** evidence viewer (§8) — same signed-image need as proofs.

#### P75 Escalations — `/admin/escalations`
- **NEW.** FR-ADM-20, FR-ESC-1, R-E04, R-F04, AC-ESC-3–5, AC-ADM-20, AC-SLA-4.
- **Role:** admin.
- **Data:** `seller_orders` where `escalated_at` is not null (`escalation_reason`, `escalation_note`, `prep_deadline`, `escalation_resolved_at`). Resolution is one of: cancel + refund + stock rule (R-L13 zeroes stock on out-of-stock; other reasons restore), reinstate with a new `prep_deadline`, or cancel + a manual `seller_strikes` row. Strike is never automatic. One route: the resolution form is a **drawer**, not a second pattern.
- **States:** empty queue. **notFound(): no.**
- **Composes:** `Select`, `Textarea`, `ConfirmDialog`, `Button`, `EmptyState`. **Gap:** data table (§8).
- **Binding:** cancelling one child does not cancel the master (AC-ESC-3). Buyer and seller are notified (R-N08); that is not a page.

#### P76 Ready for pickup — `/admin/ready-for-pickup`
- **NEW.** FR-ADM-19, FR-COU-1, R-K07, R-K09, AC-COU-3, AC-COU-4, AC-VIS-3, REG-78.
- **Role:** admin.
- **Data:** `seller_orders` where `status='ready'`; `store_pickup_addresses`; `master_orders` recipient name, phone, and address snapshot; `shipments` admin write to mark `dispatched`. The label is rendered from those reads in the admin session (ERD §3.1). No courier user. No `SECURITY DEFINER` label function.
- **States:** empty queue. **notFound(): no.**
- **Composes:** `Button`, `StatusBadge`, `EmptyState`. **Gap:** courier label sheet (§8).
- **Binding:** the seller never opens this page and never receives the label payload. Handoff mechanism (API vs manual) stays the courier gate; this page is the admin queue either way.

#### P77 Seller performance — `/admin/sellers/[id]/performance`
- **NEW.** FR-ADM-21, AC-ADM-21, R-F04.
- **Role:** admin.
- **Data:** derived, no performance table (ERD §10.1): escalation columns, `listings.stock_touched_at`, `inquiries.quoted_at`, `reviews`, `agreement_acceptances`, `seller_documents`, `seller_strikes`, `users.last_login_at`. Stock-accuracy leads. SLA breach is visible and does not imply a strike was issued.
- **States:** thin history → empty sections, not zeros presented as measured. **notFound(): yes** if the seller id does not exist. **Guard E.**
- **Composes:** `EmptyState`, `ErrorRetryCard`.

---

## 6. Seller-page proof (N28 + REG-90)

Every seller-role pattern. “Pass” means the §5 block’s data list contains no buyer name, phone, address, city, or governorate, and does not render `delivery_fee` or `total_amount`.

| Page | Buyer identity | Delivery fee | Order total | Verdict |
|---|---|---|---|---|
| P23 Onboarding | Pickup is the **seller’s** address. No buyer fields. | Not shown. | Not shown. | Pass |
| P24 Status | None. | None. | None. | Pass |
| P25 Dashboard | Recent orders use the allow-list. No `buyer_id` render. | Not rendered. | Not rendered. | Pass |
| P26 Store profile | Store city is the store’s public city, not the buyer’s. | None. | None. | Pass |
| P27 Pickup | Seller’s own pickup. Buyer SELECT of this table is none, so buyers do not see it. | None. | None. | Pass |
| P28 Return policy | None. | None. | None. | Pass |
| P29 Settlement | Seller’s own handles. | None. | None. | Pass |
| P30–P33 Listings / inventory | None. | None. | None. | Pass |
| P34–P35 Boosts | None. `boosts.amount_paid` is the seller’s boost price, not an order fee. | None. | None. | Pass |
| P36–P37 Inbox / quote | `buyerLabel` only. No join to `buyer_profiles` or `users.phone_number`. | Quote is `quoted_price` (goods). | Not shown. | Pass |
| P38 Orders | Allow-list. | Denied. | Denied. | Pass |
| P39 Order detail | Allow-list. Messages use `buyerLabel`. No `shipments`. No label. | Denied. | Denied. | Pass |
| P40 Reviews | REG-44 neutral label. | None. | None. | Pass |
| P41 Earnings | Derived from subtotal and commission. | Denied. | Denied. | Pass |
| P42 Transactions | Seller-order subtotal, commission, net. No `payments`. | Denied. | Denied. | Pass |
| P43–P44 Payouts | `payouts.amount` is seller-entered against the fee-free net. | Denied. | Denied. | Pass |
| P45 Level | Counts and rating. | None. | None. | Pass |
| P46 Analytics | Views, inquiries, orders, boost views. `revenue_egp` omitted. | Denied. | Denied. | Pass |
| P47 Dispute | `buyerLabel`. Linked summary is the allow-list. | Denied. | Denied. | Pass |

Buyer-facing pages that must also stay clean of the **per-seller** fee and of commission: P66, P15 (one combined delivery, no commission line, no split), P16 (InstaPay deposit on the master), P17, P18 (combined delivery once). Admin P55, P58, and P76 are allowed to see the split, the proof, and the label.

---

## 7. Acceptance matrix

### 7.1 PRD FR → at least one page

| FR | Page |
|---|---|
| FR-PUB-1 | P01 |
| FR-PUB-2 | P02 |
| FR-PUB-3 | P03 |
| FR-PUB-4 | P04 |
| FR-PUB-5 | P05 |
| FR-AUTH-1 | P06 |
| FR-AUTH-2 | P07 |
| FR-AUTH-3 | P08 |
| FR-AUTH-4 | P06, P07. Trigger **OPEN REG-79**. Holds also bite on P15, P23, P44. |
| FR-BUY-1 | P09 |
| FR-BUY-2 | P10 |
| FR-BUY-3 | P11 |
| FR-BUY-4 | P12 |
| FR-BUY-5 | P13, P14 |
| FR-BUY-6 | **Superseded.** No page. Successor is P15 (FR-CHK-1). Not a gap. |
| FR-BUY-7 | P16 |
| FR-BUY-8 | P17 |
| FR-BUY-9 | P18 |
| FR-BUY-10 | P19, entry on P18 |
| FR-BUY-11 | P20 |
| FR-BUY-12 | P21 |
| FR-BUY-13 | P22 |
| FR-SEL-1 | P23 |
| FR-SEL-2 | P24 |
| FR-SEL-3 | P25 |
| FR-SEL-4 | P26 |
| FR-SEL-5 | P27 |
| FR-SEL-6 | P28 |
| FR-SEL-7 | P29 |
| FR-SEL-8 | P30 |
| FR-SEL-9 | P31, P32 |
| FR-SEL-10 | P33 |
| FR-SEL-11 | P34 |
| FR-SEL-12 | P35 |
| FR-SEL-13 | P36, P37 |
| FR-SEL-14 | P38 |
| FR-SEL-15 | P39 |
| FR-SEL-16 | P40 |
| FR-SEL-17 | P41 |
| FR-SEL-18 | P42 |
| FR-SEL-19 | P43, P44 |
| FR-SEL-20 | P45 |
| FR-SEL-21 | P46 |
| FR-SEL-22 | P47 |
| FR-ADM-1 | P48 |
| FR-ADM-2 | P49 |
| FR-ADM-3 | P50 |
| FR-ADM-4 | P51 |
| FR-ADM-5 | P52 |
| FR-ADM-6 | P53 |
| FR-ADM-7 | P54 |
| FR-ADM-8 | P55 |
| FR-ADM-9 | P56, P57, P73, P74 |
| FR-ADM-10 | P58 |
| FR-ADM-11 | P59 |
| FR-ADM-12 | P60, P61 |
| FR-ADM-13 | P62 |
| FR-ADM-14 | Tab of P63. Not a page. |
| FR-ADM-15 | P63 |
| FR-ADM-16 | P64 |
| FR-ADM-17 | P65 |
| FR-CART-1 | P66 |
| FR-CHK-1 | P15 |
| FR-PAY-1 | P16, P58 |
| FR-PAY-2 | P58, P18 (buyer sees balance status) |
| FR-ADM-18 | P58 |
| FR-QTE-1 | P04, P14, P37, P66 |
| FR-SLA-1 | P39 (deadline), P22 (reminders), P75 (breach) |
| FR-ESC-1 | P39 |
| FR-ADM-20 | P75 |
| FR-STK-1 | P33, P15, P75 |
| FR-RET-1 | P71, P72, P39, P73, P74 |
| FR-AGR-1 | P08, P15, P23, P67, P68, P69, P70 |
| FR-COU-1 | P15, P66, tab of P63, P76 |
| FR-ADM-19 | P76 |
| FR-VIS-1 | P38, P39, P18, P55, P76 |
| FR-CLO-1 | P41, P18, P58 (no close control) |
| FR-COM-1 | P15 (hidden), P38, P39, P41 |
| FR-CAT-1 | P23, P31, P32 |
| FR-ADM-21 | P77 |

No FR with a UI surface is unmapped. FR-BUY-6 is superseded, not missing.

### 7.2 PRD AC → at least one page

| AC | Page |
|---|---|
| AC-CART-1–7 | P66. AC-CART-4 and AC-CART-5 also refuse P15. AC-CART-7 restore prompt is P66. |
| AC-CHK-1–6 | P15 |
| AC-PAY-1, AC-PAY-2, AC-PAY-6 | P16, P15 |
| AC-PAY-3, AC-PAY-4, AC-PAY-5, AC-PAY-7, AC-PAY-8 | P58 |
| AC-QTE-1 | P04 → P06 |
| AC-QTE-2, AC-QTE-3 | P37 |
| AC-QTE-4, AC-QTE-5 | P14, P66 |
| AC-QTE-6 | P66, P04 |
| AC-SLA-1, AC-SLA-2 | P39 (displays `prep_deadline`; the stamp is server-side) |
| AC-SLA-3, AC-SLA-4 | P22, P75 |
| AC-SLA-5 | P75 (no auto strike) |
| AC-ESC-1, AC-ESC-2 | P39 |
| AC-ESC-3, AC-ESC-4, AC-ESC-5 | P75 |
| AC-STK-1 | P15, P33 |
| AC-STK-2, AC-STK-5 | P33 |
| AC-STK-3 | P75, P33 |
| AC-STK-4 | P15 |
| AC-RET-1, AC-RET-2 | P71 |
| AC-RET-3 | P39, P72 |
| AC-RET-4 | P74 |
| AC-RET-5 | P33 (no stock control on P71) |
| AC-AGR-1 | P08 |
| AC-AGR-2 | P15 |
| AC-AGR-3 | P23 |
| AC-AGR-4 | P67, P68, P69, P70 |
| AC-AGR-5 | P08 vs P23 (separate `agreement_acceptances` rows) |
| AC-COU-1, AC-COU-2 | P15, P66 (one sum). Stored per-seller fee is admin-visible on P55, not seller-visible. |
| AC-COU-3, AC-COU-4 | P76, P39 (seller cannot mark dispatched) |
| AC-COU-5 | P58, P18 |
| AC-COU-6 | No courier page. P76 is admin. |
| AC-VIS-1 | P38, P39 |
| AC-VIS-2 | P18, P05, P15 |
| AC-VIS-3 | P55, P76 |
| AC-VIS-4 | P39 (no master join) |
| AC-CLO-1 | P41, P58 |
| AC-CLO-2 | P17, P18 |
| AC-CLO-3 | P41. Refund leg withheld — §9, not a silent formula. |
| AC-COM-1, AC-COM-2 | P39, P41 (snapshot already stored; page does not recompute against delivery) |
| AC-COM-3 | P15, P66 |
| AC-CAT-1–6 | P31, P32 |
| AC-AUTH-4 | P15, P23, P44. Add-to-cart **not asserted** (REG-79). |
| AC-ADM-18 | P58 |
| AC-ADM-19 | P76 |
| AC-ADM-20 | P75 |
| AC-ADM-21 | P77 |
| AC-AUTH-2 (v1, holds) | P07 |
| AC-ADM-9 (v1, holds) | P57 |
| AC-BUY-6 | **RETIRED.** No page. |
| AC-SEL-14 | **RETIRED.** No page. |

### 7.3 Page → at least one PRD code

| Pages | Code |
|---|---|
| P01 | FR-PUB-1 |
| P02 | FR-PUB-2 |
| P03 | FR-PUB-3 |
| P04 | FR-PUB-4 |
| P05 | FR-PUB-5 |
| P06 | FR-AUTH-1 |
| P07 | FR-AUTH-2 |
| P08 | FR-AUTH-3 |
| P09 | FR-BUY-1 |
| P10 | FR-BUY-2 |
| P11 | FR-BUY-3 |
| P12 | FR-BUY-4 |
| P13 | FR-BUY-5 |
| P14 | FR-QTE-1 |
| P15 | FR-CHK-1 |
| P16 | FR-BUY-7 |
| P17 | FR-BUY-8 |
| P18 | FR-BUY-9 |
| P19 | FR-BUY-10 |
| P20 | FR-BUY-11 |
| P21 | FR-BUY-12 |
| P22 | FR-BUY-13 |
| P23 | FR-SEL-1 |
| P24 | FR-SEL-2 |
| P25 | FR-SEL-3 |
| P26 | FR-SEL-4 |
| P27 | FR-SEL-5 |
| P28 | FR-SEL-6 |
| P29 | FR-SEL-7 |
| P30 | FR-SEL-8 |
| P31, P32 | FR-SEL-9 |
| P33 | FR-SEL-10 |
| P34 | FR-SEL-11 |
| P35 | FR-SEL-12 |
| P36 | FR-SEL-13 |
| P37 | FR-QTE-1 |
| P38 | FR-SEL-14 |
| P39 | FR-SEL-15 |
| P40 | FR-SEL-16 |
| P41 | FR-SEL-17 |
| P42 | FR-SEL-18 |
| P43, P44 | FR-SEL-19 |
| P45 | FR-SEL-20 |
| P46 | FR-SEL-21 |
| P47 | FR-SEL-22 |
| P48 | FR-ADM-1 |
| P49 | FR-ADM-2 |
| P50 | FR-ADM-3 |
| P51 | FR-ADM-4 |
| P52 | FR-ADM-5 |
| P53 | FR-ADM-6 |
| P54 | FR-ADM-7 |
| P55 | FR-ADM-8 |
| P56, P57 | FR-ADM-9 |
| P58 | FR-ADM-18 |
| P59 | FR-ADM-11 |
| P60, P61 | FR-ADM-12 |
| P62 | FR-ADM-13 |
| P63 | FR-ADM-15 |
| P64 | FR-ADM-16 |
| P65 | FR-ADM-17 |
| P66 | FR-CART-1 |
| P67, P68, P69, P70 | FR-AGR-1 |
| P71, P72 | FR-RET-1 |
| P73, P74 | FR-ADM-9 |
| P75 | FR-ADM-20 |
| P76 | FR-ADM-19 |
| P77 | FR-ADM-21 |

Both directions are filled. Open items in §9 are unpinned facts, not missing pages.

---

## 8. Claude Design handoff — gap list

This is input to Stage D, which is already running. It is not a design.

| Gap | Needed by | Why the kit lacks it |
|---|---|---|
| **CartLine** | P66, P15 | `ListingCard` is a discovery card. It has no quantity editor, no blocked state, and no “request a new quote” prompt. |
| **CheckoutSellerSections** | P15 | Nothing groups lines under N sellers while exposing only one combined total and hiding the per-seller fee and commission. |
| **SellerOrderMoney** | P25, P38, P39, P41, P42, P43 | `PriceBlock` renders a listing price. Nothing has slots for subtotal, commission, and net **and no slot** for a fee or an order total. A slot that exists will get filled. |
| **DataTable** | P30, P33, P38, P42, P50, P51, P55, P56, P64, P73, P75 | `components/ui` has no table. `components/shared` has no table. Admin and seller lists should not each invent one. |
| **RateMatrixEditor** | P63 Rates tab | No grid for origin × destination × weight band (`courier_rates`). |
| **CourierLabelSheet** | P76 | No print/label primitive. The payload includes buyer name, phone, and address and must be **unable** to mount on a seller route. |
| **ProofViewer** | P58, P49, P74 | `ImageUploader` is an upload control. Admin review needs a signed-URL viewer without an upload affordance. |
| **ChartSeries** | P46 | No chart primitive. Do not specify axes, colors, or chart chrome here. |
| **ShareButton** | P04, P05 | No share primitive. **Absorbs REG-51.** Channel-agnostic public-link share. Downstream apps stay unenumerated. |
| **Navigable store identity** | P01, P02, P03, P04, P05, P12 | `ListingCard`, `SellerMiniCard`, and `StoreCard` render the store name as non-interactive text and expose no `href`. **Absorbs REG-72.** |

### 8.1 CD-DELTA-5 reconciliation

| Item | Absorbed? |
|---|---|
| **REG-51** share | **Yes.** ShareButton row. |
| **REG-72** store name is not a link | **Yes.** Navigable store identity row. Same class as REG-60, but REG-60 itself is not this row. |
| **REG-58** dark search-bar contrast | **No.** Existing `SearchBar` defect. Stays open CD-DELTA-5. Not restated as a color spec. |
| **REG-59** `/account` unstyled | **No.** Existing shell defect on P09. Stays open. |
| **REG-60** seller-console logo does not navigate home | **No.** Existing chrome defect. Stays open. Not folded into REG-72. |

REG-52 (onboarding category picker UX) is also open CD-DELTA-5 and is **not** a new component in this list. P23 composes `Select` until Claude Design replaces the picker. Do not invent the picker layout here.

---

## 9. STOP-and-flags

| ID | Flag | Why it is not filled |
|---|---|---|
| **REG-90** | **CLOSED** pin. Seller sees subtotal, commission, net. Never `delivery_fee`, never `total_amount`. | Propagated to the ERD (seller read = NO) and the PRD. Implementation of the column grant is **open for B5 / Stage C**: grants are per Postgres role, and admin is also `authenticated`, so this cannot be a plain `REVOKE` from `authenticated`. |
| **REG-90 check — `seller_orders.refunded_amount`** | **FLAGGED. Not fee-free.** The column is the rollup of `payments.refunded_amount` (ERD §6.2). Deposit is 50% of (subtotal + delivery) (R-O16), so a refund of what the buyer paid can include delivery-fee money. Seller pages **do not render it**. Displayed net does **not** subtract it. | Do not add a column. B5 decides whether the seller-visible rollup is goods-only. |
| **REG-90 check — `payouts.amount`** | **Fee-free as a seller-entered number**, provided the cap is the §4.a net. | The contamination path is only `refunded_amount`, which is withheld. |
| **REG-90 check — `seller_snapshots.revenue_egp`** | **FLAGGED.** The column is seller-readable. No cron writer in the shipped snapshot jobs defines it. Platform `gmv_egp` is `SUM(total_amount)`, which **includes** `delivery_fee`. A writer that copies that pattern would leak the fee. | P25 and P46 omit the column. Do not add a table. Stage C pins the writer to subtotal − commission, or the column stays off seller screens. |
| **REG-91** | **OPEN.** Buyer cart and checkout need one combined delivery total. Buyer SELECT on `store_pickup_addresses` is none. `courier_rates` is readable by any authenticated user, so the client must not also be handed the origin. | Not a new table. `master_orders.combined_delivery_total` is the stored result at checkout. The pre-checkout projection is B5. Pages do not select the pickup row. |
| **REG-79** | **OPEN.** Gate page exists (P06, P07). Trigger vs add-to-cart is not encoded. | |
| **REG-85** | **OPEN.** P05 and P28 show store policy. Relationship to P69 is not decided. | |
| **REG-88** | **OPEN.** P15 has a version-gate panel. Which of the four documents block completion is not hard-coded. | |
| **REG-81** | **OPEN.** P38/P39 show `display_ref` only when non-null. No format invented. Legacy `betk_ref` on old rows is an order number. | |
| **REG-89** | **OPEN.** P15 shows the master 50% and does not encode child allocation. | |
| **REG-50** | Support page **not** in the 77. | |
| **storage.objects** | N28’s betk-schema proof did not cover the `docs` bucket (payment-proof screenshots, seller documents). Seller pages do not read those objects. Admin P58 and P49 do, via signed URL. | Stage C input. Not a new table in `betk`. |
| **Un-ERD’d table** | **None.** Every page’s data list is an OD-20 table. Low stock has no alert-log table (OD-1). Performance has no table (FR-ADM-21 derived). Legal prose is not a table (R-G07). | |

---

*End of v2 contract. The historical v1 spec follows and is not deleted.*

---

# Historical v1 UI spec (superseded in place — not deleted)

> **SUPERSEDED (B4, 2026-09-22).** The text below is the v1 spec. Its headline count of 59 is a heading count (60 headings minus the WhatsApp Templates tab). Measured under the v2 counting rule (§0 above) that same source is 65 route patterns. The v2 contract is §0–§9. **OD-21** freezes 77 pages and supersedes the freeze sentence in the acceptance matrix below. Do not cite this block as the v2 page inventory. Nothing in this block was deleted.
# BETK_UI_SPEC.md

> **Source & provenance note.** The uploaded corpus consists of the three BETK Architecture Review conversations: **C1 — Domain Modeling & Entity Discovery**, **C2 — ERD & Database Architecture**, and **C3 — Supabase Production Schema (SQL, RLS, pg_cron)**. No standalone *Dev OS* file and no standalone *Wireframes* file were present in the uploads. The page-by-page UI surface is nevertheless fully specified *inside* these documents as: the 70-row Use Case Coverage Matrix (C2 §6), the Actor User Journeys and Marketplace Workflows WF1–WF10 (C1 §1.3–1.4), and the explicit screen/tab references embedded in the Entity Catalog "Use Case(s)" columns (e.g. *Seller Inbox*, *Wishlist & Saved*, *Followed Sellers tab*, *Seller Dashboard*, *Level Progress*, *Store Header*, *Moderation Log tab*, *Homepage featured strip*). Every page below maps to one or more of those documented surfaces. Data requirements are cross-referenced against the physical tables, columns, enums, and RLS policies defined in C2 §3 / C3 §3–5. No page or feature has been invented; gaps in either direction are flagged inline as **[DATA GAP]** or **[UI GAP]**.
>
> *Schema count clarification:* C2/C3 label the schema "28 tables," but the detailed table specifications actually define **43 physical tables** across 13 domains (the "28" is a stale headline count). This spec validates against all 43.

---

## 1. Design System

**The visual language is defined in one place: [`BETK_DESIGN_BRIEF.md`](./BETK_DESIGN_BRIEF.md) — the LOCKED, self-contained design source.** All token *values* (all frozen tokens, light **and** dark), the type / spacing / radius / shadow scales, per-component anatomy (with default/skeleton/empty/error states, RTL-canonical + explicit LTR notes), and the logo system live there. **This spec does not duplicate value tables** — it references the brief so there is a single source. When a value or component detail is needed, read the brief; never inline a hex/HSL here.

The design system is constrained by three documented requirements: **bilingual Arabic/English** with **Arabic-first RTL as the canonical direction** and EN-LTR mirrored (G5, C1 §1.1; OD-7 — see §4 Localization & theming), a trust-forward marketplace aesthetic (G2), and a low-end Egyptian mobile-network target (C2 §7.3 — connection churn, aggressive caching; no hover-only controls). Everything must be usable in all four AR-RTL / EN-LTR × light / dark contexts.

- **Component library:** shadcn/ui (Radix primitives + Tailwind). All interactive primitives (Dialog, Sheet, DropdownMenu, Tabs, Toast, Command, Form) come from shadcn. Direction/lang derive from the `[locale]` layout (`ar → dir="rtl" lang="ar"`, `en → dir="ltr" lang="en"`); LTR islands (Latin handles, BETK refs, tracking numbers, prices, OTP) use `dir="ltr"` wrappers.
- **Styling:** Tailwind CSS (v3.3+), native logical-property utilities (`ps-*/pe-*/ms-*/me-*/start-*/end-*/rounded-s-*/rounded-e-*`) resolve correctly under both directions — **no `tailwindcss-rtl` plugin, no raw `left/right`** in shared components.
- **Tokens & scales:** see `BETK_DESIGN_BRIEF.md §2` (color tokens, light + dark; frozen names) and `§3` (type / spacing / radius / shadow). Token names are FROZEN (`tailwind.config.ts` + shared components + DS-I18N wiring depend on them).
- **Status-to-color mapping** is centralized (see §4 `StatusBadge` and `constants/statusColors.ts`) so the order/seller/dispute/payment enums from C3 §2 render consistently everywhere; the per-enum tints are recorded in `BETK_DESIGN_BRIEF.md §5.5`.

---

## 2. Navigation Structure

### Top-level routes

```
/                         Homepage (public)
/search                   Search & filter results (public)
/category/[slug]          Category browse (public)
/listing/[id]             Listing detail (public)
/store/[slug]             Public storefront (public)
/auth/login               Phone entry (public)
/auth/verify              OTP verification (public)
/auth/register            Complete buyer profile (public, mid-auth)
/account, /wishlist, /orders, /inbox, /notifications, /checkout, /disputes/[id]   Buyer (protected)
/seller/**                Seller console (role: seller)
/admin/**                 Admin console (role: admin | superadmin)
```

### Auth gates

Gates map directly to C3 §5 RLS. Four levels:

- **public** — no session. RLS allows `SELECT` where `status='active'` (stores, listings, categories), `is_visible=TRUE` (reviews), `status='live'` (collections). Guest can read but cannot write (no wishlist, no inquiry, no checkout — C1 Guest journey).
- **protected** — any authenticated user (`auth.uid()` present). Buyer self-scoped tables: `buyer_profiles`, `addresses`, `wishlists`, `notifications`, own `orders/inquiries/disputes`.
- **role: seller** — `users.role='seller'` AND `seller_profiles.status` gate. Store-scoped data resolved via `betk.my_store_id()`. A `pending` seller is routed to `/seller/status`, not the dashboard (R-S04).
- **role: admin** — `betk.is_admin()` (`role IN ('admin','superadmin') AND status='active'`). Admin bypasses row scoping on all tables.

Suspended/banned users (`users.status`) are blocked at the gate on every authenticated request (R-A05).

### Navigation patterns

- **Public + Buyer:** sticky **topbar** (logo → `/`, full-width search, category menu, notifications bell, account menu / "Login") + **mobile bottom nav** (Home · Search · Wishlist · Inbox · Account). RTL: logo on the right, account cluster on the left.
- **Seller console:** persistent **left sidebar** (Dashboard, Listings, Inbox, Orders, Reviews, Earnings, Boosts, Analytics, Store Settings) collapsing to a Sheet on mobile; topbar shows store avatar, level badge, payout balance.
- **Admin console:** persistent **left sidebar** grouped (Overview · Moderation · Catalog · Commerce · Content · System) collapsing to a Sheet on mobile; topbar shows SLA alert counters (seller-approval 24h, dispute 48h, flagged-content 24h).

---

## 3. Pages

Pages are grouped by surface area. Every page lists its documenting use case(s) and validates data needs against C2/C3 tables.

---

### — PUBLIC / GUEST —

### Homepage
- **Route:** `/`
- **Auth gate:** public
- **Layout:** PublicShell (topbar + bottom nav)
- **Use case(s):** Browse Homepage; Homepage featured strip (WF3)
- **Components:** Hero/search bar, `CategoryGrid` (icon tiles), `CollectionStrip` (one horizontal carousel per live collection, ordered by `homepage_position`), `ListingCard` grids for "New Arrivals" and "Featured/Boosted", `StoreCard` row for featured stores, footer.
- **Data requirements:** `collections` (status='live', ordered by `homepage_position`) → `collection_listings` (sort_order) → `listings`; `categories` (is_active, sort_order, icon_url); `listings` (status='active', `deleted_at IS NULL`, ordered `created_at DESC` for new arrivals); boosted set = `boosts` (status='active') joined to `listings`; `listing_images` (sort_order=0 hero); `rating_aggregates` (average_rating, total_reviews) per store on each card; `stores` (name_ar, avatar_url, level badge via `seller_profiles.level`). Cache: collections/new-arrivals 60s TTL, rating_aggregates 5-min TTL (C2 §7.3).
- **User flows:** Happy — guest lands, scrolls collections/categories, taps a `ListingCard` → `/listing/[id]`. Edge — tap wishlist on a card while unauthenticated → redirect to `/auth/login` with return URL.
- **Empty state:** No live collections → fall back to pure "New Arrivals" grid; if zero active listings platform-wide → friendly "BETK is just getting started" panel with a Become-a-Seller CTA.
- **Loading state:** Skeleton — category tiles as muted circles, two skeleton carousels (4 card skeletons each), new-arrivals grid skeleton (8 cards). Progressive: render collections as each resolves.
- **Error state:** Section-level inline retry card per failed strip (homepage never hard-fails as a whole); topbar toast on total fetch failure.

### Search & Filter Results
- **Route:** `/search?q=&category=&governorate=&city=&type=&price_min=&price_max=&sort=`
- **Auth gate:** public
- **Layout:** PublicShell
- **Use case(s):** Search Listings, Filter Listings (WF3)
- **Components:** `SearchBar` (1–2 keyword, C2 decision), `FilterSheet`/sidebar (category tree, type product|service, governorate, city, price range, sort), active-filter chips, `ListingCard` grid, sort dropdown (relevance, newest, price, popularity), pagination/infinite scroll, boosted-results banner at top of relevant category.
- **Data requirements:** `listings.search_vector` (tsvector, GIN, `unaccent` for Arabic) filtered by `status='active' AND deleted_at IS NULL`; `categories` for the filter tree (self-referential `parent_id`); `stores.governorate/city` for location filter; price on `listings.price`; sort by `created_at DESC` / `view_count DESC`; boosted ranking via `boosts.status='active'` (R-B04); `listing_images` hero; `rating_aggregates` per card.
- **User flows:** Happy — type keyword → results render → refine via FilterSheet → tap card. Edge — query returns nothing; filters too narrow; RTL Arabic input normalization via `unaccent`.
- **Empty state:** "No results for «{query}»" with suggestions to clear filters + popular categories; if filters applied, a one-tap "Clear all filters".
- **Loading state:** Card-grid skeleton (12 cards); filter rail renders immediately from cached categories.
- **Error state:** Inline "Search is temporarily unavailable" card with retry; preserves entered query and filters in the URL.

### Category Browse
- **Route:** `/category/[slug]`
- **Auth gate:** public
- **Layout:** PublicShell
- **Use case(s):** Filter Listings; Manage Categories (consumer view)
- **Components:** Category header (name_ar, icon), subcategory chips, `FilterSheet`, `ListingCard` grid, breadcrumb.
- **Data requirements:** `categories` resolved by `slug` (+ children where `parent_id = category.id`); `listings` where `category_id` or `subcategory_id` matches, `status='active'`; `listing_images`, `rating_aggregates`.
- **User flows:** Happy — tap category tile on homepage → browse → drill into subcategory chip. Edge — inactive/hidden category (`is_active=false`) → 404; empty category.
- **Empty state:** "No active listings in {category} yet" + link to parent category and homepage.
- **Loading state:** Header skeleton + 12-card grid skeleton.
- **Error state:** Full-page error card with retry and link home.

### Listing Detail
- **Route:** `/listing/[id]`
- **Auth gate:** public (write actions gated)
- **Layout:** PublicShell
- **Use case(s):** View Listing Detail; Upload Product Images (display side); Save to Wishlist; Send Inquiry (entry)
- **Components:** `ImageGallery` (up to 5, sort_order, hero first), title (ar/en), `PriceBlock` (handles `price_type`: fixed / per_hour / starting_from / quote_only), stock/availability badge (product vs service vs made-to-order), tag chips, seller mini-card (avatar, name, level badge, rating, avg response time), `WishlistButton`, `InquiryButton` → opens inquiry composer, share button (channel-agnostic — device share sheet; WhatsApp/FB/Instagram/link downstream, not enumerated), reviews summary + recent reviews list with photos and seller replies, "more from this store" rail, restock-alert toggle when `sold_out`.
- **Data requirements:** `listings` (full row; increments `view_count`); `listing_images` (ordered); `listing_tags`; `stores` + `seller_profiles` (level, is_verified, avg_response_hours); `rating_aggregates` (avg + distribution); `reviews` (is_visible=TRUE, with `seller_reply`) → `review_photos`; `wishlists` (current buyer membership) + `restock_alerts` for sold-out; price/stock rules R-L05/06/09. `is_made_to_order`, `stock_qty`, `low_stock_threshold`, `accepts_custom_orders`, `custom_order_notes`.
- **User flows:** Happy — view → tap Inquire → composer (quantity, delivery_preference, special_requests) → submit (requires auth). Edge — guest taps Inquire/Wishlist → `/auth/login` return-redirect; `quote_only` hides quantity/price-paid; `sold_out` swaps CTA to "Notify me when back" (writes `restock_alerts`); soft-deleted/removed listing → 404.
- **Empty state:** No reviews yet → "Be the first to review after purchase"; no other listings from store → hide rail.
- **Loading state:** Gallery skeleton + title/price skeleton + reviews skeleton block.
- **Error state:** 404 for missing/removed; otherwise full-page retry card.

### Public Storefront
- **Route:** `/store/[slug]`
- **Auth gate:** public
- **Layout:** PublicShell
- **Use case(s):** View Seller Storefront; Follow Seller; Store Header / Level badge
- **Components:** Cover banner + avatar, store name (ar/en), bio, **verified badge**, level badge (Bronze/Silver/Gold), rating summary (avg + count + distribution bars), avg response time, `FollowButton`, **share button (channel-agnostic — shares the store link via the device share sheet; WhatsApp/FB/Instagram/link downstream, not enumerated; HUMAN-AUTHORIZED ADDITION 2026-07-23, not a correction — REG-51 / owner Claude Design CD-DELTA-5)**, governorate/city, return policy accordion, tabs: Listings (filterable grid) · Reviews · About (**delivery methods** — payment handles are no longer buyer-facing under custody, OD-8 §7). 
- **Data requirements:** `stores` by `slug` (status='active' RLS); `seller_profiles` (level, is_verified, avg_response_hours, total_orders_completed, total_reviews_count); `rating_aggregates`; `listings` (store_id, active); `reviews` (store_id, is_visible); `store_follows` (current buyer membership + count); `stores.delivery_options` (JSONB) / `return_policy` (**`stores.payment_methods` is no longer rendered to buyers — under custody it is the BETK→seller settlement destination, not a pay-to handle; code removal = CORRECTION-02B / REG-55, OD-8 §7**).
- **User flows:** Happy — open storefront → browse listings tab → follow store (writes `store_follows`, unique buyer+store). Edge — guest follow → login redirect; suspended store (R-S07) → 404/"unavailable"; slug not found → 404.
- **Empty state:** Store with no active listings → "This store has no live listings yet"; no reviews → reviews tab empty copy.
- **Loading state:** Cover/avatar skeleton, stat-row skeleton, listings grid skeleton.
- **Error state:** Full-page retry; 404 on unknown/suspended slug.

---

### — AUTH —

### Phone Entry (Login / Register start)
- **Route:** `/auth/login`
- **Auth gate:** public
- **Layout:** AuthShell (centered card, RTL)
- **Use case(s):** Sign In, Register (R-A01, R-A03)
- **Components:** Phone input (E.164 `+20` prefix, LTR island for digits), "Send code" button, **"Continue with Google" button (Supabase OAuth — OD-4)** with an "or" divider, terms/role note, link "Become a seller", error/help text. No password field anywhere (R-A01 amended: OTP + Google OAuth only, still no passwords).
- **Data requirements:** Writes/reads `otp_tokens` (creates token, `expires_at = NOW()+60s`, one active per phone — R-A02; `token_hash` only, never raw); checks `users.phone_number` uniqueness to branch new vs returning (R-A03). Suspended/banned check on returning users (R-A05).
- **User flows:** Happy — enter phone → request OTP → `/auth/verify`. Edge — invalid format; rate-limited resend (R-A02, `attempt_count`); suspended account message.
- **Empty state:** N/A (single form).
- **Loading state:** Button spinner ("Sending code…"); inputs disabled during request.
- **Error state:** Inline field error (format/uniqueness); toast on SMS-dispatch failure with retry.

### OTP Verification
- **Route:** `/auth/verify`
- **Auth gate:** public (mid-auth)
- **Layout:** AuthShell
- **Use case(s):** Sign In, Register, Forgot Password
- **Components:** 6-digit OTP input (mono, LTR), 60s countdown timer, resend button (disabled until expiry), change-number link.
- **Data requirements:** Verifies against `otp_tokens` (`token_hash`, `expires_at`, `is_used`, `attempt_count` ≤ 5 — R-A02); on success creates `sessions` (token_hash, device_info, expires_at: 30d mobile / 24h web) and sets `users.last_login_at`; resolves `users.role` for routing.
- **User flows:** Happy — enter code → verified → role routing (buyer→`/auth/register` if no profile else `/`; seller→`/seller` or `/seller/status`; admin→`/admin`). Edge — expired code → prompt resend; >5 attempts → lockout message; reused token rejected.
- **Empty state:** N/A.
- **Loading state:** Inline verify spinner on the digit field.
- **Error state:** Shake + inline "Incorrect or expired code"; resend path always offered.

### Complete Buyer Profile
- **Route:** `/auth/register`
- **Auth gate:** protected (session exists, profile incomplete)
- **Layout:** AuthShell
- **Use case(s):** Register (buyer_profiles creation)
- **Components:** Form — full_name (required), governorate select (27 Egyptian governorates), city (optional), interests multi-select (category slugs), notification prefs toggles (push/sms/whatsapp/email), submit.
- **Data requirements:** Inserts `buyer_profiles` (id = users.id, full_name NN, governorate NN, interests JSONB, notification_prefs JSONB); `categories` for the interests picker.
- **User flows:** Happy — fill → save → land on `/` personalized. Edge — skip optional fields; governorate required validation.
- **Empty state:** N/A.
- **Loading state:** Submit button spinner.
- **Error state:** Field-level validation; toast on save failure (session preserved).

---

### — BUYER —

### Account / Profile
- **Route:** `/account`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Manage Profile; Account Deletion (MW1)
- **Components:** Editable profile form (full_name, governorate, city, interests, notification prefs), avatar (optional), add/verify-phone prompt for Google-only users (OD-4), links to Addresses / Wishlist / Following / Orders / Notifications, "Become a seller" CTA, **Deactivate account** (destructive, confirm dialog), logout.
- **Data requirements:** `buyer_profiles` (read/update own — RLS `bp_self`); `users` (phone read-only, R-A06; status); for delete: MW1 anonymization preserving `orders` references. **[DATA GAP]** — MW1 account-deletion workflow requires an anonymization/retention state, but no `deleted_at`/`anonymized_at` column exists on `users` or `buyer_profiles` in the schema; deletion behavior is undefined at the data layer.
- **User flows:** Happy — edit fields → save (toast). Edge — attempt to edit phone → blocked, "requires re-verification" (R-A06); delete account → confirm modal → MW1.
- **Empty state:** N/A.
- **Loading state:** Form skeleton on first load.
- **Error state:** Field validation + save-failure toast.

### Address Book
- **Route:** `/account/addresses`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Manage Addresses
- **Components:** Address list cards, add/edit `AddressForm` (label, governorate, city, street_address, building_notes, is_default), set-default toggle, delete (confirm).
- **Data requirements:** `addresses` (CRUD own — RLS `addr_self`); enforce max one `is_default=true` per buyer at app layer.
- **User flows:** Happy — add address → set default → reused at checkout. Edge — deleting the default → prompt to choose a new default; deleting an address referenced by an active order (kept via `orders.delivery_address_id` nullable).
- **Empty state:** "No saved addresses" + prominent "Add address" CTA.
- **Loading state:** List skeleton (3 rows).
- **Error state:** Inline form errors; toast on save/delete failure.

### Wishlist & Saved
- **Route:** `/wishlist`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Save to Wishlist; Wishlist Restock Alert Toggle
- **Components:** Saved `ListingCard` grid, per-item remove, **restock-alert toggle** on sold-out items, "in stock again" badge.
- **Data requirements:** `wishlists` (own — RLS `wishlist_own`) → `listings` + `listing_images` + `rating_aggregates`; `wishlists.restock_alert` flag; sold-out items surface restock toggle that writes `restock_alerts` (R-N06).
- **User flows:** Happy — view saved → tap into listing or remove. Edge — saved listing removed/soft-deleted by seller → show "no longer available" tombstone; toggle restock on sold-out item.
- **Empty state:** "Your wishlist is empty" + browse CTA.
- **Loading state:** Card-grid skeleton (6 cards).
- **Error state:** Inline retry card.

### Followed Sellers
- **Route:** `/account/following`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Follow Seller; Followed Sellers tab
- **Components:** Followed `StoreCard` list (avatar, name, level, rating, new-listing count), unfollow button.
- **Data requirements:** `store_follows` (own) → `stores` + `seller_profiles` (level) + `rating_aggregates`; new-listing indicator from `listings.created_at > followed_at`.
- **User flows:** Happy — view followed stores → open storefront / unfollow. Edge — followed store suspended → hidden/"unavailable".
- **Empty state:** "You're not following any stores yet" + discover CTA.
- **Loading state:** List skeleton (4 rows).
- **Error state:** Inline retry.

### Buyer Inbox (Inquiries)
- **Route:** `/inbox` · thread `/inbox/[inquiryId]`
- **Auth gate:** protected
- **Layout:** BuyerShell (list + thread; split on desktop, stacked on mobile)
- **Use case(s):** Send Inquiry, Respond to Inquiry
- **Components:** Thread list (store, listing thumb, last message, unread dot, status chip), `MessageThread` (bubbles by sender_type), composer, listing context header, "seller confirmed → go to checkout" banner when `status='confirmed'`. (No off-platform contact affordance — all buyer↔seller communication is in-app only; see `docs/PRECEDENTS.md`, REG-45 closed-as-not-a-defect 2026-07-23.)
- **Data requirements:** `inquiries` (buyer_id = self — RLS `inq_buyer`; status open/replied/confirmed/declined/expired; `converted_to_order_id`); `inquiry_messages` (sender_id, sender_type buyer|seller, is_read, body); ordered by `last_message_at DESC` (C2 §7.1 index); `listings`/`stores` for context.
- **User flows:** Happy — send inquiry from listing → seller replies → seller confirms → CTA to `/checkout`. Edge — declined/expired inquiry (read-only); unread badge sync.
- **Empty state:** "No inquiries yet" + browse CTA; thread pane empty prompt on desktop.
- **Loading state:** Thread-list skeleton + message-bubble skeletons.
- **Error state:** Send-failure inline retry on the failed bubble; list retry card.

### Checkout
- **Route:** `/checkout?inquiry=[inquiryId]`
- **Auth gate:** protected
- **Layout:** BuyerShell (focused, minimal nav)
- **Use case(s):** Checkout & Place Order, Select Delivery Method, Pay via Instapay/COD/Wallet
- **Components:** Order summary (line items from inquiry/listing, qty, unit price, subtotal), `AddressSelect` (from address book or pickup/remote), `DeliveryMethodSelect` (delivery/pickup/remote + computed fee), **split-payment panel** (50% deposit paid to **BETK's** Instapay / Vodafone Cash / Orange Cash handles from `admin_settings` — NOT the store's; 50% balance = COD), totals (subtotal + delivery_fee = total), place-order button (irreversible confirm).
- **Data requirements:** Creates `orders` (betk_ref `BETK-YYYYMMDD-XXXX` R-O02; buyer_id, store_id, inquiry_id, delivery_address_id nullable, delivery_method, delivery_fee, subtotal, total_amount, status='pending'; **`commission_rate`+`commission_amount` snapshotted at creation — OD-8/ADR-016**) + `order_items` (snapshot `listing_title_ar`, `unit_price`, subtotal — R-O01 requires confirmed inquiry); creates **two** `payments` rows (deposit + balance, split model; **payee = BETK — deposit to BETK's rails, custodial per OD-8**); reads `addresses`, `stores.delivery_options` (JSONB), **`admin_settings` (BETK's deposit handles, `commission_rate_pct`, `delivery_fee_flat_egp` — OD-8 §7/§8/§9.1; the Bosta courier fee is Phase 08)**. Order created only from `confirmed` inquiry (R-O01).
- **User flows:** Happy — review → pick address + delivery + deposit method → place order → `/checkout/confirmation/[orderId]`. Edge — no saved address (inline add); COD-only store; service/remote order (no address); inquiry not in `confirmed` state → blocked with explanation; stock decrement happens on seller confirmation, not here (R-L05).
- **Empty state:** Invalid/expired inquiry → redirect to inbox with message.
- **Loading state:** Summary skeleton; place-order button spinner with disabled inputs.
- **Error state:** Inline payment/address validation; place-order failure toast (no partial order — atomic create).

### Order Confirmation & Payment Instructions
- **Route:** `/checkout/confirmation/[orderId]`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Pay via Instapay/COD/Wallet (instruction display)
- **Components:** Success header with BETK ref (mono), **deposit payment instructions** (**BETK's** Instapay handle / wallet number from `admin_settings` — NOT the store's), amount due now (50%), transfer-reference input (optional), **transfer-screenshot upload** (`ImageUploader` → private `docs` bucket, own-prefix; sets `payments.proof_path`; no new storage policy — `docs_insert_own_prefix` already grants any authenticated buyer own-prefix INSERT, `docs_select_own_or_admin` gives admin read), "I've uploaded my transfer" affordance, balance-on-delivery note (COD 50%), track-order link.
- **Data requirements:** `orders` (by id, own — RLS `orders_access`); `payments` (deposit row: amount, method, status='pending', `transfer_reference`, `proof_path`); **`admin_settings`** (`betk_instapay_handle` / `betk_vodafone_cash` / `betk_orange_cash`) for instructions; buyer uploads proof → **awaiting-review convention = `proof_path IS NOT NULL AND status='pending'`**; **admin** verifies + confirms the deposit later (R-O05 amended — OD-8 §3).
- **User flows:** Happy — read instructions → transfer to BETK externally → upload the transfer screenshot → optionally enter reference → **await admin verification**. Edge — **no pure-COD path (R-O04 retired) — every order has a deposit step (OD-8 §3.2)**; missing BETK payment handle in `admin_settings`.
- **Empty state:** N/A.
- **Loading state:** Instruction-card skeleton.
- **Error state:** Retry card; instructions remain reachable from order detail.

### Order History
- **Route:** `/orders`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** View Order History
- **Components:** Filter tabs by status, order cards (BETK ref, store, thumbnail, total, `StatusBadge`, date), pagination.
- **Data requirements:** `orders` (buyer_id = self) + `order_items` (preview); status enum (pending…returned); index `(buyer_id, status)` (C2 §7.1).
- **User flows:** Happy — browse → tap → order detail. Edge — filter with no matches.
- **Empty state:** "No orders yet" + browse CTA.
- **Loading state:** Order-card list skeleton (5).
- **Error state:** Inline retry card.

### Order Detail / Track Order
- **Route:** `/orders/[id]`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Track Order; Cancel Order; Leave Review (entry); Raise Dispute (entry); Request Return/Refund (entry)
- **Components:** Header (BETK ref, `StatusBadge`), `OrderTimeline` (status history with timestamps), line items, payment panel (deposit + balance status), shipment/tracking card (courier, tracking number/url, event timeline), order message thread (post-order), action bar (Cancel if pending · Leave review if delivered + within window · Raise dispute if delivered/dispatched · Request return if delivered).
- **Data requirements:** `orders` (own); `order_status_history` (ordered `created_at DESC` — Track Order, C2 §7.1); `order_items`; `payments` (both rows); `shipments` + `shipment_tracking_events`; `order_messages` (post-order thread); eligibility gates: cancel only while `pending` (R-O03), review only if `delivered` + buyer match within 48h (R-O01/R-R03), dispute only if delivered/dispatched (R-D01), return only after delivered (R-O08); one review per order (R-O07), one active dispute per order (R-O06).
- **User flows:** Happy — track status → on delivery, leave review. Edge — cancel pending order (writes status history, cancelled_by='buyer'); raise dispute; pickup/remote order with no shipment; balance COD due on delivery.
- **Empty state:** No shipment (pickup/remote) → hide tracking card; no messages → empty thread prompt.
- **Loading state:** Header + timeline skeleton; tracking card skeleton.
- **Error state:** 404 for non-own/missing; retry card otherwise.

### Leave Review
- **Route:** `/orders/[id]/review`
- **Auth gate:** protected
- **Layout:** BuyerShell (focused)
- **Use case(s):** Leave Review
- **Components:** Star rating (1–5), text body (≤500), photo upload (≤3), submit; edit mode within 48h.
- **Data requirements:** Inserts `reviews` (order_id UQ → one per order R-R02/R-O07; buyer_id, store_id denormalized, rating CHK 1–5, body, `edit_deadline = created_at + 48h`, is_visible default true) — RLS `reviews_buyer`/`reviews_edit`; `review_photos` (≤3, sort_order); triggers `rating_aggregates` recompute (R-R07). Goes live ~5 min (R-R05).
- **User flows:** Happy — rate → optional text/photos → submit. Edge — already reviewed → redirect to edit (if within 48h) or read-only; not delivered/not own order → blocked (R-R01); edit after deadline → blocked (R-R03).
- **Empty state:** N/A.
- **Loading state:** Submit spinner; photo upload progress.
- **Error state:** Field validation; upload-failure inline; submit toast.

### Raise Dispute
- **Route:** `/orders/[id]/dispute/new`
- **Auth gate:** protected
- **Layout:** BuyerShell (focused)
- **Use case(s):** Raise Dispute, Request Return, Request Refund
- **Components:** Reason select (not_received / not_as_described / damaged / wrong_item / return_request / refund_request), description, evidence upload (≤5 photos), submit; BETK-Guarantee explainer.
- **Data requirements:** Inserts `disputes` (order_id UQ — one active per order R-O06/R-D06; buyer_id, store_id, reason enum, status='submitted', `sla_deadline = created_at + 48h` R-D02) — RLS `disputes_access`; `dispute_evidence` (≤5 R-D05). Eligibility: delivered/dispatched only (R-D01).
- **User flows:** Happy — pick reason → describe → attach evidence → submit → `/disputes/[id]`. Edge — order ineligible (not dispatched/delivered) → blocked; existing active dispute → redirect to it.
- **Empty state:** N/A.
- **Loading state:** Submit spinner; upload progress per photo.
- **Error state:** Validation (reason required); upload/submit failure toast.

### Dispute Detail / Thread (Buyer)
- **Route:** `/disputes/[id]`
- **Auth gate:** protected
- **Layout:** BuyerShell
- **Use case(s):** Review Dispute (buyer side)
- **Components:** Status header + SLA indicator, evidence gallery, isolated dispute `MessageThread` (buyer/seller/admin), resolution banner when resolved (outcome + notes), linked order summary.
- **Data requirements:** `disputes` (own — RLS); `dispute_evidence`; `dispute_messages` (sender_type buyer|seller|admin, immutable); `orders` summary. Resolution enum (buyer_favour/seller_favour/partial/no_action) + `resolution_notes`; both parties notified (R-D04).
- **User flows:** Happy — follow status → message admin → receive resolution. Edge — resolved/closed → thread read-only.
- **Empty state:** No messages yet → "Our team will review within 48 hours" copy.
- **Loading state:** Header + thread skeleton.
- **Error state:** 404 non-own; retry card.

### Notifications Center
- **Route:** `/notifications`
- **Auth gate:** protected
- **Layout:** BuyerShell (also surfaced as topbar bell dropdown)
- **Use case(s):** Send Notifications (recipient view); unread badge
- **Components:** Notification list grouped by date, type icon, read/unread state, deep-link on tap, mark-all-read, channel-pref shortcut to account.
- **Data requirements:** `notifications` (user_id = self — RLS `notif_own`; type, channel, title, body, data JSONB deep-link payload, is_read, read_at); unread badge via partial index `(user_id) WHERE is_read=false` (C2 §7.1).
- **User flows:** Happy — open → tap notification → deep-link to order/dispute/listing; mark read. Edge — stale deep-link target (deleted entity) → graceful fallback.
- **Empty state:** "No notifications" illustration.
- **Loading state:** List skeleton (8 rows).
- **Error state:** Inline retry; bell badge falls back to last-known count.

---

### — SELLER —

### Seller Onboarding (5-step)
- **Route:** `/seller/onboarding`
- **Auth gate:** protected (becomes role: seller on submit)
- **Layout:** AuthShell → wizard (Stepper)
- **Use case(s):** Create Seller Storefront (WF1); Seller Registration Step 5 (ID upload)
- **Components:** 5-step `Stepper` — (1) Identity (store name_ar/en, bio), (2) Category (primary + optional secondary, governorate/city), (3) Payment config (instapay_handle, vodafone_cash, orange_cash, cod_enabled) — **now the BETK→seller SETTLEMENT destination (where BETK pays the seller net of commission), NOT a buyer-facing pay-to handle (OD-8 §7/ADR-016); `cod_enabled` no longer gates anything buyer-facing (§3.2)**, (4) Delivery config (**3 mode toggles `{delivery, pickup, remote}`** + est delivery days [single min/max range] + default fee — REG-14), (5) National ID upload (front + back). Slug picker with availability check. Submit-for-review.
  - _REG-14 correction (Phase 04 / T01+T07, 2026-07-20): the live `betk.delivery_preference` enum + `StoreDeliveryOptions.modes` type are the 3 modes `{delivery, pickup, remote}` — NOT the earlier `self_deliver/bosta/pickup/remote` 4-value wording (self-deliver + Bosta both map to the single `delivery` fulfillment mode). Type-level MATCH proven at T01, runtime exact-shape JSONB round-trip proven at T07. The product option of distinguishing courier vs. self-delivery (a 4th mode) was **declined by default** — it would require an OD scope amendment. `ships_nationwide` is a separate boolean field on the delivery settings page, not a 4th mode._
- **Data requirements:** Creates `seller_profiles` (status='pending', level='bronze', `submitted_at`) and `stores` (seller_id UQ — one store per seller R-S01; slug UQ + URL-safe R-S02; name_ar NN; category_primary; payment_methods/delivery_options JSONB); `seller_documents` (two rows: national_id_front/back, storage_path via signed URL, review_status='pending' — R-S05); `categories` for pickers.
- **User flows:** Happy — complete 5 steps → submit → `/seller/status` (pending). Edge — slug taken (R-S02); missing settlement handle blocks publish later (R-S09 — the seller must be payable; `cod_enabled` alone no longer satisfies it, OD-8 §3.2/§7); resume incomplete wizard.
- **Empty state:** N/A (wizard).
- **Loading state:** Per-step save spinners; slug-availability inline check; upload progress.
- **Error state:** Per-field validation; slug-collision inline; upload-failure retry per document.

### Seller Application Status
- **Route:** `/seller/status`
- **Auth gate:** role: seller (status = pending/suspended/banned/rejected)
- **Layout:** SellerShell (restricted)
- **Use case(s):** WF1 approval/rejection; Seller Resubmission (MW2)
- **Components:** Status banner (pending / approved / rejected), SLA note (24h, R-M01), rejection reason display, **resubmit** flow (re-upload documents, edit store), approval CTA → dashboard.
- **Data requirements:** `seller_profiles` (status, `rejected_reason`, `approved_at`, `submitted_at`); `seller_documents` (retained on rejection for resubmit — R-S08, MW2); `stores.status` mirrors seller status.
- **User flows:** Happy — pending → approved → auto-route to `/seller`. Edge — rejected → read reason → resubmit (MW2, previous docs retained); suspended → restricted view.
- **Empty state:** N/A.
- **Loading state:** Status-card skeleton.
- **Error state:** Retry card; resubmit upload errors inline.

### Seller Dashboard
- **Route:** `/seller`
- **Auth gate:** role: seller (status = active)
- **Layout:** SellerShell (sidebar)
- **Use case(s):** Seller Daily Operations; Seller Dashboard KPIs
- **Components:** KPI cards (profile views, listing views, inquiries, orders, revenue — today/period), level progress widget, rating snapshot, recent inquiries, recent orders, low-stock alerts, payout balance, quick actions (new listing, boost).
- **Data requirements:** `seller_analytics_snapshots` (latest, store-scoped — RLS; profile_views, listing_views, inquiries_received, orders_confirmed, revenue_egp); `rating_aggregates`; `seller_profiles` (level, level_score, totals, avg_response_hours); `orders`/`inquiries` recent (store_id = my_store_id); low-stock from `listings` where `stock_qty <= low_stock_threshold`.
- **User flows:** Happy — review KPIs → jump to inbox/orders/listings. Edge — brand-new seller with zero snapshots/orders.
- **Empty state:** "No activity yet — add your first listing" guidance + CTA when no listings/orders.
- **Loading state:** KPI-card skeletons + list skeletons (progressive per widget).
- **Error state:** Per-widget inline retry; dashboard never hard-fails wholesale.

### Store Profile Settings
- **Route:** `/seller/store`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Store Profile
- **Components:** Edit form (name_ar/en, bio_ar, avatar upload 200×200+, cover 1200×400, category primary/secondary, governorate/city, min_order_egp), **slug editor (change-once)** with lock indicator.
- **Data requirements:** `stores` (update own — RLS `stores_manage`); slug change allowed only once via `slug_changed_at` (R-S03); avatar_url/cover_url to CDN; `categories` for selects.
- **User flows:** Happy — edit → save (toast). Edge — second slug-change attempt blocked (R-S03); image dimension validation.
- **Empty state:** N/A.
- **Loading state:** Form skeleton; image upload progress.
- **Error state:** Field validation; slug-lock message; save toast.

### Delivery Settings
- **Route:** `/seller/store/delivery`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Delivery Settings
- **Components:** **3 mode toggles `{delivery, pickup, remote}`** (REG-14 — live `StoreDeliveryOptions.modes`, NOT the stale `self_deliver/bosta/pickup/remote` 4-value wording), est delivery days (a single min/max range — the schema has one range, not per-governorate; divergence recorded), default delivery fee, free-delivery threshold, pickup governorate, and a separate `ships_nationwide` toggle (a real field, not a 4th mode).
- **Data requirements:** `stores.delivery_options` (JSONB) update; used by checkout fee calc and `shipments`.
- **User flows:** Happy — configure options → save. Edge — disabling all delivery methods warning.
- **Empty state:** Sensible defaults pre-filled.
- **Loading state:** Form skeleton.
- **Error state:** Save toast; validation on est-days.

### Return Policy Settings
- **Route:** `/seller/store/returns`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Return Policy
- **Components:** Rich-text/plain `return_policy` editor, public-preview note.
- **Data requirements:** `stores.return_policy` (TEXT) update; rendered on storefront.
- **User flows:** Happy — write policy → save → visible publicly. Edge — empty policy allowed (NULL).
- **Empty state:** Placeholder template suggestion.
- **Loading state:** Editor skeleton.
- **Error state:** Save toast.

### Payment Methods Settings
- **Route:** `/seller/store/payments`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Store payment configuration (R-S09)
- **Components:** Instapay handle, Vodafone Cash number, Orange Cash number, COD toggle; validation that **≥1 settlement handle is set so the seller can be paid** before listings can publish (R-S09; `cod_enabled` alone no longer satisfies it — OD-8 §3.2/§7).
- **Data requirements:** `stores.payment_methods` (JSONB: instapay_handle, vodafone_cash, orange_cash, cod_enabled); publish gate R-S09 = **the seller can be paid** (≥1 settlement handle set; **`cod_enabled` alone no longer satisfies it under custody — OD-8 §3.2/§7; `hasPaymentMethod` in `listingRules.ts` must become "≥1 settlement handle set" — REG-61/CORRECTION-02B**). **Note (OD-8):** these handles are the **BETK→seller settlement destination** (where BETK pays the seller net of commission), **NOT buyer-facing pay-to handles** — buyers pay BETK, never the seller directly.
- **User flows:** Happy — add at least one **settlement handle** → save → the seller can be paid → can now publish listings. Edge — try to publish a listing with no settlement handle → blocked with link here (R-S09).
- **Empty state:** Warning banner "Add a payment method to start selling".
- **Loading state:** Form skeleton.
- **Error state:** Validation; save toast.

### Listings Management
- **Route:** `/seller/listings`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Listings
- **Components:** Listings table/grid (thumb, title, type, price, stock, status badge, views, inquiries), status filter tabs (draft/active/sold_out/paused/removed), bulk + per-row actions (edit, pause, boost, delete), new-listing CTA.
- **Data requirements:** `listings` (store_id = my_store_id — RLS `listings_seller`; status lifecycle R-L06/07/10; view_count, inquiry_count); `listing_images` (hero); soft-delete via `deleted_at` (R-L10).
- **User flows:** Happy — view catalog → edit/pause/boost. Edge — sold_out filter; removed (soft-deleted) shown in dedicated tab; pause/unpause.
- **Empty state:** "No listings yet — create your first" CTA.
- **Loading state:** Table skeleton (6 rows).
- **Error state:** Inline retry; row-action failure toast.

### Create / Edit Listing
- **Route:** `/seller/listings/new` · `/seller/listings/[id]/edit`
- **Auth gate:** role: seller
- **Layout:** SellerShell (form)
- **Use case(s):** Manage Listings; Upload Product Images
- **Components:** Type toggle (product/service), title_ar (required) + title_en, description_ar, category + subcategory, `PriceBlock` (price + price_type fixed/per_hour/starting_from/quote_only), stock fields (stock_qty, is_made_to_order, low_stock_threshold — hidden for services R-L09), custom-order toggle + notes, tags (≤5), per-listing delivery override, **image uploader (≤5 ordered, hero = sort_order 0)**, save-draft / publish.
- **Data requirements:** `listings` insert/update (store_id, category_id NN R-L01, type, title_ar NN R-L03, price/price_type, stock_qty nullable R-L09, status draft→active); `listing_images` (≥1 required to publish R-L02, ≤5, sort_order); `listing_tags` (≤5, unique per listing); `categories`. Publish validation: ≥1 image (R-L02) + Arabic title (R-L03) + category (R-L04) + store has a settlement handle so the seller can be paid (R-S09; `cod_enabled` alone no longer satisfies it — OD-8 §3.2/§7). `search_vector` auto-generated.
- **User flows:** Happy — fill → upload images → publish (active). Edge — save as draft (skips publish validation); service hides stock; quote_only nulls price; reorder images (hero change); publish blocked until requirements met.
- **Empty state:** New form pre-filled with defaults.
- **Loading state:** Form skeleton on edit load; per-image upload progress.
- **Error state:** Inline publish-requirement checklist; upload retry per image; save toast.

### Stock & Inventory
- **Route:** `/seller/inventory`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Stock & Inventory; Restock Alert
- **Components:** Stock table (listing, current stock, threshold, status), inline stock edit, low-stock highlight, restock action (sold_out → active R-L07), made-to-order indicator, "buyers waiting" count for restock alerts.
- **Data requirements:** `listings.stock_qty`, `low_stock_threshold`, `is_made_to_order`, status (sold_out auto at 0 — R-L06; restock reverts to active — R-L07); `restock_alerts` count per listing (waiting buyers; R-N06 fires on restock). **[DATA GAP]** — C1 §6.1 and C2 §1 approved an "Inventory Alert" *record* (low-stock alert log), but the final schema persists **no `inventory_alerts` table**; low-stock alerting is derivable only from `listings.stock_qty <= low_stock_threshold` at query time, with no stored alert/acknowledgement history.
- **User flows:** Happy — adjust stock → status auto-updates → restock fires buyer alerts. Edge — restock a sold_out item with waiting buyers (notifications dispatched); made-to-order rows show "unlimited".
- **Empty state:** "No stocked products" (e.g. services-only store).
- **Loading state:** Table skeleton.
- **Error state:** Inline edit retry; save toast.

### Boost Listing
- **Route:** `/seller/listings/[id]/boost`
- **Auth gate:** role: seller
- **Layout:** SellerShell (focused)
- **Use case(s):** Boost Listing (WF9)
- **Components:** Package selector (24h/EGP20, 48h/EGP50, 72h/EGP100 from `boost_packages`), payment method (instapay/vodafone_cash/orange_cash), payment-instruction panel, submit → pending_payment, status note ("activates within 5 min of admin confirmation").
- **Data requirements:** `boost_packages` (is_active, sort_order, duration_hours, price_egp); inserts `boosts` (listing_id, store_id, package_id, payment_method, amount_paid snapshot, status='pending_payment'); concurrent-boost guard via partial unique index `(listing_id) WHERE status='active'` (R-B01/R-L08). Activation by admin (MW3, R-B02).
- **User flows:** Happy — pick package → pay externally → await admin confirm → boost active (R-B02). Edge — listing already has an active boost → blocked (R-B01); non-active listing cannot be boosted.
- **Empty state:** N/A.
- **Loading state:** Package-card skeleton; submit spinner.
- **Error state:** Validation; submit toast; concurrent-boost inline message.

### Boost Management / History
- **Route:** `/seller/boosts`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Boost ROI analytics (R-B05)
- **Components:** Active/expired boost list, ROI card (views_during_boost vs baseline), status (pending_payment/active/expired/cancelled), expiry countdown.
- **Data requirements:** `boosts` (store_id; status, starts_at, expires_at, views_during_boost — R-B05); `boost_packages` for labels; `listings` for titles.
- **User flows:** Happy — review ROI → re-boost. Edge — pending_payment awaiting admin; auto-expired (pg_cron, R-B03).
- **Empty state:** "No boosts yet" + boost CTA.
- **Loading state:** List skeleton.
- **Error state:** Inline retry.

### Seller Inbox (Inquiries)
- **Route:** `/seller/inbox` · thread `/seller/inbox/[inquiryId]`
- **Auth gate:** role: seller
- **Layout:** SellerShell (list + thread)
- **Use case(s):** Respond to Inquiry; Seller Inbox; Confirm order from inquiry
- **Components:** Inquiry list (buyer, listing, last message, status, unread, response-time chip), `MessageThread`, composer, **confirm-order** action (sets inquiry→confirmed, enables buyer checkout), decline action, listing/qty/special-requests context. (No off-platform contact affordance — all buyer↔seller communication is in-app only; REG-45 closed-as-not-a-defect 2026-07-23.)
- **Data requirements:** `inquiries` (store_id = my_store_id — RLS; status open→replied→confirmed/declined; `converted_to_order_id`); `inquiry_messages` (sender_type buyer|seller, is_read); ordered by `last_message_at DESC`; reply updates `seller_profiles.avg_response_hours` (Inquiry Response Time merged metric); new-inquiry notify within 5s (R-N04).
- **User flows:** Happy — receive inquiry → reply → confirm → buyer checks out → inquiry converts to order. Edge — decline; expired; quote_only negotiation.
- **Empty state:** "No inquiries yet."
- **Loading state:** List + bubble skeletons.
- **Error state:** Send-retry inline; list retry.

### Orders Management (Seller)
- **Route:** `/seller/orders`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Manage Orders, Confirm Orders, Update Order Status
- **Components:** Orders table (BETK ref, buyer, total, payment status, `StatusBadge`, date), status filter tabs, per-row quick actions (confirm payment, advance status), new-order indicator.
- **Data requirements:** `orders` (store_id = my_store_id; status lifecycle); `order_items`; `payments` (deposit confirmation gate — R-O05); `order_status_history` written on each change; index `(store_id, created_at DESC)` (C2 §7.1).
- **User flows:** Happy — confirm deposit payment → status pending→confirmed (R-O05) → preparing→dispatched→delivered. Edge — COD auto-confirmed (R-O04); cancel; return flow.
- **Empty state:** "No orders yet."
- **Loading state:** Table skeleton (6).
- **Error state:** Inline retry; action-failure toast.

### Order Detail (Seller)
- **Route:** `/seller/orders/[id]`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Confirm Orders, Update Order Status, Process Returns, Create Shipment, Update Shipment Status, Generate Tracking Number
- **Components:** Order header + `StatusBadge`, buyer/delivery info, line items, **payment confirmation panel** (deposit + balance), **status stepper** with advance controls, **shipment panel** (courier, generate/enter tracking number + url, mark dispatched/delivered), order message thread, return processing.
- **Data requirements:** `orders` (own store); `payments` (confirm deposit → `confirmed_by`/`confirmed_at`, R-O05); `order_status_history` (changed_by, changed_by_type, notes); `shipments` (1:1, courier, tracking_number/url, status) + `shipment_tracking_events`; `order_messages`; status changes notify buyer+seller (R-N03/R-O / Update Order Status).
- **User flows:** Happy — confirm deposit → preparing → create shipment + tracking → dispatched → delivered (opens 48h review window via `delivered_at`). Edge — pickup/remote (no shipment); return request handling; cancel with reason.
- **Empty state:** No shipment for pickup orders → hide panel.
- **Loading state:** Header + panel skeletons.
- **Error state:** 404 non-own; action toasts; tracking save inline.

### Reviews Management (Seller)
- **Route:** `/seller/reviews`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Reply to Review
- **Components:** Review list (rating, body, buyer, photos, date, admin-verified badge), **reply box (one reply, immutable after submit)**, rating distribution summary.
- **Data requirements:** `reviews` (store_id = my_store_id, is_visible); `review_photos`; `rating_aggregates` summary; seller_reply written once via update (R-R04) — RLS `reviews_edit` (store branch); `seller_replied_at`.
- **User flows:** Happy — read review → reply once. Edge — already replied (read-only); hidden review (admin-removed) not shown to seller as actionable.
- **Empty state:** "No reviews yet."
- **Loading state:** Review-list skeleton.
- **Error state:** Reply-submit toast; one-reply guard inline.

### Earnings
- **Route:** `/seller/earnings`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** View Earnings
- **Components:** Balance card (**BETK-owed balance — approved vs pending**), revenue chart (period), confirmed-orders revenue, request-payout CTA, payout history link.
- **Data requirements:** `seller_snapshots` (revenue_egp series, store-scoped); `payouts` (history/status); `payments` (confirmed deposits/balances basis); `orders` (`subtotal`, `commission_amount`, `delivered_at`, closure state); `admin_settings` (`return_hold_hours`). **Custodial model (OD-8/ADR-016): BETK holds the funds and owes the seller a DERIVED balance** = Σ `(subtotal − commission_amount)` over eligible orders, minus `processed` payouts (no wallet/ledger table — OD-8 §6). **Approved** (payable) = orders **closed by admin** AND `delivered_at + return_hold_hours < now()` AND both payment rows `confirmed` AND no active dispute/return. **Pending** (held) = the same population still inside the return-hold window, or with an unconfirmed payment / active dispute/return. *(REG-54: docs previously said `seller_analytics_snapshots`; the live table is `seller_snapshots` — corrected here; other docs to sweep.)*
- **User flows:** Happy — view earnings → request payout. Edge — balance below EGP 100 minimum (R-O09) → payout disabled with explanation.
- **Empty state:** "No earnings yet."
- **Loading state:** Card + chart skeleton.
- **Error state:** Per-widget retry.

### Transactions
- **Route:** `/seller/transactions`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** View Transactions
- **Components:** Transaction ledger (order ref, payment_type deposit/balance, method, amount, status, date), filters by type/status.
- **Data requirements:** `payments` (via store orders — RLS `payments_access`); `orders` for ref/context.
- **User flows:** Happy — review transactions → drill to order. Edge — refunded/failed payment rows.
- **Empty state:** "No transactions yet."
- **Loading state:** Ledger skeleton.
- **Error state:** Inline retry.

### Request Payout
- **Route:** `/seller/payouts` (list) · `/seller/payouts/new`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Request Payout (WF10)
- **Components:** Payout request form (amount ≥ EGP 100, method instapay/vodafone_cash/orange_cash, account_details), payout history list (status pending/processing/processed/rejected, rejection_reason).
- **Data requirements:** `payouts` insert (store_id, amount CHK ≥ 100 — R-O09, method, account_details, status='pending'); admin processes manually (R-O10).
- **User flows:** Happy — request payout → admin processes → notified. Edge — below minimum blocked (R-O09); rejected with reason shown.
- **Empty state:** "No payout requests yet."
- **Loading state:** Form + history skeleton.
- **Error state:** Min-amount validation; submit toast.

### Level Progress
- **Route:** `/seller/level`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Level Progress; Seller Dashboard (level widget)
- **Components:** Current level badge (Bronze/Silver/Gold), progress to next tier, criteria checklist (orders, rating, response rate), score breakdown.
- **Data requirements:** `seller_profiles` (level, level_score 0–100, total_orders_completed, total_reviews_count, avg_response_hours); thresholds R-S06 (Silver: 10+ orders & 4.0+; Gold: 50+ & 4.5+); `rating_aggregates` (average_rating). Recalculated nightly (pg_cron, C2 §7.3).
- **User flows:** Happy — view progress → understand next-tier criteria. Edge — recently recalculated; demotion edge.
- **Empty state:** New seller at Bronze with 0 score.
- **Loading state:** Badge + checklist skeleton.
- **Error state:** Inline retry.

### Seller Analytics
- **Route:** `/seller/analytics`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** View Analytics Dashboard (Seller)
- **Components:** Time-series charts (views, inquiries, conversion, revenue), funnel (views→inquiries→orders), rating trend, boost ROI summary.
- **Data requirements:** `seller_analytics_snapshots` (daily series, store-scoped, index `(store_id, snapshot_date DESC)`); `rating_aggregates`; `boosts.views_during_boost`. Conversion derived (orders_confirmed / listing_views).
- **User flows:** Happy — pick range → read KPIs. Edge — sparse history for new sellers.
- **Empty state:** "Analytics will appear after your first day of activity."
- **Loading state:** Chart skeletons (progressive).
- **Error state:** Per-chart retry.

### Dispute Detail (Seller)
- **Route:** `/seller/disputes/[id]`
- **Auth gate:** role: seller
- **Layout:** SellerShell
- **Use case(s):** Resolve Disputes (seller participation)
- **Components:** Dispute status + SLA, buyer evidence gallery, dispute `MessageThread` (respond to admin/buyer), linked order, resolution banner.
- **Data requirements:** `disputes` (store_id = my_store_id — RLS `disputes_access`); `dispute_evidence`; `dispute_messages` (sender_type seller); `orders`. Resolution + notes set by admin (R-D03/R-D04).
- **User flows:** Happy — respond with explanation/evidence → admin resolves. Edge — awaiting_seller status prompts response; resolved → read-only.
- **Empty state:** N/A.
- **Loading state:** Header + thread skeleton.
- **Error state:** 404 non-own; send-retry inline.

---

### — ADMIN —

### Admin Dashboard
- **Route:** `/admin`
- **Auth gate:** role: admin
- **Layout:** AdminShell (sidebar)
- **Use case(s):** View Analytics Dashboard (Admin); Platform Analytics
- **Components:** Platform KPI cards (GMV, new users/sellers, orders created/delivered, disputes open/resolved, boost revenue), trend charts, **SLA alert panel** (sellers awaiting approval >23h, disputes >47h, flagged content >24h), activity feed.
- **Data requirements:** `platform_analytics_snapshots` (daily: gmv_egp, total/new buyers & sellers, orders_created/delivered, disputes_opened/resolved, boost_revenue_egp); `seller_analytics_snapshots` (aggregate); live counts from `seller_profiles` (pending), `disputes` (status, sla_deadline), `flagged_content` (pending). Admin bypasses RLS (`is_admin()`).
- **User flows:** Happy — scan KPIs + SLA panel → jump to the at-risk queue. Edge — no snapshot for today yet (pre-midnight job).
- **Empty state:** Pre-launch "awaiting first snapshot" placeholder.
- **Loading state:** KPI + chart skeletons (progressive).
- **Error state:** Per-widget retry; SLA panel falls back to live query.

### Seller Approval Queue
- **Route:** `/admin/sellers/approvals`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Verify Seller Profile, Verify Store (WF1, R-M01)
- **Components:** Pending-application list (store, submitted_at, SLA countdown 24h), detail drawer (store info, **ID document viewer via signed URL**, payment/delivery config), approve / reject (with reason) actions.
- **Data requirements:** `seller_profiles` (status='pending', submitted_at, approved_at, rejected_reason); `seller_documents` (signed-URL fetch, never public — review_status); `stores`; writes `moderation_logs` (action approve/reject_seller, target_type='seller') (R-M02); approval flips seller+store to active (R-S04); SMS on outcome (WF1).
- **User flows:** Happy — open application → view ID docs → approve → store goes live. Edge — reject with reason (resubmittable, R-S08/MW2); SLA breach highlight (R-M01).
- **Empty state:** "No applications awaiting review."
- **Loading state:** Queue skeleton; document-viewer spinner.
- **Error state:** Signed-URL failure inline; action toast.

### User & Seller Management
- **Route:** `/admin/users`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Users & Sellers, Suspend Seller, Suspend Buyer
- **Components:** User table (phone, role, status, joined), search/filter, detail drawer, **suspend/ban actions** (with strike, type warning/temp_suspension/permanent_ban), reinstate, strike history. Permanent ban requires confirm dialog (R-M04).
- **Data requirements:** `users` (status: active/suspended/banned); `seller_profiles` (status, suspension_ends_at, strike_count); `seller_strikes` (issued_by, strike_type, reason, is_active — R-M03 temp auto-lift); writes `moderation_logs` + `notifications` (R-M02). Suspended store/listings hidden not deleted (R-S07).
- **User flows:** Happy — find user → issue strike/suspend → notified. Edge — temp suspension auto-lifts after period (R-M03, pg_cron); permanent ban → confirm dialog (R-M04).
- **Empty state:** Filtered no-results state.
- **Loading state:** Table skeleton.
- **Error state:** Action toast; confirm-dialog guard for destructive ban.

### Listings Moderation (Admin)
- **Route:** `/admin/listings`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Listings (Admin)
- **Components:** Listing table (all stores), filters (status, category, flagged), detail view, remove/restore actions, auto-flag indicator.
- **Data requirements:** `listings` (admin sees all via RLS bypass; status, deleted_at); `flagged_content` (content_type='listing'); writes `moderation_logs` (remove_listing). Auto-flag keywords (R-M06) route to flagged queue.
- **User flows:** Happy — review listing → remove if violating (soft-delete R-L10). Edge — restore; auto-flagged listing review.
- **Empty state:** Filtered no-results.
- **Loading state:** Table skeleton.
- **Error state:** Action toast.

### Flagged Content Queue
- **Route:** `/admin/moderation/flags`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Content Moderation (R-M05/R-M06)
- **Components:** Flag queue (content_type listing|review, reason, severity, reporter_type, SLA 24h countdown), polymorphic content preview, actions (action/dismiss), severity sort.
- **Data requirements:** `flagged_content` (content_type, content_id polymorphic, reported_by/reporter_type, reason enum, severity, status pending→reviewed/actioned/dismissed, reviewed_by); resolves `listings` or `reviews` by content_id; writes `moderation_logs`. Review within 24h (R-M05).
- **User flows:** Happy — open flag → inspect content → action or dismiss. Edge — system auto-flag (reported_by NULL, R-M06); high-severity prioritization.
- **Empty state:** "Moderation queue is clear."
- **Loading state:** Queue skeleton.
- **Error state:** Action toast; content-preview retry.

### Reviews Moderation
- **Route:** `/admin/reviews`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Verify Reviews, Remove Review
- **Components:** Review list with filters (flagged, unverified), **verify badge toggle**, **hide/remove** (is_visible), review detail with photos.
- **Data requirements:** `reviews` (admin all; admin_verified toggle, is_visible toggle → hide without delete R-R06); `review_photos`; `flagged_content` (reviews); writes `moderation_logs`; rating recompute on removal (R-R07).
- **User flows:** Happy — verify legitimate review / hide policy-violating one. Edge — hidden review excluded from `rating_aggregates`.
- **Empty state:** "No reviews to moderate."
- **Loading state:** List skeleton.
- **Error state:** Action toast.

### Categories Management
- **Route:** `/admin/categories`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Categories
- **Components:** Category tree (drag-order), add/edit (name_ar/en, slug, icon_url, parent, sort_order), active toggle.
- **Data requirements:** `categories` (CRUD — RLS `cat_admin`; self-referential parent_id; slug UQ; is_active; sort_order). Used across search/homepage/listing forms.
- **User flows:** Happy — add subcategory → reorder → activate. Edge — deactivate category with active listings (hidden, not deleted); slug collision.
- **Empty state:** Seed-categories prompt on empty taxonomy.
- **Loading state:** Tree skeleton.
- **Error state:** Slug-collision inline; save toast.

### Orders Management (Admin)
- **Route:** `/admin/orders`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Orders (Admin)
- **Components:** Global orders table (all stores), filters (status, store, date), detail view (items, payments, history, shipment), admin override actions.
- **Data requirements:** `orders` (admin all); `order_items`; `payments`; `order_status_history`; `shipments`; writes `moderation_logs` for any intervention.
- **User flows:** Happy — investigate an order → view full trail. Edge — admin-forced cancellation (cancelled_by='admin').
- **Empty state:** Filtered no-results.
- **Loading state:** Table skeleton.
- **Error state:** Inline retry; action toast.

### Disputes Management (Admin)
- **Route:** `/admin/disputes` (queue) · `/admin/disputes/[id]` (detail)
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Disputes, Review Dispute, Resolve Disputes, Manage Inbox (Admin)
- **Components:** Dispute queue (reason, status, SLA 48h countdown, assignee), detail: order summary, buyer evidence gallery, **3-party message thread**, **assign-to-me**, **resolution form** (outcome buyer_favour/seller_favour/partial/no_action + notes), close.
- **Data requirements:** `disputes` (admin all; status submitted→under_review→awaiting_seller→resolved/closed; assigned_to; sla_deadline created_at+48h R-D02; resolution + resolution_notes R-D03); `dispute_evidence`; `dispute_messages` (sender_type admin); `orders`/`payments` (for refund-type, Process Refund); writes `moderation_logs` (resolve_dispute); resolution notifies both parties via push+SMS (R-D04). SLA breach (47h) admin SMS alert (R-D05/R-N05).
- **User flows:** Happy — assign → review evidence → message parties → resolve with outcome. Edge — refund_request resolution touches `payments.status='refunded'` (Process Refund); SLA-breach escalation.
- **Empty state:** "No open disputes."
- **Loading state:** Queue + detail skeletons.
- **Error state:** Resolution-submit toast; thread send-retry.

### Payments Management (Admin)
- **Route:** `/admin/payments`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Payments, Process Refund, Process Payment
- **Components:** Payment ledger (all orders, deposit/balance, method, status), filters, **deposit-verification action (view the buyer's uploaded transfer screenshot `proof_path`; confirm → `status='confirmed'`)**, **COD-balance confirm (after the courier remits to BETK)**, **order-closure action (the settlement signal, OD-8 §3 step 7)**, refund action, order link.
- **Data requirements:** `payments` (admin all; status pending/confirmed/failed/refunded; payment_type deposit/balance; **`proof_path` signed-URL fetch from the private `docs` bucket**); `orders` (**closure**); `disputes` (refund context); writes `confirmed_by`/`confirmed_at` on confirmation + `moderation_logs`. **Custodial (OD-8/ADR-016): admin — not the seller — verifies the deposit; awaiting-review = `proof_path IS NOT NULL AND status='pending'`. `/admin/payments` is now an operational surface (not just refunds).**
- **User flows:** Happy — **open a pending deposit → view the buyer's proof screenshot → confirm** (unblocks the seller's acceptance); **confirm the COD balance after courier remittance → close the order** (the seller's balance becomes payable after the return-hold window); locate a payment → process refund (status→refunded). Edge — failed/duplicate deposit reconciliation (composite uniqueness order_id+payment_type, C2 §7.3); missing/illegible proof → reject / request re-upload.
- **Empty state:** Filtered no-results.
- **Loading state:** Ledger skeleton.
- **Error state:** Refund-action toast.

### Payouts Management (Admin)
- **Route:** `/admin/payouts`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Payouts (WF10, R-O10)
- **Components:** Payout request queue (store, amount, method, account_details, status), process / reject (reason) actions.
- **Data requirements:** `payouts` (admin all; status pending→processing→processed/rejected; processed_by, processed_at, rejection_reason); writes `moderation_logs`; notifies seller. Manual processing only (R-O10). Admin must not enter the seller's payout credentials anywhere — they transfer externally and record the outcome.
- **User flows:** Happy — review request → mark processing → processed → seller notified. Edge — reject below-minimum or invalid details (R-O09).
- **Empty state:** "No payout requests."
- **Loading state:** Queue skeleton.
- **Error state:** Action toast.

### Editorial Collections
- **Route:** `/admin/collections` (list) · `/admin/collections/[id]` (editor)
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Manage Editorial Collections
- **Components:** Collection list (status, homepage_position), editor (name_ar/en, description, homepage_position, status draft/live/scheduled/archived, publish_at/archive_at scheduling), **listing picker with drag-order**.
- **Data requirements:** `collections` (CRUD — RLS `collections_admin`; created_by, homepage_position, status, publish_at/archive_at scheduling); `collection_listings` (junction, sort_order, unique collection+listing); `listings` for the picker. Live collections power Homepage.
- **User flows:** Happy — create collection → add/reorder listings → schedule publish. Edge — scheduled (publish_at future); archive_at seasonal auto-archive.
- **Empty state:** "No collections — create one for the homepage."
- **Loading state:** List + editor skeletons.
- **Error state:** Save toast; picker retry.

### Notifications Broadcast
- **Route:** `/admin/notifications`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Send Notifications (MW4 bulk broadcast)
- **Components:** Audience selector (all buyers / all sellers / by category), channel selector (push/sms/whatsapp/email), message composer, **WhatsApp template selector** (for whatsapp channel), preview, send + delivery summary.
- **Data requirements:** Writes `notifications` (fan-out per recipient: user_id, type, channel, title, body, data); `whatsapp_templates` (event_type, language, body_template — referenced for the whatsapp channel; channel prefs honored R-N01/R-N02). Audience resolved from `users`/`buyer_profiles`/`seller_profiles`. **Note:** MW4 broadcast (audience selection, templating, delivery tracking) is documented as a *missing workflow* (C1 §6.3) — UI is specified here; delivery-tracking persistence beyond per-row `notifications` is not modeled.
- **User flows:** Happy — pick audience + channel → compose (template for WhatsApp) → send. Edge — WhatsApp requires approved template (R-N02); large audience confirmation dialog.
- **Empty state:** N/A (compose form).
- **Loading state:** Send progress / delivery counter.
- **Error state:** Per-channel failure summary; confirm dialog before mass send.

### WhatsApp Templates (merged — Admin → Settings → Notifications)
- **Route:** `/admin/settings` → **Notifications tab** (no standalone route; OD-5 FROZEN)
- **Auth gate:** role: admin
- **Layout:** AdminShell (sub-tab of Admin Settings)
- **Use case(s):** Send Order/Payment Confirmation (WhatsApp) — template management
- **Components:** Within the Settings "Notifications" tab: template list (name, event_type, language, active), editor ({{variable}} placeholders), activate/deactivate. (No separate nav item.)
- **Data requirements:** `whatsapp_templates` (name UQ, event_type, language ar/en, body_template, is_active). Per C3 §8.2 RISK 1, **log all template changes** to `moderation_logs`.
- **User flows:** Happy — open Settings → Notifications tab → edit template → activate. Edge — deactivate without delete.
- **Empty state:** "No templates configured."
- **Loading state:** List skeleton.
- **Error state:** Save toast; name-uniqueness inline.

### Admin Settings
- **Route:** `/admin/settings`
- **Auth gate:** role: admin (superadmin for sensitive keys)
- **Layout:** AdminShell
- **Use case(s):** Admin Settings; Moderation Rules (R-M06)
- **Components:** Tabs — **General** (key-value config: seller_approval_sla_hours, dispute_sla_hours, low_stock_default, **auto-flag keywords**, fee rates; descriptions per key; boost-package management link) and **Notifications** (WhatsApp template management — see merged section above, OD-5).
- **Data requirements:** `admin_settings` (key PK, value, description, updated_by — RLS `settings_admin`; add CHECK on numeric keys per C3 §8.2 RISK 2); `whatsapp_templates` (Notifications tab); auto-flag keywords drive R-M06; SLA thresholds drive R-M01/R-D02. Boost packages via `boost_packages`.
- **User flows:** Happy — adjust SLA/keyword config → save (no deploy). Edge — superadmin-only sensitive keys; invalid value type.
- **Empty state:** Seeded defaults.
- **Loading state:** Settings-list skeleton.
- **Error state:** Per-key validation; save toast.

### Moderation Log
- **Route:** `/admin/moderation/log`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Moderation Log tab (R-M02)
- **Components:** Immutable audit table (admin, action, target_type, target_id, reason, timestamp), filters (admin, target_type, date), read-only.
- **Data requirements:** `moderation_logs` (read-only — RLS `modlog_admin`; immutable, no UPDATE/DELETE; index target_id/admin_id/created_at). Append-only audit trail (R-M02).
- **User flows:** Happy — audit who-did-what. Edge — filter by target entity to reconstruct a case.
- **Empty state:** "No moderation actions logged yet."
- **Loading state:** Table skeleton.
- **Error state:** Inline retry (read-only, no mutations).

### Boost Approval (Admin)
- **Route:** `/admin/boosts`
- **Auth gate:** role: admin
- **Layout:** AdminShell
- **Use case(s):** Boost Payment Verification (MW3, R-B02); Admin Boost Config
- **Components:** Pending-payment boost queue (store, listing, package, amount, method), **confirm-payment** action (activates boost), boost-package config (24/48/72h, prices, active toggle).
- **Data requirements:** `boosts` (status='pending_payment' → confirm sets payment_confirmed_by/at, starts_at, expires_at=starts_at+duration, status='active' R-B02); `boost_packages` (CRUD); writes `moderation_logs`. Expiry via pg_cron (R-B03).
- **User flows:** Happy — verify seller's external payment → confirm → boost active within 5 min (R-B02). Edge — non-payment/timeout → cancel; concurrent-boost guard (R-B01).
- **Empty state:** "No boosts awaiting confirmation."
- **Loading state:** Queue skeleton.
- **Error state:** Confirm-action toast.

---

## 4. Shared Components

Components appearing across multiple pages, with the tables/enums they consume.

- **`AppTopbar` / `MobileBottomNav`** — public + buyer surfaces. Reads session, `notifications` unread count (partial index), search entry.
- **`SellerSidebar` / `AdminSidebar`** — console navigation; SLA counters on admin (`seller_profiles` pending, `disputes`/`flagged_content` SLA).
- **`ListingCard`** — Homepage, Search, Category, Storefront, Wishlist, Collections. Consumes `listings` + `listing_images` (hero) + `rating_aggregates` + boost badge (`boosts.status='active'`).
- **`StoreCard`** — Homepage, Following, Search. Consumes `stores` + `seller_profiles.level` + `rating_aggregates`.
- **`PriceBlock`** — Listing Detail, Create/Edit Listing, Checkout. Renders `listings.price` by `price_type` (fixed/per_hour/starting_from/quote_only).
- **`StatusBadge`** — centralized enum→color/label map for `order_status`, `seller_status`, `dispute_status`, `payment_status`, `boost_status`, `listing_status`, `flag_status`, `payout_status` (C3 §2). Single source of truth for status color tokens.
- **`StarRating`** — Listing Detail, Storefront, Leave Review, Reviews Management. `reviews.rating` (1–5).
- **`RatingSummary`** — Storefront, Listing Detail, Seller Dashboard. `rating_aggregates` (average + distribution rating_5…rating_1).
- **`LevelBadge`** — Storefront, Store header, Dashboard, Level Progress. `seller_profiles.level`.
- **`VerifiedBadge`** — Storefront, Listing Detail. `seller_profiles.is_verified`.
- **`MessageThread`** — Buyer Inbox, Seller Inbox (`inquiry_messages`), Order Detail (`order_messages`), Dispute Detail (`dispute_messages`). Parameterized by `sender_type` and source table.
- **`ImageUploader`** — Create/Edit Listing (`listing_images` ≤5), Onboarding (`seller_documents`), Leave Review (`review_photos` ≤3), Raise Dispute (`dispute_evidence` ≤5), Store Settings (avatar/cover). Handles WebP conversion + ordering + signed-URL preview.
- **`OrderTimeline`** — Order Detail (buyer + seller). `order_status_history` ordered.
- **`AddressForm` / `AddressSelect`** — Address Book, Checkout. `addresses`.
- **`FilterSheet`** — Search, Category. `categories` tree + governorate/city + price + type.
- **`SLABadge`** — Approval queue, Disputes, Flagged content, Admin dashboard. Countdown from `submitted_at`/`sla_deadline`.
- **`EmptyState`** / **`SkeletonGrid`** / **`SkeletonTable`** / **`ErrorRetryCard`** — universal state primitives (see §6).
- **`ConfirmDialog`** — every irreversible/destructive action (cancel order, delete listing, permanent ban R-M04, account delete, mass broadcast).
- **`Toaster`** — global toast host (shadcn).

---

## 5. Auth Flow

Step-by-step states, mapped to `users`, `otp_tokens`, `sessions`, and C3 §5 RLS.

1. **Unauthenticated (guest).** No `sessions` row; `auth.uid()` null. Public RLS grants read on active stores/listings/categories, visible reviews, live collections. UI: public shell, write controls render but route to login on tap.
2. **Login start (`/auth/login`).** Two paths (OD-4): **(a) Phone** — enter E.164, system checks `users.phone_number` (R-A03) → new vs returning → creates `otp_tokens` (`token_hash`, `expires_at=NOW()+60s`, one active/phone R-A02). **(b) Google OAuth** — Supabase OAuth; on return, find-or-create `users` with `auth_provider='google'` and `phone_number=NULL`. No passwords either way (R-A01 amended).
3. **OTP challenge (`/auth/verify`).** Validate code vs `otp_tokens` (hash, not expired, not used, `attempt_count ≤ 5`). On failure: resend (after expiry) or lockout. Suspended/banned blocked here (R-A05).
4. **Session established.** On success: create `sessions` (token_hash, device_info, expires_at 30d mobile / 24h web), set `users.last_login_at`, mark token used. `auth.uid()` now resolves; RLS self-scoping active.
5. **Profile gate.** If buyer has no `buyer_profiles` row → `/auth/register` (complete profile). Otherwise proceed.
6. **Role routing.** Resolve `users.role`:
   - `buyer` → `/` (buyer shell).
   - `seller` → check `seller_profiles.status`: `active` → `/seller`; `pending`/`rejected` → `/seller/status`; `suspended`/`banned` → restricted status view.
   - `admin` / `superadmin` → `/admin` (`is_admin()` true).
7. **Authenticated steady state.** Every authenticated request updates `sessions.last_active_at` and re-checks `users.status` and `deleted_at` (R-A05). Role/store scoping enforced by RLS. **Transaction gate (OD-4):** before checkout, becoming a seller, or requesting a payout, the app requires `users.phone_number IS NOT NULL` (verified); a Google-only user is sent through a phone+OTP step at that moment, then continues.
8. **Re-verification / phone change.** Phone is read-only post-registration (R-A06); change requires a fresh OTP cycle.
9. **Logout / expiry.** Session invalidated; revert to guest. Multi-device sessions are independent (`users` 1:N `sessions`).

---

## 6. UI State Standards

### Loading patterns — skeleton vs spinner
- **Skeletons** for any view rendering data from a table fetch (lists, grids, tables, dashboards, detail pages). Match the final layout (card grid → card skeletons; table → row skeletons). Render progressively: each dashboard widget / homepage strip resolves independently rather than blocking the whole page.
- **Spinners** only for in-place actions with no layout to preview: button submission ("Sending code…", "Placing order…"), inline save, image-upload progress, OTP verification.
- **Rule of thumb:** *navigation/data load → skeleton; user-triggered mutation → spinner on the triggering control.* Never show a full-page spinner where a skeleton can preview structure.

### Empty state copy and CTA standards
- Every empty state = one-line plain-Arabic explanation + a single primary CTA toward the unblocking action (e.g. Wishlist empty → "ابدأ بحفظ ما يعجبك" + Browse; no listings → Add listing; no orders → Browse).
- Distinguish **no-data-yet** (encouraging, with CTA) from **filtered-no-results** (offer "clear filters"). Never a bare "No data".
- Admin queues use a *positive* empty state ("Queue is clear") — absence of work is good news.

### Error message patterns
- **Field-level:** inline, beneath the input, specific and actionable (format, required, uniqueness/slug collision).
- **Section-level:** `ErrorRetryCard` scoped to the failed region (a homepage strip, a dashboard widget) so the rest of the page survives.
- **Page-level:** full-page retry card only when the primary resource fails entirely; `404` for missing/non-owned/soft-deleted entities (RLS denial is surfaced as not-found, not "forbidden", to avoid leaking existence).
- **Action failure:** toast with a retry affordance; never lose user input on failure (preserve form/query state). No partial writes (checkout order creation is atomic; split-payment rows created together).
- Copy is non-technical; never expose SQL/RLS/internal reasons.

### Toast vs modal decision rule
- **Toast** — non-blocking confirmation or recoverable failure of a completed/attempted action that does **not** require a decision: saved, sent, status advanced, copied, "couldn't save — retry". Auto-dismiss; one retry action max.
- **Modal (`ConfirmDialog`)** — *before* any irreversible or high-consequence action, to gather an explicit decision: cancel order, delete/remove listing, **permanent ban (mandatory, R-M04)**, account deletion, payout reject, dispute resolution, mass notification broadcast. Blocks until confirmed/cancelled.
- **Rule:** *consequence already happened, no decision needed → toast. Consequence is destructive/irreversible and needs consent → modal.* Inline validation (not modal/toast) handles form correctness.

---

## 4. Localization & theming (OD-7)

BETK is a **bilingual Arabic/English** app with **light/dark** theming over the existing 59 pages — **no new pages/tables/content columns, no translation service** (ADR-011, `docs/02-architecture/ADR.md`; scope OD-7). This section is the ground truth for how any page localizes.

- **Locales & URLs.** `ar` (default) + `en`. Routing is `localePrefix: 'as-needed'`: **Arabic is unprefixed** (existing URLs/SEO unchanged — `/`, `/listing/[id]`, `/seller`, …); **English is mirrored under `/en`** (`/en`, `/en/listing/[id]`, …). A locale outside `{ar, en}` is a **404**. Locale persists via the URL + `NEXT_LOCALE` cookie.
- **Direction & fonts.** `<html dir lang>` derives from the locale: **ar → `dir="rtl"` `lang="ar"`**, **en → `dir="ltr"` `lang="en"`**. Keep using logical Tailwind utilities (`ps-*/pe-*/ms-*/me-*/start-*/end-*`) so the same components mirror correctly under LTR; no raw `left/right` in shared components. LTR islands (Latin handles, BETK refs, tracking numbers) still use `dir="ltr"` wrappers.
- **Theme.** Light/dark via `next-themes`, class strategy on `<html>` (`.dark`), matching the Phase 01 T03 tokens; `defaultTheme="system"`. Theme persists in `localStorage`. No DB column.
- **What is translated vs shown as-authored:**
  - **Shell chrome** (nav, buttons, labels, empty/error/validation copy) → `next-intl` catalogs `messages/{ar,en}.json` (BETK owns EN copy).
  - **Structured lists** (categories, badges, statuses, filters, governorates, delivery) → existing `*_ar`/`*_en` columns.
  - **Names/titles** (listing titles, store/collection/category names) → **`localizedName()` = `COALESCE(locale column, other)`**, never blank (`title_en` is nullable — no migration; the seller-entered bilingual title is a Phase-04 listing-form decision).
  - **Descriptions / store bios / custom-order notes** → a **single field in the author's language, shown as-authored to everyone**. No translation, no fallback (an English user may see an Arabic description — accepted).
  - **Transactional/structured fields** (price, stock, condition, dates) → language-neutral/enum.
- **Switch location.** The language switch (AR ↔ EN) and theme switch (light/dark/system) live in **Account → Settings** (built in BL-03). Switching language keeps the user on the same page in the other locale.
- **Deferred papercut.** `order_items` snapshots only `listing_title_ar`, so English buyers' order history shows the Arabic title (fixing = a future `_en` column, out of OD-7 scope).

---

## Acceptance matrix — AR-RTL / EN-LTR × light / dark (OD-7)

Every screen in the frozen page inventory must pass in **four cells**: `{ar-RTL, en-LTR} × {light, dark}`. Check a cell off (`☑`) only when that screen has shipped and been UI-reviewed in that context (from Phase 03 **T02** onward). **Screen inventory is FROZEN — no screen added or removed here.** Rows are the documented pages of §3, grouped by surface. Legend: `☐` not yet shipped/verified · `☑` shipped + UI-reviewed.

> **Count reconciliation (docs-hygiene, RESOLVED 2026-07-16, R4):** §3 previously carried three disagreeing counts — a "**56 pages**" headline, **60 page headings**, and an `MVP_SCOPE §4` parenthetical breakdown summing to 61. **Verified count = 59 standalone routed pages** (counting rule: one count per distinct route; a tab/section merged into another page's route — *WhatsApp Templates*, merged under Admin → Settings → Notifications per OD-5 — does not count separately). §3 documents 60 page **headings**, of which 59 are standalone routed pages and 1 (*WhatsApp Templates*) is a merged tab. The "56" and "61" figures were pre-existing counting errors, now corrected to **59** everywhere the headline is cited (this doc, `MVP_SCOPE.md §4`'s breakdown — `Admin` corrected `18`→`16` standalone — `SESSION_CONTEXT.md`, `BETK_PRD.md`, `BETK_ARCHITECTURE.md §9`, `BETK_MASTER_EXECUTION_PROMPT.md`, `BETK_DESIGN_BRIEF.md`, `README.md`). **Screen inventory itself is unchanged — FROZEN** — this was a headline-arithmetic fix only, never an add/remove of any screen. The matrix below enumerates exactly the §3 pages, 1:1 with the verified inventory (60 rows incl. the WhatsApp Templates merged-tab row, footnoted as non-standalone).

### Public / Guest (5)
| Screen | ar-RTL light | ar-RTL dark | en-LTR light | en-LTR dark |
|---|---|---|---|---|
| Homepage | ☑ | ☑ | ☑ | ☑ |
| Search & Filter Results | ☑ | ☑ | ☑ | ☑ |
| Category Browse | ☑ | ☑ | ☑ | ☑ |
| Listing Detail | ☑ | ☑ | ☑ | ☑ |
| Public Storefront | ☑ | ☑ | ☑ | ☑ |

> **Phase 03 verification (T07 gate, 2026-07-19, Opus 4.8):** all 5 public screens shipped (T02–T06) + verified against a **populated** staging DB (`next start` runtime smoke, seeded via the integration harness then cleaned to zero residue). **ar-RTL and en-LTR** cells: proven live — each page returns 200 with the correct `<html lang/dir>`, populated grids/strips/tabs, and bilingual name/title COALESCE (a seeded `title_en` listing shows EN under `/en`, `title_ar` under `/`). **Dark cells (☑ = wiring-verified, not interactive-flip):** the `.dark` class strategy is confirmed live in the rendered document — `next-themes` anti-FOUC inline script (`classList`/`setAttribute`, `"dark"` token, theme `storageKey`) present in `<head>`, `<html>` carries the class attribute, and the `.dark` token block ships in `globals.css` (build green). An **interactive** in-browser dark flip was NOT executed this gate (no Playwright browser in this env — standing constraint, carried to the pre-launch Playwright pass, REG-11 class). Light cells are the fully-exercised runtime path.

### Auth (3)
| Screen | ar-RTL light | ar-RTL dark | en-LTR light | en-LTR dark |
|---|---|---|---|---|
| Phone Entry (Login / Register start) | ☐ | ☐ | ☐ | ☐ |
| OTP Verification | ☐ | ☐ | ☐ | ☐ |
| Complete Buyer Profile | ☐ | ☐ | ☐ | ☐ |

### Buyer (13)
| Screen | ar-RTL light | ar-RTL dark | en-LTR light | en-LTR dark |
|---|---|---|---|---|
| Account / Profile | ☐ | ☐ | ☐ | ☐ |
| Address Book | ☐ | ☐ | ☐ | ☐ |
| Wishlist & Saved | ☐ | ☐ | ☐ | ☐ |
| Followed Sellers | ☐ | ☐ | ☐ | ☐ |
| Buyer Inbox (Inquiries) | ✅ | ✅† | ✅ | ✅† |
| Checkout | ☐ | ☐ | ☐ | ☐ |
| Order Confirmation & Payment Instructions | ☐ | ☐ | ☐ | ☐ |
| Order History | ☐ | ☐ | ☐ | ☐ |
| Order Detail / Track Order | ☐ | ☐ | ☐ | ☐ |
| Leave Review | ☐ | ☐ | ☐ | ☐ |
| Raise Dispute | ☐ | ☐ | ☐ | ☐ |
| Dispute Detail / Thread (Buyer) | ☐ | ☐ | ☐ | ☐ |
| Notifications Center | ☐ | ☐ | ☐ | ☐ |

> **† (Phase 06 / T05, 2026-07-22):** **Buyer Inbox (Inquiries)** is the frozen §3 screen row for the buyer messaging surface, covering BOTH `/inbox` (list) and `/inbox/[id]` (thread) — 2 of the 4 Phase-06 messaging routes (the seller pair is the other row, below). Marked verified for AR-RTL + EN-LTR at the data/render layer: build prerenders both locales, i18n parity green, and the T03/T04 runtime smokes + the T05 throwaway lifecycle E2E proved `<html lang/dir>` + keyed copy + the confirmed-state checkout-enabled guidance banner live. **`✅†` (dark columns) = wiring-verified only** — `next-themes` `.dark`/`suppressHydrationWarning` code/build assertion; the interactive light↔dark flip stays in the pre-launch Playwright basket (BL-03/REG-11 precedent). Same honest footnote as the Phase-03/04/05 rows.

### Seller (22)
| Screen | ar-RTL light | ar-RTL dark | en-LTR light | en-LTR dark |
|---|---|---|---|---|
| Seller Onboarding (5-step) | ✅ | ✅† | ✅ | ✅† |
| Seller Application Status | ✅ | ✅† | ✅ | ✅† |
| Seller Dashboard | ✅ | ✅† | ✅ | ✅† |
| Store Profile Settings | ✅ | ✅† | ✅ | ✅† |
| Delivery Settings | ✅ | ✅† | ✅ | ✅† |
| Return Policy Settings | ✅ | ✅† | ✅ | ✅† |
| Payment Methods Settings | ✅ | ✅† | ✅ | ✅† |
| Listings Management | ✅ | ✅† | ✅ | ✅† |
| Create / Edit Listing | ✅ | ✅† | ✅ | ✅† |
| Stock & Inventory | ✅ | ✅† | ✅ | ✅† |
| Boost Listing | ☐ | ☐ | ☐ | ☐ |
| Boost Management / History | ☐ | ☐ | ☐ | ☐ |
| Seller Inbox (Inquiries) | ✅ | ✅† | ✅ | ✅† |
| Orders Management (Seller) | ☐ | ☐ | ☐ | ☐ |
| Order Detail (Seller) | ☐ | ☐ | ☐ | ☐ |
| Reviews Management (Seller) | ☐ | ☐ | ☐ | ☐ |
| Earnings | ☐ | ☐ | ☐ | ☐ |
| Transactions | ☐ | ☐ | ☐ | ☐ |
| Request Payout | ☐ | ☐ | ☐ | ☐ |
| Level Progress | ☐ | ☐ | ☐ | ☐ |
| Seller Analytics | ☐ | ☐ | ☐ | ☐ |
| Dispute Detail (Seller) | ☐ | ☐ | ☐ | ☐ |

> **† (Phase 04 / T08, 2026-07-20):** the 7 Phase-04 seller screens (Onboarding, Application Status, Dashboard = `/seller` landing, Store Profile, Delivery, Return Policy, Payment Methods) are marked verified for AR-RTL + EN-LTR at the data/render layer — build prerenders both locales for all 7, i18n Guard D parity 524/524, runtime smoke confirmed `<html lang/dir>` + keyed copy per task. **`✅†` (dark columns) = wiring-verified only**: `next-themes` `.dark` class strategy + `suppressHydrationWarning` are in place, but the interactive light↔dark flip is asserted by code/build, not a live browser toggle — the interactive flip stays in the pre-launch Playwright basket (BL-03/REG-11 precedent). Same honest footnote as the Phase-03 Public/Guest rows.
>
> **† (Phase 05 / T06, 2026-07-22):** the 3 Phase-05 seller screens (**Listings Management** `/seller/listings`, **Create / Edit Listing** `/seller/listings/new`+`/[id]/edit`, **Stock & Inventory** `/seller/inventory`) are marked verified for AR-RTL + EN-LTR at the data/render layer — build prerenders both locales (40-route table), i18n Guard D parity 668/668, per-task runtime smoke (T03 6-tab filter / T04 16/16 create+publish+checklist / T05 20/20 stock-state matrix + inline-edit + restock) confirmed `<html lang/dir>` + keyed copy live. **`✅†` (dark columns) = wiring-verified only** — same `next-themes` `.dark`/`suppressHydrationWarning` code/build assertion as above; interactive flip stays in the pre-launch Playwright basket. **Boost Listing / Boost Management stay `☐` — Phase 11 (FR-SEL-11/12), no boost surface shipped in Phase 05.**
>
> **† (Phase 06 / T05, 2026-07-22):** **Seller Inbox (Inquiries)** is the frozen §3 screen row for the seller messaging surface, covering BOTH `/seller/inbox` (list) and `/seller/inbox/[id]` (thread) — the other 2 of the 4 Phase-06 messaging routes (the buyer pair is the Buyer-section row above). Verified for AR-RTL + EN-LTR at the data/render layer (build both locales, i18n parity green; T04 runtime smoke 9/9 + the T05 lifecycle E2E proved the unread badge, seller-first-reply→`open→replied` + `avg_response_hours` update, CONFIRM/DECLINE cross-surface, and the REG-44 neutral buyer label / REG-45 no-WhatsApp posture live). **`✅†` dark = wiring-verified only** (same `next-themes` assertion; interactive flip → pre-launch Playwright).

### Admin (17 headings — incl. WhatsApp Templates as a merged tab)
| Screen | ar-RTL light | ar-RTL dark | en-LTR light | en-LTR dark |
|---|---|---|---|---|
| Admin Dashboard | ☐ | ☐ | ☐ | ☐ |
| Seller Approval Queue | ☐ | ☐ | ☐ | ☐ |
| User & Seller Management | ☐ | ☐ | ☐ | ☐ |
| Listings Moderation (Admin) | ☐ | ☐ | ☐ | ☐ |
| Flagged Content Queue | ☐ | ☐ | ☐ | ☐ |
| Reviews Moderation | ☐ | ☐ | ☐ | ☐ |
| Categories Management | ☐ | ☐ | ☐ | ☐ |
| Orders Management (Admin) | ☐ | ☐ | ☐ | ☐ |
| Disputes Management (Admin) | ☐ | ☐ | ☐ | ☐ |
| Payments Management (Admin) | ☐ | ☐ | ☐ | ☐ |
| Payouts Management (Admin) | ☐ | ☐ | ☐ | ☐ |
| Editorial Collections | ☐ | ☐ | ☐ | ☐ |
| Notifications Broadcast | ☐ | ☐ | ☐ | ☐ |
| WhatsApp Templates *(merged tab — Admin → Settings → Notifications; not a standalone page, OD-5)* | ☐ | ☐ | ☐ | ☐ |
| Admin Settings | ☐ | ☐ | ☐ | ☐ |
| Moderation Log | ☐ | ☐ | ☐ | ☐ |
| Boost Approval (Admin) | ☐ | ☐ | ☐ | ☐ |

---

## Appendix A — Gap Register

### [DATA GAP] — wireframe/use-case data needs with no matching table
- **Inventory / low-stock alert log** (Stock & Inventory page). C1 §6.1 and C2 §1 approved an "Inventory Alert" record, but the final schema has **no `inventory_alerts` table**. Low-stock is only derivable live from `listings.stock_qty ≤ low_stock_threshold`; no persisted alert/acknowledgement history exists.
- **Account-deletion / anonymization state** (Account page, MW1). RESOLVED (OD-2 FROZEN): `users.deleted_at` + `users.anonymized_at` added now; MVP behavior is deactivate-only (no anonymization); full MW1 is post-MVP.
- **Broadcast delivery tracking** (Notifications Broadcast, MW4). MW4 calls for delivery tracking of bulk sends; only per-recipient `notifications` rows exist — there is no campaign/batch entity to track aggregate delivery.

### [UI GAP] — tables with no corresponding documented wireframe page
- **`sessions`** — UI intentionally OUT for MVP (OD-5 FROZEN). `device_info` retained for a post-MVP security/active-sessions dashboard. Sessions are used only implicitly by the auth flow in MVP.
- **`whatsapp_templates`** — RESOLVED (OD-5 FROZEN): managed under Admin → Settings → Notifications tab; not a standalone page. Change-logging required (C3 §8.2 RISK 1).

### Coverage confirmation
- All other 41 physical tables map to at least one documented page above.
- All 70 use cases in the C2 §6 Coverage Matrix are represented by at least one page.
- No page references a data field without a backing table/column except where flagged **[DATA GAP]** above.

---

*End of BETK_UI_SPEC.md — derived from BETK Architecture Review Conversations 1–3; validated against the C2/C3 ERD, SQL schema, enums, and RLS policies.*

# BETK_ERD.md
> Step 3 of the BETK Dev OS. **v2 rewrite (B3, 2026-09-22).** Target schema at spec level. Stage C writes migrations. This file writes **no SQL**.
>
> **Authority, in order:** `docs/01-product/BETK_PRD.md` (B2 + B2-FIX, including the REG-82/83/84 pins) → `docs/01-product/BETK_MVP_SCOPE.md` → `docs/10-ai-development/BETK_V2_SCOPE_BASELINE.md` + `docs/10-ai-development/BETK_V2_ROLE_JOURNEYS.md`. The historical block at the bottom is the **v1 source being rewritten**, not the target.
>
> **Cite v2 sections §1–§13.** Do not cite the historical block as the v2 contract.
>
> **Money** is `NUMERIC(10,2)` on transactional EGP amounts (live-measured on `listings.price`, `order_items.unit_price` / `subtotal`, `orders.delivery_fee` / `subtotal` / `total_amount` / `commission_amount`, `payments.amount`, `payouts.amount`, `stores.min_order_egp`, `boost_packages.price_egp`, `boosts.amount_paid`). `commission_rate` stays `NUMERIC(5,2)`. Analytics aggregates stay at their live typmods (`gmv_egp` 14,2; `revenue_egp` / `boost_revenue_egp` 12,2). Never float. Never invent a `closed` / `settled` `order_status` member (OD-18).
>
> **Numbers taken at mint (re-read 2026-09-22 before taking):** occupied ODs ended at OD-19 (next free **OD-20**). Occupied REGs ended at REG-87 (next free **REG-88**). **Took OD-20** (this freeze) and **REG-88, REG-89** (gaps in §12). Did **not** take an ADR number. Next free after this mint: **OD-21**, **REG-90**. Next free ADR for B5: **ADR-020** (`ADR.md` ends at ADR-019).
>
> **B3-FIX (2026-09-22)** amended §3.1, §3.2, §3.6, §4, §6.2, §7, §8, §9, §11, §12, and §13 in place. Register re-read before any mint: header REG-01..REG-89, next free **REG-90**. **No REG taken. No OD taken. No ADR written.** Next free stays **REG-90**, **OD-21**, **ADR-020**.

---

> ## TABLES ARE FROZEN at 51 (OD-20). PAGES ARE STILL UNFROZEN pending B4.
>
> Live physical tables **today** = **43** (`betk` 41 + `betk_analytics` 2), measured in §1. That figure is **TRUE TODAY**.
>
> The v2 **target** inventory is **51** physical tables (`betk` 49 + `betk_analytics` 2). **OD-20 supersedes OD-6.** The baseline ~50 figure was an estimate and is not this freeze.
>
> Page count is **not** frozen here.

---

## 1. Live inventory (B3, 2026-09-22)

**Method.** MCP `execute_sql` on namespace `project-0-BETK-supabase-betk` (read-only `SELECT`). Not `BETK_DATABASE_SCHEMA.sql`.

```sql
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname IN ('betk', 'betk_analytics')
ORDER BY schemaname, tablename;
```

**Measured: 43.** `betk` **41**, `betk_analytics` **2**. Matches the expected 41+2, reported because it was measured.

| schema | tables (41) |
|---|---|
| `betk` | addresses, admin_settings, boost_packages, boosts, buyer_profiles, categories, collection_listings, collections, dispute_evidence, dispute_messages, disputes, flagged_content, inquiries, inquiry_messages, listing_images, listing_tags, listings, moderation_logs, notifications, order_items, order_messages, order_status_history, orders, otp_tokens, payments, payouts, rating_aggregates, restock_alerts, review_photos, reviews, seller_documents, seller_profiles, seller_strikes, sessions, shipment_tracking_events, shipments, store_follows, stores, users, whatsapp_templates, wishlists |
| `betk_analytics` | platform_snapshots, seller_snapshots |

**Counting rule (unchanged methodology, new total):** a table is a `pg_tables` row in `betk` or `betk_analytics`. Enums, functions, triggers, views, rules, and indexes are not counted.

Same session also read `pg_enum`, `pg_constraint`, `pg_policies`, `pg_trigger`, `pg_proc`, `pg_rules`, and `information_schema.columns`. Those results are the live facts cited below.

## 2. Table disposition and the freeze (OD-20)

Every live table has exactly one verdict. New tables cite at least one PRD code.

### 2.1 Live tables

| Live table | Verdict | Cited reason |
|---|---|---|
| `users` | **KEPT** | OD-4 holds. Phone, role, status, `deleted_at` / `anonymized_at` stay. No new column. |
| `otp_tokens` | **KEPT** | OD-4 attempt limiter. ADR-010. |
| `sessions` | **KEPT** | OD-5: sessions UI out; the table stays. |
| `buyer_profiles` | **KEPT** | Live `bp_self` is self or admin (measured). The v1 row-39 public name/governorate SELECT branch is **struck** (REG-44 WON'T-FIX, §H). v2 does not add it (N28 / R-V02 / REG-83). |
| `addresses` | **KEPT** | Buyer address book. Seller has no policy (live `addr_self`). R-V03 is the seller-pickup side, not this table. |
| `seller_profiles` | **KEPT** | Onboarding identity. Food artefacts go on `seller_documents` (R-S10), not a new profile column. |
| `seller_documents` | **KEPT-AMENDED** | R-S10: food packaging / label / expiry photos and the admin-only social URL are additional `doc_type` members. No new table (baseline §10). |
| `seller_strikes` | **KEPT** | R-E04 strike is never automatic; the table remains the admin act. |
| `stores` | **KEPT-AMENDED** | `delivery_options` and `category_primary` / `category_secondary` stay as columns and stop being authoritative (baseline §10 dead / REG-63 pattern). Approved categories move to `store_categories` (R-L20). Pickup **street** does not go on this public row (R-V03). |
| `store_follows` | **KEPT** | Unchanged follow graph. |
| `categories` | **KEPT** | Catalogue taxonomy. R-L20 points at it. |
| `listings` | **KEPT-AMENDED** | R-L18 weight and dimensions, R-L19 specs, R-L22 `prep_days`, FR-ADM-21 `stock_touched_at`. |
| `listing_images` | **KEPT** | Unchanged. |
| `listing_tags` | **KEPT** | Unchanged. |
| `wishlists` | **KEPT** | Unchanged. |
| `restock_alerts` | **KEPT** | OD-1 still derived for the alert *log*; this subscription table already exists and stays. |
| `inquiries` | **KEPT-AMENDED** | R-Q01–R-Q04 quote columns. Inquiry is price discovery, not checkout (R-O11). |
| `inquiry_messages` | **KEPT** | Quote thread. REG-42 column grant stays. |
| `order_messages` | **KEPT** | In-app order thread. FK follows the rename. No buyer address columns. |
| `orders` | **RENAMED** | Baseline §10: `orders` → `seller_orders`. Same relation (N27). Column moves are §6.2, not a second verdict. |
| `order_items` | **KEPT-AMENDED** | R-Q05 / REG-82: keep the quote link after checkout. Prep snapshot for R-F02. |
| `order_status_history` | **KEPT** | Append-only rules + `order_id` FK `NO ACTION` (measured, §4). Do not drop, recreate, or change that FK. |
| `payments` | **KEPT-AMENDED** | Still 2 rows per seller order (R-O17). N22 snapshot columns. Partial refund amount (R-U04 / R-O24). |
| `payouts` | **KEPT** | R-O09 / R-O10 / R-O29. Derived balance still has no ledger (R-O26). |
| `shipments` | **KEPT** | R-O12 one shipment per seller order. Columns unchanged. Write path becomes admin-only (§7, §8) because there is no courier principal (REG-78). |
| `shipment_tracking_events` | **KEPT** | Buyer/admin tracking. Seller SELECT removed (§8, R-V02). `location` must not be filled with the buyer city. |
| `reviews` | **KEPT** | REG-83: existing `UNIQUE (order_id)` is one review per seller order once `orders` is that seller order. No master FK. |
| `review_photos` | **KEPT** | Unchanged. |
| `rating_aggregates` | **KEPT** | R-R07 trigger stays. |
| `disputes` | **KEPT-AMENDED** | REG-84: `order_id` stays the seller order. No master FK. Add nullable `return_id` (R-U03). |
| `dispute_evidence` | **KEPT** | N25: do **not** reuse this for returns. |
| `dispute_messages` | **KEPT** | Unchanged. |
| `boost_packages` | **KEPT** | REG-80. v1 boost schema stands. |
| `boosts` | **KEPT** | REG-80. Partial unique one-active-boost (v1 §4) stays. |
| `notifications` | **KEPT** | R-N07 / R-N08. OD-3: no campaign table. |
| `collections` | **KEPT** | Discovery. |
| `collection_listings` | **KEPT** | Discovery. |
| `flagged_content` | **KEPT** | Moderation. |
| `moderation_logs` | **KEPT** | Append-only rules measured (`no_update_mod_log`, `no_delete_mod_log`). |
| `whatsapp_templates` | **KEPT** | OD-5. Launch channel is SMS (R-N07); templates stay. |
| `admin_settings` | **KEPT** | Columns unchanged. Key rows and the REG-69 allow-list change in §6.3. Not a new table. |
| `seller_snapshots` | **KEPT** | Analytics. FR-ADM-21 is derived from operational tables, not a new snapshot shape. |
| `platform_snapshots` | **KEPT** | Analytics. REG-80 boost revenue column stays. |

**Dropped live tables: none.**

### 2.2 New tables

| New table | PRD codes |
|---|---|
| `cart_items` | R-C02, R-C03, R-C06, R-Q05 |
| `master_orders` | R-O12, R-O13, R-O18, R-O02 |
| `returns` | R-U01, R-U03 |
| `return_evidence` | R-U02, N25 (dedicated; not `dispute_evidence`) |
| `agreement_acceptances` | R-G01, R-G03, R-G04, N26 |
| `store_categories` | R-L20 |
| `courier_rates` | R-K02, R-M07 |
| `store_pickup_addresses` | R-K05, R-V03, AC-VIS-2 |

`store_pickup_addresses` is the +1 against the baseline §10 estimate of ~7 new tables. Baseline §10 put pickup fields on `stores`. That is overridden here: live `stores_public` is a SELECT policy on the storefront row, and Postgres RLS cannot hide one column from buyers who can read the row. A street column on `stores` would be a buyer read of the seller pickup street (AC-VIS-2 / R-V03 fail). The street lives on a table buyers cannot select.

Not new, on purpose: escalation is columns on the seller order (OD-14, baseline §10, R-E05). No wallet (R-O26). No `inventory_alerts` (OD-1). No campaign (OD-3). No master dispute (REG-84). No courier user table (AC-COU-6). No agreement-prose table (R-G05 prose is lawyer content on public pages; versions are `admin_settings` keys).

### 2.3 Frozen total

| | Count |
|---|---|
| Live today | 43 |
| Renamed (still one table) | `orders` → `seller_orders` |
| Dropped | 0 |
| New | 8 |
| **v2 target** | **51** (`betk` 49 + `betk_analytics` 2) |

**OD-20.** v2 physical table count is **51**. This supersedes OD-6. Pages are not frozen.

## 3. Binding design inputs

### 3.1 REG-78 — courier is not an RLS principal

**Resolution (consistent with AC-COU-6).** AC-COU-6 forbids a test that requires a courier user role. `user_role` is not extended. There is no `auth.uid()` courier. The courier never selects `addresses`, `master_orders`, `buyer_profiles`, or `users`.

Admin already reads buyer name, phone, and address under `is_admin()` (§8, §9). A `SECURITY DEFINER` function is redundant for that read: `service_role` bypasses RLS without a definer, and ADR-012 rejected definer RPCs. **There is no `courier_label_payload` function in the target.**

Two branches, both for B5. Neither is a definer. The handoff mechanism (API or manual, R-K09) stays tied to the courier gate. This section does not pick the gate.

1. **Admin-initiated label (the path the target specifies).** An admin server action runs as the admin session. It reads `master_orders` and `store_pickup_addresses` under the admin’s own RLS and renders the label. No definer. No service role.
2. **Automated courier handoff with no admin session (not chosen).** If the courier gate later picks an automated handoff, a server-side `service_role` read is justified, because there is no admin `auth.uid()` to satisfy RLS. That path still needs no `SECURITY DEFINER` function. AC-COU-6 still holds: the courier has no login.

Shipment status writes (`dispatched`, `delivered`) stay **admin** writes. The seller cannot mark dispatched (AC-COU-4).

**ADR candidate for B5 (do not number it here):** “No courier RLS principal. Admin-initiated label is the admin’s own RLS read. An automated handoff, if later chosen, is a service-role read and still not a definer.” Next free ADR at B5 mint time is ADR-020.

### 3.2 N22 — validated, not overridden

**Direction holds.** One proof is stored on `master_orders` (`proof_path`, `transfer_reference`, `proof_uploaded_at`). At the single admin verification (R-O19), each child **deposit** row copies that proof reference onto `payments.proof_path` and `payments.transfer_reference`, and stamps `payments.proof_snapshot_at`.

**Why this matches the architecture.** Live evidence is `payments.proof_path` on the deposit row (OD-8, ADR-019). v2 has one proof (R-O18) and N deposit rows (R-O17). The canonical write is the master (one row). The copy at verification leaves each confirmed deposit row holding the reference that was verified, which is what a per-seller-order refund or dispute cites (R-O24, REG-84). The buyer does not write N proofs. Leaving child `proof_path` null would fork the column ADR-019 treats as the evidence on the payment row.

**ADR candidate for B5:** this changes ADR-019’s “buyer attaches `proof_path` on the deposit row”. v2 buyer writes the master; a BEFORE/AFTER verification trigger copies onto children. Seller SELECT on `payments` is removed (§8) so the snapshot is not a seller read.

**FR-SEL-17 is not computable on that map alone.** The seller can read `seller_orders.subtotal`, `commission_amount`, `status`, `confirmed_at`, and `delivered_at`, plus own `payouts`, own-store `disputes`, and own-store `returns`. The seller cannot read `payments`, and `return_hold_hours` stays off the REG-69 allow-list (REG-86). Deposit confirmation is `confirmed_at` (admin release). Balance confirmation, the refund total, and the hold deadline are not on any seller-readable table. §6.2 adds `balance_confirmed_at`, `refunded_amount`, and `payout_eligible_at` on `seller_orders`. Those columns carry no `proof_path` and no `transfer_reference`. Under the amended map the derived balance is computable from the seller’s own RLS.

### 3.3 REG-82 — cart restore path

Checkout consumes `cart_items` and copies `inquiry_id`, `is_custom`, `unit_price`, and `quantity` onto `order_items`. On payment-window expiry with no proof:

1. Stock restores (R-L11) for tracked lines.
2. For each `order_items` row of that seller order:
   - `inquiry_id IS NULL` (fixed price): insert a `cart_items` row with that snapshotted `unit_price` and `quantity`.
   - `inquiry_id IS NOT NULL`: follow `order_items.inquiry_id` → `inquiries.quote_expires_at`. If `quote_expires_at > now()`, insert the custom `cart_items` row. Otherwise do not insert; the buyer is prompted to request a new quote.

`cart_items.inquiry_id` is the same link while the line is still in the cart (expiry before checkout blocks the line, R-C05 / R-Q06). Blocked is **derived** (live `stock_qty` or `quote_expires_at`), not a stored flag.

### 3.4 REG-83 and REG-84

- Reviews: `reviews.order_id` → `seller_orders(id)`, `UNIQUE (order_id)` kept. No `master_order_id`. One buyer review per seller order.
- Disputes: `disputes.order_id` → `seller_orders(id)`, `UNIQUE (order_id)` kept. No master dispute table and no `master_order_id`. `return_id` nullable → `returns(id)` for R-U03 only.

### 3.5 F-MODE — `delivery_preference`

Behaviour is courier-only (OD-10, R-K01). Schema fate:

- Enum `delivery_preference` **KEPT** with members `delivery`, `pickup`, `remote`. Members are not dropped (live rows use them; PostgreSQL will not drop a used label cleanly; baseline §10 REG-63 pattern retains dead members).
- `seller_orders.delivery_method` **KEPT** `NOT NULL`. Existing values, including the 7 history-bearing orders, are **not rewritten**. New checkouts write `delivery` only. Fee logic ignores the column and uses `courier_rates` → `delivery_fee`.
- `inquiries.delivery_preference` **KEPT** nullable. New quotes do not require it.

The column carries no v2 behaviour. It is not dropped, because dropping it is unnecessary and the historical value is the only record of what v1 stored.

### 3.6 REG-81 — child display reference

`seller_orders.display_ref` `varchar(64)` **NULL**. Partial unique: one non-null value. **No format CHECK.** The journeys example `BETK-2026-000123` is not adopted.

The buyer-facing number is `master_orders.betk_ref` (R-O02, format already pinned: `BETK-YYYYMMDD-XXXX`). `seller_orders.betk_ref` is **kept** (§4): existing values stay, new rows write NULL, and it is not the v2 buyer-facing number. `display_ref` is the child ref. It stays NULL until a product pin fills it. Stage C must not invent the format. A seller who can read the legacy `betk_ref` is reading an order number, not a buyer name or a location.

### 3.7 REG-80 — boosts

`boost_packages` and `boosts` are **KEPT**. No new boost table, column, or enum member.

### 3.8 REG-75 / N26 — buyers on `agreement_acceptances`

The table accepts `document = buyer_terms` for any user, and `seller_agreement` for a seller. Backfill versus forced re-accept is **not decided here** (REG-75 stays open).

### 3.9 R-V01 clarification (buyer’s own address book)

R-V01’s sentence “addresses are never exposed to buyer or seller” is applied as **cross-party** exposure. The buyer still selects and reads their own `addresses` rows (they typed them; checkout cannot work otherwise). R-V03 / AC-VIS-2 is the buyer not reading the seller pickup street. R-V02 is the seller not reading buyer name, phone, address, or city.

## 4. N27 feasibility

**Constraint (signed).** Staging migrates. It does not reset. Every existing `betk.orders` row becomes a seller order under a synthetic master. The 7 history-bearing orders cannot be deleted.

**Live verification (same MCP session).**

Rules (`pg_rules`):

- `no_update_order_history` — `ON UPDATE TO betk.order_status_history DO INSTEAD NOTHING`
- `no_delete_order_history` — `ON DELETE TO betk.order_status_history DO INSTEAD NOTHING`

FK (`pg_constraint.confdeltype = 'a'`, which is NO ACTION):

- `order_status_history_order_id_fkey` — `FOREIGN KEY (order_id) REFERENCES betk.orders(id)`

History-bearing orders (7 rows):

| id | status | created_at (UTC) | history rows |
|---|---|---|---|
| `81147596-94ee-4a25-b634-34c043409242` | pending | 2026-07-23 20:22:15 | 1 |
| `b327bfb8-f807-418e-9448-1fb645351f3b` | pending | 2026-07-23 20:22:16 | 1 |
| `e5d776fc-1402-484e-84c4-d2b441f5868f` | cancelled | 2026-07-23 20:22:17 | 1 |
| `02482319-a2a7-4b54-aaf1-8c24b5a95150` | confirmed | 2026-07-23 20:22:17 | 1 |
| `41c5b2c2-e5e0-4a60-9d28-3dc467a23a2a` | pending | 2026-07-23 20:23:40 | 1 |
| `da73deed-0670-4cc7-bccd-064b8d301b6f` | cancelled | 2026-07-23 20:23:42 | 1 |
| `c7ba4f04-eefd-489a-b8de-5daa917e998b` | confirmed | 2026-07-23 20:23:43 | 1 |

**Orders-family decisions checked against that constraint**

| Target decision | Feasible? | Why |
|---|---|---|
| Rename `orders` → `seller_orders` in place | Yes | Rename keeps the relation. History FK follows. Do **not** drop and recreate. |
| Keep history rules and NO ACTION FK | Yes | Spec keeps both. CASCADE or SET NULL on `order_id` would be a different (forbidden) choice. |
| One synthetic `master_orders` row per existing order; copy `buyer_id`, `delivery_address_id`, `betk_ref` onto the master | Yes | Adds a parent. Does not delete the child. 1:1 because v1 orders are single-seller. The child **keeps** its copies (B3-FIX). |
| Add `master_order_id` NULL, backfill, then NOT NULL | Yes | The 7 rows get a parent before the constraint tightens. |
| Drop `buyer_id`, `delivery_address_id`, `betk_ref` from the seller order | **Not in the target** | B3-FIX §4.1. Bare uuids are not buyer identity. `betk_ref` is an order number. Nullability of `betk_ref` relaxes so new rows can be NULL. |
| Leave `delivery_method` and `status` as stored (`pending` / `confirmed` / `cancelled`) | Yes | No status rewrite through `enforce_order_transition`. |
| `display_ref` NULL on the 7 | Yes | REG-81. No format required to migrate. |
| Add enum label `ready` | Yes | `ADD VALUE` does not rewrite rows. Do not rename or remove `pending` (the 7 and their history use it). |
| Rework `enforce_order_transition` before any drop of `buyer_id` | Latent | The column is **kept**. The live function reads `OLD.buyer_id` (§4.1). A later drop, if one is ever reopened, reworks this function first. This spec does not drop the column. |
| Detach `decrement_stock_on_confirm` from the confirm transition | Yes | Trigger drop. Rows stay. |
| Drop `create_order_from_inquiry` and `set_inquiry_converted_order` | Yes | Functions/trigger. `inquiries.converted_to_order_id` FK stays (NO ACTION, nullable). |

**No orders-family choice in this spec requires dropping or recreating `orders` or `order_status_history`.** N27 is not blocked.

### 4.1 Drop blast radius (B3-FIX, live, 2026-09-22)

B3 named three column drops on `orders`: `buyer_id`, `delivery_address_id`, `betk_ref`. No other target column is dropped. Each was re-checked with `pg_depend` (column `attnum`), `pg_policies` / `pg_policy`, `pg_proc` (`prokind = 'f'`, `pg_get_functiondef`), `pg_trigger`, `pg_indexes`, `pg_rules`, and views (`pg_class.relkind` `v`/`m`). Views: none. Rules: none. Other schemas: none.

**`orders.buyer_id`**

`pg_depend`:

- constraint `orders_buyer_id_fkey` on `betk.orders` (`deptype` `a`)
- index `betk.idx_orders_buyer` (`deptype` `a`)
- policy `order_items_access` on `betk.order_items`
- policy `order_items_insert` on `betk.order_items`
- policy `order_messages_access` on `betk.order_messages`
- policy `order_messages_insert` on `betk.order_messages`
- policy `order_status_history_access` on `betk.order_status_history`
- policy `order_status_history_insert` on `betk.order_status_history`
- policy `orders_access` on `betk.orders`
- policy `orders_insert` on `betk.orders`
- policy `orders_update` on `betk.orders` (USING and WITH CHECK, two `pg_depend` rows)
- policy `payments_access` on `betk.payments`
- policy `payments_insert` on `betk.payments`
- policy `payments_update` on `betk.payments` (USING and WITH CHECK, two `pg_depend` rows)
- policy `shipment_tracking_events_access` on `betk.shipment_tracking_events`
- policy `shipments_access` on `betk.shipments`

`pg_proc` / `pg_trigger` (function bodies; plpgsql does not record a column `pg_depend`):

- `betk.enforce_order_transition` reads `OLD.buyer_id`. Trigger `trg_enforce_order_transition` on `betk.orders`.
- `betk.enforce_payment_update` references the order’s `buyer_id`. Trigger `trg_enforce_payment_update` on `betk.payments`.
- `betk.create_order_from_inquiry` names `buyer_id`. No trigger. Already marked DROP as a function (§7), which does not require dropping the column.

**`orders.delivery_address_id`**

`pg_depend`:

- constraint `orders_delivery_address_id_fkey` on `betk.orders` (`deptype` `a`)

`pg_proc`:

- `betk.create_order_from_inquiry` names `delivery_address_id`. No policy, index, trigger, view, or rule names it.

**`orders.betk_ref`**

`pg_depend`:

- constraint `uq_orders_betk_ref` on `betk.orders` (`deptype` `a`), backed by unique index `uq_orders_betk_ref`

`pg_proc`:

- `betk.create_order_from_inquiry` names `betk_ref`. No policy, trigger, view, or rule names it.

Policies that mention `buyer_id` on `addresses`, `inquiries`, `disputes`, `reviews`, `store_follows`, or `wishlists` reference those tables’ own columns. They are not dependents of `orders.buyer_id`.

**Why each drop is or is not required.** §9 treats a bare uuid as not a name, phone, address, or city. Joining `buyer_id` or `delivery_address_id` to `users`, `buyer_profiles`, or `addresses` is denied for the seller. Dropping either uuid is not required for N28. **Both columns stay.** `betk_ref` is an order number, not buyer identity. R-O02 is met by `master_orders.betk_ref`. A `NOT NULL` unique value on every child cannot be the one shared master number, so the child column becomes nullable and new checkouts write NULL. Dropping it is not required. **The column stays.** Stage C copies the three values onto the synthetic master and does not drop them from the child. The list above is the sequencing input if a later task reopens a drop: rework `enforce_order_transition` and `enforce_payment_update`, and replace `create_order_from_inquiry`, before `buyer_id` goes away.

**Separate, not N27:** a validated CHECK that every `listings.status = 'active'` row has weight and dimensions will fail until existing active listings are backfilled. Stage C adds that CHECK `NOT VALID` or backfills first (§6.3).

## 5. Enums

Live members are from `pg_enum` this session. Product state names in baseline §4.1 are mapped, not copied, where a new label would duplicate a live one or strand the 7 rows.

| Enum | v2 members | vs live |
|---|---|---|
| `order_status` | `pending`, `confirmed`, `preparing`, `ready`, `dispatched`, `delivered`, `cancelled`, `returned` | **AMENDED** — add `ready` only. **Do not add `pending_payment`.** Product “awaiting payment” is stored as live `pending` (B3 owns representation; PRD §3). **Do not add `closed` / `settled`** (OD-18). |
| `delivery_preference` | `delivery`, `pickup`, `remote` | **KEPT** — `pickup` and `remote` dead (F-MODE, §3.5). |
| `cancelled_by_type` | `buyer`, `seller`, `admin`, `system` | **KEPT** — `seller` is dead. Trigger must not stamp it (R-E01). |
| `payment_method` | `instapay`, `vodafone_cash`, `orange_cash`, `cod` | **KEPT** — `vodafone_cash` and `orange_cash` are dead on **buyer** payments (R-O15, baseline §10). Still used by `payout_method`. |
| `payment_status` | `pending`, `confirmed`, `failed`, `refunded` | **KEPT** |
| `payment_type` | `deposit`, `balance` | **KEPT** |
| `price_type` | `fixed`, `per_hour`, `starting_from`, `quote_only` | **KEPT** — only `fixed` is writable for publish (R-L17). Others dead. |
| `listing_type` | `product`, `service` | **KEPT** — `service` dead at publish (R-L16). |
| `inquiry_status` | `open`, `replied`, `confirmed`, `declined`, `expired` | **KEPT** — `confirmed` is no longer an order gate (R-O11). Quote send uses `replied` plus the quote columns. Expiry uses `expired`. |
| `doc_type` | live `national_id_front`, `national_id_back` **plus** `food_packaging`, `food_label`, `food_expiry`, `food_social_url` | **AMENDED** — R-S10. |
| `user_role` | `buyer`, `seller`, `admin`, `superadmin` | **KEPT** — no `courier` (AC-COU-6). |
| `escalation_reason` | `out_of_stock`, `damaged`, `cannot_fulfil`, `sla_breach` | **NEW** — R-E03, R-F03. |
| `return_status` | `requested`, `accepted`, `rejected`, `refunded` | **NEW** — R-U03. |
| `agreement_document` | `buyer_terms`, `seller_agreement`, `return_policy`, `privacy` | **NEW** — R-G05. |
| All other live enums (`auth_provider`, `boost_status`, `collection_status`, `content_type`, `dispute_reason`, `dispute_resolution`, `dispute_status`, `doc_review_status`, `flag_reason`, `flag_severity`, `flag_status`, `listing_status`, `moderation_target`, `notification_channel`, `payout_method`, `payout_status`, `seller_level`, `seller_status`, `sender_type`, `shipment_status`, `store_status`, `strike_type`, `user_status`) | unchanged | **KEPT** |

`dispute_status` already has `closed`. That is the dispute lifecycle, not order closure. Do not reuse it as an order status.

Master aggregate (`awaiting_payment`, `payment_submitted`, `in_progress`, `completed`, `partially_completed`, `cancelled`) is **derived at read** from children and proof (baseline §4.2, R-O25). **No master-status enum and no status column on `master_orders`.**

## 6. Per-table spec

ON DELETE is stated on every FK. “NO ACTION” means no `ON DELETE` clause (PostgreSQL default), matching live `confdeltype = 'a'`.

### 6.1 New tables

#### `cart_items` — R-C02, R-C06, R-Q05

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `buyer_id` | `uuid` | NO | |
| `listing_id` | `uuid` | NO | |
| `quantity` | `int2` | NO | |
| `unit_price` | `numeric(10,2)` | NO | |
| `is_custom` | `boolean` | NO | `false` |
| `inquiry_id` | `uuid` | YES | |
| `created_at` | `timestamptz` | NO | `now()` |
| `updated_at` | `timestamptz` | NO | `now()` |

- PK `id`.
- FK `buyer_id` → `users(id)` ON DELETE CASCADE.
- FK `listing_id` → `listings(id)` ON DELETE NO ACTION.
- FK `inquiry_id` → `inquiries(id)` ON DELETE NO ACTION.
- CHECK `quantity > 0`.
- CHECK `unit_price > 0`.
- CHECK `(is_custom = false AND inquiry_id IS NULL) OR (is_custom = true AND inquiry_id IS NOT NULL)`.
- Partial unique `(buyer_id, listing_id) WHERE inquiry_id IS NULL`.
- Partial unique `(buyer_id, inquiry_id) WHERE inquiry_id IS NOT NULL`.
- No `store_id`. Seller is `listings.store_id` at checkout (avoids a drifting copy).
- No `blocked` column. Derived (R-C05).

#### `master_orders` — R-O12, R-O13, R-O18

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `buyer_id` | `uuid` | NO | |
| `betk_ref` | `varchar(25)` | NO | |
| `delivery_address_id` | `uuid` | YES | |
| `recipient_name` | `varchar(100)` | YES | |
| `recipient_phone` | `varchar(15)` | YES | |
| `snapshot_governorate` | `varchar(50)` | YES | |
| `snapshot_city` | `varchar(100)` | YES | |
| `snapshot_street_address` | `text` | YES | |
| `snapshot_building_notes` | `text` | YES | |
| `combined_delivery_total` | `numeric(10,2)` | NO | |
| `proof_path` | `varchar` | YES | |
| `transfer_reference` | `varchar(100)` | YES | |
| `proof_uploaded_at` | `timestamptz` | YES | |
| `payment_deadline` | `timestamptz` | YES | |
| `created_at` | `timestamptz` | NO | `now()` |

- PK `id`. UNIQUE `betk_ref`.
- FK `buyer_id` → `users(id)` ON DELETE NO ACTION.
- FK `delivery_address_id` → `addresses(id)` ON DELETE NO ACTION.
- CHECK `combined_delivery_total >= 0`.
- No status column (derived).
- Snapshot columns are nullable so N27 synthetic masters can be inserted before copy. Checkout (new rows) writes them. Seller has no SELECT (§8).
- `combined_delivery_total` is the sum of child `delivery_fee` values written in the same checkout transaction (R-K03). Not a cross-table CHECK.

#### `returns` — R-U01

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `seller_order_id` | `uuid` | NO | |
| `buyer_id` | `uuid` | NO | |
| `store_id` | `uuid` | NO | |
| `reason` | `text` | NO | |
| `status` | `return_status` | NO | `requested` |
| `created_at` | `timestamptz` | NO | `now()` |
| `resolved_at` | `timestamptz` | YES | |

- PK `id`.
- FK `seller_order_id` → `seller_orders(id)` ON DELETE NO ACTION.
- FK `buyer_id` → `users(id)` ON DELETE NO ACTION.
- FK `store_id` → `stores(id)` ON DELETE NO ACTION.
- **No UNIQUE on `seller_order_id`.** R-U01 does not say one return per seller order. Do not invent one (REG not minted; the omission is the spec).

#### `return_evidence` — R-U02

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `return_id` | `uuid` | NO | |
| `storage_path` | `text` | NO | |
| `created_at` | `timestamptz` | NO | `now()` |

- PK `id`. FK `return_id` → `returns(id)` ON DELETE CASCADE.
- Not `dispute_evidence`.

#### `agreement_acceptances` — R-G03, R-G04

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `user_id` | `uuid` | NO | |
| `document` | `agreement_document` | NO | |
| `version_label` | `text` | NO | |
| `status` | `text` | NO | `'accepted'` |
| `accepted_at` | `timestamptz` | NO | `now()` |
| `ip` | `inet` | YES | |
| `user_agent` | `text` | YES | |

- PK `id`.
- FK `user_id` → `users(id)` ON DELETE NO ACTION.
- CHECK `status = 'accepted'` (baseline §8 names status; no other member is pinned).
- UNIQUE `(user_id, document, version_label)`. A new version is a new row (R-G06).
- Current version strings are admin-only `admin_settings` keys (§6.3). They are **not** on the REG-69 allow-list.
- Which of the four documents block checkout is **REG-88** (§12). The table can store all four. Stage C must not hard-code the gate set.

#### `store_categories` — R-L20

| Column | Type | Null | Default |
|---|---|---|---|
| `store_id` | `uuid` | NO | |
| `category_id` | `uuid` | NO | |
| `approved_at` | `timestamptz` | YES | |

- PK `(store_id, category_id)`.
- FK `store_id` → `stores(id)` ON DELETE CASCADE.
- FK `category_id` → `categories(id)` ON DELETE NO ACTION.
- Cap is `admin_settings.seller_category_limit`, not a constant CHECK of 3 (R-M07). Enforced by trigger §7.

#### `courier_rates` — R-K02

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | `uuid` | NO | `gen_random_uuid()` |
| `origin_governorate` | `varchar(50)` | NO | |
| `destination_governorate` | `varchar(50)` | NO | |
| `weight_min_g` | `integer` | NO | |
| `weight_max_g` | `integer` | YES | |
| `fee_egp` | `numeric(10,2)` | NO | |

- PK `id`.
- UNIQUE `(origin_governorate, destination_governorate, weight_min_g)`.
- CHECK `weight_min_g >= 0`.
- CHECK `weight_max_g IS NULL OR weight_max_g > weight_min_g`.
- CHECK `fee_egp >= 0`.
- Overlap of bands for the same origin×destination is not covered by that UNIQUE. Stage C adds an exclusion constraint so two bands cannot overlap. That is a constraint intent, not a new table.

#### `store_pickup_addresses` — R-K05, R-V03

| Column | Type | Null | Default |
|---|---|---|---|
| `store_id` | `uuid` | NO | |
| `governorate` | `varchar(50)` | NO | |
| `city` | `varchar(100)` | NO | |
| `street_address` | `text` | NO | |
| `building_notes` | `text` | YES | |
| `updated_at` | `timestamptz` | NO | `now()` |

- PK `store_id`. FK → `stores(id)` ON DELETE CASCADE.
- One row per store.
- Buyer SELECT: none. Public discovery city stays `stores.city` / `stores.governorate` (already public). Street does not.

### 6.2 `seller_orders` (renamed `orders`)

**Target columns** after the N27 copy-then-drop. Types below are the live typmods unless marked new.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `uuid` | NO | PK, `gen_random_uuid()` |
| `buyer_id` | `uuid` | NO | **KEPT (B3-FIX).** FK → `users(id)` ON DELETE NO ACTION. Bare uuid. Seller SELECT includes it. Name and phone do not resolve (§9). |
| `delivery_address_id` | `uuid` | YES | **KEPT.** FK → `addresses(id)` ON DELETE NO ACTION. Bare uuid. Address text does not resolve (§9). |
| `betk_ref` | `varchar(25)` | YES | **KEPT, nullability relaxed** (live column is `NOT NULL`). Existing values stay. New rows write NULL. Not the v2 buyer-facing number. Unique index `uq_orders_betk_ref` stays (multiple NULLs allowed). |
| `master_order_id` | `uuid` | NO | **NEW.** FK → `master_orders(id)` ON DELETE NO ACTION. Nullable only during backfill. |
| `store_id` | `uuid` | NO | FK → `stores(id)` NO ACTION. Kept. |
| `display_ref` | `varchar(64)` | YES | **NEW.** REG-81. Partial unique where not null. No format CHECK. |
| `inquiry_id` | `uuid` | YES | Kept. New checkout writes NULL (R-O11). FK NO ACTION. |
| `delivery_method` | `delivery_preference` | NO | Kept. F-MODE. New rows write `delivery`. |
| `delivery_fee` | `numeric(10,2)` | NO | default `0`. Snapshot of the matrix fee (R-K04). |
| `courier_rate_id` | `uuid` | YES | **NEW.** FK → `courier_rates(id)` ON DELETE SET NULL. |
| `subtotal` | `numeric(10,2)` | NO | Kept. |
| `total_amount` | `numeric(10,2)` | NO | Kept. CHECK `total_amount = subtotal + delivery_fee`. |
| `status` | `order_status` | NO | default `pending`. |
| `prep_deadline` | `timestamptz` | YES | **NEW.** Set at release: `confirmed_at + max(item prep)` (R-F01). |
| `escalated_at` | `timestamptz` | YES | **NEW.** R-E02. |
| `escalation_reason` | `escalation_reason` | YES | **NEW.** |
| `escalation_note` | `text` | YES | **NEW.** |
| `escalation_resolved_at` | `timestamptz` | YES | **NEW.** |
| `cancelled_by` | `cancelled_by_type` | YES | Trigger-stamped. Never `seller`. |
| `cancellation_reason` | `text` | YES | Kept. |
| `notes` | `text` | YES | Kept. |
| `created_at` | `timestamptz` | NO | `now()` |
| `confirmed_at` | `timestamptz` | YES | Stamped at **admin release**, not seller acceptance. This is the deposit-confirmed fact the seller reads. No second deposit timestamp. |
| `delivered_at` | `timestamptz` | YES | Kept. |
| `balance_confirmed_at` | `timestamptz` | YES | **NEW.** Stamped when that child balance `payments` row is confirmed. No proof column. |
| `refunded_amount` | `numeric(10,2)` | NO | **NEW.** Default `0`. CHECK `>= 0`. Rollup of that child’s `payments.refunded_amount`. No proof column. |
| `payout_eligible_at` | `timestamptz` | YES | **NEW.** Stamped on `delivered` as `delivered_at` plus the then-current `return_hold_hours`, inside the DEFINER transition. The seller reads the timestamp. The settings key stays admin-only (REG-86). |
| `commission_rate` | `numeric(5,2)` | YES | CHECK 0–100. Snapshot at insert (R-O27). |
| `commission_amount` | `numeric(10,2)` | YES | CHECK `>= 0`. Subtotal only, never delivery. |

CHECK `(escalated_at IS NULL) OR (escalation_reason IS NOT NULL)`.

**Kept (B3-FIX):** `buyer_id`, `delivery_address_id`, `betk_ref`. B3 had removed them after the master copy. The drop is not required (§4.1). The master still receives its own copies. Seller SELECT of this row includes the two uuids and, on legacy rows, `betk_ref`. It includes no buyer name, phone, address text, governorate, or city, and no `proof_path` or `transfer_reference`.

**Seller balance (FR-SEL-17 / OD-18 / R-O26 / AC-CLO-3).** Not computable from the B3 map: seller SELECT on `payments` is none, and `return_hold_hours` is not seller-readable. With the three columns above it is computable under the seller’s own RLS:

- deposit confirmed = `confirmed_at IS NOT NULL`
- balance confirmed = `balance_confirmed_at IS NOT NULL`
- hold elapsed = `payout_eligible_at IS NOT NULL AND now() >= payout_eligible_at`
- no blocking dispute or return = seller SELECT on `disputes` and `returns` for `store_id = my_store_id()`
- already paid out = seller SELECT on own `payouts`
- amount = `subtotal - commission_amount - refunded_amount`

The seller has no UPDATE grant on `balance_confirmed_at`, `refunded_amount`, or `payout_eligible_at`. The payment trigger and the delivery transition stamp them. Three-layer (§8).

**Not on this table:** master status, proof, recipient snapshot.

### 6.3 Amended tables (delta only)

Live columns not listed stay as measured in `information_schema.columns` this session.

**`listings`** — add:

| Column | Type | Null | Notes |
|---|---|---|---|
| `weight_g` | `integer` | YES | R-L18. CHECK `> 0` when not null. |
| `length_mm` | `integer` | YES | CHECK `> 0` when not null. |
| `width_mm` | `integer` | YES | CHECK `> 0` when not null. |
| `height_mm` | `integer` | YES | CHECK `> 0` when not null. |
| `specs` | `jsonb` | NO | default `'{}'`. R-L19. |
| `prep_days` | `smallint` | YES | R-L22. NULL means unset. Cap is the settings key, not a CHECK of 3. |
| `stock_touched_at` | `timestamptz` | YES | FR-ADM-21. Set whenever `stock_qty` changes. |

Publish gate (app + trigger, not a validated CHECK on day one): `status = 'active'` requires `type = 'product'`, `price_type = 'fixed'`, `price IS NOT NULL`, all four shipping attributes, `prep_days` within `prep_cap_days`, price inside the band, and `category_id` ∈ approved `store_categories`. Existing active rows may lack shipping attributes. **Stage C must not add that CHECK as validated until they are backfilled or the CHECK is `NOT VALID`.**

`delivery_options` jsonb stays, ignored (baseline §10). `stock_qty` NULL remains the untracked marker (R-L15).

**`inquiries`** — add:

| Column | Type | Null |
|---|---|---|
| `quoted_price` | `numeric(10,2)` | YES, CHECK `> 0` when not null |
| `quoted_prep_days` | `smallint` | YES, CHECK `>= 0` when not null |
| `quote_expires_at` | `timestamptz` | YES |
| `quoted_at` | `timestamptz` | YES |

`quoted_at` is the send instant for FR-ADM-21 quote turnaround (otherwise turnaround is not stored). `converted_to_order_id` stays nullable and is not written by v2 checkout. `delivery_preference` stays (§3.5). `last_message_at` stays unmaintained (REG-43).

**`order_items`** — add:

| Column | Type | Null | Notes |
|---|---|---|---|
| `is_custom` | `boolean` | NO | default `false` |
| `inquiry_id` | `uuid` | YES | FK → `inquiries(id)` NO ACTION. REG-82 path. |
| `prep_days_snapshot` | `smallint` | YES | Catalogue prep or quote prep at checkout (R-F02). |

Same custom/inquiry CHECK as `cart_items`. Existing money CHECKs stay. Live FK `order_id` ON DELETE CASCADE stays (history NO ACTION already prevents deleting the parent).

**`payments`** — add:

| Column | Type | Null | Notes |
|---|---|---|---|
| `refunded_amount` | `numeric(10,2)` | NO | default `0`. CHECK `0 <= refunded_amount <= amount`. R-U04. |
| `proof_snapshot_at` | `timestamptz` | YES | Set when the deposit row copies the master proof (N22). |

`proof_path` and `transfer_reference` stay on `payments`. For **new** deposit rows the buyer does not write them; the verification trigger does. Balance rows leave them null. `UNIQUE (order_id, payment_type)` stays. FK `order_id` NO ACTION stays. Deposit `method` for new rows is `instapay`. Balance `method` is `cod`. When a balance row is confirmed, the same trigger stamps `seller_orders.balance_confirmed_at` and does not copy `proof_path` or `transfer_reference` onto the seller order. When `payments.refunded_amount` changes, the trigger rolls the sum onto `seller_orders.refunded_amount`. Rounding of the 50% deposit is **REG-89** (§12) — the candidate is recorded there and is not accepted.

**`disputes`** — add `return_id uuid NULL` FK → `returns(id)` ON DELETE NO ACTION. `UNIQUE (order_id)` stays. No `master_order_id`.

**`seller_documents`** — no new column. `doc_type` gains the four food members (§5). `UNIQUE (seller_id, document_type)` stays, so one row per type. `food_social_url.storage_path` holds the URL. The table’s policy is own-seller or admin, not public, which is why the URL is not a `seller_profiles` column (R-S10 admin-only versus a public profile read).

**`stores`** — no new column. `category_primary` / `category_secondary` and `delivery_options` remain and are not authoritative. `payment_methods.cod_enabled` stays dead (REG-63).

**`admin_settings`** — columns unchanged (`key varchar` PK, `value text` NOT NULL, `description`, `updated_by`, `updated_at`).

REG-69 allow-list, **literal array only**. Live policy `settings_payment_config_read` is:

`key = ANY (ARRAY['betk_instapay_handle','betk_vodafone_cash','betk_orange_cash','delivery_fee_flat_egp'])`

v2 array is exactly:

`ARRAY['betk_instapay_handle']`

Removed entries: `betk_vodafone_cash`, `betk_orange_cash` (not buyer rails, R-O15), `delivery_fee_flat_egp` (retired as the buyer fee; fee is `courier_rates`). The key **rows** may remain for admin. They are not deleted by this spec. Do not replace the predicate with `LIKE`, a prefix, or `NOT IN`.

New keys, **admin-only, not added to the array:**

| Key | Serves |
|---|---|
| `price_band_min_egp` | R-L21 |
| `price_band_max_egp` | R-L21 |
| `quote_tolerance_multiplier` | R-Q02 (default meaning 2) |
| `quote_validity_hours` | R-Q03 (default meaning 24) |
| `payment_window_minutes` | R-O21 |
| `prep_cap_days` | R-F02 (default meaning 3) |
| `seller_category_limit` | R-L20 (default meaning 3) |
| `return_window_hours` | R-M07 return window. Distinct from existing `return_hold_hours`. |
| `food_requirements` | R-M07. Value shape is admin text. Not parsed by this spec. |
| `agreement_buyer_terms_version` | R-G06 |
| `agreement_seller_agreement_version` | R-G06 |
| `agreement_return_policy_version` | R-G06 |
| `agreement_privacy_version` | R-G06 |

Existing admin-only keys stay admin-only, including `commission_rate_pct` and `return_hold_hours` (REG-69, REG-86). `low_stock_default_threshold` already exists (measured). Do not add `return_hold_hours` to the narrowed REG-62 gate.

### 6.4 Kept tables — column contract

Unlisted tables are unchanged from `information_schema.columns` measured 2026-09-22. Money typmods are the measured ones in the header. FKs and CHECKs are the measured `pg_constraint` list (ON DELETE as measured: CASCADE on `addresses.buyer_id`, `buyer_profiles.id`, `notifications.user_id`, `listing_images` / `listing_tags` / `wishlists` / `restock_alerts` listing side, `store_follows` both sides, `listings.store_id`, `inquiry_messages.inquiry_id`, `order_items.order_id`, `order_messages.order_id`, `review_photos.review_id`, `dispute_evidence` / `dispute_messages` dispute side, `seller_documents` / `seller_strikes` seller side, `sessions.user_id`, `shipment_tracking_events.shipment_id`, `collection_listings` both sides, `categories.parent_id` SET NULL, `rating_aggregates.store_id` CASCADE). Every other measured FK is NO ACTION.

`reviews.order_id` and `disputes.order_id` and `shipments.order_id` and `payments.order_id` continue to reference the renamed seller-order relation. `reviews` UNIQUE `(order_id)` and `disputes` UNIQUE `(order_id)` and `shipments` UNIQUE `(order_id)` stay.

`order_status_history` columns (measured): `id`, `order_id`, `from_status`, `to_status`, `changed_by`, `changed_by_type`, `notes`, `created_at`. Rules in §4 stay.

## 7. Triggers and functions

Live inventory: `pg_proc` + `pg_trigger` this session. Security posture is `prosecdef` plus the measured `search_path` on the two functions read in full.

| Object | vs live | Purpose | Timing | Security |
|---|---|---|---|---|
| `is_admin()` | **KEPT** | Admin predicate | — | DEFINER, as live |
| `my_store_id()` | **KEPT** | Store predicate | — | DEFINER, as live |
| `update_listing_search_vector` / `trg_listing_search_vector` | **KEPT** | tsvector | BEFORE INSERT OR UPDATE `listings` | INVOKER |
| `set_review_edit_deadline` / `trg_review_edit_deadline` | **KEPT** | 48h edit window | BEFORE INSERT `reviews` | INVOKER |
| `set_dispute_sla` / `trg_dispute_sla` | **KEPT** | 48h SLA | BEFORE INSERT `disputes` | INVOKER |
| `recalculate_rating_aggregate` / `trg_recalculate_rating` | **KEPT** | R-R07 | AFTER INSERT OR UPDATE `reviews` | INVOKER. Live trigger does not include DELETE; do not widen it here. |
| `set_order_commission_snapshot` / `trg_set_order_commission_snapshot` | **REWORK** | Still stamps commission on the seller order at insert, from subtotal only (R-O27), never delivery | BEFORE INSERT seller order | DEFINER, `search_path` pinned, EXECUTE revoked from PUBLIC |
| `enforce_payment_update` / `trg_enforce_payment_update` | **REWORK** | Admin confirms status. Buyer does **not** write child `proof_path`. Verification copies master proof onto deposit rows and sets `proof_snapshot_at`. On balance confirm, stamp `seller_orders.balance_confirmed_at` only. On refund, roll `refunded_amount` onto the seller order. Neither copy includes `proof_path` or `transfer_reference`. | BEFORE UPDATE `payments` | DEFINER, search_path pinned, EXECUTE revoked from PUBLIC. Three-layer (§8). |
| `enforce_order_transition` / `trg_enforce_order_transition` | **REWORK** | See below | BEFORE UPDATE seller order | DEFINER, search_path pinned, EXECUTE revoked from PUBLIC. Three-layer. |
| `decrement_stock_on_confirm` / `trg_decrement_stock_on_confirm` | **REWORK** | See below | Detach from `AFTER UPDATE OF status WHEN confirmed` | DEFINER stock mutation called from checkout, not from confirm |
| `set_inquiry_converted_order` / `trg_set_inquiry_converted_order` | **DROP** | Wrote `converted_to_order_id` from an inquiry-order. v2 checkout does not (R-O11). Column stays. | — | Was DEFINER |
| `create_order_from_inquiry` | **DROP** | Inquiry checkout (ADR-018). Replaced by `checkout_from_cart`. | — | Was INVOKER |
| `submit_seller_application` / `resubmit_seller_application` | **REWORK** | Stop treating `delivery_options` and the two category varchars as the authority. Write `store_categories` and `store_pickup_addresses`. Signature change is Stage C. | RPC | Stay INVOKER (ADR-012) |
| `checkout_from_cart` | **NEW** | One transaction: master + N seller orders + items + 2N payments + N shipments, stock decrement, cart consume. All or nothing (R-O12). Phone gate bites here (R-A07 checkout). No delivery-method argument. Child `betk_ref` is written NULL. Master `betk_ref` is the buyer-facing number. | RPC | INVOKER, search_path pinned, EXECUTE revoked from PUBLIC, granted to `authenticated` |
| `restore_stock_on_cancel` | **NEW** | R-L11 restore on cancel from a pre-delivery state. R-L13 out-of-stock escalation sets `stock_qty = 0` instead. R-L12 does **not** restore on `returned`. R-L15 skips NULL stock. Also the REG-82 cart restore. | AFTER UPDATE of status into `cancelled` | DEFINER, search_path pinned, EXECUTE revoked from PUBLIC |
| `enforce_master_proof_update` | **NEW** | Buyer may set `proof_path` + `transfer_reference` once, before `payment_deadline`, while children are still `pending` and proof is null. Stamps `proof_uploaded_at`. | BEFORE UPDATE `master_orders` | DEFINER, search_path pinned. Three-layer. |
| `enforce_store_category_cap` | **NEW** | Count of `store_categories` ≤ `seller_category_limit` | BEFORE INSERT `store_categories` | DEFINER so it can read an admin-only settings key. search_path pinned. |
| `touch_stock` | **NEW** | Set `listings.stock_touched_at` when `stock_qty` changes | BEFORE UPDATE OF `stock_qty` | INVOKER |
| `release_seller_orders` | **NEW** | On the one admin deposit confirm: copy proof onto each deposit row, set each child `confirmed` (meaning released), stamp `confirmed_at` and `prep_deadline` | Called from the admin confirm path | DEFINER, search_path pinned |

### 7.1 `enforce_order_transition` REWORK

Live function (measured `pg_get_functiondef`) does two things v2 forbids:

1. `pending → cancelled` is allowed for the buyer with **no check of proof**. That contradicts closed REG-73 / R-O03 (cancel only before proof upload).
2. `pending → confirmed` requires `OLD.store_id = my_store_id()` and a confirmed deposit. That is seller acceptance (retired AC-SEL-14). v2 `confirmed` means admin release (R-O19).

Target transitions (product names; stored label in parentheses):

| From | To | Actor |
|---|---|---|
| `pending` (awaiting payment) | `cancelled` | Buyer, only when master `proof_path` IS NULL. System, when `payment_deadline` has passed and proof is null. Admin, on proof rejection. |
| `pending` | `confirmed` | Admin release only (the one verification). Not the seller. |
| `confirmed` | `preparing` | Seller |
| `preparing` | `ready` | Seller |
| `ready` | `dispatched` | Admin (courier collected). Not the seller (AC-COU-4). |
| `dispatched` | `delivered` | Admin. The same transition stamps `payout_eligible_at` (§6.2). |
| `confirmed` or `preparing` | `cancelled` | Admin via escalation only. Not the buyer (R-O22). Not the seller (R-E01). |
| `delivered` | `returned` | Return accepted (R-U03). |

Any other change of `status` raises. `cancelled_by` stays ungranted and trigger-stamped. Seller is never stamped. `is_admin()` stays in the **policy**, not as a bypass inside the trigger’s actor checks (ADR-019: a later admin-forced transition is the admin branch above, which is now specified).

The live function reads `OLD.buyer_id`. The column stays (§4.1), so the rework keeps a buyer-cancel check against that column or against the master. Do not drop `buyer_id` in front of this function.

### 7.2 `decrement_stock_on_confirm` REWORK

Live trigger runs `AFTER UPDATE OF status` when `NEW.status = 'confirmed'` and decrements `listings.stock_qty` (skips NULL). That is stock-on-accept. OD-15 / R-L05: decrement **at checkout**, inside the order-creation transaction.

Target: remove the confirm trigger. The DEFINER function runs from `checkout_from_cart` after items exist, still skips `stock_qty IS NULL`, still sets `sold_out` at 0, and also sets `stock_touched_at`. It must not run again on admin release.

## 8. RLS policy map

Every v2 table × SELECT / INSERT / UPDATE / DELETE. Empty cell means **no policy** (default deny for that command). `is_admin()` may be OR-ed into SELECT/INSERT/UPDATE where the cell says admin. Service role bypasses RLS for jobs. The admin label path does not use the service role (§3.1).

**Three-layer** (ADR-019 / PRECEDENTS): column GRANT + row policy + OLD-aware BEFORE trigger. Marked on write paths where actors differ or legality depends on `OLD → NEW`.

Seller predicate `store` means `store_id = my_store_id()` or the parent row’s store. Buyer predicate `self` means `buyer_id = auth.uid()` or `user_id = auth.uid()` or `id = auth.uid()`.

| Table | SELECT | INSERT | UPDATE | DELETE | Three-layer writes |
|---|---|---|---|---|---|
| `users` | self or admin (`users_self`, live) | none (auth) | none for `authenticated` (REG-19 service role) | none | no |
| `otp_tokens` | none for clients | service | service | service | no |
| `sessions` | none for clients (OD-5) | none | none | none | no |
| `buyer_profiles` | self or admin. **Not public.** | self | self | none | no |
| `addresses` | self or admin | self | self | self | no |
| `seller_profiles` | self, public if active, admin | self, phone-gate restrictive | self or admin | none | no |
| `seller_documents` | own seller or admin. Not public. | own | own or admin | none | no |
| `seller_strikes` | own seller or admin | admin | admin | none | no |
| `stores` | public if active, own, admin | own | own or admin | none | no |
| `store_pickup_addresses` | own seller or admin. **Buyer none.** | own seller | own seller or admin | none | no |
| `store_follows` | self or admin | self | none | self | no |
| `store_categories` | public read of ids, own, admin | own or admin | admin (`approved_at`) | own or admin | no |
| `categories` | public if active | admin | admin | admin | no |
| `listings` | active and not deleted, own store, admin | own store | own store or admin | none (soft) | no (stock decrement is DEFINER, not a seller grant) |
| `listing_images` | follows listing | own store | own store | own store | no |
| `listing_tags` | follows listing | own store | own store | own store | no |
| `wishlists` | self or admin | self | self | self | no |
| `restock_alerts` | self or admin | self | service `notified_at` | self | no |
| `cart_items` | self or admin. **Seller none.** | self. **No phone gate** (REG-79). | self | self | no |
| `inquiries` | buyer or store or admin | buyer | store or admin (quote columns) | none | no |
| `inquiry_messages` | thread parties | thread parties | sender content (no MVP surface) + receiver `is_read` only (REG-42 grant) | none | receiver `is_read` is column GRANT + policy (two of the three layers; no OLD transition) |
| `master_orders` | buyer self or admin. **Seller none.** | buyer, plus restrictive phone gate | buyer proof columns only, or admin | none | **YES** buyer proof update |
| `seller_orders` | buyer (`buyer_id = auth.uid()`), or store, or admin | checkout (buyer), phone gate | buyer cancel metadata, seller `preparing`/`ready`, admin cancel/release. Seller has no UPDATE on `balance_confirmed_at`, `refunded_amount`, `payout_eligible_at`. | none | **YES** |
| `order_items` | buyer via seller order, or store, or admin | checkout | none | none | no |
| `order_status_history` | buyer via seller order, or store, or admin | trigger/actor | none (rule) | none (rule) | no |
| `order_messages` | buyer via seller order, or store, or admin | those parties | sender `is_read` pattern as inquiry, if used | none | no |
| `payments` | buyer via `seller_orders.buyer_id`, or admin. **Seller none** (`proof_path` is on the row). Balance facts the seller needs are on `seller_orders` (§6.2), not here. | checkout | admin confirm / refund | none | **YES** |
| `payouts` | own store or admin | own store, phone gate | admin | none | no |
| `shipments` | buyer via seller order, or admin. **Seller none.** | checkout | admin | none | no |
| `shipment_tracking_events` | buyer via shipment, or admin. **Seller none.** | admin or service | none | none | no |
| `courier_rates` | any authenticated (the matrix is not identity) | admin | admin | admin | no |
| `reviews` | visible public, or author, or admin. Store may read the review row (reply) but **cannot** join `buyer_id` to name, phone, governorate, or city (§9). **B4:** a review renders no buyer name and no buyer location. | buyer of that delivered seller order | buyer before deadline, store reply, admin | none | no |
| `review_photos` | follows review | author | none | author before deadline | no |
| `rating_aggregates` | public | trigger | trigger | none | no |
| `returns` | buyer self, store, admin | buyer | seller accept/reject, admin refund | none | **YES** |
| `return_evidence` | return parties or admin | buyer | none | none | no |
| `disputes` | buyer, store, admin | buyer | admin resolution; parties on message-adjacent columns only as granted | none | **YES** on status/resolution |
| `dispute_evidence` | dispute parties or admin | parties | none | none | no |
| `dispute_messages` | dispute parties or admin | parties | sender / read receipt as inquiry_messages | none | read-receipt grant if `is_read` is receiver-writable |
| `agreement_acceptances` | self or admin | self | none | none | no |
| `boosts` | active public, own store, admin | own store | admin confirm / cron expire | none | no |
| `boost_packages` | active public, admin | admin | admin | admin | no |
| `notifications` | self or admin | service | self `is_read` | self | `is_read` column grant (REG-42 class) |
| `collections` | live public, admin | admin | admin | admin | no |
| `collection_listings` | follows collection | admin | admin | admin | no |
| `flagged_content` | admin | authenticated reporter or service | admin | none | no |
| `moderation_logs` | admin | admin | none (rule) | none (rule) | no |
| `whatsapp_templates` | admin | admin | admin | none | no |
| `admin_settings` | admin ALL, plus authenticated SELECT of the **literal** one-key array in §6.3 | admin | admin | none | no |
| `seller_snapshots` | own store or admin | cron | cron | none | no |
| `platform_snapshots` | admin | cron | cron | none | no |

Live policies that are absent (RLS on, zero policies — measured) and must be **added** by Stage C to match this map, not treated as already present: `dispute_evidence`, `dispute_messages`, `flagged_content`, `otp_tokens`, `restock_alerts`, `seller_strikes`, `sessions`, `whatsapp_templates`. Plus every new table.

Phone gate (restrictive INSERT): `master_orders`, `seller_orders`, `seller_profiles`, `payouts`. **Not** `cart_items` (REG-79).

## 9. N28 proof — seller read of buyer identity or location

Re-measured in B3-FIX from `information_schema.columns` (`table_schema = 'betk'`, column name matching name, phone, address, governorate, city, street, or building). This table is that result, classified. It is not the B3 list.

A seller read of buyer name, phone, address text, governorate, or city is a fail. A bare uuid is not those values.

| Live column | What it holds | Seller path under §8 | Verdict |
|---|---|---|---|
| `addresses.governorate` | buyer location | `addr_self`: `buyer_id = auth.uid()` or admin | **NO** |
| `addresses.city` | buyer location | same | **NO** |
| `addresses.street_address` | buyer address | same | **NO** |
| `addresses.building_notes` | buyer address | same | **NO** |
| `buyer_profiles.full_name` | buyer name | `bp_self`: self or admin. Public name/governorate branch struck (REG-44) | **NO** |
| `buyer_profiles.governorate` | buyer location | same | **NO** |
| `buyer_profiles.city` | buyer location | same | **NO** |
| `users.phone_number` | account phone | `users_self`: self or admin | **NO** |
| `otp_tokens.phone_number` | phone | no client SELECT | **NO** |
| `orders.delivery_address_id` | uuid pointer, kept | seller SELECT of `seller_orders` includes the uuid. `addresses` does not. Text does not resolve | **NO** |
| `boost_packages.name` | package title | not a buyer | n/a |
| `categories.name_ar`, `categories.name_en` | category title | not a buyer | n/a |
| `collections.name_ar`, `collections.name_en` | collection title | not a buyer | n/a |
| `stores.name_ar`, `stores.name_en` | store name | not a buyer name | n/a |
| `stores.governorate`, `stores.city` | store location, public | seller can read it. It is not the buyer’s governorate or city | n/a |
| `whatsapp_templates.name` | template title | admin. Not a buyer | n/a |

Target columns that are not in `information_schema` yet, judged under §8:

| Target column | Seller path | Verdict |
|---|---|---|
| `master_orders.recipient_name`, `recipient_phone`, `snapshot_governorate`, `snapshot_city`, `snapshot_street_address`, `snapshot_building_notes` | no seller policy | **NO** |
| `master_orders.proof_path`, `transfer_reference` | no seller policy | **NO** |
| `payments.proof_path`, `transfer_reference` | seller SELECT removed | **NO** |
| `seller_orders.buyer_id` | uuid on a seller-readable row. Join to name or phone is denied by the live rows above | **NO** |
| `seller_orders.balance_confirmed_at`, `refunded_amount`, `payout_eligible_at` | seller-readable settlement facts. They are not name, phone, address, or proof | n/a |

**No YES.** The map did not need an N28 correction. `seller_orders.buyer_id` and `delivery_address_id` stay visible as uuids (§4.1). Label delivery is the admin’s own RLS read (§3.1), which the seller cannot satisfy.

**B4 input:** reviews render no buyer name and no buyer location. `reviews.order_id` is the seller order (REG-83). A public name or governorate on `buyer_profiles` would name the buyer of that order. The row-39 branch stays struck.

## 10. Traceability

### 10.1 PRD persisted state → table

Codes that are behaviour-only (no new stored fact) are marked derived. A code with no home would be a gap. None of those are silent fills.

| Code | Storage |
|---|---|
| R-C01 | `users` + `cart_items` INSERT self. No guest row. |
| R-C02, R-C03, R-C06 | `cart_items` |
| R-C04, R-L05, R-L11–R-L15 | `listings.stock_qty` (NULL = untracked) |
| R-C05, R-Q06 | derived from `stock_qty` and `inquiries.quote_expires_at` |
| R-C07, REG-82 | `order_items` + `inquiries.quote_expires_at` → `cart_items` |
| R-O11 | checkout reads `cart_items`, not `inquiries.converted_to_order_id` |
| R-O12, R-O13 | `master_orders`, `seller_orders`, `shipments` |
| R-O14 | `seller_orders` + `order_items` + `payments` + `shipments` + escalation columns |
| R-O02 | `master_orders.betk_ref`. Child: `display_ref` (REG-81, format open) |
| R-O15, R-O17, R-O20 | `payments.method` / `payment_type` / `amount` |
| R-O16 | amounts on `payments`; one master proof. Rounding: REG-89 |
| R-O18, N22 | `master_orders.proof_*` + deposit snapshot |
| R-O19 | release trigger; `seller_orders.confirmed_at` |
| R-O21 | `master_orders.payment_deadline`; key `payment_window_minutes` |
| R-O22, R-O03, R-E01 | `enforce_order_transition` |
| R-O23, R-O24, R-U04 | cancel paths; `payments.refunded_amount` |
| R-O25 | derived. No column. No enum member. |
| R-O26 | derived. No ledger table. |
| R-O27 | `seller_orders.commission_rate` / `commission_amount` |
| R-O28 | no column; buyer SELECT does not include commission or per-seller fee breakdown (app projection). Per-seller `delivery_fee` is seller-visible on `seller_orders`. |
| R-O29 | existing `return_hold_hours`. Not added to REG-62 (REG-86). |
| R-Q01–R-Q08 | `inquiries` quote columns + `cart_items.inquiry_id` |
| R-F01, R-F02 | `prep_deadline`, `order_items.prep_days_snapshot`, `listings.prep_days`, `quoted_prep_days` |
| R-F03, R-E02, R-E03, R-E05 | escalation columns |
| R-F04, R-E04 | cancel + `seller_strikes` (manual) + `notifications` |
| R-F05, R-N07, R-N08 | `notifications` |
| R-U01, R-U03 | `returns` |
| R-U02 | `return_evidence` |
| R-U05 | no stock write on `returned` |
| R-G01–R-G08 | `agreement_acceptances` + version keys. Gate membership: REG-88. Backfill: REG-75. |
| R-K01 | `delivery_method` ignored (§3.5) |
| R-K02, R-K04 | `courier_rates`, `seller_orders.delivery_fee` |
| R-K03 | `master_orders.combined_delivery_total` |
| R-K05, R-V03 | `store_pickup_addresses` |
| R-K06, R-K08 | balance `payments` row; admin confirm |
| R-K07 | label function + master snapshot. Not a table. |
| R-K09 | `seller_orders.status = ready`; shipment writes admin |
| R-V01–R-V04 | §8 / §9 |
| R-L16, R-L17 | `listing_type`, `price_type`, `listings.price` (dead members retained) |
| R-L18–R-L22, R-S10 | `listings` shipping/specs/prep; `store_categories`; `seller_documents` food types; band keys |
| R-A07 | phone-gate policies on checkout / seller profile / payout. Not on `cart_items` (REG-79). |
| R-M07, R-M08 | `admin_settings` keys. Statuses are enums, not settings. |
| FR-ADM-21 | derived from escalation columns, `stock_touched_at`, `inquiries.quoted_at`, `reviews`, `agreement_acceptances`, `seller_documents`, `seller_strikes`, `users.last_login_at`, `listings.updated_at`. No performance table. |
| R-B01–R-B05, R-L08 | `boosts`, `boost_packages` (REG-80) |
| R-O06, R-O07, R-R01, R-R02, REG-83, REG-84 | `reviews.order_id`, `disputes.order_id` |
| R-D01–R-D06 | `disputes` and children |
| OD-1 | no `inventory_alerts` |
| OD-2 | `users.deleted_at`, `anonymized_at` |
| OD-3 | no campaign table |

### 10.2 v2 table → at least one PRD code

| Table | Code |
|---|---|
| `cart_items` | R-C02 |
| `master_orders` | R-O13 |
| `seller_orders` | R-O14 |
| `returns` | R-U01 |
| `return_evidence` | R-U02 |
| `agreement_acceptances` | R-G03 |
| `store_categories` | R-L20 |
| `courier_rates` | R-K02 |
| `store_pickup_addresses` | R-V03 |
| `users` | R-A07 / OD-4 |
| `otp_tokens` | OD-4 |
| `sessions` | OD-5 |
| `buyer_profiles` | R-V02 (the row the seller must not read) |
| `addresses` | R-O13 (the address the master points at) |
| `seller_profiles` | R-G04 onboarding subject |
| `seller_documents` | R-S10 |
| `seller_strikes` | R-E04 |
| `stores` | R-K05 public origin (governorate), storefront |
| `store_follows` | retained discovery (FR-PUB storefront follow; v1 rule still in force) |
| `categories` | R-L20 |
| `listings` | R-L17 |
| `listing_images` | R-L10 listing media (v1 held) |
| `listing_tags` | catalogue discovery held with search |
| `wishlists` | buyer save, held |
| `restock_alerts` | R-N07 low-stock notify target (OD-1 log still absent) |
| `inquiries` | R-Q01 |
| `inquiry_messages` | R-Q01 thread |
| `order_items` | R-O14 |
| `order_messages` | in-app order thread (communication posture; not a counterparty phone) |
| `order_status_history` | R-O22 audit of transitions |
| `payments` | R-O17 |
| `payouts` | R-O29 |
| `shipments` | R-O12 |
| `shipment_tracking_events` | R-K09 buyer tracking |
| `reviews` | REG-83 / R-O07 |
| `review_photos` | R-R review evidence (v1 held) |
| `rating_aggregates` | R-R07 |
| `disputes` | REG-84 / R-O06 |
| `dispute_evidence` | R-D05 |
| `dispute_messages` | R-D dispute thread |
| `boost_packages`, `boosts` | R-B01 (REG-80) |
| `notifications` | R-N07 |
| `collections`, `collection_listings` | FR-PUB-1 held discovery |
| `flagged_content`, `moderation_logs` | admin moderation held |
| `whatsapp_templates` | OD-5 / R-N07 |
| `admin_settings` | R-M07 |
| `seller_snapshots`, `platform_snapshots` | seller/platform analytics held (FR-SEL-21 non-boost clause; boost metric retained with REG-80) |

**Gap check:** both directions are filled. Open product holes are §12, not missing tables.

## 11. ADR candidates (B5 writes them; this task does not)

Next free ADR is **ADR-020**. Not taken.

1. **Courier visibility without an RLS principal** (REG-78, §3.1). Required. AC-COU-6. Admin-initiated label = the admin’s own RLS read. No definer. No service role. Automated handoff, if later chosen, = service-role read, still no definer. Handoff stays tied to the courier gate.
2. **Proof write path** (N22, §3.2). Buyer writes `master_orders`; verification copies onto deposit `payments`. Amends the ADR-019 buyer-writes-the-deposit-row sentence.

F-MODE, REG-81, REG-82, REG-83, and REG-84 are recorded in this ERD. They do not need an ADR unless B5 disagrees.

## 12. STOP-and-flags

Minted this session (next free was REG-88; no REG-88 row existed):

| ID | Flag |
|---|---|
| **REG-88** | R-G02 says a version gate blocks order completion until the buyer has accepted the “current required versions”, and R-G05 names four documents. Which of the four are inside that gate is not pinned. `agreement_acceptances` stores all four. Stage C must not hard-code the set. |
| **REG-89** | **OPEN.** One transfer covers the whole master (R-O18). The invariants, not yet accepted: the sum of the child deposit rows equals that single transfer amount, and each child deposit plus that child’s balance equals that child’s total. **Engineering candidate for B5, not a product pin:** round the master deposit once onto `NUMERIC(10,2)`, allocate that rounded amount across children by largest remainder with a deterministic tiebreak, and set each child balance to child total minus child deposit. Stage C does not implement this until B5 accepts it. |

Not minted (the spec already refuses the invention):

- One return per seller order is not required. No UNIQUE (§6.1).
- `display_ref` format stays REG-81.
- Add-to-cart phone gate stays REG-79.
- `return_hold_hours` vs REG-62 stays REG-86.
- T&C backfill stays REG-75.
- Store return-policy text vs platform policy stays REG-85 (not a schema fork).
- Master execution prompt still says 59 pages (REG-87). This task did not edit it.

## 13. Stage C inputs (not done here)

- In-place rename `orders` → `seller_orders`. Synthetic master per existing order. **Copy** `buyer_id`, `delivery_address_id`, and `betk_ref` onto the master. **Do not drop them** from the child (§4.1). Relax `seller_orders.betk_ref` to nullable. New rows write NULL there.
- `enforce_order_transition` still reads `OLD.buyer_id`. Rework it for the v2 transitions (§7.1). Because the column stays, that rework is not sequenced in front of a drop. If a later task reopens the drop, the function rework and the §4.1 dependency list come first.
- Listing publish CHECK (weight and dimensions on active listings) is `NOT VALID` or the rows are backfilled first (§6.3).
- Do not delete the 7 history-bearing orders. Do not change history rules or the NO ACTION FK.
- Add `order_status.ready` only.
- REG-69 array becomes exactly `betk_instapay_handle`.
- New tables in §6.1. Policies in §8, including the eight live tables that have RLS and zero policies.
- `checkout_from_cart` replaces `create_order_from_inquiry`.
- Stock decrement moves to checkout. Confirm trigger comes off.
- No SQL in this document. No page inventory.
- **B4:** reviews render no buyer name and no buyer location (§9).

---

## H. Historical v1 ERD (superseded in place — not deleted)

> **SUPERSEDED (B3, 2026-09-22).** The text below is the pre-B3 document. OD-6’s 43-count is the live-today count (§1), not the v2 freeze. v2 contract is §1–§13. OD-20 supersedes the freeze sentence in §1.1 below.

# BETK_ERD.md
> Step 3 of the BETK Dev OS. The ERD and SQL already exist (Architecture Conversations 2 & 3); this document wraps them with the highest-value remaining work: RLS strategy per table, index justifications, soft-delete decisions, row-ownership model, scale assumptions, and Supabase→TypeScript type mapping. The executable schema is filed as `BETK_DATABASE_SCHEMA.sql` (this directory).

## 1. Table count reconciliation (OD-6)

The C2/C3 headline says "28 tables"; the detailed specifications define **43 physical tables** across 13 domains + 2 analytics tables in `betk_analytics`. This document is authoritative: **43 tables**. Generated TypeScript types must reflect all 43.

Domains: Identity&Auth (users, otp_tokens, sessions); User Mgmt (buyer_profiles, addresses); Seller Mgmt (seller_profiles, seller_documents, seller_strikes); Store (stores, store_follows); Catalog (categories, listings, listing_images, listing_tags, wishlists, restock_alerts); Messaging (inquiries, inquiry_messages, order_messages); Orders (orders, order_items, order_status_history); Payments (payments, payouts); Delivery (shipments, shipment_tracking_events); Reviews (reviews, review_photos, rating_aggregates); Disputes (disputes, dispute_evidence, dispute_messages); Boosts (boost_packages, boosts); Admin (notifications, collections, collection_listings, flagged_content, moderation_logs, whatsapp_templates, admin_settings); Analytics (betk_analytics.seller_snapshots, betk_analytics.platform_snapshots).

### 1.1 Authoritative table inventory & counting methodology (OD-6, FROZEN)

**Authoritative count = 43 physical tables.** Counting methodology: a "table" is any `CREATE TABLE` that holds rows at runtime, counted across both schemas (`betk` + `betk_analytics`); enum types, helper functions, triggers, views, and the `betk_audit` schema are **not** counted. The stale "28 tables" headline in C2/C3 is superseded by this section.

Inventory (43): **betk (41)** — users, otp_tokens, sessions, buyer_profiles, addresses, seller_profiles, seller_documents, seller_strikes, stores, store_follows, categories, listings, listing_images, listing_tags, wishlists, restock_alerts, inquiries, inquiry_messages, order_messages, orders, order_items, order_status_history, payments, payouts, shipments, shipment_tracking_events, reviews, review_photos, rating_aggregates, disputes, dispute_evidence, dispute_messages, boost_packages, boosts, notifications, collections, collection_listings, flagged_content, moderation_logs, whatsapp_templates, admin_settings. **betk_analytics (2)** — seller_snapshots, platform_snapshots.

### 1.2 Identity model (OD-4, FROZEN — Google OAuth IN)

Sign-in via **phone-OTP or Google OAuth** (Supabase Auth links both to one `users` row). `users.phone_number` is **nullable + UNIQUE** (multiple NULLs allowed) so OAuth users exist before providing a phone; `users.auth_provider` (`'phone'|'google'`) records identity origin. **A verified phone is required before transacting** — `orders`, `seller_profiles` (becoming a seller), and `payouts` inserts require `users.phone_number IS NOT NULL`, enforced in Server Actions and RLS `WITH CHECK`. R-A01 amended accordingly (see `06-security/SECURITY_GUIDELINES.md`).

## 2. Row-ownership & tenant-isolation model

BETK is multi-tenant by **store** (the seller's unit of participation) and by **user**. Ownership columns:
- User-owned: `buyer_profiles.id=users.id`, `addresses.buyer_id`, `wishlists.buyer_id`, `restock_alerts.buyer_id`, `notifications.user_id`, `sessions.user_id`, `store_follows.buyer_id`.
- Store-owned (resolved via `betk.my_store_id()`): `stores.seller_id`, `listings.store_id`, `payouts.store_id`, `boosts.store_id`, `reviews.store_id` (denormalized), `disputes.store_id` (denormalized), `seller_analytics_snapshots.store_id`.
- Order-scoped (buyer OR store of the order): `orders`, `order_items`, `order_status_history`, `payments`, `shipments`, `order_messages`, and `reviews`/`disputes` by order.
- Admin-only: `moderation_logs`, `admin_settings`, `flagged_content` (write), `collections` (write), `platform_snapshots`.

Two `SECURITY DEFINER` helpers anchor isolation: `betk.is_admin()` and `betk.my_store_id()`. Both must use indexed lookups; `auth.uid()` should be cached in session context where possible (C3 §8.1 RLS performance note).

## 3. RLS strategy per table

Principles (C3 §5): RLS enabled on **every** table; default-deny; admins bypass via `is_admin()`; service_role (background jobs) bypasses RLS; sellers see only their store data; buyers see only their own rows.

| Table | SELECT | INSERT | UPDATE | DELETE | Policy basis |
|---|---|---|---|---|---|
| users | self or admin | (Supabase Auth) | self or admin | — | `users_self` |
| otp_tokens | service/admin | service | service | cron cleanup | not client-readable |
| sessions | self | Auth | Auth | self/expiry | self-scope |
| buyer_profiles | self or admin — public name/gov branch **STRUCK** (B3-FIX 2026-09-22, REG-44 WON'T-FIX; N28 + REG-83). The parenthetical is not a target. | self | self | — | `bp_self` |
| addresses | self or admin | self | self | self | `addr_self` |
| seller_profiles | self, public if active, admin | self | self or admin | — | `sp_select`,`sp_update` |
| seller_documents | own seller or admin | own | own/admin | — | `sdoc_own` (private bucket) |
| seller_strikes | own seller or admin | admin | admin | — | admin-write |
| stores | public if active, own, admin | own | own or admin | — | `stores_public`,`stores_manage` |
| store_follows | self or admin | self | — | self | self-scope |
| categories | public if active, admin | admin | admin | admin | `cat_public`,`cat_admin` |
| listings | active+not-deleted public, own store, admin | own store | own store or admin | soft-delete only | `listings_public`,`listings_seller` |
| listing_images / listing_tags | follows listing | own store | own store | own store | via listing |
| wishlists | self or admin | self | self | self | `wishlist_own` |
| restock_alerts | self or admin | self | service (notified_at) | self | self-scope |
| inquiries | buyer or store or admin | buyer | store/admin | — | `inq_buyer` |
| inquiry_messages | thread parties | thread parties | sender (content) + receiver (`is_read`) ‡ | — | via inquiry |
| order_messages | order parties | order parties/system | sender | — | via order |
| orders | buyer or store or admin | buyer | store/admin | — | `orders_access` |
| order_items | follows order | system (checkout) | — | — | via order |
| order_status_history | follows order | system/actor | — (append-only) | — (append-only) | immutable |
| payments | order parties or admin | system (checkout) | admin(confirm) + buyer(proof) † | — | `payments_access` |
| payouts | own store or admin | own store | admin | — | `payouts_own`,`payouts_insert` |
| shipments / shipment_tracking_events | order parties or admin | store/courier | store/courier | — | via order |
| reviews | visible public, author, store, admin | buyer (own) | buyer<deadline / store(reply) / admin | — | `reviews_public/buyer/edit` |
| review_photos | follows review | author | — | author<deadline | via review |
| rating_aggregates | public | trigger | trigger | — | read-public |
| disputes | buyer or store or admin | buyer | admin/parties | — | `disputes_access` |
| dispute_evidence / dispute_messages | dispute parties or admin | parties | sender | — | via dispute |
| boosts | active public, own store, admin | own store | admin(confirm)/cron(expire) | — | `boosts_public` |
| boost_packages | active public, admin | admin | admin | admin | `boost_pkg_public` |
| notifications | self or admin | system | self(read) | self | `notif_own` |
| collections | live public, admin | admin | admin | admin | `collections_public/admin` |
| collection_listings | follows collection | admin | admin | admin | via collection |
| flagged_content | admin | any/system | admin | — | admin-managed |
| moderation_logs | admin | admin | — (append-only) | — (append-only) | `modlog_admin` |
| whatsapp_templates | admin | admin | admin | — | admin-managed |
| admin_settings | admin | admin | admin | — | `settings_admin` |
| betk_analytics.seller_snapshots | own store or admin | cron | cron | — | `seller_snap_own` |
| betk_analytics.platform_snapshots | admin | cron | cron | — | `platform_snap_admin` |

> ‡ **`inquiry_messages` UPDATE — amendment (authorized 2026-07-22, REG-42).** The original cell read "sender". It is refined to two distinct write rights that do not overlap in scope:
> - **sender — content (theoretical).** A message author editing their own message body. There is **no edit surface for this in the MVP** (`BETK_UI_SPEC.md` draws no message-edit affordance); the right exists only as the row's original policy (`inq_msg_update`, `sender_id = auth.uid()`) and is now further narrowed by the column-level GRANT below to the point of being a no-op on content.
> - **RECEIVER — `is_read` only, enforced by column-level GRANT (not by policy).** The mark-as-read write is **definitionally receiver-driven** — the party who did *not* send a message is the one who reads it, and a sender flipping the read-state on their *own* message is a semantic no-op. The original row wording ("sender") described **content-edit rights**, which is why it did not contemplate the receiver's read-receipt write; it was never intended to forbid it. Rather than broaden the row policy to a general receiver UPDATE (which would expose `body`), the receiver's write is confined to the `is_read` column by `REVOKE UPDATE … / GRANT UPDATE(is_read) … TO authenticated`, with a permissive `inq_msg_read_receipt` policy (thread-party AND `sender_id <> auth.uid()`) authorizing the row. Column safety is thus the GRANT's job, row safety the policy's. This mirrors the `notifications` row's "self(read)" UPDATE intent (row: notifications) for the messaging thread.
>
> † **`payments` UPDATE + `orders` UPDATE — amendment (authorized 2026-07-23, OD-8 custodial payments, ADR-016; RLS design owed by Phase-07 T02, REG-49).** Under custody the buyer pays **BETK**, so the deposit-confirming actor moves from the seller to **admin**. `payments` UPDATE is split by column + actor (the REG-42 column-GRANT pattern, since `WITH CHECK` cannot see `OLD`): **admin** confirms (`status`, `confirmed_by`, `confirmed_at`, `notes`); the **buyer** attaches `proof_path` + `transfer_reference` to their own order's **deposit** row only. The original cell wording ("seller(confirm)") described the no-custody (ADR-002) model and is superseded. `orders` UPDATE additionally admits the **buyer** for cancel-while-`pending` (R-O03) alongside the seller's acceptance transition — the "store/admin" cell is unchanged (seller = store) and transition legality is enforced by a trigger/column-grant, not RLS alone. The 3 additive OD-8 §9 columns (`payments.proof_path`, `orders.commission_rate`, `orders.commission_amount`) are owed by the same T02 migration; **no new table — table count 43 holds.**

## 4. Index justifications (41 indexes)

> **Count correction (T14 + R4):** the DoD/pre-build estimate was 34; live = **41 non-constraint indexes** (40 `idx_*` + the partial-unique `uq_active_boost_per_listing`). Over-provisioned, **none missing** — do not drop indexes to "match" the old estimate.

GIN on `listings.search_vector` — full-text 1–2 keyword search (unaccent). B-tree `listings(store_id,status)`, `(category_id,status)`, partial `(created_at DESC) WHERE active&!deleted` (new arrivals), partial `(view_count DESC) WHERE active&!deleted` (popularity), `(store_id) WHERE active&!deleted` (storefront/location). `inquiries(store_id,status)`,`(buyer_id)`,`(store_id,last_message_at DESC)` (inbox sort). `orders(buyer_id,status)`,`(store_id,status)`,`(store_id,created_at DESC)`. `order_status_history(order_id,created_at DESC)`. `payments(order_id)`, partial `(status) WHERE pending`. `payouts(store_id)`, partial `(requested_at) WHERE pending`. `reviews(store_id) WHERE is_visible`. `disputes(status,sla_deadline) WHERE not resolved/closed` (SLA monitor), `(store_id)`. Partial unique `boosts(listing_id) WHERE active` (concurrent-boost guard, R-B01) + `boosts(expires_at) WHERE active` (expiry cron). `notifications(user_id) WHERE !is_read` (unread badge), `(user_id,sent_at DESC)`. `flagged_content(severity,created_at) WHERE pending`. `moderation_logs(target_id,target_type)`,`(admin_id,created_at DESC)`. `seller_snapshots(store_id,snapshot_date DESC)`,`(snapshot_date DESC)`. Apply all on day 1 (C2 §7.3).

## 5. Soft-delete vs hard-delete decisions

- **Soft delete (`deleted_at`):** `listings` only — historical `order_items` reference listings, so removal must preserve integrity (R-L10). `order_items` additionally snapshots `listing_title_ar` + `unit_price` so order history survives even if a listing row is later purged.
- **Status-based hiding (not deletion):** suspended sellers/stores/listings are hidden via `status` filters (R-S07), never deleted.
- **Append-only (no delete):** `order_status_history`, `moderation_logs` (legal/audit). Enforce via RULES/policies preventing UPDATE/DELETE.
- **Hard delete (allowed):** `listing_images`/`review_photos`/`dispute_evidence` (with matching CDN/Storage delete), `wishlists`/`store_follows`/`addresses` (user-controlled), `otp_tokens` (hourly cron cleanup of expired), expired `sessions`.
- **Account deletion (OD-2, FROZEN):** MVP = **deactivate-only** via `users.status`. The columns `users.deleted_at` and `users.anonymized_at` (both `TIMESTAMPTZ NULL`) are **added now** (forward-compat — avoids a later `users` migration) but carry no MVP behavior: login is blocked when status≠active **or** `deleted_at IS NOT NULL` (R-A05); no hard delete, no anonymization. Full MW1 anonymization workflow populates `anonymized_at` post-MVP.

## 6. Scale assumptions at launch

< 50K listings (search safe for 2+ yrs); < 100K orders/month; `notifications` 5–10 rows/order → archive `is_read=TRUE` > 90 days before 50K orders; `order_status_history` ~5 rows/order, archive > 1yr; `rating_aggregates` 1 row/store (trigger-updated); `seller_snapshots` 1 row/store/day → partition by year before 10K sellers; split payments = 2 rows/order with UNIQUE `(order_id,payment_type)` to prevent duplicates — **custodial per OD-8/ADR-016 (payee = BETK; the deposit is paid to BETK's rails and admin-verified against the buyer's uploaded `payments.proof_path`; commission snapshotted on `orders.commission_rate`/`commission_amount` — the 3 additive OD-8 §9 columns, owed by Phase-07 T02's migration; table count 43 holds)**. (C3 §8.1.)

## 7. Triggers (5)

`update_listing_search_vector` (BEFORE INSERT/UPDATE on listings → tsvector from title_ar+title_en+description_ar via unaccent); `set_review_edit_deadline` (BEFORE INSERT on reviews → `edit_deadline = created_at + 48h`); `set_dispute_sla` (BEFORE INSERT on disputes → `sla_deadline = created_at + 48h`); `recalculate_rating_aggregate` (AFTER INSERT/UPDATE/DELETE on reviews → recompute `rating_aggregates`, R-R07); `decrement_stock_on_confirm` (on order confirmation → `listings.stock_qty`, set sold_out at 0, R-L05/06). At MVP scale these are acceptable; post-MVP move rating recompute to a queue (C3 §8.3).

## 8. Supabase → TypeScript type mapping

- Generate types: `supabase gen types typescript --linked --schema betk,betk_analytics > src/lib/supabase/types.ts`. Regenerate after **every** migration; commit the diff in the same PR (CI checks it is current — see `CICD_PIPELINE.md`).
- Mapping conventions: Postgres `uuid`→`string`; `timestamptz`→`string` (ISO); `numeric`→`number` (watch precision on money — treat EGP amounts as `number` but format/round at the edge; never do float math for totals — compute server-side); `jsonb`→typed via hand-written interfaces in `src/types/` layered over the generated `Json` type (e.g. `StorePaymentMethods`, `StoreDeliveryOptions`, `NotificationPrefs`, `NotificationData`); enums → generated string-literal unions matching C3 §2 (`user_role`, `order_status`, `payment_method`, `dispute_status`, …). Re-export enum unions from `src/constants/enums.ts` so UI badge maps (`StatusBadge`) stay in sync.
- Validation boundary: generated types describe DB shape; **Zod** schemas in `src/validations/` validate all inputs (forms, Server Actions, API routes) before they touch Supabase. Types and Zod are kept separate by design (Dev OS Step 5).

## 9. Executable schema

The full PostgreSQL 17 / Supabase DDL — extensions, **34 enum types** (verified via `pg_type` query, T12 2026-06-23), 43 `CREATE TABLE`s, constraints, 41 indexes, 5 triggers, 39 RLS policies (36 permissive + 3 restrictive, post-T01-FIX), 2 helper functions, 6 pg_cron jobs — is the contract in `BETK_DATABASE_SCHEMA.sql`. Migrations run in the exact 057-step dependency order from C3 §7 (note the circular `inquiries.converted_to_order_id` ↔ `orders` resolved by ALTER after both exist; seed boost_packages at 039 and admin_settings at 048).

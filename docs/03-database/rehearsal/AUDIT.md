# AUDIT — authored M1–M6 (T02-FIX)

Audited text: `docs/03-database/rehearsal/staging-text/M1.sql`–`M6.sql` after C1 (checkout shell). Branch tip at audit start: `b3e6f04`. Sources: `BETK_V2_SCHEMA_DELTA_PLAN.md` (plan), `BETK_ERD.md` (ERD), and read-only staging SELECTs on 2026-09-27 (`execute_sql`, `list_migrations`). Ledger still 31 versions, last `20260723140552`.

Verdicts: **MATCH** (kit equals the cited text), **BROADER** (kit allows more), **NARROWER** (kit allows less), **AUTHORED** (not a copy of a fenced block or a cell; basis stated), **MISMATCH** (contradicts explicit ERD or plan text). A FINDING is a BROADER security row with no later closer, or a design choice. Findings are not patched.

**Fixes:** none. No `file:line` before → after. Zero design changes.

**Findings**

1. **F1 `returns_update`.** ERD §8: UPDATE is “seller accept/reject, admin refund”, three-layer YES. Kit `M2.sql:148-151` is permissive UPDATE for `store_id = my_store_id()` OR `is_admin()`, every column. A seller can set `status` to `refunded` and can change `buyer_id`, `seller_order_id`, and `reason`. Plan §6 M7 names no returns column grant. Plan §6 M8 / §1.7 names no returns transition trigger. No closer. Not narrowed.
2. **F2 `store_categories_select`.** ERD §8: SELECT is “public read of ids, own, admin”. Kit `M2.sql:232-235` is `TO anon, authenticated USING (true)`, so anon reads `approved_at` and rows whose `approved_at` is null. Plan §6 puts this table’s policies in M2 and does not name a later replacement. No closer. Not narrowed.

## Counts by verdict

| Part | MATCH | BROADER | NARROWER | AUTHORED | MISMATCH | FINDING |
|---|---:|---:|---:|---:|---:|---:|
| a Columns | 88 | 0 | 0 | 0 | 0 | 0 |
| a Constraints and keys | 23 | 0 | 0 | 1 | 0 | 0 |
| b Policies | 23 | 3 | 0 | 0 | 0 | 2 (F1, F2) |
| c Grants and revokes | 10 | 2 | 0 | 0 | 0 | 0 |
| d `enforce_payment_update` | 1 | 0 | 0 | 0 | 0 | 0 |
| e Cron | 1 | 0 | 0 | 0 | 0 | 0 |
| f M5 statements | 10 | 0 | 0 | 4 | 0 | 0 |
| g M1 | 7 | 0 | 0 | 1 | 0 | 0 |
| h Other authored | 0 | 0 | 0 | 6 | 0 | 0 |

BROADER rows that name a closer: `master_orders_update` (b), `master_orders` anon SELECT and authenticated table UPDATE (c). They are not findings.

`smallint` is `int2`. `timestamptz` is `timestamp with time zone`. A missing `ON DELETE` clause is NO ACTION (ERD §6, “NO ACTION means no ON DELETE clause”). Policy `TO` omitted means PUBLIC. Permissive is the default.

## a. Columns

### `cart_items` — ERD §6.1

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `id uuid` NO `gen_random_uuid()` | `M2.sql:16` | ERD §6.1 | MATCH | PK on `:25` |
| `buyer_id uuid` NO | `M2.sql:17` | ERD §6.1 | MATCH | FK `users` CASCADE `:26` |
| `listing_id uuid` NO | `M2.sql:18` | ERD §6.1 | MATCH | FK `listings` NO ACTION `:27` |
| `quantity smallint` NO | `M2.sql:19` | ERD §6.1 `int2` | MATCH | CHECK `> 0` `:29` |
| `unit_price numeric(10,2)` NO | `M2.sql:20` | ERD §6.1 | MATCH | CHECK `> 0` `:30` |
| `is_custom boolean` NO default `false` | `M2.sql:21` | ERD §6.1 | MATCH | |
| `inquiry_id uuid` YES | `M2.sql:22` | ERD §6.1 | MATCH | FK `inquiries` NO ACTION `:28` |
| `created_at timestamptz` NO `now()` | `M2.sql:23` | ERD §6.1 | MATCH | |
| `updated_at timestamptz` NO `now()` | `M2.sql:24` | ERD §6.1 | MATCH | No `store_id`. No `blocked`. |

### `master_orders` — ERD §6.1

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `id uuid` NO `gen_random_uuid()` | `M2.sql:67` | ERD §6.1 | MATCH | PK `:83` |
| `buyer_id uuid` NO | `M2.sql:68` | ERD §6.1 | MATCH | FK `users` NO ACTION `:85` |
| `betk_ref varchar(25)` NO | `M2.sql:69` | ERD §6.1 | MATCH | UNIQUE `:84`. No format CHECK (plan §1.4) |
| `delivery_address_id uuid` YES | `M2.sql:70` | ERD §6.1 | MATCH | FK `addresses` NO ACTION `:86` |
| `recipient_name varchar(100)` YES | `M2.sql:71` | ERD §6.1 | MATCH | |
| `recipient_phone varchar(15)` YES | `M2.sql:72` | ERD §6.1 | MATCH | |
| `snapshot_governorate varchar(50)` YES | `M2.sql:73` | ERD §6.1 | MATCH | |
| `snapshot_city varchar(100)` YES | `M2.sql:74` | ERD §6.1 | MATCH | |
| `snapshot_street_address text` YES | `M2.sql:75` | ERD §6.1 | MATCH | |
| `snapshot_building_notes text` YES | `M2.sql:76` | ERD §6.1 | MATCH | |
| `combined_delivery_total numeric(10,2)` NO | `M2.sql:77` | ERD §6.1 | MATCH | No default. CHECK `>= 0` `:87` |
| `proof_path varchar` YES | `M2.sql:78` | ERD §6.1 | MATCH | Unbounded `varchar`, as the cell |
| `transfer_reference varchar(100)` YES | `M2.sql:79` | ERD §6.1 | MATCH | |
| `proof_uploaded_at timestamptz` YES | `M2.sql:80` | ERD §6.1 | MATCH | |
| `payment_deadline timestamptz` YES | `M2.sql:81` | ERD §6.1 | MATCH | |
| `created_at timestamptz` NO `now()` | `M2.sql:82` | ERD §6.1 | MATCH | No status column |

### `returns` — ERD §6.1

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `id uuid` NO `gen_random_uuid()` | `M2.sql:120` | ERD §6.1 | MATCH | PK `:128` |
| `seller_order_id uuid` NO | `M2.sql:121` | ERD §6.1 | MATCH | FK to `betk.orders` `:129`. Relation is still `orders` in M2; M6 renames in place and the FK follows the OID (plan §2). No UNIQUE (ERD §6.1, plan §1.1) |
| `buyer_id uuid` NO | `M2.sql:122` | ERD §6.1 | MATCH | FK `users` NO ACTION `:130` |
| `store_id uuid` NO | `M2.sql:123` | ERD §6.1 | MATCH | FK `stores` NO ACTION `:131` |
| `reason text` NO | `M2.sql:124` | ERD §6.1 | MATCH | |
| `status return_status` NO default `requested` | `M2.sql:125` | ERD §6.1 | MATCH | |
| `created_at timestamptz` NO `now()` | `M2.sql:126` | ERD §6.1 | MATCH | |
| `resolved_at timestamptz` YES | `M2.sql:127` | ERD §6.1 | MATCH | |

### `return_evidence` — ERD §6.1

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `id uuid` NO `gen_random_uuid()` | `M2.sql:156` | ERD §6.1 | MATCH | PK `:160` |
| `return_id uuid` NO | `M2.sql:157` | ERD §6.1 | MATCH | FK `returns` CASCADE `:161` |
| `storage_path text` NO | `M2.sql:158` | ERD §6.1 | MATCH | |
| `created_at timestamptz` NO `now()` | `M2.sql:159` | ERD §6.1 | MATCH | |

### `agreement_acceptances` — ERD §6.1

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `id uuid` NO `gen_random_uuid()` | `M2.sql:195` | ERD §6.1 | MATCH | PK `:203` |
| `user_id uuid` NO | `M2.sql:196` | ERD §6.1 | MATCH | FK `users` NO ACTION `:204` |
| `document agreement_document` NO | `M2.sql:197` | ERD §6.1 | MATCH | |
| `version_label text` NO | `M2.sql:198` | ERD §6.1 | MATCH | |
| `status text` NO default `'accepted'` | `M2.sql:199` | ERD §6.1 | MATCH | CHECK `status = 'accepted'` `:206` |
| `accepted_at timestamptz` NO `now()` | `M2.sql:200` | ERD §6.1 | MATCH | |
| `ip inet` YES | `M2.sql:201` | ERD §6.1 | MATCH | |
| `user_agent text` YES | `M2.sql:202` | ERD §6.1 | MATCH | |

### `store_categories` — ERD §6.1

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `store_id uuid` NO | `M2.sql:222` | ERD §6.1 | MATCH | PK `(store_id, category_id)` `:225`. FK `stores` CASCADE `:226` |
| `category_id uuid` NO | `M2.sql:223` | ERD §6.1 | MATCH | FK `categories` NO ACTION `:227` |
| `approved_at timestamptz` YES | `M2.sql:224` | ERD §6.1 | MATCH | No default. Cap trigger is M8 (`enforce_store_category_cap`), not a CHECK of 3 |

### `courier_rates` — ERD §6.1

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `id uuid` NO `gen_random_uuid()` | `M2.sql:253` | ERD §6.1 | MATCH | PK `:259` |
| `origin_governorate varchar(50)` NO | `M2.sql:254` | ERD §6.1 | MATCH | |
| `destination_governorate varchar(50)` NO | `M2.sql:255` | ERD §6.1 | MATCH | |
| `weight_min_g integer` NO | `M2.sql:256` | ERD §6.1 | MATCH | CHECK `>= 0` `:261` |
| `weight_max_g integer` YES | `M2.sql:257` | ERD §6.1 | MATCH | CHECK null or `> weight_min_g` `:262` |
| `fee_egp numeric(10,2)` NO | `M2.sql:258` | ERD §6.1 | MATCH | CHECK `>= 0` `:263` |

### `store_pickup_addresses` — ERD §6.1

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `store_id uuid` NO | `M2.sql:294` | ERD §6.1 | MATCH | PK `:300`. FK `stores` CASCADE `:301` |
| `governorate varchar(50)` NO | `M2.sql:295` | ERD §6.1 | MATCH | ADR-023 equality trigger is M8, not this column |
| `city varchar(100)` NO | `M2.sql:296` | ERD §6.1 | MATCH | |
| `street_address text` NO | `M2.sql:297` | ERD §6.1 | MATCH | |
| `building_notes text` YES | `M2.sql:298` | ERD §6.1 | MATCH | |
| `updated_at timestamptz` NO `now()` | `M2.sql:299` | ERD §6.1 | MATCH | |

### M3 columns — ERD §6.2 and §6.3, plan §1.2

Added to `betk.orders` before the M6 rename. The relation OID is unchanged by the rename.

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `listings.weight_g integer` YES | `M3.sql:8` | ERD §6.3 | MATCH | CHECK `> 0` when not null `:17` |
| `listings.length_mm integer` YES | `M3.sql:9` | ERD §6.3 | MATCH | CHECK `:18` |
| `listings.width_mm integer` YES | `M3.sql:10` | ERD §6.3 | MATCH | CHECK `:19` |
| `listings.height_mm integer` YES | `M3.sql:11` | ERD §6.3 | MATCH | CHECK `:20` |
| `listings.specs jsonb` NO default `'{}'` | `M3.sql:12` | ERD §6.3 | MATCH | |
| `listings.prep_days smallint` YES | `M3.sql:13` | ERD §6.3 | MATCH | No CHECK of 3 |
| `listings.stock_touched_at timestamptz` YES | `M3.sql:14` | ERD §6.3 | MATCH | |
| `inquiries.quoted_price numeric(10,2)` YES | `M3.sql:34` | ERD §6.3 | MATCH | CHECK `> 0` when not null `:40` |
| `inquiries.quoted_prep_days smallint` YES | `M3.sql:35` | ERD §6.3 | MATCH | CHECK `>= 0` when not null `:41` |
| `inquiries.quote_expires_at timestamptz` YES | `M3.sql:36` | ERD §6.3 | MATCH | |
| `inquiries.quoted_at timestamptz` YES | `M3.sql:37` | ERD §6.3 | MATCH | |
| `order_items.is_custom boolean` NO default `false` | `M3.sql:44` | ERD §6.3 | MATCH | |
| `order_items.inquiry_id uuid` YES | `M3.sql:45` | ERD §6.3 | MATCH | FK `inquiries` NO ACTION `:49-50` |
| `order_items.prep_days_snapshot smallint` YES | `M3.sql:46` | ERD §6.3 | MATCH | |
| `payments.refunded_amount numeric(10,2)` NO default `0` | `M3.sql:58` | ERD §6.3 | MATCH | CHECK `0 <= x <= amount` `:62-63` |
| `payments.proof_snapshot_at timestamptz` YES | `M3.sql:59` | ERD §6.3 | MATCH | |
| `disputes.return_id uuid` YES | `M3.sql:66` | ERD §6.3 | MATCH | FK `returns` NO ACTION `:69-70`. No `master_order_id` |
| `orders.master_order_id uuid` YES in M3 | `M3.sql:73` | ERD §6.2; plan §1.2 | MATCH | Nullable during backfill. FK NO ACTION `:86-87`. `SET NOT NULL` is M5 |
| `orders.display_ref varchar(64)` YES | `M3.sql:74` | ERD §6.2 | MATCH | Partial unique where not null `:95-97`. No format CHECK |
| `orders.courier_rate_id uuid` YES | `M3.sql:75` | ERD §6.2 | MATCH | FK `ON DELETE SET NULL` `:88-89` |
| `orders.prep_deadline timestamptz` YES | `M3.sql:76` | ERD §6.2 | MATCH | |
| `orders.escalated_at timestamptz` YES | `M3.sql:77` | ERD §6.2 | MATCH | |
| `orders.escalation_reason escalation_reason` YES | `M3.sql:78` | ERD §6.2 | MATCH | |
| `orders.escalation_note text` YES | `M3.sql:79` | ERD §6.2 | MATCH | |
| `orders.escalation_resolved_at timestamptz` YES | `M3.sql:80` | ERD §6.2 | MATCH | |
| `orders.balance_confirmed_at timestamptz` YES | `M3.sql:81` | ERD §6.2 | MATCH | |
| `orders.refunded_subtotal numeric(10,2)` NO default `0` | `M3.sql:82` | ERD §6.2 | MATCH | CHECK `0 <= x <= subtotal` `:92-93` |
| `orders.payout_eligible_at timestamptz` YES | `M3.sql:83` | ERD §6.2 | MATCH | |

Column row count: cart 9, master 16, returns 8, evidence 4, agreement 8, store_categories 3, courier 6, pickup 6, M3 28. Total 88. All MATCH.

### Constraints and keys that are not one column

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `chk_cart_item_custom_inquiry` | `M2.sql:31-34` | ERD §6.1 | MATCH | |
| `uq_cart_items_listing` | `M2.sql:37-39` | ERD §6.1 | MATCH | Partial `(buyer_id, listing_id) WHERE inquiry_id IS NULL` |
| `uq_cart_items_inquiry` | `M2.sql:41-43` | ERD §6.1 | MATCH | Partial `(buyer_id, inquiry_id) WHERE inquiry_id IS NOT NULL` |
| `uq_master_orders_betk_ref` | `M2.sql:84` | ERD §6.1 | MATCH | |
| `chk_master_combined_delivery_total` | `M2.sql:87` | ERD §6.1 | MATCH | |
| no UNIQUE on `returns.seller_order_id` | `M2.sql:119-132` | ERD §6.1; plan §1.1 | MATCH | Absence is the spec |
| `uq_agreement_acceptances_version` | `M2.sql:205` | ERD §6.1 | MATCH | `(user_id, document, version_label)` |
| `chk_agreement_acceptance_status` | `M2.sql:206` | ERD §6.1 | MATCH | |
| `store_categories` PK | `M2.sql:225` | ERD §6.1 | MATCH | |
| `uq_courier_rates_band_start` | `M2.sql:260` | ERD §6.1 | MATCH | |
| `courier_rates_weight_min_check` | `M2.sql:261` | ERD §6.1 | MATCH | |
| `courier_rates_weight_max_check` | `M2.sql:262` | ERD §6.1 | MATCH | |
| `courier_rates_fee_check` | `M2.sql:263` | ERD §6.1 | MATCH | |
| `courier_rates_no_overlap` | `M2.sql:264-268` | ERD §6.1; plan §1.2 | AUTHORED | Exclusion is required. The gist expression is not fenced. `int4range(..., '[)')` is half-open; NULL `weight_max_g` is an open upper bound, so two open bands for one pair conflict. `btree_gist` is the fenced block at `M2.sql:11` (MATCH, plan §1.2) |
| `store_pickup_addresses` PK | `M2.sql:300` | ERD §6.1 | MATCH | One row per store |
| `chk_active_listing_shipping` NOT VALID | `M3.sql:23-31` | plan §1.2 fence; ERD §6.3 | MATCH | Byte match to the fenced ALTER. Not validated |
| four listing dimension CHECKs | `M3.sql:17-20` | ERD §6.3 | MATCH | |
| two inquiry CHECKs | `M3.sql:40-41` | ERD §6.3 | MATCH | |
| `chk_order_item_custom_inquiry` | `M3.sql:51-55` | ERD §6.3 | MATCH | Same predicate as cart |
| `chk_refunded_amount` | `M3.sql:62-63` | ERD §6.3 | MATCH | |
| `chk_escalation_reason_present` | `M3.sql:90-91` | ERD §6.2 | MATCH | |
| `chk_refunded_subtotal` | `M3.sql:92-93` | ERD §6.2 | MATCH | |
| `uq_orders_display_ref` | `M3.sql:95-97` | ERD §6.2 | MATCH | |
| `admin_settings` 13 keys | `M3.sql:101-114` | plan §6 M3; ERD §6.3 | MATCH | Four stated meanings (`2`, `24`, `3`, `3`). Nine empty strings. No placeholder |

Constraint rows: 23 MATCH, 1 AUTHORED.

## b. Policies

Each row is one `CREATE POLICY`. Command, permissive/restrictive, and roles are in the note. `(select auth.uid())` is plan §1.5 (no new initplan). Live `orders_phone_gate` still uses bare `auth.uid()`; the new gate uses the plan’s wrapper. `is_admin()` stays in the policy (plan §1.5 last paragraph).

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `cart_items_select` | `M2.sql:47-49` | ERD §8 SELECT “self or admin. Seller none.” | MATCH | Permissive SELECT, PUBLIC. `buyer_id = (select auth.uid()) OR is_admin()`. No phone gate (REG-79) |
| `cart_items_insert` | `M2.sql:51-53` | ERD §8 INSERT “self. No phone gate” | MATCH | Permissive INSERT, PUBLIC. WITH CHECK self. No admin (cell does not say admin) |
| `cart_items_update` | `M2.sql:55-58` | ERD §8 UPDATE “self” | MATCH | Permissive UPDATE, PUBLIC. USING and WITH CHECK self |
| `cart_items_delete` | `M2.sql:60-62` | ERD §8 DELETE “self” | MATCH | Permissive DELETE, PUBLIC |
| `master_orders_select` | `M2.sql:92-94` | ERD §8 “buyer self or admin. Seller none.” | MATCH | Permissive SELECT, PUBLIC |
| `master_orders_insert` | `M2.sql:96-98` | ERD §8 INSERT “buyer, plus restrictive phone gate” | MATCH | Permissive INSERT, PUBLIC, buyer only. Column list of the INSERT grant is M7 (part c) |
| `master_orders_phone_gate` | `M2.sql:100-110` | ERD §8; plan §1.5; live `orders_phone_gate` | MATCH | RESTRICTIVE INSERT, PUBLIC. Predicate is the live gate (`users.phone_number IS NOT NULL`) with `(select auth.uid())` |
| `master_orders_update` | `M2.sql:112-115` | ERD §8 “buyer proof columns only, or admin” | BROADER | Resolved below. Closers: M7 column grant, M8 trigger |
| `returns_select` | `M2.sql:136-142` | ERD §8 “buyer self, store, admin” | MATCH | Permissive SELECT, PUBLIC |
| `returns_insert` | `M2.sql:144-146` | ERD §8 INSERT “buyer” | MATCH | Permissive INSERT, PUBLIC, `buyer_id = (select auth.uid())`. The cell does not require an order-ownership check; the kit does not add one |
| `returns_update` | `M2.sql:148-151` | ERD §8 “seller accept/reject, admin refund” | BROADER | **F1.** No closer |
| `return_evidence_select` | `M2.sql:166-179` | ERD §8 “return parties or admin” | MATCH | Permissive SELECT, PUBLIC. Admin, or the return’s buyer, or the return’s store |
| `return_evidence_insert` | `M2.sql:181-190` | ERD §8 INSERT “buyer” | MATCH | Permissive INSERT, PUBLIC. Buyer of that return. No UPDATE or DELETE policy (cells are none) |
| `agreement_acceptances_select` | `M2.sql:211-213` | ERD §8 “self or admin” | MATCH | Permissive SELECT, PUBLIC |
| `agreement_acceptances_insert` | `M2.sql:215-217` | ERD §8 INSERT “self” | MATCH | Permissive INSERT, PUBLIC. No UPDATE or DELETE policy |
| `store_categories_select` | `M2.sql:232-235` | ERD §8 “public read of ids, own, admin” | BROADER | **F2.** No closer |
| `store_categories_insert` | `M2.sql:237-239` | ERD §8 INSERT “own or admin” | MATCH | Permissive INSERT, PUBLIC |
| `store_categories_update` | `M2.sql:241-244` | ERD §8 UPDATE “admin (`approved_at`)” | MATCH | Permissive UPDATE, PUBLIC, `is_admin()` only. The only non-key column is `approved_at`. Not column-granted; not security-relevant beyond admin |
| `store_categories_delete` | `M2.sql:246-248` | ERD §8 DELETE “own or admin” | MATCH | Permissive DELETE, PUBLIC |
| `courier_rates_select` | `M2.sql:273-276` | ERD §8 “any authenticated” | MATCH | Permissive SELECT, `TO authenticated`, `USING (true)`. Anon has no policy |
| `courier_rates_insert` | `M2.sql:278-280` | ERD §8 INSERT “admin” | MATCH | Permissive INSERT, PUBLIC, `is_admin()` |
| `courier_rates_update` | `M2.sql:282-285` | ERD §8 UPDATE “admin” | MATCH | Permissive UPDATE, PUBLIC |
| `courier_rates_delete` | `M2.sql:287-289` | ERD §8 DELETE “admin” | MATCH | Permissive DELETE, PUBLIC |
| `store_pickup_addresses_select` | `M2.sql:306-308` | ERD §8 “own seller or admin. Buyer none.” | MATCH | Permissive SELECT, PUBLIC |
| `store_pickup_addresses_insert` | `M2.sql:310-312` | ERD §8 INSERT “own seller” | MATCH | Permissive INSERT, PUBLIC. No admin (cell does not say admin) |
| `store_pickup_addresses_update` | `M2.sql:314-317` | ERD §8 UPDATE “own seller or admin” | MATCH | Permissive UPDATE, PUBLIC. No DELETE policy. ADR-023 trigger is M8 (plan §6 M8), not this policy |

Empty ERD DELETE/UPDATE cells with no policy in the kit: `master_orders` DELETE, `returns` DELETE, `return_evidence` UPDATE and DELETE, `agreement_acceptances` UPDATE and DELETE, `store_pickup_addresses` DELETE. MATCH (no policy is the cell).

### `master_orders_update` (explicit)

ERD §8 says the buyer may update proof columns only, or admin may update. The kit’s policy (`M2.sql:112-115`) is permissive UPDATE, PUBLIC, USING and WITH CHECK `buyer_id = (select auth.uid()) OR is_admin()`. It does not name columns. Row scope matches “buyer or admin”. Column scope is every column the role can write.

What closes it:

- **M7** `master_orders` grants (plan §6 M7; plan §1.6): `GRANT UPDATE (proof_path, transfer_reference)` only. That is the column GRANT. Until that statement, measured `pg_default_acl` on `betk` gives `authenticated` table `arwd`, and M2 does not revoke `authenticated` UPDATE, so the buyer who passes this policy can UPDATE every column.
- **M8** `enforce_master_proof_update` (plan §6 M8; plan §1.7): BEFORE UPDATE, buyer sets the two proof columns once, before `payment_deadline`, while children are `pending` and proof is null, and stamps `proof_uploaded_at`.

Staging is **fail-open on columns from the M2 commit until M7’s column grant**. From M7 until M8 the column list is the two proof columns, and the once/deadline/children-pending rules are not enforced yet. Both closers are named. Not a finding. Not narrowed in this kit.

## c. Grants and revokes

Measured `pg_default_acl` for schema `betk`, role `postgres`, objtype `r`: `anon=arwd/postgres`, `authenticated=arwd/postgres`, `service_role=arwdDxtm/postgres`. No `betk` row for functions. Function default EXECUTE exists on `public` only (`anon`, `authenticated`, `service_role` = `X`). That matches plan §6 M6.

M2’s grant change past that ACL is `REVOKE INSERT, UPDATE, DELETE … FROM anon` on each new table (plan §6 fail-closed sentence: policies, then any grant beyond the default ACL). There is no `GRANT` in M2–M6. M3, M4, and M5 contain no grant statement.

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `REVOKE` I/U/D `cart_items` FROM `anon` | `M2.sql:64` | plan §6 M2; measured ACL | MATCH | Anon keeps SELECT. RLS predicate denies anon rows |
| `REVOKE` I/U/D `master_orders` FROM `anon` | `M2.sql:117` | plan §6 M2 | MATCH | Writes match “anon gets no write” (plan §1.6) |
| `REVOKE` I/U/D `returns` FROM `anon` | `M2.sql:153` | plan §6 M2 | MATCH | |
| `REVOKE` I/U/D `return_evidence` FROM `anon` | `M2.sql:192` | plan §6 M2 | MATCH | |
| `REVOKE` I/U/D `agreement_acceptances` FROM `anon` | `M2.sql:219` | plan §6 M2 | MATCH | |
| `REVOKE` I/U/D `store_categories` FROM `anon` | `M2.sql:250` | plan §6 M2 | MATCH | Anon SELECT stays, and the SELECT policy is `TO anon` (F2 is the predicate, not this revoke) |
| `REVOKE` I/U/D `courier_rates` FROM `anon` | `M2.sql:291` | plan §6 M2 | MATCH | SELECT policy is `TO authenticated`, so anon SELECT privilege returns no rows |
| `REVOKE` I/U/D `store_pickup_addresses` FROM `anon` | `M2.sql:319` | plan §6 M2 | MATCH | |
| `authenticated` keeps table `arwd` on the 8 tables | M2, no further GRANT | measured ACL; plan §6 M2 | MATCH | M2 does not add a grant. Final column grants are M7 |
| `master_orders` anon SELECT remains | `M2.sql:117` does not revoke SELECT | plan §1.6 “anon gets no SELECT and no UPDATE” | BROADER | Closer: plan §6 M7 “`master_orders` grants”. Until then the SELECT policy denies anon (`auth.uid()` null, not admin) |
| `master_orders` `authenticated` table UPDATE remains | default ACL, not revoked | plan §1.6 column UPDATE | BROADER | Same window as `master_orders_update`. Closer: M7 `GRANT UPDATE (proof_path, transfer_reference)` only |
| `REVOKE EXECUTE` on `checkout_from_cart(uuid)` | `M6.sql:92` | plan §6 M6 | MATCH | FROM `PUBLIC`, `anon`, and `authenticated`. No GRANT in M6. `betk` has no function default ACL; PostgreSQL still grants EXECUTE to PUBLIC on CREATE FUNCTION, and this revoke removes it in the same migration |

Live `orders` privileges (measured `column_privileges`): `authenticated` UPDATE is only `status` and `cancellation_reason`; `anon` UPDATE is table-level (every existing column). M3’s new columns are not in the authenticated column grant. Plan §1.6 adds `escalated_at`, `escalation_reason`, and `escalation_note` in the grant migration, which is M7. M3 does not grant them. Anon’s table-level UPDATE includes columns added later; there is still no anon-satisfying UPDATE policy (plan §1.6: anon table UPDATE stays; do not add a public UPDATE policy).

`service_role` keeps `arwdDxtm` from the measured ACL. Plan §1.6: service role unchanged.

## d. `enforce_payment_update`

Kit `M6.sql:11-43`. Live `pg_get_functiondef('betk.enforce_payment_update()')` measured 2026-09-27.

After substituting `betk.seller_orders` back to `betk.orders`, the kit statement matches the live definition. The only definition difference is that one table name (`M6.sql:38`). The kit’s extra character is the SQL statement-terminator semicolon after `$function$`, which `pg_get_functiondef` does not print. Signature, `SECURITY DEFINER`, `search_path`, comments, and branches are otherwise the same. Verdict: **MATCH**. Allowed difference only. Not a finding.

The full rework (proof copy, `refunded_subtotal`, `balance_confirmed_at`) is M8 (plan §2.1, §6 M8). M6 is the table name only.

## e. `daily-platform-snapshot`

Kit `M6.sql:45-74`. Live `cron.job` jobid 8, jobname `daily-platform-snapshot`, schedule `5 22 * * *`, command length 1310, three occurrences of `betk.orders`.

`md5(replace(live command, 'betk.orders', 'betk.seller_orders'))` = `a6d5cd9fd0a105a8902c23704ec848f5`. MD5 of the kit’s dollar-quoted body = the same value. Length 1331 = 1310 + 7 × 3 (`seller_`). Schedule string is `5 22 * * *`. Trailing bytes of both are `NOTHING;` then newline then two spaces (the spaces sit inside the dollar quote, before the closing `$$`). Verdict: **MATCH**. Table name only, three substitutions. Plan §2.2: `cron.schedule` on the same name replaces the command. No new job.

## f. M5 versus plan §4.3–§4.9

The staging literals are the live ids, md5s, and stocks (plan §3, §4.8, §4.9). The rehearsal file swaps that block. This table is the staging text.

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `n27_bound` and its inserts | `M5.sql:2-42` | plan §3, §4.8, §4.9 | AUTHORED | Temp table so the rehearsal can swap literals. Values are the plan’s ids, md5s, stocks, and counts 7 / 0 / 0 / 7 |
| Abort payments ≠ 0 | `M5.sql:55-57` | plan §4.3 fence | MATCH | Name `BETK_N27_PAYMENTS_NONEMPTY` is in the fence |
| Abort orders ≠ 7 | `M5.sql:58-60` | plan §4.3 fence | MATCH | Name `BETK_N27_ORDER_COUNT` is in the fence |
| Abort items ≠ 0 | `M5.sql:61-63` | plan §4.9; §6 M5 | AUTHORED | Condition is the plan’s. Name `BETK_N27_ITEMS_NONEMPTY` is not in the fence |
| Abort unless five targets have the named statuses | `M5.sql:64-72` | plan §4.9 | AUTHORED | Condition is the plan’s (three `pending`, two `confirmed`). Name `BETK_N27_TARGET_STATUS` is not in the fence |
| INSERT one master per order | `M5.sql:76-110` | plan §4.3 column map | MATCH | `buyer_id`, address, `betk_ref`, `delivery_fee`, `created_at`, recipient nulls, address snapshot, proof nulls, `payment_deadline` null. LEFT JOIN addresses |
| Link `master_order_id` | `M5.sql:112-115` | plan §4.3, §4.4 | MATCH | Runs while `trg_enforce_order_transition` is still enabled. Match on `betk_ref`. Child identity columns are not cleared |
| `DISABLE TRIGGER trg_enforce_order_transition` | `M5.sql:117` | plan §4.9 fence | MATCH | Not `DISABLE TRIGGER ALL`. Not `session_replication_role` |
| Five status updates | `M5.sql:119-124` | plan §4.9 | MATCH | `status = cancelled`, `cancelled_by = system`. `cancellation_reason` and `confirmed_at` not written |
| Five history inserts | `M5.sql:126-142` | plan §4.9 column table | MATCH | `from_status` from the bound pre-update status. `changed_by` null. `changed_by_type` `system`. Notes text matches |
| `ENABLE TRIGGER` | `M5.sql:144` | plan §4.9 fence | MATCH | |
| Post-enable verify | `M5.sql:146-241` | plan §4.9 verification paragraph | AUTHORED | Conditions match: `tgenabled = 'O'`; original md5s (plan §3 expression); history count + 5; exactly 5 new ids; one D1 row per target; one history row on each keep; stock unchanged; payments 0; items 0. Names `BETK_N27_TRIGGER_NOT_ENABLED`, `BETK_N27_HISTORY_MD5`, `BETK_N27_HISTORY_COUNT`, `BETK_N27_HISTORY_NEW`, `BETK_N27_D1_ROW`, `BETK_N27_KEEP_HISTORY`, `BETK_N27_STOCK_MOVED` are not in the fence. The payments and items names repeat the abort names |
| `master_order_id SET NOT NULL` | `M5.sql:244` | plan §4.6; §6 M5 | MATCH | After the history inserts |
| `betk_ref DROP NOT NULL` | `M5.sql:245` | plan §4.6; §6 M5 | MATCH | Unique index not dropped |

The abort block runs before the master INSERT, which is earlier than “before the DISABLE” and still before it. One transaction either way. Not a mismatch.

M4, for the sequence around M5: `DROP TRIGGER trg_decrement_stock_on_confirm ON betk.orders` (`M4.sql:7`). MATCH plan §4.2 and §6 M4. The function remains until M8.

## g. M1

Live `order_status` sort order measured 2026-09-27: `pending`, `confirmed`, `preparing`, `dispatched`, `delivered`, `cancelled`, `returned`. There is no `ready`.

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `order_status` + `ready` AFTER `preparing` | `M1.sql:8` | ERD §5 member list | AUTHORED | ERD lists `ready` after `preparing` and before `dispatched`. It does not say `ADD VALUE … AFTER`. A default `ADD VALUE` would append after `returned`. **Enum label order is irreversible** (plan §1.3: adding a label is a point of no return; this plan does not drop enum labels) |
| `doc_type` + `food_packaging` | `M1.sql:10` | ERD §5 | MATCH | Append. Listed first of the four |
| `doc_type` + `food_label` | `M1.sql:11` | ERD §5 | MATCH | |
| `doc_type` + `food_expiry` | `M1.sql:12` | ERD §5 | MATCH | |
| `doc_type` + `food_social_url` | `M1.sql:13` | ERD §5 | MATCH | |
| `escalation_reason` | `M1.sql:15-20` | ERD §5 | MATCH | `out_of_stock`, `damaged`, `cannot_fulfil`, `sla_breach` |
| `return_status` | `M1.sql:22-27` | ERD §5 | MATCH | `requested`, `accepted`, `rejected`, `refunded` |
| `agreement_document` | `M1.sql:29-34` | ERD §5 | MATCH | `buyer_terms`, `seller_agreement`, `return_policy`, `privacy` |

No `pending_payment`, `closed`, or `settled` on `order_status`. No master-status enum.

## h. In M1–M6 and not a fenced block or a cell

| Object | Kit | Basis | Verdict | Note |
|---|---|---|---|---|
| Staging-bound literal markers | every `Mn.sql` lines 1–2 | option B kit | AUTHORED | Empty in M1–M4 and M6. M5’s interior is part f |
| `SET LOCAL search_path TO betk, extensions, public` | `M2.sql:13` | plan §1.2 `btree_gist` in `extensions` | AUTHORED | So the exclusion constraint can see the gist operator class. Transaction-local |
| Constraint, index, and policy names | M2, M3 | ERD states the predicates and keys, not these names | AUTHORED | Names follow the live `table_column_fkey` / `chk_` / `uq_` shape. Plan §2: do not rename existing names on the rename |
| `courier_rates_no_overlap` gist expression | `M2.sql:264-268` | plan §1.2 | AUTHORED | Counted in part a. Repeated here so the expression is on the authored list |
| M5 `n27_bound`, the items/status abort names, and the verify block | `M5.sql` | plan §4.9 conditions | AUTHORED | Counted in part f |
| `checkout_from_cart` shell | `M6.sql:81-90` | C1 (human, 2026-09-26) | AUTHORED | Signature is the final one: `(p_delivery_address_id uuid) RETURNS uuid`, plpgsql, `SECURITY INVOKER`, `search_path` `betk, public`. Body is `RAISE EXCEPTION 'BETK_CHECKOUT_NOT_READY'` (`M6.sql:88`). The T02 body is `drafts/checkout_from_cart.draft.sql` (banner on line 1; not applied). Real body is T05b, then M8 `CREATE OR REPLACE` (plan §6 M8). `REVOKE` stays at `M6.sql:92` |

M6 statements other than the shell, already judged above: rename `M6.sql:9` MATCH plan §4.5; payment function part d; cron part e; `DROP FUNCTION betk.create_order_from_inquiry(uuid, uuid, betk.delivery_preference, betk.payment_method)` `M6.sql:76` MATCH the live identity arguments measured 2026-09-27 (`p_inquiry_id uuid, p_address_id uuid, p_delivery_method betk.delivery_preference, p_deposit_method betk.payment_method`).

## Live reads used

All `execute_sql` SELECT, plus `list_migrations`. No `apply_migration`, no branch call.

- `pg_get_functiondef(betk.enforce_payment_update())`
- `cron.job` for `daily-platform-snapshot` (command, schedule, jobid 8, md5 after the table-name substitution)
- `pg_default_acl`
- `pg_proc` identity arguments for `create_order_from_inquiry` and `enforce_payment_update` (`checkout_from_cart` absent)
- `orders_phone_gate` (`polcmd` insert, restrictive, PUBLIC, phone predicate)
- `information_schema.column_privileges` UPDATE on `betk.orders`
- `pg_enum` `order_status` order
- `pg_constraint` `order_status_history_order_id_fkey` (`confdeltype` `a`, `confrelid` = `betk.orders`)
- `pg_rules`: `no_delete_mod_log`, `no_update_mod_log`, `no_delete_order_history`, `no_update_order_history`, each `DO INSTEAD NOTHING`
- `list_migrations`: 31 versions, last `20260723140552`

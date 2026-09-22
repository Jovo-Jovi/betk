# BETK v2 schema-delta plan (Stage C)

> **PLAN ONLY.** This file is the Stage C contract for Phase 08. It writes no migration, no `src/`, and no SQL outside the labelled **DRAFT** blocks below.
>
> **UNSIGNED.** Stage C is not approved. The block at the end is empty on purpose.
>
> **Authority.** `BETK_ERD.md` §1–§13 (51 tables, OD-20), ADR-020..025, `BETK_UI_SPEC.md` §4–§5 data lines, `BETK_PHASES.md` Phase 08 and §8. Live facts are from MCP `execute_sql` (`SELECT` only), `list_migrations`, and `get_advisors` on namespace `project-0-BETK-supabase-betk`. `BETK_DATABASE_SCHEMA.sql` is not a source.
>
> **Measured.** Postgres **17.6**. Clock `SELECT clock_timestamp() AT TIME ZONE 'UTC'` → `2026-09-22 21:56:32.121485`. Branch `v2-stage-c-schema-delta` cut from `origin/main` (`c88465a`, B7 merged).
>
> **Register re-read before any mint.** Header REG-01..REG-92, highest row REG-92, no REG-93 row. **None taken.** Next free stays **REG-93**, **OD-22**, **ADR-026**.

N27 is signed: staging migrates. It does not reset. Every `betk.orders` row becomes a seller order under a synthetic master, including the 7 history-bearing orders. This plan maps each one. It does not choose whether to keep it. Deleting any of them is impossible under the live rules and the NO ACTION foreign key, and it is forbidden.

---

## 0. Live baseline (the “before”)

Every Phase 08 migration measures against this section.

### 0.1 Tables

```sql
-- DRAFT is the wrong label here: this query was executed.
SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity,
       (SELECT count(*) FROM information_schema.columns col
        WHERE col.table_schema = n.nspname AND col.table_name = c.relname) AS column_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('betk','betk_analytics') AND c.relkind = 'r'
ORDER BY 1, 2;
```

**43 tables.** `betk` 41, `betk_analytics` 2. RLS enabled on every one. `relforcerowsecurity` is false on every one. Views and materialized views: **0** (`pg_class.relkind IN ('v','m')`).

| schema | table | columns |
|---|---|---|
| betk | addresses | 9 |
| betk | admin_settings | 5 |
| betk | boost_packages | 6 |
| betk | boosts | 13 |
| betk | buyer_profiles | 6 |
| betk | categories | 8 |
| betk | collection_listings | 5 |
| betk | collections | 11 |
| betk | dispute_evidence | 5 |
| betk | dispute_messages | 7 |
| betk | disputes | 13 |
| betk | flagged_content | 12 |
| betk | inquiries | 12 |
| betk | inquiry_messages | 7 |
| betk | listing_images | 5 |
| betk | listing_tags | 3 |
| betk | listings | 23 |
| betk | moderation_logs | 8 |
| betk | notifications | 10 |
| betk | order_items | 7 |
| betk | order_messages | 7 |
| betk | order_status_history | 8 |
| betk | orders | 19 |
| betk | otp_tokens | 7 |
| betk | payments | 12 |
| betk | payouts | 10 |
| betk | rating_aggregates | 9 |
| betk | restock_alerts | 5 |
| betk | review_photos | 5 |
| betk | reviews | 13 |
| betk | seller_documents | 7 |
| betk | seller_profiles | 14 |
| betk | seller_strikes | 7 |
| betk | sessions | 7 |
| betk | shipment_tracking_events | 6 |
| betk | shipments | 9 |
| betk | store_follows | 4 |
| betk | stores | 20 |
| betk | users | 10 |
| betk | whatsapp_templates | 7 |
| betk | wishlists | 5 |
| betk_analytics | platform_snapshots | 11 |
| betk_analytics | seller_snapshots | 8 |

`listings` column names present in `information_schema.column_privileges` for `authenticated` UPDATE do **not** include `weight_g`, `length_mm`, `width_mm`, `height_mm`, `specs`, `prep_days`, or `stock_touched_at`. `inquiries` does **not** include `quoted_price`, `quoted_prep_days`, `quote_expires_at`, or `quoted_at`. `orders` columns, in ordinal order: `id`, `betk_ref varchar(25) NOT NULL`, `buyer_id`, `store_id`, `inquiry_id`, `delivery_address_id`, `delivery_method`, `delivery_fee numeric(10,2) NOT NULL DEFAULT 0`, `subtotal numeric(10,2) NOT NULL`, `total_amount numeric(10,2) NOT NULL`, `status order_status NOT NULL DEFAULT 'pending'`, `cancelled_by`, `cancellation_reason`, `notes`, `created_at`, `confirmed_at`, `delivered_at`, `commission_rate numeric(5,2)`, `commission_amount numeric(10,2)`.

Row counts that the delta depends on (`SELECT count(*)`):

| relation | rows |
|---|---|
| `betk.orders` | 7 |
| `betk.order_status_history` | 7 |
| `betk.order_items` | 0 |
| `betk.payments` | 0 |
| `betk.order_messages` | 0 |
| `betk.shipments` | 0 |
| `betk.disputes` | 0 |
| `betk.reviews` | 0 |
| `betk.inquiries` | 3 |
| `betk.listings` | 3 (all `status = 'active'` and `deleted_at` null) |
| `betk.users` | 5 |
| `betk.stores` | 3 |
| `betk.addresses` | 2 |
| `betk.seller_documents` | 0 |
| `storage.objects` | 5 (`docs` 2, `media` 3) |

### 0.2 Enums

```sql
SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'betk'
GROUP BY t.typname ORDER BY t.typname;
```

34 enums, all in `betk`. Members match ERD §5’s “live” column. `order_status` is `pending, confirmed, preparing, dispatched, delivered, cancelled, returned` — no `ready`. `doc_type` is `national_id_front, national_id_back` only. No `escalation_reason`, `return_status`, or `agreement_document`.

### 0.3 Constraints, indexes, rules

Constraints on `betk` + `betk_analytics`: **148** (`pg_constraint`). Indexes: **102** (`pg_indexes`). Rules (`pg_rules`):

- `no_update_order_history` — `ON UPDATE TO betk.order_status_history DO INSTEAD NOTHING`
- `no_delete_order_history` — `ON DELETE TO betk.order_status_history DO INSTEAD NOTHING`
- `no_update_mod_log` / `no_delete_mod_log` — same shape on `betk.moderation_logs`

Orders-family constraints (`pg_get_constraintdef`):

- `chk_order_total` — `CHECK ((total_amount = (subtotal + delivery_fee)))`
- `chk_commission_rate_range` — `commission_rate` between 0 and 100
- `chk_commission_amount_nonneg` — `commission_amount >= 0`
- `uq_orders_betk_ref` — `UNIQUE (betk_ref)`
- `orders_buyer_id_fkey`, `orders_store_id_fkey`, `orders_inquiry_id_fkey`, `orders_delivery_address_id_fkey` — all `FOREIGN KEY` with **no** `ON DELETE` clause (NO ACTION)
- `order_status_history_order_id_fkey` — `FOREIGN KEY (order_id) REFERENCES betk.orders(id)` with **no** `ON DELETE` clause
- `order_items_order_id_fkey` — `ON DELETE CASCADE`
- `payments_order_id_fkey`, `shipments_order_id_fkey`, `disputes_order_id_fkey`, `reviews_order_id_fkey`, `fk_inquiries_order` — NO ACTION
- `uq_payment_type_per_order`, `uq_shipment_order`, `uq_dispute_per_order`, `uq_review_per_order`
- `payments_amount_check` — `amount > 0`

There is **no** listing CHECK on weight or dimensions. Those columns do not exist.

Indexes whose names contain `order` on the orders family: `idx_orders_buyer`, `idx_orders_store`, `idx_orders_store_date`, `orders_pkey`, `uq_orders_betk_ref`, `idx_osh_order`, `idx_payments_order`, `idx_payments_status`, `uq_payment_type_per_order`, `uq_shipment_order`, `uq_dispute_per_order`, `uq_review_per_order`, plus the child primary keys.

### 0.4 Policies

```sql
SELECT count(*) FROM pg_policies WHERE schemaname IN ('betk','betk_analytics');
```

**66.** Eight tables have RLS and zero policies (also the security advisor, §0.8): `dispute_evidence`, `dispute_messages`, `flagged_content`, `otp_tokens`, `restock_alerts`, `seller_strikes`, `sessions`, `whatsapp_templates`.

`modlog_admin_insert` is live (`INSERT`, `is_admin() AND admin_id = auth.uid()`). Do not add a second insert policy.

Orders and payments policies that Phase 08 rewrites or keeps:

| policy | command | live predicate (abbreviated) |
|---|---|---|
| `orders_access` | SELECT | `buyer_id = auth.uid()` OR store OR `is_admin()` |
| `orders_insert` | INSERT | `buyer_id = auth.uid()` |
| `orders_phone_gate` | INSERT, RESTRICTIVE | caller `phone_number IS NOT NULL` |
| `orders_update` | UPDATE `{authenticated}` | buyer OR store OR `is_admin()`, USING and WITH CHECK |
| `payments_access` | SELECT | buyer **or store** of the parent order, OR `is_admin()` |
| `payments_insert` | INSERT | buyer of parent |
| `payments_update` | UPDATE `{authenticated}` | `is_admin()` OR buyer of parent |
| `shipments_access` | SELECT | buyer **or store** OR admin |
| `shipment_tracking_events_access` | SELECT | buyer **or store** OR admin, via shipment → order |
| `order_messages_access` / `_insert` | SELECT / INSERT | parties include the store |
| `bp_self` | ALL | `id = auth.uid()` OR admin. No public name branch |
| `reviews_public` | SELECT | visible, or author, or admin. No buyer-name column |
| `settings_payment_config_read` | SELECT `{authenticated}` | literal array of **four** keys: `betk_instapay_handle`, `betk_vodafone_cash`, `betk_orange_cash`, `delivery_fee_flat_egp` |

Every live policy that calls `auth.uid()` calls it bare, not `(select auth.uid())`. That is the initplan class (REG-36). Phase 08 does not rewrite policies it is not already replacing.

### 0.5 Triggers and functions

User triggers (`pg_trigger`, `NOT tgisinternal`):

| trigger | table | timing |
|---|---|---|
| `trg_listing_search_vector` | listings | BEFORE INSERT OR UPDATE |
| `trg_dispute_sla` | disputes | BEFORE INSERT |
| `trg_review_edit_deadline` | reviews | BEFORE INSERT |
| `trg_recalculate_rating` | reviews | AFTER INSERT OR UPDATE (no DELETE) |
| `trg_set_order_commission_snapshot` | orders | BEFORE INSERT |
| `trg_enforce_order_transition` | orders | BEFORE UPDATE |
| `trg_decrement_stock_on_confirm` | orders | AFTER UPDATE OF `status` WHEN `OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'confirmed'` |
| `trg_set_inquiry_converted_order` | orders | AFTER INSERT WHEN `inquiry_id IS NOT NULL` |
| `trg_enforce_payment_update` | payments | BEFORE UPDATE |

14 functions in `betk` (`prokind = 'f'`). Security posture from `pg_proc.prosecdef`, `proconfig`, and `has_function_privilege` for `anon` and `authenticated`:

| function | definer | search_path | anon EXECUTE | authenticated EXECUTE |
|---|---|---|---|---|
| `is_admin()` | yes | unset | yes | yes |
| `my_store_id()` | yes | unset | yes | yes |
| `update_listing_search_vector` | no | unset | yes | yes |
| `set_review_edit_deadline` | no | unset | yes | yes |
| `set_dispute_sla` | no | unset | yes | yes |
| `recalculate_rating_aggregate` | no | unset | yes | yes |
| `decrement_stock_on_confirm` | yes | `betk, public` | no | no |
| `enforce_order_transition` | yes | `betk, public` | no | no |
| `enforce_payment_update` | yes | `betk, public` | no | no |
| `set_inquiry_converted_order` | yes | `betk, public` | no | no |
| `set_order_commission_snapshot` | yes | `betk, public` | no | no |
| `create_order_from_inquiry(uuid, uuid, delivery_preference, payment_method)` | no | `betk, public` | no | yes |
| `submit_seller_application(...)` | no | `betk, public` | no | yes |
| `resubmit_seller_application(text, text)` | no | `betk, public` | no | yes |

`pg_get_functiondef` was read for the six order functions. Bodies that matter for the backfill are quoted in §3. Extensions (`pg_extension`): `pg_cron`, `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`, plus `pg_trgm` and `unaccent` in **`public`**. **`btree_gist` is not installed.**

### 0.6 Grants

`information_schema.role_table_grants` for `betk.orders`, grantees `anon` / `authenticated` / `service_role`:

- `anon`: SELECT, INSERT, UPDATE, DELETE (table-level, every column).
- `authenticated`: SELECT, INSERT, DELETE at table level. **No** table-level UPDATE.
- `authenticated` UPDATE columns (`column_privileges`): `cancellation_reason`, `status` only.
- `service_role`: full table privileges including TRIGGER and TRUNCATE.

`betk.payments`, `authenticated` UPDATE columns: `confirmed_at`, `confirmed_by`, `notes`, `proof_path`, `status`, `transfer_reference`. `anon` has table-level UPDATE on every payments column. That is the ADR-019 hazard. Do not add a `TO public` UPDATE policy.

`inquiry_messages`, `authenticated` UPDATE is `is_read` only (REG-42). `anon` still has table-level UPDATE on that table.

ADR-020’s premise holds: `authenticated` and `anon` both have table-level SELECT on `orders`, so a column-level revoke of `delivery_fee` would do nothing until the table SELECT is revoked.

### 0.7 Cron and storage

```sql
SELECT jobid, jobname, schedule, active, command FROM cron.job ORDER BY jobid;
```

Six active jobs. Job ids 2, 3, and 5 are absent.

| jobid | name | schedule | mentions `betk.orders` |
|---|---|---|---|
| 1 | `expire-boosts` | `*/15 * * * *` | no |
| 4 | `dispute-sla-alert` | `0 * * * *` | no (uses `disputes.order_id`, which survives a rename) |
| 6 | `cleanup-otp-tokens` | `30 * * * *` | no |
| 7 | `recalculate-seller-levels` | `0 0 * * *` | no |
| 8 | `daily-platform-snapshot` | `5 22 * * *` | **yes** — `SUM(total_amount)`, `COUNT(*)`, and `delivered_at` all read `betk.orders` |
| 9 | `lift-temp-suspensions` | `0 1 * * *` | no |

Storage buckets: `docs` (`public = false`), `media` (`public = true`). Policies on `storage.objects`:

- `docs_insert_own_prefix` — INSERT, first folder = `auth.uid()`
- `docs_select_own_or_admin` — SELECT, first folder = `auth.uid()` OR `betk.is_admin()`
- `media_insert_own_prefix`, `media_select_own_prefix`, `media_update_own_prefix` — own prefix only

No docs UPDATE or DELETE policy. Of 5 objects, both `docs` objects sit under a prefix equal to one of the five `betk.users` ids. One of three `media` objects does.

### 0.8 Ledger

`list_migrations`: **31** versions. Local `supabase/migrations`: **31** files. Versions match, last `20260723140552` / `order_payment_write_layer_reg49`.

Pre-existing name drift, not a new gap: remote names for versions `20260622082729` through `20260622083209` still carry the historical `0001_`…`0013_` prefix. Local filenames omit that prefix (`20260622082729_extensions_schemas_enums.sql`). Versions are 1:1. Do not re-apply those thirteen to “fix” the name. New Phase 08 files use `{version}_{name}.sql` with the MCP version exactly (REG-24).

### 0.9 Advisors

Security, `get_advisors` `type=security`, `observed_at` **2026-09-22T21:56:46.983Z** on every finding that returned one (the leaked-password lint was in the same payload and did not carry its own `observed_at`):

| lint | level | count |
|---|---|---|
| `rls_enabled_no_policy` | INFO | 8 (the eight tables in §0.4) |
| `function_search_path_mutable` | WARN | 6 (`update_listing_search_vector`, `set_review_edit_deadline`, `set_dispute_sla`, `recalculate_rating_aggregate`, `is_admin`, `my_store_id`) |
| `extension_in_public` | WARN | 2 (`pg_trgm`, `unaccent`) |
| `anon_security_definer_function_executable` | WARN | 2 (`is_admin`, `my_store_id`) |
| `authenticated_security_definer_function_executable` | WARN | 2 (same two) |
| `auth_leaked_password_protection` | WARN | 1 |

The historical fold **8/6/2/4/1** still matches: the two definer lints are 2+2. Not a new defect.

Performance, `type=performance`, `observed_at` **2026-09-22T21:56:46.316Z**:

| lint | level | count |
|---|---|---|
| `unindexed_foreign_keys` | INFO | 37 |
| `auth_rls_initplan` | WARN | 43 |
| `unused_index` | INFO | 30 |
| `multiple_permissive_policies` | WARN | 32 |

---

## 1. Delta inventory

Each item is in the ERD, an ADR, or a REG the ERD already cites. Nothing in this list is a 52nd table. OD-20 stays 51: 43 live, `orders` renamed in place, 0 dropped, 8 new.

### 1.1 Tables

| object | change | cite | phase |
|---|---|---|---|
| `orders` → `seller_orders` | rename in place | ERD §2.1, §4, §6.2; REG-76; N27 | 08 (RLS and the N27 write) |
| `cart_items` | new | ERD §6.1; R-C02 | 08 RLS; first rows Phase 10 |
| `master_orders` | new | ERD §6.1; R-O12, R-O13 | 08 creates the synthetic rows and the RLS |
| `returns` | new | ERD §6.1; R-U01 | 08 RLS; first rows Phase 15 |
| `return_evidence` | new | ERD §6.1; R-U02, N25 | 08 RLS; first rows Phase 15 |
| `agreement_acceptances` | new | ERD §6.1; R-G03 | 08 RLS; first rows Phase 09 |
| `store_categories` | new | ERD §6.1; R-L20 | 08 RLS; first rows Phase 09 |
| `courier_rates` | new | ERD §6.1; R-K02 | 08 RLS; first rows Phase 14 |
| `store_pickup_addresses` | new | ERD §6.1; R-V03; ADR-023 | 08 RLS; first rows Phase 09 |
| every other live table | kept | ERD §2.1 | unchanged shape, except the amendments in §1.2 |

`returns` has **no** UNIQUE on `seller_order_id` (ERD §6.1). Do not invent one.

### 1.2 Columns

**`seller_orders` (after the rename).** Keep `buyer_id`, `delivery_address_id`, `betk_ref` (ERD §4.1, B3-FIX). Relax `betk_ref` to nullable after the copy; existing values stay; new checkouts write NULL. Add, all from ERD §6.2:

| column | null after backfill | notes |
|---|---|---|
| `master_order_id` | NO | nullable only during the backfill |
| `display_ref varchar(64)` | YES | REG-81. Partial unique where not null. No format CHECK. The 7 stay NULL |
| `courier_rate_id` | YES | FK `ON DELETE SET NULL` |
| `prep_deadline` | YES | stamped at release, not during N27 |
| `escalated_at`, `escalation_reason`, `escalation_note`, `escalation_resolved_at` | YES | CHECK `(escalated_at IS NULL) OR (escalation_reason IS NOT NULL)` |
| `balance_confirmed_at` | YES | trigger-stamped |
| `refunded_subtotal numeric(10,2)` | NO, default 0 | CHECK `0 <= refunded_subtotal <= subtotal` |
| `payout_eligible_at` | YES | stamped on `delivered`, not during N27 |

`delivery_method` and `status` are not rewritten (ERD §3.5, §4). The semantic reading of the two `confirmed` rows is an open decision (§8), not a column change.

**Other amendments (ERD §6.3).**

| table | add |
|---|---|
| `listings` | `weight_g`, `length_mm`, `width_mm`, `height_mm` (each CHECK `> 0` when not null), `specs jsonb NOT NULL DEFAULT '{}'`, `prep_days`, `stock_touched_at` |
| `inquiries` | `quoted_price`, `quoted_prep_days`, `quote_expires_at`, `quoted_at` |
| `order_items` | `is_custom boolean NOT NULL DEFAULT false`, `inquiry_id`, `prep_days_snapshot`, plus the custom/inquiry CHECK |
| `payments` | `refunded_amount numeric(10,2) NOT NULL DEFAULT 0` CHECK `0 <= refunded_amount <= amount`; `proof_snapshot_at` |
| `disputes` | `return_id uuid NULL` FK NO ACTION. No `master_order_id` (REG-84) |
| `admin_settings` | no new column. New **rows** (keys) listed in ERD §6.3. Existing keys stay, including the dead fee key |

**Listing weight CHECK — NOT VALID, not a backfill.** All 3 live listings are `active`. The weight columns do not exist, so every active row would fail a validated CHECK. Inventing millimetres is not a measurement. ERD §6.3 allows `NOT VALID` or a backfill. This plan uses `NOT VALID` and does not `VALIDATE` it in Phase 08. Phase 09’s publish gate (AC-CAT-2) is what forces real values. The rest of the publish gate (type, price type, prep cap, approved category) is a trigger plus the app, not a validated CHECK, because a CHECK cannot see `store_categories` or `admin_settings`.

```sql
-- DRAFT. Phase 08. Do not VALIDATE in this phase.
ALTER TABLE betk.listings
  ADD CONSTRAINT chk_active_listing_shipping
  CHECK (
    status <> 'active'::betk.listing_status
    OR (
      weight_g IS NOT NULL AND length_mm IS NOT NULL
      AND width_mm IS NOT NULL AND height_mm IS NOT NULL
    )
  ) NOT VALID;
```

**`courier_rates` overlap.** ERD §6.1 requires an exclusion constraint so two bands for the same origin and destination cannot overlap. That constraint needs `btree_gist`. The extension is not installed. It is not a table (OD-20 stays 51). Install it in schema `extensions`, not `public`, so `extension_in_public` stays at 2.

```sql
-- DRAFT. Mechanism for the ERD exclusion constraint. Not a new table.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
```

The exclusion itself is a constraint on `courier_rates` in the migration that creates that table. `weight_max_g` NULL means an open upper bound. Two open bands for the same pair must still conflict.

### 1.3 Enums

| enum | change | cite | phase |
|---|---|---|---|
| `order_status` | add `ready` only | ERD §5 | 08 |
| `doc_type` | add `food_packaging`, `food_label`, `food_expiry`, `food_social_url` | ERD §5, R-S10 | 08 (the labels); Phase 09 writes the rows |
| `escalation_reason` | new: `out_of_stock`, `damaged`, `cannot_fulfil`, `sla_breach` | ERD §5 | 08 |
| `return_status` | new: `requested`, `accepted`, `rejected`, `refunded` | ERD §5 | 08 |
| `agreement_document` | new: `buyer_terms`, `seller_agreement`, `return_policy`, `privacy` | ERD §5, R-G05 | 08 |
| `delivery_preference`, `cancelled_by_type`, `payment_method`, `payment_status`, `payment_type`, `price_type`, `listing_type`, `inquiry_status`, `user_role` | kept, including dead members | ERD §5, §3.5, AC-COU-6 | no drop |

No master-status enum. No `pending_payment`. No `closed` / `settled` on `order_status` (OD-18). `dispute_status` already has `closed`; that is the dispute lifecycle.

`ALTER TYPE ... ADD VALUE` on Postgres 17 is committed before the new label can be used. The enum migration is its own migration, and the next migration is the first one allowed to write `'ready'`. Adding a label is a point of no return: this plan does not drop enum labels.

### 1.4 Constraints

| constraint | change | cite | phase |
|---|---|---|---|
| history rules and `order_status_history_order_id_fkey` NO ACTION | unchanged | ERD §4 | 08 proves they are unchanged |
| `chk_order_total` | unchanged | measured; ADR-020 | 08 |
| `uq_orders_betk_ref` | stays; multiple NULLs allowed once the column is nullable | ERD §6.2 | 08 |
| format CHECK on `master_orders.betk_ref` | **not added** | R-O02 pins `BETK-YYYYMMDD-XXXX` for new checkouts. Four live refs are `P7T02B-…`. A CHECK would reject the copy ERD §4 requires. `checkout_from_cart` writes the pinned format. UNIQUE stays | 08 |
| `master_order_id` FK NO ACTION, then NOT NULL | new | ERD §4 | 08 |
| `master_orders.betk_ref` UNIQUE, `combined_delivery_total >= 0` | new | ERD §6.1 | 08 |
| cart partial uniques and the custom/inquiry CHECKs | new | ERD §6.1 | 08 |
| `chk_active_listing_shipping` | NOT VALID | ERD §6.3 | 08 adds; a later phase validates |
| courier band exclusion | new | ERD §6.1 | 08 |
| “exactly two payment rows” as a CHECK | **not added** | R-O17 is the checkout shape, not a retroactive CHECK. The 7 rows have zero payments. A validated count CHECK would fail them | — |

Postgres 17 `SET NOT NULL` validates immediately. Do not write `NOT NULL NOT VALID` for `master_order_id`. Backfill first, then `SET NOT NULL`.

### 1.5 Policies

New and replaced policies use `(select auth.uid())` so they add no `auth_rls_initplan` lint. Policies this plan does not replace stay bare and keep their lints (REG-36 is not a Phase 08 sweep).

| policy work | cite | phase |
|---|---|---|
| RLS + policies for the 8 new tables, matching ERD §8. `master_orders` SELECT is buyer or admin. **Seller none** (N28). `store_pickup_addresses` SELECT is own seller or admin. **Buyer none.** `cart_items` has no phone gate (REG-79) | ERD §8 | 08 |
| Phone-gate RESTRICTIVE INSERT on `master_orders` and on `seller_orders` (the existing `orders_phone_gate` follows the rename). Also already live on `seller_profiles` and `payouts` | ERD §8, R-A07 | 08 for the master |
| Rewrite `payments_access`: drop `(o.store_id = my_store_id())`. Buyer via `seller_orders.buyer_id`, or admin. **Seller none** | ERD §8; N28; ADR-021 | 08 |
| Rewrite `shipments_access` and `shipment_tracking_events_access`: drop the store leg. Seller none | ERD §8, R-V02 | 08 |
| `order_messages_*` **keeps** the store leg | ERD §8 | 08 confirms, does not strip |
| `orders_access` / `orders_update` stay buyer OR store OR admin at the **row**. Column hiding is the grant (ADR-020), not a second policy. When these policies are recreated they use `(select auth.uid())` | ERD §8; ADR-019 | 08 |
| `bp_self` and `reviews_public` stay self/admin and visible/author/admin. Do not restore a public name or governorate branch | REG-44 WON'T-FIX; ERD §9; UI spec P04/P19 | 08 does not add one |
| Policies for `dispute_evidence`, `dispute_messages`, `flagged_content`, `restock_alerts`, `seller_strikes`, `whatsapp_templates` | ERD §8; the #14 class | 08 |
| `sessions` and `otp_tokens` stay **zero policies** | ERD §8; `BETK_PHASES.md` Phase 08 exit 3 | 08 confirms |
| `modlog_admin_insert` | already live | 08 re-reads; does not add another |
| `settings_payment_config_read` array becomes exactly `ARRAY['betk_instapay_handle']` | ERD §6.3, REG-69 | 08 |
| No courier policy, no courier role, no definer label function | ADR-024, REG-78 | 08 |

`is_admin()` stays in the row policies. It is not a bypass inside `enforce_order_transition` (ADR-019, ERD §7.1).

### 1.6 Grants

| grant | cite | phase |
|---|---|---|
| On `seller_orders`: `REVOKE SELECT ON seller_orders FROM authenticated, anon`. Then `GRANT SELECT` of every other column present in that migration `TO authenticated`. Do not grant `delivery_fee` or `total_amount`. Do not grant column SELECT to `anon` | ADR-020, REG-90, REG-92 | 08 |
| `authenticated` UPDATE on `seller_orders` stays column-narrow. Keep `status`, `cancellation_reason`. Add `escalated_at`, `escalation_reason`, `escalation_note` because ERD §8 and UI spec P39 say the seller sets those. Do **not** grant `balance_confirmed_at`, `refunded_subtotal`, `payout_eligible_at`, `confirmed_at`, `cancelled_by`, `prep_deadline`, `delivery_fee`, `total_amount` | ERD §6.2, §8; UI spec seller order detail | 08 |
| `anon` table-level UPDATE on `seller_orders` and `payments` stays. Do not add a `TO public` UPDATE policy | ADR-019, ADR-021 | 08 |
| `payments` `authenticated` UPDATE drops `proof_path` and `transfer_reference`. Keeps `status`, `confirmed_at`, `confirmed_by`, `notes`. Adds `refunded_amount` so an admin refund is an `authenticated` UPDATE the trigger can see. `proof_snapshot_at` stays ungranted (trigger-stamped) | ADR-021; ERD §6.3 | 08 |
| `master_orders`: `GRANT SELECT` of every column `TO authenticated` (buyer and admin are that role; the seller is denied by **no policy**, not by a column revoke). `GRANT INSERT` of the checkout columns to `authenticated`. `GRANT UPDATE (proof_path, transfer_reference)` only. `anon` gets no SELECT and no UPDATE | ERD §8; ADR-021 | 08 |
| New tables: enable RLS in the same migration as the `GRANT`s. `anon` gets no write. `courier_rates` SELECT is `authenticated` (ERD §8: any authenticated). Service role is unchanged | ERD §8 | 08 |

The SELECT list for `seller_orders` is whatever columns exist at the end of the grant migration, minus the two hidden ones. A later `ADD COLUMN` grants the new column in that same migration, except the two hidden ones (REG-92).

### 1.7 Triggers and functions

ADR-025 rework list, all Phase 08:

| object | action |
|---|---|
| `decrement_stock_on_confirm` / `trg_decrement_stock_on_confirm` | Detach the trigger **before** any backfill that could set `confirmed`. The function is then only called from `checkout_from_cart`. It skips `stock_qty IS NULL`, sets `sold_out` at 0, sets `stock_touched_at`. It does not run on admin release |
| `create_order_from_inquiry` | Drop in the same migration that creates `checkout_from_cart`. N27 does not call it |
| `checkout_from_cart` | New INVOKER. `search_path` pinned. EXECUTE revoked from PUBLIC, granted to `authenticated`. Writes master, N seller orders, items, 2N payments, N shipments, decrements stock, consumes the cart. Inserts `delivery_fee` and `total_amount` from locals. Does not SELECT or RETURN them (CF-2). Child `betk_ref` is NULL. ADR-022 allocation lives inside this function. Does not write `converted_to_order_id` |
| `enforce_order_transition` | Rework in place to ERD §7.1. Does not drop `buyer_id` first. `pending → confirmed` is admin release only. Buyer cancel only while master `proof_path` is null. Seller never stamped as `cancelled_by` |
| `enforce_payment_update` | Rework. Buyer does not write child `proof_path`. On admin verification, copy master proof onto each deposit row and set `proof_snapshot_at` (ADR-021). On balance confirm, stamp `balance_confirmed_at` only. On refund, write the **goods portion** to `refunded_subtotal` and do not copy `SUM(payments.refunded_amount)`. The arithmetic that splits goods from fee is open (§8) |
| `set_inquiry_converted_order` / `trg_set_inquiry_converted_order` | Drop. Column and `fk_inquiries_order` stay. No new writer (CF-4) |
| `set_order_commission_snapshot` | Rework only if the body must name `seller_orders`. It already stamps from `subtotal` only. Keep that |
| `enforce_master_proof_update` | New DEFINER BEFORE UPDATE on `master_orders`. Buyer sets the two proof columns once, before `payment_deadline`, while children are `pending` and proof is null. Stamps `proof_uploaded_at` |
| `release_seller_orders` | New DEFINER. The one admin deposit confirm: copy proof, set each child `confirmed`, stamp `confirmed_at` and `prep_deadline` |
| `restore_stock_on_cancel` | New DEFINER AFTER UPDATE into `cancelled` from a pre-delivery state. Not on `returned`. NULL stock skipped. Also the REG-82 cart restore. The **cron schedule** that calls the expiry path is Phase 11, not this trigger’s existence |
| `touch_stock` | New INVOKER BEFORE UPDATE OF `stock_qty` |
| `enforce_store_category_cap` | New DEFINER BEFORE INSERT on `store_categories`. Reads `seller_category_limit` |
| Payout INSERT cap | New BEFORE INSERT on `payouts`. DEFINER, `search_path` pinned, EXECUTE revoked, filters to `NEW.store_id`. Cap is ERD §6.4. A page check is not the boundary |
| ADR-023 equality | Trigger on `store_pickup_addresses` INSERT and UPDATE, **and** on `stores` UPDATE OF `governorate`. Both directions (CF-3). Not a new column |
| `submit_seller_application` / `resubmit_seller_application` | Stay INVOKER. Body stops treating `delivery_options` and the two category varchars as authority and writes `store_categories` and `store_pickup_addresses`. Signature: see §8. The live caller on `main` is `src/features/seller-onboarding/actions/submitSellerApplication.ts` |

`payout_eligible_at` is stamped inside the reworked order transition when status becomes `delivered`: `delivered_at + return_hold_hours` from `admin_settings`. The key stays off the REG-69 array (REG-86). The seller reads the timestamp, not the key.

Every new DEFINER function: `SET search_path = betk, public` and `REVOKE EXECUTE FROM PUBLIC, anon, authenticated`. Triggers are not RPCs (ADR-012). Missing that revoke would raise the 0028/0029 counts.

### 1.8 Storage

N28 on `storage.objects` for the `docs` bucket (ERD §13, UI spec P16): a seller does not gain a policy that reads another user’s prefix. Admin read of a proof or a seller document stays `is_admin()` on `docs_select_own_or_admin`, which is the admin’s own RLS read (ADR-024 branch 1). Signed URLs are minted by that admin session.

The live policy already denies a seller whose uid is not the first folder. Both current `docs` objects are under a user prefix. Phase 08 does not add a store-wide docs SELECT. It also does not delete `docs_select_own_or_admin`, because ERD §8 still lets a seller read **their own** `seller_documents` row, and the upload path is that seller’s uid. A blanket “seller cannot SELECT any docs object” would contradict that row. The N28 fail is a seller reading a **buyer** proof. Own-prefix plus admin is that rule. Proof uploads stay on the buyer’s prefix (UI spec P16).

### 1.9 Cron ownership

| job | phase |
|---|---|
| Retarget `daily-platform-snapshot` from `betk.orders` to `betk.seller_orders` in the rename migration. The aggregate stays `SUM(total_amount)` because the job runs as the table owner, not as `authenticated` (ERD §6.4). Do not change the metric | 08, only because the rename would otherwise break a live command |
| `expire-boosts`, `cleanup-otp-tokens`, `recalculate-seller-levels`, `lift-temp-suspensions` | unchanged. Not Phase 08 features |
| `dispute-sla-alert` | unchanged text. Phase 16 consumes it. SMS delivery is Phase 17 (`BETK_PHASES.md` §8) |
| Payment-window sweeper, every minute | **Phase 11.** Not created in Phase 08 |
| Prep-SLA ladder, every 15 minutes | **Phase 13.** Not created in Phase 08 |

---

## 2. Rename hazard (`orders` → `seller_orders`)

`ALTER TABLE betk.orders RENAME TO seller_orders` keeps the relation OID. Policies, foreign keys, indexes, triggers, constraints, and rules that are bound to that OID keep working. Their **names** do not change. PostgreSQL does not rename indexes or constraints when the table is renamed.

**Decision: do not rename constraints, indexes, triggers, or policies merely because the name contains `orders`.** The ERD does not ask for a cosmetic rename. Generated types put the table name in `Tables` and `referencedRelation`. They also copy `foreignKeyName` (`orders_buyer_id_fkey` and the rest). Leaving those names means the CI typegen diff is the table rename, not a second rename of every relationship key. Renaming them would be a types-drift with no behaviour change. Stale names stay, and this plan is the record of them.

Text-bound objects do **not** follow the OID.

### 2.1 Function bodies

```sql
SELECT n.nspname, p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
  AND p.prokind = 'f'
  AND pg_get_functiondef(p.oid) ~ '\morders\M';
```

Result: `betk.create_order_from_inquiry`, `betk.enforce_payment_update`. No other function body contains the word `orders`.

| function | rework |
|---|---|
| `create_order_from_inquiry` | **Dropped in the rename transaction**, which is also the transaction that creates `checkout_from_cart` (ADR-025: one migration, so two checkout paths never both exist after a commit). N27 does not call it. A commit that has renamed the table and left this body saying `INSERT INTO betk.orders` is a broken function, and a commit that rewrites the body onto `seller_orders` without dropping it is a second checkout. Neither is allowed. `main` does not call the RPC from `src/` (the name is in `types.ts` only) |
| `enforce_payment_update` | The proof check is `EXISTS (SELECT 1 FROM betk.orders o ...)`. Same transaction as the rename: replace `betk.orders` with `betk.seller_orders`. The full rework (proof copy, `refunded_subtotal`, `balance_confirmed_at`) is M8, still before any payment UPDATE. M6’s rewrite is the table name only, so the commit does not contain `betk.orders` |

`enforce_order_transition` reads `OLD.buyer_id` and does not name the table. It survives the rename. `decrement_stock_on_confirm` updates `listings` and `order_items`. It survives, and it is detached before the backfill anyway. `set_inquiry_converted_order` updates `inquiries`. It survives until it is dropped.

### 2.2 Cron

Only `daily-platform-snapshot` (jobid 8) names `betk.orders`. Reschedule that command in the rename transaction. `cron.schedule` with the same job name replaces the command. No new job.

### 2.3 `src/` and `tests/`

Executable `.from("orders")` on this branch (rg, read-only). There is **no** `.from("orders")` under `src/`. The RPC name `create_order_from_inquiry` appears in `src/lib/supabase/types.ts` only. The onboarding actions call `submit_seller_application`, not the order RPC.

| path | what must change with the rename |
|---|---|
| `tests/integration/order.rls.test.ts` | `.from("orders")` → `.from("seller_orders")`. Selects are already column lists (`id`), which survives ADR-020 |
| `tests/integration/orders.stockDecrement.test.ts` | same, plus it must stop updating `status` to `confirmed` as the stock path. Stock is checkout. The confirm trigger is gone |
| `tests/integration/rls.smoke.test.ts` | `.from("orders")` → `.from("seller_orders")`. Phone-gate cases target `seller_orders` and `master_orders` |
| `tests/integration/discovery.listing.test.ts` | teardown `.from("orders")` |
| `tests/integration/discovery.queries.test.ts` | teardown `.from("orders")` |
| `src/lib/supabase/types.ts` | CI regenerates. Do not hand-edit (REG-32) |

Comment-only mentions of the table `betk.orders` (feature barrels, `requireVerifiedPhone.ts`, `createInquiry.ts`) are updated in the same Phase 08 PR so the comments match the relation. They do not execute.

These are **not** the table, and this plan does not rename them: `routes.ts` `/orders` and `/seller/orders` and `/admin/orders`, `middleware.ts` path `/orders`, the Sentry tag `"orders"`. Pages stay on their phases (`BETK_PHASES.md` §4.b). Phase 08 owns no page.

---

## 3. Trigger and rule hazards during backfill

The migration role is the owner. BEFORE UPDATE triggers still fire. RLS does not stop them.

`enforce_order_transition` (live body) raises only when `cancelled_by` or `cancellation_reason` changes outside `pending → cancelled`, or when `status` changes to something other than the three v1 transitions. An UPDATE that changes **only** `master_order_id` (and no status, no cancel metadata) returns NEW. It passes.

`trg_decrement_stock_on_confirm` fires only when `status` changes **to** `confirmed`. The N27 backfill does not change `status`. The trigger is still dropped first (ADR-025, Phase 08 exit 7), so a mistaken status write cannot decrement stock.

`trg_set_order_commission_snapshot` is BEFORE INSERT. The backfill does not insert into `orders`.

`trg_set_inquiry_converted_order` is AFTER INSERT. The backfill does not insert into `orders`. Do not “repair” the three NULL `converted_to_order_id` values. That would be a new writer (CF-4 forbids one).

`trg_enforce_payment_update` fires on every payments UPDATE. The proof branch requires `auth.uid()` to equal the order’s buyer. A migration has `auth.uid()` NULL, so an UPDATE that changes `proof_path` or `transfer_reference` raises `BETK_PAYMENT_PROOF_FORBIDDEN`. **Live `payments` count is 0**, so the backfill updates zero payment rows and the trigger does not fire. The migration aborts if the count is not 0 at apply time, and it does not disable the trigger to push a proof through the old function. If a future measurement finds rows, the proof copy waits until the reworked DEFINER function owns it (that function does not consult `auth.uid()` for the admin copy).

`order_status_history` rules are `DO INSTEAD NOTHING`. An UPDATE or DELETE there **succeeds and changes nothing**. The plan never updates history and never uses “0 rows updated” as proof. Proof is the row image.

```sql
-- DRAFT verification. Run before the first N27 write and after the last one.
-- The md5 expression is part of the contract. History notes are included.
SELECT id, order_id, from_status::text, to_status::text, changed_by,
       changed_by_type::text, notes, created_at,
       md5(id::text || '|' || COALESCE(from_status::text,'') || '|' || to_status::text
           || '|' || COALESCE(changed_by::text,'') || '|' || COALESCE(changed_by_type::text,'')
           || '|' || COALESCE(notes,'') || '|' || created_at::text) AS row_md5
FROM betk.order_status_history
ORDER BY created_at, id;
```

Before-image captured 2026-09-22 (7 rows). Phase 08 fails the migration if any `row_md5` differs.

| history id | order id | from → to | md5 |
|---|---|---|---|
| `10998dd4-4fdf-419e-bf0d-07cfef268042` | `81147596-…` | NULL → pending | `357e3f6d12058113ae3d21b5b81929fa` |
| `062290d1-a3fa-49a9-88ef-aa79015f6720` | `b327bfb8-…` | NULL → pending | `7b4f9101c18e69a4be6bef0dfbcb4319` |
| `4dbddb13-18fa-4327-ac5a-16a7d6e8d9d9` | `e5d776fc-…` | pending → cancelled | `5b4eabf2b9789ca19fce5fcde28aabed` |
| `32805669-ec09-47d5-8fdd-185e14d9bda5` | `02482319-…` | pending → confirmed | `ca59784dbd81490475bd2b5754c3985a` |
| `c9cf09ef-462e-482b-892a-327277a0967d` | `41c5b2c2-…` | NULL → pending | `37790ab559cdf19c28d27b294773f8a4` |
| `5c7cd87d-9a09-4819-8217-055e06df0302` | `da73deed-…` | pending → cancelled | `ceaf82c5ea6811d9b54dad054ce24d2f` |
| `08b94ebe-06b2-4041-b0e0-2ee6239298e2` | `c7ba4f04-…` | pending → confirmed | `ac58be52f37544d8460a4661ad996829` |

No `ALTER TABLE ... DISABLE TRIGGER` is required for the writes this plan actually does. Disable would be a broader foot-gun (it would also silence a bad status write). The detach of `trg_decrement_stock_on_confirm` is a drop, not a session disable, and ADR-025 already requires it.

---

## 4. N27 steps

Order is additive, then the stock-trigger detach, then the copy, then the rename, then tighten, then grants, then function replacement, then drops. Drops are only the functions and the one trigger ADR-025 names. No table is dropped. History rules and the history foreign key are not altered.

### 4.1 Additive

New enums (own migration). New tables, empty, RLS on, policies present. New columns nullable, or NOT NULL only where a default makes existing rows valid without a rewrite (`refunded_subtotal` default 0, `order_items.is_custom` default false, `listings.specs` default `'{}'`, `payments.refunded_amount` default 0). `master_order_id` stays nullable. Listing CHECK is NOT VALID.

Invariant: `orders` still 7, history md5 unchanged, `listings.stock_qty` unchanged.

### 4.2 Detach stock-on-confirm

`DROP TRIGGER trg_decrement_stock_on_confirm ON betk.orders` before any later statement that could set `status = 'confirmed'`. This backfill does not set status. The drop is still first.

### 4.3 Synthetic masters

One `master_orders` row per existing order. v1 orders are single-seller, so the link is 1:1.

| master column | source |
|---|---|
| `buyer_id` | `orders.buyer_id` |
| `delivery_address_id` | `orders.delivery_address_id` (NULL on the four `P7T02B-*` rows) |
| `betk_ref` | `orders.betk_ref` (unique today, all length ≤ 25) |
| `combined_delivery_total` | that order’s `delivery_fee` (the only child). All seven are `0.00` |
| `created_at` | `orders.created_at` |
| `recipient_name`, `recipient_phone` | NULL. `addresses` has no name or phone column |
| `snapshot_governorate`, `snapshot_city`, `snapshot_street_address`, `snapshot_building_notes` | copied from `addresses` when `delivery_address_id` is not null. Measured for both addresses: governorate `Cairo`, city `Nasr City`, street present (length 11). The migration copies the street from the row. This plan does not reprint it |
| `proof_path`, `transfer_reference`, `proof_uploaded_at` | NULL. Payments count is 0. Do not invent a proof |
| `payment_deadline` | NULL. These rows are not inside a payment window |

```sql
-- DRAFT. Abort if the empty-payments premise is no longer true.
DO $n27$
BEGIN
  IF (SELECT count(*) FROM betk.payments) <> 0 THEN
    RAISE EXCEPTION 'BETK_N27_PAYMENTS_NONEMPTY';
  END IF;
  IF (SELECT count(*) FROM betk.orders) <> 7 THEN
    RAISE EXCEPTION 'BETK_N27_ORDER_COUNT';
  END IF;
END
$n27$;
```

Then insert one master per order and set `orders.master_order_id`. That UPDATE is the write §3 already passed through `enforce_order_transition`.

### 4.4 Link and legacy payments

`master_order_id` points at that master. Child `buyer_id`, `delivery_address_id`, and `betk_ref` are **not** cleared.

Legacy payments: zero rows. There is no deposit to map and no proof to copy. The procedure for a non-zero table, if the abort ever fires, is: stop, re-measure, and copy `proof_path` / `transfer_reference` with the **reworked** verification function onto the deposit row only, stamping `proof_snapshot_at`. Do not do that against the live `enforce_payment_update`. Do not insert the missing deposit and balance rows. A fabricated 50/50 split would invent money the table does not contain. R-O17’s two rows are what `checkout_from_cart` writes for new orders.

### 4.5 Rename

`ALTER TABLE betk.orders RENAME TO seller_orders` in the same transaction as the `enforce_payment_update` table-name rewrite, the `daily-platform-snapshot` command rewrite, the drop of `create_order_from_inquiry`, and the create of `checkout_from_cart`. Constraint and index names stay (§2).

### 4.6 Tighten

After every order has a master: `SET NOT NULL` on `master_order_id`. Then `ALTER COLUMN betk_ref DROP NOT NULL`. Do not drop the unique index.

`NOT VALID` stays on `chk_active_listing_shipping`. No `VALIDATE CONSTRAINT` in Phase 08.

### 4.7 Grants, policies, functions, drops

Grants and the policy rewrites in §1.5–§1.6. Then the remaining function and trigger replacements in §1.7. `create_order_from_inquiry` is already dropped in the rename transaction (M6), in the same migration that creates `checkout_from_cart`. Last statements of the function migration: `DROP TRIGGER trg_set_inquiry_converted_order`, `DROP FUNCTION set_inquiry_converted_order`. `converted_to_order_id` and `fk_inquiries_order` remain.

### 4.8 Verification queries

Run after the tighten step, and again after the function migration. Expected results are in the comments.

```sql
-- DRAFT. Row counts unchanged except the new parent.
SELECT
  (SELECT count(*) FROM betk.seller_orders) AS children,          -- 7
  (SELECT count(*) FROM betk.master_orders) AS masters,           -- 7
  (SELECT count(*) FROM betk.order_status_history) AS history,    -- 7
  (SELECT count(*) FROM betk.payments) AS payments,               -- 0
  (SELECT count(*) FROM betk.order_items) AS items;               -- 0

-- DRAFT. Exactly one master each, and no master without a child.
SELECT count(*) FROM betk.seller_orders WHERE master_order_id IS NULL;          -- 0
SELECT master_order_id FROM betk.seller_orders
GROUP BY master_order_id HAVING count(*) <> 1;                                  -- 0 rows
SELECT count(*) FROM betk.master_orders m
WHERE NOT EXISTS (SELECT 1 FROM betk.seller_orders s WHERE s.master_order_id = m.id); -- 0

-- DRAFT. Money on the children is unchanged. Sums are the live totals.
SELECT sum(subtotal), sum(delivery_fee), sum(total_amount), sum(commission_amount)
FROM betk.seller_orders;
-- 1000.00, 0.00, 1000.00, 0.00
-- (three orders at 100 and four at 200)

-- DRAFT. Master delivery total equals the only child's fee.
SELECT count(*) FROM betk.master_orders m
JOIN betk.seller_orders s ON s.master_order_id = m.id
WHERE m.combined_delivery_total IS DISTINCT FROM s.delivery_fee;   -- 0

-- DRAFT. Copied identity columns still match.
SELECT count(*) FROM betk.master_orders m
JOIN betk.seller_orders s ON s.master_order_id = m.id
WHERE m.buyer_id IS DISTINCT FROM s.buyer_id
   OR m.delivery_address_id IS DISTINCT FROM s.delivery_address_id
   OR m.betk_ref IS DISTINCT FROM s.betk_ref;                      -- 0

-- DRAFT. Status was not rewritten.
SELECT status, count(*) FROM betk.seller_orders GROUP BY status;
-- pending 3, cancelled 2, confirmed 2

-- DRAFT. No stock movement. Capture stock_qty before M04 and compare after.
SELECT id, stock_qty FROM betk.listings ORDER BY id;
-- 151532d9-… = 50 (not in the order cluster)
-- 30e7879e-… = NULL
-- 8edcd182-… = NULL
```

History uses the §3 md5 query, not a row count alone. The seven order ids in §5 still exist.

---

## 5. The 7 zombies, one by one

Cluster query (executed): `orders` joined to nothing that returned rows for items, payments, messages, shipments, disputes, or reviews; `inquiries` for the three `inquiry_id`s; `stores` and `listings`; `addresses`; `seller_profiles`; `users` left-joined to `auth.users` for role and email domain only.

**Why each is undeletable.** `no_delete_order_history` is `DO INSTEAD NOTHING`, so deleting the history row does not remove it. `order_status_history_order_id_fkey` is NO ACTION, so deleting the order while that history row exists raises `23503`. `no_update_order_history` means the foreign key cannot be nulled by an UPDATE either. That is true of all seven. Payments and items have no such rule; they are already gone. The orders cannot follow them.

**Origin, from the rows plus REG-71’s recorded prefixes (not from a fresh guess).** Two bursts on 2026-07-23, about a minute apart. Users were created 15–20 seconds before the orders. `betk_ref` values are exactly the residue prefixes REG-71 names: `P7T02B-8cf7a1cb-*`, `P7T02B-a97d046c-*`, and `BETK-20260723-A04E` / `E239` / `E926`. History notes are `order created`, `order cancelled by buyer`, and `order accepted by seller`. The `BETK-YYYYMMDD-XXXX` shape is what `create_order_from_inquiry` writes. The `P7T02B-…-L` / `-M` shape is the T02b write-layer pair (cancel / accept) from that same purge record. Phone users in the cluster have a null email. The only `gmail.com` user (`8c614e74-…`, seller, created 2026-07-20) owns store `b741aa58-…` and listing `151532d9-…` (`stock_qty` 50). **No order, inquiry, or address references that store.** The migration does not touch it.

**Stock.** Both listings the inquiries point at have `stock_qty` NULL, so the live decrement function’s `stock_qty IS NOT NULL` filter matches nothing. `order_items` is 0, so there is no line whose quantity could have been subtracted and still be visible. The migration’s own proof is: do not change `status`, and compare `stock_qty` before and after. It is not a claim that a past UPDATE was replayed.

**Payments.** Zero rows on every order. `confirmed_at` on the two confirmed orders was stamped (the live trigger stamps it on `pending → confirmed`) and no deposit row survives. This plan does not insert payments to make the story tidy.

**`converted_to_order_id`.** All three inquiries are `status = confirmed`, `converted_to_order_id` NULL, while the child `inquiry_id` points at them. Leave the NULL. ADR-025: no new writer.

**v2 constraints these rows do not violate, if the plan refuses the checks that would invent a violation.** Money CHECKs already hold (`total = subtotal + fee`). `refunded_subtotal` default 0 is within `subtotal`. `display_ref` NULL is what REG-81 requires for the migration. `combined_delivery_total` 0 passes `>= 0`. `master_orders.betk_ref` is `varchar(25)` NOT NULL and UNIQUE. All seven refs fit. Four of them are `P7T02B-…`, which is not the new-checkout format `BETK-YYYYMMDD-XXXX`. Copying them is what ERD §4 requires. A format CHECK is not in the ERD as a constraint and would reject those four; this plan does not add one. A CHECK that every seller order has two payments would fail all seven; it is not in the ERD as a table constraint and this plan does not add it.

**Status label.** ERD §4 says leave `pending` / `confirmed` / `cancelled` stored and do not rewrite them through `enforce_order_transition`. The two `confirmed` rows are the unresolved decision in §8. The mechanical copy below does not change `status`.

Shared master defaults for every row: `combined_delivery_total = 0.00`, proof columns NULL, `payment_deadline` NULL, `recipient_name` NULL, `recipient_phone` NULL. Child `delivery_method` stays `delivery`. Child `commission_rate` and `commission_amount` stay `0.00`. `display_ref` stays NULL. `refunded_subtotal` becomes 0. `balance_confirmed_at` and `payout_eligible_at` stay NULL.

### 5.1 `81147596-94ee-4a25-b634-34c043409242`

| | |
|---|---|
| status | `pending`. `confirmed_at` NULL. `cancelled_by` NULL |
| created | 2026-07-23 20:22:15 UTC |
| ref | `BETK-20260723-A04E` |
| buyer | `7043e732-a028-425c-b618-5b96ff6ac657` (buyer, phone, active) |
| store | `97000f1d-2b3f-46d9-a5cc-5c5f3540d0a6` (seller `c30e414a-…`, seller_profile active, governorate Cairo) |
| inquiry | `88ddbb88-cb21-4559-a62f-8941b1490f4d` (confirmed, qty 1, listing `30e7879e-…`, `stock_qty` NULL, `converted_to_order_id` NULL) |
| address | `48276b87-7996-4c58-b27b-b12d1bf29872` |
| money | subtotal 100.00, fee 0.00, total 100.00 |
| payments / items / shipment / dispute / review / messages | none |
| history | 1 row, NULL → pending, changed_by the buyer, note `order created` |
| master | copy buyer, address, ref; snapshots from that address; delivery total 0 |

### 5.2 `b327bfb8-f807-418e-9448-1fb645351f3b`

Same buyer, store, address, and money as 5.1. Status `pending`. Ref `BETK-20260723-E239`. Inquiry `3b5a6c3c-963a-46c9-b231-8502980534ab` (same listing, `converted_to_order_id` NULL). History NULL → pending, note `order created`. Created 20:22:16 UTC. Master is a second row, not a shared master: v1 is 1:1.

### 5.3 `e5d776fc-1402-484e-84c4-d2b441f5868f`

| | |
|---|---|
| status | `cancelled`. `cancelled_by = buyer`. `cancellation_reason` NULL |
| ref | `P7T02B-8cf7a1cb-L` |
| buyer / store | same as 5.1 |
| inquiry / address | both NULL |
| money | 200.00 + 0.00 = 200.00 |
| history | pending → cancelled, changed_by the buyer, note `order cancelled by buyer` |
| master | buyer copied; `delivery_address_id` NULL; snapshots NULL; ref copied; delivery total 0 |

### 5.4 `02482319-a2a7-4b54-aaf1-8c24b5a95150` — confirmed, unresolved semantic

| | |
|---|---|
| status stored | `confirmed`. `confirmed_at` 2026-07-23 20:22:18.518 UTC |
| ref | `P7T02B-8cf7a1cb-M` |
| buyer / store | same as 5.1. Inquiry and address NULL |
| money | 200.00 + 0.00 = 200.00 |
| payments | **none.** No proof |
| history | pending → confirmed, `changed_by` `c30e414a-…`, `changed_by_type = seller`, note `order accepted by seller` |
| what v1 `confirmed` was | seller acceptance. The note and `changed_by_type` say that. The live function also required a confirmed deposit at the time of the UPDATE. No deposit row exists now |
| what v2 `confirmed` means | admin release (ERD §6.2, ADR-025). `confirmed_at` is the deposit-confirmed fact the seller reads |
| master | same shape as 5.3 (no address, no proof, delivery total 0). Status column is not on the master |

The label mapping is not derivable as a single instruction. ERD §4 says leave the stored status. ERD §6.2 says this status means admin release. Both cannot describe this row without a human choice. §8 lists it. The copy in §4 does not change the label and does not null `confirmed_at`.

### 5.5 `41c5b2c2-e5e0-4a60-9d28-3dc467a23a2a`

Second burst, 20:23:40 UTC. Status `pending`. Ref `BETK-20260723-E926`. Buyer `98404561-9335-4036-a640-43ce3ea8e351`. Store `7d3ba387-9014-4f13-b8ff-5e32deadd777` (seller `c263af6c-…`). Inquiry `95f2b10e-4cc9-4f9b-b5a0-1d7cea692447`, listing `8edcd182-…` (`stock_qty` NULL), `converted_to_order_id` NULL. Address `ce829d0f-cd68-49eb-a381-afe369f5c27c` (Cairo / Nasr City). Money 100.00. History NULL → pending, note `order created`. Master copies buyer, address, ref; delivery total 0.

### 5.6 `da73deed-0670-4cc7-bccd-064b8d301b6f`

Status `cancelled`, `cancelled_by = buyer`. Ref `P7T02B-a97d046c-L`. Same buyer and store as 5.5. Inquiry and address NULL. Money 200.00. History pending → cancelled, note `order cancelled by buyer`. Master like 5.3.

### 5.7 `c7ba4f04-eefd-489a-b8de-5daa917e998b` — confirmed, same unresolved semantic

Status `confirmed`. `confirmed_at` 2026-07-23 20:23:44.162 UTC. Ref `P7T02B-a97d046c-M`. Same buyer and store as 5.5. Inquiry and address NULL. Money 200.00. No payments. History pending → confirmed, `changed_by` `c263af6c-…`, `changed_by_type = seller`, note `order accepted by seller`. Same open decision as 5.4. The copy does not change the label.

---

## 6. Migration list

Phase 08 applies these in order. Later-phase jobs are listed so they are not slipped into this list. Each migration: MCP `apply_migration` → rename the local file to the returned version → ledger 1:1 → backfill `BETK_DATABASE_SCHEMA.sql` → advisors before/after against §0.9. Typegen is the CI job (REG-32), not a hand edit.

Expected security delta after the whole set, if the rules in §1 are kept: `rls_enabled_no_policy` 8 → **2** (`sessions`, `otp_tokens` only). New tables must not appear on that list. `function_search_path_mutable` stays 6 (no sweep of `is_admin` / `my_store_id`). `extension_in_public` stays 2 (`btree_gist` goes in `extensions`). Definer-exec stays 2+2 because new definers revoke EXECUTE. Leaked-password stays 1.

Expected performance delta: `auth_rls_initplan` does not rise. Replaced policies drop their lint; untouched policies stay (REG-36). `unindexed_foreign_keys` rises by each new FK that is not the leading column of an index. That rise is accepted. REG-37 forbids a Phase 08 sweep of the existing 37. `multiple_permissive_policies` should not rise if each command has one permissive policy plus, where required, one restrictive phone gate (the phone gate is restrictive, so it is not a second permissive policy). `unused_index` may rise by the new partial uniques; that is INFO and expected on an empty table.

### Phase 08

**M1 — `v2_08_enum_labels`**
- Objects: `order_status` + `ready`; new enums; four `doc_type` labels.
- Preconditions: §0 enum list.
- Verify: `pg_enum` contains `ready` and does not contain `pending_payment`, `closed`, or `settled` on `order_status`.
- Advisor delta: none.
- Down-step: none that removes a label. Forward-fix only after commit.
- **Point of no return:** enum labels stay.

**M2 — `v2_08_new_tables`**
- Objects: the 8 new tables, their CHECKs, FKs, partial uniques, the courier exclusion, RLS, policies in the `(select auth.uid())` form, grants. `btree_gist` in `extensions`. No rows except what a default needs. No synthetic masters yet (`master_orders` may be created empty here).
- Preconditions: M1 committed (new enums). `btree_gist` absent.
- Verify: `pg_tables` count for `betk` + `betk_analytics` = 51. The 8 new tables have at least one policy each, except none of them is `sessions` or `otp_tokens`.
- Advisor delta: rls-no-policy does not include the new tables. Unindexed-FK INFO rises. Initplan does not rise.
- Down-step: `DROP TABLE` in reverse FK order, before any N27 row exists.
- Point of no return: no, until M5 writes masters.

**M3 — `v2_08_additive_columns`**
- Objects: §1.2 columns, the NOT VALID listing CHECK, `admin_settings` keys. Keys whose ERD §6.3 text states a default meaning are seeded with that meaning (`quote_tolerance_multiplier` 2, `quote_validity_hours` 24, `prep_cap_days` 3, `seller_category_limit` 3). Keys with no stated number (`price_band_*`, `payment_window_minutes`, `return_window_hours`, `food_requirements`, the four agreement version keys) are inserted as empty text. Empty means “not configured”, the REG-62 pattern. The checkout gate set is not hard-coded (REG-88).
- Preconditions: M2. Active listing count re-read; if it is not the §0 count, the NOT VALID choice still holds, a validated CHECK still does not.
- Verify: new columns nullable or defaulted; `chk_active_listing_shipping.convalidated` is false; history md5 unchanged; orders still 7.
- Advisor delta: none expected on security.
- Down-step: drop the new columns and the NOT VALID constraint. Safe while they are unused.
- Point of no return: no.

**M4 — `v2_08_detach_stock_on_confirm`**
- Objects: `DROP TRIGGER trg_decrement_stock_on_confirm`. Function may remain until M8 replaces it.
- Preconditions: trigger exists (§0.5). No backfill has set `confirmed`.
- Verify: `pg_trigger` has no `trg_decrement_stock_on_confirm`. `listings.stock_qty` unchanged.
- Advisor delta: none.
- Down-step: recreate the trigger from the measured definition. Only valid if no row was moved to `confirmed` by a later migration.
- Point of no return: no.

**M5 — `v2_08_n27_masters`**
- Objects: §4.3 insert and link. Abort guards for payments ≠ 0 and orders ≠ 7. Then `SET NOT NULL` on `master_order_id`. Then `betk_ref` DROP NOT NULL.
- Preconditions: M4 applied. History md5 equals §3. Payments count 0. The UPDATE touches only `master_order_id`.
- Verify: §4.8 queries, plus history md5.
- Advisor delta: none expected (no new policy).
- Down-step before `SET NOT NULL`: null `master_order_id`, delete the masters. **After `SET NOT NULL`:** deleting a master fails NO ACTION. That is forward-fix only.
- **Point of no return:** the `SET NOT NULL`.

**M6 — `v2_08_rename_seller_orders`**
- Objects, one transaction: rename; rewrite `enforce_payment_update` so its body says `betk.seller_orders`; reschedule jobid 8 onto `betk.seller_orders`; `DROP FUNCTION betk.create_order_from_inquiry`; `CREATE FUNCTION betk.checkout_from_cart` (INVOKER, pinned `search_path`, EXECUTE granted to `authenticated` only, CF-2, ADR-022 inside it). Does not rename constraints or indexes. Does not leave a commit whose function body or cron command still says `betk.orders`.
- Preconditions: M5. Every child has a master. rg confirms the text-bound list in §2 is the one this migration covers. `checkout_from_cart` inserts into tables that already exist (M2, M3, M5) and does not call `set_inquiry_converted_order`.
- Verify: `to_regclass('betk.orders')` is null; `to_regclass('betk.seller_orders')` is not; `to_regprocedure` of `create_order_from_inquiry` is null; `pg_get_functiondef` of `enforce_payment_update` and of `checkout_from_cart` does not contain `betk.orders`; `checkout_from_cart`’s `RETURNING` list is not `*`; `cron.job` command for `daily-platform-snapshot` does not contain `betk.orders`; history FK still references the same relation (OID), still NO ACTION; rules still `DO INSTEAD NOTHING`.
- Advisor delta: `checkout_from_cart` is INVOKER with `search_path` pinned, so search_path WARN stays 6 and definer-exec stays 2+2.
- Down-step: forward-fix. Restoring `create_order_from_inquiry` would reopen the retired checkout, and renaming the table back after this commit breaks the new function.
- **Point of no return:** the commit, for any session still sending `.from("orders")`, and for the dropped RPC. Main’s RLS smoke will fail against staging until the Phase 08 PR’s test edits are what CI runs. Apply this migration from that PR’s branch, with the test edits already in the branch.

**M7 — `v2_08_grants_and_policies`**
- Objects: ADR-020 revoke and column grant; ADR-021 payments UPDATE list; `master_orders` grants; policy rewrites in §1.5; REG-69 array; policies on the six zero-policy tables; confirm zero policies on `sessions` and `otp_tokens`.
- Preconditions: M6. Column list for the SELECT grant is generated from `information_schema.columns` at apply time, minus `delivery_fee` and `total_amount`, not typed from memory.
- Verify: `column_privileges` for `authenticated` SELECT on `seller_orders` excludes those two and includes `refunded_subtotal`. `anon` has no SELECT on `seller_orders`. `payments` authenticated UPDATE does not include `proof_path` or `transfer_reference`. `pg_policies.qual` for `payments_access` does not contain `my_store_id`. `sessions` and `otp_tokens` still have zero policies. `modlog_admin_insert` still exactly one.
- Advisor delta: rls-no-policy 8 → 2. Initplan does not rise. Replaced policies’ initplan lints clear.
- Down-step: restore the previous grants and policy expressions from this plan’s §0. Possible, and easy to get wrong. Prefer forward-fix after production traffic.
- Point of no return: soft. The grant is reversible SQL. The app break from `select *` is immediate (REG-92).

**M8 — `v2_08_functions`**
- Objects: the rest of §1.7. `checkout_from_cart` already exists from M6; this migration replaces its body only if a trigger created here must be called from it, still without a `SELECT` or `RETURNING` of the hidden columns. ADR-023 on both write paths, payout cap, full `enforce_payment_update` (`refunded_subtotal`, `balance_confirmed_at`, proof copy), `enforce_order_transition` per ERD §7.1, `release_seller_orders`, `restore_stock_on_cancel`, `touch_stock`, `enforce_store_category_cap`, `enforce_master_proof_update`. Last statements: `DROP TRIGGER trg_set_inquiry_converted_order` and `DROP FUNCTION set_inquiry_converted_order`. `create_order_from_inquiry` is already gone; this migration does not recreate it.
- Preconditions: M7. `trg_decrement_stock_on_confirm` already absent. `create_order_from_inquiry` already absent. No function writes `converted_to_order_id` after this migration.
- Verify: Phase 08 exit items 6, 8, and 9 in `BETK_PHASES.md`. `pg_get_functiondef(checkout_from_cart)` shows the two money columns assigned from locals and a `RETURNING` list that is not `*`. ADR-023 trigger count is 2 (pickup writes, and `stores.governorate` updates). `to_regprocedure` of `set_inquiry_converted_order` is null. `converted_to_order_id` and `fk_inquiries_order` still exist.
- Advisor delta: search_path WARN stays 6. Definer-exec stays 2+2. New definers revoke EXECUTE.
- Down-step: forward-fix.
- **Point of no return:** the drop of `set_inquiry_converted_order`. The checkout RPC’s point of no return was M6.

### Not in Phase 08

| object | owner |
|---|---|
| Payment-window sweeper cron | Phase 11 |
| Prep-SLA cron | Phase 13 |
| Shipment INSERT (rows) | Phase 11. RLS is M7 |
| Tracking-event writes | Phase 14. RLS is M7 |
| `restock_alerts` subscribe path | Phase 17. RLS is M7 |
| `seller_strikes` / `flagged_content` first writes | Phase 18. RLS is M7 |
| `whatsapp_templates` first writes | Phase 14. RLS is M7 |
| `revenue_egp` writer | unpinned (REG-26). Definition in ERD §6.4 binds whoever writes it. Not a Phase 08 cron |
| REG-36 initplan sweep of untouched policies | not Phase 08 |
| REG-37 index sweep of the existing 37 FKs | not Phase 08 |
| Courier handoff mechanism | not chosen (ADR-024) |

---

## 7. Safety and rollback

### 7.1 Backup (human)

Before M1 is applied to staging, a person takes a backup from the Supabase dashboard for this project: a backup or PITR point, whichever the project’s plan shows as available. This plan does not name a connection string, a password, a service-role key, or a `pg_dump` command that would need one. If the dashboard does not show a restorable point, M1 does not start.

### 7.2 Rehearsal

Supabase preview branches are built from migrations, not from a copy of staging. They will not contain these seven orders. Rehearsing N27 on an empty preview only proves the DDL parses.

Phase 08 rehearses on a preview branch by seeding the **shape**, then running M4–M6 against that seed, before `apply_migration` on staging:

- 7 orders with the status multiset {pending ×3, cancelled ×2, confirmed ×2}
- 7 history rows, one each, with the append-only rules and the NO ACTION foreign key already present (they are in the historical migrations the preview replays)
- 0 payments, 0 order items
- 3 inquiries with `converted_to_order_id` NULL and `orders.inquiry_id` set on three of the children
- 2 addresses, 2 stores, listings with `stock_qty` NULL, plus one unrelated listing with a non-null stock
- `betk_ref` values that include both a `BETK-YYYYMMDD-XXXX` value and a `P7T02B-…` value, each unique and ≤ 25 characters

The rehearsal asserts §4.8 and the history md5 of the **seed**, not the staging md5. It also asserts the unrelated listing’s `stock_qty` is unchanged and that an attempted `DELETE` of a history-bearing order still fails. Staging is not touched until that rehearsal passes. The seven staging ids are not copied onto the preview; the shape is.

### 7.3 What rollback means

| through | rollback |
|---|---|
| M1 | labels remain. Forward-fix |
| M2–M4 | drop the new objects and recreate the stock trigger, if no master rows exist |
| M5 after `SET NOT NULL` | forward-fix. A down migration would have to drop NOT NULL, delete masters, and prove history md5. Do not plan on it after the apply is committed |
| M6–M8 | forward-fix. The relation name, the grants, and the retired RPC are the new baseline |

“Rollback” after M5’s point of no return means a new forward migration, not a reset of staging and not a delete of the seven orders.

---

## 8. Conflicts and open decisions

### 8.1 Conflicts with the rules (resolved in this plan, not by a new table)

| conflict | resolution |
|---|---|
| Seller is inside live `payments_access`, `shipments_access`, and `shipment_tracking_events_access`. N28 and ERD §8 say seller none | M7 rewrites those three. `order_messages` keeps the seller |
| ADR-019 lets the buyer UPDATE `payments.proof_path`. ADR-021 moves that write to the master | M7 narrows the grant. The trigger copies |
| v1 `pending → confirmed` is seller acceptance and fires stock. ADR-025 / OD-15: admin release, stock at checkout | M4 detaches the trigger before M5. M8 rewrites the transition. N27 does not change status, so the seven are not pushed through the new transition |
| `select *` on `seller_orders` will raise `42501` after ADR-020. Generated `Row` still lists the columns | REG-92 is a lint or a runtime test in Phase 08, not `tsc` and not types-drift |
| REG-36 wants every policy rewritten to `(select auth.uid())`. Phase 08 must not rewrite every policy | Only new and replaced policies use that form |
| REG-37 wants the 37 unindexed FKs indexed. Phase 08 must not be that sweep | New FK INFO lints are an expected delta. The old 37 stay |
| ERD §8 seller may read own `seller_documents`. The docs-bucket sentence says seller-NO | Seller-NO means no seller read of a **buyer** proof. Own-prefix SELECT stays. No new bucket, no new table |
| `submit_seller_application` signature “is Stage C” (ERD §7) and the live caller on `main` still sends the old argument list | Open decision 8.2.4. Breaking the signature at M8 breaks onboarding on staging the moment the migration commits |
| Two `confirmed` rows mean seller-accepted in the history and admin-released in v2 | Open decision 8.2.1. The copy does not rewrite them |

### 8.2 Unresolved decisions (human)

The plan does not pick these. Recommendations are recommendations.

**8.2.1 The two confirmed orders (`02482319-…`, `c7ba4f04-…`).**

History: `changed_by_type = seller`, note `order accepted by seller`, `confirmed_at` set, zero payment rows. v2 reads `status = confirmed` and `confirmed_at IS NOT NULL` as admin release.

| option | effect |
|---|---|
| A. Leave `status` and `confirmed_at` as stored (ERD §4’s “no status rewrite”) | The rows look released. There is no deposit. Payout stays impossible because `balance_confirmed_at` and `payout_eligible_at` stay NULL |
| B. Null `confirmed_at` and set `status` back to `pending` | Matches “no deposit”. It is a status rewrite ERD §4 forbids, and it must not run through a trigger that treats the write as a new transition. It also rewrites history if anyone inserts a history row. This plan forbids that history write |
| C. Leave the label and add a comment column or a flag | A new column the ERD does not list. **Stopped.** Not an option this plan can take |

Recommendation: **A**, because B rewrites status and C invents a column. The approval block is what accepts A. Until it is signed, Phase 08 does not apply M5.

**8.2.2 Goods-portion formula for `refunded_subtotal`.**

ERD §3.10 says the trigger writes the goods portion and does not copy `payments.refunded_amount`. It does not state the split. These seven rows have nothing to refund, so M5 does not need the formula. M8’s trigger does, before any refund exists.

| option | effect |
|---|---|
| A. Admin action passes the goods portion explicitly; the trigger only checks `0 <= refunded_subtotal <= subtotal` and writes that value | No invented proration. The fee remainder stays on `payments.refunded_amount` |
| B. Prorate `refunded_amount` by `subtotal / total_amount` inside the trigger | Uses the hidden total. The ERD does not state this ratio |

Recommendation: **A**.

**8.2.3 Listing shipping CHECK.**

Recommendation already drafted: `NOT VALID`, no backfill, no `VALIDATE` in Phase 08. The alternative is to invent weight and dimensions for 3 active listings. That alternative is rejected in the draft. Signing the plan accepts `NOT VALID`.

**8.2.4 `submit_seller_application` signature.**

| option | effect |
|---|---|
| A. Change the signature in M8 and change `submitSellerApplication.ts` in the same Phase 08 PR | Matches “signature change is Stage C”. The staging app is broken between the migration commit and the deploy of that PR |
| B. Keep the argument list. Ignore `p_delivery_options` and the category varchars as authority. Write `store_categories` and `store_pickup_addresses` from the arguments the caller already sends (`p_governorate`, `p_city`, category text). Phase 09 drops the dead fee field (REG-65) and only then narrows the signature | Onboarding keeps working. The ERD’s “signature change” waits for the caller |

Recommendation: **B**.

**8.2.5 Empty `admin_settings` keys.**

Recommendation drafted in M3: seed the four ERD default-meanings; leave the unnumbered keys empty; do not pick `payment_window_minutes` or the REG-88 document set. Signing accepts that.

No REG was minted. Next free remains REG-93.

---

## 9. Phase 08 handoff

Model for every row is Grok 4.7 (CF-9). Thinking is the `BETK_PHASES.md` tier. Max on migrations, RLS, and the N27 apply. High on the pack and the guards.

| task | thinking | migrations |
|---|---|---|
| T00 `phase-packs/PHASE_08_SCHEMA.md` from `BETK_PHASES.md` Phase 08 and this plan | High | none |
| Read-first re-measure against §0 before the first apply | Max | none |
| M1–M3 additive | Max | M1, M2, M3 |
| CF-1 detach | Max | M4 |
| N27 / REG-76 including the 7 | Max | M5, M6 |
| CF-2 `checkout_from_cart` never SELECT/RETURN the hidden columns. Created in the rename transaction, which also drops `create_order_from_inquiry` | Max | M6 |
| CF-3 ADR-023 both write paths | Max | M8 |
| CF-4 drop the inquiry converted-order writer; column stays | Max | M8 |
| ADR-020 grant, ADR-021 proof copy and payments grant, ADR-022 inside the RPC, transition rework, `refunded_subtotal` stamp, payout cap, REG-69 array, `ready`, docs-bucket seller-NO as §1.8 | Max | M7, M8 |
| RLS for the new tables and the six zero-policy tables; confirm `sessions` and `otp_tokens` stay empty; do not add a second `modlog_admin_insert` | Max | M2, M7 |
| REG-92 lint or runtime test. Red on `select *` / `RETURNING *`. Green on an explicit column list. Not `tsc`. Not types-drift | High | with M7 |
| REG-47 Guard E, REG-67 Guard F, REG-74 Guard G | High | no DDL |
| Exit evidence pasted against `BETK_PHASES.md` Phase 08’s nine checks | Max | after M8 |

RLS smoke (`tests/integration/rls.smoke.test.ts`, `order.rls.test.ts`) and the stock/discovery integration tests in §2.3 change in the same branch as M6. After M7, any `.select()` or `.select("*")` on `seller_orders` is a bug even if it typechecks. The current tests that already pass `"id"` or `"status"` are the shape to keep.

Guard E (REG-47): no `loading.tsx` at or above a segment that can `notFound()`. Phase 08 adds no page; the guard still lands so later phases inherit it.

Guard F (REG-67): physical `page.tsx` count against the 79. Phase 08 adds no `page.tsx`. The guard locks that.

Guard G (REG-74): suite-start residue detector. The seven ids stay the expected undeletable set until M5 gives them masters. After M5 the detector’s expected orphans are still these seven ids, now with parents, not a license to delete them.

`src/` that must change with the rename: none of the executable queries. `src/lib/supabase/types.ts` changes only by CI. Comment barrels listed in §2.3 are updated so they do not name `betk.orders`. Onboarding `src/` changes only if decision 8.2.4 is signed as option A.

---

## 10. Approval

This plan is a proposal. Applying M1 is not authorized by writing this file.

| field | value |
|---|---|
| Approver | |
| Date | |
| Approved plan SHA | |

Stage C is NOT approved until this block is signed by the human.

# AUDIT — authored P10M1 (T01)

Audited text: `docs/03-database/rehearsal/staging-text/P10M1.sql`. T01 authored it. P10-T01-FIX (2026-10-06) re-ran this audit over the whole file after R-FREEZE, R-AVAIL, R-DECLINED, and R-TRIGGER. It is not applied. Sources: `PHASE_10_CART_QUOTE.md` §5 and §6, R-LOCK and those four rulings (planning chat, 2026-10-06), `BETK_PRD.md` R-C01, R-C04, R-C06, R-Q01–R-Q05, `BETK_ERD.md` §6.1, `computeAvgResponseHours` in `src/features/messaging/messagingRules.ts` lines 82–98, and live `pg_class.relacl` / `pg_policy` / `pg_proc` / `pg_trigger` / `pg_attribute` / `pg_enum` / `admin_settings` (SELECT 2026-10-06). `list_migrations` is 41, last `20261004172620` / `v2_09_approval_state_actor`. No `apply_migration`. No `admin_settings` write. No phone predicate. `checkout_from_cart` is not in the file.

Verdicts: **MATCH** (equals the cited text or the cited ACL shape), **BROADER** (allows more), **NARROWER** (allows less than the live privilege), **AUTHORED** (not a copy of a fenced block; basis stated), **MISMATCH** (contradicts explicit ERD or plan text). A FINDING is a BROADER security row with no closer. A GRANT is never cited as the closer of a BROADER table privilege. The table REVOKE is what removes the table privilege. The column GRANT that follows is the remainder, and it is judged against the privilege that existed before the file.

**Zero MISMATCH. Zero BROADER.** The kit FINDING count stays 0. One pre-existing live gap is recorded after the ruling rows. It is not a kit row.

## R-LOCK (planning chat, 2026-10-06)

`checkout_from_cart` is SECURITY INVOKER (live `prosecdef` false; migration lines 718–722). It takes `FOR UPDATE` on the buyer's `cart_items` at lines 784–787. PostgreSQL requires UPDATE privilege on at least one column of the table for `SELECT … FOR UPDATE`. Part A revokes table INSERT and table UPDATE from `authenticated`, then grants `UPDATE (updated_at)` only. `cart_items_update` still limits the row to `buyer_id = auth.uid()`. No price, quantity, listing, or inquiry column is granted.

That re-grant is **NARROWER** than today's table grant. Live ACL (SELECT 2026-10-06): `authenticated=arwd/postgres` on `cart_items` (INSERT, SELECT, UPDATE, DELETE on every column). After the file: no INSERT; UPDATE on `updated_at` only; SELECT and DELETE unchanged. A buyer can `SET updated_at` on their own row. A buyer cannot `SET` `quantity`, `unit_price`, `listing_id`, `inquiry_id`, `is_custom`, `buyer_id`, `id`, or `created_at` (42501). The row lock is not a FINDING.

## Counts by verdict

| Part | MATCH | BROADER | NARROWER | AUTHORED | MISMATCH | FINDING |
|---|---:|---:|---:|---:|---:|---:|
| a Grants | 5 | 0 | 7 | 0 | 0 | 0 |
| b Policies | 1 | 0 | 0 | 0 | 0 | 0 |
| c Functions and triggers | 4 | 0 | 0 | 5 | 0 | 0 |
| d Rulings | 4 | 0 | 0 | 0 | 0 | 0 |

## a. Grants

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `REVOKE INSERT` on `cart_items` from `authenticated` | Part A, after the four functions | Live `authenticated=arwd`. Pack §5 R-C01: the add function is the only authenticated insert | NARROWER | SELECT and DELETE are not in this revoke. `anon` is not in it. Live anon ACL is already `r` (SELECT only; `20261001091538_v2_08_new_tables.sql` line 64) |
| `REVOKE UPDATE` on `cart_items` from `authenticated` | same statement | Live table UPDATE on all 9 columns | NARROWER | This is the statement that removes the table privilege. It is not closed by the next GRANT |
| `GRANT UPDATE (updated_at)` on `cart_items` to `authenticated` | the next statement | R-LOCK. PostgreSQL `SELECT … FOR UPDATE` needs UPDATE on at least one column. Lines 784–787 | NARROWER | Remainder after the revoke. Narrower than today's table UPDATE. Reason is the row lock. `quantity`, `unit_price`, `listing_id`, `inquiry_id`, `is_custom`, `buyer_id`, `id`, and `created_at` are not in the grant. Own-row `updated_at` writes succeed under `cart_items_update` |
| `REVOKE UPDATE` on `inquiries` from `authenticated` | Part A | Live table UPDATE, 16 columns, `authenticated=arwd` | NARROWER | INSERT, SELECT, and DELETE stay. `service_role` is not in the revoke. Quote columns are not regranted |
| `GRANT UPDATE (status)` on `inquiries` to `authenticated` | the next statement | Pack §5: `sendInquiryMessage`, `confirmInquiry`, `declineInquiry`, and `inquiry.rls.test.ts` lines 470–474 | NARROWER | One column, against today's table UPDATE. `inq_update` still requires the store or admin, so a buyer status update still matches zero rows |
| `REVOKE UPDATE` on `seller_profiles` from `authenticated` | Part B | Live table UPDATE, 14 columns | NARROWER | INSERT and SELECT stay. `service_role` is not in the revoke |
| `GRANT UPDATE (rejected_reason, submitted_at, status, approved_at)` on `seller_profiles` to `authenticated` | the next statement | Pack §5 column list. `resubmit_seller_application`, `approveSellerApplication`, `rejectSellerApplication` | NARROWER | `avg_response_hours` is not in the list. The approval trigger still refuses a seller transition that is not the resubmit shape (`enforce_approval_state_actor`, seller-profile UPDATE branch) |
| `add_fixed_cart_item(uuid, smallint)` EXECUTE | after the function | `checkout_quote_multiplier` revoke/grant shape (migration lines 89–90) | MATCH | `REVOKE` from PUBLIC and anon. `GRANT` to `authenticated`. Not a table GRANT |
| `set_cart_item_quantity(uuid, smallint)` EXECUTE | same | same shape | MATCH | Same two roles revoked, `authenticated` granted |
| `accept_inquiry_quote(uuid)` EXECUTE | same | same shape | MATCH | Same |
| `send_inquiry_quote(uuid, numeric, smallint)` EXECUTE | same | same shape | MATCH | Same |
| `recompute_seller_avg_response_hours()` EXECUTE | after the function | `enforce_approval_state_actor` revoke (P09M2) | MATCH | PUBLIC, anon, and authenticated. No GRANT. The trigger runs as the function owner. Direct call is not granted |

The four EXECUTE grants are new function privileges, not a restoration of a table privilege. Default privileges on schema `betk` (SELECT 2026-10-06) cover relations only (`defaclobjtype = r`). A new function is executable by PUBLIC until the REVOKE. Each REVOKE is in the file.

## b. Policies

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| No `CREATE` / `ALTER` / `DROP POLICY` | the file has none | Live policies, SELECT 2026-10-06 | MATCH | Untouched. `cart_items_select` is buyer or admin. `cart_items_insert` WITH CHECK is `buyer_id = auth.uid()`. `cart_items_update` USING and WITH CHECK are `buyer_id = auth.uid()` (not admin). `cart_items_delete` is the buyer. None of the four expressions mention phone. `inq_update` is the store or admin. `sp_update` is `id = auth.uid()` or admin. `seller_profiles_phone_gate` is INSERT only and is not edited. The `updated_at` grant does not add a row. `cart_items_update` is what limits that column to the buyer's own rows, including the invoker `FOR UPDATE` |

## c. Functions and triggers

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `add_fixed_cart_item` | SECURITY DEFINER, `search_path` pinned | R-C01, R-C04, R-C06, D2, R-Q01, R-AVAIL | AUTHORED | `auth.uid()` null raises `BETK_UNAUTHENTICATED` and inserts nothing. `p_quantity` null or below 1 raises `BETK_CART_QUANTITY`. The listing must be `status = active` and `deleted_at` null, else `BETK_CART_LISTING_UNAVAILABLE` (public read also shows `sold_out`; add does not). The store must be `status = active`, else `BETK_CART_STORE_INACTIVE` and nothing is inserted (R-AVAIL; a missing store is the same code). `is_made_to_order`, a null or non-positive `price`, or `price_type` other than `fixed` raises `BETK_CART_NOT_FIXED`. An existing fixed line (`inquiry_id` null) raises `BETK_CART_LINE_EXISTS` and does not change `unit_price`. Tracked `stock_qty` refuses `p_quantity` above it with `BETK_CART_OUT_OF_STOCK` and inserts nothing. Null `stock_qty` is untracked. The insert sets `buyer_id` from `auth.uid()`, `unit_price` from `listings.price`, `is_custom` false, `inquiry_id` null. No phone read. No listing lock; checkout remains the stock authority at order time |
| `set_cart_item_quantity` | SECURITY DEFINER, `search_path` pinned | R-C03, R-C04, R-C06 | AUTHORED | Own row only (`buyer_id = auth.uid()`), locked `FOR UPDATE`. Missing or not owned raises `BETK_CART_LINE_NOT_FOUND`. Quantity below 1 is refused; this function does not delete. The UPDATE sets `quantity` and `updated_at` only. `unit_price` is not in the SET list. A custom line, a made-to-order listing, or a null `stock_qty` is not stock-bounded. A tracked fixed line above `stock_qty` raises `BETK_CART_OUT_OF_STOCK` and the row is unchanged |
| `accept_inquiry_quote` | SECURITY DEFINER, `search_path` pinned | R-Q05, R-Q06, AC-QTE-4, AC-QTE-5, R-AVAIL, R-DECLINED | AUTHORED | Own inquiry only. Another buyer's id raises `BETK_QUOTE_NOT_FOUND`. Status `declined` raises `BETK_QUOTE_DECLINED` and inserts nothing (R-DECLINED). Live `inquiry_status` is `open`, `replied`, `confirmed`, `declined`, `expired` (`pg_enum`, 2026-10-06). This check refuses only `declined`. Quote present means `quoted_price`, `quoted_prep_days`, `quote_expires_at`, and `quoted_at` are all not null; otherwise `BETK_QUOTE_ABSENT` and no insert. `quote_expires_at <= now()` raises `BETK_QUOTE_EXPIRED` and inserts nothing. The listing must be `status = active` and `deleted_at` null, else `BETK_QUOTE_LISTING_UNAVAILABLE`. The store must be `status = active`, else `BETK_QUOTE_STORE_INACTIVE` (R-AVAIL). One row: `is_custom` true, `inquiry_id` set, `unit_price = quoted_price`, `listing_id` from the inquiry, `quantity` from `inquiries.quantity` when that value is at least 1, otherwise 1. A second accept raises `BETK_CART_LINE_EXISTS` and does not change the stored `unit_price`. The band is not re-checked. No phone check |
| `send_inquiry_quote` | SECURITY DEFINER, `search_path` pinned | R-Q01, R-Q02, R-Q03, R-Q04, R-Q07, D2, R-FREEZE, R-AVAIL, R-DECLINED | AUTHORED | Store owner only: `betk.my_store_id()` must equal `inquiries.store_id`. Admin is not a second path (`inq_update` includes admin; this function does not). Missing store or another store's inquiry raises `BETK_QUOTE_NOT_OWNER`. Any `cart_items` row with that `inquiry_id` raises `BETK_QUOTE_LINE_HELD` before the quote UPDATE, so `quoted_price` and `quote_expires_at` stay as they were (R-FREEZE). The function is SECURITY DEFINER, so the check is not limited to the caller's rows. Status `declined` raises `BETK_QUOTE_DECLINED` (R-DECLINED). The other live statuses (`open`, `replied`, `confirmed`, `expired`) are not refused by that check. The listing must be `status = active` and `deleted_at` null, else `BETK_QUOTE_LISTING_UNAVAILABLE`. The store must be `status = active`, else `BETK_QUOTE_STORE_INACTIVE` (R-AVAIL). The listing must then be `is_made_to_order` or `price` null, else `BETK_QUOTE_LISTING_INELIGIBLE`. Null or negative prep raises `BETK_QUOTE_PREP_REQUIRED`; zero is legal (`inquiries_quoted_prep_days_check` is `>= 0`). Null, non-positive, or out-of-range price raises `BETK_QUOTE_PRICE`. The stored price is `numeric(10,2)`. `checkout_quote_multiplier()` runs before the write, including when `price` is null, so `BETK_QUOTE_BAND_UNCONFIGURED` writes nothing. When `price` is not null, the closed interval is `quoted_price >= price` and `quoted_price <= price * multiplier`; outside it raises `BETK_QUOTE_OUT_OF_BAND`. When `price` is null there is no numeric floor or ceiling. `quote_validity_hours` must match `^[1-9][0-9]*$` and cast to integer, same fail-closed shape as `checkout_payment_window_minutes`, and the file does not write `24`. `quote_expires_at` is `now()` plus that many hours. The UPDATE sets `quoted_price`, `quoted_prep_days`, `quote_expires_at`, and `quoted_at` only. It does not set `status` and it does not update `cart_items` |
| `recompute_seller_avg_response_hours` + `trg_recompute_avg_response_hours` | AFTER INSERT on `inquiry_messages`, SECURITY DEFINER, `WHEN (NEW.sender_type = 'seller')` | R-107. Formula lines 82–98. R-TRIGGER | AUTHORED | The trigger fires only for a seller message (R-TRIGGER). A buyer, admin, or system insert does not run the function. The function body is unchanged: for the inquiry's store, the mean of (earliest `sender_type = seller` `sent_at` minus `inquiries.created_at`) in hours. A negative gap is excluded. A null timestamp is excluded. No remaining gap stores null. `round` to two decimals, then `LEAST` 999.99, then `numeric(5,2)`. Positive hours: PostgreSQL `round(numeric, 2)` matches `Math.round` half-up. `admin` and `system` messages are not seller replies. The UPDATE sets `avg_response_hours` only, so `enforce_approval_state_actor` does not raise. A missing seller skips the update and does not fail the message insert. The function has no argument |
| `checkout_from_cart` | absent | Pack: do not edit it. REG-113 stays the price copy | MATCH | Not created, not replaced, not granted. The lock stays on the live body. R-LOCK is the `updated_at` grant above, not a change to this function. A custom line is priced at the inquiry's live `quoted_price` (migration lines 869 and 1044). The store-status gap on that live body is the pre-existing FINDING below, not a verdict on this absent object |
| `admin_settings` | one SELECT of `quote_validity_hours`; one call of `checkout_quote_multiplier` | Pack: no settings write. REG-93 stays open | MATCH | No UPDATE. `payment_window_minutes` is not read and not written. Live values (SELECT 2026-10-06): `quote_validity_hours` length 2, `quote_tolerance_multiplier` length 1, `payment_window_minutes` length 0 |
| No new table | the file has no `CREATE TABLE` | OD-20 = 51 | MATCH | No new column on an existing table either |
| No phone predicate | no `phone_number` and no phone policy | REG-79 pinned B | MATCH | Add, quantity, accept, and send do not read `users.phone_number` |

`cart_items`, `inquiries`, and `inquiry_messages` had no non-internal trigger (SELECT 2026-10-06). `seller_profiles` has `trg_enforce_seller_profile_approval_state` only. This file adds one trigger, on `inquiry_messages`, and that trigger's `WHEN` is seller-only (R-TRIGGER).

## d. Rulings

One row per ruling. Each row is the whole-file check of that ruling. None of these rows is BROADER: each refusal is the ruling's own condition, and no extra status is refused.

| Ruling | Where the file does it | Source | Verdict | Note |
|---|---|---|---|---|
| R-FREEZE | `send_inquiry_quote`, after the inquiry row is locked for the caller's store and before the quote UPDATE | Planning chat, 2026-10-06. Custom price is live `quoted_price` at `v2_08_functions.sql` lines 869 and 1044 | MATCH | Any `cart_items.inquiry_id` raises `BETK_QUOTE_LINE_HELD`. SECURITY DEFINER, so every buyer's row is visible. The UPDATE does not run, so `quoted_price` and `quote_expires_at` are unchanged. The clear path is: remove the line, then a fresh quote, then accept |
| R-AVAIL | `add_fixed_cart_item`, `accept_inquiry_quote`, `send_inquiry_quote` | Planning chat, 2026-10-06. `stores_public` qual (SELECT 2026-10-06): `status = 'active'` OR owner OR admin. R-S07 is the status arm | MATCH | Listing not `active`, or `deleted_at` set: add `BETK_CART_LISTING_UNAVAILABLE`; accept and send `BETK_QUOTE_LISTING_UNAVAILABLE`. Store not `active` (pending or suspended, or no store row): add `BETK_CART_STORE_INACTIVE`; accept and send `BETK_QUOTE_STORE_INACTIVE`. The owner and admin arms of `stores_public` are not copied. Copying them would let a non-active store through, which is more than the ruling allows |
| R-DECLINED | `accept_inquiry_quote` and `send_inquiry_quote`, after the inquiry row is found | Planning chat, 2026-10-06. Live `inquiry_status`: `open`, `replied`, `confirmed`, `declined`, `expired` | MATCH | Status `declined` raises `BETK_QUOTE_DECLINED` and writes nothing. `open`, `replied`, `confirmed`, and `expired` are not refused by this check |
| R-TRIGGER | `trg_recompute_avg_response_hours` | Planning chat, 2026-10-06. `WHEN (NEW.sender_type = 'seller')` | MATCH | A buyer message does not fire the function. `admin` and `system` do not either. `recompute_seller_avg_response_hours` is otherwise the same body as before this ruling |

## Pre-existing FINDING (recorded only)

`checkout_from_cart` does not refuse a line whose store is not active. The line gate at `supabase/migrations/20261003082041_v2_08_functions.sql` lines 792–809 requires `listings.weight_g`, `deleted_at` null, and `listings.status` in (`active`, `sold_out`). It does not read `stores.status`. The later store join (lines 896–898) reads `governorate` for the courier rate and has no status predicate. Live `prosrc` (SELECT 2026-10-06) contains `quoted_price` and `sold_out` and does not contain `stores.status` (`prosecdef` false). This file does not edit the function. Owner: Phase 11 checkout migration, before the Phase 11 exit. P10-T01-FIX re-read the register header (REG-01..REG-114, next free REG-115, no REG-115 row) and took **REG-115**. Next free is REG-116. It is not a kit BROADER row, so the FINDING count above stays 0.

## Untouched

Not in the file, and not changed by it:

- `anon` on `cart_items` stays SELECT only.
- `anon` table INSERT/UPDATE/DELETE on `inquiries` and `seller_profiles` stays as live (`arwd`). RLS still requires a uid those policies do not have. This file does not grant those privileges and does not revoke them. The pack's revokes name `authenticated`.
- `service_role` ACLs stay `arwdDxtm`.
- `inquiry_messages` table ACL stays `authenticated=ard` plus the existing `is_read` column grant. Part B does not change it.
- `checkout_from_cart` EXECUTE grant to `authenticated` stays the live one.

## Direct writes after the file

| Actor | Statement | Result |
|---|---|---|
| Buyer, own row | `UPDATE cart_items SET quantity = …` or `SET unit_price = …` | 42501. Stored values unchanged |
| Buyer, own row | `UPDATE cart_items SET updated_at = …` | Succeeds. That is the R-LOCK column. It does not change price or quantity |
| Buyer | `INSERT INTO cart_items` | 42501 |
| Buyer | `DELETE` own row | Still granted, and `cart_items_delete` still applies |
| Store owner | `UPDATE inquiries SET quoted_price = …` (or prep, expiry, `quoted_at`) | 42501 |
| Store owner | `UPDATE inquiries SET status = 'replied'` on their row | Still granted. `inq_update` still applies |
| Seller | `UPDATE seller_profiles SET avg_response_hours = …` | 42501. Stored value unchanged |
| Seller message insert | the new trigger | Stores the formula result. The app update in `sendInquiryMessage` then fails and is captured |

## Later tasks (this task edits no test)

T02 proves the file on a local stack, including every refusal these four rulings add. Staging is not written. The buyer's `checkout_from_cart` proof sets `payment_window_minutes` only on that local stack. This file does not.

Between T03's apply and the Phase 10 merge, the deployed `main` app still calls `recomputeSellerAvgResponseHours` (`sendInquiryMessage.ts` lines 148–153). That update raises on `avg_response_hours`, and the action logs one captured error per seller reply. The message insert and the `status` update still succeed. T03's report states that as expected. T04 removes the call. `inquiry.writeLayer.test.ts` lines 333–367 still sees a non-null value, from the trigger, once the file is applied.

`docs/03-database/rehearsal/p09/asserts.sql` lines 892–897 expect an authenticated `avg_response_hours` update to succeed. That harness does not apply P10M1 (`.github/workflows/p09-db.yml` pins an earlier migration set). No edit in this task.

Service-role `INSERT` of `seller_profiles` that includes `avg_response_hours` (`discovery.listing.test.ts` line 119, `discovery.storefront.test.ts` line 116) is an INSERT. Part B revokes UPDATE, not INSERT.

No app file and no integration test issues an authenticated `UPDATE` of `cart_items`. `attemptGuestCartInsert` is an anon INSERT and stays refused.

# AUDIT — authored M7 and M8 (T05b)

Audited text: `docs/03-database/rehearsal/staging-text/M7.sql` and `M8.sql`. Branch tip at the bound blobs: `368390d`. Sources: `BETK_V2_SCHEMA_DELTA_PLAN.md` (plan), `BETK_ERD.md` (ERD), ADR-019..ADR-023, and the staging `information_schema.columns` list pasted in the M7 header (SELECT, 2026-10-02). Staging was not written. `list_migrations` still 37, last `20261002081631`.

Verdicts: **MATCH** (kit equals the cited text), **BROADER** (kit allows more), **NARROWER** (kit allows less), **AUTHORED** (not a copy of a fenced block or a cell; basis stated), **MISMATCH** (contradicts explicit ERD or plan text). A FINDING is a BROADER security row with no later closer. This audit does not patch findings.

**Decisions (human, 2026-10-02), verbatim:**

R1 M7 and M8 are authored, audited and CI-tested before any staging apply.
- T05b writes docs/03-database/rehearsal/staging-text/M7.sql and M8.sql. M8 includes the final checkout_from_cart via CREATE OR REPLACE.
- T06 only applies them byte-for-byte (blob binding, as D-B). Pack T06 steps 1 and 3 change from "apply from plan §…" to "apply staging-text/M7.sql / M8.sql".

R2 Test-only values: the CI database may set admin_settings pins (payment_window_minutes, price band, agreement versions, …) to values labelled "CI TEST VALUE". Never on staging. Staging keys stay empty (CF-12).

**Findings (open, not patched):**

1. **F-ESC `orders_update`.** Plan §1.6 adds `escalated_at`, `escalation_reason`, and `escalation_note` because the seller sets them. `M7.sql:147-160` USING and WITH CHECK are buyer or store or admin. `M8.sql:208-209` returns NEW when `status` is unchanged, so a buyer who passes the policy can write those three columns. No later statement narrows that. **BROADER.** No closer. A column GRANT is not a closer (E1).
2. **F-AGREE `checkout_agreement_version`.** `M8.sql:86-111` is SECURITY DEFINER and `GRANT EXECUTE` to `authenticated`. The four `agreement_*` keys are admin-only after `M7.sql:231-238` (REG-69). Any authenticated session can read them. Required so the INVOKER checkout can fail closed on an empty key (plan §8.2.5, D4). **BROADER.** No closer. Not removed.
3. **F-BLOCK `enforce_payout_cap`.** ERD §6.4 says the cap has no blocking dispute or return. `M8.sql:537-548` filters on `balance_confirmed_at`, `payout_eligible_at`, and payout status `pending` / `processing` / `processed`. It does not read `disputes` or `returns`. The blocking statuses are not named. **BROADER.** No closer. FLAG-BLOCKING.
4. **F-REFUND `refunded_subtotal`.** D2 says the admin supplies the goods portion and the trigger must not copy `payments.refunded_amount`. `M8.sql:349-350` does not write `refunded_subtotal`. No other M8 statement writes it, and that column is not in the `seller_orders` UPDATE grant (`M7.sql:56-62`). A confirmed refund therefore stays 0 in the payout sum. **BROADER** (the cap ignores a goods portion nothing can stamp). No closer. FLAG-REFUND.

**FLAGS (spec does not decide; the kit states the behaviour it uses and does not pick a product rule):**

- FLAG-REG-88. Checkout reads the four agreement keys and does not branch on them (`M8.sql:9-11`).
- FLAG-SUBMIT. `submit_seller_application` / resubmit are not rewritten (`M8.sql:12-14`). D3 keeps the argument list.
- FLAG-REFUND. See F-REFUND.
- FLAG-BLOCKING. See F-BLOCK.
- FLAG-COURIER. `shipments.courier` is the matched `courier_rates.id` text (`M8.sql:1030-1034`). The matrix has no courier-name column.
- FLAG-PREDELIVERY. Restore runs from `pending`, `confirmed`, `preparing`, or `ready`. Not from `dispatched` (`M8.sql:23-24`).
- FLAG-RETURN-ACTOR. `delivered → returned` requires `is_admin()` and a `returns` row with `status = accepted` (`M8.sql:270-281`).
- FLAG-PREP-NULL. `prep_deadline` stays null when every `prep_days_snapshot` is null (`M8.sql:28-29`).
- FLAG-QUOTE-HOURS. Checkout uses `quote_expires_at`. It does not re-read `quote_validity_hours` (`M8.sql:30-32`).

## Counts by verdict

| Part | MATCH | BROADER | NARROWER | AUTHORED | MISMATCH | FINDING |
|---|---:|---:|---:|---:|---:|---:|
| a Grants | 13 | 0 | 0 | 0 | 0 | 0 |
| b Policies | 28 | 1 | 0 | 0 | 0 | 1 |
| c Functions and triggers | 13 | 2 | 0 | 7 | 0 | 3 |
| d Checkout defects | 8 | 0 | 0 | 2 | 0 | 0 |

BROADER rows: `orders_update` (b, F-ESC), `checkout_agreement_version` and `enforce_payout_cap` (c, F-AGREE and F-BLOCK). The refund gap is the fourth FINDING and is the AUTHORED absence row in (c), not a second grant. No BROADER row is closed by a GRANT. No MISMATCH.

## a. Grants

Column-scoped tables revoke the table privilege before the column GRANT (pack §2, E1).

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `REVOKE SELECT` on `seller_orders` from anon, authenticated | `M7.sql:18` | plan §1.6; ADR-020; REG-90 | MATCH | Before the column GRANT |
| `GRANT SELECT` of the 28-column list to authenticated | `M7.sql:20-49` | plan §1.6; header paste | MATCH | Staging ordinal list minus `delivery_fee` and `total_amount` |
| `REVOKE UPDATE` on `seller_orders` from authenticated | `M7.sql:54` | plan §1.6 | MATCH | anon table-level UPDATE is not revoked |
| `GRANT UPDATE` (`status`, `cancellation_reason`, `escalated_at`, `escalation_reason`, `escalation_note`) | `M7.sql:56-62` | plan §1.6 | MATCH | Trigger-stamped and hidden columns stay out |
| `REVOKE UPDATE` on `payments` from authenticated | `M7.sql:70` | ADR-021; plan §1.6 | MATCH | anon table-level UPDATE stays |
| `GRANT UPDATE` (`status`, `confirmed_at`, `confirmed_by`, `notes`, `refunded_amount`) | `M7.sql:72-78` | ADR-021; plan §1.6 | MATCH | `proof_path`, `transfer_reference`, `proof_snapshot_at` ungranted |
| `REVOKE ALL` on `master_orders` from anon, authenticated | `M7.sql:83` | E1; plan §1.6 | MATCH | Repeats M2 so this file is the closer |
| `GRANT SELECT` of all 16 `master_orders` columns | `M7.sql:85-102` | plan §1.6 | MATCH | anon receives nothing |
| `GRANT INSERT` of the checkout columns | `M7.sql:107-119` | plan §1.6 | MATCH | `id` and `created_at` stay on defaults. Proof columns are not inserted here |
| `GRANT UPDATE` (`proof_path`, `transfer_reference`) | `M7.sql:121-124` | plan §1.6; E1 | MATCH | After the REVOKE. Not a closer by itself |
| `REVOKE UPDATE` on `dispute_messages` | `M7.sql:129` | ERD §8; REG-42 | MATCH | Before the column GRANT |
| `GRANT UPDATE (is_read)` to authenticated | `M7.sql:131` | ERD §8 | MATCH | Sender content stays ungranted |
| `GRANT EXECUTE ON checkout_from_cart(uuid)` to authenticated | `M7.sql:395` | plan §6 M7; C1 | MATCH | Last statement. Not anon. Not PUBLIC |

## b. Policies

Replaced policies use `(SELECT auth.uid())`. `order_messages_*` is not recreated. `sessions` and `otp_tokens` get no policy. `modlog_admin_insert` is not added again.

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `orders_access` | `M7.sql:138-145` | plan §1.5 | MATCH | Buyer, store, or admin |
| `orders_update` | `M7.sql:147-160` | plan §1.5; §1.6 seller sets escalation | BROADER | F-ESC. No closer |
| `payments_access` | `M7.sql:162-175` | plan §1.5; N28 | MATCH | Store leg dropped |
| `shipments_access` | `M7.sql:177-190` | plan §1.5; N28 | MATCH | Store leg dropped |
| `shipments_insert` | `M7.sql:193-202` | ERD §8 checkout | MATCH | Buyer of the child |
| `shipments_update` | `M7.sql:205-208` | ERD §8 admin | MATCH | |
| `shipment_tracking_events_access` | `M7.sql:210-224` | plan §1.5 | MATCH | Store leg dropped |
| `shipment_tracking_events_insert` | `M7.sql:227-229` | ERD §8 admin or service | MATCH | Service role bypasses RLS |
| `settings_payment_config_read` | `M7.sql:231-238` | REG-69; plan §1.5 | MATCH | `betk_instapay_handle` only |
| `dispute_evidence_select` | `M7.sql:244-257` | plan §1.5; ERD §8 | MATCH | |
| `dispute_evidence_insert` | `M7.sql:259-272` | plan §1.5; ERD §8 | MATCH | |
| `dispute_messages_select` | `M7.sql:274-287` | plan §1.5; ERD §8 | MATCH | |
| `dispute_messages_insert` | `M7.sql:289-303` | plan §1.5; ERD §8 | MATCH | |
| `dispute_messages_read_receipt` | `M7.sql:305-333` | ERD §8 | MATCH | UPDATE of `is_read` only, via the grant |
| `flagged_content_select` | `M7.sql:335-337` | plan §1.5 | MATCH | Admin |
| `flagged_content_insert` | `M7.sql:339-341` | plan §1.5 | MATCH | `reported_by = auth.uid()` |
| `flagged_content_update` | `M7.sql:343-346` | plan §1.5 | MATCH | Admin |
| `restock_alerts_select` | `M7.sql:348-353` | plan §1.5 | MATCH | No UPDATE policy |
| `restock_alerts_insert` | `M7.sql:355-357` | plan §1.5 | MATCH | |
| `restock_alerts_delete` | `M7.sql:359-361` | plan §1.5 | MATCH | |
| `seller_strikes_select` | `M7.sql:365-370` | plan §1.5 | MATCH | Own seller or admin |
| `seller_strikes_insert` | `M7.sql:372-374` | plan §1.5 | MATCH | Admin |
| `seller_strikes_update` | `M7.sql:376-379` | plan §1.5 | MATCH | Admin |
| `whatsapp_templates_select` | `M7.sql:381-383` | plan §1.5 | MATCH | Admin |
| `whatsapp_templates_insert` | `M7.sql:385-387` | plan §1.5 | MATCH | Admin |
| `whatsapp_templates_update` | `M7.sql:389-392` | plan §1.5 | MATCH | Admin |
| `sessions` policies | none | plan §6 M7; §1.8 | MATCH | Stays zero |
| `otp_tokens` policies | none | plan §6 M7 | MATCH | Stays zero |
| `modlog_admin_insert` | not added | plan §6 M7 | MATCH | Still the one live policy |

Expected advisor shape after apply, not measured on staging: `rls_enabled_no_policy` 8 → 2 (`sessions`, `otp_tokens`). CI asserts that count on the local stack.

## c. Functions and triggers

New definers set `search_path` to `betk, public` and revoke EXECUTE from PUBLIC, anon, and authenticated, except the three checkout readers, which grant EXECUTE to authenticated (plan §8.2.5; the commission-snapshot pattern). Triggers are not RPCs (ADR-012).

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `checkout_payment_window_minutes` | `M8.sql:42-62` | plan §8.2.5; D4 | AUTHORED | INVOKER cannot see the admin-only key. Empty or non-integer raises `BETK_PAYMENT_WINDOW_UNCONFIGURED` |
| `checkout_quote_multiplier` | `M8.sql:64-84` | plan §1.7 band | AUTHORED | Does not hardcode 2. Empty fails closed |
| `checkout_agreement_version(text)` | `M8.sql:86-111` | plan §8.2.5; REG-88 | BROADER | F-AGREE. Four keys only. Checkout reads all four and does not branch. FLAG-REG-88 |
| `touch_stock` + `trg_touch_stock` | `M8.sql:115-135` | plan §1.7; §4.2 | MATCH | INVOKER. Stamps `stock_touched_at` when `stock_qty` changes. EXECUTE revoked |
| `decrement_stock_on_confirm` body | `M8.sql:142-177` | plan §1.7; §7.2 | MATCH | Skips null stock. Raises `BETK_CHECKOUT_OUT_OF_STOCK`. `sold_out` at 0. Does not assign `stock_touched_at`; the UPDATE fires `trg_touch_stock` |
| `trg_decrement_stock_on_checkout` | `M8.sql:179-183` | plan §4.2 | AUTHORED | AFTER INSERT on `order_items`. Checkout has no `UPDATE` of `listings`. Confirm trigger stays dropped (M4) |
| `enforce_order_transition` | `M8.sql:188-288` | ERD §7.1 | MATCH | `is_admin()` is not a blanket bypass. Seller is never `cancelled_by` |
| `delivered → returned` actor | `M8.sql:270-281` | ERD §7.1 “return accepted” | AUTHORED | FLAG-RETURN-ACTOR. Admin and an accepted `returns` row |
| `release_seller_orders(uuid, uuid)` | `M8.sql:293-344` | plan §1.7; ADR-021 | AUTHORED | Second argument skips the row already in the BEFORE trigger. Plan names one uuid. EXECUTE revoked |
| `prep_deadline` when every snapshot is null | `M8.sql:28-29` | plan §1.7 | AUTHORED | FLAG-PREP-NULL. Stays null |
| `enforce_payment_update` | `M8.sql:351` | plan §1.7; ADR-021 | MATCH | Client proof write raises `BETK_PAYMENT_PROOF_FORBIDDEN`. Deposit confirm calls release. Balance confirm stamps `balance_confirmed_at` only |
| no writer of `refunded_subtotal` | none | D2 | AUTHORED | F-REFUND. FLAG-REFUND. Not copied from `payments.refunded_amount` |
| `restore_stock_on_cancel` + trigger | `M8.sql:421-485` | plan §1.7; ERD §7; REG-82 | MATCH | `returned` does not restore. FLAG-PREDELIVERY for the status set |
| `enforce_store_category_cap` + trigger | `M8.sql:489-523` | plan §1.7; §8.2.5 | MATCH | Empty `seller_category_limit` raises. The number 3 is the M3 default, not a hardcode |
| `enforce_payout_cap` + trigger | `M8.sql:527-563` | ERD §6.4 | BROADER | F-BLOCK. FLAG-BLOCKING. `rejected` is excluded. Scoped to `NEW.store_id` |
| `enforce_pickup_governorate` + `trg_pickup_governorate_eq` | `M8.sql:568-593` | ADR-023; CF-3 | MATCH | BEFORE INSERT OR UPDATE |
| `sync_store_governorate_to_pickup` + `trg_store_governorate_eq` | `M8.sql:595-617` | ADR-023; CF-3 | MATCH | AFTER UPDATE OF `governorate` |
| `enforce_master_proof_update` + trigger | `M8.sql:621-671` | plan §1.7 | MATCH | Buyer, once, before `payment_deadline`, children still pending. Stamps `proof_uploaded_at` |
| `checkout_from_cart` | `M8.sql:683` | C1; plan §1.7 | MATCH | Same signature. SECURITY INVOKER. `search_path` pinned. CREATE OR REPLACE of the M6 shell |
| `DROP TRIGGER trg_set_inquiry_converted_order` | `M8.sql:1049` | CF-4; plan §6 M8 | MATCH | Last statements |
| `DROP FUNCTION set_inquiry_converted_order` | `M8.sql:1050` | CF-4 | MATCH | Column and `fk_inquiries_order` stay. `create_order_from_inquiry` is not recreated |
| `submit_seller_application` not rewritten | none | D3 | MATCH | FLAG-SUBMIT. Argument list unchanged |

`set_order_commission_snapshot` is not rewritten. It still stamps `commission_rate` and `round(rate/100*subtotal, 2)` on insert.

## d. Checkout defects named in the draft header and in T05b

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| Stock is not an inline `listings` UPDATE | `M8.sql:674-675` | plan §4.2 | MATCH | `order_items` INSERT → `decrement_stock_on_confirm` → `touch_stock` |
| `betk_ref` `BETK-YYYYMMDD-XXXX` | `M8.sql:676-677` | R-O02; ERD §6.1 | MATCH | Child `betk_ref` and `display_ref` stay NULL (REG-81) |
| Payments: one deposit transfer, COD balance per shipment, no zero-amount row | `M8.sql:1021-1028` | R-O17; ADR-022 | MATCH | Child deposits are the floored halves plus leftover piastres. `amount > 0` |
| Courier from the matrix | `M8.sql:1030-1034` | plan §1.7; ERD §6.1 | AUTHORED | FLAG-COURIER. Half-open bands. `courier_rate_id` stores the same id |
| Commission is a flat percent of subtotal, snapshotted | existing trigger | plan §1.7 | MATCH | Checkout does not compute it |
| Buyer sees one total | master `combined_delivery_total` | plan §1.7 | MATCH | Sum of child subtotals plus that column. Hidden columns are INSERT targets from locals |
| Quote inside `[price, multiplier × price]`, and not expired | checkout body | N23; plan §1.7 | MATCH | Multiplier is the settings reader. FLAG-QUOTE-HOURS for the 24h key |
| Empty `admin_settings` keys it reads fail closed | three readers | plan §8.2.5; D4 | MATCH | |
| Agreement versions are read and not chosen | `M8.sql:9-11` | REG-88 | AUTHORED | FLAG-REG-88 |
| No SELECT or RETURN of `delivery_fee` or `total_amount` | `M8.sql:681-682` | CF-2 | MATCH | `RETURNING` is the master id |

History insert of NULL → `pending` (`M8.sql:1036`) is AUTHORED. Basis: the live history table is append-only and checkout is the create path. Not a fenced block.

## CI

Green run [37057129740](https://github.com/Jovo-Jovi/betk/actions/runs/37057129740) on `368390d`. Assert table: 59 parsed rows, every `pass` is `t`, `all_pass` actual `true|58`. Harness fixes before that run (SQL or fixture only; no assertion expected value was changed): seed the N27 shape before the staging-bound M5 block; cast checkout payment enums; give the payout fixture a `master_order_id`. R2 pins live only in that CI database.

## Binding

| File | blob id | LF SHA256 |
|---|---|---|
| `M7.sql` | `9b402b8dfd91edfeff09fab549debe79f97aa023` | `ec739e063705da9a064df62585afe5e5f0d4c0cdd0f1436bcaeca63df4a9b5c1` |
| `M8.sql` | `ac1f370baf1b6910db8c4606b0349805a07bf76c` | `6650d40d6eed3b4e76d3396f9c3ddf5440ab7ee26f942b499b9f3b23433ab242` |

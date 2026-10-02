# AUDIT — authored M7 and M8 (T05b)

Audited text: `docs/03-database/rehearsal/staging-text/M7.sql` and `M8.sql`. T05b bound both files at `368390d`. T05b-FIX bound the G1/G3 M8 blob at `292211f`; M7 did not change. Sources: `BETK_V2_SCHEMA_DELTA_PLAN.md` (plan), `BETK_ERD.md` (ERD), ADR-019..ADR-023, and the staging `information_schema.columns` list pasted in the M7 header (SELECT, 2026-10-02). Staging was not written. `list_migrations` still 37, last `20261002081631`.

Verdicts: **MATCH** (kit equals the cited text), **BROADER** (kit allows more), **NARROWER** (kit allows less), **AUTHORED** (not a copy of a fenced block or a cell; basis stated), **MISMATCH** (contradicts explicit ERD or plan text). A FINDING is a BROADER security row with no later closer. T05b-FIX (2026-10-02) applied the human decisions below. Staging was not written.

**Decisions (human, 2026-10-02), verbatim:**

R1 M7 and M8 are authored, audited and CI-tested before any staging apply.
- T05b writes docs/03-database/rehearsal/staging-text/M7.sql and M8.sql. M8 includes the final checkout_from_cart via CREATE OR REPLACE.
- T06 only applies them byte-for-byte (blob binding, as D-B). Pack T06 steps 1 and 3 change from "apply from plan §…" to "apply staging-text/M7.sql / M8.sql".

R2 Test-only values: the CI database may set admin_settings pins (payment_window_minutes, price band, agreement versions, …) to values labelled "CI TEST VALUE". Never on staging. Staging keys stay empty (CF-12).

**Decisions (human, 2026-10-02), verbatim:**

G1 F-ESC — fix. In M8, a seller_orders UPDATE that changes escalated_at, escalation_reason or escalation_note raises BETK_ESCALATION_ACTOR unless NEW.store_id = betk.my_store_id() or betk.is_admin(), even when status is unchanged. escalation_resolved_at stays admin-only (cite how). AUDIT row → MATCH, with the fix cited.

G2 F-AGREE — accepted. A four-key allow-list of non-sensitive version labels; buyers must see the version they accept (R-G02). AUDIT verdict: BROADER — ACCEPTED (human, G2).

G3 F-BLOCK — fix, fail-closed. enforce_payout_cap also refuses while the seller order has any dispute or return in a non-terminal status. Take the terminal sets from the live enum labels (SELECT; cite them). Treat every status not explicitly closed, resolved, rejected, refunded or cancelled as blocking. Mint a REG at mint time: "payout-blocking dispute/return statuses — product pin; M8 currently blocks every non-terminal status". Owner: Human. Before: the phase that builds payouts (cite BETK_PHASES).

G4 F-REFUND — accepted as latent (no refund flow exists before the returns/disputes phase). Mint a REG: "refunded_subtotal writer = admin-only SECURITY DEFINER function with an is_admin() check, never a column grant to authenticated; must exist before the first refund write". Owner: the phase that builds refunds (cite). Before: the first refund write.

G5 FLAGs. Accepted as provisional (record each with its owner phase): REG-88, SUBMIT, COURIER (until ADR-024 chooses), PREDELIVERY, RETURN-ACTOR, QUOTE-HOURS. FLAG-PREP-NULL → mint a REG: "prep_deadline when no item has prep days — product pin; M8 leaves it NULL, so the SLA ladder does not run". Owner: Human. Before: the phase that builds the prep-SLA ladder (cite).

**How each row stands after those decisions:**

1. **F-ESC `orders_update`.** **MATCH.** `M8.sql:217-224` raises `BETK_ESCALATION_ACTOR` when `escalated_at`, `escalation_reason`, or `escalation_note` changes, unless `NEW.store_id = betk.my_store_id()` or `betk.is_admin()`, and that check runs before the unchanged-status `RETURN NEW` (`M8.sql:226-228`). `escalation_resolved_at` stays admin-only because it is absent from the authenticated UPDATE grant (`M7.sql:56-62` grants `status`, `cancellation_reason`, `escalated_at`, `escalation_reason`, `escalation_note` only; plan §1.6). A seller UPDATE of that column raises 42501. M7 was not changed.
2. **F-AGREE `checkout_agreement_version`.** **BROADER — ACCEPTED (human, G2).** `M8.sql:92-117` is SECURITY DEFINER, granted to `authenticated`, and allow-lists the four agreement version keys. A key outside that list raises `BETK_AGREEMENT_KEY_NOT_CHECKOUT`. Buyers must see the version they accept (R-G02).
3. **F-BLOCK `enforce_payout_cap`.** **MATCH.** `M8.sql:562-577` excludes a seller order that has a dispute or return whose status text is not `closed`, `resolved`, `rejected`, `refunded`, or `cancelled`. Live labels (SELECT 2026-10-02, `pg_enum`): `dispute_status` `submitted`, `under_review`, `awaiting_seller`, `resolved`, `closed`; `return_status` `requested`, `accepted`, `rejected`, `refunded`. Terminal among those: dispute `resolved` and `closed`; return `rejected` and `refunded`. `accepted` blocks. `cancelled` is in neither enum. The product pin of which statuses should block is **REG-102**. Owner: Human. Before: Phase 19 (`BETK_PHASES.md`, earnings and payouts).
4. **F-REFUND `refunded_subtotal`.** **AUTHORED, accepted as latent (human, G4).** No M8 statement writes the column (`M8.sql:15-17`). It is not in the authenticated UPDATE grant (`M7.sql:56-62`). No refund flow exists before Phase 15. **REG-103.** Owner: Phase 15. Before: the first refund write.

**FLAGS accepted as provisional (human, G5):**

- FLAG-REG-88. Checkout reads the four agreement keys and does not branch (`M8.sql:9-11`). Owner phase: Phase 09 pins the set (existing REG-88); Phase 11 reads the pin and does not choose it.
- FLAG-SUBMIT. `submit_seller_application` / resubmit are not rewritten (`M8.sql:12-14`). Owner phase: Phase 09 (onboarding submit and `store_categories`).
- FLAG-COURIER. `shipments.courier` is the matched `courier_rates.id` text (`M8.sql:1065-1069`). Owner phase: Phase 14, until ADR-024 chooses.
- FLAG-PREDELIVERY. Restore runs from `pending`, `confirmed`, `preparing`, or `ready`. Not from `dispatched` (`M8.sql:29-30`). Owner phase: Phase 14.
- FLAG-RETURN-ACTOR. `delivered → returned` requires `is_admin()` and a `returns` row with `status = accepted` (`M8.sql:288-299`). Owner phase: Phase 15.
- FLAG-QUOTE-HOURS. Checkout uses `quote_expires_at`. It does not re-read `quote_validity_hours` (`M8.sql:36-38`). Owner phase: Phase 10 (quote send).
- FLAG-PREP-NULL. `prep_deadline` stays null when every snapshot is null (`M8.sql:34-35`). **REG-104.** Owner: Human. Before: Phase 13 (the prep-SLA ladder).

## Counts by verdict

| Part | MATCH | BROADER | NARROWER | AUTHORED | MISMATCH | FINDING |
|---|---:|---:|---:|---:|---:|---:|
| a Grants | 13 | 0 | 0 | 0 | 0 | 0 |
| b Policies | 29 | 0 | 0 | 0 | 0 | 0 |
| c Functions and triggers | 14 | 1 | 0 | 7 | 0 | 0 |
| d Checkout defects | 8 | 0 | 0 | 2 | 0 | 0 |

BROADER row: `checkout_agreement_version` (c, F-AGREE), **BROADER — ACCEPTED (human, G2)**. `orders_update` is MATCH via the G1 trigger. `enforce_payout_cap` is MATCH via the G3 filter (REG-102). The refund gap stays the AUTHORED absence row, accepted as latent (human, G4, REG-103). No BROADER row is closed by a GRANT. No MISMATCH. No open FINDING.

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
| `orders_update` | `M7.sql:147-160`; closer `M8.sql:217-224` | plan §1.5; §1.6 seller sets escalation | MATCH | G1. `BETK_ESCALATION_ACTOR` unless store or admin, including when status is unchanged. `escalation_resolved_at` is not in `M7.sql:56-62` (42501) |
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
| `checkout_payment_window_minutes` | `M8.sql:48-68` | plan §8.2.5; D4 | AUTHORED | INVOKER cannot see the admin-only key. Empty or non-integer raises `BETK_PAYMENT_WINDOW_UNCONFIGURED` |
| `checkout_quote_multiplier` | `M8.sql:70-90` | plan §1.7 band | AUTHORED | Does not hardcode 2. Empty fails closed |
| `checkout_agreement_version(text)` | `M8.sql:92-117` | plan §8.2.5; REG-88; R-G02 | BROADER — ACCEPTED (human, G2) | Four version keys. Any other key raises `BETK_AGREEMENT_KEY_NOT_CHECKOUT`. FLAG-REG-88, Phase 09 |
| `touch_stock` + `trg_touch_stock` | `M8.sql:121-141` | plan §1.7; §4.2 | MATCH | INVOKER. Stamps `stock_touched_at` when `stock_qty` changes. EXECUTE revoked |
| `decrement_stock_on_confirm` body | `M8.sql:148-183` | plan §1.7; §7.2 | MATCH | Skips null stock. Raises `BETK_CHECKOUT_OUT_OF_STOCK`. `sold_out` at 0. Does not assign `stock_touched_at`; the UPDATE fires `trg_touch_stock` |
| `trg_decrement_stock_on_checkout` | `M8.sql:185-189` | plan §4.2 | AUTHORED | AFTER INSERT on `order_items`. Checkout has no `UPDATE` of `listings`. Confirm trigger stays dropped (M4) |
| `enforce_order_transition` | `M8.sql:194-306` | ERD §7.1 | MATCH | `is_admin()` is not a blanket bypass. Seller is never `cancelled_by`. G1 actor check is `M8.sql:217-224` |
| `delivered → returned` actor | `M8.sql:288-299` | ERD §7.1 “return accepted” | AUTHORED | FLAG-RETURN-ACTOR, accepted provisional. Owner phase: Phase 15 |
| `release_seller_orders(uuid, uuid)` | `M8.sql:311-362` | plan §1.7; ADR-021 | AUTHORED | Second argument skips the row already in the BEFORE trigger. Plan names one uuid. EXECUTE revoked |
| `prep_deadline` when every snapshot is null | `M8.sql:34-35` | plan §1.7 | AUTHORED | REG-104. Stays null. Owner: Human. Before: Phase 13 |
| `enforce_payment_update` | `M8.sql:369` | plan §1.7; ADR-021 | MATCH | Client proof write raises `BETK_PAYMENT_PROOF_FORBIDDEN`. Deposit confirm calls release. Balance confirm stamps `balance_confirmed_at` only |
| no writer of `refunded_subtotal` | none | D2 | AUTHORED | Accepted as latent (human, G4). REG-103. Owner: Phase 15. Before: the first refund write |
| `restore_stock_on_cancel` + trigger | `M8.sql:439-503` | plan §1.7; ERD §7; REG-82 | MATCH | `returned` does not restore. FLAG-PREDELIVERY, accepted provisional. Owner phase: Phase 14 |
| `enforce_store_category_cap` + trigger | `M8.sql:507-541` | plan §1.7; §8.2.5 | MATCH | Empty `seller_category_limit` raises. The number 3 is the M3 default, not a hardcode |
| `enforce_payout_cap` + trigger | `M8.sql:546-598` | ERD §6.4; G3 | MATCH | Non-terminal dispute or return excluded (`M8.sql:562-577`). REG-102. `rejected` payouts stay out of the used sum |
| `enforce_pickup_governorate` + `trg_pickup_governorate_eq` | `M8.sql:603-628` | ADR-023; CF-3 | MATCH | BEFORE INSERT OR UPDATE |
| `sync_store_governorate_to_pickup` + `trg_store_governorate_eq` | `M8.sql:630-652` | ADR-023; CF-3 | MATCH | AFTER UPDATE OF `governorate` |
| `enforce_master_proof_update` + trigger | `M8.sql:656-706` | plan §1.7 | MATCH | Buyer, once, before `payment_deadline`, children still pending. Stamps `proof_uploaded_at` |
| `checkout_from_cart` | `M8.sql:718` | C1; plan §1.7 | MATCH | Same signature. SECURITY INVOKER. `search_path` pinned. CREATE OR REPLACE of the M6 shell |
| `DROP TRIGGER trg_set_inquiry_converted_order` | `M8.sql:1084` | CF-4; plan §6 M8 | MATCH | Last statements |
| `DROP FUNCTION set_inquiry_converted_order` | `M8.sql:1085` | CF-4 | MATCH | Column and `fk_inquiries_order` stay. `create_order_from_inquiry` is not recreated |
| `submit_seller_application` not rewritten | none | D3 | MATCH | FLAG-SUBMIT, accepted provisional. Owner phase: Phase 09 |

`set_order_commission_snapshot` is not rewritten. It still stamps `commission_rate` and `round(rate/100*subtotal, 2)` on insert.

## d. Checkout defects named in the draft header and in T05b

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| Stock is not an inline `listings` UPDATE | `M8.sql:709-710` | plan §4.2 | MATCH | `order_items` INSERT → `decrement_stock_on_confirm` → `touch_stock` |
| `betk_ref` `BETK-YYYYMMDD-XXXX` | `M8.sql:711-712` | R-O02; ERD §6.1 | MATCH | Child `betk_ref` and `display_ref` stay NULL (REG-81) |
| Payments: one deposit transfer, COD balance per shipment, no zero-amount row | `M8.sql:1056-1063` | R-O17; ADR-022 | MATCH | Child deposits are the floored halves plus leftover piastres. `amount > 0` |
| Courier from the matrix | `M8.sql:1065-1069` | plan §1.7; ERD §6.1 | AUTHORED | FLAG-COURIER, accepted provisional. Owner phase: Phase 14, until ADR-024 chooses |
| Commission is a flat percent of subtotal, snapshotted | existing trigger | plan §1.7 | MATCH | Checkout does not compute it |
| Buyer sees one total | master `combined_delivery_total` | plan §1.7 | MATCH | Sum of child subtotals plus that column. Hidden columns are INSERT targets from locals |
| Quote inside `[price, multiplier × price]`, and not expired | checkout body | N23; plan §1.7 | MATCH | Multiplier is the settings reader. FLAG-QUOTE-HOURS, accepted provisional. Owner phase: Phase 10 |
| Empty `admin_settings` keys it reads fail closed | three readers | plan §8.2.5; D4 | MATCH | |
| Agreement versions are read and not chosen | `M8.sql:9-11` | REG-88 | AUTHORED | FLAG-REG-88, accepted provisional. Owner phase: Phase 09; Phase 11 reads the pin |
| No SELECT or RETURN of `delivery_fee` or `total_amount` | `M8.sql:716-717` | CF-2 | MATCH | `RETURNING` is the master id |

History insert of NULL → `pending` (`M8.sql:1071`) is AUTHORED. Basis: the live history table is append-only and checkout is the create path. Not a fenced block.

## CI

T05b green run [37057129740](https://github.com/Jovo-Jovi/betk/actions/runs/37057129740) on `368390d`: 59 parsed rows, every `pass` is `t`, `all_pass` actual `true|58`. T05b-FIX green run [37061620442](https://github.com/Jovo-Jovi/betk/actions/runs/37061620442) on `20c7740`: 67 parsed rows, every `pass` is `t`, `all_pass` actual `true|66`. The eight new rows are `esc_buyer_actor`, `esc_store_owner`, `esc_admin`, `esc_resolved_seller`, `agreement_key_not_checkout`, `payout_open_dispute`, `payout_open_return`, `payout_terminal_clear`. No earlier expected value was changed. The tally moved from `true|58` to `true|66` because those rows were added. One fixture retry set the G3 payout amount to 100 so it satisfies `payouts_amount_check` (`amount >= 100`); the expected results stayed `BETK_PAYOUT_CAP` and `ok`. N27 green run [37060438890](https://github.com/Jovo-Jovi/betk/actions/runs/37060438890): 45 rows, every `pass` is `t`, `all_pass` actual `true|44`.

## Binding

M7 did not change.

| File | blob id | LF SHA256 |
|---|---|---|
| `M7.sql` | `9b402b8dfd91edfeff09fab549debe79f97aa023` | `ec739e063705da9a064df62585afe5e5f0d4c0cdd0f1436bcaeca63df4a9b5c1` |
| `M8.sql` | `06f1189353f4479bad8bd8bed5379adf66f71afb` | `51adf18b832078a66d0df2ce9628fd5be5daef038162e246610e239060abd1c6` |

superseded (T05b, before G1 and G3): M8 blob `ac1f370baf1b6910db8c4606b0349805a07bf76c`, LF SHA256 `6650d40d6eed3b4e76d3396f9c3ddf5440ab7ee26f942b499b9f3b23433ab242`.

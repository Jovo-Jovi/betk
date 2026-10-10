# AUDIT - authored P11M3 (T10)

Audited text: `docs/03-database/rehearsal/staging-text/P11M3.sql`. T10 authored it. It is not applied. No `apply_migration`. No staging write.

Sources: `PHASE_11_CHECKOUT.md` section 5 (P11M3, R-CHANNEL, G1, REG-104), the flagged expansion (planning chat, 2026-10-10), and the live reads below on 2026-10-10. Read-only. `project-0-BETK-supabase-betk`.

Live `betk.enforce_order_transition()`: `pg_get_functiondef` md5 `235f515602bc1531f3a3f44a24515ab8`, length 4036, `prosecdef` true, `proconfig` `search_path=betk, public`, ACL `{postgres=X/postgres}`. Line numbers for that function below are that definition.

Live `betk.restore_stock_on_cancel()`: `pg_get_functiondef` md5 `037aacbdb3820d1f98dd259993f16593`, `prosecdef` true, `proconfig` `search_path=betk, public`, ACL `{postgres=X/postgres}`. Line numbers for that function below are that definition.

Live `pg_cron`: `extversion` `1.6.4`, schema `pg_catalog`. `cron.schedule(job_name text, schedule text, command text)` is C symbol `cron_schedule_named`. Unique index `jobname_username_uniq` is `ON cron.job USING btree (jobname, username)`.

`betk.order_status` label `pending` is `pg_enum` sort 1. `cancelled` is sort 6. `betk.cancelled_by_type` label `system` is sort 4. `betk.notification_channel` label `sms` is sort 2. `master_orders.betk_ref` is `varchar(25)` NOT NULL. `master_orders.payment_deadline` is nullable. `master_orders.buyer_id` is `uuid` NOT NULL. `notifications.type` is `varchar(50)`. `notifications.channel` is `notification_channel`.

Ledger: `supabase_migrations.schema_migrations` count 44, last `20261010072302`. P11M3 is not a 45th row. P11M3 LF md5 `5cdb07019ea574834284218465530453`, 3697 bytes, no CR, ends LF, ASCII-only, no BOM.

Verdicts: **MATCH** (the expression or the code string equals the cited live text, apart from a name only where a pair says so), **BROADER** (allows more), **NARROWER** (allows less than the live privilege), **AUTHORED** (not a copy of a fenced block; basis stated), **MISMATCH** (contradicts the expansion or the cited live text). A FINDING is a BROADER security row with no closer. A GRANT is never cited as the closer of a BROADER table privilege.

**Zero MISMATCH. Zero BROADER. Zero FINDING.**

The function name is `betk.sweep_expired_payment_windows()`. **AUTHORED.** No live function has that name. The job name is `sweep-expired-payment-windows`. **AUTHORED.** It is not one of the six names in pack section 5.

## Shape (flagged expansion, 2026-10-10)

| # | Point | Verdict |
|---|---|---|
| 1 | Candidates: `payment_deadline IS NOT NULL` and `payment_deadline < now()` and `proof_path IS NULL`, plus one child in `pending`, ordered by `payment_deadline` ascending, `LIMIT 100` | AUTHORED |
| 2 | `pending` is the live `betk.order_status` label | MATCH |
| 3 | `FOR UPDATE OF m SKIP LOCKED`, then re-check `proof_path IS NULL` and `payment_deadline < now()` on the locked row. A master whose proof arrived is left untouched | AUTHORED |
| 4 | A null `payment_deadline` is never selected | AUTHORED |
| 5 | Carry-forward: Phase 12's proof write takes the same master row lock. Recorded in pack section 3. This file does not change the proof trigger | AUTHORED |
| 6 | Each pending child is updated to `cancelled`. `cancelled_by` `system` is the no-JWT branch, live lines 48-52, stamp on line 52 | AUTHORED |
| 7 | This file writes no stock, no `cart_items`, and no escalation column | MATCH |
| 8 | A child whose status is not `pending` is outside the `UPDATE` | MATCH |
| 9 | One `notifications` row per swept master: the buyer's `user_id`, channel `sms`, type `payment_window_expired`, `data` keys `master_order_id` and `betk_ref` | AUTHORED |
| 10 | The insert is in the same function as the cancel, after it, with `NOT EXISTS` on (`user_id`, `type`, `data->>'master_order_id'`) | AUTHORED |
| 11 | `body` follows `20260622083154_cron.sql` lines 80-86 | MATCH |
| 12 | `SECURITY DEFINER` and `SET search_path TO 'betk', 'public'` | MATCH |
| 13 | `REVOKE EXECUTE` from `PUBLIC`, `anon`, and `authenticated` | AUTHORED |
| 14 | One `cron.schedule`, fixed name, `* * * * *`, command only calls the function. A second run of that call does not insert a second job | AUTHORED |
| 15 | No new table, column, or enum member. No change to `checkout_from_cart`, the preview, `enforce_order_transition`, or `restore_stock_on_cancel` | MATCH |

## 1. Selection

File lines 44-58.

```
    SELECT m.id
    FROM betk.master_orders AS m
    WHERE m.payment_deadline IS NOT NULL
      AND m.payment_deadline < now()
      AND m.proof_path IS NULL
      AND EXISTS (
        SELECT 1
        FROM betk.seller_orders AS s
        WHERE s.master_order_id = m.id
          AND s.status = 'pending'::betk.order_status
      )
    ORDER BY m.payment_deadline ASC
    LIMIT 100
    FOR UPDATE OF m SKIP LOCKED
```

**AUTHORED.** The expansion is the predicate. Pack section 5 said "at or before `now()`". This file follows the expansion's `payment_deadline < now()`. `now()` is the transaction timestamp, the same value the transition reads.

The transition's system branch (live lines 48-51) requires `v_proof IS NULL`, `v_deadline IS NOT NULL`, and `now() >= v_deadline`. A row this query returns has `proof_path` null, a non-null deadline, and `deadline < now()`, so `now() >= deadline` holds for that same `now()`. A deadline equal to `now()` is not selected. That is the expansion.

`LIMIT 100` is in the SQL. The order is `payment_deadline ASC`. `SKIP LOCKED` can pass a locked earlier deadline and lock a later one inside that 100. The order among the rows it locks is still ascending.

The child status literal is `'pending'::betk.order_status`. Live `pg_enum` label `pending`, sort 1. **MATCH.**

## 2. Lock, then re-check

The candidate query locks `master_orders` (`FOR UPDATE OF m`). It does not lock `seller_orders`. File lines 60-69 re-read the locked row:

```
    WHERE m.id = v_master_id
      AND m.proof_path IS NULL
      AND m.payment_deadline IS NOT NULL
      AND m.payment_deadline < now();
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
```

**AUTHORED.** `NOT FOUND` continues before the `UPDATE` and before the insert. A master whose proof is set, or whose deadline is null, or whose deadline is not yet before `now()`, is not cancelled and gets no notification. The master row is not updated. The lock is the only touch, and it ends with the transaction.

`payment_deadline IS NOT NULL` is in that re-check as well as in the candidate `WHERE`. A legacy null deadline is not selected. **AUTHORED.** The transition already requires `v_deadline IS NOT NULL` (live line 50). This file does not widen that.

## 3. Carry-forward

Phase 12's proof write must take `FOR UPDATE` on the same `betk.master_orders` row before it writes `proof_path`. This sweeper uses `FOR UPDATE SKIP LOCKED`, so a row another transaction already holds is skipped for this run. After that other transaction commits a proof, a later run sees `proof_path` and leaves the master untouched. An upload that waits on `FOR UPDATE` cannot change `proof_path` while this function holds the row.

Recorded in `PHASE_11_CHECKOUT.md` section 3, Carry-forwards, "Phase 12 proof lock (from T10)". **AUTHORED.**

The live proof guard stays `trg_enforce_master_proof_update` / `betk.enforce_master_proof_update()` (`20261003082041_v2_08_functions.sql` lines 656-706). Its ACL is `{postgres=X/postgres}`. This file does not `CREATE`, `ALTER`, or `DROP` that function. **MATCH** with row 15.

## 4. Cancellation

File lines 71-74:

```
    UPDATE betk.seller_orders AS s
    SET status = 'cancelled'::betk.order_status
    WHERE s.master_order_id = v_master_id
      AND s.status = 'pending'::betk.order_status;
```

**AUTHORED.** The `SET` list is `status` only. `cancelled_by` is not assigned. The trigger stamps it.

Live lines 48-52:

```
    ELSIF auth.uid() IS NULL
          AND v_proof IS NULL
          AND v_deadline IS NOT NULL
          AND now() >= v_deadline THEN
      NEW.cancelled_by := 'system';
```

The stamp is line 52. `cancelled_by_type` label `system` is live. A cron run has no JWT, so `auth.uid()` is null and this branch is the one that matches a row the re-check passed. The file does not replace the function. **The branch text is the live definition. This file does not copy it.**

`WHERE s.status = 'pending'` leaves every other status unchanged. **MATCH.**

`GET DIAGNOSTICS` (file lines 76-79) continues when the update count is 0, so a master with no remaining pending child is not notified.

The `UPDATE` does not assign `escalated_at`, `escalation_reason`, or `escalation_note`. Live lines 24-31 raise `BETK_ESCALATION_ACTOR` only when one of those three is distinct from `OLD`. They are not distinct here. REG-104 stays Phase 13. **MATCH** with row 7.

This file has no `INSERT` or `UPDATE` of `betk.listings`, `betk.cart_items`, or `betk.order_status_history`. **MATCH.**

Stock and cart come from the existing trigger `trg_restore_stock_on_cancel` (`AFTER UPDATE OF status`). This file does not replace `restore_stock_on_cancel`. Live line 20 adds `stock_qty`. Live line 35 limits that update to `l.stock_qty IS NOT NULL`. Live lines 37-43 insert the fixed cart row (`inquiry_id IS NULL`) at `order_items.unit_price`. Live lines 45-53 insert the custom cart row only when `q.quote_expires_at > now()` (line 53). That is REG-82 (`BETK_ERD.md` section 3.3). The sweeper does not write those rows itself.

The only live `betk` function whose `prosrc` inserts `order_status_history` is `checkout_from_cart` (read 2026-10-10). A sweep does not add a history row. Checkout's creation insert is the history row F-HISTORY names. T11's note says not to require a new history row from the sweep.

## 5. Notification

File lines 81-94. One `INSERT` per master, after that master's `UPDATE`, inside the same function. There is no `COMMIT` between them. The cron command is one `SELECT` of the function, so the cancel and the insert commit or roll back together.

Columns are `(user_id, type, channel, body, data)`. That list is `20260622083154_cron.sql` lines 80-81. **MATCH.**

`user_id` is `m.buyer_id` from the locked re-check (file line 60). Channel literal `'sms'` is the live enum label (sort 2) and the cron literal (line 84). Type `'payment_window_expired'` is `varchar(50)` (22 characters). No enum member is added. R-CHANNEL. **AUTHORED.**

`data` is `jsonb_build_object('master_order_id', v_master_id, 'betk_ref', v_ref)`. The cron insert uses `jsonb_build_object` (line 86). The keys are the expansion's. **AUTHORED.**

`body` is `'BETK Alert: Order #' || v_ref || ' payment window expired.'`. The cron body (line 85) is `'BETK Alert: Dispute #' || d.id || ' SLA breaches in 1 hour.'`. The shared convention is the column list, the `'sms'` literal, the `'BETK Alert:'` prefix, `'#'` plus the identifier, and `jsonb_build_object`. **MATCH** for that convention. The order sentence is the payment-window text. `betk_ref` is NOT NULL, so the concatenation stays non-null. In-app rendering by type is the notifications phase (Phase 17). This file does not localize `body`.

`NOT EXISTS` (file lines 88-93) requires the same `user_id`, the same `type`, and `data->>'master_order_id'` equal to `v_master_id::text`. A later run that reached this insert would add no second row. The candidate query also requires a pending child, so a master whose children are already `cancelled` is not selected again. **AUTHORED.**

`title` is omitted. It is nullable (`20260622083013_boosts_admin_analytics.sql` line 63). The cron insert omits it too.

## 6. Security and schedule

File lines 32-36:

```
CREATE OR REPLACE FUNCTION betk.sweep_expired_payment_windows()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'betk', 'public'
```

Live `enforce_order_transition` lines 4-5 are `SECURITY DEFINER` and `SET search_path TO 'betk', 'public'`. **MATCH.** The function is `VOLATILE` (the default). It is not `STABLE`.

File line 99:

```
REVOKE EXECUTE ON FUNCTION betk.sweep_expired_payment_windows() FROM PUBLIC, anon, authenticated;
```

**AUTHORED.** The same revoke shape is `20261003082041_v2_08_functions.sql` line 497, on `restore_stock_on_cancel`. There is no default function ACL on schema `betk` (`pg_default_acl` for `defaclobjtype = 'f'` has no `betk` row). The new function's default grant is `EXECUTE` to `PUBLIC`. This revoke removes it. The measured ACL of `restore_stock_on_cancel` and of `enforce_order_transition` after that shape is `{postgres=X/postgres}`. This function is not applied, so that ACL is the sibling's measured result, not a new measurement. `anon` and `authenticated` are in the revoke list. T11 asserts `42501` for both.

File lines 101-105:

```
SELECT cron.schedule(
  'sweep-expired-payment-windows',
  '* * * * *',
  $$SELECT betk.sweep_expired_payment_windows()$$
);
```

**AUTHORED.** One call. The command is only `SELECT betk.sweep_expired_payment_windows()`. The schedule string is `* * * * *`.

pg_cron 1.6.4 treats schedule-by-name as an update of the existing job. The v1.6.4 README schedules `nightly-vacuum` at `0 10 * * *` and the returned job id is 43, then schedules `nightly-vacuum` again at `0 3 * * *` and the returned job id is still 43. The live unique index `jobname_username_uniq` is on `(jobname, username)`. `20260716130533_reschedule_daily_cron_utc.sql` lines 27-28 record the same fact: "cron.schedule upserts by name". This file does not call `cron.unschedule`. Re-running the `cron.schedule` call updates that one `(jobname, username)` row. It does not insert a second job.

## 7. Existing objects

Statements in the file:

| Line | Statement |
|---|---|
| 32 | `CREATE OR REPLACE FUNCTION betk.sweep_expired_payment_windows()` |
| 99 | `REVOKE EXECUTE` on that function from `PUBLIC, anon, authenticated` |
| 101 | `SELECT cron.schedule(...)` |

No `CREATE` or `REPLACE` of `checkout_from_cart`, `checkout_delivery_preview`, `enforce_order_transition`, or `restore_stock_on_cancel`. No `ALTER`, `DROP`, policy, trigger, table grant, or `UPDATE` of `admin_settings`. No new table. No new column. No new enum member. **MATCH.**

F-SWEEP-STAGING stays a STOP in T12. This task does not inventory masters and does not apply.

## Counts by verdict

MATCH, one row each:

1. `pending` label
2. Non-pending children stay out of the `UPDATE`
3. No stock, `cart_items`, or escalation assignment in this file
4. Notification column list and the `'BETK Alert:'` convention (`20260622083154_cron.sql` lines 80-86)
5. `SECURITY DEFINER` and `search_path`
6. No `CREATE`, `ALTER`, or `DROP` of an existing object (section 7)
7. No policy statement (section 7)

AUTHORED, one row each:

1. Selection predicate, order, and `LIMIT 100`
2. Lock and re-check
3. Null deadline excluded
4. Carry-forward recorded in pack section 3
5. Status update to `cancelled` (the stamp stays live line 52)
6. Notification user, channel, type, and `data` keys
7. Same function, `NOT EXISTS` guard
8. `REVOKE EXECUTE`
9. `cron.schedule` name, `* * * * *`, and schedule-by-name

| Part | MATCH | BROADER | NARROWER | AUTHORED | MISMATCH | FINDING |
|---|---:|---:|---:|---:|---:|---:|
| a Grants | 0 | 0 | 0 | 1 | 0 | 0 |
| b Policies | 1 | 0 | 0 | 0 | 0 | 0 |
| c Functions and cron | 5 | 0 | 0 | 8 | 0 | 0 |
| d Untouched objects | 1 | 0 | 0 | 0 | 0 | 0 |

Row b is section 7: no policy statement. Row d is that same section's untouched-object row. The five function MATCH rows are the label, the non-pending `WHERE`, the absent stock and cart and escalation writes, the notification convention, and the definer header.

**Zero MISMATCH. Zero BROADER. Zero FINDING.**

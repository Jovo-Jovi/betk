# AUDIT - authored P11M2 (T07)

Audited text: `docs/03-database/rehearsal/staging-text/P11M2.sql`. T07 authored it. It is not applied. No `apply_migration`. No staging write. The reads were `pg_get_functiondef`, `pg_proc`, `pg_policy`, `information_schema.columns`, and `list_migrations`.

Sources: `PHASE_11_CHECKOUT.md` section 5 (R-DELIVERY, R-K03), the flagged expansion (planning chat, 2026-10-09), and those live reads on 2026-10-09.

Live `betk.checkout_from_cart(uuid)`: `pg_get_functiondef` md5 `fb7b8b6965a3988be4a57ef8112f2130`, length 10594, `prosecdef` false, `provolatile` `v`, `proconfig` `search_path=betk, public`, owner `postgres`, ACL `{postgres=X/postgres,authenticated=X/postgres}`. `pg_get_functiondef` omits `SECURITY INVOKER` because that is the default. Line numbers below are that definition.

`list_migrations`: 43, last `20261009164602` / `v2_11_checkout`. Local `supabase/migrations` is 43 files, same last version. P11M2 is not a 44th row. P11M2 LF md5 `30aa5d516d51d6a23370ff464ea731cd`, 4138 bytes, no CR, ends LF, ASCII-only, no BOM.

Verdicts: **MATCH** (the expression or the code string equals the cited live text, apart from a variable name only where a pair says so), **BROADER** (allows more), **NARROWER** (allows less than the live privilege), **AUTHORED** (not a copy of a fenced block; basis stated), **MISMATCH** (contradicts the expansion or the cited checkout text). A FINDING is a BROADER security row with no closer. A GRANT is never cited as the closer of a BROADER table privilege.

**Zero MISMATCH. Zero BROADER. Zero FINDING.**

The function name is `betk.checkout_delivery_preview(uuid)`. **AUTHORED.** No live function has that name. The five live `checkout_*` functions are `checkout_agreement_version`, `checkout_from_cart`, `checkout_payment_window_minutes`, `checkout_quote_multiplier`, and `checkout_refuse_inactive_store`.

## Shape (flagged expansion)

| # | Point | Verdict |
|---|---|---|
| 1 | SECURITY INVOKER, STABLE, `search_path` as in P11M1, EXECUTE for `authenticated` only | AUTHORED |
| 2 | Address id in, one `numeric(10,2)` combined total out, no per-seller fee | AUTHORED |
| 3 | Refusal codes are checkout's, in the expansion's sequence | AUTHORED |
| 4 | Weight, origin, destination, band, and fee sum | MATCH |
| 5 | No change to `checkout_from_cart` or any other existing object | MATCH |

## 1. Volatility, invoker, search_path, EXECUTE

| Piece | Preview | Source | Verdict | Note |
|---|---|---|---|---|
| SECURITY INVOKER | file lines 24-28. The header says `SECURITY INVOKER`. It does not say `SECURITY DEFINER` | Live `prosecdef` false | MATCH | Same invoker boundary as checkout. `stores_public` and `addr_self` still apply |
| STABLE | file line 27 | Live `provolatile` `v` | AUTHORED | The expansion requires STABLE so Postgres refuses INSERT, UPDATE, DELETE, and SELECT FOR UPDATE/SHARE in this body. Checkout stays volatile. This file does not change that |
| `search_path` | file line 29: `SET search_path TO 'betk', 'public'` | P11M1 `checkout_from_cart` header, and live `proconfig` `search_path=betk, public` | MATCH | Same SET text P11M1 stored |
| EXECUTE | file lines 139-140 | Helper statements in `20261009164602_v2_11_checkout.sql` lines 50-51. Live helper ACL `{postgres=X/postgres,authenticated=X/postgres}` | AUTHORED | `REVOKE EXECUTE ... FROM PUBLIC, anon` then `GRANT EXECUTE ... TO authenticated`. Not applied, so this ACL is the helper's measured result of those two statements, not a new measurement. anon and PUBLIC are revoked. No table GRANT |

The cart read (file lines 48-50) is checkout's `PERFORM` (live lines 85-87) without `FOR UPDATE` (live line 88). A STABLE body cannot take that lock. The exception string is still live line 90.

## 2. Signature (R-K03)

`checkout_delivery_preview(p_delivery_address_id uuid) RETURNS numeric(10,2)`.

The argument name and type are checkout's (`p_delivery_address_id uuid`). Checkout returns `uuid` (the master id). This function returns one `numeric(10,2)`. That is the type of `master_orders.combined_delivery_total` and of checkout's `v_fee_total` (live line 32). The returned value is `v_fee_total` (file line 135), which is the value checkout inserts into `combined_delivery_total` (live line 281).

There is no second OUT parameter, no `RETURNS TABLE`, and no `delivery_fee` column in the result. `v_fees` is a local array used only to add the fees. It is not returned. **AUTHORED.**

## 3. Refusals

Each code string below is the live `RAISE`. The sequence is the expansion's list, not the live sequence.

Live sequence of these codes, from `pg_get_functiondef`:

| Order | Live line | Code |
|---|---|---|
| 1 | 45 | `BETK_UNAUTHENTICATED` |
| (skipped) | 48-73 | Payment window, then REG-88 (`BETK_CHECKOUT_VERSION_UNCONFIGURED`, `BETK_CHECKOUT_ACCEPTANCE_REQUIRED`). Not in the preview |
| 2 | 82 | `BETK_ADDRESS_NOT_FOUND` |
| 3 | 90 | `BETK_CHECKOUT_EMPTY_CART` (after `FOR UPDATE` on line 88) |
| 4 | 110 | `BETK_CHECKOUT_LINE_UNRESOLVED` |
| 5 | 113 | `PERFORM betk.checkout_refuse_inactive_store()` |
| (skipped) | 131, 146, 157 | `BETK_CHECKOUT_QUOTE_EXPIRED`, `BETK_CHECKOUT_QUOTE_OUT_OF_BAND`, `BETK_CHECKOUT_OUT_OF_STOCK`. Not in the preview |
| 6 | 187 | `BETK_CHECKOUT_EMPTY_CART` again, when the store grouping is empty |
| 7 | 203 | `BETK_CHECKOUT_RATE_MISSING` |

The helper's own `pg_get_functiondef` (md5 `5e101a96723d1a7322875bc8f8e7e304`, length 479, `prosecdef` true) raises `BETK_CHECKOUT_STORE_INACTIVE` on line 16. Checkout does not inline that string. The preview does not inline it either. File line 64 is the same `PERFORM` as live line 113.

Preview sequence:

| Order | File line | Code | Live line of that string | Verdict |
|---|---|---|---|---|
| 1 | 45 | `BETK_UNAUTHENTICATED` | 45 | MATCH |
| 2 | 52 | `BETK_CHECKOUT_EMPTY_CART` | 90 | MATCH |
| 3 | 61 | `BETK_ADDRESS_NOT_FOUND` | 82 | MATCH |
| 4 | 64 | call `checkout_refuse_inactive_store` | 113 (raise is helper line 16) | MATCH |
| 5 | 83 | `BETK_CHECKOUT_LINE_UNRESOLVED` | 110 | MATCH |
| 6 | 109 | `BETK_CHECKOUT_EMPTY_CART` | 187 | MATCH |
| 7 | 125 | `BETK_CHECKOUT_RATE_MISSING` | 203 | MATCH |

The code strings and the `PERFORM` are MATCH. The sequence is **AUTHORED**: the expansion puts the empty-cart check before the address check, and the helper call before the unresolved-line check. Live checkout does the opposite for those two pairs.

When both faults are present, the first raise differs:

- Empty cart and a missing address: the preview raises `BETK_CHECKOUT_EMPTY_CART`. Checkout raises `BETK_ADDRESS_NOT_FOUND` (live line 82 is before line 90).
- An unresolved line on an inactive store: the preview raises `BETK_CHECKOUT_STORE_INACTIVE`. Checkout raises `BETK_CHECKOUT_LINE_UNRESOLVED` (live line 110 is before line 113).

The address predicate is live lines 79-80, copied at file lines 58-59: `a.id = p_delivery_address_id AND a.buyer_id = v_uid`. `addr_self` USING is `(buyer_id = auth.uid()) OR betk.is_admin()`. The function is INVOKER, so a non-admin caller does not see another buyer's address. The `buyer_id = v_uid` predicate is still there, so an admin who passes another buyer's address gets the same `BETK_ADDRESS_NOT_FOUND` checkout raises. The preview selects only `a.governorate` (file lines 55-56). Checkout also selects city, street, and notes (live lines 76-77) for the master snapshot. Those three are not the rate.

The unresolved predicate (file lines 66-81) is live lines 93-108, including `l.weight_g IS NOT NULL`, `l.deleted_at IS NULL`, and `l.status IN ('active', 'sold_out')`.

No `checkout_payment_window_minutes`, `checkout_quote_multiplier`, or `checkout_agreement_version`. No `stock_qty`. No `quote_expires_at`. The `LEFT JOIN betk.inquiries` at file line 97 is the weight query's join (live line 173). It does not test the quote.

## 4. Arithmetic identity

MATCH only when the two expressions are the same text apart from variable names. These four use the same variable names as well.

### Per-store weight

Checkout live lines 167-175:

```
      SELECT
        l.store_id,
        sum(l.weight_g * c.quantity)::integer AS weight_g,
        sum(c.quantity * c.unit_price) AS subtotal
      FROM betk.cart_items AS c
      JOIN betk.listings AS l ON l.id = c.listing_id
      LEFT JOIN betk.inquiries AS q ON q.id = c.inquiry_id
      WHERE c.buyer_id = v_uid
      GROUP BY l.store_id
```

Preview file lines 91-99: the same nine lines. **MATCH.**

`listings.weight_g` is `integer`. The cast to `integer` is checkout's. `sum(c.quantity * c.unit_price) AS subtotal` is in that query so the text matches. The preview does not append `r.subtotal` and does not return it. It is not a fee.

### Origin and destination

Checkout live lines 197-198:

```
      ON cr.origin_governorate = s.governorate
     AND cr.destination_governorate = v_gov
```

Preview file lines 119-120: the same two lines. **MATCH.**

Origin is `s.governorate` (`stores.governorate`, `varchar(50)`). Destination is `v_gov`, assigned from `a.governorate` (`addresses.governorate`, `varchar(50)`). Checkout's assignment is live line 76 (`a.governorate` into `v_gov`). The preview's is file line 55. Both governorate columns and `courier_rates.origin_governorate` / `destination_governorate` are `varchar(50)`.

### Band predicate

Checkout live lines 199-200:

```
     AND cr.weight_min_g <= v_weights[i]
     AND (cr.weight_max_g IS NULL OR v_weights[i] < cr.weight_max_g)
```

Preview file lines 121-122: the same two lines. **MATCH.**

`weight_min_g` and `weight_max_g` are `integer`. The lower edge is inclusive (`<=`). The upper edge is exclusive (`<`). `weight_max_g IS NULL` is the open upper band. A weight equal to `weight_max_g` is outside that band. A weight equal to `weight_min_g` is inside it. The preview adds no `ORDER BY` and no `LIMIT` on this select. Checkout's select (live lines 193-201) is file lines 115-123, including `SELECT cr.id, cr.fee_egp INTO v_one_rate, v_one_fee` and `WHERE s.id = v_stores[i]`.

### Fee summed into the combined total

Checkout live lines 206, 212, and 216:

```
    v_fees := v_fees || v_one_fee;
  v_fee_total := 0;
    v_fee_total := v_fee_total + v_fees[i];
```

Preview file lines 127, 130, and 132: the same three assignments. **MATCH.**

`v_one_fee` is `cr.fee_egp` (`numeric(10,2)`). `v_fee_total` is `numeric(10,2)`, the same declaration as checkout (live line 32). The return is that total. Checkout's loop also adds `v_child` and `v_floor` (live lines 215 and 217). Those lines are not the delivery total. They are not in the preview.

## 5. Existing objects

Statements in the file:

| Line | Statement |
|---|---|
| 24 | `CREATE OR REPLACE FUNCTION betk.checkout_delivery_preview(uuid)` |
| 139 | `REVOKE EXECUTE` on that function from `PUBLIC, anon` |
| 140 | `GRANT EXECUTE` on that function to `authenticated` |

No `CREATE` or `REPLACE` of `checkout_from_cart`. No `CREATE` or `REPLACE` of `checkout_refuse_inactive_store`. No `ALTER`, `DROP`, policy, trigger, grant on a table, or `UPDATE` of `admin_settings`. No `INSERT`, `UPDATE`, or `DELETE`. No new table. **MATCH.**


## Counts by verdict

c MATCH, one row each:

1. SECURITY INVOKER
2. `search_path`
3. `BETK_UNAUTHENTICATED`
4. `BETK_CHECKOUT_EMPTY_CART` (file lines 52 and 109 are one code)
5. `BETK_ADDRESS_NOT_FOUND`
6. `PERFORM betk.checkout_refuse_inactive_store()`
7. `BETK_CHECKOUT_LINE_UNRESOLVED`
8. `BETK_CHECKOUT_RATE_MISSING`
9. Per-store weight
10. Origin and destination
11. Band predicate
12. Fee sum

c AUTHORED: STABLE, the signature (name and `numeric(10,2)`), and the refusal sequence. a AUTHORED: the `REVOKE` and the `GRANT`. b MATCH: no policy statement. d MATCH: section 5, no existing object is named by a `CREATE`, `ALTER`, or `DROP`.

| Part | MATCH | BROADER | NARROWER | AUTHORED | MISMATCH | FINDING |
|---|---:|---:|---:|---:|---:|---:|
| a Grants | 0 | 0 | 0 | 2 | 0 | 0 |
| b Policies | 1 | 0 | 0 | 0 | 0 | 0 |
| c Functions | 12 | 0 | 0 | 3 | 0 | 0 |
| d Untouched objects | 1 | 0 | 0 | 0 | 0 | 0 |

**Zero MISMATCH. Zero BROADER. Zero FINDING.**

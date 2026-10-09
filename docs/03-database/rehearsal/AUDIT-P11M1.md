# AUDIT — authored P11M1 (T03)

Audited text: `docs/03-database/rehearsal/staging-text/P11M1.sql`. T03 authored it. It is not applied. No `apply_migration`. No staging write.

Sources: `PHASE_11_CHECKOUT.md` §4 and §5 (REG-113, REG-115, D-81, REG-88, R-STORE-CODE), the flagged expansion (planning chat, 2026-10-09), and live reads on 2026-10-09 (`pg_get_functiondef`, `pg_proc`, `pg_policy`, `pg_attribute`, `pg_enum`, `admin_settings`, `list_migrations`).

Live `betk.checkout_from_cart(uuid)`: `pg_get_functiondef` md5 `0df219d46dc1adb5503ee1388fbe8de3`, length 9995, `prosecdef` false, `proconfig` `search_path=betk, public`, owner `postgres`, ACL `{postgres=X/postgres,authenticated=X/postgres}`. `pg_get_functiondef` omits `SECURITY INVOKER` because that is the default. The replaced statement keeps that header. It does not say `SECURITY DEFINER`.

`list_migrations`: 42, last `20261006100204` / `v2_10_cart_quote`. Local `supabase/migrations` is 42 files, same last version. P11M1 LF md5 `5512f2a66381d3d82fbaaa1099f1d2f0`, 12831 bytes. `.github/workflows/p10-db.yml` is not edited. T04 writes the P11M1 proof.

Verdicts: **MATCH** (equals the cited text or the cited ACL shape), **BROADER** (allows more), **NARROWER** (allows less than the live privilege), **AUTHORED** (not a copy of a fenced block; basis stated), **MISMATCH** (contradicts explicit text, or a function-body hunk that is not one of the four canonical changes). A FINDING is a BROADER security row with no closer. A GRANT is never cited as the closer of a BROADER table privilege.

**Zero MISMATCH. Zero BROADER. Zero FINDING.**

## Function-body diff

The diff is unified, with zero lines of context, of the live `pg_get_functiondef` against the `checkout_from_cart` statement in the file. Both sides omit the SQL statement semicolon. The file ends that statement with `$function$;`, which `pg_get_functiondef` does not include. That semicolon is not a hunk. Diff line numbers are the function definition. In the file, that definition starts at line 53.

Eight hunks. Each one maps to exactly one of REG-113, REG-115, D-81, REG-88.

| Hunk | Canonical change | What the hunk does |
|---|---|---|
| 1 | REG-88 | Replaces the "read, do not branch" comment |
| 2 | REG-88 | Empty version raises `BETK_CHECKOUT_VERSION_UNCONFIGURED`. A missing acceptance row raises `BETK_CHECKOUT_ACCEPTANCE_REQUIRED` |
| 3 | REG-115 | Calls `checkout_refuse_inactive_store` before any insert |
| 4 | REG-113 | The grouped subtotal is `c.quantity * c.unit_price` |
| 5 | D-81 | `ORDER BY g.store_id ASC` on the grouping query |
| 6 | D-81 | `display_ref` is `v_ref \|\| '-' \|\| u.n::text`. The `betk_ref` NULL above it is not in the hunk |
| 7 | D-81 | `unnest(...) WITH ORDINALITY` supplies that 1-based `n` |
| 8 | REG-113 | `order_items.unit_price` and its subtotal are `c.unit_price` |

```
--- pg_get_functiondef checkout_from_cart
+++ P11M1 checkout_from_cart
@@ -51 +51 @@
-  -- FLAG-REG-88. Read. Do not branch.
+  -- REG-88. Gate buyer_terms and return_policy. The other two are read and not required.
@@ -55,0 +56,19 @@
+  IF v_terms IS NULL OR btrim(v_terms) = ''
+     OR v_return_policy IS NULL OR btrim(v_return_policy) = '' THEN
+    RAISE EXCEPTION 'BETK_CHECKOUT_VERSION_UNCONFIGURED';
+  END IF;
+  IF NOT EXISTS (
+    SELECT 1
+    FROM betk.agreement_acceptances AS aa
+    WHERE aa.user_id = v_uid
+      AND aa.document = 'buyer_terms'
+      AND aa.version_label = v_terms
+  ) OR NOT EXISTS (
+    SELECT 1
+    FROM betk.agreement_acceptances AS aa
+    WHERE aa.user_id = v_uid
+      AND aa.document = 'return_policy'
+      AND aa.version_label = v_return_policy
+  ) THEN
+    RAISE EXCEPTION 'BETK_CHECKOUT_ACCEPTANCE_REQUIRED';
+  END IF;
@@ -93,0 +113,2 @@
+  PERFORM betk.checkout_refuse_inactive_store();
+
@@ -149,6 +170 @@
-        sum(
-          c.quantity * CASE
-            WHEN c.is_custom THEN q.quoted_price
-            ELSE l.price
-          END
-        ) AS subtotal
+        sum(c.quantity * c.unit_price) AS subtotal
@@ -160,0 +177 @@
+    ORDER BY g.store_id ASC
@@ -305 +322 @@
-    NULL,
+    v_ref || '-' || u.n::text,
@@ -308 +325 @@
-    AS u(id, store_id, fee, subtotal, child_total, rate_id);
+    WITH ORDINALITY AS u(id, store_id, fee, subtotal, child_total, rate_id, n);
@@ -326,2 +343,2 @@
-    CASE WHEN c.is_custom THEN q.quoted_price ELSE l.price END,
-    c.quantity * CASE WHEN c.is_custom THEN q.quoted_price ELSE l.price END,
+    c.unit_price,
+    c.quantity * c.unit_price,
```

Hunks 6 and 7 are one D-81 edit split by the unchanged `u.rate_id` and `FROM unnest` lines. Zero context keeps the REG-113 subtotal hunk apart from the D-81 `ORDER BY` hunk. A three-line context would put those two changes in one hunk.

`checkout_refuse_inactive_store` is not in this diff. It is the next section.

## Counts by verdict

| Part | MATCH | BROADER | NARROWER | AUTHORED | MISMATCH | FINDING |
|---|---:|---:|---:|---:|---:|---:|
| a Grants | 1 | 0 | 0 | 2 | 0 | 0 |
| b Policies | 1 | 0 | 0 | 0 | 0 | 0 |
| c Functions | 8 | 0 | 0 | 2 | 0 | 0 |

## a. Grants

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `checkout_from_cart(uuid)` EXECUTE | not in the file | Live ACL `{postgres=X/postgres,authenticated=X/postgres}`. `20261003075902_v2_08_grants_and_policies.sql` line 395 grants `authenticated`. The earlier revoke removed PUBLIC, anon, and authenticated, and this grant put `authenticated` back | MATCH | `CREATE OR REPLACE` does not change ownership or permissions. No `GRANT` or `REVOKE` names this function. anon and PUBLIC stay without EXECUTE |
| `REVOKE EXECUTE` on `checkout_refuse_inactive_store()` from PUBLIC, anon | the statement after the helper | Same shape as `checkout_agreement_version` (`20261003082041_v2_08_functions.sql` lines 116–117). Live ACL of that reader is `{postgres=X/postgres,authenticated=X/postgres}` | AUTHORED | A new function is executable by PUBLIC until the revoke. This is not a table GRANT |
| `GRANT EXECUTE` on `checkout_refuse_inactive_store()` to `authenticated` | the next statement | The invoker checkout has to call it. Same reader shape | AUTHORED | EXECUTE only. It does not grant SELECT, INSERT, UPDATE, or DELETE on `stores` or any other table. It does not close a table privilege |

## b. Policies

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| No `CREATE` / `ALTER` / `DROP POLICY` | the file has none | Live policies, SELECT 2026-10-09 | MATCH | Untouched. `stores_public` SELECT is `(status = 'active') OR (seller_id = auth.uid()) OR betk.is_admin()`. `agreement_acceptances_select` is own row or admin. `agreement_acceptances_insert` WITH CHECK is `user_id = auth.uid()`. There is no UPDATE or DELETE policy on `agreement_acceptances`. `listings_public` still shows `active` and `sold_out` and does not test store status |

## c. Functions

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `checkout_from_cart` header | same `CREATE` attributes as `pg_get_functiondef` | Live `prosecdef` false | MATCH | No `SECURITY DEFINER`. Stays SECURITY INVOKER. `search_path` stays `betk, public` |
| `checkout_from_cart` body, four deltas | the eight hunks | REG-113, REG-115, D-81, REG-88, and the flagged expansion | AUTHORED | See the hunk table. No other hunk |
| `FOR UPDATE` on the buyer's `cart_items` | unchanged lines | R-LOCK. Live body | MATCH | Still `PERFORM 1 FROM betk.cart_items WHERE buyer_id = v_uid FOR UPDATE`, then `BETK_CHECKOUT_EMPTY_CART` |
| Master `betk_ref` and retry | unchanged lines | R-O02. Format `BETK-YYYYMMDD-XXXX`, five attempts, `BETK_REF_RETRY_EXHAUSTED` | MATCH | `display_ref` uses `v_ref` from the insert that exited the retry loop |
| Custom-line expiry and band | unchanged lines | Live checks. Codes `BETK_CHECKOUT_QUOTE_EXPIRED` and `BETK_CHECKOUT_QUOTE_OUT_OF_BAND` | MATCH | Still on the inquiry row: `quoted_price`, `quote_expires_at`, and `quoted_price` against `l.price * v_mult`. They are gates, not the charge |
| `payment_window_minutes` | unchanged call | `checkout_payment_window_minutes` raises `BETK_PAYMENT_WINDOW_UNCONFIGURED` when the key is null or not a positive integer | MATCH | Still the first settings read, before the version gate. Live value length 0. This file does not write it |
| Rate lookup | unchanged loop | Store `governorate` to the address `governorate`, weight band, else `BETK_CHECKOUT_RATE_MISSING` | MATCH | The store-status reader runs before this loop. The loop text is the live text |
| Stock decrement | not in the file | `decrement_stock_on_confirm` on `order_items` INSERT, listing `FOR UPDATE`, `BETK_CHECKOUT_OUT_OF_STOCK` | MATCH | The `order_items` INSERT still fires that trigger. This file does not add a listing lock. The early `stock_qty < quantity` check is unchanged |
| `order_status_history` insert | unchanged | F-HISTORY. Pending, changed by the buyer, notes `order created` | MATCH | Still inside the function. A committed checkout still appends that row. T04 rolls back and does not commit it |
| Child `betk_ref` | the NULL that hunk 6 does not touch | ERD §6.1. Column `varchar(25)` nullable | MATCH | The insert still writes NULL |
| No phone predicate | no `phone_number` | REG-79 B | MATCH | `master_orders_phone_gate` stays the authority |
| No settings write | no `UPDATE` of `admin_settings` | Pack: no settings write. T06 writes the three keys | MATCH | Reads go through the existing definer readers |
| No escalation write | no `escalated_at`, `escalation_reason`, or `escalation_note` | REG-104. G1 | MATCH | Not in the live body and not added |
| No new table | no `CREATE TABLE` | OD-20 = 51 | MATCH | No new column |
| `checkout_refuse_inactive_store()` | SECURITY DEFINER, `search_path` pinned, returns void | REG-115. R-STORE-CODE. Live `stores_public` | AUTHORED | See below |

## REG-115 reader

`stores.status` is `betk.store_status` NOT NULL. Live labels: `pending`, `active`, `suspended`. `listings.store_id` is NOT NULL.

`checkout_from_cart` stays SECURITY INVOKER. Under `stores_public`, a buyer who is not the seller and not admin does not see a pending or suspended store. An `EXISTS` on `stores.status` inside the invoker body would not see that row, and the unchanged rate lookup would then raise `BETK_CHECKOUT_RATE_MISSING`. The required exception is `BETK_CHECKOUT_STORE_INACTIVE`.

The helper runs as the owner, so it can read `stores.status`. It selects only the caller's cart (`buyer_id = auth.uid()`, the JWT claim, not `current_user`). `status <> 'active'` raises `BETK_CHECKOUT_STORE_INACTIVE`. It returns void. It has no INSERT, UPDATE, or DELETE. The call is after the cart `FOR UPDATE` and the listing gate, and before the quote checks and every insert. A raise writes nothing.

A direct EXECUTE sees the same cart and either raises that code or returns. It does not return a store row and it does not take a store id. The buyer's SELECT on `stores` stays `stores_public`. This is not a table GRANT and not a BROADER table privilege.

## REG-113 charge

`cart_items.unit_price` is `numeric(10,2)` NOT NULL. Fixed and custom lines both use it: the grouped subtotal, and `order_items.unit_price` plus `order_items.subtotal`. The grouping query still left-joins `inquiries`. That join line is unchanged, so it is not a hunk. It is 1:1 on `inquiries.id` and it is not the charge. Quote expiry and the band stay on the inquiry row.

## D-81 `display_ref`

The grouping query orders by `g.store_id` ascending. The parallel arrays are filled in that order. `unnest(...) WITH ORDINALITY` is 1-based in array order, so `n` is the 1-based position of `store_id`. `display_ref` is the `v_ref` of the master insert that succeeded, then `-`, then `n`. `display_ref` is `varchar(64)`. Child `betk_ref` stays NULL. The deposit ranking still orders by remainder, then `seller_order_id`. That query is unchanged.

## REG-88 gate

The four version reads stay. `seller_agreement` and `privacy` are read and not required. `buyer_terms` and `return_policy` are the gate.

`checkout_agreement_version` returns the raw `admin_settings.value`. Null or `btrim` empty raises `BETK_CHECKOUT_VERSION_UNCONFIGURED` and writes nothing. That is the same empty test as `isConfiguredVersionLabel` in `src/services/agreementVersions.ts` lines 76–79. Live values, read and not written: `agreement_buyer_terms_version` = `STAGING-DRAFT-1` (length 15), `agreement_return_policy_version` length 0, `agreement_seller_agreement_version` = `STAGING-DRAFT-1` (length 15), `agreement_privacy_version` length 0. On staging, `agreement_return_policy_version` stays empty until T06. Until then this gate fails closed once the payment window is configured. The payment-window read is still first, and that key is still empty, so today's checkout still raises `BETK_PAYMENT_WINDOW_UNCONFIGURED` before this gate.

A missing `agreement_acceptances` row for either current version raises `BETK_CHECKOUT_ACCEPTANCE_REQUIRED` and writes nothing. The comparison is `user_id`, `document`, and `version_label` equal to the raw version string. Live `agreement_document`: `buyer_terms`, `seller_agreement`, `return_policy`, `privacy`. `chk_agreement_acceptance_status` is `status = 'accepted'` (`20261001091538_v2_08_new_tables.sql` line 206), so the check does not add a status predicate. The function is INVOKER, and `agreement_acceptances_select` lets the buyer read their own row. The call is before the address read and before any insert.

This function does not insert an acceptance. Recording is the P15 panel (T15), through the existing write path:

- `completeBuyerSignup` inserts `agreement_acceptances` (`user_id`, `document` `buyer_terms`, `version_label` from `checkout_agreement_version`) in `src/services/agreementVersions.ts` lines 215–219. It writes only when `accepted` is true.
- `completeProfile` calls that function (`src/features/auth/actions/completeProfile.ts` lines 85–92).
- The row is allowed by `agreement_acceptances_insert`, WITH CHECK `user_id = auth.uid()` (live `pg_policy`; migration lines 215–217). Live table ACL is `authenticated=arwd/postgres`. This file does not change that ACL.
- `submitSellerApplication` inserts `seller_agreement` only (`src/features/seller-onboarding/actions/submitSellerApplication.ts` lines 183–187). That document is not in the checkout gate.
- T15 (`PHASE_11_CHECKOUT.md`) writes the checked documents, `{buyer_terms, return_policy}`, at the current version labels, or it does not call checkout. The database gate remains the authority.

## Untouched

Not in the file, and not changed by it:

- `checkout_from_cart` EXECUTE grant.
- `cart_items` column UPDATE on `updated_at` (R-LOCK). The `FOR UPDATE` stays.
- `stores_public` and every other policy.
- `decrement_stock_on_confirm`, `checkout_payment_window_minutes`, `checkout_quote_multiplier`, `checkout_agreement_version`.
- `admin_settings` values.
- `.github/workflows/p10-db.yml`.

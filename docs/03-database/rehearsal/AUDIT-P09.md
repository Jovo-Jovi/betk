# AUDIT — authored P09M1 (T02)

Audited text: `docs/03-database/rehearsal/staging-text/P09M1.sql`. T02 does not apply it. Sources: `PHASE_09_V2_SURFACES.md` §5, `BETK_ERD.md` §6.3 and §7, `BETK_V2_SCHEMA_DELTA_PLAN.md` §8.2.5, and live `pg_proc` / `pg_policy` / `pg_constraint` / `pg_enum` (SELECT 2026-10-03). Staging was not written. `schema_migrations` count 39, last `20261003082041`. No `apply_migration`. No `admin_settings` UPDATE.

Verdicts: **MATCH** (equals the cited text), **BROADER** (allows more), **NARROWER** (allows less), **AUTHORED** (not a copy of a fenced block; basis stated), **MISMATCH** (contradicts explicit ERD or plan text). A FINDING is a BROADER security row with no closer. A GRANT is never cited as the closer of a BROADER table privilege. This file contains no GRANT.

**Zero MISMATCH.** The stop does not fire.

## Counts by verdict

| Part | MATCH | BROADER | NARROWER | AUTHORED | MISMATCH | FINDING |
|---|---:|---:|---:|---:|---:|---:|
| a Grants | 4 | 0 | 0 | 0 | 0 | 0 |
| b Policies | 1 | 0 | 0 | 0 | 0 | 0 |
| c Functions and triggers | 2 | 0 | 0 | 4 | 0 | 0 |

No BROADER row. No table GRANT. No open FINDING.

## a. Grants

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `REVOKE EXECUTE` on `enforce_listing_publish()` | `P09M1.sql` after the function | M8 `enforce_store_category_cap` revoke | MATCH | PUBLIC, anon, authenticated. Not a table GRANT. DEFINER so the trigger can read admin-only settings keys. Direct call is not granted |
| `REVOKE EXECUTE` on `force_store_category_approved_at()` | same file, after that function | same M8 pattern | MATCH | Same three roles. Not a table GRANT |
| `submit_seller_application` (15 args) | `CREATE OR REPLACE` only | live ACL, SELECT 2026-10-03 | MATCH | No GRANT and no REVOKE. Signature unchanged, so the live ACL stays: `authenticated` EXECUTE true, `public` false, `anon` false. INVOKER (`prosecdef` false on the live row) |
| `resubmit_seller_application` (2 args) | `CREATE OR REPLACE` only | live ACL, same SELECT | MATCH | Same. `authenticated` true, `public` false, `anon` false |

`checkout_from_cart` is not granted or replaced here.

## b. Policies

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| No `CREATE` / `ALTER` / `DROP POLICY` | the file has none | live `listings_public`, `listings_seller`, `store_categories_insert`, `store_categories_update` (SELECT 2026-10-03) | MATCH | Untouched. `store_categories_insert` WITH CHECK is `store_id = my_store_id() OR is_admin()` and does not name `approved_at`. `store_categories_update` stays `is_admin()` on both expressions. The stamp trigger is not a policy and is not a GRANT |

## c. Functions and triggers

| Object | Kit | Source | Verdict | Note |
|---|---|---|---|---|
| `enforce_listing_publish` + `trg_enforce_listing_publish` | BEFORE INSERT OR UPDATE on `listings` | ERD §6.3 publish gate; pack §5 (b); plan §8.2.5 | AUTHORED | Active requires `type = product` (`BETK_LISTING_TYPE`), `price_type = fixed` and `price` not null (`BETK_PRICE_TYPE`), `prep_days` from 0 through `prep_cap_days` (`BETK_PREP_CAP`; empty or non-positive-integer cap is `BETK_PREP_CAP_UNCONFIGURED`), price inside both band keys (`BETK_PRICE_BAND`; either key empty, not a non-negative decimal, or min greater than max is `BETK_PRICE_BAND_UNCONFIGURED`), and `category_id` on an approved `store_categories` row for that store (`BETK_CATEGORY_NOT_APPROVED`). A row whose `category_id` or `subcategory_id` is slug `food-beverages` or a descendant (recursive `parent_id`; live children `food-herbs`, `food-homemade`, `food-pickles`, `food-sweets`) also requires a non-empty `food_requirements` label (`BETK_FOOD_REQUIREMENTS_UNCONFIGURED`) and one row of each of the four `doc_type` values `food_packaging`, `food_label`, `food_expiry`, `food_social_url` (`BETK_FOOD_APPROVAL_REQUIRED`; `count(DISTINCT document_type)`). The label is not parsed and is not compared to `food-v1`. An empty label does not skip the document check. Non-active status returns without those checks. Shipping stays `chk_active_listing_shipping` (pack §5 (a)); this function does not repeat it. `search_path` pinned. SECURITY DEFINER, same reason as `enforce_store_category_cap` |
| `force_store_category_approved_at` + `trg_force_store_category_approved_at` | BEFORE INSERT on `store_categories` | pack §5: force `approved_at` null unless `is_admin()` | AUTHORED | Coerces to null. Does not raise. Does not exempt `service_role`. `is_admin()` is false when `auth.uid()` is null, so a service-role INSERT that sends `approved_at` stores null. No BEFORE UPDATE trigger: the pack names INSERT. Authenticated UPDATE stays the live admin-only policy |
| `submit_seller_application` | live 15-argument list, body replaced, INVOKER, `search_path` pinned | pack §5 AC-AGR-3 and REG-65; live signature SELECT 2026-10-03; plan §8.2.4 D3 (arguments unchanged) | AUTHORED | Signature MATCH to the live list, same order, same names. Raises `BETK_AGREEMENT_VERSION_UNCONFIGURED` when `checkout_agreement_version('agreement_seller_agreement_version')` is null or blank, else `BETK_SELLER_AGREEMENT_REQUIRED` when that user has no `agreement_acceptances` row for `seller_agreement` at that label with `status = accepted`. The check is before any insert. `p_delivery_options` is not written; `stores.delivery_options` is `'{}'`. `p_category_primary` and `p_category_secondary` are stored on those columns because `category_primary` is NOT NULL. They are not matched to `categories.id`. No `store_categories` insert. Unique-violation mapping is the live one (`BETK_SLUG_TAKEN`, `BETK_APPLICATION_EXISTS`) |
| `resubmit_seller_application` | live 2-argument list, body replaced, INVOKER | same AC-AGR-3 sentence for both bodies; live signature | AUTHORED | Signature MATCH. Same version and acceptance raises, before the profile update, so a miss writes nothing. Still updates only a rejected pending profile and the two national-id document rows. Does not write a delivery fee |
| `checkout_from_cart` | absent | pack §5: Phase 09 does not edit it | MATCH | Not in the file |
| `admin_settings` | no UPDATE | pack T02: do not UPDATE `admin_settings` | MATCH | Keys are read. T01's five values are not in this file |

AC-CAT-2 is not a row here. The live check `chk_active_listing_shipping` is NOT VALID and already checks new writes (SELECT 2026-10-03). The trigger does not scan the three existing active listings and does not invent dimensions.

## Fixture impact (E3)

T02 edits no test file. T04 applies this text and, in that same push, edits the fixtures below. Assertions stay as they are. The required check is `RLS smoke (staging)`.

The publish trigger refuses `status = 'active'` only. `draft`, `paused`, `removed`, and `sold_out` inserts do not enter it. Prices 100, 150, 200, 250, and 500 sit inside the post-T01 staging band `1`..`1000000`, so **price band refuses none of these rows** while those two keys stay as T01 wrote them. Do not write another band value. **Service type refuses none of them:** every active insert sets `type` to `product`. **Food approval** refuses an active row only when `category_id` or `subcategory_id` is `food-beverages` or a descendant. A category the test itself inserts, with a non-food slug and a null parent, is not in that tree.

Shared fixture change for every active insert that must still succeed:

1. Service role inserts `store_categories (store_id, category_id)` and then updates `approved_at` to a timestamp. The INSERT trigger clears `approved_at` unless `is_admin()`, and the service role's `auth.uid()` is null, so the timestamp has to be the second statement. That UPDATE is not this trigger. Service role already bypasses the admin-only UPDATE policy. One approved row covers every listing of that store in that category.
2. Set `prep_days` to `1` (inside live `prep_cap_days` = `3`). Null prep is `BETK_PREP_CAP`.
3. Where the active payload has no `weight_g`, `length_mm`, `width_mm`, and `height_mm`, set each to `1`. That is the already-applied `chk_active_listing_shipping`, not a new P09M1 rule. The same edit has to include it or the insert is still refused before the new trigger's later checks matter.
4. Where the category is `.limit(1)` with no `order`, exclude slug `food-beverages` and any row whose `parent_id` is that id (live children: `food-herbs`, `food-homemade`, `food-pickles`, `food-sweets`). Otherwise food approval can also refuse the insert (`BETK_FOOD_APPROVAL_REQUIRED`; the label check does not, because staging `food_requirements` is `food-v1`).

| File | Active write the new trigger refuses | Rule | T04 fixture change |
|---|---|---|---|
| `tests/integration/rls.smoke.test.ts` | `beforeAll` active listing and the active row with `deleted_at` (both `status: "active"`, product, fixed, price 100, shipping already set). Draft insert is not refused | Unapproved category. Prep cap (null `prep_days`). Food approval only if the unordered `.limit(1)` category is in the food tree | One service-role approved `store_categories` row for that store and category (insert, then update `approved_at`). `prep_days: 1` on `baseListing`. Pick a non-food category. Assertions unchanged |
| `tests/integration/discovery.listing.test.ts` | `fullListing`, `railSibling`, `deletedListing`, `suspendedStoreListing`, `stockZeroActiveListing` (base `status: "active"`). Own category slug `t05-cat-*`, not food | Unapproved category (both the active store and the suspended store). Prep cap | Approved `store_categories` for each of those two stores and that category. `prep_days: 1` on `base`. Shipping is already set |
| same file | `quoteOnlyListing` (`price_type: "quote_only"`, `price: null`, status inherited `active`) | Fixed price (`BETK_PRICE_TYPE`), and also unapproved category and prep cap while it stays active | Seed `status: "sold_out"`. The publish trigger does not run. `getListingById` already returns `sold_out`. The assertion reads `priceType`, `price`, and `stockQty`, not status. Do not change the `expect` lines |
| `tests/integration/discovery.queries.test.ts` | active listing and the active row with `deleted_at`. Own categories, not food. Shipping already set | Unapproved category. Prep cap | Approved row for that store and `topCategoryId` (the listing's `category_id`). `prep_days: 1` on `baseListing` |
| `tests/integration/discovery.search.test.ts` | `activeMatch`, `deleted`, `suspended`, `boosted`, `organic`, `diacriticTitle`, `plainTitle`. Draft is not refused. Own category, not food | Unapproved category (active store and suspended store). Prep cap. Shipping columns are absent, so the live check also refuses | Approved row per store. `prep_days: 1` and the four shipping columns `1` on `base` |
| `tests/integration/discovery.category.test.ts` | `topOnly`, `childListing` (`category_id` is the test parent), `suspendedStoreListing`. Own categories, not food | Unapproved category (both stores). Prep cap. Shipping columns absent | Approved row per store for `topCategoryId`. `prep_days: 1` and the four shipping columns on `base` |
| `tests/integration/discovery.storefront.test.ts` | the one active listing. Own category, not food | Unapproved category. Prep cap. Shipping columns absent | Approved row for that store and category. `prep_days: 1` and the four shipping columns |
| `tests/integration/categoryListings.route.test.ts` | active, active-with-`deleted_at`, and suspended-store active. Draft is not refused. Own category, not food | Unapproved category (both stores). Prep cap. Shipping columns absent | Approved row per store. `prep_days: 1` and the four shipping columns on `base` |
| `tests/integration/listing.writeLayer.test.ts` | `seedListing(..., { status: "active" })` in the soft-delete test and the cross-seller test. Category is unordered `.limit(1)` | Unapproved category. Prep cap. Food approval if that category is in the food tree. Shipping columns absent on this helper | Approved row for that store and category. `prep_days: 1` and the four shipping columns on the active seeds. Non-food category. The denied cross-seller update is not a second refusal: RLS does not update the row |
| same file | `updateStock` restock: seed is `sold_out` (insert not refused); the action then sets `status: "active"` | The UPDATE is refused by unapproved category and prep cap (and by the live shipping check, because this helper does not set the four columns). Food approval if the category is in the food tree | Put `prep_days: 1` and the four shipping columns on that sold_out seed, and the approved `store_categories` row, before the action runs. The `expect` of status `active` and stock 12 stays |
| same file | `publishListing` cases that expect `unmet_requirements` | Not refused. The action returns before the status update | No change |
| `tests/integration/listing.childrenRls.test.ts` | `seedListing(..., "active")`. The draft seed is not refused. Unordered `.limit(1)` | Unapproved category. Prep cap. Food approval if that category is in the food tree. Shipping columns absent | Approved row. `prep_days: 1` and the four shipping columns on the active call. Non-food category |
| `tests/integration/order.rls.test.ts` | one active listing. Shipping already set. Unordered `.limit(1)` | Unapproved category. Prep cap. Food approval if that category is in the food tree | Approved row. `prep_days: 1`. Non-food category |
| `tests/integration/orders.stockDecrement.test.ts` | `seedListing` default `status: "active"` (A, B, C1, C2, E, F). D is active with null stock. Own category `r2-cat-*`, not food. Shipping already set. A later stock update that leaves the row active rechecks the same gate; a row that passed the insert still passes | Unapproved category. Prep cap | Approved row for that store and category. `prep_days: 1` on the helper |
| `tests/integration/inquiry.writeLayer.test.ts` | `seedListing` status `active`. Unordered `.limit(1)`. Shipping columns absent | Unapproved category. Prep cap. Food approval if that category is in the food tree | Approved row. `prep_days: 1` and the four shipping columns. Non-food category |
| `tests/integration/inquiry.rls.test.ts` | same helper shape | same three | same change |
| `tests/integration/inquiry.readReceipt.test.ts` | same helper shape | same three | same change |
| `tests/unit/listingStockDisplay.unit.test.ts` | object literal `status: "active"` | None. No database write | No change |
| `docs/03-database/rehearsal/m78/asserts.sql` | CI A, CI B, CI oos are `active`, product, fixed, price 100, `prep_days` 1, shipping set. Category is `ORDER BY slug LIMIT 1`, which is `arts-crafts` (SELECT 2026-10-03), not food. Draft row is not refused | Unapproved category, if this harness applied P09M1. It does not: `.github/workflows/p08-m78.yml` pins migrations at `4f08616` | T04 does not edit this file. No approved-row change in the T04 push |

The three live active staging listings are not fixtures. This trigger does not scan them and does not backfill weights. No test in the table updates those rows. Do not invent dimensions for them.

### RPC callers (not the publish trigger, not the required smoke)

`seller.submit.test.ts` happy paths (`ok: true`) and `seller.resubmit.test.ts` happy paths call the replaced functions with no `seller_agreement` acceptance row. After apply, those calls raise `BETK_SELLER_AGREEMENT_REQUIRED` (staging version is `STAGING-DRAFT-1`, so the empty-version raise does not fire). The phone-null RPC test only asserts that `error` is not null and that the row counts stay zero; that assertion still holds. No listed expect reads `delivery_options`. T04's required smoke does not call these RPCs. T06 is the AC-AGR-3 evidence. A later run of these two files needs, as a fixture only, an `agreement_acceptances` row for that user, document `seller_agreement`, version label equal to the current `agreement_seller_agreement_version`. Assertions stay unchanged.

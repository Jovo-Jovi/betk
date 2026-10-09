# PHASE_10_CART_QUOTE.md

> Phase 10 T00 pack. Docs only, plus the branch-protection change §4 records. Authority is `BETK_PHASES.md` Phase 10. Scope is frozen (OD-20 = 51 tables, OD-21 = 79 pages). This pack does not add a page, a table, a requirement, an OD, or a feature. It contains no SQL body.

## 0. Header

**Scope authority.** `docs/10-ai-development/BETK_PHASES.md` Phase 10 (Goal, Entry, Exit gate, Owns, Blocked, task table, PAGES, CODES). Data contract: `docs/03-database/BETK_ERD.md`. Page contract: `docs/00-design/BETK_UI_SPEC.md`. Pins recorded in T00 are in §4.

**Goal.** Account before add-to-cart. Seller quote (band, 24h, prep) writes a cart line. No confirmed-inquiry checkout CTA.

**PAGES:** P13, P14, P36, P37, P66

**CODES:** FR-CART-1, FR-BUY-5, FR-SEL-13, FR-QTE-1, R-C01, R-C02, R-C03, R-C04, R-C05, R-C06, R-C07, R-Q01, R-Q02, R-Q03, R-Q04, R-Q05, R-Q06, R-Q07, R-Q08, AC-CART-1, AC-CART-2, AC-CART-3, AC-CART-4, AC-CART-5, AC-CART-6, AC-CART-7, AC-QTE-1, AC-QTE-2, AC-QTE-3, AC-QTE-4, AC-QTE-5, AC-QTE-6, AC-BUY-5, AC-SEL-13

**NOTHING ELSE.** No new table. No new page beyond the PAGES line. `components/ui` and `components/shared` stay Claude Design's. Cursor composes and wires data. A visual gap is a Claude Design handoff, not a restyle. `src/lib/supabase/types.ts` changes only by the CI diff (REG-32). No prompt in this pack contains a SQL body. No prompt says to apply from a plan section.

Phase 10 encodes no phone check. It does not add a phone predicate to `cart_items`. Named phone-verification holds stay checkout, become-seller, and payout. Where inside checkout the `/auth/phone` redirect fires is Phase 11's choice.

## 1. Entry checklist

Measured 2026-10-06 on branch `v2-p10-t00`, cut from `origin/main` `5ad2b001eacc9ea298282f4ce8dd82d627540bb2` (merge of PR #77). `47357da91e79355f4acfcf1562ec7c0c7fb4ab49` is an ancestor of that commit (`git merge-base --is-ancestor`).

| Check | Method | Result |
|---|---|---|
| Phase 09 exit | `SESSION_CONTEXT.md` bullet **P09-T11-FIX (2026-10-05). Phase 09 exit holds.** Pack `PHASE_09_V2_SURFACES.md` §8 rows 1–10 and §9 T11 row. | Holds. Local suite 2026-10-05 02:26:01 +0300: 30 files passed, 208 passed, 2 skipped. CI Integration (staging) on `020cec7`, run [37244991573](https://github.com/Jovo-Jovi/betk/actions/runs/37244991573): 208 passed, 2 skipped. |
| PR #72 | `gh pr view 72`; `git merge-base --is-ancestor 35b4cd7 origin/main`. | Merged. Merge commit `35b4cd7ff6c89c41c65a940f1d7c5491fff034ee`. 2026-10-05 03:15:32 +0300. Ancestor of `origin/main`. |
| CD-DELTA-6 | `gh pr view` 73 and 76. `docs/00-design/kit-manifest.json` key count. | Complete. W2 = PR #73, merge `72d7a632ffcdbd4fbf14db30af2c97b35c0c41de`. W3 = PR #76, merge `98599c9f0441e872b8191d99787e241d727e3cf2`. Manifest **64** files. `src/components/shared/CartLine.tsx` is one of them. |
| Store fixes | `gh pr view` 74, 75, 77. | All merged. #74 `114517a27c876203f40577db1991c1ed8babf8aa`. #75 `2caa836490f5057f04c6479d37fdb0782d503732`. #77 `5ad2b001eacc9ea298282f4ce8dd82d627540bb2` (this branch's base). |
| Ledger | MCP `list_migrations` on `project-0-BETK-supabase-betk`. Local `supabase/migrations`. Version sets compared. | Remote **41**. Last `20261004172620` / `v2_09_approval_state_actor`. Local **41**. Only-local 0. Only-remote 0. 1:1. |
| Residue | MCP `execute_sql` counts, the four tables P09-T00 recorded. | `seller_orders` 7, `master_orders` 7, `order_status_history` 12, `payouts` 0. |
| Branch protection, before STEP 3 | `gh api repos/Jovo-Jovi/betk/branches/main/protection`. | `required_status_checks.contexts`: `RLS smoke (staging)`, `Install`, `Lint`, `Typecheck`, `Vitest (unit)`, `Guards`, `Types drift`, `Build`. `strict` true. `enforce_admins.enabled` true. `allow_force_pushes.enabled` false. `allow_deletions.enabled` false. `Integration (staging)` was not required. |

STEP 3, because the launch line is `INTEGRATION: required`, adds that one context. The list after the change is in §4. Nothing else in protection changes.

## 2. Binding rules

Carried from Phase 09 §2:

- Staging SQL is a file under `docs/03-database/rehearsal/staging-text/`, audited before any apply. The audit verdicts are MATCH, BROADER, NARROWER, AUTHORED, MISMATCH, FINDING. A GRANT never closes a BROADER table privilege.
- Before every `apply_migration`, state the query argument's md5 and byte length and show they equal the bound file (`PRECEDENTS.md`, apply_migration gets the bound text).
- **Decision Q1 (human, 2026-10-04), verbatim.**

Q1 Append-only and evidence protections (no_delete_mod_log, the history rules, any immutability on agreement_acceptances) are never disabled outside an approved migration. Tests issue no DDL.
   Tests that must create append-only or evidence rows on staging use permanent, labelled fixture accounts — fixture-admin@betk.test and fixture-seller@betk.test (create them once if missing; never delete them).
   Guard G's expected residue = the N27 set + those fixture accounts + the append-only/evidence rows they own. It reports those counts at suite start and fails only on rows outside that set.

- Types come from the CI Types drift diff, applied verbatim. No hand edit. No bridge cast left.
- A visual gap goes to Claude Design. Cursor does not restyle the kit.
- The human acts only by merging, typing GO for an irreversible step, pasting to Claude Design, and answering a decision. This pack does not merge and does not bypass checks.

**W1 (verbatim).** W1 Workflow: at the end of any task that needs a PR, Cursor opens it with `gh pr create` (title = commit subject; body = the task's evidence summary). The human only merges. Never merge, never bypass.

**Shared close** (every prompt after T00 ends with this). Tasks after T00 commit on `feature/phase-10-cart-quote` and push. The one PR is opened by the exit task.

```text
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 10 tasks stay on feature/phase-10-cart-quote until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
```

Also binding here: Windows/PowerShell; no `&&`. Supabase MCP namespace is `project-0-BETK-supabase-betk` only. Phase 10 encodes no phone check. Scope stays OD-20 = 51 and OD-21 = 79. A schema fact that is not cited or flagged in §5 is not a reason to invent a column, policy, or function.

## 3. Register plan

No reservations. Numbers are taken at mint time.

P10-T00 re-read (2026-10-06), before any mint: header REG-01..REG-112, next free **REG-113**, no REG-113 row. **None taken** in that task. Next free stayed **REG-113** / **OD-22** / **ADR-026**.

P10-T00-FIX re-read (2026-10-06), before the mint: header still REG-01..REG-112, next free **REG-113**, no REG-113 row. Took **REG-113** and **REG-114**. Next free **REG-115** / **OD-22** / **ADR-026**.

**REG-113** (a). Checkout-price finding. `checkout_from_cart` writes `order_items.unit_price` and the seller-order subtotal from live `listings.price` for fixed lines, not from `cart_items.unit_price`. Migration `supabase/migrations/20261003082041_v2_08_functions.sql`: subtotal at lines 867–872, `order_items.unit_price` at lines 1044–1045. That contradicts R-C06, AC-CART-3, and ERD §3.3 (“copies `inquiry_id`, `is_custom`, `unit_price`, and `quantity`”), which ADR-025 points at for the copy. Owner: Phase 11 (checkout migration). Precondition: P10M1 applied. Before: the Phase 11 exit. The same function locks `cart_items` with a row lock at lines 784–787. R-LOCK (planning chat, 2026-10-06) keeps that lock working: P10M1 revokes the table UPDATE and re-grants UPDATE (`updated_at`) only. No price, quantity, listing, or inquiry column is regranted. Phase 11's checkout change is the price copy (this REG), not a lock repair. Phase 10 does not edit the function.

**REG-114** (b). `AppTopbar` has no cart slot. `AppTopbarProps` (`src/components/shared/AppTopbar.tsx` lines 14–47) is search, language, theme, notifications, and account. The cluster at lines 70–87 has no cart icon and no count. D1, as amended by D4, needs the sanctioned cart button. Owner: Cursor in P10-T05 under the D4 human sanction. Before: the Phase 10 exit.

P10-T01-FIX re-read (2026-10-06), before the mint: header REG-01..REG-114, next free **REG-115**, no REG-115 row. Took **REG-115**. Next free **REG-116** / **OD-22** / **ADR-026**.

**REG-115.** Checkout store-status finding. `checkout_from_cart` does not refuse a line whose store is not active. The line gate at `v2_08_functions.sql` lines 792–809 checks the listing (`weight_g`, `deleted_at` null, `status` in `active` or `sold_out`) and does not read `stores.status`. The store join at lines 896–898 reads `governorate` only. Recorded only. Phase 10 does not edit the function. Owner: Phase 11 checkout migration. Before: the Phase 11 exit.

REG-79 is updated in place. It is not a new number. Status: **PINNED 2026-10-05 (B).** The pin text is §4.

REG-107 is owned by Phase 10 and closes before the exit. **T03 closes it**, after T01 authors the staging text and the audit and T02's CI proof is green, and after the planning-chat review of that audit and the human's GO. The shape is R-107 in §6 (D3). Live `information_schema.column_privileges` (SELECT 2026-10-06) grants `authenticated` UPDATE on `seller_profiles.avg_response_hours`, and policy `sp_update` is owner-or-admin with no column restriction. The app writer is `recomputeSellerAvgResponseHours` in `src/features/messaging/actions/_shared.ts` (lines 69–73), called from `sendInquiryMessage` (line 148) on the seller's own session. An app-only change would leave that grant in place. The change is part B of P10M1. This pack contains no SQL body.

REG-82 is a closed product pin. Phase 10 implements it by the R-C07 path already in `restore_stock_on_cancel` (ERD §3.3; live trigger `trg_restore_stock_on_cancel`). Phase 10 does not reopen the pin and does not add a sweeper. The sweeper is Phase 11 (`BETK_PHASES.md` §8).

## 4. Pins

**Decision (human, 2026-10-05), verbatim.**

REG-79 (human, 2026-10-05): "REG-79 = B. The verified-phone gate fires at checkout, not at add-to-cart. Add-to-cart and quote accept (P14) require an account only (N21, R-C01). Named phone-verification holds remain checkout, become-seller, and payout (R-A07, AC-AUTH-4). Database authority remains the existing RESTRICTIVE master_orders_phone_gate; no phone predicate is added to cart_items. Phase 10 encodes no phone check. Phase 11 owns FR-AUTH-4; where inside checkout the /auth/phone redirect fires is Phase 11's choice, and its exit already requires the phone-NULL submit case."

**INTEGRATION, the launch line, verbatim.**

INTEGRATION: required

**Protection after STEP 3.** Method: `PATCH repos/Jovo-Jovi/betk/branches/main/protection/required_status_checks` with `strict: true` and the previous eight contexts plus `Integration (staging)`, each `app_id` 15368. Re-read with the same `gh api` as §1.

`required_status_checks.contexts` after: `RLS smoke (staging)`, `Install`, `Lint`, `Typecheck`, `Vitest (unit)`, `Guards`, `Types drift`, `Build`, `Integration (staging)`. `strict` true. `enforce_admins.enabled` true. `allow_force_pushes.enabled` false. `allow_deletions.enabled` false.

The job name in `.github/workflows/ci.yml` is already `Integration (staging)`. On a pull request that does not change `src/`, `tests/`, or `supabase/`, the job still completes: the detect step sets `run=false` and the suite steps are skipped. This docs PR can satisfy the new required check.

**Decisions (human, 2026-10-06), verbatim.**

D1 Q "Where should buyers find the cart?" A "Both" (a top-bar cart icon with a count, which is a Claude Design change, and a Cart tab in the phone bottom nav).

D2 Q "The listing page button 'استفسر الآن / Inquire now'" A "it should appear for unpriced or custom items only"

D3 Q "Approve the FLAG rulings and the checkout-price finding as written?" A "Yes, approve"

D4 "can you make it wothout claude design as i feel its too uch cost" (about D1, the cart entry).

**D1 as amended by D4 (planning chat, record as such).**

- The bottom-nav Cart tab is app-side (`MobileBottomNav` items come from `AppChrome`), with no kit change.
- The top-bar cart button is a recorded HUMAN SANCTION for a Cursor edit of `src/components/shared/AppTopbar.tsx`. It is the first human sanction under the kit-integrity rule: the FilterSheet precedent was a Claude Design sanction.
- Scope of the sanction: optional props `onCartClick`, `cartCount`, `cartLabel`. The button renders only when `onCartClick` is set; with none of the props, the markup is identical to `main`. The button is an exact copy of the existing notifications button (same element, same classes, same focus ring), with a lucide cart icon in place of the bell. It shows the same dot indicator when `cartCount` > 0 and no number. The count goes into the accessible name, which the page passes. `cartLabel` has no default. Nothing else in the file changes. The kit manifest is updated in the same commit.
- CD-DELTA-7 is withdrawn and was never sent.

**D2 mapping (planning chat, record as such).** "custom" = `listings.is_made_to_order` = true (PRD R-L15 and R-C04 "Custom / made-to-order"). "Unpriced" = `listings.price` IS NULL; no active v2 listing qualifies, because publishing requires a fixed price (`supabase/migrations/20261003214258_v2_09_publish_and_submit.sql` lines 74–75, `BETK_PRICE_TYPE` when `price_type` is not fixed or `price` is null). The P04 button shows only for those listings and is labelled per UI spec P04 "Request price". Server side: `createInquiry` refuses other listings, and the quote function refuses them in the database (R-Q01). The current catalog strings are `listing.cta.inquiry`: en "Inquire now" (`messages/en.json` line 462), ar "استفسر الآن" (`messages/ar.json` line 462). T04 changes that label. It does not restyle P04.

## 5. Enforcement inventory and the DB plan

Server-side evidence for a refusal is the database error or the server-action result. A hidden control is not evidence. Every schema fact below was read on 2026-10-06 from the live database (MCP `execute_sql` on `project-0-BETK-supabase-betk`) or from the file cited next to it. Settled choices are the RESOLVED list in §6. The checkout-price finding is REG-113. Phase 10 does not edit checkout.

**Phone.** Live restrictive INSERT policies, none of them on `cart_items`: `master_orders_phone_gate` on `master_orders`; `orders_phone_gate` on `seller_orders` (name kept across the rename); `seller_profiles_phone_gate` on `seller_profiles`; `payouts_phone_gate` on `payouts`. Each WITH CHECK requires `users.phone_number IS NOT NULL` for `auth.uid()`. `cart_items` policies are `cart_items_select`, `cart_items_insert`, `cart_items_update`, `cart_items_delete`. None of their expressions mention phone. Live columns on `cart_items`: `id`, `buyer_id`, `listing_id`, `quantity`, `unit_price`, `is_custom`, `inquiry_id`, `created_at`, `updated_at`. No phone column. Phase 10 adds no phone predicate and no phone check in the cart or quote actions.

**Inbox routes moved from signed Phase 06.** `BETK_PHASES.md` §2: Phase 06 `PAGES:` none and `CODES:` none. "The quote behaviour and the inbox routes moved to Phase 10." `inquiries.last_message_at` stays unmaintained (REG-43, closed): sort from `max(inquiry_messages.sent_at)`. The routes are already on `main`: `src/app/[locale]/(buyer)/inbox/page.tsx` (P13), `inbox/[id]/page.tsx` (P14), `(seller)/seller/inbox/page.tsx` (P36), `seller/inbox/[id]/page.tsx` (P37). Phase 10 edits those files. It does not add a second inbox route. UI spec headings say `/inbox/[inquiryId]` and `/seller/inbox/[inquiryId]`; the built segment is `[id]`. That is the same route pattern (one dynamic segment). P66 `/cart` has no `page.tsx` (glob, 2026-10-06). T05 adds that one file and raises Guard F's pin from 31 to 32 in the same commit (`scripts/check-page-count.mjs`, `PINNED_PAGE_COUNT = 31`). OD-21 stays 79. T05 adds the cart entry points under D4 (REG-114).

**Quote settings, not a Phase 10 pin.** `quote_validity_hours` equals `24`. `quote_tolerance_multiplier` equals `2`. Both match the M3 documented defaults (plan §8.2.5). `payment_window_minutes` length is 0. `checkout_payment_window_minutes()` is SECURITY DEFINER and its body contains `BETK_PAYMENT_WINDOW_UNCONFIGURED`. `checkout_from_cart(p_delivery_address_id uuid)` is INVOKER and its body calls `checkout_payment_window_minutes`. Phase 10 does not write `payment_window_minutes` and does not choose a duration (REG-93, before Phase 11).

**Payment-window expiry without pinning REG-93.** The exit test does not call `checkout_from_cart` and does not write the settings key. It uses the restore function Phase 10's exit is told to test (`BETK_PHASES.md` §8: "Phase 10's exit tests restore as a function").

1. A session with `auth.uid()` null inserts a `master_orders` row whose `proof_path` is null and whose `payment_deadline` is already before `now()`, a `seller_orders` row in `pending`, and `order_items` for one fixed line (`inquiry_id` null) and one custom line.
2. The same no-JWT session sets that seller order's status to `cancelled`.
3. Live `enforce_order_transition` (SECURITY DEFINER; trigger `trg_enforce_order_transition`) contains `auth.uid() IS NULL`, `v_proof IS NULL`, and `now() >= v_deadline`, and it stamps `cancelled_by`. The applied body in `BETK_DATABASE_SCHEMA.sql` places those three predicates on the `pending → cancelled` system branch.
4. Trigger `trg_restore_stock_on_cancel` runs `restore_stock_on_cancel()`. Its body contains `quote_expires_at > now()`. The applied body inserts a fixed-price `cart_items` row for every `order_items` row with `inquiry_id` null, and a custom row only when the joined quote is still in the future (REG-82, R-C07).
5. A second case sets `quote_expires_at` in the past and asserts that the custom line is absent.

`BEFORE INSERT` trigger `trg_set_order_commission_snapshot` runs `set_order_commission_snapshot()` on `seller_orders`. A missing `commission_rate_pct` key raises `BETK_COMMISSION_CONFIG_MISSING`. The live key is not blank (length 1). The fixture supplies `subtotal` because the function stamps commission from it. `AFTER INSERT` trigger `trg_decrement_stock_on_checkout` runs `decrement_stock_on_confirm()` on `order_items`, so a tracked line's stock moves down on the insert and back on the cancel. None of `enforce_order_transition`, `restore_stock_on_cancel`, or `set_order_commission_snapshot` mentions `order_status_history` (body search, 2026-10-06). The test deletes only the rows it inserted. It does not disable `no_delete_order_history` or `no_update_order_history` (both live `DO INSTEAD NOTHING` rules). If a delete fails, the test stops and reports the counts. It does not widen Guard G.

The production sweeper stays Phase 11. Quote expiry at 24h is not a cron (`BETK_PHASES.md` §8). It is derived at read from `quote_expires_at`.

**Does Phase 10 need any migration at all?** Yes. Exactly one: **P10M1**. Part A is cart and quote integrity. Part B is REG-107. One review, one GO (R-ONE-MIGRATION, D3). No checkout edit. That edit is REG-113, Phase 11, and its precondition is P10M1 applied.

| Code | Where it is enforced today | What Phase 10 adds |
|---|---|---|
| FR-CART-1 | The family is R-C01–R-C07. Storage is `cart_items` (ERD §6.1). No `/cart` page. | T05 composes P66. The writes are the part-A functions below. |
| FR-BUY-5 | Buyer inbox routes exist (P13, P14). The confirmed-inquiry checkout CTA is retired (`BETK_PRD.md` FR-BUY-5). P14 renders a confirmed banner with no checkout link. P13's list links to the thread, not to checkout. | T05 keeps P13 free of a checkout control. T04's accept calls the quote-accept function and does not add a checkout button (UI spec P14). |
| FR-SEL-13 | Seller inbox routes exist (P36, P37). P37 still mounts `InquiryStatusActions`, which calls `confirmInquiry`. | T04 replaces that control with the quote-send function. No checkout-enable control (UI spec P37). T04 checks P36 (R-P36). |
| FR-QTE-1 | Quote columns are live on `inquiries`: `quoted_price`, `quoted_prep_days`, `quote_expires_at`, `quoted_at` (all nullable). Policy `inq_update` is the store or admin. No band trigger. No triggers on `inquiries` (live `pg_trigger`, 2026-10-06). | The quote-send function (SECURITY DEFINER, part A). Store owner only. Band via `checkout_quote_multiplier`. Prep required. `quote_expires_at` from `quote_validity_hours`, failing closed. Made-to-order or unpriced listing only (D2, R-Q01). T04 calls it from P37. |
| R-C01 | `cart_items_insert` WITH CHECK `buyer_id = auth.uid()`. INSERT/UPDATE/DELETE on `cart_items` are revoked from `anon`; `anon` keeps SELECT. `addToCart` returns `unauthenticated` for a guest and `unavailable` for a signed-in buyer (`src/features/discovery/actions/addToCart.ts` lines 30–32). A guest insert creates no row (P09-T09, `42501`). | The fixed-price add function (SECURITY DEFINER) refuses a guest (`auth.uid()` null) and is the only authenticated insert. No phone check. T04 wires `addToCart` to it. |
| R-C02 | Table `cart_items` plus the four self policies. Partial unique indexes `uq_cart_items_listing` and `uq_cart_items_inquiry`. | The cart page reads that table. No new table. |
| R-C03 | No cart page. No live function whose name contains `cart`, `deliver`, or `courier` except `checkout_from_cart` and `checkout_quote_multiplier`. The combined delivery total is stored on `master_orders` at checkout (REG-91, ADR-023). | **R-DELIVERY (RESOLVED, D3).** T05 shows the goods subtotal and a line that delivery is calculated at checkout. It does not invent a rate function and does not call `checkout_from_cart`. Phase 11 adds the figure and the total after its read-only preview. |
| R-C04 | `listings.stock_qty` null means untracked (ERD §10.1). No trigger on `cart_items`. No CHECK that `quantity` is within stock. Live CHECK is only `quantity > 0`. | The fixed-price add function and the quantity-change function (both SECURITY DEFINER) bound a tracked line to live stock. Custom / made-to-order stays untracked (R-L15). The buyer's direct INSERT and UPDATE are revoked, so a direct write cannot exceed stock. |
| R-C05 | No `blocked` column. Blocked is derived from `stock_qty` or `quote_expires_at`. `checkout_from_cart` already raises `BETK_CHECKOUT_QUOTE_EXPIRED` and `BETK_CHECKOUT_OUT_OF_STOCK`. | The cart read derives the blocked reason. CartLine's reasons stay `stock` and `quote_expired`. No new column. |
| R-C06 | `unit_price` is a `cart_items` column. CHECK `unit_price > 0`. No trigger copies `listings.price` onto the cart. `authenticated` has table UPDATE, and `cart_items_update` does not restrict columns, so the buyer can change `unit_price`. | The add function sets `unit_price` from the listing. The accept function sets it from `quoted_price`. Neither rewrites it when the listing price changes. The buyer's direct UPDATE is revoked, so `unit_price` is writable only by those functions (and by `restore_stock_on_cancel`, which is already SECURITY DEFINER). Checkout still charges the live price: REG-113, not this migration. |
| R-C07 | `restore_stock_on_cancel` on `trg_restore_stock_on_cancel`. REG-82 closed. | The exit test drives it. Phase 10 adds no sweeper and no second restore function. |
| R-Q01 | Checkout does not write `inquiries.converted_to_order_id` (CF-4). The column is still nullable. PRD R-Q01: inquiry is price discovery for custom items, not the ordering mechanism. | The quote-send function refuses a listing that is neither made-to-order nor unpriced. `createInquiry` refuses the same listings (D2). Phase 10 does not write `converted_to_order_id`. |
| R-Q02 | `checkout_quote_multiplier()` reads `quote_tolerance_multiplier` and fails closed when the key is empty or not a positive number. Nothing checks the band when a seller updates `inquiries`. | The quote-send function refuses a quote below `listings.price` or above price times that multiplier. It does not hard-code `2`. The seller's direct UPDATE of the quote columns is revoked. |
| R-Q03 | `quote_validity_hours` is `24`. No function writes `quote_expires_at`. | The quote-send function sets `quote_expires_at` from that key. An empty or unreadable key fails closed and writes no quote. Phase 10 does not hard-code 24 and does not add a cron. |
| R-Q04 | `quoted_prep_days` may be null (live CHECK). | The quote-send function refuses a quote that omits prep. A direct UPDATE that leaves it null is revoked with the other quote columns. |
| R-Q05 | No accept action inserts `cart_items`. `chk_cart_item_custom_inquiry` ties `is_custom` to `inquiry_id`. | The quote-accept function (SECURITY DEFINER) inserts one custom row: `is_custom` true, `inquiry_id` set, `unit_price` equal to `quoted_price`, own inquiry, quote present and unexpired. |
| R-Q06 | Derived. `checkout_from_cart` refuses a custom line whose `quote_expires_at` is null or not after `now()`. No quote-expiry cron. | Cart and accept treat expiry as that comparison. The accept function refuses an expired quote. No cron. No notification row. |
| R-Q07 | Same hole as R-Q02 at send time. Checkout re-checks the band. | Send-time refusal is the quote-send function, same as R-Q02, plus the column revoke. |
| R-Q08 | `createInquiry` returns `unauthenticated` when `requireActiveUser` throws `NotAuthenticatedError`. Policy `inq_insert` WITH CHECK `buyer_id = auth.uid()`. | Phase 10 does not add a guest quote path. T04 also refuses a listing that is neither made-to-order nor unpriced (D2). |
| AC-CART-1 | Same gate as R-C01. P09-T09 left `cart_items` at 0 for a guest insert. | Exit integration: guest add leaves zero `cart_items`. The add function refuses the guest, and the anon INSERT stays revoked. |
| AC-CART-2 | Not enforced. See R-C04. | The add function refuses tracked qty above live stock and leaves the cart unchanged. A direct INSERT is refused by the revoke. |
| AC-CART-3 | See R-C06. A listing-price change has no cart trigger to ride on. | The line keeps the snapshotted `unit_price` because only the cart functions write it. Checkout still charges live `listings.price` for a fixed line (REG-113). |
| AC-CART-4 | Derived, R-C05 / R-Q06. | Exit: an expired quote blocks that line. Removing the line, then a fresh in-band quote and accept, clears the block. A re-quote while the line is held is refused (R-FREEZE). Checkout itself is Phase 11. |
| AC-CART-5 | Derived from `stock_qty` reaching 0. | The cart read marks the line blocked. Checkout refusal of that line is Phase 11. |
| AC-CART-6 | No cart page. | T05: a qty change inside stock, or a remove, changes the goods subtotal. The delivery line is the R-DELIVERY text. The figure and the total are Phase 11. |
| AC-CART-7 | `restore_stock_on_cancel`, REG-82. | Exit test in the payment-window section above. The dropped line is the `cartLine.droppedQuote` prompt, written by T05. |
| AC-QTE-1 | Same gate as R-Q08. | Exit: a guest request creates no inquiry. |
| AC-QTE-2 | Not enforced at send. See R-Q02. | The quote-send function: below the listing price is refused; above the ceiling is refused; a price on the closed interval is stored. |
| AC-QTE-3 | Null prep is legal in the CHECK. | The quote-send function refuses a quote with no prep. |
| AC-QTE-4 | Not implemented. | The quote-accept function inserts one `cart_items` row at `quoted_price`, `is_custom` true. A later listing-price change leaves that `unit_price`. |
| AC-QTE-5 | No accept function. | The quote-accept function inserts nothing after `quote_expires_at`. A line already in the cart is blocked (AC-CART-4). |
| AC-QTE-6 | `chk_cart_item_custom_inquiry` does not require `unit_price = quoted_price`. | The accept function uses `quoted_price`. A fixed-price line has `inquiry_id` null. A direct insert at an unquoted price is refused because the buyer's INSERT is revoked. |
| AC-BUY-5 | Implied same-ID AC. `BETK_PRD.md` §1.3: it inherits FR-BUY-5. | The P13 surface matches the amended FR. No separate script is invented here. |
| AC-SEL-13 | Implied same-ID AC. It inherits FR-SEL-13. | The P37 surface matches the amended FR once T04 removes confirm-to-checkout. P36 is checked in the same task (R-P36). |
| D2 (P04) | The listing CTA is `listing.cta.inquiry`, shown for a normal listing. en "Inquire now", ar "استفسر الآن". | T04 shows Request price only when `is_made_to_order` is true or `price` is null, and labels it per UI spec P04 "Request price". T04 shows Add to cart only for a priced listing that is not made-to-order. The two controls never show together. `createInquiry` and the quote-send function refuse every other listing (R-Q01). T04 may edit P04 for the Request price visibility and label, and for the Add-to-cart button's visibility. |
| R-FREEZE | `checkout_from_cart` prices a custom line at the inquiry's live `quoted_price` (`v2_08_functions.sql` lines 869 and 1044). Before this ruling, quote send overwrites `quoted_price` and `quote_expires_at` while a cart line can still reference the inquiry. | `send_inquiry_quote` refuses with `BETK_QUOTE_LINE_HELD` when any `cart_items` row references the inquiry, before it writes. The function is SECURITY DEFINER, so it sees every buyer's rows. Removing the line, then a fresh in-band quote and accept, clears the block. |
| R-AVAIL | Add already refuses a listing that is not `active` or is deleted. Accept and send do not check listing status, deletion, or store status. Live `stores_public` (SELECT 2026-10-06): `status = 'active'` OR owner OR admin. R-S07 is that status arm. Live `store_status`: `pending`, `active`, `suspended`. | `add_fixed_cart_item`, `accept_inquiry_quote`, and `send_inquiry_quote` each refuse a listing that is not `active`, is deleted, or whose store is not `active`. Owner and admin do not bypass the store test. Codes: add listing `BETK_CART_LISTING_UNAVAILABLE`, add store `BETK_CART_STORE_INACTIVE`, accept and send listing `BETK_QUOTE_LISTING_UNAVAILABLE`, accept and send store `BETK_QUOTE_STORE_INACTIVE`. |
| R-DECLINED | Accept and send do not read `inquiries.status`. Live `inquiry_status` (`pg_enum`, 2026-10-06): `open`, `replied`, `confirmed`, `declined`, `expired`. | Accept and send refuse with `BETK_QUOTE_DECLINED` when status is `declined`. `open`, `replied`, `confirmed`, and `expired` are not refused by this check. |
| R-TRIGGER | The response-hours trigger is AFTER INSERT on every inquiry message. The function body already averages seller replies only. | The trigger fires only when `NEW.sender_type = 'seller'`. The function body is unchanged. A buyer message does not fire it. |
| D1 (cart entry) | No `/cart` page. `AppTopbar` has no cart prop (REG-114). `MobileBottomNav` default items are Home, Search, Wishlist, Inbox, Account (`MobileBottomNav.tsx` lines 18–24). Items are props, and `AppChrome` passes them, so a Cart tab does not need a new kit component. | T05 adds the bottom-nav Cart tab from `AppChrome`, with no kit change. T05 edits `AppTopbar` under the D4 sanction and wires the signed-in buyer's cart count. The kit manifest is updated in that same commit. |

### Writer inventory

Measured 2026-10-06. App and tests by file. Functions by live `pg_proc` (`prosecdef`) plus the migration line. No function body is copied here.

`checkout_from_cart` is SECURITY INVOKER (live `prosecdef` false; migration lines 718–722). It does not INSERT into `cart_items` and it does not UPDATE any `cart_items` column. It reads the buyer's rows, takes a row lock (lines 784–787), and DELETEs those rows after the order insert (line 1077). For a fixed line, `order_items.unit_price` and the seller-order subtotal come from `listings.price` (lines 1044–1045 and 867–872). For a custom line they come from `inquiries.quoted_price`. They do not come from `cart_items.unit_price`.

| Writer | What it writes | Revoke breaks it? | How P10M1 keeps it |
|---|---|---|---|
| `attemptGuestCartInsert` (`src/features/discovery/guestCart.ts` lines 27–38), called by `addToCart` for a guest and by `tests/integration/guestCart.t09.test.ts` | Anon INSERT of `cart_items` | No. Anon INSERT, UPDATE, and DELETE are already revoked (`20261001091538_v2_08_new_tables.sql` line 64). The new revoke is the buyer's (`authenticated`). | Left as it is. The guest attempt still fails. The add function also refuses a null `auth.uid()`. |
| `addToCart` (`addToCart.ts` lines 30–32) | No row. A signed-in buyer gets `unavailable`. | No. | T04 calls the fixed-price add function for that buyer. P10M1 does not need this file. |
| `restore_stock_on_cancel` (SECURITY DEFINER, migration lines 439–442). INSERT at lines 475–491. Live `prosecdef` true. | INSERT `cart_items` from `order_items` (fixed lines, and custom lines whose quote is still in the future). Does not UPDATE `cart_items`. | No. It runs as the owner. The buyer revoke does not apply. | Not replaced. EXECUTE stays revoked from PUBLIC, anon, and authenticated (line 497). |
| `checkout_from_cart` (SECURITY INVOKER) | No INSERT and no column UPDATE on `cart_items`. DELETE of the buyer's rows (line 1077). The lock at lines 784–787 is not a column write, and PostgreSQL still requires the UPDATE privilege for that lock. | The DELETE is not broken: DELETE stays granted. The lock is kept working by the updated_at re-grant (R-LOCK). | P10M1 does not edit this function (REG-113 is the price copy). Part A revokes table UPDATE and re-grants UPDATE (`updated_at`) only. `cart_items_update` still limits the row to the buyer. No price, quantity, listing, or inquiry column is regranted. The audit records that re-grant as NARROWER than today's table grant, with the reason. It is not a FINDING. Phase 10's exit does not call this function. |
| `docs/03-database/rehearsal/m78/asserts.sql` line 261 | INSERT `cart_items` as the rehearsal role, not as `authenticated` | No. The buyer revoke does not apply to the table owner. | Not edited. |
| No app file and no integration test UPDATEs `cart_items` | — | Nothing current to break. | The quantity-change function is the future writer. It is SECURITY DEFINER. |
| No app file, test, or `betk` function UPDATEs `quoted_price`, `quoted_prep_days`, `quote_expires_at`, or `quoted_at` | `checkout_from_cart` and `restore_stock_on_cancel` only read those columns (live scan, 2026-10-06). | No current writer breaks. | The quote-send function (SECURITY DEFINER) is the writer part A adds. The seller's direct UPDATE of those four columns is revoked. |
| `createInquiry` (`src/features/messaging/actions/createInquiry.ts` lines 94–108) | INSERT `inquiries` (`buyer_id`, `store_id`, `listing_id`, `buyer_first_message`, and optional `quantity`, `delivery_preference`, `special_requests`). Not the quote columns. | No. The ruling revokes quote-column UPDATE, not INSERT. | INSERT stays. T04 refuses a listing that is neither made-to-order nor unpriced before this insert. |
| `sendInquiryMessage` (`sendInquiryMessage.ts` lines 137–142) | Seller session UPDATE `inquiries.status` to `replied` | Yes, if table UPDATE is revoked and `status` is not regranted. | Revoke the table UPDATE from `authenticated`, then grant UPDATE of `status` only. `inq_update` still limits the row to the store or admin. |
| `confirmInquiry` (`confirmInquiry.ts` lines 99–106) | Seller session UPDATE `inquiries.status` to `confirmed` | Same. | Same `status` regrant. T04 removes the P37 control. The column grant stays so this action and the RLS test keep working until that removal. |
| `declineInquiry` (`declineInquiry.ts` lines 90–97) | Seller session UPDATE `inquiries.status` to `declined` | Same. | Same `status` regrant. |
| `tests/integration/inquiry.rls.test.ts` lines 470–474 | Owning seller's client UPDATEs `inquiries.status` and expects a row | Same. | Same `status` regrant. |
| `inquiry.rls.test.ts` lines 479–485 and 495–501; `tests/integration/order.rls.test.ts` lines 690–695 | Buyer or unrelated seller UPDATEs `inquiries.status` and expects zero rows | No. `inq_update` already denies them. Regranting `status` does not add a row policy. | Policies unchanged. |
| `order.rls.test.ts` line 183 | Service role sets `inquiries.converted_to_order_id` null during teardown | No. `service_role` keeps table UPDATE. | Do not grant `converted_to_order_id` to `authenticated`. No authenticated writer sets it. |
| `markInquiryRead` (`markInquiryRead.ts` lines 99–106) | UPDATE `inquiry_messages.is_read`, not an `inquiries` column | No. Authenticated already has no table UPDATE on `inquiry_messages`. The column grant is `is_read` only (`20260722124510_inquiry_read_receipt_rls.sql` line 28). | P10M1 does not change that grant. |
| `recomputeSellerAvgResponseHours` (`_shared.ts` lines 69–73), called from `sendInquiryMessage.ts` line 148 | Seller session UPDATE `seller_profiles.avg_response_hours` | Yes. That is the write R-107 revokes. | Part B: an AFTER INSERT trigger on `inquiry_messages` (SECURITY DEFINER) recomputes with the formula in `computeAvgResponseHours` (`src/features/messaging/messagingRules.ts` lines 82–98): the mean, across inquiries that have a first seller reply, of (first reply `sent_at` minus `inquiries.created_at`) in hours; a negative or unreadable gap is skipped; the mean is rounded to two decimals and capped at 999.99; null when no gap remains. The message insert (line 120) runs before the app update, so the trigger has already stored the value when the app update fails. `sendInquiryMessage` already treats that failure as best-effort (lines 149–153). T04 removes the app call. `inquiry.writeLayer.test.ts` lines 333–367 still sees a non-null value from the trigger. |
| No `betk` function mentions `avg_response_hours` (live `prosrc` scan, 2026-10-06) | — | No invoker function to break. | The new trigger is the writer. Its EXECUTE is revoked from PUBLIC, anon, and authenticated, same as the other trigger functions. |
| `tests/integration/discovery.listing.test.ts` line 119 and `discovery.storefront.test.ts` line 116 | Service-role INSERT of `seller_profiles` including `avg_response_hours` | No. The revoke is `authenticated` UPDATE. Service-role INSERT stays. | Not edited. |
| `docs/03-database/rehearsal/p09/asserts.sql` lines 892–897 | Authenticated UPDATE of `avg_response_hours`, expecting success | It would fail on a database that includes P10M1. | It does not run there. `.github/workflows/p09-db.yml` pins migrations to `aeb6c5b` and never applies P10M1. Phase 10's exit asserts the opposite: the direct write is refused, and the trigger computes the value. |
| `resubmit_seller_application` (SECURITY INVOKER; `20261003214258_v2_09_publish_and_submit.sql` lines 265–269 and 295–298). Live `prosecdef` false. | UPDATE `seller_profiles.rejected_reason` to null and `submitted_at` to now, for the caller's pending rejected row | Yes, if those columns are not regranted after the table revoke. | Regrant UPDATE of `rejected_reason` and `submitted_at`. The approval-state trigger still limits the transition. |
| `approveSellerApplication` (`src/features/seller-approval/actions/approveSellerApplication.ts` lines 166–169) | Admin session (still `authenticated`) UPDATE `status` and `approved_at` | Yes, without a regrant. | Regrant UPDATE of `status` and `approved_at`. The approval-state trigger still requires admin for that transition. |
| `rejectSellerApplication` (`approveSellerApplication.ts` lines 205–208) | Admin session UPDATE `rejected_reason` | Covered by the `rejected_reason` regrant. | Same regrant. |
| `submit_seller_application` (SECURITY INVOKER; same migration lines 202–206 and 231–232) | INSERT `seller_profiles` (`id`, `status`, `level`, `submitted_at`). Not an UPDATE. | No. Part B revokes UPDATE, not INSERT. | INSERT stays. |

**NOTE (record only; nothing to fix).** Between T03 (P10M1 applied to staging) and the Phase 10 merge, the deployed main app's `sendInquiryMessage` logs one captured `avg_response_hours` error per seller reply. It is non-fatal (`sendInquiryMessage.ts` lines 148–153). The message and the status update still succeed. T03's report states it as expected.

Columns regranted to `authenticated` after the table revoke, and no others:

- `cart_items`: `updated_at` only (R-LOCK). SELECT and DELETE stay. Anon stays SELECT only. No price, quantity, listing, or inquiry column.
- `inquiries`: `status` only. INSERT, SELECT, and DELETE stay. Quote columns are not regranted. `service_role` is untouched.
- `seller_profiles`: `rejected_reason`, `submitted_at`, `status`, `approved_at`. `avg_response_hours` is not regranted. INSERT and SELECT stay.

**DB plan (the one migration is P10M1).**

1. **T01 authors** `docs/03-database/rehearsal/staging-text/P10M1.sql` and `docs/03-database/rehearsal/AUDIT-P10.md`. One transaction, two labelled parts. Part A: the fixed-price add function, the quantity-change function, the quote-accept function, and the quote-send function, each SECURITY DEFINER; the buyer INSERT and UPDATE revoke on `cart_items`, then the `updated_at` re-grant (R-LOCK); the seller quote-column revoke on `inquiries`, with the `status` regrant. Part B: the response-hours trigger and the `seller_profiles` revoke, with the column regrant above. No new table. No edit of `checkout_from_cart`. No settings write. No phone predicate. The checkout lock is kept working by the updated_at re-grant (R-LOCK). The audit records that re-grant as NARROWER, not a FINDING. Do not edit `checkout_from_cart`. Audit every grant, policy, and function: MATCH / BROADER / NARROWER / AUTHORED / MISMATCH / FINDING. A GRANT never closes a BROADER table privilege. Zero MISMATCH before CI. The file is not pasted into this pack.
2. **T02 proves it in CI** on a local Supabase stack. The behaviour-assert harness prints CSV with header `name,expected,actual,pass`. The gate parses that header and stops at the first row that is not four fields. Staging is not written. The cases are the database refusals in §8.
3. **Review** is the planning chat, before apply. Then the human types GO. Apply is irreversible.
4. **T03 applies** the bound file with `apply_migration`. State md5 and byte length before the call. Ledger 1:1. Backfill `BETK_DATABASE_SCHEMA.sql`. Advisors before and after; every delta attributed. Then apply the CI Types drift diff verbatim. No bridge cast left. Close REG-107 on that evidence. Do not remove the app call here. T04 removes it.

## 6. Task table

Model is Grok 4.7 on every row. T01 cuts `feature/phase-10-cart-quote` from `origin/main` after this pack's PR is on `main`. Later tasks stay on that branch.

| T | Work | Model | Thinking | Branch |
|---|---|---|---|---|
| T00 | This pack, then this amendment. Pins. Inventory. Protection change from the INTEGRATION line. | Grok 4.7 | High | `v2-p10-t00` |
| T01 | P10M1 staging text and AUDIT-P10. No apply. | Grok 4.7 | Max | creates `feature/phase-10-cart-quote` |
| T02 | CI proof of P10M1 on a local stack. Staging is not written. | Grok 4.7 | High | `feature/phase-10-cart-quote` |
| T03 | Apply P10M1 after planning-chat review and GO. Ledger 1:1. Schema backfill. Advisors before and after. Types diff verbatim. Closes REG-107. | Grok 4.7 | High | `feature/phase-10-cart-quote` |
| T04 | Quote send on P37 and the P36 check. Accept on P14. Fixed-price add via the function. `createInquiry` refusal. P04: Add to cart only for a priced listing that is not made-to-order, and Request price only for a made-to-order or unpriced listing. The two never show together. T04 may edit P04 for the Add-to-cart button's visibility as well as the Request price visibility and label (D2, R-ADD). Remove the app `avg_response_hours` call. | Grok 4.7 | High | `feature/phase-10-cart-quote` |
| T05 | P66 composing CartLine. Goods subtotal and the R-DELIVERY line. `cartLine.droppedQuote` in ar and en. P13 drops the checkout CTA. Bottom-nav Cart tab, app-side from `AppChrome`, no kit change. D4-sanctioned `AppTopbar` edit plus the kit manifest update in the same commit, wired with the signed-in buyer's cart count. Guard F 31 → 32 in the commit that adds P66. | Grok 4.7 | High | `feature/phase-10-cart-quote` |
| T06 | Exit evidence. Opens the one PR. | Grok 4.7 | Max | `feature/phase-10-cart-quote` |

### Mapping

| Source row | T |
|---|---|
| Phase 10: T00 write the pack | T00. This amendment is P10-T00-FIX, same branch, same PR. |
| P10M1 part A (cart and quote) and part B (REG-107) | T01 authors, T02 proves, T03 applies. T03 closes REG-107. |
| Phase 10: Quote write on P37; accept on P14 inserts `cart_items` | T04, through the functions. Includes the P36 check (R-P36), the D2 change on P04, the fixed-price add (R-ADD), and removal of the app `avg_response_hours` call. |
| Phase 10: P66 cart, composing CartLine; P13 list drops the checkout CTA | T05. Also the two cart entry points (D1 as amended by D4) and Guard F 31 → 32. The `AppTopbar` edit and the kit manifest update are that same commit. |
| Phase 10: Exit evidence | T06 |

### Carry-forwards

**CartLine.** Compose it. Do not restyle it. `cartLine.droppedQuote` is the key Claude Design proposed (CD-DELTA-6 Wave 2). T05 writes the ar and en catalog entries. The other string props already on `CartLineProps` in `src/components/shared/CartLine.tsx` are catalog strings in that same task. No new prop. `currencyLabel` takes the string pages already pass to PriceBlock's `currency` prop. `checkoutSections.loading` is Phase 11.

**REG-79.** Pinned B in §4. No phone check anywhere in this phase.

**REG-82.** Implemented only by the existing R-C07 restore path. The dropped-quote prompt is the catalog key above.

**REG-43.** Do not start maintaining `inquiries.last_message_at`.

**Guard F.** Pin 31. T05 raises it to 32 only in the commit that adds the P66 `page.tsx`, with the UI spec route already P66. No other task raises it. OD-21 stays 79.

**Q1.** Expected residue stays the N27 set plus the two fixture accounts and the append-only rows they own. The restore test does not disable a history rule.

**R-DELIVERY.** Carry-forward to Phase 11. In Phase 10, P66 shows the goods subtotal and a "delivery is calculated at checkout" line. Phase 11 builds the read-only delivery preview that P15 needs before placing an order, then adds the delivery figure and the total to P66.

**REG-113.** Carry-forward to Phase 11. Checkout keeps charging live `listings.price` for a fixed line until that migration. Precondition: P10M1 applied. The row lock stays working under R-LOCK (UPDATE of `updated_at` only). Phase 11's checkout change is the price copy, not a lock repair. Phase 10 does not edit the function.

**REG-115.** Carry-forward to Phase 11. `checkout_from_cart` does not refuse a line whose store is not active (lines 792–809; the store join at lines 896–898 is governorate only). Owner: the Phase 11 checkout migration, before the Phase 11 exit. Phase 10 does not edit the function.

**REG-114.** Owner is Cursor in P10-T05 under the D4 human sanction. CD-DELTA-7 is withdrawn and was never sent. T05 makes the sanctioned `AppTopbar` edit, updates the kit manifest in that commit, and wires the signed-in buyer's cart count. Closes before the Phase 10 exit.

**No personal data** in any report or repo file.

### FLAGs

D3 approved these. Each is RESOLVED. Do not reopen them by guessing.

1. **FLAG-ENFORCE → R-ENFORCE. RESOLVED (D3).** The database is the authority for cart and quote rules. Cart add (fixed price, account only, tracked stock bounded, `unit_price` set from the listing), quantity change (stock bounded), and quote accept (own inquiry, quote present and unexpired, one custom line at `quoted_price`) become SECURITY DEFINER functions. The quote send becomes a SECURITY DEFINER function: store owner only; band via `checkout_quote_multiplier`; prep required; `quote_expires_at` from `quote_validity_hours`, failing closed; made-to-order or unpriced listing only (D2). Revoke the buyer's direct INSERT and UPDATE on `cart_items` (SELECT and DELETE stay under RLS), and the seller's direct UPDATE of the quote columns on `inquiries`. A column revoke does not close a table-level grant: revoke the table privilege and re-grant only the columns that legitimate writers still need. **R-LOCK (planning chat, 2026-10-06).** This note cites R-ENFORCE and supersedes "do not regrant any `cart_items` column" and the row-lock FINDING. `checkout_from_cart` is SECURITY INVOKER and takes `FOR UPDATE` on the buyer's `cart_items` (`v2_08_functions.sql` lines 784–787). PostgreSQL requires UPDATE privilege on at least one column for that lock. Part A re-grants UPDATE (`updated_at`) only, on `cart_items`, to `authenticated`. `cart_items_update` still limits it to the buyer's own rows. No price, quantity, listing, or inquiry column is writable. A direct buyer UPDATE of `quantity` or `unit_price` stays refused.
2. **FLAG-REG-107-SHAPE → R-107. RESOLVED (D3).** An AFTER INSERT trigger on inquiry messages (SECURITY DEFINER) recomputes `avg_response_hours` with exactly the formula in `recomputeSellerAvgResponseHours` (`computeAvgResponseHours`, `messagingRules.ts` lines 82–98). The seller session's direct write is revoked, using the same table-revoke and column-regrant method. The app call is removed in T04, the task that wires the functions.
3. **R-ONE-MIGRATION. RESOLVED (D3).** R-ENFORCE and R-107 are one migration, P10M1, in two labelled parts, with one review and one GO.
4. **FLAG-ADD → R-ADD. RESOLVED (D3).** The fixed-price add goes to T04, together with the D2 change on P04. `add_fixed_cart_item` refuses made-to-order (AC-QTE-6; custom = made-to-order per the D2 mapping). P04 shows Add to cart only for priced, non-made-to-order listings, and Request price only for made-to-order or unpriced ones. The two never show together. T04 may edit P04 for the Request price visibility and label, for the Add-to-cart button's visibility, and the `addToCart` action.
5. **FLAG-P36 → R-P36. RESOLVED (D3).** T04 checks P36 against UI spec P36 (`buyerLabel`, no buyer name, no confirm-order action) and fixes any mismatch.
6. **FLAG-DELIVERY → R-DELIVERY. RESOLVED (D3).** Recorded as a carry-forward to Phase 11, above.

**FINDING (checkout price), approved by D3, not a Phase 10 object.** `checkout_from_cart` writes `order_items.unit_price` and the seller order subtotal from the live `listings.price` for fixed lines, not from `cart_items.unit_price` (migration lines 1044–1045 and 867–872). This contradicts R-C06, AC-CART-3, and the ERD / ADR-025 statement that checkout copies `unit_price` (ERD §3.3; ADR-025 points that copy at ERD §3.3). Phase 10 makes `unit_price` writable only by the cart functions. Phase 11 changes checkout to charge the snapshot. Open as REG-113.

## 7. Canonical prompts

T00 is this file. Do not re-run it. P10-T00-FIX is the amendment on the same branch. Do not re-run it either.

### T01

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T01 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: cut feature/phase-10-cart-quote from origin/main after the T00 PR is on main. State the SHA.

P10M1 staging text and AUDIT-P10. One transaction, two labelled parts. Part A: fixed-price add, quantity change, quote accept, and quote send, each SECURITY DEFINER, plus the cart_items INSERT/UPDATE revoke and the inquiries quote-column revoke, with the status regrant in §5. Part A also re-grants UPDATE (updated_at) only on cart_items to authenticated (R-LOCK). cart_items_update still limits that to the buyer's own rows. No price, quantity, listing, or inquiry column is regranted. Part B: the inquiry-message AFTER INSERT trigger for avg_response_hours, formula cited in §6 R-107, plus the seller_profiles table revoke and the column regrant in §5. Do not grant avg_response_hours. Do not edit checkout_from_cart. The row lock is kept working by the updated_at re-grant (R-LOCK). AUDIT-P10 records that re-grant as narrower than today's table grant, with the reason. It is not a FINDING. No new table. No phone predicate. No settings write. Audit every grant, policy, and function with MATCH, BROADER, NARROWER, AUTHORED, MISMATCH, FINDING. A GRANT never closes a BROADER table privilege. Zero MISMATCH. Do not call apply_migration. Do not write staging. This prompt has no SQL body. Do not paste the staging text into the pack.

Done-when: P10M1.sql and AUDIT-P10.md exist, the audit records zero MISMATCH, the checkout function is untouched, and the text is not applied. Ledger is still 41, last 20261004172620.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 10 tasks stay on feature/phase-10-cart-quote until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: docs/03-database/rehearsal/staging-text/P10M1.sql, docs/03-database/rehearsal/AUDIT-P10.md, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_10_CART_QUOTE.md §9.
Commit message: docs(p10-t01): P10M1 staging text and audit
```

### T02

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T02 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: feature/phase-10-cart-quote.

CI proof of P10M1.sql on a local Supabase stack. Do not apply to staging. The harness prints CSV with header name,expected,actual,pass. The gate parses that header and stops at the first row that is not four fields. Cases: a direct buyer INSERT and a direct buyer UPDATE on cart_items are refused; a direct seller UPDATE of the quote columns is refused; the quote function refuses out-of-band, missing prep, and a listing that is neither made-to-order nor unpriced; accept refuses an expired quote; add refuses a guest and a quantity above tracked stock; a direct avg_response_hours write is refused and the trigger stores the value from the cited formula. Also prove, on the local CI stack only, that a buyer's checkout_from_cart gets past the row lock without a permission error. Set payment_window_minutes as a test fixture there, never on staging. Also prove that a direct buyer UPDATE of quantity or unit_price is still refused. Prove every new refusal on the local stack: send_inquiry_quote raises BETK_QUOTE_LINE_HELD when any cart line references the inquiry and stores nothing; removing that line, then a fresh in-band quote and accept, stores the new quote and one cart line; add_fixed_cart_item, accept_inquiry_quote, and send_inquiry_quote each refuse a listing that is not active, is deleted, or whose store is suspended, and store nothing; accept_inquiry_quote and send_inquiry_quote refuse an inquiry whose status is declined and store nothing; a buyer message insert does not fire the response-hours recompute. Do not edit checkout_from_cart.

Done-when: the CI run is green and the CSV gate passes, including the local-stack checkout row-lock proof, the refused quantity and unit_price updates, and every new refusal above. list_migrations on staging is unchanged. payment_window_minutes is not written on staging.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 10 tasks stay on feature/phase-10-cart-quote until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the CI workflow and assert harness this task adds, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_10_CART_QUOTE.md §9.
Commit message: ci(p10-t02): prove P10M1 on a local stack
```

### T03

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T03 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: feature/phase-10-cart-quote.

Apply the bound P10M1.sql. STOP unless the planning chat has reviewed T01 and T02 and the human has typed GO. Before apply_migration, state the query argument's md5 and byte length and show they equal the file. Ledger 1:1 after. Backfill BETK_DATABASE_SCHEMA.sql. Advisors before and after; every delta attributed. Apply the CI Types drift diff verbatim. No bridge cast. Close REG-107. Do not remove the app avg_response_hours call (T04 does that). Do not edit checkout_from_cart. Do not write payment_window_minutes. Do not disable an append-only rule.

Done-when: the applied version matches the file's md5 and byte length, REG-107 is closed in SESSION_CONTEXT, and the seller session cannot persist an arbitrary avg_response_hours on staging.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 10 tasks stay on feature/phase-10-cart-quote until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the applied migration file, BETK_DATABASE_SCHEMA.sql, types.ts only if the CI diff changed it, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_10_CART_QUOTE.md §9.
Commit message: feat(p10-t03): apply P10M1 and close REG-107
```

### T04

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T04 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: feature/phase-10-cart-quote.

Quote send on P37 calls the quote-send function. Accept on P14 calls the quote-accept function. Fixed-price add calls the add function from addToCart (R-ADD). createInquiry refuses a listing that is neither made-to-order nor unpriced (D2, R-Q01). P04: Add to cart shows only for a priced listing that is not made-to-order. Request price shows only for a made-to-order or unpriced listing, and its label is the UI spec P04 label "Request price". The two controls never show together, because add_fixed_cart_item refuses made-to-order (AC-QTE-6; custom = made-to-order per the D2 mapping). Edit P04 for the Request price visibility and label, and for the Add-to-cart button's visibility. Check P36 against UI spec P36 (buyerLabel, no buyer name, no confirm-order action) and fix any mismatch (R-P36). Remove the confirm-to-checkout control on P37. P14 has no checkout button. Remove the app call to recomputeSellerAvgResponseHours. Do not hard-code 2 or 24. Do not add a cron. Do not encode a phone check. Do not call checkout_from_cart. Do not restyle the kit.

Zod-validate the actions before any database call. RLS denial is not-found. Compose MessageThread, Input, and Button.

Done-when: a seller quote below the listing price, above the ceiling, without prep, or on a listing that is neither made-to-order nor unpriced is refused; a quote on the closed interval for an eligible listing stores quoted_price, quoted_prep_days, quoted_at, and quote_expires_at; buyer accept inserts one cart line at that price; accept after quote_expires_at inserts nothing; a guest add and an over-stock add are refused; an in-stock fixed-price add inserts one line at the listing price; P04 shows Add to cart only for a priced listing that is not made-to-order, and Request price only for a made-to-order or unpriced listing, and the two never show together; P37 has no confirmInquiry control; P36 matches the spec check; P14 has no checkout button; the app no longer writes avg_response_hours.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 10 tasks stay on feature/phase-10-cart-quote until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the P37, P36, P14, and P04 files this task edits, addToCart, createInquiry, the quote and accept actions and their Zod schemas, the removal of the avg_response_hours call, the ar/en strings those screens need, the tests for the Done-when lines, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_10_CART_QUOTE.md §9.
Commit message: feat(p10-t04): quote, accept, and fixed-price add
```

### T05

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T05 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: feature/phase-10-cart-quote.

P66 /cart, composing CartLine. Do not restyle CartLine. Show the goods subtotal and a delivery line that delivery is calculated at checkout (R-DELIVERY). Do not show a delivery figure or a grand total. Do not call checkout_from_cart. Write cartLine.droppedQuote in ar and en, and the other string props already declared on CartLineProps. P13's list has no checkout CTA. Quantity change and remove go through the quantity function and the existing DELETE, which stays under RLS. Guest add still leaves zero cart_items. Blocked is derived (stock or quote_expires_at), not a column. Raise Guard F from 31 to 32 only because this task adds the P66 page.tsx. OD-21 stays 79.

Cart entry, D1 as amended by D4. The bottom-nav Cart tab is app-side: MobileBottomNav items come from AppChrome. Add the tab there. Do not change MobileBottomNav. The top-bar cart button is the recorded human sanction for a Cursor edit of src/components/shared/AppTopbar.tsx, the first human sanction under the kit-integrity rule. Scope, and nothing outside it: optional props onCartClick, cartCount, cartLabel. The button renders only when onCartClick is set. With none of the props, the markup is identical to main. The button is an exact copy of the existing notifications button (same element, same classes, same focus ring), with a lucide cart icon in place of the bell. It shows the same dot indicator when cartCount > 0 and no number. The count goes into the accessible name, which the page passes. cartLabel has no default. Nothing else in AppTopbar.tsx changes. Update docs/00-design/kit-manifest.json in the same commit. Wire onCartClick, cartCount, and cartLabel from AppChrome with the signed-in buyer's cart count. A guest passes no cart props, so the button is absent.

Done-when: /cart renders CartLine for the buyer's rows; the delivery line says delivery is calculated at checkout and there is no delivery figure; a qty change or a remove changes the goods subtotal; an expired custom line is blocked and a dropped restore line shows cartLine.droppedQuote; P13 has no checkout control; the phone bottom nav has a Cart tab and the signed-in top bar shows the cart button (dot when the count is above zero, count in the accessible name, no number); the AppTopbar diff is only the cart button and its three props, and the markup with no props is unchanged; the kit manifest is updated in that commit; Guard F pin is 32; REG-114 is closed by that edit.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 10 tasks stay on feature/phase-10-cart-quote until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the P66 route, the P13 list, AppChrome (bottom-nav Cart tab and the cart props), src/components/shared/AppTopbar.tsx, docs/00-design/kit-manifest.json, the cart query and qty/remove actions, messages ar/en, the page-count pin, the tests for the Done-when lines, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_10_CART_QUOTE.md §9.
Commit message: feat(p10-t05): cart page and both entry points
```

### T06

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T06 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: feature/phase-10-cart-quote.

Exit evidence. Paste a result for every §8 row. STOP if a row has no automated evidence. A hidden control is not evidence. The payment-window cases follow §5: a past payment_deadline, a no-JWT cancel, restore_stock_on_cancel. Do not write payment_window_minutes. Do not choose a window. Do not add a cron. Do not call checkout_from_cart. The full integration suite is green. REG-107 is already closed by T03; re-read the row and paste the evidence. REG-114 is closed. Q1 holds: do not disable a history rule. Delete only rows this test inserted. If a delete fails, STOP.

Done-when: each §8 row is green, the full integration suite is green, REG-107 is closed, REG-114 is closed, and SESSION_CONTEXT says Phase 10 exit holds — or the miss is a named forward-fix and the exit does not hold.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD
This task is where the PR is due (W1). If this branch has no open pull request, gh pr create with the title equal to the commit subject and the body equal to this task's evidence summary. If a pull request for this branch is already open, do not open a second one.
Do not merge. Do not bypass checks.
File list: the integration tests this task adds, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_10_CART_QUOTE.md §9, plus any evidence note this task adds under docs/.
Commit message: test(p10-t06): Phase 10 exit evidence
```

## 8. Exit gate

Each case the `BETK_PHASES.md` Phase 10 exit line names is an integration test. AC-CART-1..7 and AC-QTE-1..6 are all in that set. A hidden widget is not a pass. The full integration suite is green. REG-107 is closed before this task reports the exit. REG-114 is closed before this task reports the exit. AppTopbar without the cart props is unchanged.

| # | Exit item | Evidence |
|---|---|---|
| 1 | AC-CART-1. Guest add leaves zero `cart_items`. | Integration: guest attempt, row count unchanged, no new id. The add function refuses the guest. |
| 2 | AC-CART-2. Over-stock add is refused. | Integration: tracked stock S, qty S+1, cart unchanged. Qty at or under S inserts that quantity. The add function is the writer. |
| 3 | AC-CART-3. Snapshotted price survives a listing edit. | Integration: line at P, listing price becomes P′, line still P. Checkout still charging P′ is REG-113, not a fail of this row. |
| 4 | AC-CART-4. Expired quote blocks the line. | Integration: `quote_expires_at` in the past, the line is the blocked one. Removing the line, then a fresh in-band quote and accept, clears the block. |
| 5 | AC-CART-5. Tracked line at zero availability is blocked. | Integration: the cart read names that line. Phase 11's checkout refusal stays in `checkout_from_cart`. |
| 6 | AC-CART-6. Qty or remove changes the running subtotal. | Integration: the goods subtotal moves. The delivery line is the R-DELIVERY text. The figure and the total are not this row. |
| 7 | AC-CART-7. Payment-window expiry restores per REG-82. | Integration, method in §5. Fixed-price line returns at the snapshotted price and quantity. Custom line returns only while `quote_expires_at` is in the future; otherwise it is absent and the buyer prompt is `cartLine.droppedQuote`. No write to `payment_window_minutes`. |
| 8 | AC-QTE-1. Guest request creates no quote thread. | Integration: no new `inquiries` row. |
| 9 | AC-QTE-2. Band. | Integration: below the listing price refused; above the ceiling refused; a price on the closed interval stored. The quote function is the writer. |
| 10 | AC-QTE-3. Prep required. | Integration: a quote with no prep is refused and stores nothing. |
| 11 | AC-QTE-4. Accept inserts one line at the quoted price. | Integration: one `cart_items` row, `is_custom` true, `unit_price` equals `quoted_price`. A later listing-price change leaves it. |
| 12 | AC-QTE-5. Accept after validity is refused. | Integration: no new cart row. A line already there is blocked (row 4). |
| 13 | AC-QTE-6. Fixed-price purchase needs no inquiry. A custom item cannot enter at an unquoted price. | Integration: a fixed-price line has `inquiry_id` null. The accept function uses `quoted_price`. A direct INSERT is refused (row 17). |
| 14 | R-Q06. Quote expiry is derived at read. | The row 4 and row 12 tests compare `quote_expires_at` with `now()`. No cron job is added. |
| 15 | Full integration suite. | `pnpm exec vitest run tests/integration` green, and the CI job `Integration (staging)` green on the exit PR. The new refusal rows are part of that suite. |
| 16 | REG-107 closed. | T03's applied version, md5, and the seller-session probe. This row fails if the row is still open. |
| 17 | Direct buyer INSERT on `cart_items` is refused. | Integration: authenticated buyer, error, row count unchanged. |
| 18 | Direct buyer UPDATE on `cart_items` is refused. | Integration: including `unit_price` and `quantity`, error, stored values unchanged. |
| 19 | Direct seller UPDATE of the quote columns is refused. | Integration: `quoted_price`, `quoted_prep_days`, `quote_expires_at`, `quoted_at`. A status update to `replied` or `declined` still succeeds. |
| 20 | Quote function refuses out of band, missing prep, and a listing that is neither made-to-order nor unpriced. | Integration: three refusals, no quote stored. An in-band quote on a made-to-order listing is stored. |
| 21 | Accept refuses an expired quote. | Same evidence as row 12. Listed here so the database refusal is its own row. |
| 22 | Add refuses a guest and a quantity above tracked stock. | Same evidence as rows 1 and 2, through the function. |
| 23 | A direct `avg_response_hours` write is refused, and the trigger computes the value. | Integration: seller UPDATE of that column errors and the stored value is unchanged. A seller message insert leaves the column equal to the `computeAvgResponseHours` result. |
| 24 | D2 on P04. | A made-to-order listing shows "Request price" and does not show Add to cart. A priced listing that is not made-to-order shows Add to cart and does not show Request price. The two never show together. |
| 25 | Both cart entry points. | The signed-in top bar shows the cart button: a dot when `cartCount` > 0, the count in the accessible name, and no number. The phone bottom nav has a Cart tab. |
| 26 | REG-114 closed. | T05 made the D4-sanctioned `AppTopbar` edit and wired the signed-in buyer's cart count. AppTopbar without the cart props is unchanged. This row fails if the diff is anything other than the cart button and its three props. |
| 27 | R-FREEZE. A re-quote while a line is held. | A re-quote while a line is held is refused and stores nothing. |
| 28 | R-AVAIL. Store not active. | Each function refuses a listing whose store is suspended. |
| 29 | R-DECLINED. | Accept and send refuse a declined inquiry. |
| 30 | R-TRIGGER. Buyer message. | A buyer message does not fire the recompute. |

Phone-NULL submit navigating to `/auth/phone` is Phase 11's exit (FR-AUTH-4). It is not a Phase 10 row.

REG-79 stays pinned B. This phase does not close it by adding a cart phone check. REG-82 stays the closed product pin; row 7 is the implementation evidence. REG-93 stays open for Phase 11. REG-113 stays open for Phase 11. REG-114 is closed in T05. REG-115 stays open for Phase 11.


## 9. Results tracker

| Task | Status | Evidence pointer |
|---|---|---|
| T01 | Done | `docs/03-database/rehearsal/staging-text/P10M1.sql` and `docs/03-database/rehearsal/AUDIT-P10.md`. Not applied. `list_migrations` 41, last `20261004172620`. Zero MISMATCH. R-LOCK: `UPDATE (updated_at)` only, recorded NARROWER. Branch `feature/phase-10-cart-quote` cut from `dda164e10569569605735972663a6d00ae8c318f`. |
| T01-FIX | Done | Same files, amended. R-FREEZE, R-AVAIL, R-DECLINED, R-TRIGGER. Audit re-run: zero MISMATCH, zero BROADER, one row per ruling. P10M1 LF md5 `1b148df55a578cd1d20556d90adc65b3`, 18635 bytes. Took REG-115. Not applied. Ledger still 41. |
| T02 | Done | `.github/workflows/p10-db.yml` and `docs/03-database/rehearsal/p10/asserts.sql`. Pin method is `p09-db.yml` (delete, then checkout of `dda164e10569569605735972663a6d00ae8c318f`). LF md5 gate before apply. 41 cases plus `all_pass`. Green run [37439157455](https://github.com/Jovo-Jovi/betk/actions/runs/37439157455) on `73d7c2e`. Staging not written. |
| T03 | Done | Applied `20261006100204` / `v2_10_cart_quote`. Stored statement md5 `1b148df55a578cd1d20556d90adc65b3`, 18635 bytes. Ledger 42, 1:1. REG-107 closed. The app `avg_response_hours` call stays until T04. |
| T04 | Done | Quote, accept, and fixed-price add. REG-116 minted and closed (T03 history-statement process; human RATIFY 2026-10-06). P36 checked, no mismatch. The app no longer writes `avg_response_hours`. Unit 9 passed. Integration 4 passed. `inquiry.writeLayer` 14 passed. |
| T05 | Done | P66 `/cart` and both entry points. REG-114 closed. None taken. Guard F pin 32 (OD-21 stays 79). AppTopbar hash `617d482fe64e5fcd102f3e356d501493f53b568d17b5e7765ef9d80a1eb8924e`. R-NEWQUOTE, R-DROPPED, R-BLOCKED. Unit `p10t05.cart.unit.test.ts` 21 passed. `pnpm typecheck` and `pnpm guards` exit 0. |
| T06 | Exit does not hold | `tests/integration/p10t06.exit.test.ts`. Local suite 2026-10-06 16:56:53 +0300, 437.10s: 33 files, 231 passed, 2 skipped. §8 rows are in the SESSION_CONTEXT P10-T06 bullet. Forward-fix: dropped-quote prompt under RLS (a committed history row cannot be deleted). None taken. Next free stays REG-117. Exit pending CI. |
| T06-FIX | Phase 10 exit holds | Took REG-117 and closed it, citing ACKNOWLEDGE (human, 2026-10-06). §8 row 7 PASS on (a) local harness reads (buyer A sees the cancelled order, custom item, cancelled history timestamp, and inquiry quote; buyer B sees none), (b) `getCartPage` cancelled `seller_orders` select returned ok:true on the p10t06 runs (local suite 2026-10-06 16:56:53 +0300; CI Integration (staging) [37476549103](https://github.com/Jovo-Jovi/betk/actions/runs/37476549103) on `30636fb`), (c) unit window and `droppedQuote` render cases in `p10t05.cart.unit.test.ts`. Limit: getCartPage is not run with a dropped prompt on staging, because a committed cancellation time is an append-only row. P10M1 LF md5 stays `1b148df55a578cd1d20556d90adc65b3`. Next free REG-118. Phase 10 exit holds (2026-10-09): PR #79 merged 2026-10-09 07:18:12 UTC as `1540adedc1fbe463a3f0d0abb95ed8f61470ec8c`, head `4cc71975001ba0c36239ef412f2ddf72b7ac295a`. CI [37627719450](https://github.com/Jovo-Jovi/betk/actions/runs/37627719450) on that head: all nine required checks green, including Integration (staging), full suite (33 files, 231 passed, 2 skipped). P10 local proof [37627712227](https://github.com/Jovo-Jovi/betk/actions/runs/37627712227): 50 rows, `all_pass` `true|49`, P10M1 md5 `1b148df55a578cd1d20556d90adc65b3`. `4cc7197` also changed `.github/workflows/p10-db.yml` outside T06-FIX's file list: only the expected counts (42→50 rows, `true|41`→`true|49`); the md5 gate is unchanged. |

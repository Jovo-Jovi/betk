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

P10-T00 re-read (2026-10-06), before any mint: header REG-01..REG-112, next free **REG-113**, no REG-113 row. **None taken.** Next free stays **REG-113** / **OD-22** / **ADR-026**.

REG-79 is updated in place. It is not a new number. Status: **PINNED 2026-10-05 (B).** The pin text is §4.

REG-107 is owned by Phase 10 and closes before the exit. **T05 closes it**, after T03 authors the staging text and the audit and T04's CI proof is green, and after the planning-chat review of that audit and the human's GO. It needs a database change: live `information_schema.column_privileges` (SELECT 2026-10-06) grants `authenticated` UPDATE on `seller_profiles.avg_response_hours`, and policy `sp_update` is owner-or-admin with no column restriction. The app writer is `recomputeSellerAvgResponseHours` in `src/features/messaging/actions/_shared.ts`, called from `sendInquiryMessage` on the seller's own session. An app-only change would leave that grant in place, so the seller could still store any value. The change goes through the full staging-text → AUDIT → CI-proof → apply cycle. This pack contains no SQL body. **FLAG-REG-107-SHAPE** (below) names the open choice. T03 does not author a shape until the planning chat names one.

REG-82 is a closed product pin. Phase 10 implements it by the R-C07 path already in `restore_stock_on_cancel` (ERD §3.3; live trigger `trg_restore_stock_on_cancel`). Phase 10 does not reopen the pin and does not add a sweeper. The sweeper is Phase 11 (`BETK_PHASES.md` §8).

## 4. Pins

**Decision (human, 2026-10-05), verbatim.**

REG-79 (human, 2026-10-05): "REG-79 = B. The verified-phone gate fires at checkout, not at add-to-cart. Add-to-cart and quote accept (P14) require an account only (N21, R-C01). Named phone-verification holds remain checkout, become-seller, and payout (R-A07, AC-AUTH-4). Database authority remains the existing RESTRICTIVE master_orders_phone_gate; no phone predicate is added to cart_items. Phase 10 encodes no phone check. Phase 11 owns FR-AUTH-4; where inside checkout the /auth/phone redirect fires is Phase 11's choice, and its exit already requires the phone-NULL submit case."

**INTEGRATION, the launch line, verbatim.**

INTEGRATION: required

**Protection after STEP 3.** Method: `PATCH repos/Jovo-Jovi/betk/branches/main/protection/required_status_checks` with `strict: true` and the previous eight contexts plus `Integration (staging)`, each `app_id` 15368. Re-read with the same `gh api` as §1.

`required_status_checks.contexts` after: `RLS smoke (staging)`, `Install`, `Lint`, `Typecheck`, `Vitest (unit)`, `Guards`, `Types drift`, `Build`, `Integration (staging)`. `strict` true. `enforce_admins.enabled` true. `allow_force_pushes.enabled` false. `allow_deletions.enabled` false.

The job name in `.github/workflows/ci.yml` is already `Integration (staging)`. On a pull request that does not change `src/`, `tests/`, or `supabase/`, the job still completes: the detect step sets `run=false` and the suite steps are skipped. This docs PR can satisfy the new required check.

## 5. Enforcement inventory and the DB plan

Server-side evidence for a refusal is the database error or the server-action result. A hidden control is not evidence. Every schema fact below was read on 2026-10-06 from the live database (MCP `execute_sql`) or from the file cited next to it. Anything not settled is a FLAG in §6.

**Phone.** Live restrictive INSERT policies, none of them on `cart_items`: `master_orders_phone_gate` on `master_orders`; `orders_phone_gate` on `seller_orders` (name kept across the rename); `seller_profiles_phone_gate` on `seller_profiles`; `payouts_phone_gate` on `payouts`. Each WITH CHECK requires `users.phone_number IS NOT NULL` for `auth.uid()`. `cart_items` policies are `cart_items_select`, `cart_items_insert`, `cart_items_update`, `cart_items_delete`. None of their expressions mention phone. Live columns on `cart_items`: `id`, `buyer_id`, `listing_id`, `quantity`, `unit_price`, `is_custom`, `inquiry_id`, `created_at`, `updated_at`. No phone column. Phase 10 adds no phone predicate and no phone check in the cart or quote actions.

**Inbox routes moved from signed Phase 06.** `BETK_PHASES.md` §2: Phase 06 `PAGES:` none and `CODES:` none. "The quote behaviour and the inbox routes moved to Phase 10." `inquiries.last_message_at` stays unmaintained (REG-43, closed): sort from `max(inquiry_messages.sent_at)`. The routes are already on `main`: `src/app/[locale]/(buyer)/inbox/page.tsx` (P13), `inbox/[id]/page.tsx` (P14), `(seller)/seller/inbox/page.tsx` (P36), `seller/inbox/[id]/page.tsx` (P37). Phase 10 edits those files. It does not add a second inbox route. UI spec headings say `/inbox/[inquiryId]` and `/seller/inbox/[inquiryId]`; the built segment is `[id]`. That is the same route pattern (one dynamic segment). P66 `/cart` has no `page.tsx` (glob, 2026-10-06). T02 adds that one file and raises Guard F's pin from 31 to 32 in the same commit (`scripts/check-page-count.mjs`, `PINNED_PAGE_COUNT = 31`). OD-21 stays 79.

**Quote settings, not a Phase 10 pin.** `quote_validity_hours` equals `24`. `quote_tolerance_multiplier` equals `2`. Both match the M3 documented defaults (plan §8.2.5). `payment_window_minutes` length is 0. `checkout_payment_window_minutes()` is SECURITY DEFINER and its body contains `BETK_PAYMENT_WINDOW_UNCONFIGURED`. `checkout_from_cart(p_delivery_address_id uuid)` is INVOKER and its body calls `checkout_payment_window_minutes`. Phase 10 does not write `payment_window_minutes` and does not choose a duration (REG-93, before Phase 11).

**Payment-window expiry without pinning REG-93.** The exit test does not call `checkout_from_cart` and does not write the settings key. It uses the restore function Phase 10's exit is told to test (`BETK_PHASES.md` §8: "Phase 10's exit tests restore as a function").

1. A session with `auth.uid()` null inserts a `master_orders` row whose `proof_path` is null and whose `payment_deadline` is already before `now()`, a `seller_orders` row in `pending`, and `order_items` for one fixed line (`inquiry_id` null) and one custom line.
2. The same no-JWT session sets that seller order's status to `cancelled`.
3. Live `enforce_order_transition` (SECURITY DEFINER; trigger `trg_enforce_order_transition`) contains `auth.uid() IS NULL`, `v_proof IS NULL`, and `now() >= v_deadline`, and it stamps `cancelled_by`. The applied body in `BETK_DATABASE_SCHEMA.sql` places those three predicates on the `pending → cancelled` system branch.
4. Trigger `trg_restore_stock_on_cancel` runs `restore_stock_on_cancel()`. Its body contains `quote_expires_at > now()`. The applied body inserts a fixed-price `cart_items` row for every `order_items` row with `inquiry_id` null, and a custom row only when the joined quote is still in the future (REG-82, R-C07).
5. A second case sets `quote_expires_at` in the past and asserts that the custom line is absent.

`BEFORE INSERT` trigger `trg_set_order_commission_snapshot` runs `set_order_commission_snapshot()` on `seller_orders`. A missing `commission_rate_pct` key raises `BETK_COMMISSION_CONFIG_MISSING`. The live key is not blank (length 1). The fixture supplies `subtotal` because the function stamps commission from it. `AFTER INSERT` trigger `trg_decrement_stock_on_checkout` runs `decrement_stock_on_confirm()` on `order_items`, so a tracked line's stock moves down on the insert and back on the cancel. None of `enforce_order_transition`, `restore_stock_on_cancel`, or `set_order_commission_snapshot` mentions `order_status_history` (body search, 2026-10-06). The test deletes only the rows it inserted. It does not disable `no_delete_order_history` or `no_update_order_history` (both live `DO INSTEAD NOTHING` rules). If a delete fails, the test stops and reports the counts. It does not widen Guard G.

The production sweeper stays Phase 11. Quote expiry at 24h is not a cron (`BETK_PHASES.md` §8). It is derived at read from `quote_expires_at`.

**Does Phase 10 need any migration at all?** Yes, one, for REG-107 only. No other migration is authorized by this pack. Cart and quote refusals that have no live constraint are **FLAG-ENFORCE**. The delivery figure on P66 is **FLAG-DELIVERY**. This pack does not invent either object.

| Code | Where it is enforced today | What Phase 10 adds |
|---|---|---|
| FR-CART-1 | The family is R-C01–R-C07. Storage is `cart_items` (ERD §6.1; live columns above). No `/cart` page. | P66 and the writes the task table names. See the R-C rows. |
| FR-BUY-5 | Buyer inbox routes exist (P13, P14). Amendment: the confirmed-inquiry checkout CTA is retired (`BETK_PRD.md` FR-BUY-5). P14 renders a confirmed banner with no checkout link (`inbox/[id]/page.tsx`). P13's list links to the thread (`routes.buyer.inboxThread`), not to checkout. | T02 keeps P13 free of a checkout control. T01's accept on P14 inserts `cart_items` and does not add a checkout button (UI spec P14). |
| FR-SEL-13 | Seller inbox routes exist (P36, P37). P37 still mounts `InquiryStatusActions`, which calls `confirmInquiry` (`seller/inbox/[id]/_components/InquiryStatusActions.tsx`). That is the retired confirm-to-checkout control. | T01 replaces that control with the quote write. No checkout-enable control (UI spec P37). |
| FR-QTE-1 | Quote columns are live on `inquiries`: `quoted_price`, `quoted_prep_days`, `quote_expires_at`, `quoted_at` (all nullable). `quoted_price` CHECK allows null or `> 0`. `quoted_prep_days` CHECK allows null or `>= 0`. Policy `inq_update` is the store or admin. No band trigger. No triggers on `inquiries` (live `pg_trigger`, 2026-10-06). | T01 writes the quote on P37 and the accept on P14. Band, prep, and expiry behaviour are the R-Q rows. |
| R-C01 | `cart_items_insert` WITH CHECK `buyer_id = auth.uid()`. INSERT/UPDATE/DELETE on `cart_items` are revoked from `anon`; `anon` keeps SELECT. `addToCart` returns `unauthenticated` for a guest and `unavailable` for a signed-in buyer (`src/features/discovery/actions/addToCart.ts`). A guest insert creates no row (P09-T09, `42501`). | Phase 10 still refuses the guest. The authenticated fixed-price add is **FLAG-ADD**. Quote accept (account only) is T01. No phone check. |
| R-C02 | Table `cart_items` plus the four self policies. Partial unique indexes `uq_cart_items_listing` `(buyer_id, listing_id) WHERE inquiry_id IS NULL` and `uq_cart_items_inquiry` `(buyer_id, inquiry_id) WHERE inquiry_id IS NOT NULL`. | The cart page reads that table. No new table. |
| R-C03 | No cart page. No live function whose name contains `cart`, `deliver`, or `courier` except `checkout_from_cart` and `checkout_quote_multiplier`. The combined delivery total is stored on `master_orders` at checkout (REG-91, ADR-023). | **FLAG-DELIVERY.** T02 does not invent a rate function. Subtotal is the sum of `quantity * unit_price` on the buyer's rows. |
| R-C04 | `listings.stock_qty` null means untracked (ERD §10.1). No trigger on `cart_items`. No CHECK that `quantity` is within stock. Live CHECK is only `quantity > 0`. | **FLAG-ENFORCE.** Until the chat decides, the add/accept action refuses tracked qty above live stock. A direct INSERT can still exceed stock. |
| R-C05 | No `blocked` column (live column list; ERD §6.1). Blocked is derived from `stock_qty` or `quote_expires_at`. `checkout_from_cart` already raises `BETK_CHECKOUT_QUOTE_EXPIRED` and `BETK_CHECKOUT_OUT_OF_STOCK` (schema source; those names are the Phase 11 checkout, already applied). | The cart read derives the blocked reason. CartLine's reasons stay `stock` and `quote_expired` (component props). No new column. |
| R-C06 | `unit_price` is a `cart_items` column. CHECK `unit_price > 0`. No trigger copies `listings.price` onto the cart, so a later listing edit does not by itself change the row. `authenticated` has table UPDATE, and `cart_items_update` does not restrict columns, so the buyer can change `unit_price`. | The accept/add writes `unit_price` once, from the quote or the listing, and does not rewrite it when the listing price changes. **FLAG-ENFORCE** covers a direct UPDATE of `unit_price`. |
| R-C07 | `restore_stock_on_cancel` on `trg_restore_stock_on_cancel`, as §5 describes. REG-82 closed. | The exit test drives it. Phase 10 adds no sweeper and no second restore function. |
| R-Q01 | Checkout does not write `inquiries.converted_to_order_id` (CF-4, recorded at P09-T11-FIX). The column is still nullable. | Phase 10 does not build inquiry checkout and does not write that column. |
| R-Q02 | `checkout_quote_multiplier()` reads `quote_tolerance_multiplier` and fails closed when the key is empty or not a positive number (schema source; live function exists, DEFINER). Checkout uses it. Nothing checks the band when a seller updates `inquiries`. | T01 refuses a quote below `listings.price` or above price times the multiplier, at send. It reads the function or the same key. It does not hard-code `2` as a second source. **FLAG-ENFORCE** for a direct UPDATE. |
| R-Q03 | `quote_validity_hours` is `24`. No function writes `quote_expires_at`. The column is nullable. | T01 sets `quote_expires_at` from that key at send (`quoted_at` plus the hours). An empty key fails closed and writes no quote. Phase 10 does not hard-code 24 beside the key, and it does not add a cron. |
| R-Q04 | `quoted_prep_days` may be null (live CHECK). | T01 refuses a quote that omits prep. **FLAG-ENFORCE** for a direct UPDATE that leaves it null. |
| R-Q05 | No accept action inserts `cart_items`. `chk_cart_item_custom_inquiry`: `is_custom = false AND inquiry_id IS NULL`, or `is_custom = true AND inquiry_id IS NOT NULL`. | T01 accept inserts one custom row: `is_custom` true, `inquiry_id` set, `unit_price` equal to `quoted_price`. |
| R-Q06 | Derived. `checkout_from_cart` refuses a custom line whose `quote_expires_at` is null or not after `now()`. No quote-expiry cron (§8). | Cart and accept treat expiry as that comparison at read. No cron. No notification row. |
| R-Q07 | Same hole as R-Q02 at send time. Checkout re-checks the band (`BETK_CHECKOUT_QUOTE_OUT_OF_BAND` in the schema source). | Send-time refusal is T01, same as R-Q02. |
| R-Q08 | `createInquiry` returns `unauthenticated` when `requireActiveUser` throws `NotAuthenticatedError` (`src/features/messaging/actions/createInquiry.ts`). Policy `inq_insert` WITH CHECK `buyer_id = auth.uid()`. | Phase 10 does not add a guest quote path. |
| AC-CART-1 | Same gate as R-C01. P09-T09 left `cart_items` at 0 for a guest insert. | Exit integration: guest add leaves zero `cart_items`. |
| AC-CART-2 | Not enforced. See R-C04. | Exit integration: qty above tracked stock is refused and the cart is unchanged. **FLAG-ADD** says which task owns the fixed-price add. **FLAG-ENFORCE** says whether the database also refuses it. |
| AC-CART-3 | See R-C06. A listing-price change has no cart trigger to ride on. | The line keeps the snapshotted `unit_price`. |
| AC-CART-4 | Derived, R-C05 / R-Q06. Checkout already refuses the expired custom line. | Exit: an expired quote blocks that line. Clearing it, or a fresh in-band quote, is what unblocks. Checkout itself is Phase 11; this phase's evidence is the cart/accept result naming the line. |
| AC-CART-5 | Derived from `stock_qty` reaching 0. No cart trigger. | The cart read marks the line blocked. Checkout refusal of that line is Phase 11 (`BETK_CHECKOUT_OUT_OF_STOCK` already in `checkout_from_cart`). |
| AC-CART-6 | No cart page. | T02: a qty change inside stock, or a remove, changes the goods subtotal. Delivery and grand total wait on **FLAG-DELIVERY**. |
| AC-CART-7 | `restore_stock_on_cancel`, REG-82. | Exit test in this section. Fixed-price lines return with the snapshotted price and quantity. A custom line returns only while `quote_expires_at` is in the future. The dropped line is the `cartLine.droppedQuote` prompt, written by T02. |
| AC-QTE-1 | Same gate as R-Q08. | Exit: a guest request creates no inquiry. |
| AC-QTE-2 | Not enforced at send. See R-Q02. | Exit: below the listing price is refused; above the ceiling is refused; a price on the closed interval is stored. |
| AC-QTE-3 | Null prep is legal in the CHECK. | Exit: a quote with no prep is refused. |
| AC-QTE-4 | Not implemented. | Exit: accept inserts one `cart_items` row at `quoted_price`, `is_custom` true. A later listing-price change leaves that `unit_price`. |
| AC-QTE-5 | No accept function. Checkout already refuses an expired custom line. | Exit: accept after `quote_expires_at` inserts nothing. A line already in the cart is blocked (AC-CART-4). |
| AC-QTE-6 | `chk_cart_item_custom_inquiry` ties the custom flag to `inquiry_id`. It does not require `unit_price = quoted_price`. Fixed-price checkout does not read `converted_to_order_id`. | Accept of a custom line uses the quoted price. A fixed-price line has `inquiry_id` null. A custom insert at an unquoted price is **FLAG-ENFORCE**. |
| AC-BUY-5 | Implied same-ID AC. `BETK_PRD.md` §1.3: it inherits FR-BUY-5. It was never a spelled-out script. | The P13 surface matches the amended FR. No separate script is invented here. |
| AC-SEL-13 | Implied same-ID AC. It inherits FR-SEL-13. | The P37 surface matches the amended FR once T01 removes confirm-to-checkout. |

**FLAG-ENFORCE.** ERD §6.1 names the `cart_items` CHECKs and the two partial uniques. It does not name a stock trigger, a band trigger, a prep-required trigger, or a column grant that freezes `unit_price`. Live `pg_trigger` has no row on `cart_items` or `inquiries`. This pack does not add a migration for those refusals. The planning chat says whether they stay server actions or become a migration. A migration, if the chat requires one, uses the same staging-text → AUDIT → CI-proof → apply cycle, still with no SQL body in this pack, and it is not folded into the REG-107 file unless the chat says so.

**FLAG-DELIVERY.** P66's binding is a running subtotal, one delivery figure, and one total (UI spec P66; R-C03; AC-CART-6 once the figure is computed). REG-91's stored result is `master_orders.combined_delivery_total`, written by checkout. There is no cart-safe reader. `checkout_from_cart` writes an order and fails closed while `payment_window_minutes` is empty. T02 does not call it to paint a figure and does not copy its private arithmetic into a new function.

**FLAG-ADD.** `BETK_PHASES.md` gives quote-accept the `cart_items` insert (T01) and gives P66 the cart page (T02). It does not name the fixed-price add. `addToCart` still returns `unavailable` for an authenticated buyer. AC-CART-2 and AC-CART-3 need that write. The planning chat names the task. Until then, neither T01 nor T02 changes `addToCart` beyond keeping the guest refusal.

**FLAG-P36.** Phase 10 owns P36. The task table names P37, P14, P66, and P13. It does not name P36. The seller list page has no checkout href today. UI spec P36: no buyer name; the label is `buyerLabel`; no confirm-order action. The planning chat assigns P36 to a task. Until then, no task edits that page.

**FLAG-REG-107-SHAPE.** Closing REG-107 removes the seller session's ability to persist an arbitrary `avg_response_hours`. The REG text says to move the computation server-side. It does not choose a column revoke, a trigger, or a definer. T03 stops until the planning chat names the shape. The display on P04 and P05 stays where it is; those pages are not Phase 10 surfaces. The seller inbox reply line reads the same column after the write is no longer the seller's arbitrary update.

**DB plan (the one authorized migration is REG-107).**

1. **T03 authors** `docs/03-database/rehearsal/staging-text/P10M1.sql` and `docs/03-database/rehearsal/AUDIT-P10.md` after FLAG-REG-107-SHAPE is named. One transaction. No new table. No new argument on an existing function. No edit of `checkout_from_cart`. No settings write. No phone predicate. Audit every grant, policy, and function: MATCH / BROADER / NARROWER / AUTHORED / MISMATCH / FINDING. A GRANT never closes a BROADER table privilege. Zero MISMATCH before CI. The file is not pasted into this pack.
2. **T04 proves it in CI** on a local Supabase stack. The behaviour-assert harness prints CSV with header `name,expected,actual,pass`. The gate parses that header and stops at the first row that is not four fields. Staging is not written.
3. **Review** is the planning chat, before apply. Then the human types GO. Apply is irreversible.
4. **T05 applies** the bound file with `apply_migration`. State md5 and byte length before the call. Ledger 1:1. Backfill `BETK_DATABASE_SCHEMA.sql`. Advisors before and after; every delta attributed. Then apply the CI Types drift diff verbatim. No bridge cast left. Close REG-107 on that evidence.

## 6. Task table

Model is Grok 4.7 on every row. T01 cuts `feature/phase-10-cart-quote` from `origin/main` after this pack's PR is on `main`. Later tasks stay on that branch.

| T | Work | Model | Thinking | Branch |
|---|---|---|---|---|
| T00 | This pack. Pins. Inventory. Protection change from the INTEGRATION line. | Grok 4.7 | High | `v2-p10-t00` |
| T01 | Quote write on P37. Accept on P14 inserts `cart_items`. | Grok 4.7 | High | creates `feature/phase-10-cart-quote` |
| T02 | P66 cart, composing CartLine. P13 drops the checkout CTA. `cartLine.droppedQuote` in ar and en. | Grok 4.7 | Medium | `feature/phase-10-cart-quote` |
| T03 | REG-107 staging text and audit. No apply. | Grok 4.7 | Max | `feature/phase-10-cart-quote` |
| T04 | REG-107 CI proof. Staging is not written. | Grok 4.7 | High | `feature/phase-10-cart-quote` |
| T05 | REG-107 apply after review and GO. Closes REG-107. Types diff verbatim. | Grok 4.7 | High | `feature/phase-10-cart-quote` |
| T06 | Exit evidence. Opens the one PR. | Grok 4.7 | Max | `feature/phase-10-cart-quote` |

### Mapping

| Source row | T |
|---|---|
| Phase 10: T00 write the pack | T00 |
| Phase 10: Quote write on P37; accept on P14 inserts `cart_items` | T01 |
| Phase 10: P66 cart, composing CartLine; P13 list drops the checkout CTA | T02 |
| REG-107 (register owner Phase 10; not a `BETK_PHASES.md` task row; closes before the exit) | T03 authors, T04 proves, T05 applies and closes |
| Phase 10: Exit evidence | T06 |

### Carry-forwards

**CartLine.** Compose it. Do not restyle it. `cartLine.droppedQuote` is the key Claude Design proposed (CD-DELTA-6 Wave 2). The task that composes P66 (T02) writes the ar and en catalog entries. The other string props already on `CartLineProps` in `src/components/shared/CartLine.tsx` are catalog strings in that same task. No new prop. `currencyLabel` takes the string pages already pass to PriceBlock's `currency` prop. `checkoutSections.loading` is Phase 11.

**REG-79.** Pinned B in §4. No phone check anywhere in this phase.

**REG-82.** Implemented only by the existing R-C07 restore path. The dropped-quote prompt is the catalog key above.

**REG-43.** Do not start maintaining `inquiries.last_message_at`.

**Guard F.** Pin 31. T02 raises it to 32 only in the commit that adds the P66 `page.tsx`, with the UI spec route already P66. No other task raises it. OD-21 stays 79.

**Q1.** Expected residue stays the N27 set plus the two fixture accounts and the append-only rows they own. The restore test does not disable a history rule.

**No personal data** in any report or repo file.

### FLAGs for the planning chat

Do not resolve these in a later task by guessing.

1. **FLAG-ENFORCE.** Band, missing prep, over-stock, expired accept, unquoted custom price, and a direct `unit_price` update have no live constraint. This pack authorizes no migration for them.
2. **FLAG-DELIVERY.** P66's one delivery figure has no cart-safe reader. Do not call `checkout_from_cart` and do not invent one.
3. **FLAG-ADD.** The fixed-price add is not named on a task row. `addToCart` still refuses an authenticated buyer with `unavailable`.
4. **FLAG-P36.** P36 is owned and unnamed in the task table.
5. **FLAG-REG-107-SHAPE.** The seller can write `avg_response_hours`. The repair shape is not chosen here. T03 waits for the name.

## 7. Canonical prompts

T00 is this file. Do not re-run it.

### T01

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T01 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: cut feature/phase-10-cart-quote from origin/main after the T00 PR is on main. State the SHA.

Quote write on P37. Accept on P14 inserts one cart_items row (is_custom true, inquiry_id set, unit_price = quoted_price). Remove the confirm-to-checkout control on P37. P14 has no checkout button. Read the band and the validity hours from the live settings readers. An empty key fails closed and writes nothing. Do not hard-code 2 or 24 as a second source. Do not add a cron. Do not encode a phone check. Do not add a phone predicate to cart_items. Do not call checkout_from_cart.

FLAG-ADD, FLAG-P36, and FLAG-ENFORCE are open until the planning-chat review of this pack names them. Do not change addToCart except to keep the guest refusal. Do not edit P36. Do not add a migration for the quote band unless that review has required one. If it has, stop and say so: that migration is its own staging-text cycle, and this prompt has no SQL body.

Zod-validate the actions before any database call. RLS denial is not-found. Compose MessageThread, Input, and Button. Do not restyle the kit.

Done-when: a seller quote below the listing price, above the ceiling, or without prep is refused; a quote on the closed interval stores quoted_price, quoted_prep_days, quoted_at, and quote_expires_at; buyer accept inserts one cart line at that price; accept after quote_expires_at inserts nothing; P37 has no confirmInquiry control; P14 has no checkout button.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 10 tasks stay on feature/phase-10-cart-quote until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the P37 and P14 files this task edits, the quote and accept actions and their Zod schemas, the ar/en strings those screens need, the tests for the Done-when lines, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_10_CART_QUOTE.md §9.
Commit message: feat(p10-t01): seller quote and cart accept
```

### T02

```text
MODEL: Grok 4.7 · THINKING: Medium
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T02 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: feature/phase-10-cart-quote.

P66 /cart, composing CartLine. Do not restyle the kit. Write cartLine.droppedQuote in ar and en, and the other string props already declared on CartLineProps. P13's list has no checkout CTA. Guest add still leaves zero cart_items. Blocked is derived (stock or quote_expires_at), not a column. Raise Guard F from 31 to 32 only because this task adds the P66 page.tsx. OD-21 stays 79.

FLAG-DELIVERY is open until the planning-chat review names a reader. Do not invent a delivery function. Do not call checkout_from_cart. Show the goods subtotal from quantity times unit_price. FLAG-ADD stays open: do not change the authenticated addToCart result unless that review assigned the fixed-price add to this task. FLAG-P36 stays open: do not edit the seller inbox list.

Done-when: /cart renders CartLine for the buyer's rows; a qty change or a remove changes the goods subtotal; an expired custom line is blocked and a dropped restore line shows cartLine.droppedQuote; P13 has no checkout control; Guard F pin is 32.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 10 tasks stay on feature/phase-10-cart-quote until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the P66 route, the P13 list, the cart query and qty/remove actions, messages ar/en, the page-count pin, the tests for the Done-when lines, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_10_CART_QUOTE.md §9.
Commit message: feat(p10-t02): cart page and inbox list
```

### T03

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T03 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: feature/phase-10-cart-quote.

REG-107 staging text and audit. If FLAG-REG-107-SHAPE is still open, STOP. Do not author a revoke, a trigger, or a definer the planning chat has not named.

Author docs/03-database/rehearsal/staging-text/P10M1.sql and docs/03-database/rehearsal/AUDIT-P10.md. The change makes an authenticated seller session unable to persist an arbitrary avg_response_hours. The computation reads inquiry timestamps on the server. No new table. No edit of checkout_from_cart. No phone predicate. No settings write. Audit every grant, policy, and function with MATCH, BROADER, NARROWER, AUTHORED, MISMATCH, FINDING. A GRANT never closes a BROADER table privilege. Zero MISMATCH. Do not call apply_migration. Do not write staging.

Done-when: the audit file records zero MISMATCH and the staging text is not applied. Ledger is still 41, last 20261004172620, unless a later task has already applied something the chat added.
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
Commit message: docs(p10-t03): REG-107 staging text and audit
```

### T04

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T04 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: feature/phase-10-cart-quote.

CI proof of P10M1.sql on a local Supabase stack. Do not apply to staging. The harness prints CSV with header name,expected,actual,pass. The gate parses that header and stops at the first row that is not four fields. One case: an authenticated seller session cannot leave an arbitrary avg_response_hours in place. The server-side computation still stores the value derived from inquiry timestamps.

Done-when: the CI run is green and the CSV gate passes. list_migrations on staging is unchanged.
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
Commit message: ci(p10-t04): prove the REG-107 staging text
```

### T05

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T05 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: feature/phase-10-cart-quote.

Apply the bound P10M1.sql. STOP unless the planning chat has reviewed T03 and T04 and the human has typed GO. Before apply_migration, state the query argument's md5 and byte length and show they equal the file. Ledger 1:1 after. Backfill BETK_DATABASE_SCHEMA.sql. Advisors before and after; every delta attributed. Apply the CI Types drift diff verbatim. No bridge cast. Close REG-107. Do not write payment_window_minutes. Do not disable an append-only rule.

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
File list: the applied migration file, BETK_DATABASE_SCHEMA.sql, types.ts only if the CI diff changed it, the seller message writer if the audit said the call site changes, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_10_CART_QUOTE.md §9.
Commit message: feat(p10-t05): apply REG-107 and close it
```

### T06

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 10 T06 from docs/10-ai-development/phase-packs/PHASE_10_CART_QUOTE.md.
Branch: feature/phase-10-cart-quote.

Exit evidence. Paste a result for every §8 row. STOP if a row has no automated evidence. A hidden control is not evidence. The payment-window cases follow §5: a past payment_deadline, a no-JWT cancel, restore_stock_on_cancel. Do not write payment_window_minutes. Do not choose a window. Do not add a cron. The full integration suite is green. REG-107 is already closed by T05; re-read the row and paste the evidence. Q1 holds: do not disable a history rule. Delete only rows this test inserted. If a delete fails, STOP.

Done-when: each §8 row is green, the full integration suite is green, REG-107 is closed, and SESSION_CONTEXT says Phase 10 exit holds — or the miss is a named forward-fix and the exit does not hold.
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

Each case the `BETK_PHASES.md` Phase 10 exit line names is an integration test. AC-CART-1..7 and AC-QTE-1..6 are all in that set. A hidden widget is not a pass. The full integration suite is green. REG-107 is closed before this task reports the exit.

| # | Exit item | Evidence |
|---|---|---|
| 1 | AC-CART-1. Guest add leaves zero `cart_items`. | Integration: guest attempt, row count unchanged, no new id. |
| 2 | AC-CART-2. Over-stock add is refused. | Integration: tracked stock S, qty S+1, cart unchanged. Qty at or under S inserts that quantity. Depends on FLAG-ADD. |
| 3 | AC-CART-3. Snapshotted price survives a listing edit. | Integration: line at P, listing price becomes P′, line still P. |
| 4 | AC-CART-4. Expired quote blocks the line. | Integration: `quote_expires_at` in the past, the line is the blocked one. A fresh in-band quote, or clearing the line, is what removes the block. |
| 5 | AC-CART-5. Tracked line at zero availability is blocked. | Integration: the cart read names that line. Phase 11's checkout refusal stays in `checkout_from_cart`. |
| 6 | AC-CART-6. Qty or remove changes the running subtotal. | Integration: the goods subtotal moves. Delivery and grand total are in this row only after FLAG-DELIVERY has a reader. |
| 7 | AC-CART-7. Payment-window expiry restores per REG-82. | Integration, method in §5. Fixed-price line returns at the snapshotted price and quantity. Custom line returns only while `quote_expires_at` is in the future; otherwise it is absent and the buyer prompt is `cartLine.droppedQuote`. No write to `payment_window_minutes`. |
| 8 | AC-QTE-1. Guest request creates no quote thread. | Integration: no new `inquiries` row. |
| 9 | AC-QTE-2. Band. | Integration: below the listing price refused; above the ceiling refused; a price on the closed interval stored. |
| 10 | AC-QTE-3. Prep required. | Integration: a quote with no prep is refused and stores nothing. |
| 11 | AC-QTE-4. Accept inserts one line at the quoted price. | Integration: one `cart_items` row, `is_custom` true, `unit_price` equals `quoted_price`. A later listing-price change leaves it. |
| 12 | AC-QTE-5. Accept after validity is refused. | Integration: no new cart row. A line already there is blocked (row 4). |
| 13 | AC-QTE-6. Fixed-price purchase needs no inquiry. A custom item cannot enter at an unquoted price. | Integration: a fixed-price line has `inquiry_id` null. The custom accept path uses `quoted_price`. The direct-write hole is FLAG-ENFORCE. |
| 14 | R-Q06. Quote expiry is derived at read. | The row 4 and row 12 tests compare `quote_expires_at` with `now()`. No cron job is added. |
| 15 | Full integration suite. | `pnpm exec vitest run tests/integration` green, and the CI job `Integration (staging)` green on the exit PR. |
| 16 | REG-107 closed. | T05's applied version, md5, and the seller-session probe. This row fails if the row is still open. |

Phone-NULL submit navigating to `/auth/phone` is Phase 11's exit (FR-AUTH-4). It is not a Phase 10 row.

REG-79 stays pinned B. This phase does not close it by adding a cart phone check. REG-82 stays the closed product pin; row 7 is the implementation evidence. REG-93 stays open for Phase 11.

## 9. Results tracker

| Task | Status | Evidence pointer |
|---|---|---|

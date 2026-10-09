# PHASE_11_CHECKOUT.md

> Phase 11 T00 pack. Docs only. Authority is `BETK_PHASES.md` Phase 11. Scope is frozen (OD-20 = 51 tables, OD-21 = 79 pages). This pack does not add a page, a table, a requirement, an OD, or a feature. It contains no SQL body. No task in this pack writes staging except the named settings task, and that task is not T00.

## 0. Header

**Scope authority.** `docs/10-ai-development/BETK_PHASES.md` Phase 11 (Goal, Entry, Exit gate, Owns, Restores, Blocked, task table, PAGES, CODES). Data contract: `docs/03-database/BETK_ERD.md`. Page contract: `docs/00-design/BETK_UI_SPEC.md`. Pins recorded in T00 are in §4.

**Goal.** One cart checkout writes one master, N seller orders, N shipments, and two payment rows per child, or nothing. Version gate before completion. No delivery-mode picker.

**PAGES:** P10, P15

**CODES:** FR-CHK-1, FR-BUY-2, FR-BUY-6, FR-AUTH-4, R-A07, R-O01, R-O02, R-O11, R-O12, R-O13, R-O14, R-O15, R-O17, R-O21, R-K03, AC-AUTH-4, AC-BUY-2, AC-BUY-6, AC-CHK-1, AC-CHK-2, AC-CHK-3, AC-CHK-4, AC-CHK-5, AC-CHK-6, AC-COM-3, AC-COU-1, AC-COU-2

**NOTHING ELSE.** No new table. No new page beyond the PAGES line. `components/ui` and `components/shared` stay Claude Design's. Cursor composes and wires data. A visual gap is a flag for the planning chat, which weighs a recorded human sanction (the D4 precedent) before any Claude Design handoff. `src/lib/supabase/types.ts` changes only by the CI diff (REG-32). No prompt in this pack contains a SQL body. No prompt says to apply from a plan section.

P15 calls `checkout_from_cart` only. It does not call `create_order_from_inquiry`. That function was dropped in the same migration that created `checkout_from_cart` (`supabase/migrations/20261003082041_v2_08_functions.sql` lines 1084–1085). AC-BUY-6 is retired (`BETK_PRD.md`). `routes.checkout` still builds `/checkout?inquiry=` (`src/constants/routes.ts` lines 314–315). The checkout task replaces that helper with `/checkout` and no inquiry argument. UI spec P15 is `/checkout`.

## 1. Entry checklist

Measured 2026-10-09 on branch `v2-p11-t00`, cut from `origin/main` `7836961c00825664d87498f952a1a2b4ceaee3f8` (merge of PR #80). `git merge-base --is-ancestor 7836961 origin/main` exited 0. `git rev-parse origin/main` is that full SHA.

| Check | Method | Result |
|---|---|---|
| Phase 10 exit | `SESSION_CONTEXT.md` bullet **Phase 10 exit holds (2026-10-09).** Pack `PHASE_10_CART_QUOTE.md` §9 T06-FIX row. | Holds. PR #79 merged 2026-10-09 07:18:12 UTC as `1540adedc1fbe463a3f0d0abb95ed8f61470ec8c`, head `4cc71975001ba0c36239ef412f2ddf72b7ac295a`. CI run [37627719450](https://github.com/Jovo-Jovi/betk/actions/runs/37627719450): nine required checks green, Integration (staging) included, 33 files, 231 passed, 2 skipped. |
| PR #79 | `gh pr view 79`. | MERGED. Title `docs(p10-t01): P10M1 staging text and audit`. Merge `1540adedc1fbe463a3f0d0abb95ed8f61470ec8c`. 2026-10-09T07:18:12Z. |
| PR #80 | `gh pr view 80`. `git rev-parse origin/main`. | MERGED. Title `fix(p10-post): record the held exit and refresh the cart count`. Merge `7836961c00825664d87498f952a1a2b4ceaee3f8`. 2026-10-09T07:56:17Z. This branch's base. |
| CheckoutSellerSections | `docs/00-design/kit-manifest.json` key count (`Object.keys(files)`). File hash in that manifest. | In the kit. Manifest **64** files. `src/components/shared/CheckoutSellerSections.tsx` hash `47ddb88d587883c03406a0e5c385668aa4fde3c96d7754db33630a6ce89c613c`. |
| Ledger | MCP `list_migrations` on `project-0-BETK-supabase-betk`. Local `supabase/migrations` version prefixes compared as sets. | Remote **42**. Last `20261006100204` / `v2_10_cart_quote`. Local **42**. First `20260622082729`. Last `20261006100204`. Only-local 0. Only-remote 0. 1:1. |
| Residue | MCP `execute_sql` counts, then the Guard G outside-set checks in `tests/integration/expectedResidue.ts` (the seven seller ids, their masters, history `order_id` in that set, fixture emails, moderation `admin_id` in the fixture users, the known acceptance). | `seller_orders` 7, `master_orders` 7, `order_status_history` 12, `payouts` 0, `payments` 0, `order_items` 0, `cart_items` 0, `courier_rates` 0. Fixture accounts 2. `@betk.test` users outside those two: 0. `moderation_logs` 34, outside the fixture admins: 0. `agreement_acceptances` 2, outside the fixture users and the known `buyer_terms` / `STAGING-DRAFT-1` row: 0. Seller ids outside the seven: 0. History `order_id` outside the seven: 0. |
| Branch protection | `gh api repos/Jovo-Jovi/betk/branches/main/protection`. | Nine contexts: `RLS smoke (staging)`, `Install`, `Lint`, `Typecheck`, `Vitest (unit)`, `Guards`, `Types drift`, `Build`, `Integration (staging)`. `strict` true. `enforce_admins.enabled` true. `allow_force_pushes.enabled` false. `allow_deletions.enabled` false. |
| Settings | MCP `execute_sql` on `betk.admin_settings` for the five keys. Length and value. | `payment_window_minutes` length 0. `agreement_return_policy_version` length 0. `agreement_privacy_version` length 0. `agreement_buyer_terms_version` = `STAGING-DRAFT-1` (length 15, REG-96). `agreement_seller_agreement_version` = `STAGING-DRAFT-1` (length 15, REG-97). T00 does not write any of them. |
| Archive restore set | `git rev-parse archive/phase-07-v1-single-seller`. `git ls-tree -r --name-only` filtered to address and the phone-gate test. `git ls-files` on `main` for the same paths. | Tag `0e9bc04df5aa6a979d7f12e1614751b7a756484f`. On the tag and absent on this branch: `src/features/buyer-account/actions/createAddress.ts`, `src/features/buyer-account/queries/getOwnAddresses.ts`, `src/validations/address.ts`, `tests/unit/checkoutForm.phoneGate.navigate.unit.test.ts`. `src/components/shared/AddressForm.tsx` is already on `main` and in the kit. Do not restore it. Do not restore `deactivateAccount.ts`, `updateProfile.ts`, or `getProfile.ts` (already on `main`). The tag's address header says create and list are the checkout slice, and edit, delete, and set-default belong to the address-book page. UI spec P10 is own CRUD. T01 restores the three absent address files and authors the page's remaining writes. It does not restore the rest of the tag tree. |

`/checkout` and `/account/addresses` have no `page.tsx` (glob of `src/app/**/page.tsx`, 32 files, matching `scripts/check-page-count.mjs` `PINNED_PAGE_COUNT = 32`). `/checkout` and `/account` are already in `BUYER_PREFIXES` (`src/middleware.ts` lines 66–75).

## 2. Binding rules

Carried from Phase 10 §2, which carried Phase 09 §2:

- Staging SQL is a file under `docs/03-database/rehearsal/staging-text/`, audited before any apply. The audit verdicts are MATCH, BROADER, NARROWER, AUTHORED, MISMATCH, FINDING. A GRANT never closes a BROADER table privilege.
- Before every `apply_migration`, state the query argument's md5 and byte length and show they equal the bound file (`PRECEDENTS.md`, apply_migration gets the bound text).
- **Decision Q1 (human, 2026-10-04), verbatim.**

Q1 Append-only and evidence protections (no_delete_mod_log, the history rules, any immutability on agreement_acceptances) are never disabled outside an approved migration. Tests issue no DDL.
   Tests that must create append-only or evidence rows on staging use permanent, labelled fixture accounts — fixture-admin@betk.test and fixture-seller@betk.test (create them once if missing; never delete them).
   Guard G's expected residue = the N27 set + those fixture accounts + the append-only/evidence rows they own. It reports those counts at suite start and fails only on rows outside that set.

- Types come from the CI Types drift diff, applied verbatim. No hand edit. No bridge cast left.
- A visual gap goes to the planning chat before Claude Design. Cursor does not restyle the kit. The first human sanction under the kit-integrity rule is D4 (AppTopbar cart button, 2026-10-06). This pack does not grant another.
- The human acts only by merging, typing GO for an irreversible step, pasting to Claude Design, and answering a decision. This pack does not merge and does not bypass checks.

**Three precedents added in Phase 10, binding here.**

- **ASCII-only staging texts.** Staging texts and migration files are ASCII-only. No box-drawing or other non-ASCII characters. `apply_migration` re-transmits the text (`PRECEDENTS.md`, P10-T04, REG-116).
- **A stored-statement mismatch is a STOP.** If the stored statement after `apply_migration` differs from the bound file in any byte, STOP and report. Any edit of `supabase_migrations` history needs a recorded human decision first (`PRECEDENTS.md`, P10-T04).
- **No protection DDL outside a migration.** Never disable, enable, alter, or drop any rule, trigger, policy, grant, or constraint on staging outside an applied migration, in tests and in operator transactions alike. A residue a test cannot remove is a STOP: report the counts and ids, and wait for a human decision (`PRECEDENTS.md`, P10-T06-FIX, REG-117). The Q1 row still stands.

**W1 (verbatim).** W1 Workflow: at the end of any task that needs a PR, Cursor opens it with `gh pr create` (title = commit subject; body = the task's evidence summary). The human only merges. Never merge, never bypass.

**Shared close** (every prompt after T00 ends with this). Tasks after T00 commit on `feature/phase-11-checkout` and push. The one PR is opened by the exit task.

```text
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
```

Also binding here: Windows/PowerShell; no `&&`. Supabase MCP namespace is `project-0-BETK-supabase-betk` only. Scope stays OD-20 = 51 and OD-21 = 79. A schema fact that is not cited or flagged in §5 is not a reason to invent a column, policy, or function.

## 3. Register plan

No reservations. Numbers are taken at mint time.

P11-T00 re-read (2026-10-09), before any mint: header REG-01..REG-118, next free **REG-119**, no REG-119 row. **None taken.** Next free stays **REG-119** / **OD-22** / **ADR-026**.

REG-81, REG-93, REG-98, and REG-99 are updated in place. They are not new numbers. The pin text is §4. REG-81 and REG-93 close at the Phase 11 exit with evidence. The staging halves of REG-98 and REG-99 close at that exit. Their production halves stay open, with REG-96 and REG-97, until legal sign-off.

**REG-113.** Checkout charges `cart_items.unit_price` for fixed lines. Today `checkout_from_cart` charges live `listings.price` for a fixed line and `inquiries.quoted_price` for a custom line (`supabase/migrations/20261003082041_v2_08_functions.sql` lines 867–871 and 1044–1045). ERD §3.3 says checkout copies `unit_price`. **Custom lines also charge the snapshot.** `accept_inquiry_quote` already stores `quoted_price` on `cart_items.unit_price` (`supabase/migrations/20261006100204_v2_10_cart_quote.sql` lines 281–284). R-FREEZE refuses `send_inquiry_quote` while any cart line references the inquiry, so that quoted price cannot move while the line is held. The snapshot and the frozen quote are the same money. P11M1 reads `cart_items.unit_price` for both kinds. The quote-expiry check and the band check stay on the inquiry row (lines 812–844). They are gates, not the charge. Owner: P11M1. Closes at the Phase 11 exit.

**REG-115.** `checkout_from_cart` does not refuse a line whose store is not `active`. Live `prosrc` (MCP `execute_sql`, 2026-10-09) does not mention `stores.status`. The listing gate is lines 792–809. The store join at lines 896–898 reads `governorate` for the rate. Live `store_status`: `pending`, `active`, `suspended`. P11M1 refuses the line and writes nothing. The exception string is **FLAG-STORE-CODE**. Owner: P11M1. Closes at the Phase 11 exit.

**R-DELIVERY.** Carry-forward from Phase 10. A read-only delivery preview that P15 and P66 both use. P66 then shows the delivery figure and the total. P10's cart shows the goods subtotal and the "calculated at checkout" line, and does not show a figure. The preview returns one combined total and no per-seller fee (AC-CHK-6, R-K03). It uses the same rate match checkout already uses: store `governorate` as origin, the address `governorate` as destination, weight band on `courier_rates` (lines 894–905). A missing band is the same refusal checkout already raises, `BETK_CHECKOUT_RATE_MISSING` (line 904). The function name is chosen in the staging text and marked AUTHORED in the audit. It is not a new table. Which address P66 passes is **FLAG-P66-DEST**.

**REG-81.** Generation is inside `checkout_from_cart` (D-81, §4). Child `betk_ref` stays NULL (ERD §6.1; the insert writes NULL at lines 1022–1023). `display_ref` is the successful master `betk_ref` plus the suffix. Live partial unique index on `seller_orders.display_ref` is still named `uq_orders_display_ref` (MCP `execute_sql` on `pg_indexes`, 2026-10-09). `display_ref` is `varchar(64)` (ERD §6.2). Master `betk_ref` is `varchar(25)` (ERD §6.1). The master format `BETK-YYYYMMDD-XXXX` is written at lines 957–958.

**REG-79.** Pinned B (§4). Phase 11 owns FR-AUTH-4. Where the `/auth/phone` redirect fires is **FLAG-PHONE**. The database gate is already the restrictive INSERT policy `master_orders_phone_gate`. This phase does not add a phone predicate to `cart_items`.

**REG-88.** Pinned B (§4). The gate set is `{buyer_terms, return_policy}`. `checkout_from_cart` reads all four version keys and does not branch (lines 769–773; `PHASE_09_V2_SURFACES.md` §5: Phase 11 applies the set inside the function). P11M1 refuses completion when the buyer has no `agreement_acceptances` row for the current version of either gated document, and writes no master (AC-CHK-4). `seller_agreement` and `privacy` are read and not required. Empty version text still fails closed (`checkout_agreement_version` returns the raw value; the consumer treats empty as unconfigured, plan §8.2.5). The panel is T14. What it renders besides the two gated documents is **FLAG-PANEL**.

**`checkoutSections.loading`.** `CheckoutSellerSections` declares `loadingLabel` (`src/components/shared/CheckoutSellerSections.tsx` lines 55–56). The catalogs have no `checkoutSections` keys (search of `messages/`, 2026-10-09). T12 writes `checkoutSections.loading` in ar and en, and the other four string props the component already requires (`delivery`, `total`, `empty`, `error`). No new prop.

**REG-104.** Stays Phase 13. Not a Phase 11 row. The G1 no-JWT note is for the sweeper (§5). G1 raises `BETK_ESCALATION_ACTOR` when a write with no signed-in user changes `escalated_at`, `escalation_reason`, or `escalation_note` (`v2_08_functions.sql` lines 214–224; `SESSION_CONTEXT.md` REG-104). The sweeper does not write those three columns. The prep-deadline pin stays Phase 13.

## 4. Pins

**Decisions (human, 2026-10-09), verbatim.**

D-81 Q "REG-81 — seller order number format:" A "A: buyer's number + suffix (BETK-…-1) — recommended".

D-93 Q "REG-93 — time to upload the deposit proof:" A "60 minutes — recommended".

D-98-99 Q "REG-98/99 — policy version labels:" A "STAGING-DRAFT-1 on staging now; real versions at legal sign-off — recommended".

**D-81 pin.** A child seller order's `display_ref` = the master's buyer-facing number (R-O02, `BETK-YYYYMMDD-XXXX`) + "-" + n, where n is the seller order's 1-based position within its master.

**Ordering rule (this pack, from what `checkout_from_cart` can order by).** The child loop groups by `l.store_id` and has no `ORDER BY` (`v2_08_functions.sql` lines 857–879). Live `prosrc` (2026-10-09) contains that `GROUP BY`, does not contain an order by `l.store_id` or `g.store_id`, and does contain `ORDER BY u.remainder` (lines 923–930). That order ranks deposit cents. It is not the child position. `store_id` is the only unique key in the group. `weight_g` and the subtotal can tie. `seller_order_id` is assigned with `gen_random_uuid()` inside the loop (line 859), so it is not a stable position. n is the 1-based index of `store_id` ascending on that grouping query. P11M1 adds that order. `display_ref` uses the `betk_ref` of the master insert that succeeded (the retry loop at lines 955–992), then "-", then n.

**D-93 pin.** `payment_window_minutes` = 60, on staging and in production.

**D-98-99 pin.** On staging, `agreement_return_policy_version` = `STAGING-DRAFT-1` and `agreement_privacy_version` = `STAGING-DRAFT-1` (CF-12 placeholders). The production values stay open, pinned at legal sign-off with REG-96 and REG-97.

**REG-79 B, verbatim (human, 2026-10-05).** "REG-79 = B. The verified-phone gate fires at checkout, not at add-to-cart. Add-to-cart and quote accept (P14) require an account only (N21, R-C01). Named phone-verification holds remain checkout, become-seller, and payout (R-A07, AC-AUTH-4). Database authority remains the existing RESTRICTIVE master_orders_phone_gate; no phone predicate is added to cart_items. Phase 10 encodes no phone check. Phase 11 owns FR-AUTH-4; where inside checkout the /auth/phone redirect fires is Phase 11's choice, and its exit already requires the phone-NULL submit case."

**REG-88 B (P09-T00, 2026-10-03).** The checkout completion gate = `{buyer_terms, return_policy}`. `seller_agreement` is never in the buyer gate. `privacy` is not gated (public page, AC-AGR-4); revisit if counsel requires a consent step. Phase 11 reads this pin. It does not choose the set.

## 5. Enforcement inventory and the DB plan

Server-side evidence for a refusal is the database error or the server-action result. A hidden control is not evidence. Schema facts below were read on 2026-10-09 from the live database (MCP `execute_sql` on `project-0-BETK-supabase-betk`) or from the file cited next to them. This pack contains no SQL body.

**Checkout today.** `checkout_from_cart(p_delivery_address_id uuid)` is SECURITY INVOKER (live `prosecdef` false). `GRANT EXECUTE` to `authenticated` is `supabase/migrations/20261003075902_v2_08_grants_and_policies.sql` line 395. The function reads the payment window, fails closed when the key is empty (`checkout_payment_window_minutes`, lines 48–64), writes `payment_deadline` as `now()` plus that interval (lines 971–983), and writes `display_ref` NULL. It does not check `stores.status`. It does not check `agreement_acceptances`.

**Phone.** Restrictive INSERT `master_orders_phone_gate` on `master_orders` (Phase 10 §5; ERD §8). A phone-NULL insert of a master does not land. The redirect is FLAG-PHONE.

**Master cancel.** `master_orders` has no status column (ERD §6.1; UI spec P17). "The master is cancelled" means every child `seller_orders` row of that master is `cancelled`. The pending-to-cancelled system branch requires `auth.uid()` null, `proof_path` null, and `now()` at or after `payment_deadline`, and it stamps `cancelled_by` `system` (lines 235–245). `trg_restore_stock_on_cancel` then runs `restore_stock_on_cancel` (REG-82). The sweeper uses that branch. It does not write the three escalation columns.

**Notifications.** Columns are `user_id`, `type` `varchar(50)`, `channel` `notification_channel`, `title`, `body`, `data`, `is_read`, `sent_at`, `read_at` (`supabase/migrations/20260622083013_boosts_admin_analytics.sql` lines 58–69). Live enum labels (2026-10-09): `push`, `sms`, `whatsapp`, `email`. There is no in-app label. The only live insert is `dispute-sla-alert`, channel `sms` (`supabase/migrations/20260622083154_cron.sql` lines 80–84). ERD §8: INSERT is service. Which label the sweeper writes is **FLAG-CHANNEL**. Do not add an enum member.

**Cron.** Live jobs (MCP `execute_sql` on `cron.job`, 2026-10-09): `cleanup-otp-tokens` `30 * * * *`, `daily-platform-snapshot` `5 22 * * *`, `dispute-sla-alert` `0 * * * *`, `expire-boosts` `*/15 * * * *`, `lift-temp-suspensions` `0 1 * * *`, `recalculate-seller-levels` `0 0 * * *`. No payment-window job. `BETK_PHASES.md` §8 sets the new job to every minute (`* * * * *`). The job is not one of those six.

**Rates.** `courier_rates` count is 0. P63 is Phase 14. Live policies: `courier_rates_select` using true; insert, update, and delete each require `betk.is_admin()`. No user rewrite rules: `pg_rewrite` rows other than `_RETURN` are none (2026-10-09). No non-internal triggers. Rates are not append-only. A test inserts the band it needs and deletes that row before it finishes, using a path that is allowed to delete (the admin policy, or the service role, which bypasses RLS). It issues no DDL and disables nothing. After the test, `courier_rates` is 0. If the delete leaves a row, STOP and report the id. Do not widen Guard G. Do not add the overlap exclusion (ERD §6.1 says Stage C / the rate matrix; that is Phase 14). The test inserts one non-overlapping band so the match is the one row.

**Payments count.** The insert skips a non-positive amount (lines 715, 1056–1063). The exit fixture uses a child total that produces both a deposit and a balance above 0, so the row count is 2N. A zero side is the existing skip, not a new rule.

**Stock race.** `decrement_stock_on_confirm` locks the listing `FOR UPDATE` and raises `BETK_CHECKOUT_OUT_OF_STOCK` when tracked stock is below the line quantity (lines 158–171). AC-CHK-2 is that lock. P11M1 does not add a second lock.

**Commission.** `trg_set_order_commission_snapshot` already stamps the child. AC-COM-3 is the buyer surface: no commission line. P11 does not show one. CheckoutSellerSections has no commission prop (file header).

| Code | Where it is enforced today | What Phase 11 adds |
|---|---|---|
| FR-CHK-1 | `checkout_from_cart` writes the master, the children, the items, the shipments, and the payments in one function, or raises. No `/checkout` page. | T12 composes P15 and calls this function only. P11M1 changes the charge, the store gate, the child ref, and the version gate inside it. |
| FR-BUY-2 | `addresses` exists. Policy `addr_self` (ERD §8). No address-book page. The archive create and list are not on `main`. | T01 restores those files and builds P10. Edit, delete, and set-default are that page's writes (archive header; UI spec P10). No new table. `is_default` has no unique index (column default only, `20260622082812_user_seller_store.sql` line 34). The page action keeps a single default. It does not add an index. |
| FR-BUY-6 | Superseded. `create_order_from_inquiry` is dropped. | Not built. T12 does not add an inquiry checkout. |
| FR-AUTH-4 | Phone-NULL master insert fails `master_orders_phone_gate`. No checkout page redirects. | T13 rewires the unit test once FLAG-PHONE is answered. The assertion target stays `/auth/phone`. |
| R-A07 | Named holds are checkout, become-seller, and payout. Add-to-cart is not a phone hold (REG-79 B). | Checkout is the hold this phase implements. Become-seller and payout are not moved. |
| R-O01 | Superseded by R-O11. | Not built. |
| R-O02 | Master `betk_ref` is `BETK-YYYYMMDD-XXXX` (lines 957–958). Child `display_ref` is NULL. | P11M1 writes `display_ref` per D-81 and the ordering rule in §4. |
| R-O11 | The function reads `cart_items` for `auth.uid()` and does not read a confirmed inquiry as the order source. | Unchanged. T12 does not pass an inquiry id. |
| R-O12 | One function, one master, N children (`GROUP BY l.store_id`), N shipments (lines 1067–1069). A raise rolls the transaction back. | The exit test is that shape, and a forced raise leaves zero of those rows. |
| R-O13 | Master columns are the buyer, the address, the proof columns, `combined_delivery_total`, and `betk_ref`. No status column. | Unchanged, except `payment_deadline` uses 60 once T05 has written the key. |
| R-O14 | Child insert sets items via `order_items`, fee, and the two payment rows. Commission is the existing snapshot trigger. Prep deadline is not stamped here (Phase 13, REG-104). | P11M1 adds `display_ref` only. It does not stamp `prep_deadline`. |
| R-O15 | Deposit method is `instapay`. Balance method is `cod` (lines 1056–1063). | Unchanged. The page does not offer another rail. |
| R-O17 | Two payment types per child, skipping a non-positive amount. | Unchanged. The fixture keeps both amounts positive. |
| R-O21 | Deadline is written only when the settings key parses as a positive integer. The key is empty, so checkout fails closed. Restore on cancel exists. No sweeper. | T05 sets the key to 60. P11M3 is the every-minute sweeper. The buyer notification row waits on FLAG-CHANNEL. |
| R-K03 | `combined_delivery_total` is the sum of the child fees (lines 912–917 and 982). | The preview returns that one sum. P15 and P66 show it. Neither shows a per-seller fee. |
| AC-AUTH-4 | Checkout is refused by `master_orders_phone_gate`. The navigation test is not on `main`. | T13. Become-seller and payout are not this phase's tests. |
| AC-BUY-2 | No address-book page. | T01. |
| AC-BUY-6 | Retired. | Not tested as a success path. A call to the dropped function is a fail. |
| AC-CHK-1 | The function's writes, or a raise. | Exit integration: N sellers, one master, N children, N shipments, 2N payments. A raised attempt leaves zero. |
| AC-CHK-2 | Listing `FOR UPDATE` in `decrement_stock_on_confirm` (lines 158–171). | Exit: the second buyer is refused and tracked stock does not go negative. |
| AC-CHK-3 | The function raises `BETK_CHECKOUT_QUOTE_EXPIRED` and `BETK_CHECKOUT_OUT_OF_STOCK` (lines 812–855). | Exit: a blocked line does not create a master. |
| AC-CHK-4 | Not enforced. Versions are read and not checked. | P11M1 applies the REG-88 set inside the function. T14 is the panel. |
| AC-CHK-5 | The child `delivery_method` is written `'delivery'` only (line 1016). No picker exists because there is no page. | T12 renders no pickup, remote, or self-delivery control. |
| AC-CHK-6 | The function stores one `combined_delivery_total`. There is no page. | T12's response and the page show that one total and no per-seller fee and no commission. |
| AC-COM-3 | No buyer page shows commission. The component has no such prop. | T12 does not add one. |
| AC-COU-1 | The rate join can charge two children different fees. The buyer total is the sum. The matrix is empty. | The test inserts two bands, checks the stored fees differ, checks the buyer total is the sum, then deletes the bands. |
| AC-COU-2 | The destination is the selected address's governorate (lines 775–778 and 899). | The preview recomputes when that governorate changes, before place-order. |
| D-81 | `display_ref` NULL. | P11M1. |
| D-93 | Key length 0. Consumer fails closed. | T05 writes 60 on staging. Production is the same pin and is not written by this phase (no production target). |
| D-98-99 | Both keys length 0. | T05 writes the two staging labels. Production stays open. |
| REG-113 | Fixed lines charge `listings.price`. | P11M1 charges `cart_items.unit_price` for fixed and custom lines. |
| REG-115 | No store-status check. | P11M1 refuses a non-active store. FLAG-STORE-CODE. |
| R-DELIVERY | No preview function. P66 has no figure. | P11M2 is the reader. T12 shows the figure and the total on P66 and P15. FLAG-P66-DEST. |
| REG-88 | Read, do not branch. | P11M1 plus T14. |
| REG-104 | Open for Phase 13. | Not this phase. The sweeper avoids G1 by not writing the escalation columns. |

### How many migrations

Three. No other migration. No settings write inside a migration (a migration would carry the staging strings to production; Phase 09 §4).

1. **P11M1.** Replace `checkout_from_cart` only as far as these changes: charge `cart_items.unit_price` for fixed and custom lines (REG-113); refuse a line whose store is not `active` (REG-115, FLAG-STORE-CODE); set `display_ref` by the §4 ordering rule (D-81); require the REG-88 set inside the function before any insert. No new table. No phone predicate on `cart_items`. No settings write. Child `betk_ref` stays NULL. Do not recreate `create_order_from_inquiry`. Do not write escalation columns.
2. **P11M2.** The read-only delivery preview. It does not insert, update, or delete. It returns one combined total and no per-seller fee. Same rate match as lines 894–905. Missing band raises `BETK_CHECKOUT_RATE_MISSING`.
3. **P11M3.** The payment-window sweeper. New `pg_cron` job, schedule every minute. It selects masters whose `proof_path` is null and whose `payment_deadline` is at or before `now()`, and whose children are still `pending`, and it sets those children to `cancelled` so the existing system branch and `restore_stock_on_cancel` run. It inserts one notifications row for that buyer in the same execution as those cancels. A later run sees no pending child and does not insert a second row. It does not write escalation columns. Channel and type wait on FLAG-CHANNEL. It does not add an enum member.

Each file goes through staging text, then AUDIT, then local CI proof, then planning-chat review, then human GO, then apply. The local harness prints CSV with header `name,expected,actual,pass`, issues no DDL, and rolls back. CI may set `payment_window_minutes` to a value labelled `CI TEST VALUE` inside that transaction. That value never goes to staging.

**Staging settings task (T05).** One guarded `execute_sql`, not a migration, not T00. Cites D-93 and D-98-99. Exactly these three keys, and no others:

- `payment_window_minutes` = `60`
- `agreement_return_policy_version` = `STAGING-DRAFT-1`
- `agreement_privacy_version` = `STAGING-DRAFT-1`

Pre-check: each value is empty text. Post-check: each equals the string above. If any pre-check fails, STOP and write nothing. Do not touch `agreement_buyer_terms_version` or `agreement_seller_agreement_version` (already `STAGING-DRAFT-1`, REG-96 and REG-97). Record the statement, the row count, and the before and after lengths. Production is not written here.

## 6. Task table

Model is Grok 4.7 on every row. T01 cuts `feature/phase-11-checkout` from `origin/main` after this pack's PR is on `main`, and only after the planning chat has reviewed this pack. Later tasks stay on that branch. The FLAGs in this section are answered in that review, before the task that names them runs. A task that names an unanswered FLAG stops.

| T | Work | Model | Thinking | Branch |
|---|---|---|---|---|
| T00 | This pack. Pins. Inventory. No staging write. | Grok 4.7 | High | `v2-p11-t00` |
| T01 | Restore the address query, the create action, and `validations/address.ts` from the archive tag. P10 address book. Guard F 32 → 33 in that commit. | Grok 4.7 | High | creates `feature/phase-11-checkout` |
| T02 | P11M1 staging text and AUDIT. No apply. | Grok 4.7 | Max | `feature/phase-11-checkout` |
| T03 | CI proof of P11M1 on a local stack. Staging is not written. | Grok 4.7 | High | `feature/phase-11-checkout` |
| T04 | Apply P11M1 after review and GO. | Grok 4.7 | High | `feature/phase-11-checkout` |
| T05 | Staging settings write. The three keys in §5. Not a migration. | Grok 4.7 | High | `feature/phase-11-checkout` |
| T06 | P11M2 staging text and AUDIT. No apply. | Grok 4.7 | Max | `feature/phase-11-checkout` |
| T07 | CI proof of P11M2 on a local stack. | Grok 4.7 | High | `feature/phase-11-checkout` |
| T08 | Apply P11M2 after review and GO. | Grok 4.7 | High | `feature/phase-11-checkout` |
| T09 | P11M3 staging text and AUDIT. No apply. | Grok 4.7 | Max | `feature/phase-11-checkout` |
| T10 | CI proof of P11M3 on a local stack. | Grok 4.7 | High | `feature/phase-11-checkout` |
| T11 | Apply P11M3 after review and GO. | Grok 4.7 | High | `feature/phase-11-checkout` |
| T12 | P15 checkout, `checkout_from_cart` only. P66 shows the preview figure and the total. `checkoutSections.loading` and the other four catalog keys. Guard F 33 → 34. | Grok 4.7 | High | `feature/phase-11-checkout` |
| T13 | Rewire the phone-gate unit test. | Grok 4.7 | High | `feature/phase-11-checkout` |
| T14 | Version-gate panel from the REG-88 pin. | Grok 4.7 | Medium | `feature/phase-11-checkout` |
| T15 | Exit evidence. Opens the one PR. | Grok 4.7 | Max | `feature/phase-11-checkout` |

### Mapping

| Source row | T |
|---|---|
| Phase 11: T00 write the pack | T00 |
| Phase 11: Restore the address query/action; P10 address book | T01 |
| P11M1 (REG-113, REG-115, D-81, REG-88 inside the function) | T02 authors, T03 proves, T04 applies |
| Staging settings (D-93, D-98-99) | T05 |
| P11M2 (R-DELIVERY reader) | T06 authors, T07 proves, T08 applies |
| P11M3 (sweeper, G1 note, REG-104 stays Phase 13) | T09 authors, T10 proves, T11 applies |
| Phase 11: P15 checkout calling `checkout_from_cart` only | T12. Also P66's figure and total, and `checkoutSections.loading` |
| Phase 11: Rewire the phone-gate unit test | T13. FLAG-PHONE |
| Phase 11: Version-gate panel | T14. The database half is P11M1. FLAG-PANEL |
| Phase 11: Exit evidence | T15 |

### Carry-forwards

**T01 files.** From tag `archive/phase-07-v1-single-seller` (`0e9bc04`): `createAddress.ts`, `getOwnAddresses.ts`, `validations/address.ts`. Rewire imports to current paths. Do not take `CheckoutForm`, `createOrderFromInquiry`, or `AddressForm.tsx`. The archive header says `AddressForm` carries `fullName` and `phone` and `addresses` has no such columns. The page does not write them. Edit, delete, and set-default are new actions on this page, Zod-validated before any database call, under `addr_self`. Guard F becomes 33 only in the commit that adds `src/app/[locale]/(buyer)/account/addresses/page.tsx`. OD-21 stays 79.

**T12.** Compose `CheckoutSellerSections`, `AddressForm`, `Button`, `ConfirmDialog`. Do not restyle them. No delivery-mode picker. No commission line. No per-seller fee. Deposit display is the master 50% (`round` of the master total over 2). The page does not encode the child split (REG-89 closed, ADR-022). Do not link to `/checkout/confirmation` (P16 is Phase 12; guidance-only dead-link rule). `routes.checkout` loses the inquiry argument. Guard F becomes 34 only in the commit that adds the P15 `page.tsx`.

**T14.** Native checkbox plus `Link`, the same control as `RegisterForm` (`src/app/[locale]/(auth)/auth/register/_components/RegisterForm.tsx` lines 95–111) and `StepDocuments` (`src/app/[locale]/(seller-onboarding)/seller/onboarding/_components/steps/StepDocuments.tsx` lines 180–194). Checkbox is not a kit component. That is not a kit gap. Do not send it to Claude Design. Links: `routes.legal.terms` for `buyer_terms`, `routes.legal.returns` for `return_policy`. Both pages exist.

**Sweeper tests and history.** A committed cancel writes `order_status_history`. `no_delete_order_history` will not remove it (Q1, REG-117). The local CI proof rolls back inside the harness. The staging integration test does not commit a swept order until FLAG-SWEEP-RESIDUE is answered. Do not disable the rule. Do not widen Guard G.

### FLAGs

For the planning chat. This pack does not answer them.

1. **FLAG-PHONE.** The archived test navigates on submit, after `createOrderFromInquiry` returns `phone_required`, and it renders `CheckoutForm`. Neither exists on `main`. The assertion stays phone-NULL → `/auth/phone`. Where in the v2 checkout that redirect fires is not chosen here. T13 stops until the chat records the place.
2. **FLAG-P66-DEST.** P66 has no address control. The preview needs a destination governorate. `getOwnAddresses` orders a default first (archive query header). Whether P66 uses that default, and what it shows when the buyer has no address, is not pinned. T12 stops on the P66 figure until the chat records it. P15 uses the address the buyer selects on that page.
3. **FLAG-CHANNEL.** The exit asks for one in-app `notifications` row. Live `notification_channel` is `push`, `sms`, `whatsapp`, `email`. No in-app member. The sweeper must not add a member. T09 stops until the chat names the `type` string and one of those four labels.
4. **FLAG-STORE-CODE.** REG-115 needs an exception string. The cart and quote codes are `BETK_CART_STORE_INACTIVE` and `BETK_QUOTE_STORE_INACTIVE`. The checkout string is not in the repo. T02 stops until the chat names it. The refusal still writes nothing.
5. **FLAG-PANEL.** UI spec P15 says the panel lists the four R-G05 documents and does not hard-code the subset. That sentence is from when REG-88 was open. The pin's blocking set is two documents. This pack's panel is one checkbox and link per blocking document. T14 stops until the chat confirms the other two are not rendered.
6. **FLAG-SWEEP-RESIDUE.** A staging test that commits a swept order leaves append-only history the test cannot delete. Local CI can roll back. T15 stops until the chat says how the staging exit proves the sweeper without that residue, or says the local harness is the database evidence and the staging suite does not commit a swept order.

No kit gap is opened by this pack. CheckoutSellerSections and AddressForm are in the manifest. The version gate uses the P08/P23 native checkbox. If a later task finds a real missing kit part, it flags it and waits. It does not restyle, and it does not call Claude Design unless the chat records a sanction.

## 7. Canonical prompts

T00 is this file. Do not re-run it.

### T01

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T01 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: cut feature/phase-11-checkout from origin/main after the T00 PR is on main. State the SHA. Stop if the planning chat has not reviewed the pack.

Restore from archive/phase-07-v1-single-seller only: src/features/buyer-account/actions/createAddress.ts, src/features/buyer-account/queries/getOwnAddresses.ts, src/validations/address.ts. Rewire imports. Do not restore AddressForm, CheckoutForm, or createOrderFromInquiry. P10 /account/addresses composes AddressForm, EmptyState, and ConfirmDialog. Do not restyle them. Do not write fullName or phone (the archive header: addresses has no such columns). Author edit, delete, and set-default on this page. Zod before any database call. RLS is addr_self. Keep a single is_default. Do not add an index and do not add a migration. Raise Guard F from 32 to 33 only in the commit that adds the page. OD-21 stays 79.

Done-when: the three files are restored, the page lists and creates and edits and deletes and sets a default, a second default does not remain, fullName and phone are not written, and the page-count pin is 33.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the three restored files, the P10 route and its actions and Zod schemas, the page-count pin, the tests for the Done-when lines, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: feat(p11-t01): restore addresses and the address book
```

### T02

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T02 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.
Stop unless FLAG-STORE-CODE is answered in SESSION_CONTEXT.

P11M1 staging text and AUDIT. One transaction. Replace checkout_from_cart for these changes only: charge cart_items.unit_price for fixed and custom lines; refuse a non-active store with the named exception and write nothing; set display_ref to the master betk_ref plus "-" plus the 1-based store_id ascending position; require an agreement_acceptances row for the current buyer_terms version and the current return_policy version before any insert, and write no master when either is missing. seller_agreement and privacy stay ungated. Child betk_ref stays NULL. No new table. No settings write. No phone predicate. No escalation-column write. ASCII-only. Audit every grant, policy, and function: MATCH, BROADER, NARROWER, AUTHORED, MISMATCH, FINDING. A GRANT never closes a BROADER table privilege. Zero MISMATCH. Do not call apply_migration. Do not write staging. This prompt has no SQL body.

Done-when: P11M1.sql and AUDIT-P11M1.md exist, the audit records zero MISMATCH, and the text is not applied. Ledger is still 42, last 20261006100204.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: docs/03-database/rehearsal/staging-text/P11M1.sql, docs/03-database/rehearsal/AUDIT-P11M1.md, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: docs(p11-t02): P11M1 staging text and audit
```

### T03

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T03 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.

CI proof of P11M1 on a local Supabase stack. Do not apply to staging. The harness prints CSV with header name,expected,actual,pass. The gate parses that header and stops at the first row that is not four fields. The harness issues no DDL, disables no protection, and rolls back. Cases: a fixed line is charged at cart_items.unit_price after the listing price changes; a custom line is charged at cart_items.unit_price; a non-active store writes nothing; display_ref is the master betk_ref, a hyphen, and the 1-based store_id order; a missing buyer_terms or return_policy acceptance writes no master; a present pair of acceptances can pass that gate. Set payment_window_minutes to a value labelled CI TEST VALUE inside the harness transaction only. Insert and delete the courier band inside that transaction. Do not write those values on staging.

Done-when: the CI run is green and the CSV gate passes. list_migrations on staging is unchanged. payment_window_minutes on staging is still empty.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the CI workflow and assert harness this task adds, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: ci(p11-t03): prove P11M1 on a local stack
```

### T04

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T04 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.

Apply the bound P11M1.sql. STOP unless the planning chat has reviewed T02 and T03 and the human has typed GO. Before apply_migration, state the query argument's md5 and byte length and show they equal the file. If the stored statement differs in any byte, STOP. Do not edit supabase_migrations history. Ledger 1:1 after. Backfill BETK_DATABASE_SCHEMA.sql. Advisors before and after; every delta attributed. Apply the CI Types drift diff verbatim. No bridge cast. Do not write admin_settings. Do not disable an append-only rule. ASCII-only file.

Done-when: the applied version matches the file's md5 and byte length, ledger is 43 and 1:1, and checkout_from_cart on staging charges cart_items.unit_price.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the applied migration file, BETK_DATABASE_SCHEMA.sql, types.ts only if the CI diff changed it, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: feat(p11-t04): apply P11M1 checkout changes
```

### T05

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T05 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.

One guarded execute_sql. Not a migration. Not apply_migration. Cite D-93 and D-98-99. Pre-check: payment_window_minutes, agreement_return_policy_version, and agreement_privacy_version are empty. If any is not empty, STOP and write nothing. Then set them to 60, STAGING-DRAFT-1, and STAGING-DRAFT-1. Post-check those three values. Do not write any other key. Do not write production. Record the statement, the row count, and the before and after lengths.

Done-when: the three staging values equal the pin and the other agreement keys are unchanged.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: chore(p11-t05): staging payment window and draft policy labels
```

### T06

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T06 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.

P11M2 staging text and AUDIT. One read-only function. It does not insert, update, or delete. It returns one combined delivery total and no per-seller fee. Origin is the store governorate. Destination is the address governorate. Weight band matches checkout_from_cart. A missing band raises BETK_CHECKOUT_RATE_MISSING. Name the function in the file and mark it AUTHORED. No new table. No settings write. ASCII-only. Zero MISMATCH. Do not apply. Do not write staging. This prompt has no SQL body.

Done-when: P11M2.sql and AUDIT-P11M2.md exist, the audit records zero MISMATCH, and the text is not applied.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: docs/03-database/rehearsal/staging-text/P11M2.sql, docs/03-database/rehearsal/AUDIT-P11M2.md, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: docs(p11-t06): P11M2 delivery preview text and audit
```

### T07

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T07 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.

CI proof of P11M2 on a local stack. Do not apply to staging. CSV header name,expected,actual,pass. No DDL. Roll back. Cases: two bands produce one sum equal to the two fees; the result has no per-seller fee; a missing band raises BETK_CHECKOUT_RATE_MISSING; changing the destination governorate changes the sum. Insert and delete the bands inside the transaction. courier_rates on staging stays 0.

Done-when: the CI run is green. Staging ledger and courier_rates count are unchanged.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the CI workflow and assert harness this task adds, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: ci(p11-t07): prove the delivery preview on a local stack
```

### T08

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T08 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.

Apply the bound P11M2.sql. STOP unless the planning chat has reviewed T06 and T07 and the human has typed GO. md5 and byte length before the call. Stored statement must match. STOP on any byte difference. Ledger 1:1. Schema backfill. Advisors before and after. Types diff verbatim. No settings write. No protection DDL.

Done-when: the applied version matches the file, and the preview function is callable on staging without writing a rate row.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the applied migration file, BETK_DATABASE_SCHEMA.sql, types.ts only if the CI diff changed it, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: feat(p11-t08): apply the delivery preview
```

### T09

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T09 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.
Stop unless FLAG-CHANNEL and FLAG-SWEEP-RESIDUE are answered in SESSION_CONTEXT.

P11M3 staging text and AUDIT. A pg_cron job scheduled every minute. It cancels pending children of a master whose proof_path is null and whose payment_deadline has passed, using the existing no-JWT system branch. It does not write escalated_at, escalation_reason, or escalation_note. REG-104 stays Phase 13. It inserts one notifications row for the buyer with the type and channel the chat named, and a later run does not insert a second row. Do not add an enum member. No new table. ASCII-only. Zero MISMATCH. Do not apply. Do not write staging. This prompt has no SQL body.

Done-when: P11M3.sql and AUDIT-P11M3.md exist, the audit records zero MISMATCH, and the text is not applied.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: docs/03-database/rehearsal/staging-text/P11M3.sql, docs/03-database/rehearsal/AUDIT-P11M3.md, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: docs(p11-t09): P11M3 sweeper text and audit
```

### T10

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T10 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.

CI proof of P11M3 on a local stack. Do not apply to staging. CSV header name,expected,actual,pass. No DDL. Roll back. Do not disable a history rule. Cases: a past deadline and a null proof cancel the children, restore tracked stock, restore the cart per REG-82, and insert one notifications row for the buyer; a second run does not insert another row; a master with a proof is not cancelled; escalation columns are unchanged. The schedule in the file is every minute.

Done-when: the CI run is green and the harness rolled back. Staging cron.job has no new name.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the CI workflow and assert harness this task adds, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: ci(p11-t10): prove the payment-window sweeper on a local stack
```

### T11

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T11 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.

Apply the bound P11M3.sql. STOP unless the planning chat has reviewed T09 and T10 and the human has typed GO. md5 and byte length before the call. STOP if the stored statement differs. Ledger 1:1. Schema backfill. Advisors before and after. Types diff verbatim if the diff is non-empty. No settings write. No protection DDL. Confirm the live job schedule is every minute.

Done-when: the applied version matches the file and cron.job lists the new job at every minute.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the applied migration file, BETK_DATABASE_SCHEMA.sql, types.ts only if the CI diff changed it, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: feat(p11-t11): apply the payment-window sweeper
```

### T12

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T12 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.
Stop on the P66 figure unless FLAG-P66-DEST is answered. P15 may proceed with the address selected on that page.

P15 /checkout composes CheckoutSellerSections, AddressForm, Button, and ConfirmDialog. Do not restyle them. The action calls checkout_from_cart only. It does not call create_order_from_inquiry. No inquiry query. Change routes.checkout so it is /checkout with no inquiry argument. No delivery-mode picker. No per-seller fee. No commission. Deposit shown is the master half. Do not link to the Phase 12 confirmation page. Write checkoutSections.loading, delivery, total, empty, and error in ar and en. No new component prop. P66 calls the preview and shows the delivery figure and the total, using the destination the chat recorded. Raise Guard F from 33 to 34 only in the commit that adds the checkout page. OD-21 stays 79. Zod before any database call.

Done-when: P15 places an order only through checkout_from_cart; the page shows one delivery total and no per-seller fee; P66 shows the figure and the total from the preview; the loading key exists in both catalogs; the page-count pin is 34.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the P15 route and action, the P66 cart changes, routes.ts, messages ar/en, the page-count pin, the tests for the Done-when lines, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: feat(p11-t12): checkout page and the cart delivery figure
```

### T13

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T13 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.
Stop unless FLAG-PHONE is answered in SESSION_CONTEXT.

Restore tests/unit/checkoutForm.phoneGate.navigate.unit.test.ts from archive/phase-07-v1-single-seller and rewire it to the v2 checkout surface the chat named. Do not restore CheckoutForm or createOrderFromInquiry from that tag. The assertion stays phone-NULL to /auth/phone. Do not add a phone check to add-to-cart.

Done-when: the unit test fails if that navigation does not happen, and it passes when it does.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the rewired unit test and the checkout file it drives, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: test(p11-t13): rewire the phone-gate navigation test
```

### T14

```text
MODEL: Grok 4.7 · THINKING: Medium
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T14 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.
Stop unless FLAG-PANEL is answered.

Compose the version-gate panel on P15 from a native checkbox and Link, one pair per document in the blocking set. Follow RegisterForm and StepDocuments. Do not add a kit component. Do not restyle. Links go to the existing legal routes. The action writes the acceptance rows for the checked documents at the current version labels, or it does not call checkout. The database gate in P11M1 remains the authority.

Done-when: a buyer missing either required acceptance gets no master, and after both acceptances the same cart can complete.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is opened by the exit task.
Phase 11 tasks stay on feature/phase-11-checkout until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the P15 panel and its action, messages ar/en, the tests for the Done-when lines, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9.
Commit message: feat(p11-t14): checkout version-gate panel
```

### T15

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 11 T15 from docs/10-ai-development/phase-packs/PHASE_11_CHECKOUT.md.
Branch: feature/phase-11-checkout.
Stop unless FLAG-SWEEP-RESIDUE is answered. Do not disable a history rule. Do not widen Guard G. If a delete leaves a row, STOP and report the counts and ids.

Exit evidence. Paste a result for every §8 row. The full integration suite is green on this commit, and the exit PR's required checks include Integration (staging) on the final head. Courier bands the tests insert are deleted before the test finishes. courier_rates is 0 at the end. Close REG-113, REG-115, and REG-81 on the evidence. Close REG-93 on the evidence that the deadline is 60 minutes. Close the staging halves of REG-98 and REG-99. Leave the production halves open with REG-96 and REG-97.

Done-when: each §8 row is green, the full integration suite is green, the named rows are closed as §8 says, and SESSION_CONTEXT says Phase 11 exit holds — or the miss is a named forward-fix and the exit does not hold.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD
This task is where the PR is due (W1). If this branch has no open pull request, gh pr create with the title equal to the commit subject and the body equal to this task's evidence summary. If a pull request for this branch is already open, do not open a second one.
Do not merge. Do not bypass checks.
File list: the integration tests this task adds, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_11_CHECKOUT.md §9, plus any evidence note this task adds under docs/.
Commit message: test(p11-t15): Phase 11 exit evidence
```

## 8. Exit gate

Each item below is evidence on the exit task. A hidden widget is not a pass. The full integration suite is green on the PR's final head, including Integration (staging). REG-113, REG-115, and REG-81 are closed on that evidence. REG-93 is closed on that evidence. REG-98 and REG-99 staging halves are closed. Their production halves stay open.

| # | Exit item | Evidence |
|---|---|---|
| 1 | N-seller cart writes 1 `master_orders`, N `seller_orders`, N `shipments`, and 2N `payments`. Stock decrements. `converted_to_order_id` stays unchanged. | Integration. The fixture's child totals keep both payment amounts above 0. The dropped conversion trigger is not recreated. |
| 2 | A failed attempt leaves zero of those rows (AC-CHK-1). | Integration. A forced refusal, then counts unchanged. |
| 3 | AC-CHK-2. Two buyers, one tracked stock. At most one checkout succeeds. Stock does not go negative. | Integration. The listing lock in `decrement_stock_on_confirm` is the mechanism. |
| 4 | AC-CHK-3. A blocked line refuses checkout. | Integration. No master. |
| 5 | AC-CHK-4. A missing required acceptance gets no master. | Integration. After both `buyer_terms` and `return_policy` acceptances at the current labels, the same cart can complete. |
| 6 | AC-CHK-5. No delivery-mode picker. | DOM. No pickup, remote, or self-delivery control. |
| 7 | AC-CHK-6. One combined delivery total. No per-seller fee. No commission. | The action result and the page. |
| 8 | Phone-NULL reaches `/auth/phone`. | The rewired unit test, at the place FLAG-PHONE recorded. |
| 9 | Sweeper. A past `payment_deadline` and a null proof cancel the children, restore tracked stock, restore the cart per REG-82, and leave one notifications row for the buyer. | The evidence path FLAG-SWEEP-RESIDUE recorded. Cadence is every minute. SMS delivery is Phase 17. |
| 10 | REG-113. Checkout charges `cart_items.unit_price` for a fixed line and for a custom line. | Integration. A later listing-price change does not change the charged unit price. |
| 11 | REG-115. A line whose store is not active writes nothing. | Integration. No master. |
| 12 | D-81. `display_ref` is the master `betk_ref`, a hyphen, and the 1-based `store_id` position. Child `betk_ref` is null. | Integration. Two stores, two suffixes, stable across a repeated read. |
| 13 | Delivery preview on P15 and on P66. | Both pages show one figure from the reader. P66's destination is the one FLAG-P66-DEST recorded. |
| 14 | REG-88 gate. | Same evidence as row 5. The panel is the checkbox and link pairs the chat confirmed. |
| 15 | REG-93. | The checkout deadline is 60 minutes after `now`. The staging key is `60`. |
| 16 | REG-98 and REG-99 staging. | The two staging values are `STAGING-DRAFT-1`. Production cells stay open. |
| 17 | Full integration suite. | `pnpm exec vitest run tests/integration` green, and CI `Integration (staging)` green on the exit PR's final head. |
| 18 | Rates leave no residue. | `courier_rates` is 0 after the suite. |

## 9. Results tracker

| Task | Status | Evidence pointer |
|---|---|---|
| T00 | Not started | |
| T01 | Not started | |
| T02 | Not started | |
| T03 | Not started | |
| T04 | Not started | |
| T05 | Not started | |
| T06 | Not started | |
| T07 | Not started | |
| T08 | Not started | |
| T09 | Not started | |
| T10 | Not started | |
| T11 | Not started | |
| T12 | Not started | |
| T13 | Not started | |
| T14 | Not started | |
| T15 | Not started | |

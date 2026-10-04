# PHASE_09_V2_SURFACES.md

> Phase 09 T00 pack. Docs only. Authority is `BETK_PHASES.md` Phase 09. Scope is frozen (OD-20 = 51 tables, OD-21 = 79 pages). This pack does not add a page, a table, or a feature.

## 0. Header

**Scope authority.** `docs/10-ai-development/BETK_PHASES.md` Phase 09 (Goal, Entry, Exit gate, Owns, Blocked, task table, PAGES, CODES). Data contract: `docs/03-database/BETK_ERD.md`. Page contract: `docs/00-design/BETK_UI_SPEC.md`. Pins recorded in T00 are in §4.

**Goal.** T&C at signup. Catalogue: products only, fixed price, shipping attributes, store categories max 3, food branch. Onboarding: pickup address, seller agreement, delivery-mode toggles retired. REG-51 and REG-72 through the §8 gap list (compose, do not restyle).

**PAGES:** P01, P02, P03, P04, P05, P08, P23, P27, P29, P31, P32, P33, P49, P67, P68, P69, P70

P03 is on this list for the store-name link only (F1, ListingCard `storeHref`, REG-72). Phase 03 stays signed. Nothing else about P03 changes.

**CODES:** FR-PUB-1, FR-PUB-2, FR-PUB-4, FR-PUB-5, AC-PUB-1, AC-PUB-2, AC-PUB-4, AC-PUB-5, FR-AUTH-3, AC-AUTH-3, FR-SEL-1, FR-SEL-5, FR-SEL-7, FR-SEL-9, FR-SEL-10, AC-SEL-1, AC-SEL-5, AC-SEL-7, AC-SEL-9, AC-SEL-10, FR-CAT-1, AC-CAT-1, AC-CAT-2, AC-CAT-3, AC-CAT-4, AC-CAT-5, AC-CAT-6, R-L01, R-L04, R-L09, R-L16, R-L17, R-L18, R-L19, R-L20, R-L21, R-L22, R-S10, R-K01, R-V03, AC-VIS-2, FR-AGR-1, R-G01, R-G02, R-G03, R-G04, R-G05, R-G06, R-G07, R-G08, AC-AGR-1, AC-AGR-2, AC-AGR-3, AC-AGR-4, AC-AGR-5, FR-ADM-2, AC-ADM-2, R-M01

**NOTHING ELSE.** No new table. No new page beyond the PAGES line. `components/ui` and `components/shared` stay Claude Design's. Cursor composes and wires data. A visual gap is a Claude Design handoff, not a restyle. `src/lib/supabase/types.ts` changes only by the CI diff (REG-32). No prompt in this pack contains a SQL body. No prompt says to apply from a plan section.

## 1. Entry checklist

Measured 2026-10-03 on branch `v2-p09-t00`, cut from `origin/main`.

| Check | Result |
|---|---|
| Phase 08 exit | Holds. `SESSION_CONTEXT.md` REG-105-FIX. Green run [37115653262](https://github.com/Jovo-Jovi/betk/actions/runs/37115653262). |
| PR #69 | Merged. `origin/main` = `30de78d3d51eda8c6d1168f90332a907fe9c728f`. Subject: `Merge pull request #69 from Jovo-Jovi/feature/phase-08-schema`. 2026-10-03 13:27:34 +0300. |
| Claude Design Wave 1 | PASSED review (2026-09-29, planning chat). Landed on `cd-delta-6-land-w1` (`cfb4cd7`), merged as PR #70 (`967ab3e`). |
| Ledger | MCP `list_migrations` = 39. Last `20261003082041` / `v2_08_functions`. |
| Residue | SELECT: `seller_orders` 7, `master_orders` 7, `order_status_history` 12, `payouts` 0. |
| Branch protection | `gh api repos/Jovo-Jovi/betk/branches/main/protection`. `required_status_checks.contexts`: `RLS smoke (staging)`, `Install`, `Lint`, `Typecheck`, `Vitest (unit)`, `Guards`, `Types drift`, `Build`. `strict` true. `enforce_admins.enabled` true. `allow_force_pushes.enabled` false. `allow_deletions.enabled` false. |

All eight required checks are present and `enforce_admins` is enabled. T00 did not change protection.

## 2. Binding rules

Phase 08 lessons, binding here:

- Staging SQL is a file under `docs/03-database/rehearsal/staging-text/`, audited before any apply. The audit verdicts are MATCH, BROADER, NARROWER, AUTHORED, MISMATCH, FINDING. A GRANT never closes a BROADER table privilege.
- Before every `apply_migration`, state the query argument's md5 and byte length and show they equal the bound file (`PRECEDENTS.md`, apply_migration gets the bound text).
- Shared close: every task after T00 commits on `feature/phase-09-surfaces` and pushes (`git push -u origin HEAD`). The pull request stays deferred to T11 (E3, amended by E1 on 2026-10-03). T11 opens the one PR. See the block below.
- No prompt wording that contradicts a binding in this pack, in `BETK_PHASES.md`, or in a pinned REG.
- Smoke and integration fixtures satisfy Phase 08 constraints: an active listing has shipping dimensions; a payout fixture has an eligible balance under the cap. Guard G's expected residue is decision Q1.

**Decision (human, 2026-10-04), verbatim.**

Q1 Append-only and evidence protections (no_delete_mod_log, the history rules, any immutability on agreement_acceptances) are never disabled outside an approved migration. Tests issue no DDL.
   Tests that must create append-only or evidence rows on staging use permanent, labelled fixture accounts — fixture-admin@betk.test and fixture-seller@betk.test (create them once if missing; never delete them).
   Guard G's expected residue = the N27 set + those fixture accounts + the append-only/evidence rows they own. It reports those counts at suite start and fails only on rows outside that set.
- Types come from the CI Types drift diff, applied verbatim. No hand edit. No bridge cast left.
- A visual gap goes to Claude Design. Cursor does not restyle the kit.
- The human acts only by merging, typing GO for an irreversible step, pasting to Claude Design, and answering a decision. This pack does not merge and does not bypass checks.

**W1 (verbatim).** W1 Workflow: at the end of any task that needs a PR, Cursor opens it with `gh pr create` (title = commit subject; body = the task's evidence summary). The human only merges. Never merge, never bypass.

**Shared close** (every prompt after T00 ends with this). E1 (planning-chat review of T01, 2026-10-03): this block pushes. E3: `gh pr create` is not in this block. T11's prompt is where the PR is due.

```text
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is deferred to T11 (E3). Phase 09 tasks stay on feature/phase-09-surfaces until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
```

## 3. Register plan

No reservations. Numbers are taken at mint time.

P09-T00 re-read (2026-10-03), before any mint: header REG-01..REG-105, next free **REG-106**, no REG-106 row. **None taken.** Next free stays **REG-106** / **OD-22** / **ADR-026**.

REG-75, REG-88, REG-95, REG-96, and REG-97 are updated in place. They are not new numbers.

## 4. Pins and the staging placeholder task

**Decisions (human, 2026-10-03), verbatim.**

REG-75 = B: no backfill. A user without an acceptance row for the current buyer_terms version is asked to accept at next sign-in, using the same gate R-G06 needs for version changes. Never write acceptance rows for acceptances that did not happen.

REG-88 = B: the checkout completion gate = {buyer_terms, return_policy}. seller_agreement is never in the buyer gate. privacy is not gated (public page, AC-AGR-4); revisit if counsel requires a consent step. Phase 11 reads this pin.

REG-95 = A: food_requirements holds a version label, "food-v1" (staging and production). The required artefacts are fixed by R-S10; their seller-facing copy lives in the i18n messages (ar/en).

REG-96 / REG-97: agreement version labels are opaque strings, compared for equality only.

- Production value = the document's effective date, YYYY-MM-DD, set when counsel delivers final text (launch gate).
- Staging value = "STAGING-DRAFT-1" for buyer_terms and seller_agreement, written by a named Phase 09 task, labelled as a placeholder (CF-12).
- Both rows stay OPEN for the production value.

**Decisions (human, 2026-10-03), verbatim.** Recorded in `SESSION_CONTEXT.md` and in §6.

F1 = P03 in. P03 joins Phase 09 for the store-name link only (ListingCard storeHref; REG-72). Edit BETK_PHASES.md Phase 09: PAGES line, the Blocked "Navigable store identity" list and the §4.b page→phase row add P03, for this purpose only. Nothing else about P03 changes; Phase 03 stays signed.

F2 = P33 only. DataTable is composed on P33 in Phase 09. P30 keeps its current list; DataTable on P30 stays a UI_SPEC §8 note with no owner.

F3 = pending. P67–P70 render a "pending legal review" notice (i18n ar/en) plus the version label. The E-1 drafts are never rendered.

F4 = drop GO. Pack T04 no longer waits for "GO P09-T04". The planning-chat review of T02 and T03 is the gate. GO stays reserved for irreversible steps.

**Decision (human, 2026-10-04), verbatim.**

S1 Approval-state columns are admin-only for end users.
   - On seller_documents, seller_profiles and stores, a BEFORE INSERT OR UPDATE trigger raises BETK_APPROVAL_STATE_ACTOR when the caller is an end user (JWT role 'authenticated') who is not betk.is_admin(), and the row writes an approval-state column. The only exceptions are the app's documented seller writes:
     • a seller INSERT of seller_documents is forced to review_status 'pending' with reviewed_at NULL (like the approved_at stamp);
     • resubmit resets review_status to 'pending' and reviewed_at to NULL, and seller_profiles rejected_reason to NULL and submitted_at to now();
     • submit inserts seller_profiles and stores in their initial 'pending' state.
   - The service role and server-side roles with no end-user JWT (cron, migrations) are allowed. Admins are allowed.
   - Read the role from the request JWT claim (auth.role() or request.jwt.claims; cite which). Do not use current_user: it's the owner inside a SECURITY DEFINER function.

**Register status after T01.** REG-75 and REG-88 are `PINNED 2026-10-03 (B)`. They close at the consuming exit with evidence. REG-95 is pinned `food-v1` and **closed** on T01's post-check. REG-96 and REG-97 stay OPEN for the production value. The staging placeholder is written.

**T01 is the named staging write.** One guarded `execute_sql` of exactly these five keys, and no others (E2):

- `agreement_buyer_terms_version` = `STAGING-DRAFT-1` (CF-12 placeholder)
- `agreement_seller_agreement_version` = `STAGING-DRAFT-1` (CF-12 placeholder)
- `food_requirements` = `food-v1`
- `price_band_min_egp` = `1`, labelled "STAGING placeholder — not a product decision (REG-62 launch gate unchanged)"
- `price_band_max_egp` = `1000000`, labelled "STAGING placeholder — not a product decision (REG-62 launch gate unchanged)"

Pre-check: each of those five values is empty text or the sentinel (`''` or `'0'`). Post-check: each value equals the string above. If any pre-check fails, STOP and write nothing. The statement is guarded so a value that is already non-empty and not the sentinel is not overwritten. Record it the way L1 was recorded: the statement, the row count, the before values' lengths, the after values. It is authorized by the decisions in this section and by E2. It is not a migration. A migration would carry the staging strings to production.

`agreement_return_policy_version` and `agreement_privacy_version` stay empty. Phase 11 reads REG-88 before it consults them. REG-62: building against the sentinel is allowed; launch is not. The two band values above are a staging placeholder, not a product decision. An empty band still fails closed (plan §8.2.5). Production stays REG-62. Do not write another band value.

CI may set its own keys to values labelled `CI TEST VALUE`. Those values never go to staging (Phase 08 R2).

## 5. Enforcement inventory and the DB plan

Server-side enforcement is required for every refusal. A hidden control is not evidence. UI composition still lands in the page tasks; the refusal evidence is the database error or the server-action result.

**FLAG-SUBMIT owner.** `submit_seller_application` was not rewritten in M8 (`M8.sql` header; AUDIT-M78). D3 keeps the argument list. Live signature (SELECT 2026-10-03): `p_name_ar text, p_name_en text, p_bio_ar text, p_slug text, p_category_primary text, p_category_secondary text, p_governorate text, p_city text, p_payment_methods jsonb, p_delivery_options jsonb, p_return_policy text, p_min_order_egp numeric, p_doc_front_path text, p_doc_back_path text`. INVOKER, `search_path=betk, public`. Phase 09 may replace the body. It does not add, drop, or reorder arguments. The same rule applies to `resubmit_seller_application` (`p_doc_front_path text, p_doc_back_path text`). M8 does not pin how category text matches `categories.id` (name, English name, or slug). Do not invent that match. Category rows are inserted by the server action with a `category_id` loaded from `betk.categories`. The RPC stops treating `p_category_primary`, `p_category_secondary`, and `p_delivery_options` as authority.

`checkout_from_cart` reads the four agreement keys and does not branch (M8 FLAG-REG-88). Phase 09 does not edit that function. Phase 11 applies the REG-88 set `{buyer_terms, return_policy}` inside it.

| Refusal | Where it is enforced | Cite |
|---|---|---|
| AC-AGR-1. Signup without the current Buyer T&C creates no usable account. | **(c)** app-layer server gate, using **(a)** `betk.agreement_acceptances` and `betk.checkout_agreement_version(text)`. The gate is the same one REG-75 B uses: no row for the current `buyer_terms` version means the account is not usable. The server action that finishes signup inserts the acceptance row in that request or it does not leave a usable profile. Empty version fails closed (plan §8.2.5). No backfill. | Table and unique key: live `uq_agreement_acceptances_version` and `chk_agreement_acceptance_status` (SELECT 2026-10-03). Reader: live `checkout_agreement_version(p_key text)`, DEFINER. Insert policy: `agreement_acceptances_insert` in applied `M2.sql` (`20261001091538`), `WITH CHECK (user_id = auth.uid())`, INSERT revoked from `anon`. |
| AC-AGR-2 path via REG-75 B. A user with no row for the current `buyer_terms` version is asked at the next sign-in. | **(c)** the same server gate as AC-AGR-1. Compared by string equality (REG-96). Checkout completion is Phase 11 (AC-CHK-4), not a Phase 09 edit of `checkout_from_cart`. | REG-75 pin in §4. R-G06. |
| AC-AGR-3. Onboarding submit without a current seller-agreement acceptance row is refused. | **(b)** the `submit_seller_application` body raises and writes nothing unless a row exists for `seller_agreement` at `checkout_agreement_version('agreement_seller_agreement_version')`. Empty version fails closed. Argument list unchanged. The server action's pre-check is not the evidence. | Live 15-argument signature (SELECT 2026-10-03). FLAG-SUBMIT. Plan §8.2.5. |
| Exit sentence "a fourth store category is refused", which PHASES labels AC-CAT-4. | **(a)** `trg_enforce_store_category_cap` BEFORE INSERT on `store_categories` calls `enforce_store_category_cap()` and raises `BETK_STORE_CATEGORY_CAP` when the count is already at `seller_category_limit`. Empty limit fails closed (`BETK_CATEGORY_LIMIT_UNCONFIGURED`). | Live function (SELECT 2026-10-03), no arguments, DEFINER. Body in applied M8 `20261003082041` (bound file `staging-text/M8.sql`). `seller_category_limit` is not empty (SELECT length 1; M3 documented default). |
| PRD AC-CAT-4. A listing in a category the seller was not approved for is refused. This is not the cap. | **(b)** publish trigger: `category_id` must be a `store_categories` row for this store with `approved_at` not null. A non-admin INSERT must not be able to stamp `approved_at` (the live insert check does not mention that column). | PRD AC-CAT-4. ERD publish gate (app + trigger). `store_categories_insert` in applied `M2.sql`: `WITH CHECK (store_id = my_store_id() OR is_admin())`. Update policy is admin-only. |
| AC-CAT-1. Publishing a service listing is refused. | **(b)** the same publish trigger: `status = 'active'` requires `type = 'product'`. The `service` enum member stays (ERD: dead at publish). R-L16's "app layer" sentence is the server action as well; the action is not the evidence, because a direct insert would bypass it. | Live `listing_type` still has `service` (schema source). No listing trigger today (ERD publish gate not landed in M8). |
| AC-CAT-2. Publishing without weight or without length, width, and height is refused. | **(a)** `chk_active_listing_shipping`. | Live SELECT 2026-10-03: `CHECK ((status <> 'active') OR (weight_g, length_mm, width_mm, and height_mm are all NOT NULL)) NOT VALID`. New writes are checked. Existing rows were not validated. Per-column `> 0` checks are also live. |
| AC-CAT-6 and AC-CAT-5, inside the same ERD publish gate. Not a separate exit bullet. | **(b)** the same trigger. Active requires `price_type = 'fixed'` and `price` not null. `prep_days` must sit inside `prep_cap_days`; an empty cap fails closed. | ERD listings publish gate. R-L17, R-L22. Dead `price_type` members stay. |
| AC-CAT-3. Price outside the band is refused. | **(b)** the same trigger. Either band key empty fails closed. T01 writes the staging band as a placeholder. Launch stays REG-62. Do not write another band value. | Plan §8.2.5. REG-62 pin in §6. |
| R-S10. Food publish without food approval is refused. | **(b)** the same trigger. A listing whose category is the seeded parent slug `food-beverages` or a descendant is food (`supabase/migrations/20260622091700_categories_seed.sql`). Publish requires that store-category row's `approved_at` and the four `seller_documents` types from M1: `food_packaging`, `food_label`, `food_expiry`, `food_social_url`. `food_requirements` is a version label. It is not parsed. An empty label does not skip the check and does not count as approval. | R-S10. ERD `seller_documents`. REG-95. Plan §8.2.5 food row. |
| REG-65. Onboarding no longer stores a delivery fee. | **(b)** the RPC body does not write a delivery fee and does not treat `p_delivery_options` as authority. **(c)** P23 and P27 server actions do not send modes or `delivery_fee_egp`. The column `stores.delivery_options` stays (ERD: not authoritative). Do not drop it. | Live RPC still has `p_delivery_options jsonb`. UI spec P23 binding and P27 "Do not write `stores.delivery_options`". OD-10. |
| Guest cannot add to cart. | **(a)** `cart_items_insert` requires `buyer_id = auth.uid()`, and INSERT is revoked from `anon`. A guest insert creates no row. The page task redirects to authentication; the redirect is not the evidence. | Applied `M2.sql` (`20261001091538`): policy `cart_items_insert` and `REVOKE INSERT, UPDATE, DELETE ON betk.cart_items FROM anon`. R-C01, AC-CART-1. Phase 10 owns the cart product. This phase's public pages must not grow a guest insert path. |

The three active staging listings may lack shipping attributes (`chk_active_listing_shipping` is NOT VALID). The new trigger does not scan them and does not backfill weights. An UPDATE that leaves one of them `active` fails until that row satisfies the gate. Do not invent dimensions for them.

**DB plan (there is a (b)).** One staging text, one audit, one CI proof, one apply. Pattern is Phase 08 T05b then T06.

1. **T02 authors** `docs/03-database/rehearsal/staging-text/P09M1.sql` and `docs/03-database/rehearsal/AUDIT-P09.md`. Objects, in one transaction: a BEFORE INSERT OR UPDATE publish trigger on `listings` for the (b) rows in the table above; a BEFORE INSERT trigger that forces `store_categories.approved_at` null unless `is_admin()`; `CREATE OR REPLACE` of `submit_seller_application` and `resubmit_seller_application` with the live argument lists, bodies that enforce AC-AGR-3 and REG-65. No new table. No new argument. No edit of `checkout_from_cart`. No settings UPDATE in the file. Audit every grant, policy, and function: MATCH / BROADER / NARROWER / AUTHORED / MISMATCH / FINDING. A GRANT never closes a BROADER table privilege. Zero MISMATCH before CI.
2. **T03 proves it in CI** on a local Supabase stack. Migrations are the 39 files at `30de78d` plus this text. A behaviour-assert harness prints CSV with header `name,expected,actual,pass`. The gate parses that header and stops at the first row that is not four fields. CI settings values are labelled `CI TEST VALUE` and are not the staging strings. Staging is not written.
3. **Review** is the planning chat, before apply. That review of T02 and T03 is the gate (F4). T04 does not wait for `GO P09-T04`. GO stays reserved for irreversible steps.
4. **T04 applies** the bound file with `apply_migration`. State md5 and byte length before the call. Ledger 1:1. Backfill `BETK_DATABASE_SCHEMA.sql`. Advisors before and after; every delta attributed. Then apply the CI Types drift diff verbatim. No bridge cast left.
5. **T01** (the placeholder) is not part of this file and can land before T04. It does not change the ledger.

## 6. Task table

Model is Grok 4.7 on every row. T01 cuts `feature/phase-09-surfaces` from `origin/main` after this pack's PR is on `main`. Later tasks stay on that branch.

| T | Work | Model | Thinking | Branch |
|---|---|---|---|---|
| T00 | This pack. Pins. Inventory. | Grok 4.7 | High | `v2-p09-t00` |
| T01 | Staging placeholder write of the five keys. Not a migration. | Grok 4.7 | High | creates `feature/phase-09-surfaces` |
| T02 | Author `P09M1.sql` and the audit. No apply. | Grok 4.7 | Max | `feature/phase-09-surfaces` |
| T03 | CI proof on a local stack. Gate parses the CSV header. | Grok 4.7 | Max | `feature/phase-09-surfaces` |
| T04 | Apply the bound text after the planning-chat review of T02 and T03. No GO. Types diff verbatim. | Grok 4.7 | Max | `feature/phase-09-surfaces` |
| T05 | P08 + P67–P70 acceptance capture. Prose is the pending-review notice. | Grok 4.7 | Medium | `feature/phase-09-surfaces` |
| T06 | P23 and P27. Pickup, categories, seller agreement, food artefacts. Toggles removed. | Grok 4.7 | Medium | `feature/phase-09-surfaces` |
| T07 | P31, P32, P33 catalogue rules. | Grok 4.7 | Medium | `feature/phase-09-surfaces` |
| T08 | P49 food and seller approval, composing ProofViewer. | Grok 4.7 | Medium | `feature/phase-09-surfaces` |
| T09 | P01, P02, P04, P05. Guest cart, service filter, share, store-name link. | Grok 4.7 | Medium | `feature/phase-09-surfaces` |
| T10 | P29 settlement copy. REG-53 closes by R-K01. | Grok 4.7 | Low | `feature/phase-09-surfaces` |
| T11 | Exit evidence. | Grok 4.7 | Max | `feature/phase-09-surfaces` |

### Mapping

| Source row | T |
|---|---|
| Phase 09: T00 write the pack | T00 |
| Named staging placeholder (decisions, §4) | T01 |
| (b) rows in §5: author | T02 |
| (b) rows in §5: CI proof | T03 |
| (b) rows in §5: apply | T04 |
| Phase 09: P08 + P67–P70 acceptance capture | T05 |
| Phase 09: P23 pickup, categories, seller agreement, food artefacts; P27 pickup address; toggles removed | T06 |
| Phase 09: P31, P32, P33 catalogue rules | T07 |
| Phase 09: P49 food and seller approval, composing ProofViewer | T08 |
| Phase 09: P01, P02, P04, P05 guest cart, service filter, share, store-name link. P03 store-name link only (F1) | T09 |
| Phase 09: P29 settlement copy (REG-64). REG-53 closes by R-K01 | T10 |
| Phase 09: Exit evidence | T11 |

### Carry-forwards (do not resolve the two FLAGs)

**Wave 1 composition.** ListingCard gets `href` OR `onClick`, never both. Kit links are plain `<a href>`. ShareButton `href` comes only from public route helpers. Admin queues use DataTable `rowHref`.

**REG-51, REG-58, REG-60, REG-72** close when composed. REG-58's dark-contrast check is an automated axe-core contrast check in both themes (Playwright or equivalent, in CI). No human visual step.

**F1 (human, 2026-10-03), verbatim.** F1 = P03 in. P03 joins Phase 09 for the store-name link only (ListingCard storeHref; REG-72). Edit BETK_PHASES.md Phase 09: PAGES line, the Blocked "Navigable store identity" list and the §4.b page→phase row add P03, for this purpose only. Nothing else about P03 changes; Phase 03 stays signed. T09 composes that link on P01, P02, P03, P04, and P05. It does not otherwise edit P03.

**F2 (human, 2026-10-03), verbatim.** F2 = P33 only. DataTable is composed on P33 in Phase 09. P30 keeps its current list; DataTable on P30 stays a UI_SPEC §8 note with no owner. T07 follows this. It does not edit D-1.

**F3 (human, 2026-10-03), verbatim.** F3 = pending. P67–P70 render a "pending legal review" notice (i18n ar/en) plus the version label. The E-1 drafts are never rendered. This gates T05.

**F4 (human, 2026-10-03), verbatim.** F4 = drop GO. Pack T04 no longer waits for "GO P09-T04". The planning-chat review of T02 and T03 is the gate. GO stays reserved for irreversible steps.

**Guard F.** The page-count pin (26) is raised only with a UI_SPEC reconciliation in the task that adds `page.tsx` files. T05 is that task if P67–P70 are new routes. Do not raise the pin in any other task.

**REG-85.** Never state how `stores.return_policy` relates to `/legal/returns`. P05 and P28 keep showing store policy with that relationship unstated. Phase 09 does not edit P28.

**REG-62.** Building against the price-band sentinel is allowed. Launch is not. T01 writes `price_band_min_egp` = `1` and `price_band_max_egp` = `1000000`, labelled "STAGING placeholder — not a product decision (REG-62 launch gate unchanged)". Do not write another band value. Production stays this gate.

**Fixtures.** Shipping dimensions on active listings. Payout fixtures under the cap. Guard G's residue set unchanged.

**No personal data** in any report or repo file.

## 7. Canonical prompts

T00 is this file. Do not re-run it.

### T01

Executed 2026-10-03. The write was the five keys in §4 (E2), not the three keys in the prompt below. Do not re-run it.

```text
MODEL: Grok 4.7 · THINKING: High
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T01 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: cut feature/phase-09-surfaces from origin/main after the T00 PR is on main. State the SHA.

This task is the named staging placeholder write. It is not a migration. Do not add a file under supabase/migrations. Do not call apply_migration.

Steps:
1. SELECT the three keys agreement_buyer_terms_version, agreement_seller_agreement_version, and food_requirements. STOP if any value is not empty text.
2. One guarded UPDATE sets exactly those three: buyer terms and seller agreement to STAGING-DRAFT-1, food_requirements to food-v1. The statement changes no row whose value is already non-empty. It does not touch agreement_return_policy_version, agreement_privacy_version, or the price-band keys.
3. SELECT the three values again. STOP if any value differs from the string in §4.
4. Record the statement, the row count, and the before and after lengths in SESSION_CONTEXT, the way L1 was recorded. Label the two agreement values as a CF-12 placeholder. No personal data.

Done-when: the three staging values match §4 and no migration file was added.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
Do not git push. Do not gh pr create. Phase 09 tasks stay on feature/phase-09-surfaces until the exit PR (T11). Commit on this branch only.
Do not merge. Do not bypass checks.
File list: SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9 only.
Commit message: docs(p09-t01): staging placeholder for agreement versions and food-v1
```

### T02

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T02 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: feature/phase-09-surfaces.

Author docs/03-database/rehearsal/staging-text/P09M1.sql and docs/03-database/rehearsal/AUDIT-P09.md. Do not apply. Do not call apply_migration. Do not UPDATE admin_settings. Do not edit checkout_from_cart.

The file contains one transaction: the listings publish trigger from §5 (service, fixed price, prep cap, empty band fails closed, approved category, food artefacts for food-beverages and its descendants); the non-admin approved_at stamp on store_categories; CREATE OR REPLACE of submit_seller_application and resubmit_seller_application with the live argument lists only. Bodies refuse submit without a seller_agreement acceptance row for the current version and do not write a delivery fee. They do not match category text to a category id.

Audit every grant, policy, and function with MATCH, BROADER, NARROWER, AUTHORED, MISMATCH, or FINDING. A GRANT never closes a BROADER table privilege. STOP if any row is MISMATCH.

Done-when: the audit file has zero MISMATCH and staging was not written.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is deferred to T11 (E3). Phase 09 tasks stay on feature/phase-09-surfaces until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: staging-text/P09M1.sql, AUDIT-P09.md, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9.
Commit message: docs(p09-t02): author the Phase 09 publish and submit texts
```

### T03

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T03 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: feature/phase-09-surfaces.

Prove P09M1.sql on a local Supabase stack in GitHub Actions. Pin the migrations to the 39 files at 30de78d, then apply the new text on that stack only. Do not apply it to staging. Do not call apply_migration.

The harness prints CSV with header name,expected,actual,pass. The workflow gate parses that header and stops at the first row that is not four fields. Assert each §5 (b) refusal and the §5 (a) cap and shipping check. CI admin_settings values used by the test are labelled CI TEST VALUE. Do not write STAGING-DRAFT-1 or food-v1 into the workflow as if they were production. Do not weaken an expected value to make a row pass.

Done-when: the Actions run is green, every pass is t, and list_migrations on staging is still 39 ending 20261003082041.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is deferred to T11 (E3). Phase 09 tasks stay on feature/phase-09-surfaces until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the workflow and harness files this task adds under .github/workflows and docs/03-database/rehearsal, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9.
Commit message: test(p09-t03): CI proof of the Phase 09 publish and submit texts
```

### T04

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T04 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: feature/phase-09-surfaces.

The gate is the planning-chat review of T02 and T03 (AUDIT-P09.md and the green T03 run). Do not wait for GO P09-T04. GO stays reserved for irreversible steps (F4).

Steps:
1. Advisors before. State md5 and byte length of the P09M1.sql query argument and show they equal the file. apply_migration of that file only. Ledger 1:1. Rename the local migration file to the returned version. Backfill BETK_DATABASE_SCHEMA.sql.
2. Advisors after. Attribute every delta. An unexplained finding is a STOP.
3. When CI Types drift prints a diff of src/lib/supabase/types.ts, apply that diff verbatim. Do not hand-edit types.ts. Do not leave a bridge cast. Fix call sites only by deleting a cast the new types make unnecessary, or by a typed column list. Do not rename a relation to keep an old cast.

Done-when: the ledger includes the new version, advisors are attributed, and types.ts matches the CI blob.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is deferred to T11 (E3). Phase 09 tasks stay on feature/phase-09-surfaces until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the renamed migration, BETK_DATABASE_SCHEMA.sql, src/lib/supabase/types.ts, the call sites the diff forced, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9.
Commit message: feat(p09-t04): apply the Phase 09 publish and submit texts
```

### T05

```text
MODEL: Grok 4.7 · THINKING: Medium
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T05 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: feature/phase-09-surfaces.

P08 and P67–P70. Acceptance capture. The prose is not the E-1 drafts.

Steps:
1. P67–P70 render an i18n "pending legal review" notice plus the version label from the settings reader. Never render docs/01-product/legal/drafts. AC-AGR-4: the four pages are readable without an account.
2. P08 signup: the server action inserts a buyer_terms acceptance row for the current version or it does not leave a usable profile. The sign-in gate (REG-75 B) sends a user with no row for that version to the accept step. Do not insert rows for people who did not accept.
3. If this task adds page.tsx files, reconcile Guard F's pin with BETK_UI_SPEC.md in this same task. Do not raise the pin anywhere else.
4. Do not state how a store return policy relates to the returns page (REG-85).

Done-when: an integration or HTTP check shows signup without acceptance leaves no usable profile, and the legal pages render the notice plus the version label and not the draft prose.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is deferred to T11 (E3). Phase 09 tasks stay on feature/phase-09-surfaces until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the P08 and P67–P70 route and action files, messages/ar.json, messages/en.json, the Guard F pin file only if the page count changed, tests that prove the gate, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9.
Commit message: feat(p09-t05): signup acceptance gate and pending legal pages
```

### T06

```text
MODEL: Grok 4.7 · THINKING: Medium
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T06 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: feature/phase-09-surfaces.

P23 and P27. T04 is already applied. Do not change the RPC argument list.

Steps:
1. P23 collects pickup, up to the category limit, the seller-agreement e-sign, and the four food artefacts when a food-beverages category is chosen. Copy for those artefacts is i18n, keyed off the food-v1 label. Submit calls submit_seller_application with the existing arguments. The action inserts store_categories by category id. It does not send delivery modes or a delivery fee.
2. The server action refuses when the seller-agreement acceptance row is missing. The evidence is the RPC error and zero store rows, not a disabled button.
3. P27 writes store_pickup_addresses only. It does not write stores.delivery_options. The DOM has no delivery, pickup, or remote toggles. Street is not a new RPC argument.
4. Do not state a relationship between store return policy and the platform returns page.

Done-when: an integration test refuses submit without the acceptance row, and a submit with the row stores no delivery fee.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is deferred to T11 (E3). Phase 09 tasks stay on feature/phase-09-surfaces until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: seller-onboarding and seller delivery route, action, and validation files, messages ar/en, the integration test, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9.
Commit message: feat(p09-t06): onboarding pickup, agreement, and food artefacts
```

### T07

```text
MODEL: Grok 4.7 · THINKING: Medium
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T07 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: feature/phase-09-surfaces.

P31, P32, P33. The publish trigger from T04 is the refusal. The form's checklist is not the evidence.

Steps:
1. Create and edit send type product, price_type fixed, the four shipping attributes, prep_days, and a category id that is an approved store category. Draft saves skip the active gate.
2. Server actions surface the database refusal for a service, a missing dimension, a fourth category, an unapproved category, prep above the cap, a price outside the band, and a food listing without food approval. Empty band fails closed. The staging band is the T01 placeholder. Do not write another band value.
3. P33 inventory composes DataTable with rowHref. PHASES names P33. D-1 recorded P30. Do not move the table to P30 and do not edit D-1. Do not restyle DataTable.
4. Active-listing fixtures include shipping dimensions. Do not add a guest insert.

Done-when: integration tests show each of those refusals as a database or action error, and a valid product publish succeeds.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is deferred to T11 (E3). Phase 09 tasks stay on feature/phase-09-surfaces until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: listings feature files for P31 P32 P33, messages ar/en, the integration tests, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9.
Commit message: feat(p09-t07): catalogue publish rules on the listing surfaces
```

### T08

```text
MODEL: Grok 4.7 · THINKING: Medium
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T08 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: feature/phase-09-surfaces.

P49. Compose ProofViewer. Do not restyle it. food_social_url stays on this admin surface only.

Steps:
1. The queue reads seller_profiles, stores, seller_documents including the four food types, store_categories, the seller-agreement acceptance, and the seller's own pickup address. Signed URLs for documents.
2. Approval writes store_categories.approved_at through the admin path and writes moderation_logs with a target the live moderation_target enum already allows (REG-70: do not add a member).
3. A non-admin GET of this route is not-found, not 200. Guard E applies if the page calls notFound().
4. Do not render buyer identity on a seller page from this data.

Done-when: an integration test shows a non-admin cannot set approved_at, and an admin approval is what lets a later food publish pass the trigger.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is deferred to T11 (E3). Phase 09 tasks stay on feature/phase-09-surfaces until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the P49 admin route and action files, messages ar/en, the integration test, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9.
Commit message: feat(p09-t08): admin seller and food approval queue
```

### T09

```text
MODEL: Grok 4.7 · THINKING: Medium
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T09 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: feature/phase-09-surfaces.

P01, P02, P04, P05, and P03 for the store-name link only (F1). Phase 03 stays signed. Nothing else about P03 changes.

Steps:
1. A guest add does not insert cart_items. The evidence is zero rows after the attempt (the live insert policy and the anon revoke). Send the guest to authentication. Do not add a client-only hide as the proof.
2. Remove the service filter from these discovery surfaces. Do not drop the listing_type enum member.
3. Compose ShareButton on P04. href comes only from a public route helper. Compose store-name navigation on P01, P02, P03, P04, and P05 with the kit: ListingCard storeHref; href OR onClick, never both; kit links are plain a href. P03 is the store-name link only. Do not restyle the kit.
4. REG-51 and REG-72 close in this task when that DOM is present, with the control in the DOM and not only in the hydration payload.
5. Do not state how store return policy relates to the platform returns page. P05 keeps showing the store text alone.

Done-when: an HTTP or integration check shows a guest add leaves zero cart rows, and a DOM check shows the share control and the store-name link on the pages this task owns.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is deferred to T11 (E3). Phase 09 tasks stay on feature/phase-09-surfaces until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: the P01 P02 P04 P05 composition files, the guest-cart test, SESSION_CONTEXT.md (REG-51 and REG-72 status), DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9.
Commit message: feat(p09-t09): public surfaces share, store links, and guest cart refusal
```

### T10

```text
MODEL: Grok 4.7 · THINKING: Low
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T10 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: feature/phase-09-surfaces.

P29 settlement copy (REG-64). REG-53 closes by R-K01. Modes are retired. Do not derive a delivery mode from a category. cod_enabled stays in the JSON and is not a publish gate (REG-63). Do not drop it.

The axe-core contrast check for REG-58 runs in CI in both themes on the SearchBar. No human visual step. Close REG-58 and REG-60 when the composed pages pass that check. Do not restyle SearchBar or SellerChrome.

Done-when: P29 copy is the settlement wording in both locales, REG-53's status cites R-K01, and the contrast job is green in both themes.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
git push -u origin HEAD. Do not gh pr create. The pull request is deferred to T11 (E3). Phase 09 tasks stay on feature/phase-09-surfaces until that exit PR. Commit on this branch only.
Do not merge. Do not bypass checks.
File list: P29 copy and messages, the axe test and its CI wiring, SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9.
Commit message: feat(p09-t10): settlement copy and automated contrast check
```

### T11

```text
MODEL: Grok 4.7 · THINKING: Max
Read docs/10-ai-development/SESSION_CONTEXT.md + docs/PRECEDENTS.md, then execute Phase 09 T11 from docs/10-ai-development/phase-packs/PHASE_09_V2_SURFACES.md.
Branch: feature/phase-09-surfaces.

Paste evidence for every §8 row. STOP if a row has no automated evidence. A hidden control is not evidence. Do not add a migration to paper over a miss.

Done-when: each §8 row is green and SESSION_CONTEXT says Phase 09 exit holds, or the miss is a named forward-fix and the exit does not hold.
STEP Z
Author name: jiovanny adel
Author email: 175926007+Jovo-Jovi@users.noreply.github.com
Do not change global git config. Set author and committer for this commit only.
Update SESSION_CONTEXT.md and docs/12-changelog/DEVELOPMENT_JOURNAL.md in this commit.
git add only the file list in this prompt.
This task is where the PR is due (E3). git push -u origin HEAD
If this branch has no open pull request, gh pr create with the title equal to the commit subject and the body equal to this task's evidence summary. If a pull request for this branch is already open, do not open a second one.
Do not merge. Do not bypass checks.
File list: SESSION_CONTEXT.md, DEVELOPMENT_JOURNAL.md, PHASE_09_V2_SURFACES.md §9, plus any evidence note this task adds under docs/.
Commit message: docs(p09-t11): Phase 09 exit evidence
```

## 8. Exit gate

Each `BETK_PHASES.md` Phase 09 exit item has an automated method. A hidden widget is not a pass.

| # | Exit item | Evidence |
|---|---|---|
| 1 | Signup without the current Buyer T&C creates no usable account (AC-AGR-1). | Integration or HTTP: the signup action without an acceptance insert leaves no usable profile. A later protected request from a user with no `buyer_terms` row for the current version is the accept step (the REG-75 B gate). |
| 2 | Onboarding submit without a seller-agreement acceptance row is refused (AC-AGR-3). | Integration: the RPC raises, and the store row count is unchanged. |
| 3 | A service listing publish is refused (AC-CAT-1). | Integration: setting `type` to `service` and `status` to `active` errors. The enum member still exists. |
| 4 | A listing without weight or dimensions is refused (AC-CAT-2). | Integration: an active insert missing any of the four shipping columns errors on `chk_active_listing_shipping`. An insert with all four can succeed when the other gates pass. |
| 5 | A fourth store category is refused (the exit sentence; PHASES cites AC-CAT-4 for this sentence). | Integration: the fourth `store_categories` insert raises `BETK_STORE_CATEGORY_CAP` while `seller_category_limit` is 3. |
| 6 | PRD AC-CAT-4, recorded beside that sentence: a listing in a category the seller was not approved for is refused. | Integration: publish with `approved_at` null errors. A non-admin insert cannot set `approved_at`. |
| 7 | Food publish without food approval is refused (R-S10). | Integration: an active listing under `food-beverages` or a child errors until the category is approved and the four food document rows exist. |
| 8 | P23 and P27 render no `{delivery, pickup, remote}` toggles, and onboarding no longer stores a delivery fee (REG-65). | DOM: those three mode names are absent on P23 and P27. Integration: the stored `delivery_options` after submit does not contain a delivery fee. The DOM check alone is not the pass. |
| 9 | P04 share and store-name navigation on the pages this phase owns use the Stage D components. | DOM on P04 has the share control. DOM on P01, P02, P03, P04, and P05 has a store-name link (ListingCard storeHref). The assertion targets the element, not the hydration string. P03 is the store-name link only (F1). |
| 10 | Guest cannot add to cart (task row, R-C01). | Integration or HTTP: a guest attempt leaves zero `cart_items`. |

REG-75 closes when row 1's gate evidence is pasted. REG-88 stays pinned for Phase 11; this phase does not close it by hard-coding checkout. REG-95 is closed: T01's post-check shows `food-v1`. REG-96 and REG-97 stay open for the production date.

## 9. Results tracker

| Task | Status | Evidence pointer |
|---|---|---|
| T00 | written 2026-10-03 | this file; pins in SESSION_CONTEXT; ledger 39; residue 7/7/12; payouts 0; enforce_admins true |
| T01 | written 2026-10-03 | five staging keys; pre-check length 0; row count 5; post-check STAGING-DRAFT-1, STAGING-DRAFT-1, food-v1, 1, 1000000; ledger 39 last 20261003082041; F1–F4 in §4 and §6; no migration; no pull request (E3) |
| T02 | written 2026-10-03 | `P09M1.sql` and `AUDIT-P09.md`; zero MISMATCH; staging not written; ledger 39 last `20261003082041`; E1 pushed `b5a2817`; E2 REG-62 append; E3 fixture table in the audit; no pull request |
| T03 | done 2026-10-04 | F-P1 and F-P2 in `P09M1.sql`; `p09/asserts.sql`; `.github/workflows/p09-db.yml`; LF blob `853e9b715dd245d3acb6caf09246a315a5e5aec9`; SHA256 `936e0a768e280b9b5466821bdfb9dfd106676dff046b25c7a08acc069012433b`; green run [37155187920](https://github.com/Jovo-Jovi/betk/actions/runs/37155187920) (27 rows, every pass t, all_pass `true\|26`); PR #72 stays open for T11 |
| T04 | applied 2026-10-04 | `20261003214258` / `v2_09_publish_and_submit`; blob `853e9b715dd245d3acb6caf09246a315a5e5aec9`; md5 `dc36ceb0fa145f78a5ee8b8cd8d9dca3`; 11129 bytes; ledger 40; advisors unchanged (anon definer 2, authenticated definer 5); fixture table applied; green run [37156494034](https://github.com/Jovo-Jovi/betk/actions/runs/37156494034) all eight required checks; Types drift pass, no diff; RLS smoke pass |
| T05 | done 2026-10-04 | signup gate in `src/services/agreementVersions.ts`; P67–P70 pending notice plus version label; Guard F pin 30; staging integration `buyerTerms.gate.test.ts` 3/3; residue 7/7/12, payouts 0, acceptances 0, `@betk.test` 0; ip and user_agent not captured — counsel question pending (E-1); no pull request; green run [37158686070](https://github.com/Jovo-Jovi/betk/actions/runs/37158686070) all eight required checks |
| T06 | done 2026-10-04 | P23 pickup, categories, seller agreement, food artefacts; P27 pickup address; mode controls deleted; Guard F pin stays 30; staging `sellerOnboarding.t06.test.ts` 2/2; DOM `p09t06.surfaces.unit.test.ts` 4/4; residue 7/7/12, payouts 0, acceptances 0, `@betk.test` 0; no new page.tsx; no pull request; green run [37199953776](https://github.com/Jovo-Jovi/betk/actions/runs/37199953776) all eight required checks |
| T07 | done 2026-10-04 | P31 and P32 send product, fixed price, shipping, prep, and an approved category; P33 `DataTable` `rowHref`; staging `listings.publish.t07.test.ts` 8/8; residue 7/7/12, payouts 0, acceptances 0, `@betk.test` 0; no pull request; green run [37203067000](https://github.com/Jovo-Jovi/betk/actions/runs/37203067000) on `cc809ff`, all eight required checks |
| T08 | STOP 2026-10-04 | E1 FINDING: a seller session set `seller_documents.review_status` to `approved` on its own `food_packaging` and `national_id_front` rows (policy `sdoc_own`, `authenticated` UPDATE on `review_status`). `store_categories.approved_at` stayed null. `seller_profiles.status = 'approved'` raised `22P02`. No P49. No patch. Database fix is P09M2. Finding commit `2be9f88`; green run [37204528145](https://github.com/Jovo-Jovi/betk/actions/runs/37204528145) all eight required checks |
| T08-DB | done 2026-10-04 | `P09M2.sql` LF blob `ba7f823db4295d6b4017708bf8114f886ae6cff4`, SHA256 `ec63f6e0eae0506e7411386f82dee3f20b7b43fdfe6270ccf27a07ee67910ec3`; REG-106; green run [37210944666](https://github.com/Jovo-Jovi/betk/actions/runs/37210944666) on `cc2c798` (60 rows, every pass t, `all_pass` `true\|59`); ledger 40; no pull request |
| T08-APPLY | applied 2026-10-04 | `20261004172620` / `v2_09_approval_state_actor`; query md5 `d74202b62279731e2f36c201355f52ab`, 6737 bytes; ledger 41; food upsert sets `reviewed_at` null; REG-106 closed; REG-107 minted; green run [37221001414](https://github.com/Jovo-Jovi/betk/actions/runs/37221001414) on `0efa84f`, all eight required checks |
| T08 | resumed 2026-10-04 | P49 queue. Guard F pin 31. Signed URL expiry 60s. Integration 4/4. Green run [37222984871](https://github.com/Jovo-Jovi/betk/actions/runs/37222984871) on `bb57fbf`, all eight required checks |
| T08-FIX | done 2026-10-04 | Q1 recorded. Approval scenario uses fixture-admin and fixture-seller. Guard G expected set is N27 plus those accounts, the append-only rows they own, and the known buyer_terms acceptance. Green run [37233737013](https://github.com/Jovo-Jovi/betk/actions/runs/37233737013) on `1cc0443`, all eight required checks |
| T09 | done 2026-10-05 | Guest insert `42501`, cart_items 0 before and after, residue unchanged (7/7/12, fixtures 2, logs 2, acceptances 2). Active service listings 0, not updated. SSR share button on P04 and P05; store-name `<a href>` on P01–P05. REG-51 and REG-72 closed on those surfaces. Green runs [37236338420](https://github.com/Jovo-Jovi/betk/actions/runs/37236338420) on `024520a` and [37236692968](https://github.com/Jovo-Jovi/betk/actions/runs/37236692968) on `52f0f5f`, all eight required checks |
| T10 | | |
| T11 | | |

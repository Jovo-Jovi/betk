# BETK v2 — Stage A: Phase-07 branch disposition

> **Status:** DONE as far as git/GitHub evidence allows. **STEP 2 LIVE INTROSPECTION STOPPED.**
> Branch: `v2-stage-a-branch-disposition` (cut from `origin/main`).
> Date: 2026-09-17. Model: Cursor Grok 4.6 (architecture/docs task; typically Opus).
> Constraints honoured: docs only · zero `src/` · zero new SQL · MCP never called `apply_migration` · no branch deletion / merge / rebase / force-push.

This memo is the Stage A deliverable: commit inventory, migration-divergence evidence, artifact classification against the v2 baseline, disposition options, recommendation, and the preservation tag.

Authority cited: [`BETK_V2_SCOPE_BASELINE.md`](./BETK_V2_SCOPE_BASELINE.md) and [`BETK_V2_ROLE_JOURNEYS.md`](./BETK_V2_ROLE_JOURNEYS.md). REG-24 procedure: [`docs/PRECEDENTS.md`](../PRECEDENTS.md) row **REG-24 migration procedure**.

---

## STOP-and-flag (binding)

**STEP 2 was not executed.** Amendment 1: if MCP cannot reach staging under the new org, STOP and do not proceed to STEP 2. Do not substitute the local Supabase CLI.

MCP reachability probe (STEP 0, **before** any schema introspection):

| Probe | Namespace | Result |
|---|---|---|
| `list_organizations` | `plugin-supabase-supabase` | One org: **B2S** (`vaiwssguflgtmvuwcgma`). No org named BETK. |
| `list_projects` | `plugin-supabase-supabase` | `b2s-production` (`akpvvydmltmfmkmwivgn`), `b2s-staging` (`bnjrgoaoujnrlvuxicca`). Neither is BETK staging. |
| `get_project` `sojmjvohiziapiwkzsjg` | `plugin-supabase-supabase` | `MCP error -32600: You do not have permission to perform this action` |
| `get_organization` `qnqfvphzbxflspducuuf` | `plugin-supabase-supabase` | same permission error |
| `execute_sql` against `sojmjvohiziapiwkzsjg` (`select current_database(), now()`) | `plugin-supabase-supabase` | same permission error |
| `mcp_auth` then `get_project_url` / `execute_sql` / `list_migrations` / `get_publishable_keys` | `project-0-BETK-supabase` | auth succeeded; every subsequent call returned the same permission error |
| Re-`mcp_auth` on the plugin, then `list_projects` again | `plugin-supabase-supabase` | still **only B2S** |

BETK staging project ref (public, committed STAGING_ALLOWLIST in `tests/integration/rls.smoke.test.ts`): `sojmjvohiziapiwkzsjg`. MCP in this session cannot open that project.

**Therefore UNVERIFIED this session (do not copy-forward as live facts):**

- remote `list_migrations` applied count and last applied version
- existence of `20260723140552` objects on staging (`pg_policies` / `pg_trigger` / `pg_proc` / `information_schema.column_privileges`)
- security-advisor 5-tuple
- REG-24 remote↔local 1:1 against staging

**Also FLAG (not a REG-24 close):** local CLI profile `betk` logged in 2026-09-17 does **not** close REG-24. Login does not parse `config.toml` the way `db push` / typegen do; the hook-secret abort is unmeasured, not disproven. MCP remains the confirmed apply path. This session did **not** run `pnpm db:types` (REG-32 / PRECEDENTS: typegen is CI-authoritative).

Classification of **branch artifacts** (STEP 3) cites the v2 baseline + the SQL/files on the git refs. It does **not** claim those objects were re-seen live today.

---

## STEP 0 — Ground truth

| Fact | Value | METHOD |
|---|---|---|
| Current branch | `v2-stage-a-branch-disposition` (already existed, tracking `origin/main`, clean) | `git rev-parse --abbrev-ref HEAD` · `git status` |
| `origin/main` tip | `f13ac652ff2046fe02dc6665861db3fb8efc267d` (`f13ac65` Merge pull request #53 from Jovo-Jovi/v2-state-record) | `git fetch origin` then `git rev-parse origin/main` + `git log --oneline -1 origin/main` |
| `origin/feature/phase-07-orders` tip | `a27e7b0b1cbab722cb5bebe52d3d8daee0c52f22` (`a27e7b0` RESIDUE-PURGE: staging fixture-residue purge + REG-71 root cause + REG-74 Guard G) | `git rev-parse origin/feature/phase-07-orders` + `git log --oneline -1` |
| Merge-base | `3f76ccbd217c79e7cf39a943cdadb441af3e6374` (`3f76ccb` Merge pull request #49 from Jovo-Jovi/feature/phase-07-orders) | `git merge-base origin/main origin/feature/phase-07-orders` |
| MCP reachability of BETK staging | **FAIL** — see STOP above | MCP `list_projects` / `list_organizations` / `execute_sql` / `get_project_url` |

Non-merge commit count `origin/main..origin/feature/phase-07-orders` = **7**. Merge commits in that range = **0**. METHOD: `git rev-list --count --no-merges origin/main..origin/feature/phase-07-orders` and `git log --merges --oneline origin/main..origin/feature/phase-07-orders` (empty).

---

## STEP 1 — Commit inventory

Every non-merge commit in `origin/main..origin/feature/phase-07-orders`. METHOD: `git log --no-merges --format="%H %ad %s" --date=short` plus per-commit `git show --name-only`. Newest first. No commit omitted.

| SHA | Date | Task label | src/ | supabase/migrations/ | tests/ | docs/ | scripts/ | .github/ | messages/ |
|---|---|---|---|---|---|---|---|---|---|
| `a27e7b0b1cbab722cb5bebe52d3d8daee0c52f22` | 2026-07-24 | RESIDUE-PURGE (REG-71 root cause + REG-74 Guard G) | — | — | `tests/integration/orderPayment.noPureCod.dbCheck.test.ts` | `SESSION_CONTEXT.md` · `DEVELOPMENT_JOURNAL.md` · `PRECEDENTS.md` | — | — | — |
| `479708cb7080f29d7008fec6b37a5363fea6685b` | 2026-07-24 | Phase 07 / T04: buyer `/orders` + `/orders/[id]` + T03-evidence-topup + STOREFRONT-DIAG | checkout confirmation page + DepositProofPanel; new `orders/` + `orders/[id]/` routes + filter/row/cancel components; `src/features/checkout/components/DepositProofPanel.tsx` | — | `orderPayment.noPureCod.dbCheck.test.ts` · `tests/unit/checkoutForm.phoneGate.navigate.unit.test.ts` | `SESSION_CONTEXT.md` · `DEVELOPMENT_JOURNAL.md` | — | — | `ar.json` · `en.json` |
| `85faa61f4dc17090dc7bb2c1f772f666f9ec9aee` | 2026-07-23 | Phase 07 / T03: `/checkout` + `/checkout/confirmation/[id]` | checkout page + CheckoutForm + confirmation DepositProofPanel; inbox thread CTA; `buyer-account` address query/action; `getDepositHandles`; `confirmDepositPayment` comment; `validations/address.ts` | — | — | `SESSION_CONTEXT.md` · `DEVELOPMENT_JOURNAL.md` | — | — | `ar.json` · `en.json` |
| `361aee90a3306226a3b7a9af1963e8f1fdfcdf2c` | 2026-07-23 | Phase 07 / T02b: REG-49 write layer + atomic checkout RPC | `requireAdmin`; whole `src/features/checkout` + `src/features/orders` (actions/queries/rules/types); `validations/{checkout,orders}.ts`; `src/lib/supabase/types.ts` | **`20260723140552_order_payment_write_layer_reg49.sql`** | `orderPayment.writeLayer.test.ts` · `orders.stockDecrement.test.ts` · `tests/unit/checkoutRules.unit.test.ts` | `ADR.md` · `BETK_DATABASE_SCHEMA.sql` · `SESSION_CONTEXT.md` · `DEVELOPMENT_JOURNAL.md` · `PRECEDENTS.md` | — | — | — |
| `3d88da774095d704a2dce9c14bc4ac16d7e4e1f4` | 2026-07-23 | docs(adr): ADR-018 DRAFT (Proposed) | — | — | — | `docs/02-architecture/ADR.md` | — | — | — |
| `2f3074da6671b27eadf9c8461aafb30c769a6034` | 2026-07-23 | Phase 07 / T01c: pack identity + REG-66 closed-with-evidence | — | — | — | `SESSION_CONTEXT.md` · `PHASE_07_ORDERS.md` · `DEVELOPMENT_JOURNAL.md` | — | — | — |
| `330cd9d2e0185a24514b3305684e21b9db5c93bb` | 2026-07-23 | Phase 07 / T01b: pack regenerated for OD-8; branch re-cut; doc-residue swept | — | — | — | `SESSION_CONTEXT.md` · `PHASE_07_ORDERS.md` · `DEVELOPMENT_JOURNAL.md` | — | — | — |

`scripts/` and `.github/` are **empty** across the whole range. METHOD: `git diff --name-only origin/main origin/feature/phase-07-orders -- scripts/ .github/` (no output).

T01 migration `20260723074953_order_rls_and_conversion_link.sql` is **not** in this range: it landed on `main` via PR #49 (the merge-base). It is still classified in STEP 3 because the prompt named it.

---

## STEP 2 — Migration divergence, measured (git + GitHub; remote ledger STOPPED)

### (a) Diff by NAME

METHOD: `git diff --name-status origin/main origin/feature/phase-07-orders -- supabase/migrations`

```
A	supabase/migrations/20260723140552_order_payment_write_layer_reg49.sql
```

Exactly **one** file differs, and it is an **add** on the feature branch. No renamed/modified migration files.

### (b) File counts (local dirs, by ref)

| Ref | Count | Last filename | METHOD |
|---|---|---|---|
| `origin/main` | **30** | `20260723110557_od8_custodial_payment_columns_and_settings.sql` | `(git ls-tree -r --name-only origin/main -- supabase/migrations).Count` |
| `origin/feature/phase-07-orders` | **31** | `20260723140552_order_payment_write_layer_reg49.sql` | same METHOD on that ref |

### (c) MCP `list_migrations` against staging

**NOT RUN.** STEP 2 STOPPED (see STOP-and-flag). Remote applied count and last applied version = **UNVERIFIED**.

Closest non-MCP evidence that staging's remote ledger is **ahead of main's local dir**:

- GitHub check **Supabase Preview** on `origin/main` `f13ac65`: `conclusion=failure`, `output.title=Supabase Preview`, `output.summary=` `Remote migration versions not found in local migrations directory.` METHOD: `gh api repos/Jovo-Jovi/betk/commits/f13ac652ff2046fe02dc6665861db3fb8efc267d/check-runs` (jq name/conclusion/app/title/summary).
- Combined with (a)/(b): the only migration name present on the feature branch and absent from main is `20260723140552`. That is **circumstantial**, not a substitute for `list_migrations`.

### (d) LIVE-VERIFY of `20260723140552` objects

**NOT RUN.** No `pg_policies` / `pg_trigger` / `pg_proc` / `information_schema.column_privileges` rows to paste. Objects **named in the file** (read from `git show origin/feature/phase-07-orders:supabase/migrations/20260723140552_order_payment_write_layer_reg49.sql`, not from live DB, not from `BETK_DATABASE_SCHEMA.sql`):

**5 policies:** `settings_payment_config_read` · `payments_insert` · `payments_update` · `orders_update` · `modlog_admin_insert`

**3 SECURITY DEFINER trigger functions** (file text: `SECURITY DEFINER SET search_path = betk, public` and `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated`) + triggers: `enforce_payment_update` / `trg_enforce_payment_update` · `enforce_order_transition` / `trg_enforce_order_transition` · `set_order_commission_snapshot` / `trg_set_order_commission_snapshot`

**RPC:** `create_order_from_inquiry` — file text `SECURITY INVOKER SET search_path = betk, public`; `REVOKE EXECUTE FROM PUBLIC`; `GRANT EXECUTE TO authenticated`

**Column grants:** `REVOKE UPDATE ON betk.payments FROM authenticated` then `GRANT UPDATE (status, confirmed_by, confirmed_at, notes, proof_path, transfer_reference)`; `REVOKE UPDATE ON betk.orders FROM authenticated` then `GRANT UPDATE (status, cancellation_reason)`

Existence, `search_path` pin, EXECUTE revoke, and grants on **staging** = **UNVERIFIED** this session.

### (e) Is the D1 claim TRUE on main?

SESSION_CONTEXT standing fact (copied, not re-measured): *"Migration ledger = 31/31 (remote↔local 1:1; last `20260723140552_order_payment_write_layer_reg49`)."*

**FALSE on `origin/main`.**

| Side | Number | METHOD |
|---|---|---|
| main local files | 30 | `git ls-tree` Count |
| feature-branch local files | 31 | `git ls-tree` Count |
| remote applied | UNVERIFIED | MCP STOPPED |
| last file on main | `20260723110557_…` | last `ls-tree` name |
| last file on feature branch | `20260723140552_…` | last `ls-tree` name |

31/31 1:1 was the **unmerged feature-branch** (and historically staging-after-T02b) claim. It is not true of main's local migrations directory.

---

## STEP 3 — Classification

Rule (prompt): an artifact SURVIVES only if it remains valid against the tables/columns v2 keeps. Anything keyed to single-seller `orders` semantics, seller-acceptance (AC-SEL-14 retired), inquiry-to-order conversion, or the flat delivery fee is REBUILT.

Citations: baseline §1 (what changed) · §2.4–2.6 (money / delivery / cancellation) · §4.1 (`confirmed` = admin-approved, no seller accept) · §10 (`orders` → `seller_orders`; `master_orders`) · §11 (artifact disposition) · journeys §5.2–5.3 (cart → master → N seller orders).

Live existence of DB objects = UNVERIFIED (STEP 2 STOP). Classification is of the **git artifacts**.

### T01 migration `20260723074953` (on main since PR #49; REG-09 / REG-48)

| Object | Fate | Reason |
|---|---|---|
| File as a whole | **REBUILT** | Parent-scopes every policy to `betk.orders`; v2 renames `orders` → `seller_orders` and adds `master_orders` (baseline §10, §11 “the order-set RLS scoping”). |
| `orders_insert` | **REBUILT** | INSERT into single `orders` row owned by buyer. v2 checkout inserts master + N seller orders (journeys §5.3). |
| `order_items_access` / `order_items_insert` | **REBUILT** | Parent is `betk.orders`. v2 parent is the seller order (baseline §3 / journeys §5.3). |
| `order_status_history_access` / `_insert` | **REBUILT** | History follows v1 `order_status` + seller-accept transitions. v2 state machine is different (baseline §4.1; §11 “the `order_status` enum”). |
| `order_messages_access` / `_insert` | **REBUILT** | Thread keyed to `orders.id`. Re-scope to seller order (and possibly master) at ERD rewrite. |
| `shipments_access` / `shipment_tracking_events_access` | **REBUILT** | SELECT via `shipments.order_id → orders`. v2: N shipments under N seller orders (journeys §5.3). |
| `set_inquiry_converted_order` + `trg_set_inquiry_converted_order` | **REBUILT** | Inquiry-to-order conversion. Baseline §1 “Inquiry role = price discovery feeding the cart”; §11 ADR-017 **Rework** — inquiry feeds a cart line, not an order. |

### T02b migration `20260723140552` — each object (not the file as a lump)

| Object | Fate | Reason |
|---|---|---|
| `settings_payment_config_read` | **REBUILT** | Literal allow-list is `{betk_instapay_handle, betk_vodafone_cash, betk_orange_cash, delivery_fee_flat_egp}`. v2: InstaPay only; fee from courier rate matrix; REG-62 narrows to `betk_instapay_handle` alone; REG-65 / D9 / D10 close by deletion of dead fee JSONB (baseline §1, §2.4–2.5, §11 Register). REG-69 *pattern* (literal allow-list, never prefix) still holds — the policy body does not. |
| `payments_insert` | **REBUILT** | `EXISTS (orders … buyer_id = auth.uid())`. v2: 2 payment rows **per seller order**, proof on the master (N22); parent is no longer a single `orders` row (baseline §2.4, journeys §5.3). |
| `payments_update` | **REBUILT** | Same `orders` parent + buyer-or-admin. Proof attach moves to master (N22 / baseline §2.4 “One screenshot for the master order”). ADR-019 **pattern** holds (baseline §11 ADRs). |
| `orders_update` | **REBUILT** | `buyer OR store OR is_admin()` on `betk.orders`. Store leg is seller-acceptance (AC-SEL-14). Baseline §1 “Seller acceptance = Removed”; §4.1 “no seller acceptance”. |
| `modlog_admin_insert` | **SURVIVES** | `#14`-class INSERT on `moderation_logs` with `admin_id = auth.uid()`. Table/columns v2 keeps; not keyed to single-seller `orders` or AC-SEL-14. REG-68 reasoning intact. |
| `enforce_payment_update` + `trg_enforce_payment_update` | **REBUILT** | DEFINER OLD-aware trigger; proof-attach checks `orders.buyer_id`; F2 pending→confirmed still useful but must re-scope to master + 2N rows. ADR-019 holds as pattern (baseline §11). |
| `enforce_order_transition` + `trg_enforce_order_transition` | **REBUILT** | File implements **AC-SEL-14** (`BETK_ORDER_ACCEPT_STORE_ONLY`, `BETK_DEPOSIT_UNCONFIRMED`, pending→confirmed is **store-only**). Baseline §1 / §4.1 retire seller acceptance; `confirmed` = admin-approved and released to seller. Seller cancel is forbidden (baseline §2.6) — v1 trigger already forbids seller cancel, but the accept path is the defect. |
| `set_order_commission_snapshot` + `trg_set_order_commission_snapshot` | **REBUILT** | BEFORE INSERT on `betk.orders`; commission on subtotal still a v2 rule (baseline §2.4) but the table is `seller_orders` and snapshot is per seller order (baseline §3). |
| `create_order_from_inquiry` (SECURITY INVOKER rpc) | **REBUILT** | Named in baseline §11 Build: “Rebuilt: `create_order_from_inquiry` rpc”. Inquiry-to-order, one seller, `delivery_preference`, flat `delivery_fee_flat_egp`, buyer rails include Vodafone/Orange. ADR-018 **Redo** (one txn = master + N seller orders + N item sets + 2N payments). |
| `payments` authenticated UPDATE column grant | **REBUILT** | Columns include `proof_path` on the payment row; N22 puts proof on the master (child deposit **snapshots** the ref at verification). |
| `orders` authenticated UPDATE column grant `(status, cancellation_reason)` | **REBUILT** | Grant is on `betk.orders`; v2 write surface is seller_orders + derived master (baseline §4.1–4.2). Cancellation actors change (baseline §2.6: admin may cancel; seller never). |

File `20260723140552_order_payment_write_layer_reg49.sql` as a **ledger artifact** (the version name staging already applied, historically): **SURVIVES as a file to copy onto main** so REG-24 1:1 can be restored. That is option (a), not “the objects stay valid”.

### App / routes / tests / docs

| Artifact | Fate | Reason |
|---|---|---|
| `src/features/checkout` (actions `createOrderFromInquiry` / `attachDepositProof`, queries, `checkoutRules`, types, DepositProofPanel) | **REBUILT** | Checkout from a confirmed inquiry; flat fee; single order; confirmation copy still says “awaiting seller acceptance” (`orders.confirmation.confirmed.message` on the branch). Baseline §1 / §11 “Rebuilt: `/checkout`”; journeys §5.2 cart→checkout. |
| `src/features/orders` (`acceptOrder`, `cancelOrder`, `confirmDepositPayment`, `markOrderPreparing`, seller/buyer queries, `orderRules`) | **REBUILT** | `acceptOrder` **is** AC-SEL-14. Queries keyed to `betk.orders`. Baseline §11 “Rebuilt: `/orders`”; §4.1 no seller accept. |
| `confirmDepositPayment` action | **REBUILT** | Confirms a v1 deposit row on a single `orders` id and does not release a master of N children. v2: **one** admin action confirms **every** deposit row under the master (baseline §2.4, journeys §5.2). T05 was never started — there is **no** `/admin/payments` page on this branch (METHOD: no such path in the STEP 1 file lists). The *capability* “admin verifies the deposit” SURVIVES as a role (baseline §11 Build); this file does not. |
| `requireAdmin` / `requireAdminForUser` | **SURVIVES** | App-layer mirror of `betk.is_admin()`. Baseline §11 Build: “Survives: `requireAdmin` / `requireVerifiedPhone` / `requireActiveUser`”. Not keyed to `orders` columns. **Absent from `origin/main`** (METHOD: `git cat-file -e origin/main:src/features/auth/queries/requireAdmin.ts` → path does not exist). Needed on main before any admin write; do **not** merge it via the whole Phase-07 branch. |
| `/checkout`, `/checkout/confirmation/[id]` | **REBUILT** | Baseline §11 “Rebuilt: `/checkout`”. Inquiry-gated; no cart; delivery-method picker (baseline §10 “Removed: delivery-method selection at checkout”). |
| `/orders`, `/orders/[id]` | **REBUILT** | Baseline §11 “Rebuilt: `/orders`”. v2 buyer sees a master with per-seller sections; new route `/orders/[masterId]/[sellerOrderId]` (baseline §10). Filter tabs are v1 `order_status` including seller-confirmed. |
| `src/app/.../inbox/[id]/page.tsx` CTA | **REBUILT** | Wires confirmed-inquiry → `/checkout`. v2 inquiry is the quote channel feeding the cart (baseline §1, §11 “Repurposed: Phase 06 messaging”). |
| `src/features/buyer-account` address query/action + `validations/address.ts` | **SURVIVES** | Checkout still needs the buyer’s delivery address (journeys §5.2 / §5.3 master owns the address). Not single-seller-order logic. |
| `src/validations/{checkout,orders}.ts` | **REBUILT** | Zod for inquiry-id checkout and v1 order transitions. |
| `src/lib/supabase/types.ts` (T02b rpc backfill) | **REBUILT** | REG-32: types are CI-generated from live schema. v2 schema will regenerate. Do not hand-port this hunk. |
| `tests/unit/checkoutRules.unit.test.ts` | **REBUILT** | Mirrors v1 rpc arithmetic + AC-SEL-14 predicates. |
| `tests/unit/checkoutForm.phoneGate.navigate.unit.test.ts` | **SURVIVES** (rewire) | OD-4 client-half: phone-NULL submit → `/auth/phone`. Verified-phone-before-transacting still holds (baseline “Unchanged and load-bearing”). Call sites change when checkout is rebuilt. |
| `tests/integration/orderPayment.writeLayer.test.ts` | **REBUILT** | Proves v1 three-layer + `create_order_from_inquiry` + seller accept. |
| `tests/integration/orders.stockDecrement.test.ts` | **REBUILT** | Stock on seller-accept into `confirmed`. v2 decrements **at checkout** (baseline §1 / §2.7). |
| `tests/integration/orderPayment.noPureCod.dbCheck.test.ts` (re-enabled canary, `EXPECTED_ORPHANS=7`) | **ARCHIVE-ONLY** | V1 leftover detector for the 7 history-pinned zombie orders. Successor is REG-76 (N27 migrate-forward), not a merge of this canary onto main. |
| `docs/10-ai-development/SESSION_CONTEXT.md` (on the branch) | **ARCHIVE-ONLY** as a branch tip | Living doc already advanced on main by V2-STATE-RECORD. Do not merge the branch copy over main. |
| `docs/PRECEDENTS.md` rows added on the branch (three-layer write control; throwaway-smoke interrupt caveat) | **SURVIVES** | Already on main via V2-STATE-RECORD STEP 0. Pattern ADR-019 holds (baseline §11). |
| `docs/02-architecture/ADR.md` ADR-018 | **REBUILT** (redo) | Baseline §11 ADRs: ADR-018 **Redo**. |
| ADR-019 | **SURVIVES** (re-scope) | Baseline §11: ADR-019 **Holds** — re-scope to the new tables. Pattern unchanged. |
| `docs/03-database/BETK_DATABASE_SCHEMA.sql` (T02b backfill) | **ARCHIVE-ONLY** | Cite-or-flag forbids treating this file as live truth; B3 owns the ERD rewrite. Do not merge onto main as schema source. |
| `docs/12-changelog/DEVELOPMENT_JOURNAL.md` Phase-07 entries | **SURVIVES** | Append-only history. Already on main via V2-STATE-RECORD. |
| `docs/10-ai-development/phase-packs/PHASE_07_ORDERS.md` | **ARCHIVE-ONLY** | V1 pack. Project state: “Do not resume Phase 07 as written.” |
| `messages/*` `orders.*` (and checkout confirmation “awaiting seller acceptance”) | **REBUILT** | Single-seller copy; `confirmed` = “confirmed by the store”. v2 master/seller-order language. |
| `messages/*` checkout handle / address keys | **REBUILT** with checkout | InstaPay-only + no delivery-method picker. |
| guards / `scripts/` / `.github/` | **SURVIVES** | Zero diff vs main (STEP 1). Process artifacts; baseline §11 “every process artifact (PRECEDENTS, register, guard suite, migration discipline)”. |

---

## STEP 4 — Disposition options vs REG-24

**Binding precondition.** PRECEDENTS REG-24: every migration confirms ledger **1:1 remote↔local** (local filename matches the applied version). Stage C **applies** migrations. Therefore **main’s local `supabase/migrations/` MUST reach 1:1 with staging BEFORE Stage C’s first new migration.** Nothing on staging is rolled back (N27: staging migrates forward).

Remote count is UNVERIFIED this session. Options are tested against the **measured** facts: main local **30**, feature local **31**, name-diff = **one add** `20260723140552`, Preview on main = remote version(s) absent from main’s local dir.

| Option | What it does | Cost | Risk | REG-24 / Stage C 1:1? |
|---|---|---|---|---|
| **(a) Forward-port the migration FILE ONLY** onto main (docs + that one SQL file, no `src/`) | Add `20260723140552_order_payment_write_layer_reg49.sql` to main so the local dir matches the version Preview says remote already has. Do **not** `apply_migration` (already applied, historically). | One docs+file PR. No product UI. | If remote last version is **not** exactly `20260723140552` (MCP UNVERIFIED), Preview stays red or a *different* missing version is revealed. Mitigate: first successful MCP `list_migrations` before or in the same PR window. File contents are v1 semantics that Stage C must **migrate over** (REG-76), not keep as the v2 write layer. | **Satisfies the local-dir half** of 1:1 **if** the missing remote version is this file (the only name-diff + Preview text). Does not by itself prove remote count. Best option that can restore 1:1 without merging v1 UI. |
| **(b) Tag-and-abandon** the branch | Keep the annotated tag; never merge src or the SQL file. | Cheap. | Main local stays **30** while staging (Preview) has a version main lacks. Stage C’s first `apply_migration` would apply a **new** version onto a remote that already diverged — REG-24 fail; Preview stays red forever; typegen/CI against live schema including T02b objects vs main types without those objects. | **Leaves a permanent divergence.** Does **not** satisfy the precondition. |
| **(c) Merge-what-survives** (curated PR) | Cherry-pick SURVIVES: `requireAdmin`, maybe address helpers, phone-gate unit test, ADR-019/PRECEDENTS (already on main), **and** the T02b SQL file. | Higher than (a): review of each hunk. Almost no src SURVIVES as-is. | Easy to accidentally include `acceptOrder` / rpc wrappers / `types.ts`. Curated src without the SQL file still fails REG-24. | **Satisfies 1:1 only if the curated PR includes the migration file** (i.e. it collapses toward (a) + a thin `requireAdmin` add). |
| **(d) Merge the branch whole** | Fast-forward/merge `feature/phase-07-orders` into main. | Huge product debt: v1 checkout/orders, AC-SEL-14, inquiry-to-order, `types.ts` hand-backfill, i18n that says seller acceptance. | Pollutes main with code v2 must delete. Conflicts with v2 docs already on main (SESSION_CONTEXT / pack). Does put the SQL file on main. | **Satisfies local-dir 1:1** (file lands) but **fails the product constraint** (rebuild, don’t resume Phase 07 as written). |

### Recommendation

**Recommend (a):** forward-port **only** `supabase/migrations/20260723140552_order_payment_write_layer_reg49.sql` onto main in a docs+file PR (this Stage A memo may ride the same PR or a docs-only precursor; the file itself is Stage A’s recommended follow-up, not this commit — **this Stage A commit is docs-only**, zero migrations, so a human can open the file PR after MCP `list_migrations` confirms the remote last version).

Do **not** apply the migration. Do **not** merge `src/`.

**Runner-up: (c)** — only the `requireAdmin` gate (SURVIVES, missing on main) plus the same SQL file. Rejected as the primary because the gate is unused until an admin action exists; mixing it into the ledger-repair PR hides the REG-24 purpose. Land `requireAdmin` with the first v2 admin/checkout task.

**Rejected: (b)** leaves permanent ledger divergence, which Stage C is forbidden to start from. **Rejected: (d)** resumes v1 Phase 07 as written.

**Human follow-up before Stage C:** re-auth MCP to Supabase org **BETK**, run `list_migrations`, paste applied count + last version, then add the matching file(s) to main until local names **equal** remote versions. This Stage A commit does not add the SQL file, so **this PR does not yet restore 1:1** — it records the measurement and the recommendation.

---

## STEP 5 — Preservation

Annotated tag **`archive/phase-07-v1-single-seller`** created on commit `a27e7b0b1cbab722cb5bebe52d3d8daee0c52f22` (feature-branch tip) and pushed to `origin`. See the Stage A close-out / paste-back for the tag-object SHA and `git push` confirmation.

**Do not delete** `origin/feature/phase-07-orders` in this task.

**Recommended deletion timing (human only):** after (1) this memo is on `main`, (2) the tag is confirmed on `origin` (`git ls-remote --tags origin archive/phase-07-v1-single-seller`), (3) the migration **file** (option a) is on `main` or explicitly deferred pending MCP `list_migrations`, and (4) no one still has unpushed work on the branch. Not before.

---

## STEP 6 — Doc / register actions taken on `v2-stage-a-branch-disposition`

- This memo written.
- `SESSION_CONTEXT.md` standing facts: ledger numbers re-measured; Preview failure recorded; security-sweep recorded as **human-supplied** (not re-run this session); REG-65 pre-assignment gap flagged for **B7** (no row minted); org/secret-rotation facts recorded with **zero token values**; **REG-77** minted (CI-enforcement gap).
- Frozen-decisions block and 43-tables / 59-pages baseline **not** edited (B7 owns the SUPERSEDED banner).
- `DEVELOPMENT_JOURNAL.md` entry appended (newest-first).

### REG minted this session

Read at mint time: header `REG-01..REG-76; next free = REG-77`. **Took REG-77.**

**REG-77** — Branch protection on `main` requires only `RLS smoke (staging)` (METHOD: `gh api repos/Jovo-Jovi/betk/branches/main/protection` → `required_status_checks.contexts`). Repo rulesets = `[]` (METHOD: `gh api repos/Jovo-Jovi/betk/rulesets`). The eight CI job names in `.github/workflows/ci.yml` are: `Install` · `Lint` · `Typecheck` · `Vitest (unit)` · `Guards` · `Types drift` · `Build` · `RLS smoke (staging)`. A repo ruleset (or required-check list) requiring **all eight names** is owed before the v2 build starts. RLS smoke is skipped on migration-free PRs, so a red Types-drift/Guards check on a docs-only PR will **merge silently** if nobody looks. Stage A PR is the canary for the rotated `SUPABASE_ACCESS_TOKEN`; if Types-drift or Guards go red with an empty `src/` diff, that is the token or token↔`SUPABASE_PROJECT_REF` pairing — do not patch around it.

---

## GitHub evidence used (not MCP)

| Check on `origin/main` `f13ac65` | Conclusion | METHOD |
|---|---|---|
| Install | success | `gh api …/check-runs` |
| Lint | success | same |
| Typecheck | success | same |
| Vitest (unit) | success | same |
| Guards | success | same |
| Types drift | success | same |
| Build | success | same |
| RLS smoke (staging) | **skipped** | same (no migration diff on that merge) |
| **Supabase Preview** | **failure** — `Remote migration versions not found in local migrations directory.` | same; app slug `supabase` |
| Vercel status | success | `gh api …/status` |

Required to merge: **only** `RLS smoke (staging)`. Preview is **not** required.

---

## Done-when self-check

1. Every non-merge commit inventoried with files by area — **YES** (7/7).
2. Migration divergence proven by file diff + both counts + MCP `list_migrations` — **PARTIAL.** File diff + counts **YES**. MCP `list_migrations` **NO** (STOP).
3. All `20260723140552` DB objects live-verified with pasted rows — **NO** (STOP).
4. Every named artifact classified with a v2 citation; T02b objects individually — **YES** (existence UNVERIFIED).
5. Four options vs REG-24; one recommended; runner-up named — **YES**.
6. Annotated tag on the remote at the branch tip — see paste-back.
7. Memo exists; four SESSION_CONTEXT corrections; REG-77 minted — **YES**.
8. Zero `src/` diff, zero `supabase/migrations/` diff vs `origin/main` after this commit — proven in close-out.
9. MCP reachability proven before introspection; org/secret facts recorded with zero token values — **reachability FAIL (flagged)**; org/secret facts **recorded as human-supplied**.

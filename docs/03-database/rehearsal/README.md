# N27 rehearsal kit (option B)

**These guards are the only protection if the SQL editor is on the wrong database.**

The files under `run/` raise before they change anything when the sentinel is missing, and `00` raises when the database is not an empty copy of the 31-migration staging history. They do not know which dashboard project is selected. Read the project name in the SQL editor before every run.

`staging-text/M1.sql` … `M6.sql` are the texts T03, T04, and T05 apply on staging, byte-for-byte (D-B, C2). Do not run those files on staging. Run `run/00` through `run/08` on the scratch project. The audit is `AUDIT.md`.

## Runbook

Free plan: steps 1, 2, and 5 are `FREE_PLAN_RUNBOOK.md` Part B. Not a branch.

1. Part B: create the free scratch project and record its name only.
2. Part B: `npx supabase db push --db-url $env:SCRATCH_DB_URL` from a checkout whose `supabase/` matches `eaab2c1`. No `supabase link`. Never use `$env:STAGING_DB_URL`.
3. Run `00` → `08` in order, one file per run. Paste each output or error. On any guard error: stop, and check which database is selected.
4. Copy the `08` assert table.
5. Part B: delete the scratch project. Paste scratch project deletion proof.
6. Stop at M6. M7–M8 are not run (3f).

Order: `00_guard_and_sentinel.sql`, `01_M1.sql`, `02_M2.sql`, `03_M3.sql`, `04_seed_shape.sql`, `05_M4.sql`, `06_M5.sql`, `07_M6.sql`, `08_asserts.sql`.

`04` writes `rehearsal.baseline` (history md5s, the four money sums, the three seed listing stocks) immediately before M4. `08` compares money to that row (D-A). There is no printed money constant.

Keep the SQL editor `TimeZone` at `UTC`. The staging history md5s in `staging-text/M5.sql` were re-measured on 2026-09-26 with `TimeZone = UTC` (`created_at::text` ends in `+00`). The rehearsal md5s are captured in `04` and read in `06`, so `04` and `06` must use the same `TimeZone`.

## Seed ids

Fixed, not the staging ids. Defined in `04` and reused in the `06` literal block.

| Role | Id |
|---|---|
| Buyers | `10000000-0000-4000-8000-000000000001`, `…0002` |
| Sellers | `…0003`, `…0004` |
| Stores | `20000000-0000-4000-8000-000000000001`, `…0002` |
| Listings | `30000000-0000-4000-8000-000000000001` and `…0002` (`stock_qty` NULL); `…0003` (stock 50, unrelated) |
| Addresses | `40000000-0000-4000-8000-000000000001`, `…0002` |
| Inquiries | `50000000-0000-4000-8000-000000000001` … `…0003` |
| Orders | `60000000-0000-4000-8000-000000000001` … `…0007` |
| History | `70000000-0000-4000-8000-000000000001` … `…0007` |

D1 targets are orders `…0001`, `…0002`, `…0003` (pending) and `…0005`, `…0007` (confirmed). Keeps are `…0004` and `…0006` (cancelled).

## Flags for review

- `checkout_from_cart(uuid)` in M6 is the C1 shell. The body is `RAISE EXCEPTION 'BETK_CHECKOUT_NOT_READY'`. `08` calls it and expects that exception. The T02 body, with its flags, is `drafts/checkout_from_cart.draft.sql` (not applied). T05b authors the real body. M8 replaces the shell with `CREATE OR REPLACE`.
- `order_status` label `ready` is added `AFTER 'preparing'` so the order matches ERD §5. A default `ADD VALUE` would append after `returned`.
- Exception names `BETK_N27_ITEMS_NONEMPTY` and `BETK_N27_TARGET_STATUS` are not in the plan’s fenced SQL. The plan says to abort on a non-zero item count and on a target whose status is not the measured one.
- C2: T04 applies `staging-text/M4.sql` byte-for-byte, same rule as T03 and T05.
- The seed inserts `confirmed` and `cancelled`. `trg_enforce_order_transition` is BEFORE UPDATE only, so the insert does not fire it. `inquiry_id` is set by a later UPDATE that does not change status or cancel metadata. No trigger is disabled in `04`.

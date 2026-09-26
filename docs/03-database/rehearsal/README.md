# N27 rehearsal kit (option B)

**These guards are the only protection if the SQL editor is on the wrong database.**

The files under `run/` raise before they change anything when the sentinel is missing, and `00` raises when the database is not an empty copy of the 31-migration staging history. They do not know which dashboard project is selected. Read the branch name in the SQL editor before every run.

`staging-text/M1.sql` … `M6.sql` are the texts T03 and T05 apply on staging (D-B). Do not run those files on the rehearsal branch. Run `run/00` through `run/08`.

## Runbook

1. In the dashboard, create a branch from the main project (not a GitHub preview). It is billed hourly while it exists (pack §4.1).
2. Open the SQL editor ON THE BRANCH. Check the branch name before every run.
3. Run `00` → `08` in order, one file per run. Paste each output or error. On any guard error: stop, and check which database is selected.
4. Copy the `08` assert table.
5. Delete the branch. Paste proof it is gone.
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

- `checkout_from_cart(uuid)` is not a fenced DRAFT block. The text checks out every cart line for `auth.uid()`, prices from `listing.price` or `inquiries.quoted_price`, fails closed on a null weight or a missing rate, uses a half-open weight band, leaves `display_ref` and the child `betk_ref` NULL, sets shipment `courier` to the literal `courier`, and inlines the stock update. Agreement keys are not consulted. An INVOKER cannot pass listings RLS for that update; M8 is the DEFINER rework. A zero balance can fail `payments.amount > 0`. Static SQL against the function’s temporary table can cache a plan that fails on a later call in the same session. The rehearsal does not call the function.
- `order_status` label `ready` is added `AFTER 'preparing'` so the order matches ERD §5. A default `ADD VALUE` would append after `returned`.
- Exception names `BETK_N27_ITEMS_NONEMPTY` and `BETK_N27_TARGET_STATUS` are not in the plan’s fenced SQL. The plan says to abort on a non-zero item count and on a target whose status is not the measured one.
- D-B names T03 and T05 only. T04 applies M4. `staging-text/M4.sql` is in this kit. T04’s prompt was not given the byte-for-byte line.
- The seed inserts `confirmed` and `cancelled`. `trg_enforce_order_transition` is BEFORE UPDATE only, so the insert does not fire it. `inquiry_id` is set by a later UPDATE that does not change status or cancel metadata. No trigger is disabled in `04`.

# Free-plan runbook (rehearsal and backup gate)

PowerShell. One command per step. Do not chain commands.

The kit SQL is unchanged at `eaab2c1`. This file does not change `supabase/` or `src/`.

A connection string (a value that starts with `postgres://` or `postgresql://`), a password, or a token (a value that starts with `eyJ`) is never written into a file, this chat, or Cursor. Every database command below reads its connection string from an environment variable the human sets in their own terminal.

## Part A — tools, once

### A1. Supabase CLI via npx

```powershell
npx supabase --version
```

Measured on this machine on 2026-09-28: `2.106.0`. Cite: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (nodejs tab: run the CLI by prefixing each command with `npx`).

`db push` against a remote connection string does not start the local stack. Docker is documented for that stack (`supabase start`), not for a remote push:

- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), “Running Supabase locally”: the CLI uses Docker containers to manage the local development stack.
- `npx supabase db push --help` (CLI 2.106.0): `--db-url` “Pushes to the database specified by the connection string (must be percent-encoded).” `--local` “Pushes to the local database.” `--linked` “Pushes to the linked project.” This runbook uses `--db-url` only. It does not use `--local`, `--linked`, `supabase start`, or `supabase link`.
- [supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push): pushes local migrations to a remote database. The first run creates `supabase_migrations.schema_migrations`.

### A2. PostgreSQL client tools

Staging is Postgres **17.6** (T01, and `current_setting('server_version')` on 2026-09-28). `pg_dump` refuses a server newer than its own major version. Cite: [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) Notes: “pg_dump cannot dump from PostgreSQL servers newer than its own major version; it will refuse to even try.”

The client major must be **17 or newer**. On this machine `pg_dump` is not on `PATH` (`pg_dump --help` was not a recognized command). The binary that answered `--help` is PostgreSQL **17.11**:

`C:\Users\Marco\AppData\Local\Programs\PostgreSQL\17\bin\pg_dump.exe`

For this terminal only, if `pg_dump --version` is not already 17 or newer:

```powershell
$env:Path = "C:\Users\Marco\AppData\Local\Programs\PostgreSQL\17\bin;" + $env:Path
pg_dump --version
pg_restore --version
```

`pg_restore --version` must be the same major. Part C calls both binaries by this path. Do not use a different `pg_dump` that happens to be on `PATH`.

## Part B — rehearsal

superseded by B-CI / B2

Free-project allowance: two active free projects. Paused projects do not count. Cite: [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq) (“How many free projects can I have?”). Staging already uses one. If the dashboard will not create another free project, stop. Do not upgrade the organization. Do not create a branch.

1. In the dashboard, create a free scratch project, only if that allowance has room. Record its **name** only. Do not record a ref, a host, or a connection string in the repo, the chat, or Cursor.

2. Use a **new** terminal. Set `SCRATCH_DB_URL` in that terminal to the scratch project’s direct connection string (dashboard Connect dialog). Do not paste the value anywhere. Cite: [Connect to your database](https://supabase.com/docs/guides/database/connecting-to-postgres) (direct connection for migrations and `pg_dump`). If the machine is IPv4-only and the project has no IPv4 add-on, that page says to use pooler session mode. Do not use transaction mode.

   From the repo root of `feature/phase-08-schema`, the migrations `db push` will apply must be the 31 files at `eaab2c1`. This runbook does not change `supabase/`. This must print nothing:

```powershell
git diff --stat eaab2c1 -- supabase
```

   **Never run the next command with `$env:STAGING_DB_URL`.** `run/00` aborts when `betk.orders` is not empty, but `db push` has no guard. A push to staging would apply nothing new today and would still be the wrong database the moment a later migration exists.

```powershell
npx supabase db push --db-url $env:SCRATCH_DB_URL
```

   Do not pass `--linked`, `--local`, `--include-seed`, or `--include-all`. Cite: `npx supabase db push --help`. `--include-seed` would pull `supabase/config.toml` seed paths; there is no `supabase/seed.sql` (pack §4.2). Do not run `npx supabase link`. No saved project link, so a later command has nothing to hit by mistake.

   Expect 31 migrations. The first run creates `supabase_migrations.schema_migrations` ([supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push)). Then clear the variable in that same terminal:

```powershell
Remove-Item Env:SCRATCH_DB_URL
```

3. In the **scratch** project’s SQL editor, not staging, run:

```sql
SELECT count(*) AS version_count, max(version) AS last_version
FROM supabase_migrations.schema_migrations;
```

   Required: `version_count` 31 and `last_version` `20260723140552`. Anything else is a stop. Do not run `run/00`.

4. Run `run/00` through `run/08` in that same scratch SQL editor, in the order in `README.md` (steps 3 and 4 there). One file per run. Paste each output or error. On any guard error: stop, and check which project is selected. Keep `TimeZone` at `UTC` (`README.md`).

5. Delete the scratch project in the dashboard. Keep the name and proof it is gone (the org project list no longer shows that name). Do not keep a connection string. Do not keep the project to reuse for Part C.

## Part C — backup and test restore, immediately before T03

superseded by B-CI / B2

Do not start Part C until T02-VERIFY has passed. Part B’s scratch project must already be deleted. This part creates a different scratch project. Do not reuse a connection string.

**C-R3 (human, 2026-09-29), verbatim:**

C-R3 Restore method.
- Staging is only read: a data-only pg_dump of betk and betk_analytics.
- On the TARGET only (the scratch project in the test; a new project in a real recovery), acting as table owner: disable the six named INSERT triggers T02-FREE measured; load in one transaction in dependency order (inquiries before orders — the data has no populated cycle); re-enable the six.
- No FK is altered. No superuser. No staging change.

**B1-a (human, 2026-09-29), verbatim.** Amends B1:

B1-a (amends B1) The manifest is content, not counts: per table, row count AND md5 of all rows ordered by primary key, with TimeZone = 'UTC'.
Taken on staging at dump time and on the target after restore. A count-only match does not pass: the commission snapshot and converted-order triggers would silently rewrite restored money and link columns.

**B1-b (human, 2026-09-29), verbatim:**

B1-b Accepted limitations: auth users (5 test accounts) and storage files (5 objects) are not in the dump. A real recovery recreates the test accounts and re-uploads the test files.

B1 still stands: no passing test restore, no M1. A passing restore is the content manifest (B1-a), not a count match.

The test deletes the scratch project. A real recovery keeps the new project and still does B1-b (recreate the five test accounts, re-upload the five storage objects). This file is the test.

### Background — why `--disable-triggers` stays closed

The dump loads into a fresh project that already has the 31 migrations, so the target already has foreign keys, triggers, and rules. A data-only restore is the shape that matches that target. `--disable-triggers` is not available to `postgres`.

**Auth data is not required for the betk foreign keys.** Live `pg_constraint` on 2026-09-28: every `betk` and `betk_analytics` foreign key references `betk` (or, for `seller_snapshots`, `betk.stores`). None references `auth.users` or `auth.identities`. `auth.identities_user_id_fkey` is `auth.identities.user_id` → `auth.users(id)` and is not a betk key. The dump therefore includes no auth table. That is B1-b.

**What a data-only load hits. First measured 2026-09-28. Cycle counts, trigger names, owners, primary keys, and `rolbypassrls` re-read 2026-09-29 (SELECT only). Unchanged where both dates measured the same fact.**

| Fact | Measurement |
|---|---|
| `postgres` is not superuser | `pg_roles.rolsuper` false. `supabase_admin` is superuser. Cite: [Roles, superuser access](https://supabase.com/docs/guides/database/postgres/roles-superuser) (“Superuser access is not given”). |
| `postgres` bypasses RLS | `pg_roles.rolbypassrls` **true** (2026-09-29). A dump as `postgres` is not filtered by RLS. Do not pass `--enable-row-security`. Cite: [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) `--enable-row-security`: the default sets `row_security` off so all rows are dumped; without a bypass, that default errors. |
| `postgres` cannot set `session_replication_role` | `has_parameter_privilege('postgres', 'session_replication_role', 'SET')` is false. Cite: [PostgreSQL 17 runtime config](https://www.postgresql.org/docs/17/runtime-config-client.html): only superusers and roles with the `SET` privilege can change it. The same page: foreign keys are triggers, so `replica` also disables foreign-key checks, and it suppresses triggers and rules left at their default. That path is closed. |
| Table owner | Every base table in `betk` (41) and `betk_analytics` (2) has `pg_class.relowner` = `postgres` (2026-09-29). No other owner. The dashboard connection can `ALTER TABLE … DISABLE TRIGGER` on a named user trigger. Cite: [ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html) (you must own the table; disabling an internally generated constraint trigger requires superuser). `DISABLE TRIGGER ALL` is not used. |
| Schema cycle, not deferrable | `betk.fk_inquiries_order`: `inquiries.converted_to_order_id` → `orders(id)`. `betk.orders_inquiry_id_fkey`: `orders.inquiry_id` → `inquiries(id)`. Both `condeferrable` false. |
| Data on that cycle | Re-read 2026-09-29: `inquiries.converted_to_order_id` non-null **0**. `orders.inquiry_id` non-null **3**. `betk.orders` rows **7**. |
| Self-foreign-key with parents | `categories_parent_id_fkey`, not deferrable. `parent_id` non-null: **31** (re-read 2026-09-29). The 2026-09-28 note said a single `COPY` checks that key per row. A `NOT DEFERRABLE` foreign key is always `IMMEDIATE`, and `IMMEDIATE` constraints are checked at the end of each statement, so parents and children in that one `COPY` both exist at the check. Cite: [SET CONSTRAINTS](https://www.postgresql.org/docs/17/sql-set-constraints.html). No foreign key is altered. |
| Primary keys | Every one of the 43 tables has a primary key (2026-09-29). No table is ordered by all columns. Three keys are not `(id)`: `admin_settings (key)`, `rating_aggregates (store_id)`, `platform_snapshots (snapshot_date)`. The manifest reads the key from `pg_constraint`. |
| The six INSERT triggers | The only non-internal triggers with `INSERT` in `tgtype`, re-read 2026-09-29. Names below. `COPY FROM` invokes triggers. Cite: [COPY](https://www.postgresql.org/docs/17/sql-copy.html). |
| Rules do not swallow `INSERT` | Live `pg_rules`: `no_update_mod_log`, `no_delete_mod_log`, `no_update_order_history`, `no_delete_order_history`. Each is `ON UPDATE` or `ON DELETE` … `DO INSTEAD NOTHING`. A `COPY` does not hit them. |

`--disable-triggers` stays closed. Cite: `pg_dump --help` (`--disable-triggers`, and `-S, --superuser` “superuser user name to use in plain-text format”) and [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html): “the commands emitted for `--disable-triggers` must be done as superuser.” The same page: that option is ignored for an archive file; `pg_restore --disable-triggers` is the archive form, and it is also superuser. Do not pass it on either program. C-R3 disables the six by name, as table owner, on the target only.

The six, exact (2026-09-29, `pg_get_triggerdef`):

| Table | Trigger | When | Function |
|---|---|---|---|
| `betk.disputes` | `trg_dispute_sla` | `BEFORE INSERT` | `betk.set_dispute_sla()` |
| `betk.listings` | `trg_listing_search_vector` | `BEFORE INSERT OR UPDATE` | `betk.update_listing_search_vector()` |
| `betk.orders` | `trg_set_inquiry_converted_order` | `AFTER INSERT` when `new.inquiry_id IS NOT NULL` | `betk.set_inquiry_converted_order()` |
| `betk.orders` | `trg_set_order_commission_snapshot` | `BEFORE INSERT` | `betk.set_order_commission_snapshot()` |
| `betk.reviews` | `trg_recalculate_rating` | `AFTER INSERT OR UPDATE` | `betk.recalculate_rating_aggregate()` |
| `betk.reviews` | `trg_review_edit_deadline` | `BEFORE INSERT` | `betk.set_review_edit_deadline()` |

`trg_listing_search_vector` and `trg_recalculate_rating` also fire on `UPDATE`. `DISABLE TRIGGER` on the name disables every event of that trigger. The load is `COPY` (`INSERT` only).

### C1. Staging reads, in the same minute as the dump

Staging SQL editor. Read-only. `postgres` (the role whose `rolbypassrls` is true).

Cycle check. Required result: `0`. If it is not `0`, stop. Do not dump. A populated `converted_to_order_id` has no safe load order, and C-R3 does not alter a foreign key.

```sql
SELECT count(*) FILTER (WHERE converted_to_order_id IS NOT NULL) AS inquiries_pointing_at_orders
FROM betk.inquiries;
```

Manifest. One result set. `SET TimeZone = 'UTC'` because `timestamptz` text follows the session time zone. Also `SET DateStyle = 'ISO'` because that text follows `DateStyle` too. Cite: [Date/Time output](https://www.postgresql.org/docs/17/datatype-datetime.html#DATATYPE-DATETIME-OUTPUT). Run both `SET` lines and the `SELECT` in one execution. No `float4` or `float8` column exists in these schemas (2026-09-29), so `extra_float_digits` is not set.

Rows are ordered by the primary key. A table with no primary key would be ordered by every column; none of the 43 is in that case. An empty table hashes `md5('')`.

Save the result outside the repo. Do not commit it.

```sql
SET TimeZone = 'UTC';
SET DateStyle = 'ISO';

SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       (xpath('//row/row_count/text()', query_to_xml(format(
          'SELECT count(*)::bigint AS row_count FROM %I.%I',
          n.nspname, c.relname), false, true, '')))[1]::text::bigint AS row_count,
       (xpath('//row/content_md5/text()', query_to_xml(format(
          $q$SELECT md5(coalesce(string_agg(t::text, E'\n' ORDER BY %s), '')) AS content_md5 FROM %I.%I AS t$q$,
          coalesce(
            (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY u.ord)
             FROM pg_constraint pk
             JOIN LATERAL unnest(pk.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
             JOIN pg_attribute a
               ON a.attrelid = pk.conrelid AND a.attnum = u.attnum AND NOT a.attisdropped
             WHERE pk.conrelid = c.oid AND pk.contype = 'p'),
            (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum)
             FROM pg_attribute a
             WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped)
          ),
          n.nspname,
          c.relname), false, true, '')))[1]::text AS content_md5
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('betk', 'betk_analytics')
  AND c.relkind = 'r'
ORDER BY 1, 2;
```

### C2. pg_dump of staging

New terminal. Set `STAGING_DB_URL` to the staging direct connection string. Do not paste the value. Same connection rule as Part B step 2 (direct, or pooler session mode on an IPv4-only machine; not transaction mode). Do not set `SCRATCH_DB_URL` in this terminal.

The file is outside the repo. Keep it until T03 has applied M1. Do not commit it. Do not paste it.

```powershell
$dump = Join-Path $env:TEMP "betk-part-c.dump"
& "C:\Users\Marco\AppData\Local\Programs\PostgreSQL\17\bin\pg_dump.exe" --data-only --format=c --schema=betk --schema=betk_analytics --file=$dump --dbname=$env:STAGING_DB_URL
```

Flags, each from `pg_dump --help` (PostgreSQL 17.11) unless noted:

| Flag | Cite |
|---|---|
| `--data-only` | `--help`: `-a, --data-only` “dump only the data, not the schema”. |
| `--format=c` | `--help`: `-F, --format=c\|d\|t\|p` “custom, directory, tar, plain text”. `c` is custom. [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html): custom format allows reordering during restore. |
| `--schema=betk` | `--help`: `-n, --schema=PATTERN`. [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html): “Multiple schemas can be selected by writing multiple `-n` switches.” |
| `--schema=betk_analytics` | Same `-n` cite. Second schema. `auth` and `storage` are not dumped (B1-b). |
| `--file=$dump` | `--help`: `-f, --file=FILENAME`. |
| `--dbname=$env:STAGING_DB_URL` | `--help`: `-d, --dbname=DBNAME`. The value stays in the environment. |

Not passed: `--disable-triggers`, `--superuser`, `--enable-row-security`, `--clean`, `--create`, `--schema-only`, `--large-objects`, `--jobs`. `--schema` already omits large objects (`--help`: `-b` is the switch that adds them back when `-n` is used).

`pg_dump` will warn about circular foreign keys. That warning is expected. Continue. A non-zero exit is a stop. Do not restore.

**Data order.** A data-only dump orders table data so a referenced table is restored first. Cite: PostgreSQL 17.11 `src/bin/pg_dump/pg_dump.c`, `getTableDataFKConstraints`: “order the table data objects in such a way that a table's referenced tables are restored first. (In the presence of circular references or self-references this may be impossible…)”. The inquiries/orders pair is that cycle. `pg_dump_sort.c` `repairDependencyLoop` then says it will “break the loop arbitrarily” and calls `removeObjectDependency(loop[0], loop[1]->dumpId)`. That does not promise `inquiries` before `orders`. The safe order is inquiries first, because `converted_to_order_id` is all null and `orders.inquiry_id` is not. Enforce it with the list edit in C4. The `categories` self-key produces the same class of warning and does not need a list edit (one `COPY`, check at the end of the statement).

Then record size and time, and clear the staging variable in that same terminal:

```powershell
Get-Item $dump | Select-Object Length, LastWriteTimeUtc
Remove-Item Env:STAGING_DB_URL
```

`Get-Item` reads the local file. Not a database command. `Length` is the byte size. `LastWriteTimeUtc` is the dump timestamp. `Remove-Item Env:STAGING_DB_URL` drops the session variable. Not a database command.

### C3. Target project, then prep SQL

**Prep SQL runs on the target only. Never on staging.**

Create a new free scratch project, same allowance rule as Part B. Record its **name** only. From the repo root, the migrations must still be the 31 files at `eaab2c1`:

```powershell
git diff --stat eaab2c1 -- supabase
```

New terminal. Set `SCRATCH_DB_URL` only. **Never run the push with `$env:STAGING_DB_URL`.**

```powershell
npx supabase db push --db-url $env:SCRATCH_DB_URL
Remove-Item Env:SCRATCH_DB_URL
```

Same flags as Part B: `--db-url` only. Expect 31 migrations. In the **target** SQL editor, the Part B version query must show `version_count` 31 and `last_version` `20260723140552`. Then run the block below in that same target editor.

The guard and the six `DISABLE` statements are one `DO` block. `betk.orders` must be 0 (a fresh push). Staging has 7, so this block raises on staging before it disables anything. That backstop is not permission to run it there.

```sql
DO $prep$
BEGIN
  IF (SELECT count(*) FROM betk.orders) <> 0 THEN
    RAISE EXCEPTION 'BETK_RESTORE_TARGET_NOT_EMPTY: betk.orders is not empty. A fresh push has 0 rows. Staging has 7. This block is target-only.';
  END IF;

  ALTER TABLE betk.disputes DISABLE TRIGGER trg_dispute_sla;
  ALTER TABLE betk.listings DISABLE TRIGGER trg_listing_search_vector;
  ALTER TABLE betk.orders DISABLE TRIGGER trg_set_inquiry_converted_order;
  ALTER TABLE betk.orders DISABLE TRIGGER trg_set_order_commission_snapshot;
  ALTER TABLE betk.reviews DISABLE TRIGGER trg_recalculate_rating;
  ALTER TABLE betk.reviews DISABLE TRIGGER trg_review_edit_deadline;
END
$prep$;
```

`ALTER TABLE … DISABLE TRIGGER <name>` is the table-owner form. Not `DISABLE TRIGGER ALL`. Not `session_replication_role`. No `ALTER TABLE` on a foreign key.

### C4. List edit, then pg_restore

**`pg_restore` connects to the target only. Never pass `$env:STAGING_DB_URL`.**

New terminal. The dump path is the same `$dump` as C2. Set `SCRATCH_DB_URL` only.

```powershell
$dump = Join-Path $env:TEMP "betk-part-c.dump"
$toc = Join-Path $env:TEMP "betk-part-c.list"
& "C:\Users\Marco\AppData\Local\Programs\PostgreSQL\17\bin\pg_restore.exe" --list --file=$toc $dump
```

`--list` prints the archive table of contents. `--file` writes that list. The archive path is the positional `FILE` (`pg_restore --help`: `pg_restore [OPTION]... [FILE]`). Cite: [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html) (`-l`, and the TOC example: a semicolon starts a comment; each item line is an archive id, then the description, then the owner).

Open `$toc` outside the repo. Find the two lines whose description contains `TABLE DATA betk inquiries` and `TABLE DATA betk orders`.

If the inquiries line is already above the orders line, and every line in the descendant list below is already below the orders line, do not edit.

If the orders line is above the inquiries line, move the orders line to immediately after the inquiries line. In the same move, take any of these lines that currently sit above the inquiries line and place them, in their current relative order, immediately after the orders line:

- `TABLE DATA betk order_items`
- `TABLE DATA betk order_messages`
- `TABLE DATA betk order_status_history`
- `TABLE DATA betk payments`
- `TABLE DATA betk reviews`
- `TABLE DATA betk review_photos`
- `TABLE DATA betk shipments`
- `TABLE DATA betk shipment_tracking_events`
- `TABLE DATA betk disputes`
- `TABLE DATA betk dispute_evidence`
- `TABLE DATA betk dispute_messages`

Those eleven are the tables whose foreign key path reaches `betk.orders` other than through `inquiries` (measured 2026-09-29). Do not comment out a `TABLE DATA` line. Do not move `betk users`, `betk listings`, `betk stores`, `betk listing_images`, or `betk listing_tags`. After the edit, `inquiries` is above `orders`, and `TABLE DATA betk users`, `TABLE DATA betk listings`, and `TABLE DATA betk stores` are still above `inquiries`. If they are not, stop. Those three are `inquiries_buyer_id_fkey`, `inquiries_listing_id_fkey`, and `inquiries_store_id_fkey`.

```powershell
& "C:\Users\Marco\AppData\Local\Programs\PostgreSQL\17\bin\pg_restore.exe" --data-only --single-transaction --no-owner --use-list=$toc --dbname=$env:SCRATCH_DB_URL $dump
```

| Flag | Cite |
|---|---|
| `--data-only` | `pg_restore --help`: `-a, --data-only` “restore only the data, no schema”. |
| `--single-transaction` | `--help`: `-1, --single-transaction` “restore as a single transaction”. [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html): wraps the restore in `BEGIN`/`COMMIT`, and this option implies `--exit-on-error`. |
| `--no-owner` | `--help`: `-O, --no-owner` “skip restoration of object ownership”. |
| `--use-list=$toc` | `--help`: `-L, --use-list=FILENAME` “use table of contents from this file for selecting/ordering output”. [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html): the list is the edited `-l` output; line order is restore order. |
| `--dbname=$env:SCRATCH_DB_URL` | `--help`: `-d, --dbname=NAME`. |
| `$dump` | Positional archive `FILE`. |

Not passed: `--disable-triggers`, `--superuser`, `--enable-row-security`, `--clean`, `--create`, `--jobs` (`--help` and the docs: multiple jobs cannot be used with `--single-transaction`), `--schema-only`.

A non-zero exit rolls the load back. Stop. Do not run the post SQL as if the load had succeeded. Clear the variable either way:

```powershell
Remove-Item Env:SCRATCH_DB_URL
```

### C5. Target post SQL, then the manifest

**Post SQL runs on the target only. Never on staging.**

Target SQL editor. Re-enable the same six. Then run the C1 manifest block again (`SET TimeZone`, `SET DateStyle`, and the `SELECT`). The `SELECT` does not fire triggers.

```sql
ALTER TABLE betk.disputes ENABLE TRIGGER trg_dispute_sla;
ALTER TABLE betk.listings ENABLE TRIGGER trg_listing_search_vector;
ALTER TABLE betk.orders ENABLE TRIGGER trg_set_inquiry_converted_order;
ALTER TABLE betk.orders ENABLE TRIGGER trg_set_order_commission_snapshot;
ALTER TABLE betk.reviews ENABLE TRIGGER trg_recalculate_rating;
ALTER TABLE betk.reviews ENABLE TRIGGER trg_review_edit_deadline;
```

Compare with the staging manifest saved in C1. Every `schema_name`, every `table_name`, every `row_count`, and every `content_md5` must be equal. A count match with a different `content_md5` fails (B1-a). Write one line:

`all_equal = true`

only when all 43 pairs match. Otherwise `all_equal = false`, and T03 does not start.

### C6. Delete the scratch project

Delete it in the dashboard. Keep the name and proof it is gone (the org project list no longer shows that name). Do not keep a connection string. Keep the dump file outside the repo until T03 has applied M1.

### C7. What a passing Part C pastes into the T03 opener

- Dump timestamp (`LastWriteTimeUtc`).
- File size in bytes (`Length`).
- Both manifests side by side: `schema_name`, `table_name`, staging `row_count`, staging `content_md5`, target `row_count`, target `content_md5`.
- The line `all_equal = true`.
- Scratch-deletion proof (name, then absent from the org list).

Never the dump file. Never a credential. Never a connection string.

## Command cites

| Command in this file | Cite |
|---|---|
| `npx supabase --version` | [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), nodejs tab |
| `$env:Path = "C:\Users\Marco\AppData\Local\Programs\PostgreSQL\17\bin;" + $env:Path` | Session `PATH` only. Binary measured on this machine. Not a database command. |
| `pg_dump --version` | [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) Notes (major must be ≥ server 17.6). `--help` captured from PostgreSQL 17.11. |
| `pg_restore --version` | `pg_restore --help` captured from the same 17.11 install. |
| `git diff --stat eaab2c1 -- supabase` | Git. Confirms `supabase/` matches `eaab2c1`. Not a database command. |
| `npx supabase db push --db-url $env:SCRATCH_DB_URL` | `npx supabase db push --help`: `--db-url`. [supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push). Docker cite is Part A (local stack vs remote push). |
| `Remove-Item Env:SCRATCH_DB_URL` | PowerShell. Drops the session variable. Not a database command. |
| `Remove-Item Env:STAGING_DB_URL` | PowerShell. Drops the session variable. Not a database command. |
| `& "C:\Users\Marco\AppData\Local\Programs\PostgreSQL\17\bin\pg_dump.exe" --data-only --format=c --schema=betk --schema=betk_analytics --file=$dump --dbname=$env:STAGING_DB_URL` | `pg_dump --help` (17.11) for every flag in the C2 table. [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) for multiple `-n` and custom format. |
| `Get-Item $dump \| Select-Object Length, LastWriteTimeUtc` | PowerShell local file metadata. Not a database command. |
| `& "…\pg_restore.exe" --list --file=$toc $dump` | `pg_restore --help`: `--list`, `--file`. Positional `FILE`. [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html) TOC. |
| `& "…\pg_restore.exe" --data-only --single-transaction --no-owner --use-list=$toc --dbname=$env:SCRATCH_DB_URL $dump` | `pg_restore --help` for every flag in the C4 table. [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html): `--single-transaction` implies `--exit-on-error`. |

Flags this runbook does not pass, from the same `db push --help`: `--linked`, `--local`, `--include-seed`, `--include-all`. Flags Part C does not pass on `pg_dump` or `pg_restore`: `--disable-triggers`, `--superuser`, `--enable-row-security`, `--clean`, `--create`, `--schema-only`, `--jobs`.

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

`pg_restore --version` must be the same major. Part C does not call either program until a restore design is chosen.

## Part B — rehearsal

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

Do not start Part C until T02-VERIFY has passed. Do not run a dump command from this file. Step 2 is a stop.

### C1. Staging manifest query

Run this in the **staging** SQL editor when a restore design has been chosen, in the same minute as the dump. It is read-only. It counts base tables in `betk` and `betk_analytics` only. No auth table is in the dump (C2), so none is in the manifest.

```sql
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       (xpath('//row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint AS row_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('betk', 'betk_analytics')
  AND c.relkind = 'r'
ORDER BY 1, 2;
```

Save the result outside the repo. Do not commit it.

### C2. STOP and FLAG — no clean data-only restore for the `postgres` role

The dump has to load into a fresh project that already has the 31 migrations, so the target already has foreign keys, triggers, and rules. A data-only restore is the shape that matches that target. There is no clean way to do that as `postgres`.

**Auth data is not required for the betk foreign keys.** Live `pg_constraint` on 2026-09-28: every `betk` and `betk_analytics` foreign key references `betk` (or, for `seller_snapshots`, `betk.stores`). None references `auth.users` or `auth.identities`. `auth.identities_user_id_fkey` is `auth.identities.user_id` → `auth.users(id)` and is not a betk key. The dump therefore includes no auth table.

**What a data-only load would hit, measured 2026-09-28:**

| Fact | Measurement |
|---|---|
| `postgres` is not superuser | `pg_roles.rolsuper` false. `supabase_admin` is superuser. Cite: [Roles, superuser access](https://supabase.com/docs/guides/database/postgres/roles-superuser) (“Superuser access is not given”). |
| `postgres` cannot set `session_replication_role` | `has_parameter_privilege('postgres', 'session_replication_role', 'SET')` is false. Cite: [PostgreSQL 17 runtime config](https://www.postgresql.org/docs/17/runtime-config-client.html): only superusers and roles with the `SET` privilege can change it. The same page: foreign keys are triggers, so `replica` also disables foreign-key checks, and it suppresses triggers and rules left at their default. That path is closed. |
| Schema cycle, not deferrable | `betk.fk_inquiries_order`: `inquiries.converted_to_order_id` → `orders(id)`. `betk.orders_inquiry_id_fkey`: `orders.inquiry_id` → `inquiries(id)`. Both `condeferrable` false. |
| Data on that cycle | `inquiries.converted_to_order_id` non-null: **0**. `orders.inquiry_id` non-null: **3**. |
| Self-foreign-key with parents | `categories_parent_id_fkey`, not deferrable. `parent_id` non-null: **31**. A single `COPY` checks that key per row. |
| INSERT triggers, all `tgenabled = O` (they fire in a normal session) | `trg_dispute_sla`, `trg_listing_search_vector`, `trg_set_inquiry_converted_order` (AFTER INSERT when `inquiry_id` is not null), `trg_set_order_commission_snapshot`, `trg_recalculate_rating`, `trg_review_edit_deadline`. |
| Rules do not swallow `INSERT` | Live `pg_rules`: `no_update_mod_log`, `no_delete_mod_log`, `no_update_order_history`, `no_delete_order_history`. Each is `ON UPDATE` or `ON DELETE` … `DO INSTEAD NOTHING`. A `COPY` does not hit them. |

`--disable-triggers` is the documented data-only switch for referential integrity and triggers. Cite: `pg_dump --help` (`--disable-triggers`, and `-S, --superuser` “superuser user name to use in plain-text format”) and [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html): “the commands emitted for `--disable-triggers` must be done as superuser.” The dashboard connection is the `postgres` role. That switch is closed.

No dump command is specified. Do not invent one.

**Options, for a later human decision. None of these is a procedure to run now.**

1. **Superuser `--disable-triggers`.** Closed for `postgres`. `supabase_admin` is superuser on this database and is not the role in the dashboard connection string.
2. **`SET session_replication_role = replica` for the restore session.** Closed. The privilege check above is false. A superuser `GRANT SET ON PARAMETER` would be a change on staging and is not available to this runbook.
3. **Scratch-only, table-owner edits, then a data-only load in one transaction.** Disable the six INSERT triggers by name (not `DISABLE TRIGGER ALL`, which is the superuser form), mark the non-deferrable foreign keys `DEFERRABLE`, and load under `SET CONSTRAINTS ALL DEFERRED` so keys are checked at commit. Table ownership was **not** re-measured this session; this option exists only if the connecting role owns those tables. It is a constructed procedure, not the documented `pg_dump` path, so it is not adopted here.
4. **A full schema-and-data dump into an empty cluster.** `pg_dump` loads data before post-data constraints. That target is not “a fresh project that already has the 31 migrations.” A Supabase project already has `auth`, `storage`, and extensions. Rejected for this gate.

B1 stands: no passing test restore, no M1.

### C3. Scratch project #2

Do not create it, do not `db push`, do not restore, and do not compare, until a human picks an option above and a later task writes the commands. Deleting a project that was never created is not the proof.

### C4. What a passing Part C pastes into the T03 opener

Only after a test restore has matched the manifest:

- Dump timestamp (when the dump finished).
- File size in bytes.
- The manifest match table: staging `row_count` and scratch `row_count` for every C1 row, equal on every row.
- Scratch-deletion proof for project #2 (name, then absent from the org list).

Never the dump file. Never a credential. The dump file stays outside the repo.

## Command cites

| Command in this file | Cite |
|---|---|
| `npx supabase --version` | [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), nodejs tab |
| `$env:Path = "C:\Users\Marco\AppData\Local\Programs\PostgreSQL\17\bin;" + $env:Path` | Session `PATH` only. Binary measured on this machine. Not a database command. |
| `pg_dump --version` | [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html) Notes (major must be ≥ server 17.6). `--help` captured from PostgreSQL 17.11. |
| `pg_restore --version` | `pg_restore --help` captured from the same 17.11 install. Not used in Part C. |
| `git diff --stat eaab2c1 -- supabase` | Git. Confirms `supabase/` matches `eaab2c1`. Not a database command. |
| `npx supabase db push --db-url $env:SCRATCH_DB_URL` | `npx supabase db push --help`: `--db-url`. [supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push). Docker cite is Part A (local stack vs remote push). |
| `Remove-Item Env:SCRATCH_DB_URL` | PowerShell. Drops the session variable. Not a database command. |

Flags this runbook does not pass, from the same `db push --help`: `--linked`, `--local`, `--include-seed`, `--include-all`. `pg_dump` flags are not used, because Part C specifies no dump command.

# DISASTER_RECOVERY.md
> Supabase backup policy, rollback plan, incident runbook.

- **Backups:** rely on Supabase automated daily backups + PITR (verify retention on the plan). Test a restore to a scratch project before launch.
- **Migrations:** apply to staging via CI first; production apply is a manual, reviewed, reversible step. Keep down-migrations or a documented rollback per migration. Verify migration state on prod before launch (`LAUNCH_CHECKLIST`).
- **Rollback:** Vercel instant rollback to previous deployment; DB rollback via PITR or reverse migration. Never destructive-migrate without a backup checkpoint.
- **Incident runbook:** detect (Sentry alert) → triage (severity, blast radius) → mitigate (rollback deploy / disable feature flag / pause pg_cron job) → communicate → post-mortem (log as ADR if structural). 
- **Data integrity:** append-only audit tables and soft-deleted listings preserve history; never hard-delete order/dispute references.

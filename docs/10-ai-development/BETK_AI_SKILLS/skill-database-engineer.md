# skill-database-engineer.md
**Owns:** Supabase JS Client patterns, RLS policies, type generation.

- Two clients: `lib/supabase/server.ts` (RSC/Server Actions, cookie auth) and `client.ts` (client islands). `service.ts` (service role) only in trusted server/jobs — it BYPASSES RLS, so re-check ownership in code.
- Always handle `{ data, error }`; never ignore `error`. Treat RLS denials as not-found (don't leak existence).
- Migrations: follow the 057-step order in `BETK_ERD.md §9` / C3 §7. Resolve the `inquiries.converted_to_order_id` ↔ `orders` circular FK via ALTER after both tables exist. Seed boost_packages (039) and admin_settings (048).
- After ANY schema change: regenerate `src/lib/supabase/types.ts`, commit in the same PR (CI drift check).
- RLS: enable + default-deny on every table; use `is_admin()` / `my_store_id()` (SECURITY DEFINER, indexed). Verify policies against `BETK_ERD.md §3` before merge.
- Money: `numeric` columns; compute totals server-side; never float math client-side. JSONB (payment_methods, delivery_options, notification_prefs) typed via hand-written interfaces over generated `Json`.
- Respect soft-delete rules (listings only) and append-only tables (order_status_history, moderation_logs).

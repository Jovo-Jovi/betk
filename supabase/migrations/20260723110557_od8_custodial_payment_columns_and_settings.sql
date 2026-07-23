-- CORRECTION-03 — OD-8 §9 schema delta (custodial payments & platform commission).
-- ADR-016 / OD8_CUSTODIAL_PAYMENTS.md. Additive ONLY: 3 nullable columns on
-- existing tables + 2 CHECK constraints + 6 admin_settings seed rows. No new
-- table (count 43 holds), no new enum member, NO RLS POLICY.
--
-- Verified live absent (2026-07-23, execute_sql): betk.payments has NO proof_path;
-- betk.orders has NO commission_rate / commission_amount. Ledger = 29;
-- admin_settings = 11 rows.
--
-- SCOPE FENCE: columns + seed data ONLY. REG-49 (payments INSERT/UPDATE + orders
-- UPDATE policies) is owed by the regenerated Phase-07 T02 per OD-8 §10 — the
-- write layer needs the column-GRANT reasoning and is NOT this migration's work.
--
-- Advisor delta: NONE. Adding nullable columns + CHECKs + data resolves no
-- rls_enabled_no_policy finding and creates none. Baseline STAYS at 8 INFO /
-- 6 search_path WARN / 2 extension WARN / 4 sec-definer WARN / 1 leaked-password.
SET search_path TO betk, public;

-- ── OD-8 §9 row 1: payments.proof_path (OD-8 §5 payment proof) ─────────────────
ALTER TABLE betk.payments
  ADD COLUMN proof_path VARCHAR NULL;
COMMENT ON COLUMN betk.payments.proof_path IS
  'OD-8 §5/§9: buyer''s transfer-screenshot path in the private `docs` bucket. Awaiting-admin-review convention = proof_path IS NOT NULL AND status = ''pending''.';

-- ── OD-8 §9 row 2: orders.commission_rate (OD-8 §4 commission snapshot) ─────────
ALTER TABLE betk.orders
  ADD COLUMN commission_rate NUMERIC(5,2) NULL;
COMMENT ON COLUMN betk.orders.commission_rate IS
  'OD-8 §4/§9: platform commission rate (%) in force at order creation — snapshot, from admin_settings.commission_rate_pct.';

-- ── OD-8 §9 row 3: orders.commission_amount (OD-8 §4 commission snapshot) ───────
ALTER TABLE betk.orders
  ADD COLUMN commission_amount NUMERIC(10,2) NULL;
COMMENT ON COLUMN betk.orders.commission_amount IS
  'OD-8 §4/§9: computed commission = round(commission_rate * subtotal, 2), snapshotted at creation. Commission base is subtotal, NEVER total_amount. Seller net = subtotal - commission_amount (derived, no wallet table).';

-- ── OD-8 §9 CHECK constraints (recommended in §9) ──────────────────────────────
-- Nullable + app-enforced per the additive-migration discipline; the CHECKs are
-- NOT NULL VALID (a NULL passes) — they bite only once a value is set.
ALTER TABLE betk.orders
  ADD CONSTRAINT chk_commission_amount_nonneg CHECK (commission_amount >= 0);
ALTER TABLE betk.orders
  ADD CONSTRAINT chk_commission_rate_range CHECK (commission_rate BETWEEN 0 AND 100);

-- ── OD-8 §9.1: 6 admin_settings seed rows (DATA, not DDL) ──────────────────────
-- Every value is PROVISIONAL and gated by REG-62 (HARD pre-launch gate). 0 and ''
-- are deliberate "not yet configured" sentinels, NOT business decisions — no
-- commission rate, fee, or handle is invented here. The description carries the
-- warning so it is visible in the admin UI to whoever configures it.
INSERT INTO betk.admin_settings (key, value, description) VALUES
  ('commission_rate_pct', '0', 'PROVISIONAL - platform commission, % of order subtotal. BETK EARNS NOTHING UNTIL SET. Hard pre-launch gate (REG-62).'),
  ('return_hold_hours', '48', 'PROVISIONAL - hours after delivery before a seller balance is approved. Engineering default, house-consistent with dispute_sla_hours / review_edit_window_hours - NOT spec-derived. Confirm before launch (REG-62).'),
  ('delivery_fee_flat_egp', '0', 'PROVISIONAL - flat delivery fee (Phase 07; retired when the courier API lands at Phase 08). Hard pre-launch gate (REG-62).'),
  ('betk_instapay_handle', '', 'BETK deposit-receipt handle - set via dashboard. Checkout cannot render payment instructions while empty. Hard gate (REG-62).'),
  ('betk_vodafone_cash', '', 'BETK deposit-receipt handle - set via dashboard (REG-62).'),
  ('betk_orange_cash', '', 'BETK deposit-receipt handle - set via dashboard (REG-62).');

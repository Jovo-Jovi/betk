-- ============================================================
-- 20260716124323_decrement_stock_on_confirm.sql
-- R2: backfill the decrement_stock_on_confirm trigger (BETK_ERD.md §7, R-L05/R-L06).
-- Owed to source since Phase-01 T05/T14 (SESSION_CONTEXT open-issue #4).
-- Additive only: one trigger function + one trigger on betk.orders. No table/
-- column/policy/grant change. Source parity: docs/03-database/BETK_DATABASE_SCHEMA.sql.
--
-- Fires when an order transitions INTO 'confirmed' (seller confirm, R-L05 — NOT at
-- checkout). Decrements each ordered listing's tracked stock_qty by the ordered
-- quantity, and flips an active listing to 'sold_out' when its stock reaches 0
-- (R-L06). Untracked stock (stock_qty IS NULL — services / made-to-order) is left
-- unchanged. The listings CHECK (stock_qty >= 0) is the authoritative oversell
-- guard: a confirm that would drive stock negative raises and rolls back. SECURITY
-- DEFINER + pinned search_path (matches the search_path-pinning security-advisor
-- pattern; trigger functions are not RPC-exposed, so no SECURITY DEFINER RPC advisor
-- applies) so the bookkeeping always runs regardless of the confirming role's RLS.
-- ============================================================
SET search_path TO betk, public;

CREATE OR REPLACE FUNCTION betk.decrement_stock_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = betk, public
AS $$
BEGIN
  UPDATE betk.listings AS l
  SET stock_qty  = l.stock_qty - oi.qty,
      status     = CASE
                     WHEN l.stock_qty - oi.qty = 0 AND l.status = 'active'
                     THEN 'sold_out'::betk.listing_status
                     ELSE l.status
                   END,
      updated_at = NOW()
  FROM (
    SELECT listing_id, SUM(quantity)::INTEGER AS qty
    FROM betk.order_items
    WHERE order_id = NEW.id
    GROUP BY listing_id
  ) AS oi
  WHERE l.id = oi.listing_id
    AND l.stock_qty IS NOT NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_decrement_stock_on_confirm
AFTER UPDATE OF status ON betk.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'confirmed')
EXECUTE FUNCTION betk.decrement_stock_on_confirm();

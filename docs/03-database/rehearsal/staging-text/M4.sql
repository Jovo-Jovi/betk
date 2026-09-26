-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
-- <<< STAGING-BOUND LITERALS

-- M4 v2_08_detach_stock_on_confirm. Plan §6 M4, §4.2.
-- The function remains until M8. This drops the trigger only.

DROP TRIGGER trg_decrement_stock_on_confirm ON betk.orders;

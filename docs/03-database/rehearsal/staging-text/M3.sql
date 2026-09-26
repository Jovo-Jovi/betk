-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
-- <<< STAGING-BOUND LITERALS

-- M3 v2_08_additive_columns. Plan §6 M3, §1.2, ERD §6.2 and §6.3.
-- The relation is still betk.orders. M6 renames it.

ALTER TABLE betk.listings
  ADD COLUMN weight_g integer,
  ADD COLUMN length_mm integer,
  ADD COLUMN width_mm integer,
  ADD COLUMN height_mm integer,
  ADD COLUMN specs jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN prep_days smallint,
  ADD COLUMN stock_touched_at timestamptz;

ALTER TABLE betk.listings
  ADD CONSTRAINT listings_weight_g_check CHECK (weight_g IS NULL OR weight_g > 0),
  ADD CONSTRAINT listings_length_mm_check CHECK (length_mm IS NULL OR length_mm > 0),
  ADD CONSTRAINT listings_width_mm_check CHECK (width_mm IS NULL OR width_mm > 0),
  ADD CONSTRAINT listings_height_mm_check CHECK (height_mm IS NULL OR height_mm > 0);

-- DRAFT. Phase 08. Do not VALIDATE in this phase.
ALTER TABLE betk.listings
  ADD CONSTRAINT chk_active_listing_shipping
  CHECK (
    status <> 'active'::betk.listing_status
    OR (
      weight_g IS NOT NULL AND length_mm IS NOT NULL
      AND width_mm IS NOT NULL AND height_mm IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE betk.inquiries
  ADD COLUMN quoted_price numeric(10,2),
  ADD COLUMN quoted_prep_days smallint,
  ADD COLUMN quote_expires_at timestamptz,
  ADD COLUMN quoted_at timestamptz;

ALTER TABLE betk.inquiries
  ADD CONSTRAINT inquiries_quoted_price_check CHECK (quoted_price IS NULL OR quoted_price > 0),
  ADD CONSTRAINT inquiries_quoted_prep_days_check CHECK (quoted_prep_days IS NULL OR quoted_prep_days >= 0);

ALTER TABLE betk.order_items
  ADD COLUMN is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN inquiry_id uuid,
  ADD COLUMN prep_days_snapshot smallint;

ALTER TABLE betk.order_items
  ADD CONSTRAINT order_items_inquiry_id_fkey
    FOREIGN KEY (inquiry_id) REFERENCES betk.inquiries (id),
  ADD CONSTRAINT chk_order_item_custom_inquiry
    CHECK (
      (is_custom = false AND inquiry_id IS NULL)
      OR (is_custom = true AND inquiry_id IS NOT NULL)
    );

ALTER TABLE betk.payments
  ADD COLUMN refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN proof_snapshot_at timestamptz;

ALTER TABLE betk.payments
  ADD CONSTRAINT chk_refunded_amount
    CHECK (0 <= refunded_amount AND refunded_amount <= amount);

ALTER TABLE betk.disputes
  ADD COLUMN return_id uuid;

ALTER TABLE betk.disputes
  ADD CONSTRAINT disputes_return_id_fkey
    FOREIGN KEY (return_id) REFERENCES betk.returns (id);

ALTER TABLE betk.orders
  ADD COLUMN master_order_id uuid,
  ADD COLUMN display_ref varchar(64),
  ADD COLUMN courier_rate_id uuid,
  ADD COLUMN prep_deadline timestamptz,
  ADD COLUMN escalated_at timestamptz,
  ADD COLUMN escalation_reason betk.escalation_reason,
  ADD COLUMN escalation_note text,
  ADD COLUMN escalation_resolved_at timestamptz,
  ADD COLUMN balance_confirmed_at timestamptz,
  ADD COLUMN refunded_subtotal numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN payout_eligible_at timestamptz;

ALTER TABLE betk.orders
  ADD CONSTRAINT orders_master_order_id_fkey
    FOREIGN KEY (master_order_id) REFERENCES betk.master_orders (id),
  ADD CONSTRAINT orders_courier_rate_id_fkey
    FOREIGN KEY (courier_rate_id) REFERENCES betk.courier_rates (id) ON DELETE SET NULL,
  ADD CONSTRAINT chk_escalation_reason_present
    CHECK ((escalated_at IS NULL) OR (escalation_reason IS NOT NULL)),
  ADD CONSTRAINT chk_refunded_subtotal
    CHECK (0 <= refunded_subtotal AND refunded_subtotal <= subtotal);

CREATE UNIQUE INDEX uq_orders_display_ref
  ON betk.orders (display_ref)
  WHERE display_ref IS NOT NULL;

-- Four keys whose ERD §6.3 text states a default meaning. Nine keys inserted
-- as empty text (D4). Empty means not configured. No placeholder.
INSERT INTO betk.admin_settings (key, value) VALUES
  ('quote_tolerance_multiplier', '2'),
  ('quote_validity_hours', '24'),
  ('prep_cap_days', '3'),
  ('seller_category_limit', '3'),
  ('price_band_min_egp', ''),
  ('price_band_max_egp', ''),
  ('payment_window_minutes', ''),
  ('return_window_hours', ''),
  ('food_requirements', ''),
  ('agreement_buyer_terms_version', ''),
  ('agreement_seller_agreement_version', ''),
  ('agreement_return_policy_version', ''),
  ('agreement_privacy_version', '');

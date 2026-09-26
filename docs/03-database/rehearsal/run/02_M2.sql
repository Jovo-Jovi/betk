DO $rehearsal_guard$
BEGIN
  IF to_regclass('rehearsal.sentinel') IS NULL THEN
    RAISE EXCEPTION 'BETK_REHEARSAL_SENTINEL_MISSING';
  END IF;
END
$rehearsal_guard$;

BEGIN;
-- >>> STAGING-BOUND LITERALS (rehearsal substitutes this block only)
-- <<< STAGING-BOUND LITERALS

-- M2 v2_08_new_tables. Plan §6 M2, §1.1–§1.5, ERD §6.1 and §8.
-- Per table: CREATE, ENABLE ROW LEVEL SECURITY, CREATE POLICY, then the
-- grant change past the default ACL (anon loses writes).
-- returns.seller_order_id references betk.orders. M6 renames that relation
-- in place; the foreign key follows the OID (plan §2).

-- DRAFT. Mechanism for the ERD exclusion constraint. Not a new table.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

SET LOCAL search_path TO betk, extensions, public;

CREATE TABLE betk.cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  quantity smallint NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  inquiry_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES betk.users (id) ON DELETE CASCADE,
  CONSTRAINT cart_items_listing_id_fkey FOREIGN KEY (listing_id) REFERENCES betk.listings (id),
  CONSTRAINT cart_items_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES betk.inquiries (id),
  CONSTRAINT cart_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT cart_items_unit_price_check CHECK (unit_price > 0),
  CONSTRAINT chk_cart_item_custom_inquiry CHECK (
    (is_custom = false AND inquiry_id IS NULL)
    OR (is_custom = true AND inquiry_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_cart_items_listing
  ON betk.cart_items (buyer_id, listing_id)
  WHERE inquiry_id IS NULL;

CREATE UNIQUE INDEX uq_cart_items_inquiry
  ON betk.cart_items (buyer_id, inquiry_id)
  WHERE inquiry_id IS NOT NULL;

ALTER TABLE betk.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY cart_items_select ON betk.cart_items
  FOR SELECT
  USING (buyer_id = (select auth.uid()) OR betk.is_admin());

CREATE POLICY cart_items_insert ON betk.cart_items
  FOR INSERT
  WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY cart_items_update ON betk.cart_items
  FOR UPDATE
  USING (buyer_id = (select auth.uid()))
  WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY cart_items_delete ON betk.cart_items
  FOR DELETE
  USING (buyer_id = (select auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON betk.cart_items FROM anon;

CREATE TABLE betk.master_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  betk_ref varchar(25) NOT NULL,
  delivery_address_id uuid,
  recipient_name varchar(100),
  recipient_phone varchar(15),
  snapshot_governorate varchar(50),
  snapshot_city varchar(100),
  snapshot_street_address text,
  snapshot_building_notes text,
  combined_delivery_total numeric(10,2) NOT NULL,
  proof_path varchar,
  transfer_reference varchar(100),
  proof_uploaded_at timestamptz,
  payment_deadline timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT master_orders_pkey PRIMARY KEY (id),
  CONSTRAINT uq_master_orders_betk_ref UNIQUE (betk_ref),
  CONSTRAINT master_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES betk.users (id),
  CONSTRAINT master_orders_delivery_address_id_fkey FOREIGN KEY (delivery_address_id) REFERENCES betk.addresses (id),
  CONSTRAINT chk_master_combined_delivery_total CHECK (combined_delivery_total >= 0)
);

ALTER TABLE betk.master_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY master_orders_select ON betk.master_orders
  FOR SELECT
  USING (buyer_id = (select auth.uid()) OR betk.is_admin());

CREATE POLICY master_orders_insert ON betk.master_orders
  FOR INSERT
  WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY master_orders_phone_gate ON betk.master_orders
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM betk.users AS u
      WHERE u.id = (select auth.uid())
        AND u.phone_number IS NOT NULL
    )
  );

CREATE POLICY master_orders_update ON betk.master_orders
  FOR UPDATE
  USING (buyer_id = (select auth.uid()) OR betk.is_admin())
  WITH CHECK (buyer_id = (select auth.uid()) OR betk.is_admin());

REVOKE INSERT, UPDATE, DELETE ON betk.master_orders FROM anon;

CREATE TABLE betk.returns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  store_id uuid NOT NULL,
  reason text NOT NULL,
  status betk.return_status NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT returns_pkey PRIMARY KEY (id),
  CONSTRAINT returns_seller_order_id_fkey FOREIGN KEY (seller_order_id) REFERENCES betk.orders (id),
  CONSTRAINT returns_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES betk.users (id),
  CONSTRAINT returns_store_id_fkey FOREIGN KEY (store_id) REFERENCES betk.stores (id)
);

ALTER TABLE betk.returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY returns_select ON betk.returns
  FOR SELECT
  USING (
    buyer_id = (select auth.uid())
    OR store_id = betk.my_store_id()
    OR betk.is_admin()
  );

CREATE POLICY returns_insert ON betk.returns
  FOR INSERT
  WITH CHECK (buyer_id = (select auth.uid()));

CREATE POLICY returns_update ON betk.returns
  FOR UPDATE
  USING (store_id = betk.my_store_id() OR betk.is_admin())
  WITH CHECK (store_id = betk.my_store_id() OR betk.is_admin());

REVOKE INSERT, UPDATE, DELETE ON betk.returns FROM anon;

CREATE TABLE betk.return_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT return_evidence_pkey PRIMARY KEY (id),
  CONSTRAINT return_evidence_return_id_fkey FOREIGN KEY (return_id) REFERENCES betk.returns (id) ON DELETE CASCADE
);

ALTER TABLE betk.return_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY return_evidence_select ON betk.return_evidence
  FOR SELECT
  USING (
    betk.is_admin()
    OR EXISTS (
      SELECT 1
      FROM betk.returns AS r
      WHERE r.id = return_id
        AND (
          r.buyer_id = (select auth.uid())
          OR r.store_id = betk.my_store_id()
        )
    )
  );

CREATE POLICY return_evidence_insert ON betk.return_evidence
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM betk.returns AS r
      WHERE r.id = return_id
        AND r.buyer_id = (select auth.uid())
    )
  );

REVOKE INSERT, UPDATE, DELETE ON betk.return_evidence FROM anon;

CREATE TABLE betk.agreement_acceptances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document betk.agreement_document NOT NULL,
  version_label text NOT NULL,
  status text NOT NULL DEFAULT 'accepted',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text,
  CONSTRAINT agreement_acceptances_pkey PRIMARY KEY (id),
  CONSTRAINT agreement_acceptances_user_id_fkey FOREIGN KEY (user_id) REFERENCES betk.users (id),
  CONSTRAINT uq_agreement_acceptances_version UNIQUE (user_id, document, version_label),
  CONSTRAINT chk_agreement_acceptance_status CHECK (status = 'accepted')
);

ALTER TABLE betk.agreement_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY agreement_acceptances_select ON betk.agreement_acceptances
  FOR SELECT
  USING (user_id = (select auth.uid()) OR betk.is_admin());

CREATE POLICY agreement_acceptances_insert ON betk.agreement_acceptances
  FOR INSERT
  WITH CHECK (user_id = (select auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON betk.agreement_acceptances FROM anon;

CREATE TABLE betk.store_categories (
  store_id uuid NOT NULL,
  category_id uuid NOT NULL,
  approved_at timestamptz,
  CONSTRAINT store_categories_pkey PRIMARY KEY (store_id, category_id),
  CONSTRAINT store_categories_store_id_fkey FOREIGN KEY (store_id) REFERENCES betk.stores (id) ON DELETE CASCADE,
  CONSTRAINT store_categories_category_id_fkey FOREIGN KEY (category_id) REFERENCES betk.categories (id)
);

ALTER TABLE betk.store_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_categories_select ON betk.store_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY store_categories_insert ON betk.store_categories
  FOR INSERT
  WITH CHECK (store_id = betk.my_store_id() OR betk.is_admin());

CREATE POLICY store_categories_update ON betk.store_categories
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

CREATE POLICY store_categories_delete ON betk.store_categories
  FOR DELETE
  USING (store_id = betk.my_store_id() OR betk.is_admin());

REVOKE INSERT, UPDATE, DELETE ON betk.store_categories FROM anon;

CREATE TABLE betk.courier_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  origin_governorate varchar(50) NOT NULL,
  destination_governorate varchar(50) NOT NULL,
  weight_min_g integer NOT NULL,
  weight_max_g integer,
  fee_egp numeric(10,2) NOT NULL,
  CONSTRAINT courier_rates_pkey PRIMARY KEY (id),
  CONSTRAINT uq_courier_rates_band_start UNIQUE (origin_governorate, destination_governorate, weight_min_g),
  CONSTRAINT courier_rates_weight_min_check CHECK (weight_min_g >= 0),
  CONSTRAINT courier_rates_weight_max_check CHECK (weight_max_g IS NULL OR weight_max_g > weight_min_g),
  CONSTRAINT courier_rates_fee_check CHECK (fee_egp >= 0),
  CONSTRAINT courier_rates_no_overlap EXCLUDE USING gist (
    (origin_governorate::text) WITH =,
    (destination_governorate::text) WITH =,
    int4range(weight_min_g, weight_max_g, '[)') WITH &&
  )
);

ALTER TABLE betk.courier_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY courier_rates_select ON betk.courier_rates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY courier_rates_insert ON betk.courier_rates
  FOR INSERT
  WITH CHECK (betk.is_admin());

CREATE POLICY courier_rates_update ON betk.courier_rates
  FOR UPDATE
  USING (betk.is_admin())
  WITH CHECK (betk.is_admin());

CREATE POLICY courier_rates_delete ON betk.courier_rates
  FOR DELETE
  USING (betk.is_admin());

REVOKE INSERT, UPDATE, DELETE ON betk.courier_rates FROM anon;

CREATE TABLE betk.store_pickup_addresses (
  store_id uuid NOT NULL,
  governorate varchar(50) NOT NULL,
  city varchar(100) NOT NULL,
  street_address text NOT NULL,
  building_notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_pickup_addresses_pkey PRIMARY KEY (store_id),
  CONSTRAINT store_pickup_addresses_store_id_fkey FOREIGN KEY (store_id) REFERENCES betk.stores (id) ON DELETE CASCADE
);

ALTER TABLE betk.store_pickup_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_pickup_addresses_select ON betk.store_pickup_addresses
  FOR SELECT
  USING (store_id = betk.my_store_id() OR betk.is_admin());

CREATE POLICY store_pickup_addresses_insert ON betk.store_pickup_addresses
  FOR INSERT
  WITH CHECK (store_id = betk.my_store_id());

CREATE POLICY store_pickup_addresses_update ON betk.store_pickup_addresses
  FOR UPDATE
  USING (store_id = betk.my_store_id() OR betk.is_admin())
  WITH CHECK (store_id = betk.my_store_id() OR betk.is_admin());

REVOKE INSERT, UPDATE, DELETE ON betk.store_pickup_addresses FROM anon;
COMMIT;

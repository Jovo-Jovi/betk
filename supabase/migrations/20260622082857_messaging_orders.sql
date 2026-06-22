-- ============================================================
-- 0005_messaging_orders.sql
-- C3 Step 6 steps 020-027: Group F (inquiries, inquiry_messages, order_messages)
-- + Group G (orders, order_items, order_status_history).
-- Resolves the inquiries.converted_to_order_id <-> orders circular FK and the
-- order_messages.order_id FK via ALTER once both tables exist (kept inline where
-- they appear in the source). Includes append-only RULES on order_status_history.
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
-- ============================================================
SET search_path TO betk, public;

-- ============================================================
-- F1. inquiries
-- ============================================================
CREATE TABLE betk.inquiries (
  id                      UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id                UUID                 NOT NULL REFERENCES betk.users(id),
  store_id                UUID                 NOT NULL REFERENCES betk.stores(id),
  listing_id              UUID                 NOT NULL REFERENCES betk.listings(id),
  quantity                SMALLINT             CHECK (quantity > 0),
  delivery_preference     delivery_preference,
  special_requests        TEXT,
  status                  inquiry_status       NOT NULL DEFAULT 'open',
  converted_to_order_id   UUID,
  buyer_first_message     TEXT                 NOT NULL,
  created_at              TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  last_message_at         TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

-- ============================================================
-- F2. inquiry_messages
-- ============================================================
CREATE TABLE betk.inquiry_messages (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id  UUID         NOT NULL REFERENCES betk.inquiries(id) ON DELETE CASCADE,
  sender_id   UUID         NOT NULL REFERENCES betk.users(id),
  sender_type sender_type  NOT NULL,
  body        TEXT         NOT NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- F3. order_messages
-- Post-order communication (separate from inquiry thread)
-- ============================================================
CREATE TABLE betk.order_messages (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID         NOT NULL,
  sender_id   UUID         NOT NULL REFERENCES betk.users(id),
  sender_type sender_type  NOT NULL,
  body        TEXT         NOT NULL,
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- G1. orders
-- ============================================================
CREATE TABLE betk.orders (
  id                   UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  betk_ref             VARCHAR(25)          NOT NULL,
  buyer_id             UUID                 NOT NULL REFERENCES betk.users(id),
  store_id             UUID                 NOT NULL REFERENCES betk.stores(id),
  inquiry_id           UUID                 REFERENCES betk.inquiries(id),
  delivery_address_id  UUID                 REFERENCES betk.addresses(id),
  delivery_method      delivery_preference  NOT NULL,
  delivery_fee         NUMERIC(10,2)        NOT NULL DEFAULT 0,
  subtotal             NUMERIC(10,2)        NOT NULL,
  total_amount         NUMERIC(10,2)        NOT NULL,
  status               order_status         NOT NULL DEFAULT 'pending',
  cancelled_by         cancelled_by_type,
  cancellation_reason  TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  confirmed_at         TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  CONSTRAINT uq_orders_betk_ref UNIQUE (betk_ref),
  CONSTRAINT chk_order_total CHECK (total_amount = subtotal + delivery_fee)
);

-- Add FK for order_messages after orders table exists
ALTER TABLE betk.order_messages
  ADD CONSTRAINT fk_order_messages_order
  FOREIGN KEY (order_id) REFERENCES betk.orders(id) ON DELETE CASCADE;

-- Add FK for inquiries converted_to_order_id
ALTER TABLE betk.inquiries
  ADD CONSTRAINT fk_inquiries_order
  FOREIGN KEY (converted_to_order_id) REFERENCES betk.orders(id);

-- ============================================================
-- G2. order_items
-- ============================================================
CREATE TABLE betk.order_items (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID           NOT NULL REFERENCES betk.orders(id) ON DELETE CASCADE,
  listing_id       UUID           NOT NULL REFERENCES betk.listings(id),
  listing_title_ar VARCHAR(80)    NOT NULL,
  quantity         SMALLINT       NOT NULL CHECK (quantity > 0),
  unit_price       NUMERIC(10,2)  NOT NULL CHECK (unit_price > 0),
  subtotal         NUMERIC(10,2)  NOT NULL,
  CONSTRAINT chk_order_item_subtotal CHECK (subtotal = quantity * unit_price)
);

-- ============================================================
-- G3. order_status_history
-- Immutable append-only log
-- ============================================================
CREATE TABLE betk.order_status_history (
  id               UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID                 NOT NULL REFERENCES betk.orders(id),
  from_status      order_status,
  to_status        order_status         NOT NULL,
  changed_by       UUID                 REFERENCES betk.users(id),
  changed_by_type  cancelled_by_type    NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

-- Prevent updates and deletes on status history
CREATE RULE no_update_order_history AS ON UPDATE TO betk.order_status_history DO INSTEAD NOTHING;
CREATE RULE no_delete_order_history AS ON DELETE TO betk.order_status_history DO INSTEAD NOTHING;

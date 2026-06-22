-- ============================================================
-- 0006_payments_delivery.sql
-- C3 Step 6 steps 028-031: Group H (payments, payouts) + Group I
-- (shipments, shipment_tracking_events).
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
-- ============================================================
SET search_path TO betk, public;

-- ============================================================
-- H1. payments
-- Split payment: deposit (upfront) + balance (COD)
-- ============================================================
CREATE TABLE betk.payments (
  id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID            NOT NULL REFERENCES betk.orders(id),
  payment_type        payment_type    NOT NULL,
  amount              NUMERIC(10,2)   NOT NULL CHECK (amount > 0),
  method              payment_method  NOT NULL,
  status              payment_status  NOT NULL DEFAULT 'pending',
  confirmed_by        UUID            REFERENCES betk.users(id),
  confirmed_at        TIMESTAMPTZ,
  transfer_reference  VARCHAR(100),
  notes               TEXT,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_payment_type_per_order UNIQUE (order_id, payment_type)
);

-- ============================================================
-- H2. payouts
-- Seller earnings withdrawal requests
-- ============================================================
CREATE TABLE betk.payouts (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID           NOT NULL REFERENCES betk.stores(id),
  amount           NUMERIC(10,2)  NOT NULL CHECK (amount >= 100),
  method           payout_method  NOT NULL,
  account_details  VARCHAR(100)   NOT NULL,
  status           payout_status  NOT NULL DEFAULT 'pending',
  processed_by     UUID           REFERENCES betk.users(id),
  processed_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  requested_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- I1. shipments
-- ============================================================
CREATE TABLE betk.shipments (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID             NOT NULL REFERENCES betk.orders(id),
  courier         VARCHAR(50)      NOT NULL,
  tracking_number VARCHAR(100),
  tracking_url    TEXT,
  status          shipment_status  NOT NULL DEFAULT 'created',
  dispatched_at   TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_shipment_order UNIQUE (order_id)
);

-- ============================================================
-- I2. shipment_tracking_events
-- Immutable courier event log
-- ============================================================
CREATE TABLE betk.shipment_tracking_events (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id  UUID         NOT NULL REFERENCES betk.shipments(id) ON DELETE CASCADE,
  status       VARCHAR(50)  NOT NULL,
  location     VARCHAR(100),
  description  TEXT,
  event_at     TIMESTAMPTZ  NOT NULL
);

-- ============================================================
-- 0002_identity.sql
-- C3 Step 6 steps 004-006: Group A (users, otp_tokens, sessions).
-- users carries the MVP-freeze deltas (OD-4 phone nullable + auth_provider; OD-2 deleted_at/anonymized_at).
-- Source: docs/03-database/BETK_DATABASE_SCHEMA.sql (verbatim).
-- ============================================================
SET search_path TO betk, public;

-- ============================================================
-- A1. users
-- Central identity for all platform participants
-- ============================================================
CREATE TABLE betk.users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number     VARCHAR(15),                            -- OD-4: NULLABLE (was NOT NULL); UNIQUE still holds (Postgres allows multiple NULLs)
  auth_provider    auth_provider NOT NULL DEFAULT 'phone', -- OD-4: 'phone' | 'google'
  role             user_role    NOT NULL DEFAULT 'buyer',
  status           user_status  NOT NULL DEFAULT 'active',
  deleted_at       TIMESTAMPTZ,                            -- OD-2: deactivate-only (login blocked when set; R-A05)
  anonymized_at    TIMESTAMPTZ,                            -- OD-2: reserved for post-MVP MW1 anonymization
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_login_at    TIMESTAMPTZ,
  CONSTRAINT uq_users_phone UNIQUE (phone_number)
);

-- ============================================================
-- A2. otp_tokens
-- Short-lived phone verification tokens
-- ============================================================
CREATE TABLE betk.otp_tokens (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  VARCHAR(15)  NOT NULL,
  token_hash    VARCHAR(64)  NOT NULL,
  expires_at    TIMESTAMPTZ  NOT NULL,
  is_used       BOOLEAN      NOT NULL DEFAULT FALSE,
  attempt_count SMALLINT     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_otp_attempts CHECK (attempt_count <= 5)
);

-- ============================================================
-- A3. sessions
-- Active authenticated user sessions
-- ============================================================
CREATE TABLE betk.sessions (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID         NOT NULL REFERENCES betk.users(id) ON DELETE CASCADE,
  token_hash     VARCHAR(64)  NOT NULL,
  device_info    JSONB,
  expires_at     TIMESTAMPTZ  NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_sessions_token UNIQUE (token_hash)
);

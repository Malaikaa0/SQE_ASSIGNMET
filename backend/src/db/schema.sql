-- Library Administration System - System Administration Module
-- Schema encodes all 7 functional requirements as real relational business rules.

-- ============================================================
-- Staff accounts & role templates (Req 2420)
-- ============================================================
CREATE TABLE IF NOT EXISTS role_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) UNIQUE NOT NULL,
  description TEXT,
  default_privileges JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_accounts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(60) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160),
  workgroup VARCHAR(80) DEFAULT 'DEFAULT',
  location VARCHAR(80) DEFAULT 'MAIN',
  role_template_id INTEGER REFERENCES role_templates(id),
  privileges JSONB NOT NULL DEFAULT '{}'::jsonb, -- merged/overridden from template at creation time
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Patrons & bibliographic/item records
-- ============================================================
CREATE TABLE IF NOT EXISTS patrons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  patron_type VARCHAR(40) NOT NULL DEFAULT 'ADULT', -- ADULT, JUVENILE, STAFF, STUDENT, BLOCKED
  account_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bib_records (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(160),
  location VARCHAR(80) NOT NULL DEFAULT 'MAIN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id SERIAL PRIMARY KEY,
  barcode VARCHAR(60) UNIQUE NOT NULL,
  bib_id INTEGER NOT NULL REFERENCES bib_records(id) ON DELETE CASCADE,
  item_type VARCHAR(40) NOT NULL DEFAULT 'BOOK', -- BOOK, DVD, EQUIPMENT, REFERENCE
  status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, CHECKED_OUT, LOST, DAMAGED, IN_REPAIR, WITHDRAWN
  location VARCHAR(80) NOT NULL DEFAULT 'MAIN',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkouts (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  patron_id INTEGER NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  checkout_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL,
  renewals_used INTEGER NOT NULL DEFAULT 0,
  returned_at TIMESTAMPTZ -- NULL = currently checked out
);

CREATE TABLE IF NOT EXISTS holds (
  id SERIAL PRIMARY KEY,
  patron_id INTEGER NOT NULL REFERENCES patrons(id) ON DELETE CASCADE,
  bib_id INTEGER NOT NULL REFERENCES bib_records(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, FILLED, CANCELLED
  staff_override BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  created_by INTEGER REFERENCES staff_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Loan rules (Req 5057)
-- ============================================================
CREATE TABLE IF NOT EXISTS loan_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  patron_type VARCHAR(40) NOT NULL, -- matches patrons.patron_type, or 'ANY'
  item_type VARCHAR(40) NOT NULL DEFAULT 'ANY', -- matches items.item_type, or 'ANY'
  max_items_checked_out INTEGER NOT NULL DEFAULT 10,
  loan_period_days INTEGER NOT NULL DEFAULT 21,
  renewal_limit INTEGER NOT NULL DEFAULT 2,
  blocked_item_statuses TEXT[] NOT NULL DEFAULT ARRAY['LOST','DAMAGED','IN_REPAIR','WITHDRAWN'],
  active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100, -- lower = evaluated first when multiple rules match
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Requesting (hold) rules (Req 5190)
-- ============================================================
CREATE TABLE IF NOT EXISTS requesting_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  patron_type VARCHAR(40) NOT NULL, -- or 'ANY'
  max_active_holds INTEGER NOT NULL DEFAULT 5,
  max_account_balance NUMERIC(10,2) NOT NULL DEFAULT 10.00, -- balance above this blocks holds
  blocked_item_statuses TEXT[] NOT NULL DEFAULT ARRAY['LOST','WITHDRAWN'],
  allow_staff_override BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Suppression rules (Req 5278)
-- ============================================================
CREATE TABLE IF NOT EXISTS suppression_rules (
  id SERIAL PRIMARY KEY,
  record_type VARCHAR(20) NOT NULL CHECK (record_type IN ('BIB','ITEM')),
  record_id INTEGER NOT NULL,
  scope VARCHAR(20) NOT NULL CHECK (scope IN ('WORKGROUP','LOCATION','ALL')),
  workgroup VARCHAR(80), -- required when scope = WORKGROUP
  location VARCHAR(80),  -- required when scope = LOCATION
  reason TEXT,
  created_by INTEGER REFERENCES staff_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(record_type, record_id)
);

-- ============================================================
-- Record lock management (Req 6513 / 7302)
-- ============================================================
CREATE TABLE IF NOT EXISTS record_locks (
  id SERIAL PRIMARY KEY,
  record_type VARCHAR(20) NOT NULL, -- BIB, ITEM, PATRON, STAFF, etc.
  record_id INTEGER NOT NULL,
  locked_by INTEGER NOT NULL REFERENCES staff_accounts(id),
  location VARCHAR(80) NOT NULL DEFAULT 'MAIN',
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  timeout_minutes INTEGER NOT NULL DEFAULT 15,
  unlocked_at TIMESTAMPTZ,
  unlocked_by INTEGER REFERENCES staff_accounts(id),
  unlock_reason TEXT,
  UNIQUE(record_type, record_id, unlocked_at) -- allows re-locking after unlock (unlocked_at distinguishes rows); active lock enforced in app logic
);

CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(80) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- System monitoring & alerts (Req 6501)
-- ============================================================
CREATE TABLE IF NOT EXISTS monitoring_thresholds (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(60) UNIQUE NOT NULL, -- CPU_LOAD, MEMORY_USED_PCT, DB_CONNECTIONS, DISK_FREE_PCT
  unit VARCHAR(20) NOT NULL DEFAULT '%',
  warning_threshold NUMERIC(10,2) NOT NULL,
  critical_threshold NUMERIC(10,2) NOT NULL,
  higher_is_worse BOOLEAN NOT NULL DEFAULT true, -- false for metrics like DISK_FREE_PCT where low values are bad
  email_on_critical BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metric_readings (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(60) NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(60) NOT NULL,
  level VARCHAR(20) NOT NULL CHECK (level IN ('WARNING','CRITICAL')),
  value NUMERIC(12,2) NOT NULL,
  threshold NUMERIC(12,2) NOT NULL,
  message TEXT NOT NULL,
  emailed BOOLEAN NOT NULL DEFAULT false,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by INTEGER REFERENCES staff_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkouts_item_open ON checkouts(item_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_holds_bib_active ON holds(bib_id) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_locks_active ON record_locks(record_type, record_id) WHERE unlocked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);

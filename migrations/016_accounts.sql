BEGIN;

-- Per-site desk keys: each coach/gym gets a key that opens ONLY their own
-- desk data. Stored as a SHA-256 hash; the plain key is shown once.
CREATE TABLE IF NOT EXISTS desk_keys (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS desk_keys_tenant_idx
  ON desk_keys (tenant_id) WHERE revoked_at IS NULL;

-- The coach's own books: money in (memberships, coaching, events…) and
-- money out (venue, kit, travel…) recorded by hand or confirmed from a
-- bank-transfer reservation. Paid site orders are read live from `orders`
-- rather than copied here. Entries are voided, never deleted, so the
-- accountant's history can't silently change.
-- direction: income | expense
CREATE TABLE IF NOT EXISTS ledger_entries (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  entry_date date NOT NULL,
  direction text NOT NULL,
  category text NOT NULL,
  description text,
  counterparty text,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  currency text NOT NULL,
  method text,
  reference text,
  source text NOT NULL DEFAULT 'manual',
  submission_id uuid,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_entries_tenant_date_idx
  ON ledger_entries (tenant_id, entry_date DESC);

-- Decisions on bank-transfer reservations (paid → ledger entry, or
-- dismissed), one per submission, so confirming twice can't double-count.
CREATE TABLE IF NOT EXISTS submission_reviews (
  tenant_id text NOT NULL,
  submission_id uuid NOT NULL,
  status text NOT NULL,
  entry_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, submission_id)
);

COMMIT;

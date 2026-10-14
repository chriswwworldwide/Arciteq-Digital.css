BEGIN;

-- Every accountant/records download, so the Money page can remind owners
-- to save their own copy of each finished year (Indonesia requires records
-- to be kept in Indonesia — the owner's downloaded file is that copy).
-- role: coach (owner's own download) | admin (us, e.g. offboarding)
CREATE TABLE IF NOT EXISTS ledger_exports (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  role text NOT NULL,
  rows integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_exports_tenant_idx
  ON ledger_exports (tenant_id, created_at DESC);

COMMIT;

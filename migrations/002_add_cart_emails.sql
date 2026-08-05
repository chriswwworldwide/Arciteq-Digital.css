BEGIN;

CREATE TABLE IF NOT EXISTS cart_emails (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  email text NOT NULL,
  cart jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cart_emails_tenant_status_idx ON cart_emails (tenant_id, status, created_at DESC);

COMMIT;

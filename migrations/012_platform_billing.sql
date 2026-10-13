BEGIN;

-- Platform-side billing: money tenants pay US (setup fees, monthly platform
-- subscription), recorded separately from tenant storefront orders.
-- kind: setup | subscription | addon | other
-- method: stripe | bank_transfer | cash | other
-- status: pending | paid | refunded | void
CREATE TABLE IF NOT EXISTS platform_payments (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  kind text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'pending',
  method text NOT NULL DEFAULT 'other',
  amount bigint NOT NULL, -- integer minor units (pence)
  currency text NOT NULL DEFAULT 'gbp',
  period_start date, -- for subscription rows: which month it covers
  period_end date,
  note text,
  stripe_checkout_session_id text,
  stripe_invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_payments_tenant
  ON platform_payments (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_payments_status
  ON platform_payments (status, created_at DESC);

COMMIT;

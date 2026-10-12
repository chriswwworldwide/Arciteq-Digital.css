BEGIN;

-- Order-level discount + tax totals recorded from Stripe session details.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS amount_discount bigint,
  ADD COLUMN IF NOT EXISTS amount_tax bigint,
  ADD COLUMN IF NOT EXISTS discount_code text;

-- Stock levels per product per tenant. NULL row absent = unlimited stock.
CREATE TABLE IF NOT EXISTS inventory (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  product_id text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, product_id)
);

-- Audit trail for every stock change: reserve on checkout start,
-- restore on expiry/cancel, capture on payment.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  product_id text NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL, -- reserve | capture | restore | manual
  order_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inventory_movements_product_idx
  ON inventory_movements (tenant_id, product_id, created_at DESC);

-- Stable private link for customer account pages (order history).
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS account_token text;

CREATE UNIQUE INDEX IF NOT EXISTS customers_account_token_idx
  ON customers (account_token) WHERE account_token IS NOT NULL;

COMMIT;

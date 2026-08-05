BEGIN;

CREATE TABLE IF NOT EXISTS stripe_events (
  stripe_event_id text PRIMARY KEY,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  order_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  status text NOT NULL,
  currency text NOT NULL,
  amount_subtotal integer,
  amount_total integer,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  stripe_checkout_session_id text UNIQUE,
  stripe_payment_intent_id text,
  customer_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_tenant_created_at_idx ON orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_events (
  id bigserial PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS order_events_order_id_at_idx ON order_events (order_id, at DESC);

COMMIT;

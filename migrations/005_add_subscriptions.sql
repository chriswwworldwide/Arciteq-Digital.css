BEGIN;

-- Recurring billing: one row per Stripe subscription, keyed to the tenant and
-- the originating checkout order so renewals stitch into the same customer.
CREATE TABLE IF NOT EXISTS subscriptions (
  stripe_subscription_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  order_id text REFERENCES orders(order_id) ON DELETE SET NULL,
  customer_email text,
  stripe_customer_id text,
  status text NOT NULL, -- active | trialing | past_due | canceled | unpaid | incomplete | paused
  currency text,
  amount_minor integer,
  billing_interval text,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_tenant_status_idx ON subscriptions (tenant_id, status);
CREATE INDEX IF NOT EXISTS subscriptions_email_idx ON subscriptions (lower(customer_email));

-- Renewal orders point back at their subscription.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
CREATE INDEX IF NOT EXISTS orders_subscription_idx ON orders (stripe_subscription_id);

COMMIT;

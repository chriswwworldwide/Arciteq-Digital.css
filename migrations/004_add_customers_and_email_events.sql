BEGIN;

-- Single-customer-view: one stitched record per person per tenant.
-- Source of truth that marketing tools (e.g. Mailchimp) sync from later.
CREATE TABLE IF NOT EXISTS customers (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  email text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  total_orders integer NOT NULL DEFAULT 0,
  total_spend_minor bigint NOT NULL DEFAULT 0,
  currency text,
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_utm_content text,
  first_utm_term text,
  subscribed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS customers_tenant_last_seen_idx ON customers (tenant_id, last_seen_at DESC);

-- Unified funnel timeline that stitches capture -> nudge -> purchase for one person.
CREATE TABLE IF NOT EXISTS email_events (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  email text NOT NULL,
  type text NOT NULL, -- cart_captured | nudge_sent | order_completed
  cart_email_id bigint REFERENCES cart_emails(id) ON DELETE SET NULL,
  order_id text REFERENCES orders(order_id) ON DELETE SET NULL,
  nudge_type text, -- nudge1 | nudge2 | winback (only for nudge_sent)
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_events_tenant_email_at_idx ON email_events (tenant_id, email, at DESC);
CREATE INDEX IF NOT EXISTS email_events_type_idx ON email_events (type);

-- Conversion attribution on the capture row: which purchase (and which nudge) won.
ALTER TABLE cart_emails
  ADD COLUMN IF NOT EXISTS converted_at timestamptz,
  ADD COLUMN IF NOT EXISTS converted_order_id text,
  ADD COLUMN IF NOT EXISTS last_nudge_type text;

COMMIT;

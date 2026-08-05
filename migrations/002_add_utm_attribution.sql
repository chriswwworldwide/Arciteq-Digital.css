BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text;

CREATE INDEX IF NOT EXISTS orders_utm_source_idx ON orders (utm_source);
CREATE INDEX IF NOT EXISTS orders_utm_campaign_idx ON orders (utm_campaign);

COMMIT;

BEGIN;

ALTER TABLE cart_emails
ADD COLUMN IF NOT EXISTS nudge_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_nudged_at timestamptz NOT NULL DEFAULT now();

COMMIT;

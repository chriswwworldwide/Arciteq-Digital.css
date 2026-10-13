BEGIN;

-- An event is "done" only once processing finished. Receipt alone no longer
-- counts, so a Stripe retry after a mid-processing failure re-runs the
-- first-time side effects instead of skipping them forever.
-- The backfill runs only at the moment the column is first added (this file
-- is re-applied on every server start), so it can never mark a genuinely
-- unprocessed event as done.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'stripe_events' AND column_name = 'processed_at'
  ) THEN
    ALTER TABLE stripe_events ADD COLUMN processed_at timestamptz;
    UPDATE stripe_events SET processed_at = created_at;
  END IF;
END $$;

COMMIT;

BEGIN;

-- Tenant-defined lead/onboarding answers, merged key-by-key on each capture.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMIT;

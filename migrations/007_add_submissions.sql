BEGIN;

-- Structured, repeatable customer submissions (race splits, pet weight logs,
-- surveys…). One row per submission; 'kind' is tenant-defined and whitelisted
-- in tenants.json (submissions.kinds). Payload keys are snake_case scalars.
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  email text NOT NULL,
  kind text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submissions_tenant_kind_idx ON submissions (tenant_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS submissions_tenant_email_idx ON submissions (tenant_id, lower(email));

-- Private, unguessable token so a customer can read back their own submissions
-- without a login. Issued once on first submission.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS access_token text;
CREATE UNIQUE INDEX IF NOT EXISTS customers_access_token_idx ON customers (access_token) WHERE access_token IS NOT NULL;

COMMIT;

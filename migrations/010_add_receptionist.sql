BEGIN;

-- AI phone receptionist for trades: one row per client business and one row
-- per answered call. Leads are texted to the owner; calls are listed on the
-- client's dashboard and summed into the weekly "calls caught" text.
CREATE TABLE IF NOT EXISTS receptionist_clients (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  business_name text NOT NULL,
  trade text,
  owner_name text,
  owner_mobile text NOT NULL,
  twilio_number text NOT NULL UNIQUE,
  website text,
  dashboard_token text NOT NULL,
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receptionist_calls (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES receptionist_clients(id) ON DELETE CASCADE,
  call_sid text NOT NULL UNIQUE,
  caller text,
  step text NOT NULL DEFAULT 'name',
  attempts int NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  emergency boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'in_progress',
  owner_notified_at timestamptz,
  caller_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS receptionist_calls_client_created_idx
  ON receptionist_calls (client_id, created_at DESC);

COMMIT;

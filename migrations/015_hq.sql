BEGIN;

-- Station 9 HQ: our own client book. One row per gym/coach we work with,
-- from first prospect to live client. tenant_id links to their site once
-- one exists (NULL for pure prospects).
-- stage: prospect | contacted | demo_sent | call_booked | won | live | paused | lost
-- lane:  replace | bolt_on
CREATE TABLE IF NOT EXISTS hq_gyms (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  coach text,
  city text,
  country text,
  tenant_id text,
  stage text NOT NULL DEFAULT 'prospect',
  lane text,
  score integer,
  currency text NOT NULL DEFAULT 'gbp',
  setup_fee_minor bigint,
  monthly_minor bigint,
  instagram text,
  whatsapp text,
  email text,
  website text,
  next_action text,
  next_action_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS hq_gyms_tenant_uidx
  ON hq_gyms (tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hq_gyms_stage_idx ON hq_gyms (stage);
CREATE INDEX IF NOT EXISTS hq_gyms_next_action_idx
  ON hq_gyms (next_action_at) WHERE next_action_at IS NOT NULL;

-- Timeline per gym: notes, DMs, calls, stage changes, payments.
-- kind: note | dm | call | email | meeting | stage | payment
CREATE TABLE IF NOT EXISTS hq_activity (
  id bigserial PRIMARY KEY,
  gym_id bigint NOT NULL REFERENCES hq_gyms(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  body text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hq_activity_gym_at_idx
  ON hq_activity (gym_id, at DESC);

-- Rollup lookups from HQ.
CREATE INDEX IF NOT EXISTS platform_payments_tenant_status_idx
  ON platform_payments (tenant_id, status);
CREATE INDEX IF NOT EXISTS cart_emails_tenant_created_idx
  ON cart_emails (tenant_id, created_at DESC);

COMMIT;

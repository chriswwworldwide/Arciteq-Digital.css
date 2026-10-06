BEGIN;

-- Published guides written by the fortnightly autopilot (or by hand through
-- the admin API). Stored in the database rather than the repo so a new guide
-- goes live without a redeploy. Rendered at <tenant guides.basePath><slug>/.
CREATE TABLE IF NOT EXISTS guides (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  eyebrow text,
  lead text,
  body_html text NOT NULL,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text,
  status text NOT NULL DEFAULT 'published',
  published_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS guides_tenant_published_idx ON guides (tenant_id, published_at DESC);

COMMIT;

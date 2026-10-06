BEGIN;

-- Anonymous, first-party page-view log. One row per view; no cookies, no IP,
-- no user agent. 'visitor' is a short daily-rotating hash the browser makes
-- itself (so "unique visitors today" is possible, cross-day tracking is not).
-- 'email' is only set when the visitor has already identified themselves on
-- this site (lead form / splits / wall) — that is what stitches "who has been
-- where" onto the customer record. Tenants opt in via tenants.json
-- (analytics.pageviews = true).
CREATE TABLE IF NOT EXISTS page_views (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  path text NOT NULL,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  visitor text,
  email text,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_views_tenant_at_idx ON page_views (tenant_id, at DESC);
CREATE INDEX IF NOT EXISTS page_views_tenant_email_idx ON page_views (tenant_id, lower(email)) WHERE email IS NOT NULL;

COMMIT;

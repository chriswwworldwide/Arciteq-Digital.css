// server/leads.js
// Leads and audience: email capture, form submissions (rate-limited,
// tenant-scoped), owner views of submissions, page-view analytics, and the
// coach desk traffic + people panels (desk-key scoped).

import {
  resolveTenantForPublicWrite,
  resolveTenantFromRequest,
} from "./tenancy.js";
import { normalizeEmail, isValidEmail } from "../src/data-stitch.js";
import { sanitizeProfile, hasProfile } from "../src/lead-profile.js";
import { dbQuery } from "../db.js";
import path from "path";
import fs from "node:fs";
import crypto from "node:crypto";
import { validateSubmission, summarizePayloads } from "../src/submissions.js";
import {
  pageviewsEnabled,
  validatePageview,
  summarizePageviews,
} from "../src/analytics.js";
import { rangeDays } from "./http-utils.js";
import { ROOT_DIR } from "./data-files.js";
import express from "express";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

export function createLeadsRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.post("/api/capture-email", async (req, res) => {
    try {
      const tenant = resolveTenantForPublicWrite(req, req.body?.tenant_id);
      const tenantId = String(tenant?.tenant_id || "default");
      const email = normalizeEmail(req.body?.email);
      const cart = Array.isArray(req.body?.cart) ? req.body.cart : [];
      const currency = String(tenant?.currency || "").toLowerCase() || null;
      const utm =
        req.body?.utm && typeof req.body.utm === "object" ? req.body.utm : {};
      const clean = (v) => String(v || "").trim() || null;
      const profile = sanitizeProfile(req.body?.profile);
      const message = String(req.body?.message || "")
        .trim()
        .slice(0, 1000);

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email" });
      }

      const captured = await dbQuery(
        "INSERT INTO cart_emails (tenant_id, email, cart) VALUES ($1, $2, $3::jsonb) RETURNING id",
        [tenantId, email, JSON.stringify(cart)],
      );
      const cartEmailId = Array.isArray(captured?.rows)
        ? captured.rows[0]?.id
        : null;

      // Data-stitch: upsert the single-customer-view record (first-touch UTM kept)
      // and log a unified funnel event tied to this capture.
      await dbQuery(
        "INSERT INTO customers (tenant_id, email, currency, subscribed, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content, first_utm_term, profile) VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9::jsonb) ON CONFLICT (tenant_id, email) DO UPDATE SET last_seen_at = now(), subscribed = true, currency = COALESCE(customers.currency, EXCLUDED.currency), first_utm_source = COALESCE(customers.first_utm_source, EXCLUDED.first_utm_source), first_utm_medium = COALESCE(customers.first_utm_medium, EXCLUDED.first_utm_medium), first_utm_campaign = COALESCE(customers.first_utm_campaign, EXCLUDED.first_utm_campaign), first_utm_content = COALESCE(customers.first_utm_content, EXCLUDED.first_utm_content), first_utm_term = COALESCE(customers.first_utm_term, EXCLUDED.first_utm_term), profile = customers.profile || EXCLUDED.profile, updated_at = now()",
        [
          tenantId,
          email,
          currency,
          clean(utm.utm_source),
          clean(utm.utm_medium),
          clean(utm.utm_campaign),
          clean(utm.utm_content),
          clean(utm.utm_term),
          JSON.stringify(profile),
        ],
      );

      const isLead = cart.length === 0 && (hasProfile(profile) || message);
      await dbQuery(
        "INSERT INTO email_events (tenant_id, email, type, cart_email_id, data) VALUES ($1, $2, $3, $4, $5::jsonb)",
        [
          tenantId,
          email,
          isLead ? "lead_captured" : "cart_captured",
          cartEmailId,
          JSON.stringify(
            isLead
              ? { profile, message, medium: clean(utm.utm_medium) }
              : { cartSize: cart.length },
          ),
        ],
      );

      return res.json({ ok: true });
    } catch (err) {
      console.error("Capture email failed", err);
      return res.status(500).json({ error: "Failed to capture email" });
    }
  });

  // Structured customer submissions (race splits, logs, surveys). Generic: the
  // tenant whitelists kinds in tenants.json → submissions.kinds. The response
  // carries the customer's private access token only when it was just issued or
  // when the caller already proved they hold it.
  router.post("/api/submissions", async (req, res) => {
    try {
      const tenant = resolveTenantForPublicWrite(req, req.body?.tenant_id);
      const tenantId = String(tenant?.tenant_id || "default");
      if (!ctx.submissionLimiter.check(`${tenantId}:${req.ip}`).ok) {
        return res
          .status(429)
          .json({ error: "Too many submissions — try again in a few minutes" });
      }
      const email = normalizeEmail(req.body?.email);
      if (!email || !isValidEmail(email)) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      // Warriors Wall photos travel as a top-level data URL — far bigger than
      // the payload cap. Decode it to a file under images/gallery/inbox/ and put
      // the public path in the payload instead (short enough to survive
      // sanitize limits); Dina reviews it on the desk before it joins the wall.
      const photoData = String(req.body?.photo || "");
      if (
        /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(photoData) &&
        req.body?.payload &&
        typeof req.body.payload === "object"
      ) {
        try {
          const buf = Buffer.from(photoData.split(",")[1], "base64");
          if (buf.length > 1024 && buf.length <= 4 * 1024 * 1024) {
            const dir = path.join(
              ROOT_DIR,
              "roxjaya",
              "images",
              "gallery",
              "inbox",
            );
            fs.mkdirSync(dir, { recursive: true });
            const name = `${crypto.randomUUID()}.jpg`;
            fs.writeFileSync(path.join(dir, name), buf);
            req.body.payload.photo = `/roxjaya/images/gallery/inbox/${name}`;
          }
        } catch (err) {
          console.error("Wall photo save failed", err);
        }
      }
      const checked = validateSubmission(tenant, req.body);
      if (checked.error) {
        if (checked.reason === "honeypot") return res.json({ ok: true });
        return res.status(400).json({ error: checked.error });
      }
      const suppliedToken = String(req.body?.token || "").trim() || null;

      const cust = await dbQuery(
        "INSERT INTO customers (tenant_id, email, subscribed, access_token) VALUES ($1, $2, false, $3) ON CONFLICT (tenant_id, email) DO UPDATE SET last_seen_at = now(), access_token = COALESCE(customers.access_token, EXCLUDED.access_token), updated_at = now() RETURNING access_token",
        [tenantId, email, crypto.randomBytes(16).toString("hex")],
      );
      const token = cust?.rows?.[0]?.access_token || null;

      const id = crypto.randomUUID();
      await dbQuery(
        "INSERT INTO submissions (id, tenant_id, email, kind, payload) VALUES ($1, $2, $3, $4, $5::jsonb)",
        [id, tenantId, email, checked.kind, JSON.stringify(checked.payload)],
      );
      await dbQuery(
        "INSERT INTO email_events (tenant_id, email, type, data) VALUES ($1, $2, $3, $4::jsonb)",
        [
          tenantId,
          email,
          "submission",
          JSON.stringify({ kind: checked.kind, submission_id: id }),
        ],
      );

      if (checked.kind === "partner_search") {
        try {
          ctx.queuePartnerCandidate({
            tenant,
            email,
            payload: checked.payload,
          });
        } catch (err) {
          console.error("Partner candidate failed", err);
        }
      }
      if (checked.kind === "travel_party") {
        try {
          ctx.queueTravelCandidate({ tenant, email, payload: checked.payload });
        } catch (err) {
          console.error("Travel candidate failed", err);
        }
      }

      const prior = await dbQuery(
        "SELECT count(*)::int AS n FROM submissions WHERE tenant_id = $1 AND lower(email) = lower($2) AND kind = $3",
        [tenantId, email, checked.kind],
      );
      const count = Number(prior?.rows?.[0]?.n || 1);
      const revealToken =
        count === 1 || (suppliedToken && suppliedToken === token);
      return res.json({
        ok: true,
        id,
        count,
        token: revealToken ? token : null,
      });
    } catch (err) {
      console.error("Submission failed", err);
      return res.status(500).json({ error: "Failed to save submission" });
    }
  });

  // A customer's own submissions, by private token.
  router.get("/api/submissions", async (req, res) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const tenantId = String(tenant?.tenant_id || "default");
      const token = String(req.query?.token || "").trim();
      const kind = String(req.query?.kind || "").trim();
      if (!token || !kind)
        return res.status(400).json({ error: "token and kind required" });
      const rows = await dbQuery(
        "SELECT s.id, s.payload, s.created_at FROM submissions s JOIN customers c ON c.tenant_id = s.tenant_id AND lower(c.email) = lower(s.email) WHERE c.tenant_id = $1 AND c.access_token = $2 AND s.kind = $3 ORDER BY s.created_at ASC LIMIT 200",
        [tenantId, token, kind],
      );
      if (!rows?.rows?.length)
        return res.status(404).json({ error: "Not found" });
      return res.json({ ok: true, items: rows.rows });
    } catch (err) {
      console.error("Submissions lookup failed", err);
      return res.status(500).json({ error: "Failed to load submissions" });
    }
  });

  // Anonymous per-field stats for a kind (median / quartiles), optionally
  // filtered by one string field via ?field=division&value=Women%20Open.
  router.get("/api/submissions/stats", async (req, res) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const tenantId = String(tenant?.tenant_id || "default");
      const kind = String(req.query?.kind || "").trim();
      if (!kind) return res.status(400).json({ error: "kind required" });
      const field = String(req.query?.field || "").trim();
      const value = String(req.query?.value || "").trim();
      const rows = await dbQuery(
        "SELECT payload FROM submissions WHERE tenant_id = $1 AND kind = $2 ORDER BY created_at DESC LIMIT 5000",
        [tenantId, kind],
      );
      const payloads = (rows?.rows || []).map((r) => r.payload);
      const stats = summarizePayloads(payloads, {
        filter: field && value ? { [field]: value } : null,
      });
      res.set("Cache-Control", "public, max-age=600");
      return res.json({ ok: true, ...stats });
    } catch (err) {
      console.error("Submission stats failed", err);
      return res.status(500).json({ error: "Failed to load stats" });
    }
  });

  // Cookie-free page-view beacon. Only for tenants with analytics.pageviews=true.
  // The browser sends path/referrer/utm and a self-made daily visitor hash;
  // 'token' (the customer's private submissions token) lets a returning,
  // already-identified athlete's views stitch onto their customer record.
  router.post("/api/pageview", async (req, res) => {
    try {
      const tenant = resolveTenantForPublicWrite(req, req.body?.tenant_id);
      if (!pageviewsEnabled(tenant)) return res.status(204).end();
      const tenantId = String(tenant?.tenant_id || "default");
      const checked = validatePageview(req.body, { ownHost: req.headers.host });
      if (checked.error) return res.status(400).json({ error: checked.error });
      const token = String(req.body?.token || "").trim();
      let email = null;
      if (/^[a-f0-9]{32}$/i.test(token)) {
        const c = await dbQuery(
          "SELECT email FROM customers WHERE tenant_id = $1 AND access_token = $2",
          [tenantId, token],
        );
        email = c?.rows?.[0]?.email || null;
      }
      const r = checked.row;
      await dbQuery(
        "INSERT INTO page_views (tenant_id, path, referrer_host, utm_source, utm_medium, utm_campaign, visitor, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          tenantId,
          r.path,
          r.referrer_host,
          r.utm_source,
          r.utm_medium,
          r.utm_campaign,
          r.visitor,
          email,
        ],
      );
      return res.status(204).end();
    } catch (err) {
      console.error("Pageview failed", err);
      return res.status(204).end();
    }
  });

  // Owner-facing traffic summary for the active tenant.
  router.get("/admin/traffic", async (req, res) => {
    try {
      const access = await ctx.requireDeskAccess(req, res);
      if (!access) return undefined;
      const tenant = access.tenant;
      const tenantId = String(tenant?.tenant_id || "default");
      const days = rangeDays(req);
      const rows = await dbQuery(
        "SELECT path, referrer_host, utm_source, visitor, email, at FROM page_views WHERE tenant_id = $1 AND at >= now() - ($2::int * interval '1 day') ORDER BY at DESC LIMIT 50000",
        [tenantId, days],
      );
      const summary = summarizePageviews(rows?.rows || [], { top: 15 });
      return res.json({ ok: true, tenant_id: tenantId, days, ...summary });
    } catch (err) {
      console.error("Traffic summary failed", err);
      return res.status(500).json({ error: "Failed to load traffic" });
    }
  });

  // Owner-facing "who has been where": every stitched person for the tenant with
  // their profile, submissions, orders/subscriptions and the pages they viewed
  // while identified. Consent basis: they gave us their email on this site.
  router.get("/admin/people", async (req, res) => {
    try {
      const access = await ctx.requireDeskAccess(req, res);
      if (!access) return undefined;
      const tenant = access.tenant;
      const tenantId = String(tenant?.tenant_id || "default");
      const days = rangeDays(req, 90);
      const limit = Math.min(
        Number.parseInt(String(req.query?.limit || "200"), 10) || 200,
        1000,
      );
      const people = await dbQuery(
        "SELECT email, first_seen_at, last_seen_at, total_orders, total_spend_minor, currency, first_utm_source, first_utm_medium, first_utm_campaign, subscribed, profile FROM customers WHERE tenant_id = $1 AND last_seen_at >= now() - ($2::int * interval '1 day') ORDER BY last_seen_at DESC LIMIT $3",
        [tenantId, days, limit],
      );
      const list = people?.rows || [];
      if (!list.length) {
        return res.json({ ok: true, tenant_id: tenantId, days, people: [] });
      }
      const emails = list.map((p) => String(p.email).toLowerCase());
      const [events, subs, views, activeSubs] = await Promise.all([
        dbQuery(
          "SELECT lower(email) AS email, type, data, at FROM email_events WHERE tenant_id = $1 AND lower(email) = ANY($2) ORDER BY at DESC LIMIT 5000",
          [tenantId, emails],
        ),
        dbQuery(
          "SELECT lower(email) AS email, kind, payload, created_at FROM submissions WHERE tenant_id = $1 AND lower(email) = ANY($2) ORDER BY created_at DESC LIMIT 5000",
          [tenantId, emails],
        ),
        dbQuery(
          "SELECT lower(email) AS email, path, count(*)::int AS views, max(at) AS last_at FROM page_views WHERE tenant_id = $1 AND lower(email) = ANY($2) GROUP BY 1, 2 ORDER BY last_at DESC LIMIT 5000",
          [tenantId, emails],
        ),
        dbQuery(
          "SELECT lower(customer_email) AS email, status, amount_minor, currency, current_period_end FROM subscriptions WHERE tenant_id = $1 AND lower(customer_email) = ANY($2)",
          [tenantId, emails],
        ),
      ]);
      const group = (rows) => {
        const m = new Map();
        for (const r of rows?.rows || []) {
          const k = r.email;
          if (!m.has(k)) m.set(k, []);
          m.get(k).push(r);
        }
        return m;
      };
      const ev = group(events);
      const sb = group(subs);
      const pv = group(views);
      const as = group(activeSubs);
      const out = list.map((p) => {
        const k = String(p.email).toLowerCase();
        return {
          email: p.email,
          first_seen_at: p.first_seen_at,
          last_seen_at: p.last_seen_at,
          total_orders: p.total_orders,
          total_spend_minor: p.total_spend_minor,
          currency: p.currency,
          source: p.first_utm_source || null,
          medium: p.first_utm_medium || null,
          campaign: p.first_utm_campaign || null,
          subscribed: p.subscribed,
          profile: p.profile || {},
          subscriptions: (as.get(k) || []).map(
            ({ email: _e, ...rest }) => rest,
          ),
          events: (ev.get(k) || []).map(({ email: _e, ...rest }) => rest),
          submissions: (sb.get(k) || []).map(({ email: _e, ...rest }) => rest),
          pages: (pv.get(k) || []).map(({ email: _e, ...rest }) => rest),
        };
      });
      return res.json({ ok: true, tenant_id: tenantId, days, people: out });
    } catch (err) {
      console.error("People summary failed", err);
      return res.status(500).json({ error: "Failed to load people" });
    }
  });
  return router;
}

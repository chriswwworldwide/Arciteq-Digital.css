// server/guides.js
// Database-backed SEO guides (written by the fortnightly autopilot): admin
// list/publish, the public /guides index + pages, and the per-site guide
// handlers that every coaching site mounts at /<site>/guides/.

import { dbQuery } from "../db.js";
import fs from "node:fs";
import path from "path";
import { requireAdmin, resolveTenantFromRequest } from "./tenancy.js";
import express from "express";
import {
  validateGuide,
  nearDuplicate,
  renderGuideIndex,
  renderGuidePage,
} from "../src/guides.js";
import crypto from "node:crypto";
import { ROOT_DIR } from "./data-files.js";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

// ---- Guides (database-backed, written by the fortnightly autopilot) ----
export function tenantGuides(tenant) {
  const g = tenant?.guides;
  if (!g || typeof g !== "object" || !g.basePath) return null;
  return { ...g, basePath: String(g.basePath).replace(/\/?$/, "/") };
}

let guidesTableReady = false;

async function ensureGuidesTable() {
  if (guidesTableReady) return;
  await dbQuery(
    fs.readFileSync(
      path.join(ROOT_DIR, "migrations", "009_add_guides.sql"),
      "utf8",
    ),
  );
  guidesTableReady = true;
}

export async function listGuides(tenantId) {
  await ensureGuidesTable();
  const r = await dbQuery(
    "SELECT id, slug, title, description, eyebrow, lead, body_html, faqs, source, published_at, updated_at FROM guides WHERE tenant_id = $1 AND status = 'published' ORDER BY published_at DESC",
    [tenantId],
  );
  return r?.rows || [];
}

export async function serveGuideIndex(req, res, next) {
  const tenant = resolveTenantFromRequest(req);
  const cfg = tenantGuides(tenant);
  if (!cfg || req.path.replace(/\/?$/, "/") !== cfg.basePath) return next();
  if (!req.path.endsWith("/")) return res.redirect(301, cfg.basePath);
  try {
    const guides = await listGuides(String(tenant.tenant_id));
    res.set("Cache-Control", "public, max-age=300");
    return res.type("html").send(renderGuideIndex(guides, cfg));
  } catch (err) {
    console.error("guide index failed", err);
    return next();
  }
}

export async function serveGuide(req, res, next) {
  const tenant = resolveTenantFromRequest(req);
  const cfg = tenantGuides(tenant);
  const slug = String(req.params.slug || "");
  if (!cfg || !/^[a-z0-9-]+$/.test(slug)) return next();
  if (!req.path.startsWith(cfg.basePath)) return next();
  if (!req.path.endsWith("/"))
    return res.redirect(301, `${cfg.basePath}${slug}/`);
  try {
    const guides = await listGuides(String(tenant.tenant_id));
    const guide = guides.find((g) => g.slug === slug);
    if (!guide) return next();
    res.set("Cache-Control", "public, max-age=300");
    return res.type("html").send(renderGuidePage(guide, cfg, guides));
  } catch (err) {
    console.error("guide page failed", err);
    return next();
  }
}

export function createGuidesRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.get("/admin/guides", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    const tenant = resolveTenantFromRequest(req);
    if (!tenantGuides(tenant))
      return res.status(404).json({ error: "Guides not enabled" });
    try {
      const guides = await listGuides(String(tenant.tenant_id));
      return res.json({ guides });
    } catch (err) {
      console.error("guides list failed", err);
      return res.status(500).json({ error: "Failed to list guides" });
    }
  });

  router.post(
    "/admin/guides",
    express.json({ limit: "512kb" }),
    async (req, res) => {
      const denied = requireAdmin(req, res);
      if (denied) return denied;
      const tenant = resolveTenantFromRequest(req);
      const cfg = tenantGuides(tenant);
      if (!cfg) return res.status(404).json({ error: "Guides not enabled" });
      const checked = validateGuide(req.body);
      if (checked.error) return res.status(400).json({ error: checked.error });
      const g = checked.guide;
      try {
        const tenantId = String(tenant.tenant_id);
        const existing = await listGuides(tenantId);
        const dup = nearDuplicate(
          g,
          existing.filter((e) => e.slug !== g.slug),
        );
        if (dup && !req.body?.force) {
          return res
            .status(409)
            .json({ error: `Too similar to ${dup.slug}`, score: dup.score });
        }
        await dbQuery(
          `INSERT INTO guides (id, tenant_id, slug, title, description, eyebrow, lead, body_html, faqs, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
         ON CONFLICT (tenant_id, slug) DO UPDATE SET
           title = EXCLUDED.title, description = EXCLUDED.description, eyebrow = EXCLUDED.eyebrow,
           lead = EXCLUDED.lead, body_html = EXCLUDED.body_html, faqs = EXCLUDED.faqs,
           source = EXCLUDED.source, status = 'published', updated_at = now()`,
          [
            crypto.randomUUID(),
            tenantId,
            g.slug,
            g.title,
            g.description,
            g.eyebrow,
            g.lead,
            g.body_html,
            JSON.stringify(g.faqs),
            g.source,
          ],
        );
        return res.json({
          ok: true,
          slug: g.slug,
          url: `${cfg.basePath}${g.slug}/`,
        });
      } catch (err) {
        console.error("guide save failed", err);
        return res.status(500).json({ error: "Failed to save guide" });
      }
    },
  );

  router.get("/guides", serveGuideIndex);

  router.get("/guides/:slug", serveGuide);
  return router;
}

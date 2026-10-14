// server/sites.js
// Coaching site tenants (roxjaya + reskins): /<site>/ → <site>/index.html,
// /<site>/money/ (the owner's Money page), /<site>/guides/, and
// /<site>/<page>/ → <site>/<page>.html. Registered per tenant, directly on
// the app (not a router) so a demo slug can never shadow platform routes and
// route order stays exactly as before.

import fs from "node:fs";
import path from "node:path";
import { ROOT_DIR, loadTenantsData } from "./data-files.js";
import { renderDeskMoney } from "./desk-money.js";
import { serveGuide, serveGuideIndex } from "./guides.js";

export function registerSiteRoutes(app) {
  for (const siteTenant of loadTenantsData().list.filter(
    (t) => t?.vertical === "coaching",
  )) {
    const site = String(siteTenant.tenant_id || "");
    if (
      !/^[a-z0-9-]+$/.test(site) ||
      !fs.existsSync(path.join(ROOT_DIR, site, "index.html"))
    )
      continue;
    app.get(`/${site}`, (req, res) => {
      res.sendFile(path.join(ROOT_DIR, site, "index.html"));
    });
    app.get(`/${site}/money`, (req, res) => {
      if (!req.path.endsWith("/")) return res.redirect(301, `/${site}/money/`);
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      return res.type("html").send(renderDeskMoney(siteTenant));
    });
    app.get(`/${site}/guides`, serveGuideIndex);
    app.get(`/${site}/guides/:slug`, serveGuide);
    app.get(`/${site}/:slug`, (req, res, next) => {
      const slug = String(req.params.slug || "");
      if (!/^[a-z0-9-]+$/.test(slug)) return next();
      const file = path.join(ROOT_DIR, site, `${slug}.html`);
      if (!fs.existsSync(file)) return next();
      if (!req.path.endsWith("/")) return res.redirect(301, `/${site}/${slug}/`);
      res.sendFile(file);
    });
  }
}

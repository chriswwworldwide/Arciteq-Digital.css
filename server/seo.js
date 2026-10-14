// server/seo.js
// Crawlable storefront pages: pet-safety collection page, niche category
// pages (/:nicheCategorySlug), the admin page gate, per-tenant sitemap.xml
// (products + guides) and robots.txt.

import { resolveTenantFromRequest } from "./tenancy.js";
import path from "path";
import { loadTenantsData, loadProductsData, ROOT_DIR } from "./data-files.js";
import { xmlEscape } from "../src/product-utils.js";
import { tenantGuides, listGuides } from "./guides.js";
import express from "express";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

export function createSeoRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.get("/pet-safety-essentials", (req, res, next) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const allowedNiches = Array.isArray(tenant?.catalog?.nicheCategorySlugs)
        ? tenant.catalog.nicheCategorySlugs.map((s) =>
            String(s || "").toLowerCase(),
          )
        : null;
      if (allowedNiches && allowedNiches.length > 0) {
        if (!allowedNiches.includes("pet-safety-essentials")) {
          return res.status(404).type("text/plain").send("Not found");
        }
      }

      return res.sendFile(path.join(ROOT_DIR, "collection.html"), (err) => {
        if (!err) return;
        console.error("/pet-safety-essentials sendFile failed", err);
        if (res.headersSent) return;
        return res
          .status(500)
          .type("text/plain")
          .send("Failed to render collection");
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get("/pet-safety-essentials/", (req, res, next) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const allowedNiches = Array.isArray(tenant?.catalog?.nicheCategorySlugs)
        ? tenant.catalog.nicheCategorySlugs.map((s) =>
            String(s || "").toLowerCase(),
          )
        : null;
      if (allowedNiches && allowedNiches.length > 0) {
        if (!allowedNiches.includes("pet-safety-essentials")) {
          return res.status(404).type("text/plain").send("Not found");
        }
      }

      return res.sendFile(path.join(ROOT_DIR, "collection.html"), (err) => {
        if (!err) return;
        console.error("/pet-safety-essentials/ sendFile failed", err);
        if (res.headersSent) return;
        return res
          .status(500)
          .type("text/plain")
          .send("Failed to render collection");
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get("/:nicheCategorySlug", (req, res, next) => {
    try {
      const nicheCategorySlug = String(
        req.params.nicheCategorySlug || "",
      ).trim();
      if (!nicheCategorySlug) return next();
      if (nicheCategorySlug.includes(".")) return next();

      const blocked = new Set([
        "admin",
        "api",
        "themes",
        "images",
        "images2",
        "js",
        "public",
        "data",
        "health",
        "stripe",
        "sitemap.xml",
        "robots.txt",
        "roxjaya",
        "hq",
      ]);
      // Coaching site tenants get their own /<site>/ routes — never collections.
      for (const t of loadTenantsData().list) {
        if (t?.vertical === "coaching") blocked.add(String(t.tenant_id));
      }
      if (blocked.has(nicheCategorySlug.toLowerCase())) return next();

      const tenant = resolveTenantFromRequest(req);
      const allowedNiches = Array.isArray(tenant?.catalog?.nicheCategorySlugs)
        ? tenant.catalog.nicheCategorySlugs.map((s) =>
            String(s || "").toLowerCase(),
          )
        : null;
      if (allowedNiches && allowedNiches.length > 0) {
        if (!allowedNiches.includes(nicheCategorySlug.toLowerCase())) {
          return res.status(404).type("text/plain").send("Not found");
        }
      }

      return res.sendFile(path.join(ROOT_DIR, "collection.html"), (err) => {
        if (!err) return;
        console.error("/:nicheCategorySlug sendFile failed", err);
        if (res.headersSent) return;
        return res
          .status(500)
          .type("text/plain")
          .send("Failed to render collection");
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get("/admin.html", (req, res) => {
    const nodeEnv = String(process.env.NODE_ENV || "").toLowerCase();
    if (nodeEnv === "production") {
      return res.status(404).send("Not found");
    }

    return res.sendFile(path.join(ROOT_DIR, "admin.html"));
  });

  router.get("/sitemap.xml", async (req, res) => {
    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");
      const host = req.get("host");
      const baseUrl = host
        ? `${req.protocol}://${host}`
        : ctx.publicBaseUrl || "http://localhost:3000";
      const allowedNiches = Array.isArray(tenant?.catalog?.nicheCategorySlugs)
        ? tenant.catalog.nicheCategorySlugs.map((s) =>
            String(s || "").toLowerCase(),
          )
        : null;
      const allowedProductTypes = Array.isArray(
        tenant?.catalog?.productTypeSlugs,
      )
        ? tenant.catalog.productTypeSlugs.map((s) =>
            String(s || "").toLowerCase(),
          )
        : null;
      const productsData = loadProductsData();
      const productUrls = (productsData.list || [])
        .filter((p) => String(p?.tenant_id || "default") === activeTenantId)
        .filter((p) => {
          if (!allowedNiches) return true;
          return allowedNiches.includes(
            String(p?.nicheCategory?.slug || "").toLowerCase(),
          );
        })
        .filter((p) => {
          if (!allowedProductTypes) return true;
          return allowedProductTypes.includes(
            String(p?.productType?.slug || "").toLowerCase(),
          );
        })
        .map((p) => {
          const canonicalPath = String(p?.seo?.canonicalPath || "/").replace(
            /^\/+/,
            "/",
          );
          const loc = `${baseUrl}${canonicalPath}`;
          const lastmod = String(p?.updatedAt || p?.createdAt || "").slice(
            0,
            10,
          );
          const lastmodXml = lastmod
            ? `<lastmod>${xmlEscape(lastmod)}</lastmod>`
            : "";
          return `  <url><loc>${xmlEscape(loc)}</loc><changefreq>weekly</changefreq><priority>0.8</priority>${lastmodXml}</url>`;
        })
        .join("\n");
      const tenantStaticPages = Array.isArray(tenant?.seo?.staticPages)
        ? tenant.seo.staticPages
            .map((p) => ({
              path: String(p?.path || "").trim(),
              priority: String(p?.priority || "0.8"),
            }))
            .filter((p) => p.path.startsWith("/"))
        : null;
      const staticUrls = tenantStaticPages || [
        { path: "/", priority: "1.0" },
        { path: "/shop.html", priority: "0.9" },
        { path: "/content/senior-dog-mobility.html", priority: "0.85" },
        { path: "/content/night-walk-safety-for-dogs.html", priority: "0.85" },
        { path: "/content/senior-cat-comfort.html", priority: "0.85" },
        {
          path: "/content/gps-tracker-vs-bluetooth-tag.html",
          priority: "0.85",
        },
        { path: "/content/pet-camera-buying-guide.html", priority: "0.85" },
      ];
      const staticXml = staticUrls
        .map(
          (u) =>
            `  <url><loc>${xmlEscape(baseUrl + u.path)}</loc><changefreq>weekly</changefreq><priority>${xmlEscape(u.priority)}</priority></url>`,
        )
        .join("\n");
      let guideXml = "";
      const guideCfg = tenantGuides(tenant);
      if (guideCfg) {
        try {
          guideXml = (await listGuides(activeTenantId))
            .map((g) => {
              // pg returns JS Dates — String(date).slice(0,10) yields the
              // invalid "Tue Oct 06"; sitemap lastmod must be ISO YYYY-MM-DD
              const d = g.updated_at || g.published_at;
              const dd = d ? new Date(d) : null;
              const lastmod =
                dd && !isNaN(dd) ? dd.toISOString().slice(0, 10) : "";
              return `  <url><loc>${xmlEscape(baseUrl + guideCfg.basePath + g.slug + "/")}</loc><changefreq>monthly</changefreq><priority>0.8</priority><lastmod>${xmlEscape(lastmod)}</lastmod></url>`;
            })
            .join("\n");
        } catch (err) {
          console.error("sitemap guides failed", err);
        }
      }
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticXml}\n${productUrls}\n${guideXml}\n</urlset>`;
      res.set("Content-Type", "application/xml");
      res.send(xml);
    } catch (err) {
      console.error("sitemap.xml failed", err);
      res.status(500).type("text/plain").send("Failed to generate sitemap");
    }
  });

  router.get("/robots.txt", (req, res) => {
    const host = req.get("host");
    const baseUrl = host
      ? `${req.protocol}://${host}`
      : ctx.publicBaseUrl || "http://localhost:3000";
    const text = [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /cart.html",
      "",
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join("\n");
    res.set("Content-Type", "text/plain");
    res.send(text);
  });
  return router;
}

// server/middleware.js
// App-wide request middleware, in the order server.js mounts them:
// canonical host redirect → 5xx tracking → cache policy → static files
// (with the private-file guard). Each factory returns a plain middleware.

import express from "express";
import { isPrivateStaticPath } from "../src/static-guard.js";
import { resolveTenantFromRequest } from "./tenancy.js";

// Per-tenant canonical host: a tenant with `canonicalHost` set (e.g.
// "roxjaya.com") 301s every other hostname it owns (www.) to it, so Google
// sees one URL per page instead of splitting the ranking signal.
export function canonicalHostRedirect() {
  return (req, res, next) => {
    const hostname = String(req.headers.host || "")
      .split(":")[0]
      .toLowerCase();
    if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost"))
      return next();
    const tenant = resolveTenantFromRequest(req);
    const canonicalHost = String(tenant?.canonicalHost || "").toLowerCase();
    if (!canonicalHost || hostname === canonicalHost) return next();
    const proto =
      req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    return res.redirect(301, `${proto}://${canonicalHost}${req.originalUrl}`);
  };
}

// Records 5xx responses from the last 15 minutes into `recentServerErrors`
// (the ops engine raises an alert on a spike).
export function trackServerErrors(recentServerErrors) {
  return (req, res, next) => {
    res.on("finish", () => {
      try {
        const code = Number(res.statusCode);
        if (Number.isFinite(code) && code >= 500) {
          recentServerErrors.push({
            at: Date.now(),
            path: String(req.originalUrl || req.url || ""),
          });
        }
        const cutoff = Date.now() - 15 * 60 * 1000;
        while (
          recentServerErrors.length > 0 &&
          Number(recentServerErrors[0]?.at || 0) < cutoff
        ) {
          recentServerErrors.shift();
        }
      } catch {
        // ignore
      }
    });
    next();
  };
}

// Cache policy: HTML/API stay uncached (fresh content after deploys); static
// assets get a short cache + ETag revalidation so repeat views don't
// re-download styles, scripts and images on every visit.
const STATIC_ASSET_RE =
  /\.(css|js|png|jpe?g|webp|avif|svg|ico|woff2?|mp4|webm|json)$/i;
export function cachePolicy() {
  return (req, res, next) => {
    if (STATIC_ASSET_RE.test(req.path)) {
      res.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    } else {
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, private",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    next();
  };
}

// Serve the site's public files (HTML, CSS, JS, images, etc.). The default
// index.html behaviour is off so the explicit "/" route can redirect.
// Private files (server code, docs, migrations, ops ledgers, internal data)
// skip the static handler entirely and fall through to the routes / 404.
export function staticFiles(rootDir) {
  const serveStatic = express.static(rootDir, { index: false });
  return (req, res, next) => {
    let pathName = req.path;
    try {
      pathName = decodeURIComponent(req.path);
    } catch {
      return next();
    }
    if (isPrivateStaticPath(pathName)) return next();
    return serveStatic(req, res, next);
  };
}

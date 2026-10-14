// server.js — Express local preview for index.html
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import fs from "node:fs";
import { dbQuery } from "./db.js";
import { isPrivateStaticPath } from "./src/static-guard.js";
import { loadTenantsData, safeReadJsonFile } from "./server/data-files.js";
import { requireAdmin, resolveTenantFromRequest, resolveTenantForPublicWrite } from "./server/tenancy.js";
import { renderDeskMoney } from "./server/desk-money.js";
import { ensureCommerceTables } from "./server/commerce.js";
import { exceptionsFilePath, startHeartbeatScheduler, attachOpsState } from "./server/ops.js";
import { createStripeWebhookHandler } from "./server/stripe-webhook.js";
import { createReceptionistRouter } from "./server/receptionist.js";
import { createAdminOpsRouter } from "./server/admin-ops.js";
import { createGuidesRouter, serveGuide, serveGuideIndex } from "./server/guides.js";
import { createCatalogRouter } from "./server/catalog.js";
import { createLeadsRouter } from "./server/leads.js";
import { createInboxRouter, queuePartnerCandidate, queueSponsorCandidates, queueTravelCandidate, renewSponsor, startDigestScheduler } from "./server/inbox.js";
import { createAdminBillingRouter } from "./server/admin-billing.js";
import { createAdminOrdersRouter } from "./server/admin-orders.js";
import { createSeoRouter } from "./server/seo.js";
import { createShopRouter } from "./server/shop.js";
import { createCheckoutRouter } from "./server/checkout.js";
import { createHealthRouter } from "./server/health.js";
import { createProductPagesRouter } from "./server/product-pages.js";
import { createHqRouter } from "./server/hq.js";
import { createDeskAuth } from "./server/desk-auth.js";
import { createAccountsRouter } from "./server/accounts.js";
import { createRateLimiter } from "./src/submissions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const submissionLimiter = createRateLimiter({
  max: 10,
  windowMs: 10 * 60 * 1000,
});
const accountLinkLimiter = createRateLimiter({
  max: 3,
  windowMs: 15 * 60 * 1000,
});

dotenv.config({ path: path.join(__dirname, ".env.local") });

// NOTE: for local tests, ADMIN_API_KEY is expected to come from .env.local
const adminApiKey = String(process.env.ADMIN_API_KEY || "").trim();

console.log(
  "env check:",
  "ADMIN_API_KEY=",
  Boolean(String(process.env.ADMIN_API_KEY || "").trim()),
  "DATABASE_URL=",
  Boolean(String(process.env.DATABASE_URL || "").trim()),
);

const app = express();
app.set("trust proxy", 1);

// Per-tenant canonical host: a tenant with `canonicalHost` set (e.g.
// "roxjaya.com") 301s every other hostname it owns (www.) to it, so Google
// sees one URL per page instead of splitting the ranking signal.
app.use((req, res, next) => {
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
});

const PORT = process.env.PORT || 3000;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const stripeWebhookSecret = String(
  process.env.STRIPE_WEBHOOK_SECRET || "",
).trim();
// Stripe Tax requires the account to have the Tax capability enabled —
// flip on once the merchant account activates it.
const automaticTaxEnabled =
  String(process.env.STRIPE_AUTOMATIC_TAX || "").trim() === "1";
const alertEmailTo = String(process.env.ALERT_EMAIL_TO || "").trim();
const alertHeartbeatMinutesRaw = Number(process.env.ALERT_HEARTBEAT_MINUTES);
const alertHeartbeatMinutes =
  Number.isFinite(alertHeartbeatMinutesRaw) && alertHeartbeatMinutesRaw > 0
    ? alertHeartbeatMinutesRaw
    : 5;
const publicBaseUrl = String(process.env.PUBLIC_BASE_URL || "").trim();

const recentServerErrors = [];
app.use((req, res, next) => {
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
});

const heartbeatState = {
  startedAt: new Date().toISOString(),
  intervalMinutes: alertHeartbeatMinutes,
  lastRunAt: "",
  lastOk: null,
  lastError: "",
  lastCreatedCount: 0,
};
// Link live state into the ops engine (alerts, sweep, heartbeat).
attachOpsState({ heartbeatState, recentServerErrors });

app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  createStripeWebhookHandler({
    stripe,
    stripeWebhookSecret,
    queueSponsorCandidates,
    renewSponsor,
  }),
);

app.use(
  createAdminOpsRouter({
    alertEmailTo,
    heartbeatState,
  }),
);

app.use(express.json({ limit: "2mb" }));

// Desk access (coach desks + Money page): platform admin key → any site
// (by ?tenant= or the desk page path); a per-site desk key → that site only.
const requireDeskAccess = createDeskAuth({
  dbQuery,
  adminApiKey,
  ensureTables: ensureCommerceTables,
  loadTenants: () => loadTenantsData().list,
  resolveTenantFromPage: (req) => resolveTenantForPublicWrite(req, null),
});

// Cache policy: HTML/API stay uncached (fresh content after deploys); static
// assets get a short cache + ETag revalidation so repeat views don't
// re-download styles, scripts and images on every visit.
const STATIC_ASSET_RE =
  /\.(css|js|png|jpe?g|webp|avif|svg|ico|woff2?|mp4|webm|json)$/i;
app.use((req, res, next) => {
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
});

app.use(
  createSeoRouter({
    publicBaseUrl,
  }),
);

// Serve the site's public files (HTML, CSS, JS, images, etc.)
// Disable the default index.html behavior so our explicit "/" route can redirect.
// Private files (server code, docs, migrations, ops ledgers, internal data)
// skip the static handler entirely and fall through to the routes / 404.
const serveStatic = express.static(__dirname, { index: false });
app.use((req, res, next) => {
  let pathName = req.path;
  try {
    pathName = decodeURIComponent(req.path);
  } catch {
    return next();
  }
  if (isPrivateStaticPath(pathName)) return next();
  return serveStatic(req, res, next);
});

app.get("/health", (req, res) => {
  return res.json({ ok: true });
});

app.use(
  createShopRouter({
    accountLinkLimiter,
    stripe,
  }),
);

// When you visit http://localhost:3000/, send users to the store entry point.
// The old landing page remains available at /index.html.
app.get("/", (req, res) => {
  const tenant = resolveTenantFromRequest(req);
  if (tenant.vertical === "coaching" || tenant.tenant_id === "roxjaya")
    return res.redirect(301, `/${tenant.tenant_id}/`);
  return res.redirect(302, "/shop.html");
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Site tenants (roxjaya + reskin demos): /<site>/ -> <site>/index.html.
// Registered per tenant so demo slugs can't shadow platform routes.
for (const siteTenant of loadTenantsData().list.filter(
  (t) => t?.vertical === "coaching",
)) {
  const site = String(siteTenant.tenant_id || "");
  if (
    !/^[a-z0-9-]+$/.test(site) ||
    !fs.existsSync(path.join(__dirname, site, "index.html"))
  )
    continue;
  app.get(`/${site}`, (req, res) => {
    res.sendFile(path.join(__dirname, site, "index.html"));
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
    const file = path.join(__dirname, site, `${slug}.html`);
    if (!fs.existsSync(file)) return next();
    if (!req.path.endsWith("/")) return res.redirect(301, `/${site}/${slug}/`);
    res.sendFile(file);
  });
}

app.use(
  createReceptionistRouter({}),
);

app.use(
  createGuidesRouter({}),
);

app.use(
  createCatalogRouter({}),
);

app.use(
  createLeadsRouter({
    queuePartnerCandidate,
    queueTravelCandidate,
    requireDeskAccess,
    submissionLimiter,
  }),
);

// ---- Owner inbox (approval queue) + weekly digest -------------------------
// Tenant opts in via tenants.json → automation: { inbox: "<file>",
// writable: ["<file>", ...], coachPath: "/x/coach/", digestTo: "a@b" }.
// Automated jobs POST candidates; the owner approves/ignores from their desk;
// approving applies the item's JSON patches to the tenant's writable files only.

app.use(
  createInboxRouter({
    alertEmailTo,
    publicBaseUrl,
    requireDeskAccess,
  }),
);

app.use(
  createHealthRouter({}),
);

app.use(
  createProductPagesRouter({}),
);

app.use(
  createAdminBillingRouter({}),
);

// Station 9 HQ — internal control panel (pipeline, contacts, money, site
// health). API in server/hq.js; page at /hq.
app.use(
  createHqRouter({
    dbQuery,
    requireAdmin,
    ensureTables: ensureCommerceTables,
    loadTenants: () => loadTenantsData().list,
    readExceptions: () => {
      const store = safeReadJsonFile(exceptionsFilePath, { exceptions: [] });
      return Array.isArray(store?.exceptions) ? store.exceptions : [];
    },
  }),
);

// Coach/gym books (Money page API). Desk-key scoped; see server/accounts.js.
app.use(
  createAccountsRouter({
    dbQuery,
    requireDeskAccess,
    ensureTables: ensureCommerceTables,
  }),
);

app.get("/hq", (req, res) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return res.sendFile(path.join(__dirname, "hq.html"));
});

app.use(
  createAdminOrdersRouter({
    stripe,
  }),
);

app.use(
  createCheckoutRouter({
    PORT,
    automaticTaxEnabled,
    stripe,
  }),
);

app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}/`);
  startHeartbeatScheduler();
  startDigestScheduler();
});

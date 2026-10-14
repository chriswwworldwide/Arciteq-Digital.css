// server.js — the platform's wiring: settings, then middleware and route
// modules mounted in the exact order requests must meet them. All logic
// lives in server/ (routes, engines) and src/ (pure, tested helpers).
// ORDER MATTERS: Express matches top to bottom. tools/verify-refactor.sh
// snapshots the full route order — run it after touching this file.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import dotenv from "dotenv";
import { dbQuery } from "./db.js";
import { createRateLimiter } from "./src/submissions.js";
import { loadTenantsData, safeReadJsonFile } from "./server/data-files.js";
import {
  requireAdmin,
  resolveTenantFromRequest,
  resolveTenantForPublicWrite,
} from "./server/tenancy.js";
import { ensureCommerceTables } from "./server/commerce.js";
import {
  attachOpsState,
  exceptionsFilePath,
  startHeartbeatScheduler,
} from "./server/ops.js";
import {
  cachePolicy,
  canonicalHostRedirect,
  staticFiles,
  trackServerErrors,
} from "./server/middleware.js";
import { registerSiteRoutes } from "./server/sites.js";
import { createStripeWebhookHandler } from "./server/stripe-webhook.js";
import { createAdminOpsRouter } from "./server/admin-ops.js";
import { createSeoRouter } from "./server/seo.js";
import { createShopRouter } from "./server/shop.js";
import { createReceptionistRouter } from "./server/receptionist.js";
import { createGuidesRouter } from "./server/guides.js";
import { createCatalogRouter } from "./server/catalog.js";
import { createLeadsRouter } from "./server/leads.js";
import {
  createInboxRouter,
  queuePartnerCandidate,
  queueSponsorCandidates,
  queueTravelCandidate,
  renewSponsor,
  startDigestScheduler,
} from "./server/inbox.js";
import { createHealthRouter } from "./server/health.js";
import { createProductPagesRouter } from "./server/product-pages.js";
import { createAdminBillingRouter } from "./server/admin-billing.js";
import { createHqRouter } from "./server/hq.js";
import { createDeskAuth } from "./server/desk-auth.js";
import { createAccountsRouter } from "./server/accounts.js";
import { createAdminOrdersRouter } from "./server/admin-orders.js";
import { createCheckoutRouter } from "./server/checkout.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Settings (.env.local). Modules read settings at call time; values
// passed to modules below are read here, after this line. -----------------
dotenv.config({ path: path.join(__dirname, ".env.local") });

const PORT = process.env.PORT || 3000;
// NOTE: for local tests, ADMIN_API_KEY is expected to come from .env.local
const adminApiKey = String(process.env.ADMIN_API_KEY || "").trim();
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

console.log(
  "env check:",
  "ADMIN_API_KEY=",
  Boolean(adminApiKey),
  "DATABASE_URL=",
  Boolean(String(process.env.DATABASE_URL || "").trim()),
);

// ---- Shared live state --------------------------------------------------
const submissionLimiter = createRateLimiter({
  max: 10,
  windowMs: 10 * 60 * 1000,
});
const accountLinkLimiter = createRateLimiter({
  max: 3,
  windowMs: 15 * 60 * 1000,
});
const recentServerErrors = [];
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

// Desk access (coach desks + Money page): platform admin key → any site
// (by ?tenant= or the desk page path); a per-site desk key → that site only.
const requireDeskAccess = createDeskAuth({
  dbQuery,
  adminApiKey,
  ensureTables: ensureCommerceTables,
  loadTenants: () => loadTenantsData().list,
  resolveTenantFromPage: (req) => resolveTenantForPublicWrite(req, null),
});

// ---- App ------------------------------------------------------------------
const app = express();
app.set("trust proxy", 1);

app.use(canonicalHostRedirect());
app.use(trackServerErrors(recentServerErrors));

// Stripe needs the raw body for signature checks: before the JSON parser.
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
app.use(createAdminOpsRouter({ alertEmailTo, heartbeatState }));

app.use(express.json({ limit: "2mb" }));
app.use(cachePolicy());
app.use(createSeoRouter({ publicBaseUrl }));
app.use(staticFiles(__dirname));

app.get("/health", (req, res) => {
  return res.json({ ok: true });
});
app.use(createShopRouter({ accountLinkLimiter, stripe }));

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

registerSiteRoutes(app);

app.use(createReceptionistRouter({}));
app.use(createGuidesRouter({}));
app.use(createCatalogRouter({}));
app.use(
  createLeadsRouter({
    queuePartnerCandidate,
    queueTravelCandidate,
    requireDeskAccess,
    submissionLimiter,
  }),
);
// Owner inbox (approval queue) + weekly digest. Tenant opts in via
// tenants.json → automation: { inbox, writable, coachPath, digestTo }.
app.use(createInboxRouter({ alertEmailTo, publicBaseUrl, requireDeskAccess }));
app.use(createHealthRouter({}));
app.use(createProductPagesRouter({}));
app.use(createAdminBillingRouter({}));

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

app.use(createAdminOrdersRouter({ stripe }));
app.use(createCheckoutRouter({ PORT, automaticTaxEnabled, stripe }));

app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}/`);
  startHeartbeatScheduler();
  startDigestScheduler();
});

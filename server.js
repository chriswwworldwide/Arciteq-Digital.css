// server.js — Express local preview for index.html
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import fs from "node:fs";
import crypto from "node:crypto";
import { dbQuery } from "./db.js";
import { isRecurringProduct } from "./src/catalog-qa.js";
import { isPrivateStaticPath } from "./src/static-guard.js";
import {
  loadProductsData,
  loadReviewsData,
  loadTenantsData,
  safeReadJsonFile,
} from "./server/data-files.js";
import { requireAdmin, resolveTenantFromRequest, resolveTenantForPublicWrite } from "./server/tenancy.js";
import { renderDeskMoney } from "./server/desk-money.js";
import {
  ensureCommerceTables,
  seedInventory,
  reserveStock,
  releaseReservation,
} from "./server/commerce.js";
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

app.get("/api/health", (req, res) => {
  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const allowedNiches = Array.isArray(tenant?.catalog?.nicheCategorySlugs)
      ? tenant.catalog.nicheCategorySlugs.map((s) =>
          String(s || "").toLowerCase(),
        )
      : null;
    const allowedProductTypes = Array.isArray(tenant?.catalog?.productTypeSlugs)
      ? tenant.catalog.productTypeSlugs.map((s) =>
          String(s || "").toLowerCase(),
        )
      : null;

    let productsData = { list: [], generatedAt: "" };
    try {
      productsData = loadProductsData();
    } catch {
      productsData = { list: [], generatedAt: "" };
    }

    let reviewsData = { list: [], generatedAt: "" };
    try {
      reviewsData = loadReviewsData();
    } catch {
      reviewsData = { list: [], generatedAt: "" };
    }

    const tenantProducts = Array.isArray(productsData?.list)
      ? productsData.list
          .filter((p) => String(p?.tenant_id || "default") === activeTenantId)
          .filter((p) => {
            if (!allowedNiches || allowedNiches.length === 0) return true;
            const slug = String(p?.nicheCategory?.slug || "").toLowerCase();
            return allowedNiches.includes(slug);
          })
          .filter((p) => {
            if (!allowedProductTypes || allowedProductTypes.length === 0)
              return true;
            const slug = String(p?.productType?.slug || "").toLowerCase();
            return allowedProductTypes.includes(slug);
          })
      : [];

    const tenantReviews = Array.isArray(reviewsData?.list)
      ? reviewsData.list.filter(
          (r) => String(r?.tenant_id || "default") === activeTenantId,
        )
      : [];

    const canonicalCount = tenantProducts.filter((p) => {
      const cp = String(p?.seo?.canonicalPath || "");
      return Boolean(cp);
    }).length;

    const canonicalCoveragePercent = tenantProducts.length
      ? Math.round((canonicalCount / tenantProducts.length) * 100)
      : 0;

    const warnings = [];
    if (tenantProducts.length === 0) warnings.push("No products loaded");
    if (tenantProducts.length > 0 && canonicalCoveragePercent < 100) {
      warnings.push("Some products are missing seo.canonicalPath");
    }

    return res.json({
      tenant: {
        tenant_id: activeTenantId,
      },
      products: {
        count: tenantProducts.length,
        generatedAt: String(productsData?.generatedAt || ""),
      },
      reviews: {
        count: tenantReviews.length,
        generatedAt: String(reviewsData?.generatedAt || ""),
      },
      seo: {
        canonicalCoveragePercent,
      },
      warnings,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to compute health" });
  }
});


app.get("/:nicheCategorySlug/:productSlug", (req, res, next) => {
  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const nicheCategorySlug = String(req.params.nicheCategorySlug || "");
    const productSlug = String(req.params.productSlug || "");

    if (nicheCategorySlug.toLowerCase() === "admin") return next();

    const allowedNiches = Array.isArray(tenant?.catalog?.nicheCategorySlugs)
      ? tenant.catalog.nicheCategorySlugs.map((s) =>
          String(s || "").toLowerCase(),
        )
      : null;
    const allowedProductTypes = Array.isArray(tenant?.catalog?.productTypeSlugs)
      ? tenant.catalog.productTypeSlugs.map((s) =>
          String(s || "").toLowerCase(),
        )
      : null;
    if (
      allowedNiches &&
      allowedNiches.length > 0 &&
      !allowedNiches.includes(nicheCategorySlug.toLowerCase())
    ) {
      return res.status(404).type("text/plain").send("Not found");
    }

    const { list } = loadProductsData();
    const product = list.find((p) => {
      if (String(p?.tenant_id || "default") !== activeTenantId) return false;
      if (String(p?.nicheCategory?.slug || "") !== nicheCategorySlug)
        return false;

      const canonicalSlug = String(p?.seo?.slug || "");
      const legacySlugs = Array.isArray(p?.seo?.legacySlugs)
        ? p.seo.legacySlugs.map(String)
        : [];

      return canonicalSlug === productSlug || legacySlugs.includes(productSlug);
    });

    if (
      product &&
      allowedProductTypes &&
      allowedProductTypes.length > 0 &&
      !allowedProductTypes.includes(
        String(product?.productType?.slug || "").toLowerCase(),
      )
    ) {
      return res.status(404).type("text/plain").send("Not found");
    }

    if (!product) return next();

    const canonicalPath = String(product?.seo?.canonicalPath || "");
    if (canonicalPath && canonicalPath !== req.path) {
      return res.redirect(301, canonicalPath);
    }

    return res.sendFile(path.join(__dirname, "product.html"));
  } catch (err) {
    return next(err);
  }
});

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

app.post("/create-checkout-session", async (req, res) => {
  try {
    const requestTenant = resolveTenantForPublicWrite(req, req.body?.tenant_id);
    if (String(requestTenant?.shop?.status || "") === "opening-soon") {
      return res
        .status(403)
        .json({ error: "This shop is not open for orders yet." });
    }

    if (!stripe) {
      return res.status(500).json({
        error: "STRIPE_SECRET_KEY is not set on the server",
      });
    }

    const { items, tenant_id, customer_email, utm } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided" });
    }

    const cleanUtm = (value) => {
      const s = String(value || "").trim();
      if (!s) return "";
      return s.length > 120 ? s.slice(0, 120) : s;
    };
    const utmObj = utm && typeof utm === "object" ? utm : {};
    const utmSource = cleanUtm(utmObj?.utm_source);
    const utmMedium = cleanUtm(utmObj?.utm_medium);
    const utmCampaign = cleanUtm(utmObj?.utm_campaign);
    const utmContent = cleanUtm(utmObj?.utm_content);
    const utmTerm = cleanUtm(utmObj?.utm_term);

    const rawCustomerEmail = String(customer_email || "").trim();
    const customerEmail = rawCustomerEmail?.includes("@")
      ? rawCustomerEmail
      : "";

    const resolvedTenant = resolveTenantForPublicWrite(req, tenant_id);
    const resolvedTenantId = String(resolvedTenant?.tenant_id || "default");
    const expectedCurrency = String(
      resolvedTenant?.currency || "",
    ).toLowerCase();
    if (!expectedCurrency) {
      return res
        .status(400)
        .json({ error: "Tenant currency is not configured" });
    }

    const allowedNiches = Array.isArray(
      resolvedTenant?.catalog?.nicheCategorySlugs,
    )
      ? resolvedTenant.catalog.nicheCategorySlugs
          .map((s) => String(s || "").toLowerCase())
          .filter(Boolean)
      : null;
    const allowedProductTypes = Array.isArray(
      resolvedTenant?.catalog?.productTypeSlugs,
    )
      ? resolvedTenant.catalog.productTypeSlugs
          .map((s) => String(s || "").toLowerCase())
          .filter(Boolean)
      : null;

    const activeTenantId = String(tenant_id || "default");
    if (activeTenantId !== resolvedTenantId) {
      return res.status(400).json({
        error: "Tenant mismatch for checkout session",
      });
    }
    const { byId } = loadProductsData();

    const normalizedItems = items.map((item) => {
      const productId = String(item?.id || "");
      const product = byId.get(productId);
      if (!product) {
        throw new Error(`Unknown productId: ${productId}`);
      }

      if (String(product?.tenant_id || "default") !== activeTenantId) {
        throw new Error(`Product not available for tenant: ${productId}`);
      }

      if (allowedNiches && allowedNiches.length > 0) {
        const nicheSlug = String(
          product?.nicheCategory?.slug || "",
        ).toLowerCase();
        if (!allowedNiches.includes(nicheSlug)) {
          throw new Error(
            `Product not available for tenant catalog: ${productId}`,
          );
        }
      }

      if (allowedProductTypes && allowedProductTypes.length > 0) {
        const typeSlug = String(product?.productType?.slug || "").toLowerCase();
        if (!allowedProductTypes.includes(typeSlug)) {
          throw new Error(
            `Product not available for tenant catalog: ${productId}`,
          );
        }
      }

      const unitAmount = Number(product?.price?.amount);
      if (!Number.isInteger(unitAmount) || unitAmount < 0) {
        throw new Error(`Invalid price.amount for productId: ${productId}`);
      }

      const currency = String(product?.price?.currency || "").toLowerCase();
      if (!currency) {
        throw new Error(`Missing price.currency for productId: ${productId}`);
      }

      if (currency !== expectedCurrency) {
        throw new Error(
          `Currency mismatch for productId: ${productId} (expected ${expectedCurrency}, got ${currency})`,
        );
      }

      const quantity = Number(item.quantity) || 1;
      const recurring = isRecurringProduct(product)
        ? {
            interval: String(product.billing.interval).toLowerCase(),
            interval_count: Number.isInteger(product.billing.intervalCount)
              ? product.billing.intervalCount
              : 1,
          }
        : null;
      return {
        productId,
        title: String(product?.title || "Product"),
        unitAmount,
        currency,
        quantity,
        recurring,
      };
    });

    const recurringCount = normalizedItems.filter((it) => it.recurring).length;
    if (recurringCount > 0 && recurringCount !== normalizedItems.length) {
      throw new Error(
        "Mixed cart: recurring plans must be checked out separately from one-off items",
      );
    }
    const checkoutMode = recurringCount > 0 ? "subscription" : "payment";

    const line_items = normalizedItems.map((it) => {
      return {
        price_data: {
          currency: it.currency,
          product_data: {
            name: it.title,
          },
          unit_amount: it.unitAmount,
          // UK consumer prices are quoted VAT-inclusive; Stripe Tax nets it out.
          ...(automaticTaxEnabled ? { tax_behavior: "inclusive" } : {}),
          ...(it.recurring ? { recurring: it.recurring } : {}),
        },
        quantity: it.quantity,
      };
    });

    const amountSubtotal = normalizedItems.reduce(
      (sum, it) =>
        sum + (Number(it?.unitAmount) || 0) * (Number(it?.quantity) || 0),
      0,
    );
    const amountTotal = amountSubtotal;

    const origin = req.headers.origin || `http://localhost:${PORT}`;

    const orderId = crypto.randomUUID();
    await seedInventory(activeTenantId);
    await reserveStock(activeTenantId, normalizedItems, orderId);
    // Anything failing after the reservation must hand the stock back —
    // Stripe will never fire a webhook for a session that was never created.
    try {
      await dbQuery(
        "INSERT INTO orders (order_id, tenant_id, status, currency, amount_subtotal, amount_total, customer_email, items, utm_source, utm_medium, utm_campaign, utm_content, utm_term) VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), $8::jsonb, NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''))",
        [
          orderId,
          activeTenantId,
          "pending",
          expectedCurrency,
          amountSubtotal,
          amountTotal,
          customerEmail,
          JSON.stringify(normalizedItems),
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          utmTerm,
        ],
      );
      await dbQuery(
        "INSERT INTO order_events (order_id, type, data) VALUES ($1, $2, $3::jsonb)",
        [
          orderId,
          "checkout_initiated",
          JSON.stringify({
            origin,
            customerEmail,
            utm: {
              utm_source: utmSource,
              utm_medium: utmMedium,
              utm_campaign: utmCampaign,
              utm_content: utmContent,
              utm_term: utmTerm,
            },
          }),
        ],
      );

    const rawPaymentMethods = String(
      process.env.STRIPE_PAYMENT_METHODS || "card",
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const paymentMethodTypes =
      rawPaymentMethods.length > 0 ? rawPaymentMethods : ["card"];

    const sessionMetadata = {
      order_id: orderId,
      tenant_id: activeTenantId,
      customer_email: customerEmail || "",
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
    };

    const session = await stripe.checkout.sessions.create({
      mode: checkoutMode,
      payment_method_types: paymentMethodTypes,
      line_items,
      allow_promotion_codes: true,
      ...(automaticTaxEnabled ? { automatic_tax: { enabled: true } } : {}),
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${origin}/checkout/cancel?order_id=${orderId}`,
      customer_email: customerEmail || undefined,
      client_reference_id: orderId,
      metadata: sessionMetadata,
      // Copy the metadata onto the subscription so renewal invoices can be
      // attributed back to the originating order + tenant.
      ...(checkoutMode === "subscription"
        ? { subscription_data: { metadata: sessionMetadata } }
        : {}),
    });

      await dbQuery(
        "UPDATE orders SET stripe_checkout_session_id = $1, updated_at = now() WHERE order_id = $2",
        [String(session?.id || ""), orderId],
      );
      await dbQuery(
        "INSERT INTO order_events (order_id, type, data) VALUES ($1, $2, $3::jsonb)",
        [
          orderId,
          "stripe_session_created",
          JSON.stringify({
            sessionId: String(session?.id || ""),
            mode: checkoutMode,
          }),
        ],
      );
    } catch (innerErr) {
      await releaseReservation(activeTenantId, orderId, "restore").catch(
        (relErr) =>
          console.error("stock release after checkout failure failed", relErr),
      );
      throw innerErr;
    }

    return res.json({ sessionUrl: session.url });
  } catch (err) {
    const message = String(err?.message || "Failed to create session");
    const stripeType = String(err?.type || "");
    const stripeCode = String(err?.code || "");
    const stripeRequestId = String(err?.requestId || err?.request_id || "");

    console.error("/create-checkout-session failed", {
      message,
      stripeType: stripeType || undefined,
      stripeCode: stripeCode || undefined,
      stripeRequestId: stripeRequestId || undefined,
    });

    const clientErrorPrefixes = [
      "No items provided",
      "Unknown productId:",
      "Product not available for tenant:",
      "Product not available for tenant catalog:",
      "Invalid price.amount for productId:",
      "Missing price.currency for productId:",
      "Currency mismatch for productId:",
      "Tenant mismatch for checkout session",
      "Mixed cart:",
    ];

    const isClientError = clientErrorPrefixes.some((p) =>
      message.startsWith(p),
    );
    if (isClientError) {
      return res.status(400).json({ error: message });
    }
    if (Number.isInteger(err?.statusCode)) {
      return res.status(err.statusCode).json({ error: message });
    }

    const looksLikeStripeError = Boolean(stripeType || stripeCode);
    const safeMessage = looksLikeStripeError
      ? "Checkout temporarily unavailable. Please try again."
      : "Checkout failed. Please try again.";

    return res.status(500).json({ error: safeMessage });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}/`);
  startHeartbeatScheduler();
  startDigestScheduler();
});

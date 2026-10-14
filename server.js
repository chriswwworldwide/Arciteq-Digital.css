// server.js — Express local preview for index.html
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import fs from "node:fs";
import crypto from "node:crypto";
import { dbQuery } from "./db.js";
import { normalizeEmail } from "./src/data-stitch.js";
import { getBaseUrl, xmlEscape } from "./src/product-utils.js";
import { isRecurringProduct } from "./src/catalog-qa.js";
import { isPrivateStaticPath } from "./src/static-guard.js";
import {
  loadProductsData,
  loadReviewsData,
  loadTenantsData,
  safeReadJsonFile,
  safeWriteJsonFile,
} from "./server/data-files.js";
import {
  sendViaResend,
  sendAlertEmail,
  sendOrderShippedNotice,
} from "./server/email.js";
import {
  requireAdmin,
  resolveTenantFromRequest,
  resolveTenantForPublicWrite,
  trustedBaseUrlForTenant,
} from "./server/tenancy.js";
import { renderDeskMoney } from "./server/desk-money.js";
import {
  ensureCommerceTables,
  seedInventory,
  stockFor,
  moveStock,
  reserveStock,
  releaseReservation,
  renderAccountPage,
  ensureAccountToken,
} from "./server/commerce.js";
import { exceptionsFilePath, startHeartbeatScheduler, attachOpsState } from "./server/ops.js";
import { createStripeWebhookHandler } from "./server/stripe-webhook.js";
import { createReceptionistRouter } from "./server/receptionist.js";
import {
  rangeDays,
} from "./server/http-utils.js";
import { createAdminOpsRouter } from "./server/admin-ops.js";
import { createGuidesRouter, listGuides, serveGuide, serveGuideIndex, tenantGuides } from "./server/guides.js";
import { createCatalogRouter } from "./server/catalog.js";
import { createLeadsRouter } from "./server/leads.js";
import { createHqRouter } from "./server/hq.js";
import { createDeskAuth } from "./server/desk-auth.js";
import { createAccountsRouter } from "./server/accounts.js";
import { createRateLimiter } from "./src/submissions.js";
import {
  emptyInbox,
  normalizeInbox,
  upsertCandidates,
  pendingItems,
  decide,
  applyEdits,
  applyPatches,
  buildDigest,
  autoApprove,
} from "./src/inbox.js";
import {
  sponsorItems,
  sanitizeSponsor,
  buildSponsorCandidate,
  extendPartner,
  addDays,
} from "./src/sponsors.js";
import { buildPartnerCandidate, buildTravelCandidate } from "./src/match.js";
import { summarizePageviews } from "./src/analytics.js";

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

app.get("/pet-safety-essentials", (req, res, next) => {
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

    return res.sendFile(path.join(__dirname, "collection.html"), (err) => {
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

app.get("/pet-safety-essentials/", (req, res, next) => {
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

    return res.sendFile(path.join(__dirname, "collection.html"), (err) => {
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

app.get("/:nicheCategorySlug", (req, res, next) => {
  try {
    const nicheCategorySlug = String(req.params.nicheCategorySlug || "").trim();
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

    return res.sendFile(path.join(__dirname, "collection.html"), (err) => {
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

app.get("/admin.html", (req, res) => {
  const nodeEnv = String(process.env.NODE_ENV || "").toLowerCase();
  if (nodeEnv === "production") {
    return res.status(404).send("Not found");
  }

  return res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");
    const host = req.get("host");
    const baseUrl = host
      ? `${req.protocol}://${host}`
      : publicBaseUrl || "http://localhost:3000";
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
        const lastmod = String(p?.updatedAt || p?.createdAt || "").slice(0, 10);
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
      { path: "/content/gps-tracker-vs-bluetooth-tag.html", priority: "0.85" },
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

app.get("/robots.txt", (req, res) => {
  const host = req.get("host");
  const baseUrl = host
    ? `${req.protocol}://${host}`
    : publicBaseUrl || "http://localhost:3000";
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

app.post("/checkout/cancel", express.json(), async (req, res) => {
  try {
    const orderId = String(req.body?.order_id || "").trim();
    if (!orderId) {
      return res.status(400).json({ error: "Missing order_id" });
    }

    const update = await dbQuery(
      "UPDATE orders SET status = 'abandoned', updated_at = now() WHERE order_id = $1 AND status = 'pending' RETURNING order_id, tenant_id",
      [orderId],
    );

    const updated = Array.isArray(update?.rows) && update.rows.length > 0;
    if (updated) {
      await dbQuery(
        "INSERT INTO order_events (order_id, type, data) SELECT $1, $2, $3::jsonb WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND type = $2)",
        [
          orderId,
          "checkout_cancelled",
          JSON.stringify({ at: new Date().toISOString() }),
        ],
      );
      try {
        await ensureCommerceTables();
        await releaseReservation(
          String(update.rows[0].tenant_id || "default"),
          orderId,
          "restore",
        );
      } catch (invErr) {
        console.error("stock restore on cancel failed", invErr);
      }
    }

    return res.json({ ok: true, updated });
  } catch (err) {
    console.error("/checkout/cancel failed", err);
    return res.status(500).json({ error: "Failed to mark checkout cancelled" });
  }
});

app.get("/checkout/cancel", async (req, res) => {
  try {
    const orderId = String(req.query?.order_id || "").trim();
    if (orderId) {
      const update = await dbQuery(
        "UPDATE orders SET status = 'abandoned', updated_at = now() WHERE order_id = $1 AND status = 'pending' RETURNING order_id, tenant_id",
        [orderId],
      );

      const updated = Array.isArray(update?.rows) && update.rows.length > 0;
      if (updated) {
        await dbQuery(
          "INSERT INTO order_events (order_id, type, data) SELECT $1, $2, $3::jsonb WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND type = $2)",
          [
            orderId,
            "checkout_cancelled",
            JSON.stringify({ at: new Date().toISOString() }),
          ],
        );
        try {
          await ensureCommerceTables();
          await releaseReservation(
            String(update.rows[0].tenant_id || "default"),
            orderId,
            "restore",
          );
        } catch (invErr) {
          console.error("stock restore on cancel failed", invErr);
        }
      }
    }

    return res.redirect(302, "/cart.html");
  } catch (err) {
    console.error("GET /checkout/cancel failed", err);
    return res.redirect(302, "/cart.html");
  }
});

// ---- Storefront stock: /api/stock?ids=a,b,c ------------------------------
app.get("/api/stock", async (req, res) => {
  try {
    const tenant = resolveTenantFromRequest(req);
    const tenantId = String(
      req.query?.tenant_id || tenant?.tenant_id || "default",
    );
    await seedInventory(tenantId);
    const ids = String(req.query?.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    const r = ids.length
      ? await dbQuery(
          "SELECT product_id, stock FROM inventory WHERE tenant_id = $1 AND product_id = ANY($2)",
          [tenantId, ids],
        )
      : await dbQuery(
          "SELECT product_id, stock FROM inventory WHERE tenant_id = $1",
          [tenantId],
        );
    const stock = {};
    for (const row of r?.rows || []) stock[row.product_id] = row.stock;
    return res.json({ stock });
  } catch (err) {
    console.error("/api/stock failed", err);
    return res.status(500).json({ error: "Stock lookup failed" });
  }
});

// ---- Admin: discount codes via Stripe coupons + promotion codes ----------
app.post("/admin/discounts", express.json(), async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;
  try {
    if (!stripe) {
      return res.status(500).json({ error: "STRIPE_SECRET_KEY is not set" });
    }
    const code = String(req.body?.code || "")
      .trim()
      .toUpperCase();
    const percentOff = Number(req.body?.percent_off) || null;
    const amountOff = Number.isInteger(req.body?.amount_off)
      ? req.body.amount_off
      : null;
    const currency = String(req.body?.currency || "gbp").toLowerCase();
    if (!code || (!percentOff && !amountOff)) {
      return res.status(400).json({
        error: "Provide code plus percent_off or amount_off (minor units)",
      });
    }
    const coupon = await stripe.coupons.create({
      ...(percentOff ? { percent_off: percentOff } : {}),
      ...(amountOff ? { amount_off: amountOff, currency } : {}),
      duration: "once",
      name: code,
    });
    const promo = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code,
    });
    return res.json({ ok: true, code: promo.code, couponId: coupon.id });
  } catch (err) {
    console.error("/admin/discounts failed", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
});

// ---- Admin: inventory levels ----------------------------------------------
app.get("/admin/inventory", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;
  try {
    const tenantId = String(req.query?.tenant_id || "default");
    await seedInventory(tenantId);
    const r = await dbQuery(
      "SELECT product_id, stock, updated_at FROM inventory WHERE tenant_id = $1 ORDER BY product_id",
      [tenantId],
    );
    return res.json({ inventory: r?.rows || [] });
  } catch (err) {
    console.error("/admin/inventory failed", err);
    return res.status(500).json({ error: "Inventory lookup failed" });
  }
});

app.post("/admin/inventory", express.json(), async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;
  try {
    const tenantId = String(req.body?.tenant_id || "default");
    const productId = String(req.body?.product_id || "").trim();
    const stock = req.body?.stock;
    const adjust = Number.isInteger(req.body?.adjust) ? req.body.adjust : null;
    if (!productId || (!Number.isInteger(stock) && adjust === null)) {
      return res
        .status(400)
        .json({ error: "Provide product_id plus stock (absolute) or adjust" });
    }
    await ensureCommerceTables();
    if (Number.isInteger(stock)) {
      await dbQuery(
        "INSERT INTO inventory (tenant_id, product_id, stock) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, product_id) DO UPDATE SET stock = $3, updated_at = now()",
        [tenantId, productId, stock],
      );
      await dbQuery(
        "INSERT INTO inventory_movements (tenant_id, product_id, delta, reason) VALUES ($1, $2, $3, 'manual')",
        [tenantId, productId, stock],
      );
    } else {
      await moveStock(tenantId, productId, adjust, "manual", null);
    }
    const level = await stockFor(tenantId, productId);
    return res.json({ ok: true, product_id: productId, stock: level });
  } catch (err) {
    console.error("POST /admin/inventory failed", err);
    return res.status(500).json({ error: "Inventory update failed" });
  }
});

// ---- Customer account pages (private token, order history) -----------------
app.get("/account/:token", async (req, res) => {
  try {
    await ensureCommerceTables();
    const token = String(req.params.token || "").slice(0, 120);
    const c = await dbQuery(
      "SELECT tenant_id, email, total_orders, total_spend_minor, currency FROM customers WHERE account_token = $1 LIMIT 1",
      [token],
    );
    const customer = c?.rows?.[0];
    if (!customer) {
      return res.status(404).type("text/plain").send("Account not found");
    }
    const orders =
      (
        await dbQuery(
          "SELECT order_id, status, currency, amount_total, amount_discount, amount_tax, items, created_at FROM orders WHERE tenant_id = $1 AND customer_email = $2 AND status = 'paid' ORDER BY created_at DESC LIMIT 100",
          [customer.tenant_id, customer.email],
        )
      )?.rows || [];
    res.setHeader("X-Robots-Tag", "noindex");
    return res.type("html").send(renderAccountPage(customer, orders));
  } catch (err) {
    console.error("/account failed", err);
    return res.status(500).type("text/plain").send("Account unavailable");
  }
});

// Request the account link by email — always 200 so it can't probe accounts.
// The link's domain comes from server config (tenant hostname or
// PUBLIC_BASE_URL), never from request headers, so it can't be pointed at
// an attacker's site; rate-limited per IP and per address.
app.post("/api/account/link", express.json(), async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const tenantId = String(req.body?.tenant_id || "default");
    const allowed =
      accountLinkLimiter.check(`ip:${req.ip}`).ok &&
      (!email || accountLinkLimiter.check(`email:${email}`).ok);
    if (email && allowed) {
      await ensureCommerceTables();
      const known = await dbQuery(
        "SELECT 1 FROM customers WHERE tenant_id = $1 AND email = $2",
        [tenantId, email],
      );
      const token =
        known?.rowCount > 0 ? await ensureAccountToken(tenantId, email) : null;
      if (token) {
        await sendViaResend({
          to: email,
          subject: "Your account link",
          body: `Your orders and account: ${trustedBaseUrlForTenant(tenantId)}/account/${token}\n\nKeep this link private — it's your sign-in.`,
        });
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("/api/account/link failed", err);
    return res.json({ ok: true });
  }
});

app.get("/admin/env", (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  return res.json({
    ok: true,
    nodeEnv: String(process.env.NODE_ENV || ""),
    has: {
      adminApiKey: Boolean(String(process.env.ADMIN_API_KEY || "").trim()),
      databaseUrl: Boolean(String(process.env.DATABASE_URL || "").trim()),
      stripeSecretKey: Boolean(
        String(process.env.STRIPE_SECRET_KEY || "").trim(),
      ),
      stripePublishableKey: Boolean(
        String(process.env.STRIPE_PUBLISHABLE_KEY || "").trim(),
      ),
      stripeWebhookSecret: Boolean(
        String(process.env.STRIPE_WEBHOOK_SECRET || "").trim(),
      ),
    },
  });
});

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

function tenantAutomation(tenant) {
  const a = tenant?.automation;
  const rel = String(a?.inbox || "").trim();
  if (!rel || rel.includes("..") || rel.startsWith("/")) return null;
  return {
    inboxRel: rel,
    inboxPath: path.join(__dirname, rel),
    writable: Array.isArray(a?.writable)
      ? a.writable.map(String).filter((f) => !f.includes(".."))
      : [],
    coachPath: String(a?.coachPath || "/"),
    digestTo: String(a?.digestTo || "").trim(),
    digestDayUtc: Number.isInteger(a?.digestDayUtc) ? a.digestDayUtc : 1,
    digestHourUtc: Number.isInteger(a?.digestHourUtc) ? a.digestHourUtc : 0,
    welcomePath: String(a?.welcomePath || "").trim(),
    welcomeIntro: String(a?.welcomeIntro || "").trim(),
    autoApprove:
      a?.autoApprove === true
        ? true
        : Array.isArray(a?.autoApprove)
          ? a.autoApprove.map(String)
          : [],
  };
}

// Owner-free mode: approve pending items of the configured kinds straight
// away and apply their patches. Decisions stay in the inbox for audit.
function runAutoApprove(cfg, inbox) {
  const kinds = cfg.autoApprove;
  if (kinds !== true && !(Array.isArray(kinds) && kinds.length)) return inbox;
  const { inbox: next } = autoApprove(inbox, kinds, (item) => {
    if (item.kind === "sponsor") {
      const check = sanitizeSponsor(item.apply?.[0]?.value);
      if (check.error)
        return { applied: [], skipped: [{ reason: check.error }] };
    }
    return applyPatches(item, {
      allowedFiles: cfg.writable,
      readJson: (rel) => safeReadJsonFile(path.join(__dirname, rel), null),
      writeJson: (rel, json) =>
        safeWriteJsonFile(path.join(__dirname, rel), json),
    });
  });
  return next;
}

function readInbox(cfg) {
  return normalizeInbox(safeReadJsonFile(cfg.inboxPath, emptyInbox()));
}

function tenantById(tenantId) {
  try {
    return (
      loadTenantsData().list.find(
        (t) => String(t?.tenant_id || "default") === String(tenantId),
      ) || null
    );
  } catch {
    return null;
  }
}

// Sponsorship rails: a paid order containing sponsor-slot products drops a
// `sponsor` candidate into the tenant's inbox (owner approves before anything
// shows). Sponsor details come from the buyer's latest `sponsor` submission.
async function queueSponsorCandidates({ tenantId, orderId, email }) {
  const tenant = tenantById(tenantId);
  const cfg = tenantAutomation(tenant);
  const partnersFile = String(tenant?.automation?.partners || "").trim();
  if (!cfg || !partnersFile || !cfg.writable.includes(partnersFile)) return;
  const order = await dbQuery(
    "SELECT items, customer_email FROM orders WHERE order_id = $1",
    [orderId],
  );
  const row = order?.rows?.[0];
  if (!row) return;
  const { byId } = loadProductsData();
  const products = sponsorItems(row.items, byId);
  if (!products.length) return;
  const buyer = email || normalizeEmail(row.customer_email);
  const sub = buyer
    ? await dbQuery(
        "SELECT payload FROM submissions WHERE tenant_id = $1 AND lower(email) = lower($2) AND kind = 'sponsor' ORDER BY created_at DESC LIMIT 1",
        [tenantId, buyer],
      )
    : null;
  const raw = sub?.rows?.[0]?.payload || {};
  const checked = sanitizeSponsor(raw);
  const sponsor = checked.sponsor || {
    name: String(raw?.name || buyer || "Sponsor").slice(0, 60),
    url: "",
    logo: "",
    tagline: "",
  };
  const candidates = products
    .map((product) =>
      buildSponsorCandidate({
        orderId,
        email: buyer,
        product,
        sponsor,
        until: addDays(new Date(), 31),
        partnersFile,
      }),
    )
    .filter(Boolean);
  if (!candidates.length) return;
  const { inbox } = upsertCandidates(readInbox(cfg), candidates);
  safeWriteJsonFile(cfg.inboxPath, runAutoApprove(cfg, inbox));
}

// Partner matching: a `partner_search` submission queues a `partner`
// candidate so the owner approves a sanitised board card. Contact details
// stay in the inbox data (desk only); intros happen over WhatsApp.
function queuePartnerCandidate({ tenant, email, payload }) {
  const cfg = tenantAutomation(tenant);
  const boardFile = String(tenant?.automation?.matchboard || "").trim();
  if (!cfg || !boardFile || !cfg.writable.includes(boardFile)) return;
  const candidate = buildPartnerCandidate({ email, payload, boardFile });
  if (!candidate) return;
  const { inbox } = upsertCandidates(readInbox(cfg), [candidate]);
  safeWriteJsonFile(cfg.inboxPath, runAutoApprove(cfg, inbox));
}

// Travel board: a `travel_party` submission queues a `travel` candidate —
// same pattern as partner cards: approve prepends a sanitised public row.
function queueTravelCandidate({ tenant, email, payload }) {
  const cfg = tenantAutomation(tenant);
  const boardFile = String(tenant?.automation?.travelboard || "").trim();
  if (!cfg || !boardFile || !cfg.writable.includes(boardFile)) return;
  const candidate = buildTravelCandidate({ email, payload, boardFile });
  if (!candidate) return;
  const { inbox } = upsertCandidates(readInbox(cfg), [candidate]);
  safeWriteJsonFile(cfg.inboxPath, runAutoApprove(cfg, inbox));
}

// Renewal paid: push the live partner's `until` forward. No owner step —
// they already approved this sponsor.
function renewSponsor({ tenantId, orderId, periodEnd }) {
  if (!orderId) return;
  const tenant = tenantById(tenantId);
  const partnersFile = String(tenant?.automation?.partners || "").trim();
  if (!partnersFile || partnersFile.includes("..")) return;
  const abs = path.join(__dirname, partnersFile);
  const json = safeReadJsonFile(abs, null);
  if (!json) return;
  const until = periodEnd
    ? String(periodEnd).slice(0, 10)
    : addDays(new Date(), 31);
  if (extendPartner(json, orderId, until)) safeWriteJsonFile(abs, json);
}

app.get("/admin/inbox", async (req, res) => {
  const access = await requireDeskAccess(req, res).catch(() => {
    res.status(500).json({ error: "Desk access check failed" });
    return null;
  });
  if (!access) return undefined;
  const tenant = access.tenant;
  const cfg = tenantAutomation(tenant);
  if (!cfg) return res.status(404).json({ error: "Inbox not enabled" });
  const inbox = readInbox(cfg);
  const decided = inbox.items
    .filter((i) => i.status !== "pending")
    .sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt)))
    .slice(0, 50);
  return res.json({
    ok: true,
    tenant_id: String(tenant?.tenant_id || "default"),
    updatedAt: inbox.updatedAt,
    pending: pendingItems(inbox),
    decided,
  });
});

app.post("/admin/inbox", express.json({ limit: "512kb" }), (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;
  const tenant = resolveTenantFromRequest(req);
  const cfg = tenantAutomation(tenant);
  if (!cfg) return res.status(404).json({ error: "Inbox not enabled" });
  const candidates = Array.isArray(req.body?.candidates)
    ? req.body.candidates.slice(0, 200)
    : [];
  try {
    const {
      inbox: merged,
      added,
      updated,
    } = upsertCandidates(readInbox(cfg), candidates);
    const inbox = runAutoApprove(cfg, merged);
    safeWriteJsonFile(cfg.inboxPath, inbox);
    return res.json({
      ok: true,
      added,
      updated,
      pending: pendingItems(inbox).length,
    });
  } catch (err) {
    console.error("Inbox upsert failed", err);
    return res.status(500).json({ error: "Failed to save inbox" });
  }
});

app.post("/admin/inbox/:id", express.json(), async (req, res) => {
  const access = await requireDeskAccess(req, res).catch(() => {
    res.status(500).json({ error: "Desk access check failed" });
    return null;
  });
  if (!access) return undefined;
  const tenant = access.tenant;
  const cfg = tenantAutomation(tenant);
  if (!cfg) return res.status(404).json({ error: "Inbox not enabled" });
  const action = String(req.body?.action || "").toLowerCase();
  try {
    const result = decide(readInbox(cfg), req.params.id, action);
    if (result.error) return res.status(400).json({ error: result.error });
    let applied = { applied: [], skipped: [] };
    if (action === "approve") {
      applyEdits(result.item, req.body?.edits);
      if (result.item.kind === "news" && !result.item.summary) {
        return res
          .status(400)
          .json({ error: "Write a short summary before publishing" });
      }
      if (result.item.kind === "sponsor") {
        const p = result.item.apply?.[0]?.value;
        const check = sanitizeSponsor(p);
        if (check.error) {
          return res
            .status(400)
            .json({ error: `${check.error} — fix it above, then approve` });
        }
      }
      applied = applyPatches(result.item, {
        allowedFiles: cfg.writable,
        readJson: (rel) => safeReadJsonFile(path.join(__dirname, rel), null),
        writeJson: (rel, json) =>
          safeWriteJsonFile(path.join(__dirname, rel), json),
      });
      result.item.applied = applied;
    }
    safeWriteJsonFile(cfg.inboxPath, result.inbox);
    return res.json({ ok: true, item: result.item, ...applied });
  } catch (err) {
    console.error("Inbox decision failed", err);
    return res.status(500).json({ error: "Failed to update inbox" });
  }
});

// Everything that needs the owner this week, as an action list with deep
// links into their desk. DB counts degrade to zero when no DB is configured.
function siteUrlFromRequest(req) {
  const proto = String(
    req.headers["x-forwarded-proto"] || req.protocol || "https",
  );
  const host = String(req.headers.host || "");
  return `${proto}://${host}`;
}

async function collectDigest(siteUrl, tenant, cfg, days) {
  const tenantId = String(tenant?.tenant_id || "default");
  const counts = {
    leads: 0,
    wall_photo: 0,
    race_splits: 0,
    bank_transfer: 0,
    partner_search: 0,
    race_result: 0,
    predictor: 0,
    paid: 0,
  };
  let traffic = null;
  try {
    const [leads, subs, paid, views] = await Promise.all([
      dbQuery(
        "SELECT count(*)::int AS n FROM email_events WHERE tenant_id = $1 AND type = 'lead_captured' AND at >= now() - ($2::int * interval '1 day')",
        [tenantId, days],
      ),
      dbQuery(
        "SELECT kind, count(*)::int AS n FROM submissions WHERE tenant_id = $1 AND created_at >= now() - ($2::int * interval '1 day') GROUP BY kind",
        [tenantId, days],
      ),
      dbQuery(
        "SELECT count(*)::int AS n FROM orders WHERE tenant_id = $1 AND status = 'paid' AND created_at >= now() - ($2::int * interval '1 day')",
        [tenantId, days],
      ),
      tenant?.analytics?.pageviews
        ? dbQuery(
            "SELECT path, referrer_host, utm_source, visitor, email, at FROM page_views WHERE tenant_id = $1 AND at >= now() - ($2::int * interval '1 day') ORDER BY at DESC LIMIT 50000",
            [tenantId, days],
          )
        : null,
    ]);
    if (views) traffic = summarizePageviews(views.rows || [], { top: 5 });
    counts.leads = Number(leads?.rows?.[0]?.n || 0);
    counts.paid = Number(paid?.rows?.[0]?.n || 0);
    for (const r of subs?.rows || []) {
      if (r.kind in counts) counts[r.kind] = Number(r.n || 0);
    }
  } catch {
    counts.db = "unavailable";
  }
  const digest = buildDigest({
    brand: String(tenant?.seo?.brandName || tenantId),
    siteUrl,
    coachPath: cfg.coachPath,
    days,
    pending: pendingItems(readInbox(cfg)),
    counts,
    traffic,
  });
  if (cfg.welcomePath && !(await digestSentBefore(tenantId))) {
    const url = `${String(siteUrl).replace(/\/+$/, "")}${cfg.welcomePath}`;
    digest.first = true;
    digest.subject = `${digest.subject.split(":")[0]}: your new website — start here`;
    digest.text = `${String(cfg.welcomeIntro || "Your welcome guide:").trim()}\n${url}\n\n— This week —\n\n${digest.text}`;
  }
  return digest;
}

async function digestSentBefore(tenantId) {
  try {
    const r = await dbQuery(
      "SELECT 1 FROM email_events WHERE tenant_id = $1 AND type = 'digest_sent' LIMIT 1",
      [tenantId],
    );
    return Boolean(r?.rows?.length);
  } catch {
    return true;
  }
}

async function lastDigestAt(tenantId) {
  try {
    const r = await dbQuery(
      "SELECT max(at) AS at FROM email_events WHERE tenant_id = $1 AND type = 'digest_sent'",
      [tenantId],
    );
    const at = r?.rows?.[0]?.at;
    return at ? new Date(at).getTime() : 0;
  } catch {
    return Date.now();
  }
}

async function sendDigestFor(siteUrl, tenant, cfg, days = 7) {
  const tenantId = String(tenant?.tenant_id || "default");
  const to = cfg.digestTo || alertEmailTo;
  const digest = await collectDigest(siteUrl, tenant, cfg, days);
  if (!to) return { sent: false, reason: "no_recipient", ...digest };
  const email = await sendAlertEmail({
    to,
    subject: digest.subject,
    body: digest.text,
  });
  if (email.ok) {
    try {
      await dbQuery(
        "INSERT INTO email_events (tenant_id, email, type, data) VALUES ($1, $2, 'digest_sent', $3::jsonb)",
        [
          tenantId,
          to,
          JSON.stringify({
            subject: digest.subject,
            first: Boolean(digest.first),
            provider: email.provider || "sendmail",
          }),
        ],
      );
    } catch (err) {
      console.error("digest_sent record failed", err);
    }
  }
  return { sent: Boolean(email.ok), error: email.error || "", ...digest };
}

// Weekly digest scheduler: every tenant with automation.digestTo gets the
// digest on Monday morning (automation.digestHourUtc, default 00:00 UTC =
// 07:00 Jakarta). Checks hourly; the DB record makes it safe across restarts
// and multiple instances. Needs PUBLIC_BASE_URL for links.
async function runDigestSchedulerOnce(now = new Date()) {
  if (!publicBaseUrl || !String(process.env.DATABASE_URL || "").trim()) return;
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  for (const tenant of loadTenantsData().list) {
    const cfg = tenantAutomation(tenant);
    if (!cfg?.digestTo) continue;
    if (day !== cfg.digestDayUtc || hour !== cfg.digestHourUtc) continue;
    const last = await lastDigestAt(String(tenant.tenant_id));
    if (now.getTime() - last < 6 * 864e5) continue;
    try {
      const r = await sendDigestFor(publicBaseUrl, tenant, cfg, 7);
      console.log(
        `[digest] ${tenant.tenant_id} -> ${cfg.digestTo}: ${r.sent ? "sent" : "not sent"} ${r.error || ""}`,
      );
    } catch (err) {
      console.error("[digest] failed", tenant.tenant_id, err);
    }
  }
}

function startDigestScheduler() {
  setTimeout(() => void runDigestSchedulerOnce(), 30 * 1000);
  setInterval(() => void runDigestSchedulerOnce(), 60 * 60 * 1000);
}

app.get("/admin/digest", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;
  const tenant = resolveTenantFromRequest(req);
  const cfg = tenantAutomation(tenant);
  if (!cfg) return res.status(404).json({ error: "Inbox not enabled" });
  const digest = await collectDigest(
    siteUrlFromRequest(req),
    tenant,
    cfg,
    rangeDays(req, 7),
  );
  return res.json({ ok: true, ...digest });
});

app.post("/admin/digest/send", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;
  const tenant = resolveTenantFromRequest(req);
  const cfg = tenantAutomation(tenant);
  if (!cfg) return res.status(404).json({ error: "Inbox not enabled" });
  const result = await sendDigestFor(
    siteUrlFromRequest(req),
    tenant,
    cfg,
    rangeDays(req, 7),
  );
  return res.json({ ok: true, ...result });
});

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


app.get("/sitemap.xml", (req, res) => {
  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");
    const baseUrl = getBaseUrl(req);

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

    const urls = [];
    urls.push("/");
    urls.push("/shop.html");

    urls.push("/kits/dog.html");
    urls.push("/kits/cat.html");
    urls.push("/kits/night-walk-safety-dog.html");
    urls.push("/kits/senior-dog-comfort.html");

    if (allowedNiches && allowedNiches.length > 0) {
      for (const slug of allowedNiches) {
        if (slug) urls.push(`/${slug}`);
      }
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

    for (const p of tenantProducts) {
      const canonicalPath = String(p?.seo?.canonicalPath || "");
      if (canonicalPath) urls.push(canonicalPath);
    }

    const lastmod = productsData?.generatedAt
      ? String(productsData.generatedAt).slice(0, 10)
      : "";

    const body = urls
      .filter(Boolean)
      .map((u) => {
        const loc = xmlEscape(`${baseUrl}${u}`);
        const lastmodTag = lastmod
          ? `<lastmod>${xmlEscape(lastmod)}</lastmod>`
          : "";
        return `<url><loc>${loc}</loc>${lastmodTag}</url>`;
      })
      .join("");

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    return res.send(xml);
  } catch (err) {
    return res
      .status(500)
      .type("text/plain")
      .send(err?.message || "Failed to build sitemap");
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

app.get("/admin/orders", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const status = String(req.query?.status || "").trim();
    const limitRaw = Number(req.query?.limit || 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(200, Math.floor(limitRaw)))
      : 50;

    const params = [activeTenantId];
    let where = "tenant_id = $1";
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    params.push(limit);

    const result = await dbQuery(
      `SELECT order_id, tenant_id, status, currency, amount_subtotal, amount_total, customer_email, utm_source, utm_medium, utm_campaign, utm_content, stripe_checkout_session_id, stripe_payment_intent_id, created_at, updated_at
       FROM orders
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );

    return res.json({ ok: true, orders: result.rows });
  } catch (err) {
    console.error("/admin/orders failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to list orders") });
  }
});

// Accountant-facing tax/VAT report over paid orders. Defaults to the
// resolved tenant (what /admin/orders sees); tenant=all gives the platform
// a per-tenant breakdown. ?group=month splits rows per calendar month and
// format=csv exports for spreadsheet/accounting import. All amounts are
// integer minor units.
app.get("/admin/tax-report", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");
    const tenantQuery = String(req.query?.tenant || "").trim();
    const groupByMonth = String(req.query?.group || "").trim() === "month";

    const params = [];
    const where = ["status = 'paid'"];
    const scopeAll = tenantQuery === "all";
    const tenantFilter = scopeAll ? "" : tenantQuery || activeTenantId;
    if (tenantFilter) {
      params.push(tenantFilter);
      where.push(`tenant_id = $${params.length}`);
    }
    const from = String(req.query?.from || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      params.push(from);
      where.push(`created_at >= $${params.length}::date`);
    }
    const to = String(req.query?.to || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      params.push(to);
      where.push(`created_at < ($${params.length}::date + interval '1 day')`);
    }

    const monthExpr = groupByMonth
      ? "to_char(date_trunc('month', created_at), 'YYYY-MM') AS period,"
      : "'' AS period,";

    const result = await dbQuery(
      `SELECT ${monthExpr} tenant_id, currency,
              COUNT(*)::int AS paid_orders,
              COALESCE(SUM(amount_subtotal), 0)::bigint AS amount_subtotal,
              COALESCE(SUM(amount_discount), 0)::bigint AS amount_discount,
              COALESCE(SUM(amount_tax), 0)::bigint AS amount_tax,
              COALESCE(SUM(amount_total), 0)::bigint AS amount_total
       FROM orders
       WHERE ${where.join(" AND ")}
       GROUP BY ${groupByMonth ? "date_trunc('month', created_at)," : ""} tenant_id, currency
       ORDER BY ${groupByMonth ? "period DESC," : ""} tenant_id, currency`,
      params,
    );

    const format = String(req.query?.format || "json").trim();
    if (format === "csv") {
      const header =
        "period,tenant_id,currency,paid_orders,amount_subtotal,amount_discount,amount_tax,amount_total";
      const lines = result.rows.map((r) =>
        [
          r.period,
          r.tenant_id,
          r.currency,
          r.paid_orders,
          r.amount_subtotal,
          r.amount_discount,
          r.amount_tax,
          r.amount_total,
        ].join(","),
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="tax-report.csv"',
      );
      return res.send([header, ...lines].join("\n") + "\n");
    }

    return res.json({
      ok: true,
      scope: scopeAll ? "all" : tenantFilter,
      from: from || null,
      to: to || null,
      note: "amounts are integer minor units; paid orders only",
      rows: result.rows,
    });
  } catch (err) {
    console.error("/admin/tax-report failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to build tax report") });
  }
});

// Platform billing — what tenants pay US (setup fees, £60/mo subscription).
// Separate from tenant storefront orders: this is Station 9's own revenue.
// v1 is record-keeping (bank transfer / manual payments); Stripe checkout
// for tenants plugs in later without schema changes.
app.get("/admin/platform-payments", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");
    const tenantQuery = String(req.query?.tenant || "").trim();
    const scopeAll = tenantQuery === "all";

    const params = [];
    const where = ["1=1"];
    const tenantFilter = scopeAll ? "" : tenantQuery || activeTenantId;
    if (tenantFilter) {
      params.push(tenantFilter);
      where.push(`tenant_id = $${params.length}`);
    }
    const status = String(req.query?.status || "").trim();
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    const from = String(req.query?.from || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      params.push(from);
      where.push(`created_at >= $${params.length}::date`);
    }
    const to = String(req.query?.to || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      params.push(to);
      where.push(`created_at < ($${params.length}::date + interval '1 day')`);
    }

    if (String(req.query?.aggregate || "").trim() === "1") {
      const agg = await dbQuery(
        `SELECT tenant_id, kind, status, currency,
                COUNT(*)::int AS payments,
                COALESCE(SUM(amount), 0)::bigint AS amount
         FROM platform_payments
         WHERE ${where.join(" AND ")}
         GROUP BY tenant_id, kind, status, currency
         ORDER BY tenant_id, kind, status`,
        params,
      );
      return res.json({
        ok: true,
        scope: scopeAll ? "all" : tenantFilter,
        note: "amounts are integer minor units",
        rows: agg.rows,
      });
    }

    params.push(
      Math.max(1, Math.min(200, Number(req.query?.limit) || 100)),
    );
    const result = await dbQuery(
      `SELECT id, tenant_id, kind, status, method, amount, currency,
              period_start, period_end, note, created_at
       FROM platform_payments
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return res.json({ ok: true, payments: result.rows });
  } catch (err) {
    console.error("/admin/platform-payments failed", err);
    return res.status(500).json({
      error: String(err?.message || "Failed to list platform payments"),
    });
  }
});

app.post(
  "/admin/platform-payments",
  express.json(),
  async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    try {
      const body = req.body || {};
      const tenantId = String(body.tenant_id || "").trim();
      const amount = Math.floor(Number(body.amount));
      if (!tenantId) {
        return res.status(400).json({ error: "tenant_id is required" });
      }
      if (!Number.isInteger(amount) || amount <= 0) {
        return res
          .status(400)
          .json({ error: "amount must be a positive integer (minor units)" });
      }
      const kinds = new Set(["setup", "subscription", "addon", "other"]);
      const statuses = new Set(["pending", "paid", "refunded", "void"]);
      const methods = new Set([
        "stripe",
        "bank_transfer",
        "cash",
        "other",
      ]);
      const kind = kinds.has(body.kind) ? body.kind : "other";
      const status = statuses.has(body.status) ? body.status : "paid";
      const method = methods.has(body.method) ? body.method : "other";
      const currency = String(body.currency || "gbp")
        .trim()
        .toLowerCase()
        .slice(0, 10);
      const periodStart = /^\d{4}-\d{2}-\d{2}$/.test(body.period_start)
        ? body.period_start
        : null;
      const periodEnd = /^\d{4}-\d{2}-\d{2}$/.test(body.period_end)
        ? body.period_end
        : null;
      const note = String(body.note || "").slice(0, 500) || null;

      const result = await dbQuery(
        `INSERT INTO platform_payments
           (tenant_id, kind, status, method, amount, currency, period_start, period_end, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [
          tenantId,
          kind,
          status,
          method,
          amount,
          currency,
          periodStart,
          periodEnd,
          note,
        ],
      );
      return res.json({ ok: true, id: result.rows?.[0]?.id });
    } catch (err) {
      console.error("POST /admin/platform-payments failed", err);
      return res.status(500).json({
        error: String(err?.message || "Failed to record platform payment"),
      });
    }
  },
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

app.post("/admin/orders/cleanup-stale", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const minutesRaw = Number(req.query?.minutes ?? req.body?.minutes ?? 60);
    const minutes = Number.isFinite(minutesRaw)
      ? Math.max(5, Math.min(60 * 24 * 7, Math.floor(minutesRaw)))
      : 60;

    const staleOrders = await dbQuery(
      "SELECT order_id FROM orders WHERE tenant_id = $1 AND status = $2 AND created_at < (now() - ($3::int * interval '1 minute')) AND (amount_total IS NULL OR stripe_checkout_session_id IS NULL)",
      [activeTenantId, "pending", String(minutes)],
    );

    const orderIds = staleOrders.rows
      .map((r) => String(r?.order_id || ""))
      .filter(Boolean);
    if (orderIds.length === 0) {
      return res.json({ ok: true, minutes, cleaned: 0, orderIds: [] });
    }

    await dbQuery(
      "UPDATE orders SET status = $1, updated_at = now() WHERE tenant_id = $2 AND order_id = ANY($3::text[]) AND status = $4",
      ["abandoned", activeTenantId, orderIds, "pending"],
    );

    await dbQuery(
      "INSERT INTO order_events (order_id, type, data) SELECT unnest($1::text[]), $2, jsonb_build_object('reason', 'stale_pending', 'minutes', $3::int)",
      [orderIds, "admin_cleanup_abandoned", String(minutes)],
    );

    return res.json({ ok: true, minutes, cleaned: orderIds.length, orderIds });
  } catch (err) {
    console.error("/admin/orders/cleanup-stale failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to cleanup orders") });
  }
});

app.get("/admin/reconcile", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    if (!stripe) {
      return res
        .status(500)
        .json({ error: "STRIPE_SECRET_KEY is not set on the server" });
    }

    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const cleanQueryId = (value) =>
      String(value || "")
        .trim()
        .replace(/^["']+/, "")
        .replace(/["']+$/, "");

    const extractStripeId = ({ raw, prefix }) => {
      const cleaned = cleanQueryId(raw);
      if (!cleaned) return "";

      const re = new RegExp(`${prefix}_[a-zA-Z0-9_-]+`);
      const hit = cleaned.match(re);
      return hit ? String(hit[0]) : cleaned;
    };

    const orderId = cleanQueryId(req.query?.order_id);
    const sessionId = extractStripeId({
      raw: req.query?.session_id || req.query?.sessionId,
      prefix: "cs",
    });
    const paymentIntentId = extractStripeId({
      raw: req.query?.payment_intent || req.query?.paymentIntentId,
      prefix: "pi",
    });

    if (!orderId && !sessionId && !paymentIntentId) {
      return res.status(400).json({
        error: "Provide one of: order_id, session_id, payment_intent",
      });
    }

    let stripeSession = null;
    let stripePaymentIntent = null;
    let stripePaymentIntentRetrieveError = "";
    let piFromSession = "";

    if (sessionId) {
      stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
      const rawPiFromSession = stripeSession?.payment_intent;
      piFromSession =
        typeof rawPiFromSession === "string"
          ? rawPiFromSession
          : rawPiFromSession && typeof rawPiFromSession === "object"
            ? String(rawPiFromSession.id || "")
            : "";
      if (!paymentIntentId && piFromSession) {
        try {
          stripePaymentIntent =
            await stripe.paymentIntents.retrieve(piFromSession);
        } catch (err) {
          stripePaymentIntent = null;
          stripePaymentIntentRetrieveError = String(
            err?.message || "Failed to retrieve payment intent",
          );
        }
      }
    }

    if (!stripePaymentIntent && paymentIntentId) {
      try {
        stripePaymentIntent =
          await stripe.paymentIntents.retrieve(paymentIntentId);
      } catch (err) {
        stripePaymentIntent = null;
        stripePaymentIntentRetrieveError = String(
          err?.message || "Failed to retrieve payment intent",
        );
      }
    }

    const matchParts = [];
    const params = [activeTenantId];

    if (orderId) {
      params.push(orderId);
      matchParts.push(`order_id = $${params.length}`);
    }
    if (sessionId) {
      params.push(sessionId);
      matchParts.push(`stripe_checkout_session_id = $${params.length}`);
    }
    if (paymentIntentId) {
      params.push(paymentIntentId);
      matchParts.push(`stripe_payment_intent_id = $${params.length}`);
    }

    const orderResult = await dbQuery(
      `SELECT order_id, tenant_id, status, currency, amount_total, amount_subtotal, stripe_checkout_session_id, stripe_payment_intent_id, customer_email, created_at, updated_at
       FROM orders
       WHERE tenant_id = $1 AND (${matchParts.join(" OR ")})
       ORDER BY created_at DESC
       LIMIT 1`,
      params,
    );

    const order = Array.isArray(orderResult?.rows) ? orderResult.rows[0] : null;

    const stripeCurrency = String(
      stripeSession?.currency || stripePaymentIntent?.currency || "",
    )
      .toLowerCase()
      .trim();
    const stripeAmountTotal = Number.isInteger(stripeSession?.amount_total)
      ? stripeSession.amount_total
      : Number.isInteger(stripePaymentIntent?.amount)
        ? stripePaymentIntent.amount
        : null;
    const stripeStatus = String(
      stripeSession?.payment_status || stripePaymentIntent?.status || "",
    ).trim();

    const dbCurrency = String(order?.currency || "")
      .toLowerCase()
      .trim();
    const dbAmountTotal = Number.isInteger(order?.amount_total)
      ? order.amount_total
      : null;

    const dbPaymentIntentId = String(
      order?.stripe_payment_intent_id || "",
    ).trim();
    const stripePaymentIntentId = String(stripePaymentIntent?.id || "").trim();
    const stripePaymentIntentIdFromSession = String(piFromSession || "").trim();

    const match = {
      foundOrder: Boolean(order?.order_id),
      sessionId:
        Boolean(sessionId) &&
        String(order?.stripe_checkout_session_id || "") === sessionId,
      paymentIntentId:
        (Boolean(paymentIntentId) && dbPaymentIntentId === paymentIntentId) ||
        (Boolean(stripePaymentIntentIdFromSession) &&
          dbPaymentIntentId === stripePaymentIntentIdFromSession) ||
        (Boolean(stripePaymentIntentId) &&
          dbPaymentIntentId === stripePaymentIntentId),
      currency:
        Boolean(stripeCurrency) &&
        Boolean(dbCurrency) &&
        stripeCurrency === dbCurrency,
      amountTotal:
        Number.isInteger(stripeAmountTotal) &&
        Number.isInteger(dbAmountTotal) &&
        stripeAmountTotal === dbAmountTotal,
      paid:
        String(order?.status || "") === "paid" &&
        (stripeStatus === "paid" || stripeStatus === "succeeded"),
    };

    return res.json({
      ok: true,
      input: { tenantId: activeTenantId, orderId, sessionId, paymentIntentId },
      db: { order },
      stripe: {
        session: stripeSession
          ? {
              id: String(stripeSession.id || ""),
              payment_status: String(stripeSession.payment_status || ""),
              amount_total: Number.isInteger(stripeSession.amount_total)
                ? stripeSession.amount_total
                : null,
              currency: String(stripeSession.currency || "").toLowerCase(),
              payment_intent: piFromSession,
              customer_email: String(
                stripeSession.customer_details?.email || "",
              ),
            }
          : null,
        payment_intent: stripePaymentIntent
          ? {
              id: String(stripePaymentIntent.id || ""),
              status: String(stripePaymentIntent.status || ""),
              amount: Number.isInteger(stripePaymentIntent.amount)
                ? stripePaymentIntent.amount
                : null,
              currency: String(
                stripePaymentIntent.currency || "",
              ).toLowerCase(),
            }
          : null,
        payment_intent_retrieve_error: stripePaymentIntentRetrieveError || null,
      },
      match,
    });
  } catch (err) {
    console.error("/admin/reconcile failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to reconcile") });
  }
});

app.get("/admin/orders/:orderId", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");
    const orderId = String(req.params?.orderId || "").trim();
    if (!orderId) return res.status(400).json({ error: "Missing orderId" });

    const orderResult = await dbQuery(
      "SELECT * FROM orders WHERE tenant_id = $1 AND order_id = $2",
      [activeTenantId, orderId],
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const eventsResult = await dbQuery(
      "SELECT at, type, data FROM order_events WHERE order_id = $1 ORDER BY at DESC",
      [orderId],
    );

    return res.json({
      ok: true,
      order: orderResult.rows[0],
      events: eventsResult.rows,
    });
  } catch (err) {
    console.error("/admin/orders/:orderId failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to load order") });
  }
});

// Mark a paid order fulfilled (shipped/delivered) — clears the
// "paid order stuck" alert and sends the customer a shipped notice.
app.post(
  "/admin/orders/:orderId/fulfil",
  express.json(),
  async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");
      const orderId = String(req.params?.orderId || "").trim();
      const tracking = String(req.body?.tracking || "").slice(0, 200);
      if (!orderId) return res.status(400).json({ error: "Missing orderId" });

      await ensureCommerceTables();
      const updated = await dbQuery(
        "UPDATE orders SET fulfilled_at = now(), fulfilment_tracking = NULLIF($3, ''), updated_at = now() WHERE tenant_id = $1 AND order_id = $2 AND status = 'paid' AND fulfilled_at IS NULL RETURNING order_id, customer_email",
        [activeTenantId, orderId, tracking],
      );
      const row = Array.isArray(updated?.rows) ? updated.rows[0] : null;
      if (!row) {
        return res.status(404).json({
          error: "Order not found, not paid, or already fulfilled",
        });
      }

      await dbQuery(
        "INSERT INTO order_events (order_id, type, data) VALUES ($1, 'fulfilled', $2::jsonb)",
        [orderId, JSON.stringify({ tracking: tracking || null })],
      );
      try {
        await sendOrderShippedNotice({
          tenantId: activeTenantId,
          orderId,
          email: String(row.customer_email || ""),
          tracking: tracking || null,
        });
      } catch (mailErr) {
        console.error("shipped email failed", mailErr);
      }
      return res.json({ ok: true, order_id: orderId, fulfilled: true });
    } catch (err) {
      console.error("/admin/orders/:orderId/fulfil failed", err);
      return res
        .status(500)
        .json({ error: String(err?.message || "Failed to fulfil order") });
    }
  },
);

// Issue a refund through Stripe — the charge.refunded webhook then flips
// the order to refunded and emails the customer. Partial refunds pass
// `amount` (integer minor units); omit for a full refund.
app.post(
  "/admin/orders/:orderId/refund",
  express.json(),
  async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    if (!stripe) {
      return res
        .status(500)
        .json({ error: "STRIPE_SECRET_KEY is not set on the server" });
    }

    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");
      const orderId = String(req.params?.orderId || "").trim();
      if (!orderId) return res.status(400).json({ error: "Missing orderId" });

      const orderResult = await dbQuery(
        "SELECT order_id, status, stripe_payment_intent_id, amount_total, currency FROM orders WHERE tenant_id = $1 AND order_id = $2",
        [activeTenantId, orderId],
      );
      const order = orderResult.rows?.[0];
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (String(order.status) !== "paid") {
        return res
          .status(400)
          .json({ error: `Cannot refund order in status '${order.status}'` });
      }
      const paymentIntentId = String(order.stripe_payment_intent_id || "");
      if (!paymentIntentId) {
        return res
          .status(400)
          .json({ error: "Order has no payment intent to refund" });
      }

      const amountRaw = Number(req.body?.amount);
      const params = { payment_intent: paymentIntentId };
      if (Number.isInteger(amountRaw) && amountRaw > 0) {
        if (amountRaw > Number(order.amount_total || 0)) {
          return res
            .status(400)
            .json({ error: "Refund amount exceeds order total" });
        }
        params.amount = amountRaw;
      }

      // A double-click or retried request must not stack a second refund.
      // A genuinely separate partial refund of the same amount can pass its
      // own idempotency_key.
      const idempotencyKey = String(
        req.body?.idempotency_key ||
          `refund_${activeTenantId}_${orderId}_${params.amount || "full"}`,
      ).slice(0, 255);
      const refund = await stripe.refunds.create(params, { idempotencyKey });
      await dbQuery(
        "INSERT INTO order_events (order_id, type, data) VALUES ($1, 'refund_initiated', $2::jsonb)",
        [
          orderId,
          JSON.stringify({
            refundId: String(refund?.id || ""),
            amount: refund?.amount ?? null,
            partial: Boolean(params.amount),
          }),
        ],
      );
      return res.json({
        ok: true,
        order_id: orderId,
        refund_id: String(refund?.id || ""),
        amount: refund?.amount ?? null,
      });
    } catch (err) {
      console.error("/admin/orders/:orderId/refund failed", err);
      return res
        .status(500)
        .json({ error: String(err?.message || "Failed to issue refund") });
    }
  },
);

app.post("/admin/jobs/abandoned-recovery", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const delayMinutesRaw = Number(
      req.query?.delay_minutes ?? req.body?.delay_minutes ?? 60,
    );
    const delayMinutes = Number.isFinite(delayMinutesRaw)
      ? Math.max(5, Math.min(60 * 24 * 7, Math.floor(delayMinutesRaw)))
      : 60;

    const limitRaw = Number(req.query?.limit ?? req.body?.limit ?? 50);
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(500, Math.floor(limitRaw)))
      : 50;

    const eligible = await dbQuery(
      `SELECT o.order_id, o.customer_email, o.created_at, o.updated_at
       FROM orders o
       WHERE o.tenant_id = $1
         AND o.status = 'abandoned'
         AND o.customer_email IS NOT NULL
         AND o.customer_email <> ''
         AND o.updated_at < (now() - ($2::int * interval '1 minute'))
         AND NOT EXISTS (
           SELECT 1 FROM order_events e
           WHERE e.order_id = o.order_id
             AND e.type = 'abandoned_recovery_email_sent'
         )
       ORDER BY o.updated_at ASC
       LIMIT $3`,
      [activeTenantId, String(delayMinutes), String(limit)],
    );

    const rows = Array.isArray(eligible?.rows) ? eligible.rows : [];
    if (rows.length === 0) {
      return res.json({
        ok: true,
        delayMinutes,
        limit,
        attempted: 0,
        sent: 0,
        orderIds: [],
      });
    }

    const orderIds = [];
    for (const r of rows) {
      const orderId = String(r?.order_id || "").trim();
      const email = String(r?.customer_email || "").trim();
      if (!orderId || !email) continue;
      orderIds.push(orderId);

      const draft = {
        to: email,
        subject: "Did you still want to complete your order?",
        body: "Looks like checkout didn’t complete. If you’d like help finishing your order, reply to this email and we’ll sort it.",
      };

      console.log(
        "ABANDONED_RECOVERY_DRAFT",
        JSON.stringify({ tenantId: activeTenantId, orderId, email, draft }),
      );

      await dbQuery(
        "INSERT INTO order_events (order_id, type, data) SELECT $1, $2, $3::jsonb WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND type = $2)",
        [
          orderId,
          "abandoned_recovery_email_sent",
          JSON.stringify({
            provider: "log_only",
            delayMinutes,
            to: email,
            at: new Date().toISOString(),
          }),
        ],
      );
    }

    return res.json({
      ok: true,
      delayMinutes,
      limit,
      attempted: orderIds.length,
      sent: orderIds.length,
      orderIds,
    });
  } catch (err) {
    console.error("/admin/jobs/abandoned-recovery failed", err);
    return res.status(500).json({
      error: String(err?.message || "Failed to run abandoned recovery"),
    });
  }
});

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

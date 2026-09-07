// server.js — Express local preview for index.html
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import fs from "node:fs";
import crypto from "node:crypto";
import { dbQuery } from "./db.js";
import {
  normalizeEmail,
  isValidEmail,
  orderTotalsDelta,
} from "./src/data-stitch.js";
import { spawn } from "child_process";
import {
  scoreDraftProduct,
  findDuplicateProductId,
  buildProductFromSupplierItem,
  getBaseUrl,
  xmlEscape,
} from "./src/product-utils.js";
import { relatedProducts } from "./src/related-products.js";
import { isRecurringProduct } from "./src/catalog-qa.js";
import {
  subscriptionIdFromInvoice,
  metadataFromInvoice,
  subscriptionIdFromSession,
  customerIdOf,
  priceFromSubscription,
  periodEndFromSubscription,
  isoFromUnix,
  isRenewalInvoice,
} from "./src/subscriptions.js";
import { sanitizeProfile, hasProfile } from "./src/lead-profile.js";
import { validateSubmission, summarizePayloads } from "./src/submissions.js";
import {
  estimateForProduct,
  shipsFromLabel,
  originRegion,
  resolveRegion,
  formatEstimate,
} from "./src/shipping.js";
import { freeShippingProgress } from "./src/free-shipping.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const PORT = process.env.PORT || 3000;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const stripeWebhookSecret = String(
  process.env.STRIPE_WEBHOOK_SECRET || "",
).trim();
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

app.post(
  "/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      if (!stripe) {
        return res
          .status(500)
          .json({ error: "STRIPE_SECRET_KEY is not set on the server" });
      }
      if (!stripeWebhookSecret) {
        return res
          .status(500)
          .json({ error: "STRIPE_WEBHOOK_SECRET is not set on the server" });
      }

      const signature = String(req.headers["stripe-signature"] || "");
      if (!signature) {
        return res.status(400).json({ error: "Missing Stripe signature" });
      }

      const event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        stripeWebhookSecret,
      );

      const stripeEventId = String(event?.id || "");
      const stripeEventType = String(event?.type || "unknown");
      if (!stripeEventId) {
        return res.status(400).json({ error: "Missing Stripe event id" });
      }

      const eventInsert = await dbQuery(
        "INSERT INTO stripe_events (stripe_event_id, type, payload) VALUES ($1, $2, $3) ON CONFLICT (stripe_event_id) DO NOTHING RETURNING stripe_event_id",
        [stripeEventId, stripeEventType, event],
      );
      const isFirstTimeEvent =
        Array.isArray(eventInsert?.rows) && eventInsert.rows.length > 0;

      if (stripeEventType === "checkout.session.completed") {
        const session = event?.data?.object;
        const sessionId = String(session?.id || "");
        const rawPaymentIntent = session?.payment_intent;
        const paymentIntentId =
          typeof rawPaymentIntent === "string"
            ? rawPaymentIntent
            : rawPaymentIntent && typeof rawPaymentIntent === "object"
              ? String(rawPaymentIntent.id || "")
              : "";
        const orderId = String(session?.metadata?.order_id || "");
        const tenantId = String(session?.metadata?.tenant_id || "default");
        const currency = String(session?.currency || "").toLowerCase();
        const customerEmail = String(
          session?.customer_details?.email || session?.customer_email || "",
        );
        const amountSubtotal = Number.isInteger(session?.amount_subtotal)
          ? session.amount_subtotal
          : null;
        const amountTotal = Number.isInteger(session?.amount_total)
          ? session.amount_total
          : null;

        if (orderId) {
          const upsert = await dbQuery(
            "INSERT INTO orders (order_id, tenant_id, status, currency, amount_subtotal, amount_total, stripe_checkout_session_id, stripe_payment_intent_id, customer_email, items) VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), '[]'::jsonb) ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status, currency = COALESCE(NULLIF(EXCLUDED.currency, ''), orders.currency), amount_subtotal = EXCLUDED.amount_subtotal, amount_total = EXCLUDED.amount_total, stripe_checkout_session_id = COALESCE(EXCLUDED.stripe_checkout_session_id, orders.stripe_checkout_session_id), stripe_payment_intent_id = COALESCE(EXCLUDED.stripe_payment_intent_id, orders.stripe_payment_intent_id), customer_email = COALESCE(EXCLUDED.customer_email, orders.customer_email), updated_at = now() RETURNING order_id, tenant_id, status, currency, amount_total, customer_email",
            [
              orderId,
              tenantId,
              "paid",
              currency,
              amountSubtotal,
              amountTotal,
              sessionId,
              paymentIntentId,
              customerEmail,
            ],
          );

          const upserted = Array.isArray(upsert?.rows) ? upsert.rows[0] : null;
          if (upserted?.order_id && String(upserted?.status || "") === "paid") {
            console.log(
              "ORDER_PAID",
              JSON.stringify({
                orderId: String(upserted.order_id),
                tenantId: String(upserted.tenant_id || ""),
                amountTotal: Number.isInteger(upserted.amount_total)
                  ? upserted.amount_total
                  : null,
                currency: String(upserted.currency || ""),
                customerEmail: String(upserted.customer_email || ""),
                stripeEventId,
                stripeSessionId: sessionId,
                stripePaymentIntentId: paymentIntentId,
                isFirstTimeEvent,
              }),
            );
          }

          const eventData = {
            stripeEventId,
            sessionId,
            tenantId,
            isFirstTimeEvent,
          };
          await dbQuery(
            "INSERT INTO order_events (order_id, type, data) SELECT $1, $2, $3::jsonb WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND type = $2 AND data->>'stripeEventId' = $4)",
            [
              orderId,
              "stripe.checkout.session.completed",
              JSON.stringify(eventData),
              stripeEventId,
            ],
          );

          const subscriptionId = subscriptionIdFromSession(session);
          if (subscriptionId) {
            await dbQuery(
              "INSERT INTO subscriptions (stripe_subscription_id, tenant_id, order_id, customer_email, stripe_customer_id, status, currency, amount_minor) VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), 'active', NULLIF($6, ''), $7) ON CONFLICT (stripe_subscription_id) DO UPDATE SET order_id = COALESCE(subscriptions.order_id, EXCLUDED.order_id), customer_email = COALESCE(subscriptions.customer_email, EXCLUDED.customer_email), stripe_customer_id = COALESCE(subscriptions.stripe_customer_id, EXCLUDED.stripe_customer_id), updated_at = now()",
              [
                subscriptionId,
                tenantId,
                orderId,
                customerEmail,
                customerIdOf(session),
                currency,
                amountTotal,
              ],
            );
            await dbQuery(
              "UPDATE orders SET stripe_subscription_id = $1, updated_at = now() WHERE order_id = $2",
              [subscriptionId, orderId],
            );
          }

          // Data-stitch: on a first-time paid event, bump the customer's running
          // totals, mark any open captured cart as converted (attributing which
          // nudge won), and log a unified order_completed funnel event.
          if (customerEmail && isFirstTimeEvent) {
            // Data-stitch is best-effort analytics: never let it turn a paid
            // checkout into a failed webhook response.
            try {
              await stitchPaidOrder({
                tenantId,
                email: normalizeEmail(customerEmail),
                orderId,
                currency,
                amountTotal,
              });
            } catch (stitchErr) {
              console.error(
                "STITCH_FAILED",
                JSON.stringify({
                  orderId,
                  stripeEventId,
                  message: String(stitchErr?.message || stitchErr),
                }),
              );
            }
          }
        } else if (sessionId) {
          const updated = await dbQuery(
            "UPDATE orders SET status = $1, currency = COALESCE(NULLIF($2, ''), currency), amount_subtotal = $3, amount_total = $4, stripe_checkout_session_id = COALESCE(NULLIF($5, ''), stripe_checkout_session_id), stripe_payment_intent_id = COALESCE(NULLIF($6, ''), stripe_payment_intent_id), customer_email = COALESCE(NULLIF($7, ''), customer_email), updated_at = now() WHERE stripe_checkout_session_id = $5 RETURNING order_id, tenant_id, status, currency, amount_total, customer_email",
            [
              "paid",
              currency,
              amountSubtotal,
              amountTotal,
              sessionId,
              paymentIntentId,
              customerEmail,
            ],
          );

          const updatedRow = Array.isArray(updated?.rows)
            ? updated.rows[0]
            : null;
          if (updatedRow?.order_id) {
            console.log(
              "ORDER_PAID",
              JSON.stringify({
                orderId: String(updatedRow.order_id),
                tenantId: String(updatedRow.tenant_id || ""),
                amountTotal: Number.isInteger(updatedRow.amount_total)
                  ? updatedRow.amount_total
                  : null,
                currency: String(updatedRow.currency || ""),
                customerEmail: String(updatedRow.customer_email || ""),
                stripeEventId,
                stripeSessionId: sessionId,
                stripePaymentIntentId: paymentIntentId,
                isFirstTimeEvent,
              }),
            );

            const stitchEmail = normalizeEmail(updatedRow.customer_email);
            if (stitchEmail && isFirstTimeEvent) {
              // Best-effort: a data-stitch failure must not fail the webhook.
              try {
                await stitchPaidOrder({
                  tenantId: String(updatedRow.tenant_id || tenantId),
                  email: stitchEmail,
                  orderId: String(updatedRow.order_id),
                  currency: String(updatedRow.currency || currency),
                  amountTotal: Number.isInteger(updatedRow.amount_total)
                    ? updatedRow.amount_total
                    : amountTotal,
                });
              } catch (stitchErr) {
                console.error(
                  "STITCH_FAILED",
                  JSON.stringify({
                    orderId: String(updatedRow.order_id),
                    stripeEventId,
                    message: String(stitchErr?.message || stitchErr),
                  }),
                );
              }
            }
          }
        }
      } else if (
        stripeEventType === "checkout.session.expired" ||
        stripeEventType === "checkout.session.async_payment_failed"
      ) {
        const session = event?.data?.object;
        const sessionId = String(session?.id || "");
        const rawPaymentIntent = session?.payment_intent;
        const paymentIntentId =
          typeof rawPaymentIntent === "string"
            ? rawPaymentIntent
            : rawPaymentIntent && typeof rawPaymentIntent === "object"
              ? String(rawPaymentIntent.id || "")
              : "";
        const orderId = String(session?.metadata?.order_id || "");
        const tenantId = String(session?.metadata?.tenant_id || "default");

        const nextStatus =
          stripeEventType === "checkout.session.expired"
            ? "abandoned"
            : "failed";

        if (orderId) {
          const updated = await dbQuery(
            "UPDATE orders SET status = $1, stripe_checkout_session_id = COALESCE(NULLIF($2, ''), stripe_checkout_session_id), stripe_payment_intent_id = COALESCE(NULLIF($3, ''), stripe_payment_intent_id), updated_at = now() WHERE tenant_id = $4 AND order_id = $5 AND status = $6 RETURNING order_id",
            [
              nextStatus,
              sessionId,
              paymentIntentId,
              tenantId,
              orderId,
              "pending",
            ],
          );

          const updatedRow = Array.isArray(updated?.rows)
            ? updated.rows[0]
            : null;
          if (updatedRow?.order_id) {
            const eventData = {
              stripeEventId,
              sessionId,
              tenantId,
              isFirstTimeEvent,
            };
            await dbQuery(
              "INSERT INTO order_events (order_id, type, data) SELECT $1, $2, $3::jsonb WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND type = $2 AND data->>'stripeEventId' = $4)",
              [
                orderId,
                stripeEventType,
                JSON.stringify(eventData),
                stripeEventId,
              ],
            );
          }
        } else if (sessionId) {
          await dbQuery(
            "UPDATE orders SET status = $1, stripe_payment_intent_id = COALESCE(NULLIF($2, ''), stripe_payment_intent_id), updated_at = now() WHERE stripe_checkout_session_id = $3 AND status = $4",
            [nextStatus, paymentIntentId, sessionId, "pending"],
          );
        }
      } else if (stripeEventType === "payment_intent.payment_failed") {
        const paymentIntent = event?.data?.object;
        const paymentIntentId = String(paymentIntent?.id || "");
        if (paymentIntentId) {
          await dbQuery(
            "UPDATE orders SET status = $1, updated_at = now() WHERE stripe_payment_intent_id = $2 AND status = $3",
            ["failed", paymentIntentId, "pending"],
          );
        }
      } else if (
        stripeEventType === "customer.subscription.created" ||
        stripeEventType === "customer.subscription.updated" ||
        stripeEventType === "customer.subscription.deleted"
      ) {
        const subscription = event?.data?.object;
        const subscriptionId = String(subscription?.id || "");
        if (subscriptionId) {
          const tenantId = String(
            subscription?.metadata?.tenant_id || "default",
          );
          const orderId = String(subscription?.metadata?.order_id || "");
          const email = normalizeEmail(subscription?.metadata?.customer_email);
          const status =
            stripeEventType === "customer.subscription.deleted"
              ? "canceled"
              : String(subscription?.status || "active");
          const price = priceFromSubscription(subscription);
          await dbQuery(
            "INSERT INTO subscriptions (stripe_subscription_id, tenant_id, order_id, customer_email, stripe_customer_id, status, currency, amount_minor, billing_interval, current_period_end, canceled_at) VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), $6, $7, $8, $9, $10, $11) ON CONFLICT (stripe_subscription_id) DO UPDATE SET status = EXCLUDED.status, order_id = COALESCE(subscriptions.order_id, EXCLUDED.order_id), customer_email = COALESCE(subscriptions.customer_email, EXCLUDED.customer_email), stripe_customer_id = COALESCE(subscriptions.stripe_customer_id, EXCLUDED.stripe_customer_id), currency = COALESCE(EXCLUDED.currency, subscriptions.currency), amount_minor = COALESCE(EXCLUDED.amount_minor, subscriptions.amount_minor), billing_interval = COALESCE(EXCLUDED.billing_interval, subscriptions.billing_interval), current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end), canceled_at = COALESCE(EXCLUDED.canceled_at, subscriptions.canceled_at), updated_at = now()",
            [
              subscriptionId,
              tenantId,
              orderId,
              email,
              customerIdOf(subscription),
              status,
              price.currency,
              price.amountMinor,
              price.interval,
              periodEndFromSubscription(subscription),
              isoFromUnix(subscription?.canceled_at),
            ],
          );
          if (email && isFirstTimeEvent) {
            await dbQuery(
              "INSERT INTO email_events (tenant_id, email, type, order_id, data) VALUES ($1, $2, $3, NULLIF($4, ''), $5::jsonb)",
              [
                tenantId,
                email,
                stripeEventType === "customer.subscription.deleted"
                  ? "subscription_canceled"
                  : "subscription_updated",
                orderId,
                JSON.stringify({ stripeEventId, subscriptionId, status }),
              ],
            );
          }
        }
      } else if (
        stripeEventType === "invoice.paid" ||
        stripeEventType === "invoice.payment_failed"
      ) {
        const invoice = event?.data?.object;
        const subscriptionId = subscriptionIdFromInvoice(invoice);
        if (subscriptionId) {
          const meta = metadataFromInvoice(invoice);
          const existing = await dbQuery(
            "SELECT tenant_id, order_id, customer_email FROM subscriptions WHERE stripe_subscription_id = $1",
            [subscriptionId],
          );
          const known = Array.isArray(existing?.rows) ? existing.rows[0] : null;
          const tenantId = String(
            meta?.tenant_id || known?.tenant_id || "default",
          );
          const email = normalizeEmail(
            invoice?.customer_email ||
              known?.customer_email ||
              meta?.customer_email,
          );
          const currency = String(invoice?.currency || "").toLowerCase();
          const amountPaid = Number.isInteger(invoice?.amount_paid)
            ? invoice.amount_paid
            : null;
          const invoiceId = String(invoice?.id || "");

          if (stripeEventType === "invoice.payment_failed") {
            await dbQuery(
              "UPDATE subscriptions SET status = 'past_due', updated_at = now() WHERE stripe_subscription_id = $1",
              [subscriptionId],
            );
            if (email && isFirstTimeEvent) {
              await dbQuery(
                "INSERT INTO email_events (tenant_id, email, type, data) VALUES ($1, $2, 'subscription_payment_failed', $3::jsonb)",
                [
                  tenantId,
                  email,
                  JSON.stringify({
                    stripeEventId,
                    subscriptionId,
                    invoiceId,
                    amountDue: Number.isInteger(invoice?.amount_due)
                      ? invoice.amount_due
                      : null,
                    currency,
                  }),
                ],
              );
            }
          } else if (isRenewalInvoice(invoice) && isFirstTimeEvent) {
            // Each renewal becomes its own paid order so revenue, customer
            // totals and the admin dashboard see it like any other sale.
            const renewalOrderId = crypto.randomUUID();
            await dbQuery(
              "INSERT INTO orders (order_id, tenant_id, status, currency, amount_subtotal, amount_total, customer_email, items, stripe_subscription_id) VALUES ($1, $2, 'paid', $3, $4, $4, NULLIF($5, ''), '[]'::jsonb, $6)",
              [
                renewalOrderId,
                tenantId,
                currency,
                amountPaid,
                email,
                subscriptionId,
              ],
            );
            await dbQuery(
              "INSERT INTO order_events (order_id, type, data) VALUES ($1, 'stripe.invoice.paid', $2::jsonb)",
              [
                renewalOrderId,
                JSON.stringify({
                  stripeEventId,
                  subscriptionId,
                  invoiceId,
                  billingReason: String(invoice?.billing_reason || ""),
                  parentOrderId: String(
                    known?.order_id || meta?.order_id || "",
                  ),
                }),
              ],
            );
            await dbQuery(
              "UPDATE subscriptions SET status = 'active', current_period_end = COALESCE($2, current_period_end), updated_at = now() WHERE stripe_subscription_id = $1",
              [
                subscriptionId,
                isoFromUnix(
                  invoice?.lines?.data?.[0]?.period?.end ?? invoice?.period_end,
                ),
              ],
            );
            if (email) {
              try {
                await stitchPaidOrder({
                  tenantId,
                  email,
                  orderId: renewalOrderId,
                  currency,
                  amountTotal: amountPaid,
                });
              } catch (stitchErr) {
                console.error(
                  "STITCH_FAILED",
                  JSON.stringify({
                    orderId: renewalOrderId,
                    stripeEventId,
                    message: String(stitchErr?.message || stitchErr),
                  }),
                );
              }
            }
          } else if (stripeEventType === "invoice.paid") {
            await dbQuery(
              "UPDATE subscriptions SET status = 'active', updated_at = now() WHERE stripe_subscription_id = $1",
              [subscriptionId],
            );
          }
        }
      }

      return res.json({ received: true });
    } catch (err) {
      const message = String(err?.message || "Webhook error");
      return res.status(400).json({ error: message });
    }
  },
);

app.get("/admin/heartbeat", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  return res.json({
    ok: true,
    heartbeat: heartbeatState,
  });
});

app.post("/admin/alerts/run", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const now = new Date();
    const result = await evaluateAndRecordAlerts({ tenant, now });
    return res.json({
      ok: true,
      tenant_id: String(tenant?.tenant_id || "default"),
      now: now.toISOString(),
      ...result,
    });
  } catch (err) {
    console.error("/admin/alerts/run failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to run alerts") });
  }
});

app.get("/admin/alerts", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");
    const limitRaw = Number(req.query?.limit);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 100)
        : 25;

    const alertsPath = path.join(__dirname, "data", "alerts.json");
    const store = safeReadJsonFile(alertsPath, {
      schemaVersion: 1,
      updatedAt: "",
      alerts: [],
    });
    const list = Array.isArray(store?.alerts) ? store.alerts : [];
    const filtered = list
      .filter((a) => String(a?.tenant_id || "") === activeTenantId)
      .slice()
      .sort((a, b) =>
        String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")),
      )
      .slice(0, limit);

    return res.json({
      ok: true,
      tenant_id: activeTenantId,
      updatedAt: String(store?.updatedAt || ""),
      alert_email_to: alertEmailTo ? "configured" : "not_configured",
      alerts: filtered,
    });
  } catch (err) {
    console.error("/admin/alerts failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to load alerts") });
  }
});

app.get("/admin/ad-spend", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const spendPath = path.join(__dirname, "data", "ad_spend.json");
    const spendData = safeReadJsonFile(spendPath, {
      schemaVersion: 1,
      updatedAt: "",
      spends: [],
    });

    const spends = Array.isArray(spendData?.spends) ? spendData.spends : [];
    const filtered = spends.filter(
      (s) => String(s?.tenant_id || "") === activeTenantId,
    );

    return res.json({
      ok: true,
      tenant_id: activeTenantId,
      currency: String(tenant?.currency || "").toLowerCase(),
      updatedAt: String(spendData?.updatedAt || ""),
      spends: filtered,
    });
  } catch (err) {
    console.error("/admin/ad-spend failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to load ad spend") });
  }
});

app.post("/admin/ad-spend", express.json(), async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");
    const expectedCurrency = String(tenant?.currency || "").toLowerCase();
    if (!expectedCurrency) {
      return res
        .status(400)
        .json({ error: "Tenant currency is not configured" });
    }

    const clean = (value) => {
      const s = String(value || "").trim();
      if (!s) return "";
      return s.length > 120 ? s.slice(0, 120) : s;
    };

    const utmSource = clean(req.body?.utm_source);
    const utmMedium = clean(req.body?.utm_medium);
    const utmCampaign = clean(req.body?.utm_campaign);
    const utmContent = clean(req.body?.utm_content);

    const spendMinor = Number(req.body?.spend_minor);
    if (!Number.isInteger(spendMinor) || spendMinor < 0) {
      return res
        .status(400)
        .json({ error: "spend_minor must be a non-negative integer" });
    }

    const spendCurrency = String(
      req.body?.currency || expectedCurrency,
    ).toLowerCase();
    if (spendCurrency !== expectedCurrency) {
      return res
        .status(400)
        .json({ error: `Currency mismatch (expected ${expectedCurrency})` });
    }

    if (!utmCampaign && !utmContent) {
      return res
        .status(400)
        .json({ error: "Provide at least utm_campaign or utm_content" });
    }

    const spendPath = path.join(__dirname, "data", "ad_spend.json");
    const spendData = safeReadJsonFile(spendPath, {
      schemaVersion: 1,
      updatedAt: "",
      spends: [],
    });

    const spends = Array.isArray(spendData?.spends) ? spendData.spends : [];
    const keyMatch = (s) => {
      return (
        String(s?.tenant_id || "") === activeTenantId &&
        String(s?.utm_source || "") === utmSource &&
        String(s?.utm_medium || "") === utmMedium &&
        String(s?.utm_campaign || "") === utmCampaign &&
        String(s?.utm_content || "") === utmContent
      );
    };

    const now = new Date().toISOString();
    const next = {
      tenant_id: activeTenantId,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      spend_minor: spendMinor,
      currency: expectedCurrency,
      updatedAt: now,
    };

    const idx = spends.findIndex(keyMatch);
    if (idx >= 0) {
      spends[idx] = next;
    } else {
      spends.push(next);
    }

    spendData.schemaVersion = 1;
    spendData.updatedAt = now;
    spendData.spends = spends;
    safeWriteJsonFile(spendPath, spendData);

    return res.json({ ok: true, saved: next });
  } catch (err) {
    console.error("POST /admin/ad-spend failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to save ad spend") });
  }
});

app.get("/admin/ad-guardrails", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const filePath = path.join(__dirname, "data", "ad_guardrails.json");
    const raw = safeReadJsonFile(filePath, {
      schemaVersion: 1,
      updatedAt: "",
      guardrails: [],
    });

    const list = Array.isArray(raw?.guardrails) ? raw.guardrails : [];
    const entry =
      list.find((g) => String(g?.tenant_id || "") === activeTenantId) || null;

    return res.json({
      ok: true,
      tenant_id: activeTenantId,
      currency: String(tenant?.currency || "").toLowerCase(),
      updatedAt: String(raw?.updatedAt || ""),
      guardrails: entry,
    });
  } catch (err) {
    console.error("/admin/ad-guardrails failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to load ad guardrails") });
  }
});

app.post("/admin/ad-guardrails", express.json(), async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");
    const expectedCurrency = String(tenant?.currency || "").toLowerCase();
    if (!expectedCurrency) {
      return res
        .status(400)
        .json({ error: "Tenant currency is not configured" });
    }

    const cleanText = (value) => {
      const s = String(value || "").trim();
      if (!s) return "";
      return s.length > 120 ? s.slice(0, 120) : s;
    };

    const currency = String(
      req.body?.currency || expectedCurrency,
    ).toLowerCase();
    if (currency !== expectedCurrency) {
      return res
        .status(400)
        .json({ error: `Currency mismatch (expected ${expectedCurrency})` });
    }

    const rangeDaysRaw = Number(req.body?.range_days);
    const rangeDays =
      Number.isFinite(rangeDaysRaw) && rangeDaysRaw > 0
        ? Math.min(Math.floor(rangeDaysRaw), 365)
        : 7;

    const stopSpendNoRevenueMinor = Number(
      req.body?.stop_spend_no_revenue_minor,
    );
    const warnRoasBelow = Number(req.body?.warn_roas_below);
    const warnProfitBelowMinor = Number(req.body?.warn_profit_below_minor);

    if (
      !Number.isInteger(stopSpendNoRevenueMinor) ||
      stopSpendNoRevenueMinor < 0
    ) {
      return res.status(400).json({
        error: "stop_spend_no_revenue_minor must be a non-negative integer",
      });
    }

    if (!Number.isFinite(warnRoasBelow) || warnRoasBelow < 0) {
      return res
        .status(400)
        .json({ error: "warn_roas_below must be a non-negative number" });
    }

    if (!Number.isInteger(warnProfitBelowMinor)) {
      return res
        .status(400)
        .json({ error: "warn_profit_below_minor must be an integer" });
    }

    const note = cleanText(req.body?.note);

    const filePath = path.join(__dirname, "data", "ad_guardrails.json");
    const raw = safeReadJsonFile(filePath, {
      schemaVersion: 1,
      updatedAt: "",
      guardrails: [],
    });

    const list = Array.isArray(raw?.guardrails) ? raw.guardrails : [];
    const now = new Date().toISOString();
    const next = {
      tenant_id: activeTenantId,
      currency: expectedCurrency,
      range_days: rangeDays,
      stop_spend_no_revenue_minor: stopSpendNoRevenueMinor,
      warn_roas_below: warnRoasBelow,
      warn_profit_below_minor: warnProfitBelowMinor,
      note,
      updatedAt: now,
    };

    const idx = list.findIndex(
      (g) => String(g?.tenant_id || "") === activeTenantId,
    );
    if (idx >= 0) list[idx] = next;
    else list.push(next);

    raw.schemaVersion = 1;
    raw.updatedAt = now;
    raw.guardrails = list;
    safeWriteJsonFile(filePath, raw);

    return res.json({ ok: true, saved: next });
  } catch (err) {
    console.error("POST /admin/ad-guardrails failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to save ad guardrails") });
  }
});

app.get("/admin/attribution-summary", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const mode = String(req.query?.mode || "")
      .trim()
      .toLowerCase();
    const paidOnly = mode === "paid";

    const rangeDays = 30;
    const startParam = String(req.query?.start || "").trim();
    const endParam = String(req.query?.end || "").trim();
    const limitRaw = Number(req.query?.limit);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 500)
        : 100;

    const now = new Date();
    const defaultStart = new Date(
      now.getTime() - rangeDays * 24 * 60 * 60 * 1000,
    );

    const start = startParam ? new Date(startParam) : defaultStart;
    const end = endParam ? new Date(endParam) : now;
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return res.status(400).json({ error: "Invalid start/end date" });
    }

    const result = paidOnly
      ? await dbQuery(
          `SELECT
              COALESCE(NULLIF(TRIM(utm_source), ''), '—') AS utm_source,
              COALESCE(NULLIF(TRIM(utm_medium), ''), '—') AS utm_medium,
              COALESCE(NULLIF(TRIM(utm_campaign), ''), '—') AS utm_campaign,
              COALESCE(NULLIF(TRIM(utm_content), ''), '—') AS utm_content,
              MAX(currency) AS currency,
              COUNT(*)::int AS started,
              COUNT(*)::int AS paid,
              COALESCE(SUM(amount_total), 0)::int AS revenue_minor
            FROM orders
            WHERE tenant_id = $1
              AND created_at >= $2
              AND created_at <= $3
              AND status = 'paid'
              AND (
                COALESCE(NULLIF(TRIM(utm_campaign), ''), '') <> ''
                OR COALESCE(NULLIF(TRIM(utm_content), ''), '') <> ''
                OR COALESCE(NULLIF(TRIM(utm_source), ''), '') <> ''
              )
            GROUP BY 1, 2, 3, 4
            ORDER BY revenue_minor DESC, paid DESC, started DESC
            LIMIT $4`,
          [activeTenantId, start.toISOString(), end.toISOString(), limit],
        )
      : await dbQuery(
          `SELECT
              COALESCE(NULLIF(TRIM(utm_source), ''), '—') AS utm_source,
              COALESCE(NULLIF(TRIM(utm_medium), ''), '—') AS utm_medium,
              COALESCE(NULLIF(TRIM(utm_campaign), ''), '—') AS utm_campaign,
              COALESCE(NULLIF(TRIM(utm_content), ''), '—') AS utm_content,
              MAX(currency) AS currency,
              COUNT(*)::int AS started,
              SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END)::int AS paid,
              COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_total ELSE 0 END), 0)::int AS revenue_minor
            FROM orders
            WHERE tenant_id = $1
              AND created_at >= $2
              AND created_at <= $3
              AND (
                COALESCE(NULLIF(TRIM(utm_campaign), ''), '') <> ''
                OR COALESCE(NULLIF(TRIM(utm_content), ''), '') <> ''
                OR COALESCE(NULLIF(TRIM(utm_source), ''), '') <> ''
              )
            GROUP BY 1, 2, 3, 4
            ORDER BY revenue_minor DESC, paid DESC, started DESC
            LIMIT $4`,
          [activeTenantId, start.toISOString(), end.toISOString(), limit],
        );

    return res.json({
      ok: true,
      tenant_id: activeTenantId,
      mode: paidOnly ? "paid" : "funnel",
      start: start.toISOString(),
      end: end.toISOString(),
      limit,
      rows: result.rows,
    });
  } catch (err) {
    console.error("/admin/attribution-summary failed", err);
    return res.status(500).json({
      error: String(err?.message || "Failed to load attribution summary"),
    });
  }
});

app.get("/admin/ops-health", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const pendingHoursRaw = Number(req.query?.pending_hours);
    const pendingHours =
      Number.isFinite(pendingHoursRaw) && pendingHoursRaw > 0
        ? pendingHoursRaw
        : 1;

    const now = new Date();
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const stalePendingBefore = new Date(
      now.getTime() - pendingHours * 60 * 60 * 1000,
    );

    const [webhookLast, webhookCount24h, orders24h, orders7d, stalePending] =
      await Promise.all([
        dbQuery(
          "SELECT MAX(created_at) AS last_webhook_at FROM stripe_events",
          [],
        ),
        dbQuery(
          "SELECT COUNT(*)::int AS count FROM stripe_events WHERE created_at >= $1",
          [since24h.toISOString()],
        ),
        dbQuery(
          "SELECT COUNT(*)::int AS started, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END)::int AS paid, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END)::int AS pending, SUM(CASE WHEN status='abandoned' THEN 1 ELSE 0 END)::int AS abandoned FROM orders WHERE tenant_id=$1 AND created_at >= $2",
          [activeTenantId, since24h.toISOString()],
        ),
        dbQuery(
          "SELECT COUNT(*)::int AS started, SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END)::int AS paid, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END)::int AS pending, SUM(CASE WHEN status='abandoned' THEN 1 ELSE 0 END)::int AS abandoned FROM orders WHERE tenant_id=$1 AND created_at >= $2",
          [activeTenantId, since7d.toISOString()],
        ),
        dbQuery(
          "SELECT COUNT(*)::int AS count FROM orders WHERE tenant_id=$1 AND status='pending' AND created_at < $2",
          [activeTenantId, stalePendingBefore.toISOString()],
        ),
      ]);

    const lastWebhookAt = webhookLast?.rows?.[0]?.last_webhook_at || null;
    const webhooks24h = Number(webhookCount24h?.rows?.[0]?.count || 0) || 0;
    const o24 = orders24h?.rows?.[0] || {};
    const o7 = orders7d?.rows?.[0] || {};
    const stalePendingCount = Number(stalePending?.rows?.[0]?.count || 0) || 0;

    return res.json({
      ok: true,
      tenant_id: activeTenantId,
      server_time: now.toISOString(),
      pending_hours: pendingHours,
      stripe: {
        last_webhook_at: lastWebhookAt,
        webhooks_24h: webhooks24h,
      },
      orders: {
        last_24h: {
          started: Number(o24?.started || 0) || 0,
          paid: Number(o24?.paid || 0) || 0,
          pending: Number(o24?.pending || 0) || 0,
          abandoned: Number(o24?.abandoned || 0) || 0,
        },
        last_7d: {
          started: Number(o7?.started || 0) || 0,
          paid: Number(o7?.paid || 0) || 0,
          pending: Number(o7?.pending || 0) || 0,
          abandoned: Number(o7?.abandoned || 0) || 0,
        },
        stale_pending: {
          count: stalePendingCount,
          before: stalePendingBefore.toISOString(),
        },
      },
    });
  } catch (err) {
    console.error("/admin/ops-health failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to load ops health") });
  }
});

app.get("/admin/ops-trends", async (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const daysRaw = Number(req.query?.days);
    const days =
      Number.isFinite(daysRaw) && daysRaw > 0
        ? Math.min(Math.floor(daysRaw), 30)
        : 7;

    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const spendPath = path.join(__dirname, "data", "ad_spend.json");
    const spendData = safeReadJsonFile(spendPath, {
      schemaVersion: 1,
      updatedAt: "",
      spends: [],
    });
    const spends = Array.isArray(spendData?.spends) ? spendData.spends : [];

    const spendByDate = {};
    spends
      .filter((s) => String(s?.tenant_id || "default") === activeTenantId)
      .forEach((s) => {
        const updatedAt = String(s?.updatedAt || "");
        const d = updatedAt ? new Date(updatedAt) : null;
        if (!d || !Number.isFinite(d.getTime())) return;
        if (d < since || d > now) return;
        const dateKey = d.toISOString().slice(0, 10);
        spendByDate[dateKey] =
          (Number(spendByDate[dateKey] || 0) || 0) +
          (Number(s?.spend_minor || 0) || 0);
      });

    const [ordersDaily, revenueDaily, webhooksDaily] = await Promise.all([
      dbQuery(
        `SELECT
          to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS started,
          SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END)::int AS paid,
          SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END)::int AS pending,
          SUM(CASE WHEN status='abandoned' THEN 1 ELSE 0 END)::int AS abandoned,
          SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END)::int AS failed
        FROM orders
        WHERE tenant_id=$1 AND created_at >= $2 AND created_at <= $3
        GROUP BY 1
        ORDER BY 1 ASC`,
        [activeTenantId, since.toISOString(), now.toISOString()],
      ),
      dbQuery(
        `SELECT
          to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
          COALESCE(SUM(amount_total), 0)::int AS revenue_minor
        FROM orders
        WHERE tenant_id=$1 AND status='paid' AND created_at >= $2 AND created_at <= $3
        GROUP BY 1
        ORDER BY 1 ASC`,
        [activeTenantId, since.toISOString(), now.toISOString()],
      ),
      dbQuery(
        `SELECT
          to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
          COUNT(*)::int AS webhooks
        FROM stripe_events
        WHERE created_at >= $1 AND created_at <= $2
        GROUP BY 1
        ORDER BY 1 ASC`,
        [since.toISOString(), now.toISOString()],
      ),
    ]);

    const ordersRows = Array.isArray(ordersDaily?.rows) ? ordersDaily.rows : [];
    const revenueRows = Array.isArray(revenueDaily?.rows)
      ? revenueDaily.rows
      : [];
    const webhookRows = Array.isArray(webhooksDaily?.rows)
      ? webhooksDaily.rows
      : [];

    const ordersByDay = {};
    ordersRows.forEach((r) => {
      ordersByDay[String(r?.day || "")] = r;
    });

    const revenueByDay = {};
    revenueRows.forEach((r) => {
      revenueByDay[String(r?.day || "")] = Number(r?.revenue_minor || 0) || 0;
    });

    const webhooksByDay = {};
    webhookRows.forEach((r) => {
      webhooksByDay[String(r?.day || "")] = Number(r?.webhooks || 0) || 0;
    });

    const rows = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      const o = ordersByDay[day] || {};
      const revenueMinor = Number(revenueByDay[day] || 0) || 0;
      const spendMinor = Number(spendByDate[day] || 0) || 0;
      rows.push({
        day,
        started: Number(o?.started || 0) || 0,
        paid: Number(o?.paid || 0) || 0,
        pending: Number(o?.pending || 0) || 0,
        abandoned: Number(o?.abandoned || 0) || 0,
        failed: Number(o?.failed || 0) || 0,
        revenue_minor: revenueMinor,
        spend_minor: spendMinor,
        profit_minor: revenueMinor - spendMinor,
        webhooks: Number(webhooksByDay[day] || 0) || 0,
      });
    }

    return res.json({
      ok: true,
      tenant_id: activeTenantId,
      start: since.toISOString(),
      end: now.toISOString(),
      days,
      currency: String(tenant?.currency || "").toLowerCase(),
      rows,
    });
  } catch (err) {
    console.error("/admin/ops-trends failed", err);
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to load ops trends") });
  }
});

app.use(express.json());

function loadProductsData() {
  const filePath = path.join(__dirname, "data", "products.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed?.products) ? parsed.products : [];
  const generatedAt = parsed?.generatedAt ? String(parsed.generatedAt) : "";

  const byId = new Map();
  for (const p of list) {
    if (p?.productId) byId.set(String(p.productId), p);
  }

  return { list, byId, generatedAt };
}

function loadReviewsData() {
  const filePath = path.join(__dirname, "data", "reviews.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed?.reviews) ? parsed.reviews : [];
  const generatedAt = parsed?.generatedAt ? String(parsed.generatedAt) : "";
  return { list, generatedAt };
}

function loadTenantsData() {
  const filePath = path.join(__dirname, "data", "tenants.json");
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed?.tenants) ? parsed.tenants : [];
  return { list };
}

function safeReadJsonFile(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWriteJsonFile(filePath, value) {
  const body = JSON.stringify(value, null, 2) + "\n";
  fs.writeFileSync(filePath, body, "utf8");
}

function sendAlertEmail({ to, subject, body }) {
  return new Promise((resolve) => {
    const address = String(to || "").trim();
    if (!address) {
      return resolve({ ok: false, error: "Missing recipient" });
    }

    const safeSubject = String(subject || "Alert")
      .replace(/[\r\n]+/g, " ")
      .slice(0, 200);
    const content = `To: ${address}\nSubject: ${safeSubject}\n\n${String(body || "")}`;

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      resolve(result);
    };

    let cp;
    try {
      cp = spawn("/usr/sbin/sendmail", ["-t"], {
        stdio: ["pipe", "ignore", "pipe"],
      });
    } catch (err) {
      return finish({
        ok: false,
        error: String(err?.message || "sendmail spawn failed"),
      });
    }

    const timer = setTimeout(() => {
      try {
        cp.kill("SIGKILL");
      } catch {
        // ignore
      }
      finish({ ok: false, error: "sendmail timeout" });
    }, 8000);

    let stderr = "";
    if (cp?.stderr) {
      cp.stderr.on("data", (buf) => {
        stderr += String(buf || "");
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
      });
    }

    cp.on("error", (err) => {
      clearTimeout(timer);
      finish({ ok: false, error: String(err?.message || "sendmail error") });
    });

    cp.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return finish({ ok: true });
      const msg = stderr.trim()
        ? `sendmail exit ${code}: ${stderr.trim()}`
        : `sendmail exit ${code}`;
      return finish({ ok: false, error: msg });
    });

    try {
      cp.stdin.write(content);
      cp.stdin.end();
    } catch (err) {
      clearTimeout(timer);
      finish({
        ok: false,
        error: String(err?.message || "sendmail stdin failed"),
      });
    }
  });
}

function buildAlertEmail({ tenantId, alert }) {
  const type = String(alert?.type || "unknown");
  const severity = String(alert?.severity || "warning");
  const message = String(alert?.message || "");
  const data = alert?.data && typeof alert.data === "object" ? alert.data : {};
  const now = String(alert?.createdAt || new Date().toISOString());

  const baseUrl = publicBaseUrl || `http://localhost:${PORT}`;
  const adminUrl = `${String(baseUrl).replace(/\/$/, "")}/admin.html`;

  const title = `[${severity.toUpperCase()}] ${type} (${tenantId})`;

  let explainer = "";
  let why = "";
  let actions = [];

  if (type === "stripe_webhooks_stale") {
    const last = data?.last_webhook_at ? String(data.last_webhook_at) : "";
    explainer =
      "A webhook is an automatic message Stripe sends to your server when something happens (like a checkout completing or a payment failing).";
    why =
      "If webhooks stop arriving, your store can miss payment updates. That can make paid orders look stuck or not show up correctly in your dashboard.";
    actions = [
      "Open the admin dashboard and check Ops Health → Stripe webhooks (look at the last webhook time).",
      "If you were testing payments recently: make a new test checkout and confirm a webhook arrives.",
      "Check your server is running and reachable, and that STRIPE_WEBHOOK_SECRET is correct.",
      "In Stripe Dashboard, confirm the webhook endpoint is enabled and not failing (look for recent delivery errors).",
    ];
    if (last) {
      actions.unshift(`Last webhook seen at: ${last}`);
    }
  } else if (type === "paid_orders_stuck") {
    const count = Number(data?.count || 0) || 0;
    explainer =
      "A paid order means money was taken, but the order hasn’t progressed since then.";
    why =
      "This usually means fulfillment didn’t happen (or your system didn’t record the next step). It’s a risk: customers may not receive their items, and refunds/chargebacks can follow.";
    actions = [
      "Open the admin dashboard → filter Orders to ‘paid’ and look for older paid orders.",
      "Pick the oldest one and confirm you have the Stripe payment intent / checkout session saved.",
      "If it should have shipped: contact the supplier/fulfillment partner and push it through.",
      "If these are old test orders: you can ignore, or add a cleanup step later to mark tests clearly.",
    ];
    if (count > 0) {
      actions.unshift(`Count flagged: ${count}`);
    }
  } else if (type === "spend_without_revenue") {
    const spendMinor = Number(data?.spend_minor_24h || 0) || 0;
    const revenueMinor = Number(data?.revenue_minor_24h || 0) || 0;
    const thresholdMinor = Number(data?.threshold_minor || 0) || 0;
    explainer =
      "This means you’ve recorded ad spend, but there’s zero paid revenue in the same window.";
    why =
      "This is the classic ‘leaky bucket’ moment: ads are spending money but sales aren’t coming through (or tracking is broken).";
    actions = [
      `Check Ad Guardrails: is spend above your stop threshold? (threshold=${thresholdMinor})`,
      "Check Attribution Summary (Paid-only) to see if any campaigns have revenue.",
      "If there truly are no sales: pause the ads and investigate landing page / checkout / tracking.",
      "If there were sales but they’re missing: investigate Stripe webhooks and order capture.",
    ];
    actions.unshift(
      `Last 24h totals (minor units): spend=${spendMinor}, revenue=${revenueMinor}`,
    );
  } else if (type === "server_error_spike") {
    const count = Number(data?.count_15m || 0) || 0;
    explainer =
      "Your server returned a lot of 5xx errors (server-side failures) in a short time.";
    why =
      "If customers hit errors, they can’t buy — and ads/SEO traffic gets wasted.";
    actions = [
      "Open server logs and look for the first error in the last 15 minutes.",
      "Try loading the store and admin pages in a browser to reproduce.",
      "If Stripe checkout is failing: check STRIPE_SECRET_KEY and Stripe status.",
      "If database queries are failing: check DATABASE_URL and database availability.",
    ];
    actions.unshift(`Error count (15m): ${count}`);
  } else {
    explainer = "An operational alert was triggered.";
    why =
      "Something needs a quick check to avoid revenue or customer experience issues.";
    actions = [
      "Open the admin dashboard and review the Ops panels.",
      "If you can’t explain the alert quickly, check server logs.",
    ];
  }

  const bullets = actions.map((x) => `- ${x}`).join("\n");
  const body = [
    `Alert type: ${type}`,
    `Severity: ${severity}`,
    `Tenant: ${tenantId}`,
    `Time: ${now}`,
    "",
    "What happened:",
    message ? `- ${message}` : "- (no message)",
    "",
    "What this means:",
    `- ${explainer}`,
    "",
    "Why it matters:",
    `- ${why}`,
    "",
    "Recommended actions:",
    bullets,
    "",
    "Useful links:",
    `- Admin dashboard: ${adminUrl}`,
    "",
    "Raw data (for debugging):",
    JSON.stringify(data, null, 2),
    "",
  ].join("\n");

  return { subject: title, body };
}

async function evaluateAndRecordAlerts({ tenant, now }) {
  const activeTenantId = String(tenant?.tenant_id || "default");
  const tsNow = now instanceof Date ? now : new Date();
  const alertsPath = path.join(__dirname, "data", "alerts.json");
  const store = safeReadJsonFile(alertsPath, {
    schemaVersion: 1,
    updatedAt: "",
    alerts: [],
  });
  const existing = Array.isArray(store?.alerts) ? store.alerts : [];

  const dedupeWindowMs = 6 * 60 * 60 * 1000;
  const isDuplicate = (type) => {
    const cutoff = tsNow.getTime() - dedupeWindowMs;
    return existing.some((a) => {
      if (String(a?.tenant_id || "") !== activeTenantId) return false;
      if (String(a?.type || "") !== String(type || "")) return false;
      const at = String(a?.createdAt || "");
      const ms = at ? new Date(at).getTime() : Number.NaN;
      return Number.isFinite(ms) && ms >= cutoff;
    });
  };

  const created = [];
  const add = async ({ type, severity, message, data }) => {
    if (isDuplicate(type)) return;

    const id = crypto.randomBytes(10).toString("hex");
    const at = tsNow.toISOString();
    const entry = {
      id,
      tenant_id: activeTenantId,
      type: String(type || "unknown"),
      severity: String(severity || "warning"),
      message: String(message || ""),
      data: data && typeof data === "object" ? data : {},
      createdAt: at,
      emailedTo: "",
      emailStatus: "",
    };

    if (alertEmailTo) {
      const built = buildAlertEmail({ tenantId: activeTenantId, alert: entry });
      const email = await sendAlertEmail({
        to: alertEmailTo,
        subject: built.subject,
        body: built.body,
      });
      entry.emailedTo = alertEmailTo;
      entry.emailStatus = email.ok
        ? "sent"
        : `failed: ${String(email.error || "unknown")}`;
    } else {
      entry.emailStatus = "skipped (ALERT_EMAIL_TO not set)";
    }

    existing.push(entry);
    created.push(entry);
  };

  const staleWebhookHours = 6;
  const staleWebhookBefore = new Date(
    tsNow.getTime() - staleWebhookHours * 60 * 60 * 1000,
  );
  const webhookLast = await dbQuery(
    "SELECT MAX(created_at) AS last_webhook_at FROM stripe_events",
    [],
  );
  const lastWebhookAt = webhookLast?.rows?.[0]?.last_webhook_at || null;
  if (!lastWebhookAt || new Date(lastWebhookAt) < staleWebhookBefore) {
    await add({
      type: "stripe_webhooks_stale",
      severity: "stop",
      message: `No Stripe webhook received in the last ${staleWebhookHours} hours.`,
      data: {
        last_webhook_at: lastWebhookAt,
        stale_before: staleWebhookBefore.toISOString(),
      },
    });
  }

  const paidStaleHours = 48;
  const paidStaleBefore = new Date(
    tsNow.getTime() - paidStaleHours * 60 * 60 * 1000,
  );
  const stuckPaid = await dbQuery(
    "SELECT order_id, created_at, updated_at, customer_email, amount_total, currency FROM orders WHERE tenant_id=$1 AND status='paid' AND updated_at < $2 ORDER BY updated_at ASC LIMIT 10",
    [activeTenantId, paidStaleBefore.toISOString()],
  );
  const stuck = Array.isArray(stuckPaid?.rows) ? stuckPaid.rows : [];
  if (stuck.length > 0) {
    await add({
      type: "paid_orders_stuck",
      severity: "warning",
      message: `${stuck.length} paid order(s) have not updated in ${paidStaleHours} hours.`,
      data: {
        count: stuck.length,
        oldest_updated_at_before: paidStaleBefore.toISOString(),
        sample: stuck,
      },
    });
  }

  const spendNoRevenueThresholdMinor = 2500;
  const since24h = new Date(tsNow.getTime() - 24 * 60 * 60 * 1000);
  const revenue24h = await dbQuery(
    "SELECT COALESCE(SUM(amount_total),0)::int AS revenue_minor FROM orders WHERE tenant_id=$1 AND status='paid' AND created_at >= $2 AND created_at <= $3",
    [activeTenantId, since24h.toISOString(), tsNow.toISOString()],
  );
  const revMinor = Number(revenue24h?.rows?.[0]?.revenue_minor || 0) || 0;

  const spendPath = path.join(__dirname, "data", "ad_spend.json");
  const spendData = safeReadJsonFile(spendPath, {
    schemaVersion: 1,
    updatedAt: "",
    spends: [],
  });
  const spends = Array.isArray(spendData?.spends) ? spendData.spends : [];
  const spendMinor24h = spends
    .filter((s) => String(s?.tenant_id || "default") === activeTenantId)
    .reduce((acc, s) => {
      const when = String(s?.updatedAt || "");
      const d = when ? new Date(when) : null;
      if (!d || !Number.isFinite(d.getTime())) return acc;
      if (d < since24h || d > tsNow) return acc;
      return acc + (Number(s?.spend_minor || 0) || 0);
    }, 0);

  if (spendMinor24h >= spendNoRevenueThresholdMinor && revMinor <= 0) {
    await add({
      type: "spend_without_revenue",
      severity: "stop",
      message: `Spend is above threshold but paid revenue is zero in the last 24 hours.`,
      data: {
        spend_minor_24h: spendMinor24h,
        revenue_minor_24h: revMinor,
        threshold_minor: spendNoRevenueThresholdMinor,
      },
    });
  }

  const errorSpikeThreshold = 10;
  if (recentServerErrors.length >= errorSpikeThreshold) {
    await add({
      type: "server_error_spike",
      severity: "warning",
      message: `High server error rate: ${recentServerErrors.length} responses with 5xx in the last 15 minutes.`,
      data: {
        count_15m: recentServerErrors.length,
        sample: recentServerErrors.slice(-10),
      },
    });
  }

  store.schemaVersion = 1;
  store.updatedAt = tsNow.toISOString();
  store.alerts = existing.slice(-500);
  safeWriteJsonFile(alertsPath, store);

  return { created };
}

async function runHeartbeatOnce() {
  const now = new Date();
  heartbeatState.lastRunAt = now.toISOString();
  heartbeatState.lastError = "";
  heartbeatState.lastCreatedCount = 0;

  try {
    const tenantsPath = path.join(__dirname, "data", "tenants.json");
    const tenantsData = safeReadJsonFile(tenantsPath, { tenants: [] });
    const list = Array.isArray(tenantsData?.tenants) ? tenantsData.tenants : [];
    const tenantIds = Array.from(
      new Set(
        list.map((t) => String(t?.tenant_id || "").trim()).filter(Boolean),
      ),
    );
    if (!tenantIds.includes("default")) tenantIds.unshift("default");

    let createdTotal = 0;
    for (const tenantId of tenantIds) {
      const tenant = list.find(
        (t) => String(t?.tenant_id || "").trim() === tenantId,
      ) || { tenant_id: tenantId };
      const result = await evaluateAndRecordAlerts({ tenant, now });
      createdTotal += Array.isArray(result?.created)
        ? result.created.length
        : 0;
    }

    heartbeatState.lastCreatedCount = createdTotal;
    heartbeatState.lastOk = true;
  } catch (err) {
    heartbeatState.lastOk = false;
    heartbeatState.lastError = String(err?.message || "Heartbeat failed");
  }
}

function startHeartbeatScheduler() {
  const minutes = heartbeatState.intervalMinutes;
  const ms = Math.max(60 * 1000, minutes * 60 * 1000);
  setTimeout(() => {
    void runHeartbeatOnce();
  }, 10 * 1000);
  setInterval(() => {
    void runHeartbeatOnce();
  }, ms);
}

function requireAdmin(req, res) {
  if (!adminApiKey) {
    return res
      .status(500)
      .json({ error: "ADMIN_API_KEY is not set on the server" });
  }

  const provided = String(
    req.headers["x-admin-key"] || req.headers["x-admin-api-key"] || "",
  );
  if (!provided || provided !== adminApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return null;
}

// Data-stitching: apply a paid order to the single-customer-view record,
// mark the matching captured cart converted (recording which nudge won), and
// log a unified order_completed funnel event. Idempotency is the caller's job
// (only invoked on a first-time Stripe event).
async function stitchPaidOrder({
  tenantId,
  email,
  orderId,
  currency,
  amountTotal,
}) {
  const delta = orderTotalsDelta(amountTotal);
  const cur = String(currency || "").toLowerCase() || null;

  await dbQuery(
    "INSERT INTO customers (tenant_id, email, currency, total_orders, total_spend_minor, subscribed) VALUES ($1, $2, $3, $4, $5, true) ON CONFLICT (tenant_id, email) DO UPDATE SET total_orders = customers.total_orders + EXCLUDED.total_orders, total_spend_minor = customers.total_spend_minor + EXCLUDED.total_spend_minor, currency = COALESCE(customers.currency, EXCLUDED.currency), last_seen_at = now(), updated_at = now()",
    [tenantId, email, cur, delta.orders, delta.spendMinor],
  );

  await dbQuery(
    "UPDATE cart_emails SET status = 'converted', converted_at = now(), converted_order_id = $3, updated_at = now() WHERE tenant_id = $1 AND lower(email) = $2 AND converted_at IS NULL",
    [tenantId, email, orderId],
  );

  await dbQuery(
    "INSERT INTO email_events (tenant_id, email, type, order_id, data) VALUES ($1, $2, 'order_completed', $3, $4::jsonb)",
    [
      tenantId,
      email,
      orderId,
      JSON.stringify({ amountTotal: delta.spendMinor, currency: cur }),
    ],
  );
}
function resolveTenantFromRequest(req) {
  const hostHeader = String(req.headers.host || "");
  const hostname = hostHeader.split(":")[0].toLowerCase();

  let tenants = [];
  try {
    tenants = loadTenantsData().list;
  } catch {
    tenants = [];
  }

  const match = tenants.find((t) =>
    Array.isArray(t?.hostnames)
      ? t.hostnames.map((h) => String(h).toLowerCase()).includes(hostname)
      : false,
  );

  if (match?.tenant_id) return match;
  return { tenant_id: "default", currency: "eur", language: "en" };
}

// Disable all browser caching during local development
app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
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
    ]);
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

app.get("/sitemap.xml", (req, res) => {
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
    ];
    const staticXml = staticUrls
      .map(
        (u) =>
          `  <url><loc>${xmlEscape(baseUrl + u.path)}</loc><changefreq>weekly</changefreq><priority>${xmlEscape(u.priority)}</priority></url>`,
      )
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${staticXml}\n${productUrls}\n</urlset>`;
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

// Serve everything in this folder (HTML, CSS, JS, images, etc.)
// Disable the default index.html behavior so our explicit "/" route can redirect.
app.use(express.static(__dirname, { index: false }));

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
      "UPDATE orders SET status = 'abandoned', updated_at = now() WHERE order_id = $1 AND status = 'pending' RETURNING order_id",
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
        "UPDATE orders SET status = 'abandoned', updated_at = now() WHERE order_id = $1 AND status = 'pending' RETURNING order_id",
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
      }
    }

    return res.redirect(302, "/cart.html");
  } catch (err) {
    console.error("GET /checkout/cancel failed", err);
    return res.redirect(302, "/cart.html");
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
  return res.redirect(302, "/shop.html");
});

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/roxjaya", (req, res) => {
  res.sendFile(path.join(__dirname, "roxjaya", "index.html"));
});

// Clean URLs for Roxjaya content pages: /roxjaya/<slug>/ -> roxjaya/<slug>.html
app.get("/roxjaya/:slug", (req, res, next) => {
  const slug = String(req.params.slug || "");
  if (!/^[a-z0-9-]+$/.test(slug)) return next();
  const file = path.join(__dirname, "roxjaya", `${slug}.html`);
  if (!fs.existsSync(file)) return next();
  if (!req.path.endsWith("/")) return res.redirect(301, `/roxjaya/${slug}/`);
  res.sendFile(file);
});

app.post("/admin/run-import", (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const queuePath = path.join(__dirname, "data", "import_queue.json");
    const auditPath = path.join(__dirname, "data", "import_audit.json");
    const feedPath = path.join(
      __dirname,
      "data",
      "placeholder_supplier_feed.json",
    );
    const draftsPath = path.join(__dirname, "data", "drafts.json");
    const productsPath = path.join(__dirname, "data", "products.json");

    const queueData = safeReadJsonFile(queuePath, {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      queue: [],
    });
    const auditData = safeReadJsonFile(auditPath, {
      schemaVersion: 1,
      events: [],
    });
    const feedData = safeReadJsonFile(feedPath, {
      schemaVersion: 1,
      items: [],
    });
    const draftsData = safeReadJsonFile(draftsPath, {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      drafts: [],
    });
    const productsData = safeReadJsonFile(productsPath, {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      products: [],
    });

    const pendingJob = Array.isArray(queueData?.queue)
      ? queueData.queue.find((j) => String(j?.status || "") === "pending")
      : null;

    if (!pendingJob) {
      return res.json({ ok: true, message: "No pending jobs" });
    }

    pendingJob.status = "running";
    pendingJob.startedAt = new Date().toISOString();
    safeWriteJsonFile(queuePath, queueData);

    const feedItems = Array.isArray(feedData?.items) ? feedData.items : [];

    const beforeCount = Array.isArray(productsData?.products)
      ? productsData.products.length
      : 0;
    const products = Array.isArray(productsData?.products)
      ? productsData.products
      : [];
    const drafts = Array.isArray(draftsData?.drafts) ? draftsData.drafts : [];

    const autoPublishMinScore = Number(
      process.env.AUTO_PUBLISH_MIN_SCORE || 85,
    );
    const minScore = Number.isFinite(autoPublishMinScore)
      ? autoPublishMinScore
      : 85;

    let imported = 0;
    let published = 0;
    const errors = [];

    for (const rawItem of feedItems) {
      try {
        const nextProduct = buildProductFromSupplierItem(
          rawItem,
          activeTenantId,
        );

        const duplicateOfProductId = findDuplicateProductId({
          products,
          nextProduct,
        });
        const isDuplicate = Boolean(duplicateOfProductId);

        const { score, reasons } = scoreDraftProduct(nextProduct);
        if (isDuplicate) {
          reasons.push(
            `Duplicate of existing productId: ${duplicateOfProductId}`,
          );
        }
        const draftEntry = {
          draftId: `draft-${String(nextProduct.productId)}`,
          productId: String(nextProduct.productId),
          tenant_id: String(nextProduct.tenant_id || "default"),
          source: {
            type: "placeholder_supplier_feed",
            supplierSku: String(rawItem?.supplierSku || ""),
          },
          score,
          reasons,
          status: isDuplicate
            ? "duplicate"
            : score >= minScore
              ? "auto_published"
              : "draft",
          product: nextProduct,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const existingDraftIndex = drafts.findIndex(
          (d) => String(d?.productId || "") === String(nextProduct.productId),
        );
        if (existingDraftIndex >= 0) drafts[existingDraftIndex] = draftEntry;
        else drafts.push(draftEntry);

        if (isDuplicate || score < minScore) {
          imported += 1;
          continue;
        }

        const existingIndex = products.findIndex(
          (p) => String(p?.productId || "") === String(nextProduct.productId),
        );
        if (existingIndex >= 0) {
          products[existingIndex] = {
            ...products[existingIndex],
            ...nextProduct,
            audit: {
              ...(products[existingIndex]?.audit || {}),
              updatedAt: new Date().toISOString(),
            },
          };
        } else {
          products.push(nextProduct);
        }

        imported += 1;
        published += 1;
      } catch (err) {
        errors.push(String(err?.message || "Failed to import item"));
      }
    }

    draftsData.drafts = drafts;
    draftsData.generatedAt = new Date().toISOString();
    safeWriteJsonFile(draftsPath, draftsData);

    productsData.products = products;
    productsData.generatedAt = new Date().toISOString();
    safeWriteJsonFile(productsPath, productsData);

    pendingJob.status =
      errors.length > 0 ? "completed_with_errors" : "completed";
    pendingJob.completedAt = new Date().toISOString();
    pendingJob.result = {
      imported,
      published,
      errors,
      productsBefore: beforeCount,
      productsAfter: products.length,
      draftsAfter: drafts.length,
      autoPublishMinScore: minScore,
    };
    safeWriteJsonFile(queuePath, queueData);

    auditData.events = Array.isArray(auditData?.events) ? auditData.events : [];
    auditData.events.push({
      at: new Date().toISOString(),
      type: "import_run",
      tenant_id: activeTenantId,
      jobId: String(pendingJob?.jobId || ""),
      imported,
      published,
      errorsCount: errors.length,
    });
    safeWriteJsonFile(auditPath, auditData);

    return res.json({ ok: true, job: pendingJob });
  } catch (err) {
    return res
      .status(500)
      .json({ error: String(err?.message || "Import failed") });
  }
});

app.post("/admin/unpublish-product", (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const productId = String(req.body?.productId || "").trim();
    if (!productId) {
      return res.status(400).json({ error: "Missing productId" });
    }

    const productsPath = path.join(__dirname, "data", "products.json");
    const draftsPath = path.join(__dirname, "data", "drafts.json");
    const auditPath = path.join(__dirname, "data", "import_audit.json");

    const productsData = safeReadJsonFile(productsPath, {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      products: [],
    });
    const draftsData = safeReadJsonFile(draftsPath, {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      drafts: [],
    });
    const auditData = safeReadJsonFile(auditPath, {
      schemaVersion: 1,
      events: [],
    });

    const products = Array.isArray(productsData?.products)
      ? productsData.products
      : [];
    const drafts = Array.isArray(draftsData?.drafts) ? draftsData.drafts : [];

    const existingProduct = products.find(
      (p) => String(p?.productId || "") === productId,
    );
    if (!existingProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (String(existingProduct?.tenant_id || "default") !== activeTenantId) {
      return res.status(404).json({ error: "Product not found" });
    }

    const nextProducts = products.filter(
      (p) => String(p?.productId || "") !== productId,
    );
    productsData.products = nextProducts;
    productsData.generatedAt = new Date().toISOString();
    safeWriteJsonFile(productsPath, productsData);

    const draftIndex = drafts.findIndex(
      (d) => String(d?.productId || "") === productId,
    );
    if (draftIndex >= 0) {
      const prev = drafts[draftIndex] || {};
      drafts[draftIndex] = {
        ...prev,
        status: "draft",
        updatedAt: new Date().toISOString(),
      };
      draftsData.drafts = drafts;
      draftsData.generatedAt = new Date().toISOString();
      safeWriteJsonFile(draftsPath, draftsData);
    }

    auditData.events = Array.isArray(auditData?.events) ? auditData.events : [];
    auditData.events.push({
      at: new Date().toISOString(),
      type: "unpublish_product",
      tenant_id: activeTenantId,
      productId,
    });
    safeWriteJsonFile(auditPath, auditData);

    return res.json({
      ok: true,
      unpublished: productId,
      productsBefore: products.length,
      productsAfter: nextProducts.length,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to unpublish product") });
  }
});

app.post("/admin/publish-draft", (req, res) => {
  const denied = requireAdmin(req, res);
  if (denied) return denied;

  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const productId = String(req.body?.productId || "").trim();
    if (!productId) {
      return res.status(400).json({ error: "Missing productId" });
    }

    const draftsPath = path.join(__dirname, "data", "drafts.json");
    const productsPath = path.join(__dirname, "data", "products.json");
    const auditPath = path.join(__dirname, "data", "import_audit.json");

    const draftsData = safeReadJsonFile(draftsPath, {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      drafts: [],
    });
    const productsData = safeReadJsonFile(productsPath, {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      products: [],
    });
    const auditData = safeReadJsonFile(auditPath, {
      schemaVersion: 1,
      events: [],
    });

    const drafts = Array.isArray(draftsData?.drafts) ? draftsData.drafts : [];
    const products = Array.isArray(productsData?.products)
      ? productsData.products
      : [];

    const draftIndex = drafts.findIndex(
      (d) => String(d?.productId || "") === productId,
    );
    if (draftIndex < 0) {
      return res.status(404).json({ error: "Draft not found" });
    }

    const draft = drafts[draftIndex] || {};
    if (String(draft?.tenant_id || "default") !== activeTenantId) {
      return res.status(404).json({ error: "Draft not found" });
    }

    if (String(draft?.status || "") === "duplicate") {
      return res.status(400).json({
        error: "Draft is marked as duplicate",
        reasons: draft?.reasons || [],
      });
    }

    const draftProduct =
      draft?.product && typeof draft.product === "object"
        ? draft.product
        : null;
    if (!draftProduct) {
      return res.status(400).json({ error: "Draft has no product data" });
    }

    const { score, reasons } = scoreDraftProduct(draftProduct);
    const autoPublishMinScore = Number(
      process.env.AUTO_PUBLISH_MIN_SCORE || 85,
    );
    const minScore = Number.isFinite(autoPublishMinScore)
      ? autoPublishMinScore
      : 85;

    const duplicateOfProductId = findDuplicateProductId({
      products,
      nextProduct: draftProduct,
    });
    if (duplicateOfProductId && duplicateOfProductId !== productId) {
      reasons.push(`Duplicate of existing productId: ${duplicateOfProductId}`);
      return res
        .status(400)
        .json({ error: "Duplicate product detected", score, reasons });
    }

    if (score < minScore) {
      return res.status(400).json({
        error: "Draft does not meet publish requirements",
        score,
        minScore,
        reasons,
      });
    }

    const existingIndex = products.findIndex(
      (p) => String(p?.productId || "") === productId,
    );
    if (existingIndex >= 0) {
      products[existingIndex] = {
        ...products[existingIndex],
        ...draftProduct,
        audit: {
          ...(products[existingIndex]?.audit || {}),
          updatedAt: new Date().toISOString(),
        },
      };
    } else {
      products.push(draftProduct);
    }

    productsData.products = products;
    productsData.generatedAt = new Date().toISOString();
    safeWriteJsonFile(productsPath, productsData);

    drafts[draftIndex] = {
      ...draft,
      score,
      reasons,
      status: "published",
      updatedAt: new Date().toISOString(),
    };
    draftsData.drafts = drafts;
    draftsData.generatedAt = new Date().toISOString();
    safeWriteJsonFile(draftsPath, draftsData);

    auditData.events = Array.isArray(auditData?.events) ? auditData.events : [];
    auditData.events.push({
      at: new Date().toISOString(),
      type: "publish_draft",
      tenant_id: activeTenantId,
      productId,
    });
    safeWriteJsonFile(auditPath, auditData);

    return res.json({ ok: true, published: productId, score });
  } catch (err) {
    return res
      .status(500)
      .json({ error: String(err?.message || "Failed to publish draft") });
  }
});

app.get("/product.html", (req, res) => {
  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const allowedNiches = Array.isArray(tenant?.catalog?.nicheCategorySlugs)
      ? tenant.catalog.nicheCategorySlugs
          .map((s) => String(s || "").toLowerCase())
          .filter(Boolean)
      : null;
    const allowedProductTypes = Array.isArray(tenant?.catalog?.productTypeSlugs)
      ? tenant.catalog.productTypeSlugs
          .map((s) => String(s || "").toLowerCase())
          .filter(Boolean)
      : null;

    const id = String(req.query?.id || "");
    if (!id) {
      return res.sendFile(path.join(__dirname, "product.html"));
    }

    const { byId } = loadProductsData();
    const product = byId.get(id);
    if (!product) {
      return res.status(404).type("text/plain").send("Not found");
    }

    if (String(product?.tenant_id || "default") !== activeTenantId) {
      return res.status(404).type("text/plain").send("Not found");
    }

    if (allowedNiches && allowedNiches.length > 0) {
      const nicheSlug = String(
        product?.nicheCategory?.slug || "",
      ).toLowerCase();
      if (!allowedNiches.includes(nicheSlug)) {
        return res.status(404).type("text/plain").send("Not found");
      }
    }

    if (allowedProductTypes && allowedProductTypes.length > 0) {
      const typeSlug = String(product?.productType?.slug || "").toLowerCase();
      if (!allowedProductTypes.includes(typeSlug)) {
        return res.status(404).type("text/plain").send("Not found");
      }
    }

    const canonicalPath = String(product?.seo?.canonicalPath || "");
    if (canonicalPath) {
      return res.redirect(301, canonicalPath);
    }

    return res.sendFile(path.join(__dirname, "product.html"));
  } catch {
    return res.status(500).type("text/plain").send("Failed to resolve product");
  }
});

app.get("/api/tenant", (req, res) => {
  const tenant = resolveTenantFromRequest(req);
  const catalog =
    tenant?.catalog && typeof tenant.catalog === "object"
      ? tenant.catalog
      : null;
  const seo = tenant?.seo && typeof tenant.seo === "object" ? tenant.seo : null;
  const offers =
    tenant?.offers && typeof tenant.offers === "object" ? tenant.offers : null;
  const rawPaymentMethods = String(process.env.STRIPE_PAYMENT_METHODS || "card")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const paymentMethods =
    rawPaymentMethods.length > 0 ? rawPaymentMethods : ["card"];
  return res.json({
    tenant_id: String(tenant.tenant_id || "default"),
    currency: String(tenant.currency || ""),
    language: String(tenant.language || ""),
    catalog,
    seo,
    offers,
    payment_methods: paymentMethods,
  });
});

app.get("/api/shipping-estimate", (req, res) => {
  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const id = String(req.query?.id || "");
    if (!id) {
      return res.status(400).json({ error: "Missing product id" });
    }

    const { byId } = loadProductsData();
    const product = byId.get(id);
    if (
      !product ||
      String(product?.tenant_id || "default") !== activeTenantId
    ) {
      return res.status(404).json({ error: "Not found" });
    }

    const country = String(req.query?.country || "GB");
    const estimate = estimateForProduct(product, country);

    return res.json({
      productId: id,
      shipsFrom: shipsFromLabel(product),
      originRegion: originRegion(product),
      destinationRegion: resolveRegion(country),
      minDays: estimate.minDays,
      maxDays: estimate.maxDays,
      estimateLabel: formatEstimate(estimate),
    });
  } catch {
    return res.status(500).json({ error: "Failed to estimate shipping" });
  }
});

app.get("/api/free-shipping-progress", (req, res) => {
  try {
    const tenant = resolveTenantFromRequest(req);
    const thresholdMinor =
      Number(tenant?.offers?.freeShipping?.thresholdMinor) || 0;
    const currency = String(tenant?.currency || "GBP").toUpperCase();
    const subtotalMinor = Number(req.query?.subtotal) || 0;

    const progress = freeShippingProgress(subtotalMinor, {
      thresholdMinor,
      currency,
    });
    return res.json(progress);
  } catch {
    return res
      .status(500)
      .json({ error: "Failed to compute free-shipping progress" });
  }
});

app.get("/api/related-products", (req, res) => {
  try {
    const tenant = resolveTenantFromRequest(req);
    const activeTenantId = String(tenant?.tenant_id || "default");

    const id = String(req.query?.id || "");
    if (!id) {
      return res.status(400).json({ error: "Missing product id" });
    }

    const { list, byId } = loadProductsData();
    const target = byId.get(id);
    if (!target || String(target?.tenant_id || "default") !== activeTenantId) {
      return res.status(404).json({ error: "Not found" });
    }

    const limit = Math.max(1, Math.min(12, Number(req.query?.limit) || 4));

    // Only ever rank against this tenant's own catalog so we never surface
    // another site's products via internal links.
    const tenantCatalog = list.filter(
      (p) => String(p?.tenant_id || "default") === activeTenantId,
    );

    const related = relatedProducts(target, tenantCatalog, { limit }).map(
      (p) => {
        const image = Array.isArray(p?.images) ? p.images[0] : p?.images;
        return {
          productId: String(p?.productId || ""),
          title: String(p?.title || ""),
          canonicalPath: String(p?.seo?.canonicalPath || ""),
          image: image?.src
            ? { src: String(image.src), alt: String(image.alt || "") }
            : null,
          price:
            p?.price && Number.isInteger(p.price.amount)
              ? {
                  amount: p.price.amount,
                  currency: String(p.price.currency || ""),
                }
              : null,
        };
      },
    );

    return res.json({ tenant_id: activeTenantId, productId: id, related });
  } catch {
    return res
      .status(500)
      .json({ error: "Failed to resolve related products" });
  }
});

app.post("/api/capture-email", async (req, res) => {
  try {
    const tenant = resolveTenantFromRequest(req);
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
app.post("/api/submissions", async (req, res) => {
  try {
    const tenant = resolveTenantFromRequest(req);
    const tenantId = String(tenant?.tenant_id || "default");
    const email = normalizeEmail(req.body?.email);
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    const checked = validateSubmission(tenant, req.body);
    if (checked.error) return res.status(400).json({ error: checked.error });
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
app.get("/api/submissions", async (req, res) => {
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
app.get("/api/submissions/stats", async (req, res) => {
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

app.get("/robots.txt", (req, res) => {
  const baseUrl = getBaseUrl(req);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(
    `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${baseUrl}/sitemap.xml\n`,
  );
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

    const resolvedTenant = resolveTenantFromRequest(req);
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
});

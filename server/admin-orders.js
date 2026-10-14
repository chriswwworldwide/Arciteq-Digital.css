// server/admin-orders.js
// Platform admin order operations: stale-order cleanup, Stripe
// reconciliation, order detail, fulfil (+ shipped email), refund (Stripe,
// idempotent) and the abandoned-cart recovery job.

import { requireAdmin, resolveTenantFromRequest } from "./tenancy.js";
import { dbQuery } from "../db.js";
import express from "express";
import { ensureCommerceTables } from "./commerce.js";
import { sendOrderShippedNotice } from "./email.js";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

export function createAdminOrdersRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.post("/admin/orders/cleanup-stale", async (req, res) => {
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

      return res.json({
        ok: true,
        minutes,
        cleaned: orderIds.length,
        orderIds,
      });
    } catch (err) {
      console.error("/admin/orders/cleanup-stale failed", err);
      return res
        .status(500)
        .json({ error: String(err?.message || "Failed to cleanup orders") });
    }
  });

  router.get("/admin/reconcile", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    try {
      if (!ctx.stripe) {
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
        stripeSession = await ctx.stripe.checkout.sessions.retrieve(sessionId);
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
              await ctx.stripe.paymentIntents.retrieve(piFromSession);
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
            await ctx.stripe.paymentIntents.retrieve(paymentIntentId);
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

      const order = Array.isArray(orderResult?.rows)
        ? orderResult.rows[0]
        : null;

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
      const stripePaymentIntentId = String(
        stripePaymentIntent?.id || "",
      ).trim();
      const stripePaymentIntentIdFromSession = String(
        piFromSession || "",
      ).trim();

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
        input: {
          tenantId: activeTenantId,
          orderId,
          sessionId,
          paymentIntentId,
        },
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
          payment_intent_retrieve_error:
            stripePaymentIntentRetrieveError || null,
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

  router.get("/admin/orders/:orderId", async (req, res) => {
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
  router.post(
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
  router.post(
    "/admin/orders/:orderId/refund",
    express.json(),
    async (req, res) => {
      const denied = requireAdmin(req, res);
      if (denied) return denied;
      if (!ctx.stripe) {
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
        const refund = await ctx.stripe.refunds.create(params, {
          idempotencyKey,
        });
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

  router.post("/admin/jobs/abandoned-recovery", async (req, res) => {
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
  return router;
}

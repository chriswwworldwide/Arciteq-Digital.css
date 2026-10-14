// server/stripe-webhook.js
// Stripe webhook handler (POST /stripe/webhook): verifies the signature,
// records the event (processed only after success, so retries re-run
// properly), and applies it — checkout completed / async success / failure
// / expiry, payment failures, refunds, subscriptions and renewal invoices.
// Live dependencies (Stripe client + secret, and the sponsor helpers still
// in server.js) are passed in by server.js after .env.local has loaded.

import crypto from "node:crypto";
import { dbQuery } from "../db.js";
import { normalizeEmail } from "../src/data-stitch.js";
import {
  subscriptionIdFromInvoice,
  metadataFromInvoice,
  subscriptionIdFromSession,
  customerIdOf,
  priceFromSubscription,
  periodEndFromSubscription,
  isoFromUnix,
  isRenewalInvoice,
} from "../src/subscriptions.js";
import {
  ensureAccountToken,
  ensureCommerceTables,
  releaseReservation,
  stitchPaidOrder,
} from "./commerce.js";
import {
  sendOrderConfirmation,
  sendPaymentFailedNotice,
  sendRefundNotice,
} from "./email.js";

export function createStripeWebhookHandler({
  stripe,
  stripeWebhookSecret,
  queueSponsorCandidates,
  renewSponsor,
}) {
  return async (req, res) => {
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

      await ensureCommerceTables();
      await dbQuery(
        "INSERT INTO stripe_events (stripe_event_id, type, payload) VALUES ($1, $2, $3) ON CONFLICT (stripe_event_id) DO NOTHING",
        [stripeEventId, stripeEventType, event],
      );
      // "First time" means not yet successfully processed — a retry after a
      // failed attempt still runs the once-only side effects.
      const eventState = await dbQuery(
        "SELECT processed_at FROM stripe_events WHERE stripe_event_id = $1",
        [stripeEventId],
      );
      const isFirstTimeEvent = !eventState?.rows?.[0]?.processed_at;

      if (
        stripeEventType === "checkout.session.completed" ||
        stripeEventType === "checkout.session.async_payment_succeeded"
      ) {
        const session = event?.data?.object;
        // Delayed payment methods complete the session before money lands
        // (payment_status 'unpaid'); those orders stay pending until
        // async_payment_succeeded arrives.
        const isPaidNow = String(session?.payment_status || "") !== "unpaid";
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
        const amountDiscount = Number.isInteger(
          session?.total_details?.amount_discount,
        )
          ? session.total_details.amount_discount
          : null;
        const amountTax = Number.isInteger(session?.total_details?.amount_tax)
          ? session.total_details.amount_tax
          : null;
        const discountCode = String(
          session?.total_details?.breakdown?.discounts?.[0]?.discount
            ?.promotion_code ||
            session?.metadata?.discount_code ||
            "",
        );

        if (orderId) {
          const upsert = await dbQuery(
            "INSERT INTO orders (order_id, tenant_id, status, currency, amount_subtotal, amount_total, stripe_checkout_session_id, stripe_payment_intent_id, customer_email, items) VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''), '[]'::jsonb) ON CONFLICT (order_id) DO UPDATE SET status = CASE WHEN orders.status IN ('refunded', 'paid') THEN orders.status ELSE EXCLUDED.status END, currency = COALESCE(NULLIF(EXCLUDED.currency, ''), orders.currency), amount_subtotal = EXCLUDED.amount_subtotal, amount_total = EXCLUDED.amount_total, stripe_checkout_session_id = COALESCE(EXCLUDED.stripe_checkout_session_id, orders.stripe_checkout_session_id), stripe_payment_intent_id = COALESCE(EXCLUDED.stripe_payment_intent_id, orders.stripe_payment_intent_id), customer_email = COALESCE(EXCLUDED.customer_email, orders.customer_email), updated_at = now() RETURNING order_id, tenant_id, status, currency, amount_total, customer_email",
            [
              orderId,
              tenantId,
              isPaidNow ? "paid" : "pending",
              currency,
              amountSubtotal,
              amountTotal,
              sessionId,
              paymentIntentId,
              customerEmail,
            ],
          );

          const upserted = Array.isArray(upsert?.rows) ? upsert.rows[0] : null;
          if (amountDiscount !== null || amountTax !== null || discountCode) {
            await dbQuery(
              "UPDATE orders SET amount_discount = $1, amount_tax = $2, discount_code = NULLIF($3, ''), updated_at = now() WHERE order_id = $4",
              [amountDiscount, amountTax, discountCode, orderId],
            );
          }
          try {
            // Capture only once money has actually landed, and only once —
            // an unpaid async session must still be able to release stock.
            if (isPaidNow) {
              await dbQuery(
                "INSERT INTO inventory_movements (tenant_id, product_id, delta, reason, order_id) SELECT tenant_id, product_id, 0, 'capture', order_id FROM inventory_movements m WHERE m.tenant_id = $1 AND m.order_id = $2 AND m.reason = 'reserve' AND NOT EXISTS (SELECT 1 FROM inventory_movements c WHERE c.tenant_id = m.tenant_id AND c.order_id = m.order_id AND c.reason IN ('capture', 'restore'))",
                [tenantId, orderId],
              );
            }
            const normEmail = normalizeEmail(customerEmail);
            if (normEmail && isPaidNow && isFirstTimeEvent) {
              const token = await ensureAccountToken(tenantId, normEmail);
              if (token) {
                await dbQuery(
                  "INSERT INTO order_events (order_id, type, data) VALUES ($1, 'account_token_issued', $2::jsonb)",
                  [orderId, JSON.stringify({ email: normEmail })],
                );
              }
            }
          } catch (invErr) {
            console.error("post-payment commerce hooks failed", invErr);
          }
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
            try {
              await sendOrderConfirmation({
                tenantId: String(upserted.tenant_id || ""),
                orderId: String(upserted.order_id),
                email: String(upserted.customer_email || ""),
                amountTotal: upserted.amount_total,
                currency: upserted.currency,
              });
            } catch (mailErr) {
              console.error("order confirmation email failed", mailErr);
            }
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
              `stripe.${stripeEventType}`,
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

          if (isFirstTimeEvent && isPaidNow) {
            try {
              await queueSponsorCandidates({
                tenantId,
                orderId,
                email: normalizeEmail(customerEmail),
              });
            } catch (spErr) {
              console.error(
                "SPONSOR_QUEUE_FAILED",
                JSON.stringify({
                  orderId,
                  message: String(spErr?.message || spErr),
                }),
              );
            }
          }

          // Data-stitch: on a first-time paid event, bump the customer's running
          // totals, mark any open captured cart as converted (attributing which
          // nudge won), and log a unified order_completed funnel event.
          if (customerEmail && isFirstTimeEvent && isPaidNow) {
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
        } else if (sessionId && isPaidNow) {
          const updated = await dbQuery(
            "UPDATE orders SET status = $1, currency = COALESCE(NULLIF($2, ''), currency), amount_subtotal = $3, amount_total = $4, stripe_checkout_session_id = COALESCE(NULLIF($5, ''), stripe_checkout_session_id), stripe_payment_intent_id = COALESCE(NULLIF($6, ''), stripe_payment_intent_id), customer_email = COALESCE(NULLIF($7, ''), customer_email), updated_at = now() WHERE stripe_checkout_session_id = $5 AND status <> 'refunded' RETURNING order_id, tenant_id, status, currency, amount_total, customer_email",
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

            try {
              await sendOrderConfirmation({
                tenantId: String(updatedRow.tenant_id || ""),
                orderId: String(updatedRow.order_id),
                email: String(updatedRow.customer_email || ""),
                amountTotal: updatedRow.amount_total,
                currency: updatedRow.currency,
              });
            } catch (mailErr) {
              console.error("order confirmation email failed", mailErr);
            }

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
            "UPDATE orders SET status = $1, stripe_checkout_session_id = COALESCE(NULLIF($2, ''), stripe_checkout_session_id), stripe_payment_intent_id = COALESCE(NULLIF($3, ''), stripe_payment_intent_id), updated_at = now() WHERE tenant_id = $4 AND order_id = $5 AND status = $6 RETURNING order_id, tenant_id, customer_email",
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
            if (nextStatus === "failed") {
              try {
                await sendPaymentFailedNotice({
                  tenantId: String(updatedRow.tenant_id || tenantId),
                  orderId: String(updatedRow.order_id),
                  email: String(updatedRow.customer_email || ""),
                });
              } catch (mailErr) {
                console.error("payment failed email failed", mailErr);
              }
            }
          }
        } else if (sessionId) {
          const updated = await dbQuery(
            "UPDATE orders SET status = $1, stripe_payment_intent_id = COALESCE(NULLIF($2, ''), stripe_payment_intent_id), updated_at = now() WHERE stripe_checkout_session_id = $3 AND status = $4 RETURNING order_id, tenant_id, customer_email",
            [nextStatus, paymentIntentId, sessionId, "pending"],
          );
          const updatedRow = Array.isArray(updated?.rows)
            ? updated.rows[0]
            : null;
          if (updatedRow?.order_id && nextStatus === "failed") {
            try {
              await sendPaymentFailedNotice({
                tenantId: String(updatedRow.tenant_id || tenantId),
                orderId: String(updatedRow.order_id),
                email: String(updatedRow.customer_email || ""),
              });
            } catch (mailErr) {
              console.error("payment failed email failed", mailErr);
            }
          }
        }
        try {
          await ensureCommerceTables();
          await releaseReservation(tenantId, orderId || null, "restore");
        } catch (invErr) {
          console.error("stock restore on checkout end failed", invErr);
        }
      } else if (stripeEventType === "payment_intent.payment_failed") {
        const paymentIntent = event?.data?.object;
        const paymentIntentId = String(paymentIntent?.id || "");
        if (paymentIntentId) {
          const failed = await dbQuery(
            "UPDATE orders SET status = $1, updated_at = now() WHERE stripe_payment_intent_id = $2 AND status = $3 RETURNING order_id, tenant_id, customer_email",
            ["failed", paymentIntentId, "pending"],
          );
          const failedRow = Array.isArray(failed?.rows) ? failed.rows[0] : null;
          if (failedRow?.order_id) {
            try {
              await sendPaymentFailedNotice({
                tenantId: String(failedRow.tenant_id || ""),
                orderId: String(failedRow.order_id),
                email: String(failedRow.customer_email || ""),
              });
            } catch (mailErr) {
              console.error("payment failed email failed", mailErr);
            }
          }
        }
      } else if (stripeEventType === "charge.refunded") {
        const charge = event?.data?.object;
        const rawPi = charge?.payment_intent;
        const paymentIntentId =
          typeof rawPi === "string" ? rawPi : String(rawPi?.id || "");
        if (paymentIntentId) {
          // charge.refunded === true means fully refunded; a partial refund
          // still logs an order event but keeps the order paid so the tax
          // report counts the retained amount correctly.
          const fullyRefunded = charge?.refunded === true;
          const refunded = fullyRefunded
            ? await dbQuery(
                "UPDATE orders SET status = $1, updated_at = now() WHERE stripe_payment_intent_id = $2 AND status = $3 RETURNING order_id, tenant_id, customer_email, amount_total, currency",
                ["refunded", paymentIntentId, "paid"],
              )
            : await dbQuery(
                "SELECT order_id, tenant_id, customer_email, amount_total, currency FROM orders WHERE stripe_payment_intent_id = $1 AND status = 'paid'",
                [paymentIntentId],
              );
          const refundedRow = Array.isArray(refunded?.rows)
            ? refunded.rows[0]
            : null;
          if (refundedRow?.order_id) {
            await dbQuery(
              "INSERT INTO order_events (order_id, type, data) SELECT $1, $2, $3::jsonb WHERE NOT EXISTS (SELECT 1 FROM order_events WHERE order_id = $1 AND type = $2 AND data->>'stripeEventId' = $4)",
              [
                String(refundedRow.order_id),
                "refund",
                JSON.stringify({
                  stripeEventId,
                  paymentIntentId,
                  chargeId: String(charge?.id || ""),
                  amountRefunded: charge?.amount_refunded ?? null,
                  partial: !fullyRefunded,
                }),
                stripeEventId,
              ],
            );
            try {
              await sendRefundNotice({
                tenantId: String(refundedRow.tenant_id || ""),
                orderId: String(refundedRow.order_id),
                email: String(refundedRow.customer_email || ""),
                amountTotal:
                  charge?.amount_refunded ?? refundedRow.amount_total,
                currency: refundedRow.currency,
              });
            } catch (mailErr) {
              console.error("refund email failed", mailErr);
            }
          }
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
          // Hong Kong attribution rule: recurring revenue must stay with the
          // originating tenant. Never silently file it under "default" —
          // "unattributed" is visible in the tax report and escalated by
          // the exception sweep.
          const tenantId = String(
            meta?.tenant_id || known?.tenant_id || "unattributed",
          );
          if (tenantId === "unattributed") {
            console.error(
              "RENEWAL_TENANT_UNKNOWN",
              JSON.stringify({ subscriptionId, stripeEventId }),
            );
          }
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
            // Order id derives from the invoice, so a retried event can never
            // create a second renewal order. Tax + payment intent are kept so
            // renewals show in the tax report and can be refunded.
            const renewalOrderId = invoiceId
              ? `renewal_${invoiceId}`
              : crypto.randomUUID();
            const rawInvoicePi = invoice?.payment_intent;
            const invoicePaymentIntentId =
              typeof rawInvoicePi === "string"
                ? rawInvoicePi
                : String(rawInvoicePi?.id || "");
            const invoiceTax = Number.isInteger(invoice?.tax)
              ? invoice.tax
              : Array.isArray(invoice?.total_tax_amounts)
                ? invoice.total_tax_amounts.reduce(
                    (sum, t) => sum + (Number(t?.amount) || 0),
                    0,
                  )
                : null;
            const invoiceSubtotal = Number.isInteger(invoice?.subtotal)
              ? invoice.subtotal
              : amountPaid;
            await dbQuery(
              "INSERT INTO orders (order_id, tenant_id, status, currency, amount_subtotal, amount_total, amount_tax, customer_email, items, stripe_subscription_id, stripe_payment_intent_id) VALUES ($1, $2, 'paid', $3, $4, $5, $6, NULLIF($7, ''), '[]'::jsonb, $8, NULLIF($9, '')) ON CONFLICT (order_id) DO NOTHING",
              [
                renewalOrderId,
                tenantId,
                currency,
                invoiceSubtotal,
                amountPaid,
                invoiceTax,
                email,
                subscriptionId,
                invoicePaymentIntentId,
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
            const periodEnd = isoFromUnix(
              invoice?.lines?.data?.[0]?.period?.end ?? invoice?.period_end,
            );
            await dbQuery(
              "UPDATE subscriptions SET status = 'active', current_period_end = COALESCE($2, current_period_end), updated_at = now() WHERE stripe_subscription_id = $1",
              [subscriptionId, periodEnd],
            );
            try {
              renewSponsor({
                tenantId,
                orderId: String(known?.order_id || meta?.order_id || ""),
                periodEnd,
              });
            } catch (spErr) {
              console.error(
                "SPONSOR_RENEW_FAILED",
                JSON.stringify({
                  subscriptionId,
                  message: String(spErr?.message || spErr),
                }),
              );
            }
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

      await dbQuery(
        "UPDATE stripe_events SET processed_at = now() WHERE stripe_event_id = $1",
        [stripeEventId],
      );
      return res.json({ received: true });
    } catch (err) {
      const message = String(err?.message || "Webhook error");
      // Bad signature = permanent rejection (400). Anything else is a
      // processing failure: 500 tells Stripe to retry, and because
      // processed_at stays empty the retry re-runs the full handler.
      if (err?.type === "StripeSignatureVerificationError") {
        return res.status(400).json({ error: message });
      }
      console.error("STRIPE_WEBHOOK_FAILED", message);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  };
}

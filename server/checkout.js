// server/checkout.js
// Creates the Stripe Checkout session for a cart: tenant + currency checks,
// product/catalogue validation, stock reservation (released on failure),
// pending order record with attribution, optional Stripe automatic tax.

import { resolveTenantForPublicWrite } from "./tenancy.js";
import { loadProductsData } from "./data-files.js";
import { isRecurringProduct } from "../src/catalog-qa.js";
import crypto from "node:crypto";
import { seedInventory, reserveStock, releaseReservation } from "./commerce.js";
import { dbQuery } from "../db.js";
import express from "express";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

export function createCheckoutRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.post("/create-checkout-session", async (req, res) => {
    try {
      const requestTenant = resolveTenantForPublicWrite(
        req,
        req.body?.tenant_id,
      );
      if (String(requestTenant?.shop?.status || "") === "opening-soon") {
        return res
          .status(403)
          .json({ error: "This shop is not open for orders yet." });
      }

      if (!ctx.stripe) {
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
          const typeSlug = String(
            product?.productType?.slug || "",
          ).toLowerCase();
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

      const recurringCount = normalizedItems.filter(
        (it) => it.recurring,
      ).length;
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
            ...(ctx.automaticTaxEnabled ? { tax_behavior: "inclusive" } : {}),
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

      const origin = req.headers.origin || `http://localhost:${ctx.PORT}`;

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

        const session = await ctx.stripe.checkout.sessions.create({
          mode: checkoutMode,
          payment_method_types: paymentMethodTypes,
          line_items,
          allow_promotion_codes: true,
          ...(ctx.automaticTaxEnabled
            ? { automatic_tax: { enabled: true } }
            : {}),
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
            console.error(
              "stock release after checkout failure failed",
              relErr,
            ),
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
  return router;
}

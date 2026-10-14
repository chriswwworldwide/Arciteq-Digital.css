// server/shop.js
// Shop operations: checkout cancel (releases reserved stock), live stock
// API, admin discount codes + inventory, customer account page + emailed
// account link (trusted base URL, rate-limited), admin env check.

import express from "express";
import { dbQuery } from "../db.js";
import {
  ensureCommerceTables,
  releaseReservation,
  seedInventory,
  moveStock,
  stockFor,
  renderAccountPage,
  ensureAccountToken,
} from "./commerce.js";
import {
  resolveTenantFromRequest,
  requireAdmin,
  trustedBaseUrlForTenant,
} from "./tenancy.js";
import { normalizeEmail } from "../src/data-stitch.js";
import { sendViaResend } from "./email.js";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

export function createShopRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.post("/checkout/cancel", express.json(), async (req, res) => {
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
      return res
        .status(500)
        .json({ error: "Failed to mark checkout cancelled" });
    }
  });

  router.get("/checkout/cancel", async (req, res) => {
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
  router.get("/api/stock", async (req, res) => {
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
  router.post("/admin/discounts", express.json(), async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    try {
      if (!ctx.stripe) {
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
      const coupon = await ctx.stripe.coupons.create({
        ...(percentOff ? { percent_off: percentOff } : {}),
        ...(amountOff ? { amount_off: amountOff, currency } : {}),
        duration: "once",
        name: code,
      });
      const promo = await ctx.stripe.promotionCodes.create({
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
  router.get("/admin/inventory", async (req, res) => {
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

  router.post("/admin/inventory", express.json(), async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;
    try {
      const tenantId = String(req.body?.tenant_id || "default");
      const productId = String(req.body?.product_id || "").trim();
      const stock = req.body?.stock;
      const adjust = Number.isInteger(req.body?.adjust)
        ? req.body.adjust
        : null;
      if (!productId || (!Number.isInteger(stock) && adjust === null)) {
        return res
          .status(400)
          .json({
            error: "Provide product_id plus stock (absolute) or adjust",
          });
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
  router.get("/account/:token", async (req, res) => {
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
  router.post("/api/account/link", express.json(), async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const tenantId = String(req.body?.tenant_id || "default");
      const allowed =
        ctx.accountLinkLimiter.check(`ip:${req.ip}`).ok &&
        (!email || ctx.accountLinkLimiter.check(`email:${email}`).ok);
      if (email && allowed) {
        await ensureCommerceTables();
        const known = await dbQuery(
          "SELECT 1 FROM customers WHERE tenant_id = $1 AND email = $2",
          [tenantId, email],
        );
        const token =
          known?.rowCount > 0
            ? await ensureAccountToken(tenantId, email)
            : null;
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

  router.get("/admin/env", (req, res) => {
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
  return router;
}

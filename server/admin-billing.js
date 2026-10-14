// server/admin-billing.js
// Platform admin money views: orders list, accountant tax/VAT report
// (JSON/CSV, per tenant or platform-wide), and platform payments (what
// gyms pay us: record + list + aggregate).

import { requireAdmin, resolveTenantFromRequest } from "./tenancy.js";
import { dbQuery } from "../db.js";
import express from "express";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

export function createAdminBillingRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.get("/admin/orders", async (req, res) => {
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
  router.get("/admin/tax-report", async (req, res) => {
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
  router.get("/admin/platform-payments", async (req, res) => {
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

      params.push(Math.max(1, Math.min(200, Number(req.query?.limit) || 100)));
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

  router.post("/admin/platform-payments", express.json(), async (req, res) => {
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
      const methods = new Set(["stripe", "bank_transfer", "cash", "other"]);
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
  });
  return router;
}

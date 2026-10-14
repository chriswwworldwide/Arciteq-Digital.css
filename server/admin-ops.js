// server/admin-ops.js
// Platform admin: heartbeat + alerts + exceptions ledgers, ad spend and
// spend guardrails, attribution summary, ops health and trends dashboards.

import { requireAdmin, resolveTenantFromRequest } from "./tenancy.js";
import {
  evaluateAndRecordAlerts,
  runExceptionSweep,
  exceptionsFilePath,
} from "./ops.js";
import path from "path";
import { safeReadJsonFile, safeWriteJsonFile, ROOT_DIR } from "./data-files.js";
import express from "express";
import { dbQuery } from "../db.js";

// Live values still owned by server.js, linked in when the router mounts.
const ctx = {};

export function createAdminOpsRouter(deps) {
  Object.assign(ctx, deps);
  const router = express.Router();
  router.get("/admin/heartbeat", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    return res.json({
      ok: true,
      heartbeat: ctx.heartbeatState,
    });
  });

  router.post("/admin/alerts/run", async (req, res) => {
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

  router.get("/admin/alerts", async (req, res) => {
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

      const alertsPath = path.join(ROOT_DIR, "data", "alerts.json");
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
        alert_email_to: ctx.alertEmailTo ? "configured" : "not_configured",
        alerts: filtered,
      });
    } catch (err) {
      console.error("/admin/alerts failed", err);
      return res
        .status(500)
        .json({ error: String(err?.message || "Failed to load alerts") });
    }
  });

  router.post("/admin/exceptions/run", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    try {
      const tenant = resolveTenantFromRequest(req);
      const result = await runExceptionSweep({ tenant, now: new Date() });
      return res.json({
        ok: true,
        tenant_id: String(tenant?.tenant_id || "default"),
        ...result,
      });
    } catch (err) {
      console.error("/admin/exceptions/run failed", err);
      return res.status(500).json({
        error: String(err?.message || "Failed to run exception sweep"),
      });
    }
  });

  router.get("/admin/exceptions", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");
      const actionFilter = String(req.query?.action || "").trim();
      const limitRaw = Number(req.query?.limit);
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0
          ? Math.min(Math.floor(limitRaw), 200)
          : 50;

      const store = safeReadJsonFile(exceptionsFilePath, {
        schemaVersion: 1,
        updatedAt: "",
        exceptions: [],
      });
      const list = Array.isArray(store?.exceptions) ? store.exceptions : [];
      const filtered = list
        .filter((e) => String(e?.tenant_id || "") === activeTenantId)
        .filter(
          (e) => !actionFilter || String(e?.action || "") === actionFilter,
        )
        .slice()
        .sort((a, b) =>
          String(b?.createdAt || "").localeCompare(String(a?.createdAt || "")),
        )
        .slice(0, limit);

      return res.json({
        ok: true,
        tenant_id: activeTenantId,
        updatedAt: String(store?.updatedAt || ""),
        exceptions: filtered,
      });
    } catch (err) {
      console.error("/admin/exceptions failed", err);
      return res
        .status(500)
        .json({ error: String(err?.message || "Failed to load exceptions") });
    }
  });

  router.get("/admin/ad-spend", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");

      const spendPath = path.join(ROOT_DIR, "data", "ad_spend.json");
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

  router.post("/admin/ad-spend", express.json(), async (req, res) => {
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

      const spendPath = path.join(ROOT_DIR, "data", "ad_spend.json");
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

  router.get("/admin/ad-guardrails", async (req, res) => {
    const denied = requireAdmin(req, res);
    if (denied) return denied;

    try {
      const tenant = resolveTenantFromRequest(req);
      const activeTenantId = String(tenant?.tenant_id || "default");

      const filePath = path.join(ROOT_DIR, "data", "ad_guardrails.json");
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
        .json({
          error: String(err?.message || "Failed to load ad guardrails"),
        });
    }
  });

  router.post("/admin/ad-guardrails", express.json(), async (req, res) => {
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

      const filePath = path.join(ROOT_DIR, "data", "ad_guardrails.json");
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
        .json({
          error: String(err?.message || "Failed to save ad guardrails"),
        });
    }
  });

  router.get("/admin/attribution-summary", async (req, res) => {
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
      if (
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime())
      ) {
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

  router.get("/admin/ops-health", async (req, res) => {
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
      const stalePendingCount =
        Number(stalePending?.rows?.[0]?.count || 0) || 0;

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

  router.get("/admin/ops-trends", async (req, res) => {
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

      const spendPath = path.join(ROOT_DIR, "data", "ad_spend.json");
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

      const ordersRows = Array.isArray(ordersDaily?.rows)
        ? ordersDaily.rows
        : [];
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
  return router;
}

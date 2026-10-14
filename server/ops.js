// server/ops.js
// The self-running ops engine: alert rules, the exceptions sweep (auto-fix
// safe problems, escalate risky ones, daily retention prune) and the
// heartbeat that runs both for every tenant on a timer.
// Live state (heartbeat status, recent 5xx list) is created in server.js
// after .env.local loads and linked in via attachOpsState(); settings are
// read from process.env at call time.

import crypto from "node:crypto";
import path from "node:path";
import { dbQuery } from "../db.js";
import { ROOT_DIR, safeReadJsonFile, safeWriteJsonFile } from "./data-files.js";
import { sendAlertEmail, buildAlertEmail, sendOrderConfirmation } from "./email.js";
import { ensureCommerceTables, releaseReservation } from "./commerce.js";

const alertTo = () => String(process.env.ALERT_EMAIL_TO || "").trim();

let shared = { heartbeatState: null, recentServerErrors: [] };
export function attachOpsState(state) {
  shared = state;
}

export async function evaluateAndRecordAlerts({ tenant, now }) {
  const alertEmailTo = alertTo();
  const activeTenantId = String(tenant?.tenant_id || "default");
  const tsNow = now instanceof Date ? now : new Date();
  const alertsPath = path.join(ROOT_DIR, "data", "alerts.json");
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
    "SELECT order_id, created_at, updated_at, customer_email, amount_total, currency FROM orders WHERE tenant_id=$1 AND status='paid' AND fulfilled_at IS NULL AND updated_at < $2 ORDER BY updated_at ASC LIMIT 10",
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

  const spendPath = path.join(ROOT_DIR, "data", "ad_spend.json");
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
  if (shared.recentServerErrors.length >= errorSpikeThreshold) {
    await add({
      type: "server_error_spike",
      severity: "warning",
      message: `High server error rate: ${shared.recentServerErrors.length} responses with 5xx in the last 15 minutes.`,
      data: {
        count_15m: shared.recentServerErrors.length,
        sample: shared.recentServerErrors.slice(-10),
      },
    });
  }

  store.schemaVersion = 1;
  store.updatedAt = tsNow.toISOString();
  store.alerts = existing.slice(-500);
  safeWriteJsonFile(alertsPath, store);

  return { created };
}

// Exceptions engine — runs inside the heartbeat per tenant. Rule: only
// auto-fix actions that are safe, idempotent, and reversible; anything
// risky gets escalated by email instead. Every outcome is recorded to
// data/exceptions.json so the "dealt with it" list is auditable.
export const exceptionsFilePath = path.join(ROOT_DIR, "data", "exceptions.json");

export async function runExceptionSweep({ tenant, now }) {
  const alertEmailTo = alertTo();
  const activeTenantId = String(tenant?.tenant_id || "default");
  const tsNow = now instanceof Date ? now : new Date();
  const store = safeReadJsonFile(exceptionsFilePath, {
    schemaVersion: 1,
    updatedAt: "",
    exceptions: [],
  });
  const existing = Array.isArray(store?.exceptions) ? store.exceptions : [];

  const dedupeWindowMs = 6 * 60 * 60 * 1000;
  const alreadyReported = (check) => {
    const cutoff = tsNow.getTime() - dedupeWindowMs;
    return existing.some(
      (e) =>
        String(e?.tenant_id || "") === activeTenantId &&
        String(e?.check || "") === check &&
        Number.isFinite(new Date(e?.createdAt || "").getTime()) &&
        new Date(e.createdAt).getTime() >= cutoff,
    );
  };

  const recorded = [];
  const record = async ({ check, action, message, data }) => {
    if (alreadyReported(check)) return;
    const entry = {
      id: crypto.randomBytes(10).toString("hex"),
      tenant_id: activeTenantId,
      check: String(check || "unknown"),
      action: String(action || "auto_fixed"),
      message: String(message || ""),
      data: data && typeof data === "object" ? data : {},
      createdAt: tsNow.toISOString(),
      emailedTo: "",
    };
    if (entry.action === "escalated" && alertEmailTo) {
      const email = await sendAlertEmail({
        to: alertEmailTo,
        subject: `[${activeTenantId}] exception: ${entry.check}`,
        body: `${entry.message}\n\n${JSON.stringify(entry.data, null, 2)}`,
      });
      entry.emailedTo = email.ok
        ? alertEmailTo
        : `failed: ${String(email.error || "unknown")}`;
    }
    existing.push(entry);
    recorded.push(entry);
  };

  // 1. Pending orders that never resolved (checkout session existed but the
  //    expired/failed webhook never landed). Auto: abandon + release stock.
  const stalePending = await dbQuery(
    "SELECT order_id FROM orders WHERE tenant_id = $1 AND status = 'pending' AND created_at < now() - interval '24 hours' LIMIT 50",
    [activeTenantId],
  );
  const staleIds = (stalePending?.rows || [])
    .map((r) => String(r?.order_id || ""))
    .filter(Boolean);
  const abandoned = [];
  for (const oid of staleIds) {
    const upd = await dbQuery(
      "UPDATE orders SET status = 'abandoned', updated_at = now() WHERE tenant_id = $1 AND order_id = $2 AND status = 'pending' RETURNING order_id",
      [activeTenantId, oid],
    );
    if (upd?.rowCount > 0) {
      abandoned.push(oid);
      try {
        await releaseReservation(activeTenantId, oid, "restore");
      } catch (invErr) {
        console.error("sweep stock restore failed", oid, invErr);
      }
      await dbQuery(
        "INSERT INTO order_events (order_id, type, data) VALUES ($1, $2, $3::jsonb)",
        [
          oid,
          "auto_abandoned",
          JSON.stringify({ reason: "exception_sweep_stale_pending" }),
        ],
      );
    }
  }
  if (abandoned.length > 0) {
    await record({
      check: "stale_pending_orders",
      action: "auto_fixed",
      message: `${abandoned.length} stale pending order(s) auto-abandoned and reservations released.`,
      data: { orderIds: abandoned },
    });
  }

  // 2. Reservation leaks: terminal orders still holding reserved stock.
  const leaks = await dbQuery(
    `SELECT DISTINCT m.order_id FROM inventory_movements m
     JOIN orders o ON o.tenant_id = m.tenant_id AND o.order_id = m.order_id
     WHERE m.tenant_id = $1 AND m.reason = 'reserve' AND m.order_id IS NOT NULL
       AND o.status IN ('abandoned', 'failed', 'refunded')
       AND NOT EXISTS (
         SELECT 1 FROM inventory_movements r
         WHERE r.tenant_id = m.tenant_id AND r.order_id = m.order_id
           AND r.reason IN ('restore', 'capture')
       )
     LIMIT 50`,
    [activeTenantId],
  );
  const released = [];
  for (const row of leaks?.rows || []) {
    const oid = String(row?.order_id || "");
    if (!oid) continue;
    try {
      await releaseReservation(activeTenantId, oid, "restore");
      released.push(oid);
    } catch (invErr) {
      console.error("sweep leak restore failed", oid, invErr);
    }
  }
  if (released.length > 0) {
    await record({
      check: "reservation_leak",
      action: "auto_fixed",
      message: `${released.length} terminal order(s) still held stock — reservations released.`,
      data: { orderIds: released },
    });
  }

  // 3. Paid orders whose confirmation email never sent. Auto-resend
  //    (idempotent); escalate only if still missing after 24h.
  const missingConfirm = await dbQuery(
    `SELECT order_id, customer_email, amount_total, currency, created_at FROM orders
     WHERE tenant_id = $1 AND status = 'paid'
       AND created_at < now() - interval '15 minutes'
       AND created_at > now() - interval '3 days'
       AND stripe_checkout_session_id IS NOT NULL
       AND customer_email IS NOT NULL AND customer_email <> ''
       AND NOT EXISTS (
         SELECT 1 FROM email_events e
         WHERE e.tenant_id = orders.tenant_id AND e.order_id = orders.order_id
           AND e.type = 'order_confirmation' AND e.data->>'ok' = 'true'
       )
     ORDER BY created_at ASC LIMIT 10`,
    [activeTenantId],
  );
  const resent = [];
  const stillMissing = [];
  for (const row of missingConfirm?.rows || []) {
    const res = await sendOrderConfirmation({
      tenantId: activeTenantId,
      orderId: String(row.order_id),
      email: String(row.customer_email || ""),
      amountTotal: row.amount_total,
      currency: row.currency,
    });
    if (res?.ok) {
      resent.push(String(row.order_id));
    } else if (new Date(row.created_at) < new Date(tsNow.getTime() - 24 * 3600 * 1000)) {
      stillMissing.push({
        orderId: String(row.order_id),
        error: String(res?.error || "send failed"),
      });
    }
  }
  if (resent.length > 0) {
    await record({
      check: "confirmation_missing",
      action: "auto_fixed",
      message: `${resent.length} missing order confirmation(s) re-sent.`,
      data: { orderIds: resent },
    });
  }
  if (stillMissing.length > 0) {
    await record({
      check: "confirmation_missing",
      action: "escalated",
      message: `${stillMissing.length} paid order(s) over 24h old still have no confirmation email.`,
      data: { orders: stillMissing },
    });
  }

  // 4. Email provider trouble: recent send failures pile up → escalate.
  const emailFails = await dbQuery(
    "SELECT COUNT(*)::int AS n FROM email_events WHERE tenant_id = $1 AND at >= now() - interval '24 hours' AND data->>'ok' = 'false'",
    [activeTenantId],
  );
  const emailFailCount = Number(emailFails?.rows?.[0]?.n || 0);
  if (emailFailCount >= 3) {
    await record({
      check: "email_send_failures",
      action: "escalated",
      message: `${emailFailCount} failed email send(s) in the last 24h — check the mail provider.`,
      data: { failed_24h: emailFailCount },
    });
  }

  // 5. Negative inventory → escalate (never silently clamp stock).
  const negStock = await dbQuery(
    "SELECT product_id, stock FROM inventory WHERE tenant_id = $1 AND stock < 0 LIMIT 10",
    [activeTenantId],
  );
  if ((negStock?.rows || []).length > 0) {
    await record({
      check: "negative_inventory",
      action: "escalated",
      message: `${negStock.rows.length} product(s) have negative stock — oversell or missed restock.`,
      data: { products: negStock.rows },
    });
  }

  // 6. Failed-payment burst → escalate (checkout broken or attack).
  const failedBurst = await dbQuery(
    "SELECT COUNT(*)::int AS n FROM orders WHERE tenant_id = $1 AND status = 'failed' AND updated_at >= now() - interval '1 hour'",
    [activeTenantId],
  );
  const failedCount = Number(failedBurst?.rows?.[0]?.n || 0);
  if (failedCount >= 5) {
    await record({
      check: "failed_payment_burst",
      action: "escalated",
      message: `${failedCount} failed order(s) in the last hour — check Stripe dashboard.`,
      data: { failed_1h: failedCount },
    });
  }

  // 7. Renewal revenue that couldn't be traced to a tenant (HK attribution
  //    rule). Platform-wide, so only checked from the default tenant's pass.
  if (activeTenantId === "default") {
    const unattributed = await dbQuery(
      "SELECT order_id, stripe_subscription_id, amount_total, currency, created_at FROM orders WHERE tenant_id = 'unattributed' ORDER BY created_at DESC LIMIT 20",
      [],
    );
    if ((unattributed?.rows || []).length > 0) {
      await record({
        check: "unattributed_revenue",
        action: "escalated",
        message: `${unattributed.rows.length} renewal order(s) could not be attributed to a tenant — fix the subscription metadata and reassign.`,
        data: { orders: unattributed.rows },
      });
    }
  }

  // 8. Data retention — once per 24h per tenant, prune high-volume tables
  //    that grow forever. Windows are deliberately generous; this is
  //    housekeeping, not compliance erasure.
  const retentionMap =
    store.lastRetentionAt && typeof store.lastRetentionAt === "object"
      ? store.lastRetentionAt
      : {};
  const lastRetentionAt = new Date(retentionMap[activeTenantId] || 0).getTime();
  if (tsNow.getTime() - lastRetentionAt >= 24 * 60 * 60 * 1000) {
    const pruned = {};
    try {
      const pv = await dbQuery(
        "DELETE FROM page_views WHERE tenant_id = $1 AND at < now() - interval '180 days'",
        [activeTenantId],
      );
      pruned.page_views = pv?.rowCount || 0;
    } catch (pvErr) {
      console.error("retention prune page_views failed", pvErr);
    }
    // stripe_events is platform-wide, so only the default tenant prunes it.
    if (activeTenantId === "default") {
      try {
        const se = await dbQuery(
          "DELETE FROM stripe_events WHERE created_at < now() - interval '180 days'",
          [],
        );
        pruned.stripe_events = se?.rowCount || 0;
      } catch (seErr) {
        console.error("retention prune stripe_events failed", seErr);
      }
    }
    try {
      const ee = await dbQuery(
        "DELETE FROM email_events WHERE tenant_id = $1 AND at < now() - interval '365 days'",
        [activeTenantId],
      );
      pruned.email_events = ee?.rowCount || 0;
    } catch (eeErr) {
      console.error("retention prune email_events failed", eeErr);
    }
    retentionMap[activeTenantId] = tsNow.toISOString();
    store.lastRetentionAt = retentionMap;
    if (Object.values(pruned).some((n) => n > 0)) {
      await record({
        check: "retention_pruned",
        action: "auto_fixed",
        message: "Retention sweep pruned old rows.",
        data: pruned,
      });
    }
  }

  store.schemaVersion = 1;
  store.updatedAt = tsNow.toISOString();
  store.exceptions = existing.slice(-500);
  safeWriteJsonFile(exceptionsFilePath, store);

  return { recorded };
}

export async function runHeartbeatOnce() {
  const now = new Date();
  shared.heartbeatState.lastRunAt = now.toISOString();
  shared.heartbeatState.lastError = "";
  shared.heartbeatState.lastCreatedCount = 0;

  try {
    await ensureCommerceTables();
    const tenantsPath = path.join(ROOT_DIR, "data", "tenants.json");
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
      try {
        await runExceptionSweep({ tenant, now });
      } catch (sweepErr) {
        console.error("exception sweep failed", tenantId, sweepErr);
      }
    }

    shared.heartbeatState.lastCreatedCount = createdTotal;
    shared.heartbeatState.lastOk = true;
  } catch (err) {
    shared.heartbeatState.lastOk = false;
    shared.heartbeatState.lastError = String(err?.message || "Heartbeat failed");
  }
}

export function startHeartbeatScheduler() {
  const minutes = shared.heartbeatState.intervalMinutes;
  const ms = Math.max(60 * 1000, minutes * 60 * 1000);
  setTimeout(() => {
    void runHeartbeatOnce();
  }, 10 * 1000);
  setInterval(() => {
    void runHeartbeatOnce();
  }, ms);
}

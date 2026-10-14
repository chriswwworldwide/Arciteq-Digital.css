// server/email.js
// All outgoing email: transport (Resend API when RESEND_API_KEY is set,
// otherwise /usr/sbin/sendmail), tenant-branded customer order emails
// (confirmation / refund / payment failed / shipped, deduped via
// email_events) and the ops alert email builder.
// Settings are read from process.env at call time, never at import time:
// server.js loads .env.local after its imports run.

import { spawn } from "node:child_process";
import { dbQuery } from "../db.js";
import { normalizeEmail } from "../src/data-stitch.js";
import { loadTenantsData } from "./data-files.js";

// Transactional mail. Prefers the Resend HTTP API when RESEND_API_KEY is set
// (Railway has no local MTA); otherwise pipes through /usr/sbin/sendmail.
export async function sendViaResend({ to, subject, body, from }) {
  const key = String(process.env.RESEND_API_KEY || "").trim();
  if (!key) return null;
  const sender = String(
    from || process.env.ALERT_EMAIL_FROM || "Roxjaya <desk@roxjaya.com>",
  ).trim();
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: sender, to: [to], subject, text: body }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return {
        ok: false,
        provider: "resend",
        error: String(data?.message || `resend ${r.status}`),
      };
    }
    return { ok: true, provider: "resend", id: data?.id || null };
  } catch (err) {
    return {
      ok: false,
      provider: "resend",
      error: String(err?.message || "resend failed"),
    };
  }
}

export async function sendAlertEmail({ to, subject, body, from }) {
  const address = String(to || "").trim();
  if (!address) return { ok: false, error: "Missing recipient" };
  const safeSubject = String(subject || "Alert")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 200);
  const viaApi = await sendViaResend({
    to: address,
    subject: safeSubject,
    body: String(body || ""),
    from,
  });
  if (viaApi) return viaApi;
  return sendViaSendmail({ to: address, subject: safeSubject, body });
}

export function sendViaSendmail({ to, subject, body }) {
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

// Customer-facing order emails (confirmation, refund, payment-failed,
// shipped). One helper owns tenant branding on the From line (the
// tenant's brand name + the platform's verified mailbox), email_events
// logging, and per-(tenant, order, type) dedup so webhook retries can
// never double-send.
export async function sendBrandedOrderEmail({
  tenantId,
  orderId,
  email,
  type,
  subject,
  bodyLines,
}) {
  const address = normalizeEmail(email);
  if (!address) return { ok: false, error: "no recipient" };
  const tid = String(tenantId || "");
  const oid = String(orderId || "");
  const evtType = String(type || "order_email");
  if (!tid || !oid) return { ok: false, error: "missing order ref" };

  const prior = await dbQuery(
    "SELECT 1 FROM email_events WHERE tenant_id = $1 AND order_id = $2 AND type = $3 AND data->>'ok' = 'true' LIMIT 1",
    [tid, oid, evtType],
  );
  if (prior?.rowCount > 0) return { ok: true, skipped: "already_sent" };

  const tenant = (loadTenantsData().list || []).find(
    (t) => String(t?.tenant_id || "") === tid,
  );
  const brand = String(tenant?.seo?.brandName || tid);
  const baseFrom = String(
    process.env.ALERT_EMAIL_FROM || "Roxjaya <desk@roxjaya.com>",
  ).trim();
  const mailbox = baseFrom.match(/<([^>]+)>/);
  const from = mailbox ? `${brand} <${mailbox[1]}>` : baseFrom;

  const body = (Array.isArray(bodyLines) ? bodyLines : [])
    .filter((l) => l !== null && l !== undefined)
    .map((l) =>
      String(l).replaceAll("{brand}", brand).replaceAll("{order}", oid),
    )
    .join("\n");

  const result = await sendAlertEmail({
    to: address,
    subject: `${String(subject || "Order update")} — ${brand}`,
    body,
    from,
  });
  await dbQuery(
    "INSERT INTO email_events (tenant_id, email, type, order_id, data) VALUES ($1, $2, $3, $4, $5::jsonb)",
    [
      tid,
      address,
      evtType,
      oid,
      JSON.stringify({
        ok: Boolean(result?.ok),
        provider: result?.provider || "sendmail",
        error: result?.error || null,
      }),
    ],
  );
  return result;
}

export function moneyLabel(amountTotal, currency) {
  return Number.isInteger(amountTotal)
    ? `${(amountTotal / 100).toFixed(2)} ${String(currency || "gbp").toUpperCase()}`
    : "";
}

export function sendOrderConfirmation({ tenantId, orderId, email, amountTotal, currency }) {
  const amount = moneyLabel(amountTotal, currency);
  return sendBrandedOrderEmail({
    tenantId,
    orderId,
    email,
    type: "order_confirmation",
    subject: "Order confirmed",
    bodyLines: [
      "Thanks for your order from {brand}!",
      "",
      "Order: {order}",
      amount ? `Total: ${amount}` : null,
      "",
      "This is your confirmation — keep it for your records.",
      "Questions? Just reply to this email.",
    ],
  });
}

export function sendRefundNotice({ tenantId, orderId, email, amountTotal, currency }) {
  const amount = moneyLabel(amountTotal, currency);
  return sendBrandedOrderEmail({
    tenantId,
    orderId,
    email,
    type: "refund",
    subject: "Refund processed",
    bodyLines: [
      "Your refund from {brand} has been processed.",
      "",
      "Order: {order}",
      amount ? `Amount refunded: ${amount}` : null,
      "",
      "It can take a few days to appear on your statement.",
      "Questions? Just reply to this email.",
    ],
  });
}

export function sendPaymentFailedNotice({ tenantId, orderId, email }) {
  return sendBrandedOrderEmail({
    tenantId,
    orderId,
    email,
    type: "payment_failed",
    subject: "Payment didn't go through",
    bodyLines: [
      "Your payment for order {order} at {brand} didn't go through — no charge was taken.",
      "",
      "If you still want it, run the checkout again or just reply to this email and we'll sort it.",
      "",
      "Order: {order}",
    ],
  });
}

export function sendOrderShippedNotice({ tenantId, orderId, email, tracking }) {
  return sendBrandedOrderEmail({
    tenantId,
    orderId,
    email,
    type: "order_shipped",
    subject: "Order on its way",
    bodyLines: [
      "Your order from {brand} is on its way!",
      "",
      "Order: {order}",
      tracking ? `Tracking: ${tracking}` : null,
      "",
      "Questions? Just reply to this email.",
    ],
  });
}

export function buildAlertEmail({ tenantId, alert }) {
  const type = String(alert?.type || "unknown");
  const severity = String(alert?.severity || "warning");
  const message = String(alert?.message || "");
  const data = alert?.data && typeof alert.data === "object" ? alert.data : {};
  const now = String(alert?.createdAt || new Date().toISOString());

  const baseUrl =
    String(process.env.PUBLIC_BASE_URL || "").trim() ||
    `http://localhost:${process.env.PORT || 3000}`;
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

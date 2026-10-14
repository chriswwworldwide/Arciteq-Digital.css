// server/commerce.js
// Commerce core shared by checkout, webhooks, the desks and the sweeps:
// schema bootstrap (migrations 011+), stock reservation/capture/release,
// customer account tokens + account page, and the paid-order "data stitch"
// onto the single customer view.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { dbQuery } from "../db.js";
import { ROOT_DIR, loadProductsData } from "./data-files.js";
import { orderTotalsDelta } from "../src/data-stitch.js";

// Data-stitching: apply a paid order to the single-customer-view record,
// mark the matching captured cart converted (recording which nudge won), and
// log a unified order_completed funnel event. Idempotency is the caller's job
// (only invoked on a first-time Stripe event).
export async function stitchPaidOrder({
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

// ---- Commerce gaps: inventory, discounts, tax, customer accounts --------
let commerceTablesReady = false;
let commerceTablesPromise = null;

export async function ensureCommerceTables() {
  if (commerceTablesReady) return;
  // One shared in-flight run, so concurrent first requests (webhook +
  // heartbeat at boot) never race the same DDL. A failure clears it so
  // the next call retries.
  if (!commerceTablesPromise) {
    commerceTablesPromise = (async () => {
      for (const file of [
        "011_commerce_gaps.sql",
        "012_platform_billing.sql",
        "013_fulfilment_and_indexes.sql",
        "014_webhook_processing.sql",
        "015_hq.sql",
        "016_accounts.sql",
        "017_ledger_import.sql",
        "018_ledger_exports.sql",
      ]) {
        await dbQuery(
          fs.readFileSync(path.join(ROOT_DIR, "migrations", file), "utf8"),
        );
      }
      commerceTablesReady = true;
    })().catch((err) => {
      commerceTablesPromise = null;
      throw err;
    });
  }
  await commerceTablesPromise;
}

// Seed inventory rows from products.json `stock` field for the given tenant.
// Products without a `stock` field have no row → unlimited stock.
export async function seedInventory(tenantId) {
  await ensureCommerceTables();
  const { list } = loadProductsData();
  for (const p of list) {
    if (String(p?.tenant_id || "default") !== tenantId) continue;
    if (!Number.isInteger(p?.stock)) continue;
    await dbQuery(
      "INSERT INTO inventory (tenant_id, product_id, stock) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, product_id) DO NOTHING",
      [tenantId, String(p.productId), p.stock],
    );
  }
}

export async function stockFor(tenantId, productId) {
  const r = await dbQuery(
    "SELECT stock FROM inventory WHERE tenant_id = $1 AND product_id = $2",
    [tenantId, productId],
  );
  return r?.rows?.[0]?.stock ?? null;
}

export async function moveStock(tenantId, productId, delta, reason, orderId) {
  await dbQuery(
    "INSERT INTO inventory (tenant_id, product_id, stock) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, product_id) DO UPDATE SET stock = inventory.stock + $3, updated_at = now()",
    [tenantId, productId, delta],
  );
  await dbQuery(
    "INSERT INTO inventory_movements (tenant_id, product_id, delta, reason, order_id) VALUES ($1, $2, $3, $4, $5)",
    [tenantId, productId, delta, reason, orderId || null],
  );
}

// Reserve stock at checkout start for tracked products. Throws on shortage.
export async function reserveStock(tenantId, normalizedItems, orderId) {
  for (const it of normalizedItems) {
    const tracked = await stockFor(tenantId, it.productId);
    if (tracked === null) continue; // untracked = unlimited
    if (tracked < it.quantity) {
      const err = new Error(
        `Not enough stock for ${it.title} (${tracked} left)`,
      );
      err.statusCode = 409;
      throw err;
    }
  }
  for (const it of normalizedItems) {
    const tracked = await stockFor(tenantId, it.productId);
    if (tracked === null) continue;
    await moveStock(tenantId, it.productId, -it.quantity, "reserve", orderId);
  }
}

// Idempotent: if the order was already captured (paid) or restored, do
// nothing — a stray late webhook must not inflate stock.
export async function releaseReservation(tenantId, orderId, reason) {
  if (!orderId) return;
  const done = await dbQuery(
    "SELECT 1 FROM inventory_movements WHERE tenant_id = $1 AND order_id = $2 AND reason IN ('restore', 'capture') LIMIT 1",
    [tenantId, orderId],
  );
  if (done?.rows?.length) return;
  const r = await dbQuery(
    "SELECT product_id, -SUM(delta) AS held FROM inventory_movements WHERE tenant_id = $1 AND order_id = $2 AND reason = 'reserve' GROUP BY product_id",
    [tenantId, orderId],
  );
  for (const row of r?.rows || []) {
    const held = Number(row.held) || 0;
    if (held > 0) await moveStock(tenantId, row.product_id, held, reason, orderId);
  }
}

export function renderAccountPage(customer, orders) {
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const money = (minor, cur) =>
    minor == null
      ? "—"
      : new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency: String(cur || "gbp").toUpperCase(),
        }).format(minor / 100);
  const rows = orders
    .map((o) => {
      const items = (() => {
        try {
          const arr = Array.isArray(o.items)
            ? o.items
            : JSON.parse(o.items || "[]");
          if (!arr.length) return "—";
          return arr
            .map((i) => `${esc(i.title)} ×${Number(i.quantity) || 1}`)
            .join("<br>");
        } catch {
          return "—";
        }
      })();
      const when = o.created_at
        ? new Date(o.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "";
      const bits = [
        `<td>${items}</td>`,
        `<td>${esc(when)}</td>`,
        `<td>${esc(o.status)}</td>`,
        `<td>${money(o.amount_total, o.currency)}</td>`,
      ];
      if (o.amount_discount)
        bits.splice(3, 0, `<td>−${money(o.amount_discount, o.currency)}</td>`);
      else bits.splice(3, 0, "<td>—</td>");
      return `<tr>${bits.join("")}</tr>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your account</title><style>
    body{font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#191a1c}
    table{width:100%;border-collapse:collapse;font-size:14px}
    td,th{padding:10px 8px;border-bottom:1px solid #e7e2de;text-align:left;vertical-align:top}
    th{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a8580}
    h1{font-size:22px} .muted{color:#8a8580;font-size:13px}
  </style></head><body>
  <h1>Your account</h1>
  <p class="muted">${esc(customer.email)} · ${Number(customer.total_orders) || 0} orders</p>
  ${orders.length ? `<table><tr><th>Items</th><th>Date</th><th>Status</th><th>Discount</th><th>Total</th></tr>${rows}</table>` : `<p class="muted">No orders yet.</p>`}
  </body></html>`;
}

export async function ensureAccountToken(tenantId, email) {
  if (!email) return null;
  const existing = await dbQuery(
    "SELECT account_token FROM customers WHERE tenant_id = $1 AND email = $2",
    [tenantId, email],
  );
  const token =
    existing?.rows?.[0]?.account_token || crypto.randomBytes(24).toString("hex");
  await dbQuery(
    "UPDATE customers SET account_token = $1, updated_at = now() WHERE tenant_id = $2 AND email = $3",
    [token, tenantId, email],
  );
  return token;
}

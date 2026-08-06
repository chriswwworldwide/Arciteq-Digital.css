// scripts/order-health.js
// Alerting job for stuck / at-risk orders (cron -> Slack/email later).
// Flags: 'pending' too long (likely a missed Stripe webhook), 'paid' but
// untouched too long (fulfilment lag), and any 'failed' payments.
// Degrades gracefully: no DATABASE_URL or unmigrated tables => explains, exits 0.
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { dbQuery } from "../db.js";
import { detectOrderIssues, DEFAULT_THRESHOLDS } from "../src/order-health.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

export async function loadRecentOrders(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const res = await dbQuery(
    `SELECT order_id, tenant_id, status, amount_total, currency, customer_email, created_at, updated_at
       FROM orders
      WHERE created_at >= $1
      ORDER BY created_at ASC`,
    [since],
  );
  return res.rows;
}

function line(o) {
  const amt =
    o.amount_total != null
      ? `${o.amount_total} ${o.currency || ""}`.trim()
      : "?";
  return `  - ${o.order_id} (${o.tenant_id}) ${amt} ${o.customer_email || "no-email"} created=${o.created_at}`;
}

export async function main() {
  if (!String(process.env.DATABASE_URL || "").trim()) {
    console.log(
      "[order-health] DATABASE_URL not set — skipping (no orders to check yet).",
    );
    return;
  }

  let orders;
  try {
    orders = await loadRecentOrders();
  } catch (err) {
    console.log(
      "[order-health] could not read orders (run migrations first):",
      String(err?.message || err),
    );
    return;
  }

  const pendingStuckMinutes = Number(
    process.env.ORDER_PENDING_STUCK_MINUTES ||
      DEFAULT_THRESHOLDS.pendingStuckMinutes,
  );
  const paidUnfulfilledHours = Number(
    process.env.ORDER_PAID_UNFULFILLED_HOURS ||
      DEFAULT_THRESHOLDS.paidUnfulfilledHours,
  );
  const result = detectOrderIssues(orders, {
    pendingStuckMinutes,
    paidUnfulfilledHours,
  });

  if (result.ok) {
    console.log(
      `[order-health] OK — no stuck orders in ${orders.length} recent order(s).`,
    );
    return;
  }

  console.log(
    `[order-health] ISSUES: pendingStuck=${result.counts.pendingStuck} paidUnfulfilled=${result.counts.paidUnfulfilled} failed=${result.counts.failed}`,
  );
  if (result.pendingStuck.length) {
    console.log(
      `[order-health] pending > ${pendingStuckMinutes}m (possible missed webhook):`,
    );
    result.pendingStuck.forEach((o) => console.log(line(o)));
  }
  if (result.paidUnfulfilled.length) {
    console.log(
      `[order-health] paid but untouched > ${paidUnfulfilledHours}h (fulfilment lag):`,
    );
    result.paidUnfulfilled.forEach((o) => console.log(line(o)));
  }
  if (result.failed.length) {
    console.log(`[order-health] failed payments:`);
    result.failed.forEach((o) => console.log(line(o)));
  }
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  main().catch((err) => {
    console.error("Order health check failed:", err);
    process.exit(1);
  });
}

// tools/webhook-replay.js — money-path safety net for refactors.
// Posts a scripted sequence of correctly signed Stripe events (checkout
// completed + replay, delayed payment, async success/failure, expiry,
// payment failure, full + partial refunds, subscription + renewal invoices)
// to a server started with STRIPE_SECRET_KEY=sk_test_replay and
// STRIPE_WEBHOOK_SECRET=whsec_replay, then dumps the resulting database
// rows (scrubbed of timestamps/ids) so two runs can be diffed.
// All rows use the tenant "replaytest" and are deleted before and after.
// Usage: BASE=http://localhost:3100 OUT=/tmp/webhook.txt node tools/webhook-replay.js

import fs from "node:fs";
import Stripe from "stripe";
import { dbQuery } from "../db.js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
const BASE = process.env.BASE || "http://localhost:3100";
const OUT = process.env.OUT || "/tmp/webhook.txt";
const SECRET = "whsec_replay";
const stripe = new Stripe("sk_test_replay");
const T = "replaytest";

async function cleanup() {
  const ids = (await dbQuery("SELECT order_id FROM orders WHERE tenant_id = $1", [T])).rows.map((r) => r.order_id);
  await dbQuery("DELETE FROM email_events WHERE tenant_id = $1 OR order_id = ANY($2)", [T, ids]);
  await dbQuery("DELETE FROM order_events WHERE order_id = ANY($1)", [ids]);
  await dbQuery("DELETE FROM inventory_movements WHERE tenant_id = $1", [T]);
  await dbQuery("DELETE FROM subscriptions WHERE tenant_id = $1", [T]);
  await dbQuery("DELETE FROM cart_emails WHERE tenant_id = $1", [T]);
  await dbQuery("DELETE FROM customers WHERE tenant_id = $1", [T]);
  await dbQuery("DELETE FROM orders WHERE tenant_id = $1", [T]);
  await dbQuery("DELETE FROM stripe_events WHERE stripe_event_id LIKE 'evt_replay_%'");
}

async function send(id, type, object) {
  const payload = JSON.stringify({ id, type, object: "event", data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const r = await fetch(`${BASE}/stripe/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body: payload,
  });
  return `${id} ${type} → ${r.status} ${(await r.text()).slice(0, 80)}`;
}

async function seedPending(orderId, total) {
  await dbQuery(
    "INSERT INTO orders (order_id, tenant_id, status, currency, amount_subtotal, amount_total, customer_email, items) VALUES ($1, $2, 'pending', 'gbp', $3, $3, $4, '[]'::jsonb)",
    [orderId, T, total, `${orderId}@example.com`],
  );
  await dbQuery(
    "INSERT INTO inventory_movements (tenant_id, product_id, delta, reason, order_id) VALUES ($1, 'replay-prod', -1, 'reserve', $2)",
    [T, orderId],
  );
}

const session = (orderId, extra = {}) => ({
  id: `cs_${orderId}`,
  object: "checkout.session",
  payment_intent: `pi_${orderId}`,
  currency: "gbp",
  amount_subtotal: 5000,
  amount_total: 5000,
  payment_status: "paid",
  customer_details: { email: `${orderId}@example.com` },
  total_details: { amount_discount: 0, amount_tax: 833 },
  metadata: { order_id: orderId, tenant_id: T },
  ...extra,
});

const log = [];
await cleanup();
for (const o of ["rp_paid", "rp_delayed", "rp_asyncfail", "rp_expired", "rp_pifail", "rp_refund", "rp_partial"]) {
  await seedPending(o, 5000);
}
log.push(await send("evt_replay_01", "checkout.session.completed", session("rp_paid")));
log.push(await send("evt_replay_01", "checkout.session.completed", session("rp_paid")));
log.push(await send("evt_replay_02", "checkout.session.completed", session("rp_delayed", { payment_status: "unpaid" })));
log.push(await send("evt_replay_03", "checkout.session.async_payment_succeeded", session("rp_delayed")));
log.push(await send("evt_replay_04", "checkout.session.async_payment_failed", session("rp_asyncfail")));
log.push(await send("evt_replay_05", "checkout.session.expired", session("rp_expired")));
log.push(await send("evt_replay_06", "payment_intent.payment_failed", { id: "pi_rp_pifail", object: "payment_intent" }));
log.push(await send("evt_replay_07", "checkout.session.completed", session("rp_refund")));
log.push(await send("evt_replay_08", "charge.refunded", { id: "ch_rp_refund", object: "charge", payment_intent: "pi_rp_refund", refunded: true, amount_refunded: 5000 }));
log.push(await send("evt_replay_09", "checkout.session.completed", session("rp_refund")));
log.push(await send("evt_replay_10", "checkout.session.completed", session("rp_partial")));
log.push(await send("evt_replay_11", "charge.refunded", { id: "ch_rp_partial", object: "charge", payment_intent: "pi_rp_partial", refunded: false, amount_refunded: 1000 }));
const sub = { id: "sub_replay", object: "subscription", status: "active", customer: "cus_replay", metadata: { tenant_id: T, order_id: "rp_paid", customer_email: "rp_paid@example.com" }, items: { data: [{ price: { unit_amount: 6000, currency: "gbp", recurring: { interval: "month" } } }] }, current_period_end: 1893456000 };
log.push(await send("evt_replay_12", "customer.subscription.created", sub));
const invoice = (n, reason) => ({ id: `in_replay_${n}`, object: "invoice", subscription: "sub_replay", billing_reason: reason, customer_email: "rp_paid@example.com", currency: "gbp", amount_paid: 6000, subtotal: 5000, tax: 1000, payment_intent: `pi_inv_${n}`, lines: { data: [{ period: { end: 1893456000 } }] } });
log.push(await send("evt_replay_13", "invoice.paid", invoice(1, "subscription_create")));
log.push(await send("evt_replay_14", "invoice.paid", invoice(2, "subscription_cycle")));
log.push(await send("evt_replay_14", "invoice.paid", invoice(2, "subscription_cycle")));
log.push(await send("evt_replay_15", "invoice.payment_failed", invoice(3, "subscription_cycle")));
log.push(await send("evt_replay_16", "customer.subscription.deleted", { ...sub, status: "canceled", canceled_at: 1893456000 }));
log.push(await send("evt_replay_bad", "checkout.session.completed", { bad: "signature-free" }).then(async () => {
  const r = await fetch(`${BASE}/stripe/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": "t=1,v1=nope" }, body: "{}" });
  return `bad signature → ${r.status}`;
}));

const scrub = (rows) => rows.map((r) => {
  const o = {};
  for (const [k, v] of Object.entries(r)) {
    if (/(_at|^at)$/.test(k) || k === "id") continue;
    o[k] = typeof v === "string" && /^renewal_|^[0-9a-f-]{36}$/.test(v) ? v.replace(/^[0-9a-f-]{36}$/, "~uuid") : v;
  }
  return JSON.stringify(o);
});
const orders = await dbQuery("SELECT order_id, status, amount_total, amount_tax, amount_discount, stripe_payment_intent_id, stripe_subscription_id, customer_email FROM orders WHERE tenant_id = $1 ORDER BY order_id", [T]);
const events = await dbQuery("SELECT order_id, type, data - 'stripeEventId' - 'chargeId' AS data FROM order_events WHERE order_id IN (SELECT order_id FROM orders WHERE tenant_id = $1) ORDER BY order_id, type, data::text", [T]);
const emails = await dbQuery("SELECT email, type, order_id, data->>'ok' AS ok FROM email_events WHERE tenant_id = $1 ORDER BY email, type, order_id", [T]);
const subs = await dbQuery("SELECT stripe_subscription_id, status, amount_minor, billing_interval FROM subscriptions WHERE tenant_id = $1", [T]);
const stock = await dbQuery("SELECT order_id, reason, delta FROM inventory_movements WHERE tenant_id = $1 ORDER BY order_id, reason", [T]);
const customers = await dbQuery("SELECT email, total_orders, total_spend_minor FROM customers WHERE tenant_id = $1 ORDER BY email", [T]);
const processed = await dbQuery("SELECT stripe_event_id, processed_at IS NOT NULL AS processed FROM stripe_events WHERE stripe_event_id LIKE 'evt_replay_%' ORDER BY 1");

const out = [
  "== responses", ...log,
  "== orders", ...scrub(orders.rows),
  "== order_events", ...scrub(events.rows),
  "== email_events", ...scrub(emails.rows),
  "== subscriptions", ...scrub(subs.rows),
  "== stock", ...scrub(stock.rows),
  "== customers", ...scrub(customers.rows),
  "== stripe_events", ...scrub(processed.rows),
];
await cleanup();
fs.writeFileSync(OUT, `${out.join("\n")}\n`);
console.log(`webhook replay: ${log.length} events, ${out.length} lines → ${OUT}`);
process.exit(0);

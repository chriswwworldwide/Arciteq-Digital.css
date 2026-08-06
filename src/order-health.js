// src/order-health.js
// Pure order-health rules: surface stuck / at-risk orders so fulfilment issues
// and missed Stripe webhooks get caught automatically (cron -> alert) instead of
// being noticed when a customer complains. No IO here — callers pass in rows.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const DEFAULT_THRESHOLDS = {
  pendingStuckMinutes: 60, // 'pending' this long usually means a missed webhook
  paidUnfulfilledHours: 48, // 'paid' but untouched this long = fulfilment lag
};

/** Coerce a Date / ISO string / epoch-ms into epoch-ms (NaN if unparseable). */
export function toEpochMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  const t = Date.parse(String(value || ""));
  return Number.isNaN(t) ? NaN : t;
}

function ageMs(from, nowMs) {
  const t = toEpochMs(from);
  return Number.isNaN(t) ? 0 : nowMs - t;
}

/**
 * Classify orders into health issues.
 * @param {Array} orders rows: { order_id, status, created_at, updated_at, amount_total, customer_email }
 * @param {object} opts   { now?: ms|Date, pendingStuckMinutes?, paidUnfulfilledHours? }
 * @returns {{ ok, pendingStuck[], paidUnfulfilled[], failed[], counts }}
 */
export function detectOrderIssues(orders, opts = {}) {
  const nowMs = opts.now != null ? toEpochMs(opts.now) : Date.now();
  const pendingLimit =
    (opts.pendingStuckMinutes ?? DEFAULT_THRESHOLDS.pendingStuckMinutes) *
    MINUTE;
  const paidLimit =
    (opts.paidUnfulfilledHours ?? DEFAULT_THRESHOLDS.paidUnfulfilledHours) *
    HOUR;

  const pendingStuck = [];
  const paidUnfulfilled = [];
  const failed = [];

  for (const o of Array.isArray(orders) ? orders : []) {
    const status = String(o?.status || "").toLowerCase();
    if (status === "pending" && ageMs(o?.created_at, nowMs) > pendingLimit) {
      pendingStuck.push(o);
    } else if (status === "paid" && ageMs(o?.updated_at, nowMs) > paidLimit) {
      paidUnfulfilled.push(o);
    } else if (status === "failed") {
      failed.push(o);
    }
  }

  const counts = {
    pendingStuck: pendingStuck.length,
    paidUnfulfilled: paidUnfulfilled.length,
    failed: failed.length,
  };
  return {
    ok:
      counts.pendingStuck === 0 &&
      counts.paidUnfulfilled === 0 &&
      counts.failed === 0,
    pendingStuck,
    paidUnfulfilled,
    failed,
    counts,
  };
}

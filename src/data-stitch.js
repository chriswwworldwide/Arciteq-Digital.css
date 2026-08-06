// src/data-stitch.js
// Pure helpers for the single-customer-view / data-stitching layer.
// SQL lives in server.js and the recovery script; this module holds only the
// pure logic so it can be unit-tested without a database.

/** Normalize an email for use as a stable per-tenant key. */
export function normalizeEmail(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

/** Loose email validity check (matches the capture endpoint's rule). */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

/**
 * Map an abandoned-cart nudge count to a stable event/label type.
 * 0 -> first nudge, 1 -> second nudge, 2 -> later win-back, else null (capped).
 */
export function nudgeTypeForCount(nudgeCount) {
  const n = Number(nudgeCount);
  if (n === 0) return "nudge1";
  if (n === 1) return "nudge2";
  if (n === 2) return "winback";
  return null;
}

/**
 * Spend/order delta to apply to a customer's running totals when an order is
 * counted. amountMinor is integer minor units (cents/pence); non-integers → 0.
 */
export function orderTotalsDelta(amountMinor) {
  const amount = Number.isInteger(amountMinor) ? amountMinor : 0;
  return { orders: 1, spendMinor: amount };
}

/**
 * First-touch UTM: keep the earliest non-empty value, never overwrite an
 * existing attribution with a later/empty one.
 */
export function pickFirstTouch(existing, incoming) {
  const prev = String(existing || "").trim();
  if (prev) return prev;
  return String(incoming || "").trim() || null;
}

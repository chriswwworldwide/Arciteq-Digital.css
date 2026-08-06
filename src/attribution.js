// src/attribution.js
// Pure conversion-attribution logic: given the nudges we sent and the carts that
// later converted, work out which lifecycle touch (nudge1 / nudge2 / winback)
// actually drove revenue. This is the "measure real numbers" layer behind the
// data-stitch — no IO here so it can be unit-tested and reused by a CLI/dashboard.

export const NUDGE_TYPES = ["nudge1", "nudge2", "winback"];
export const ORGANIC = "organic"; // converted without any nudge credited

function normalizeType(raw) {
  const t = String(raw || "")
    .trim()
    .toLowerCase();
  return NUDGE_TYPES.includes(t) ? t : "";
}

function toMinor(amount) {
  return Number.isInteger(amount) ? amount : 0;
}

/**
 * Build an attribution report (last-touch: a conversion is credited to the last
 * nudge type recorded on its cart).
 *
 * @param {object} input
 * @param {{nudgeType:string}[]} input.nudgeEvents  one row per nudge actually sent
 * @param {{nudgeType?:string, amountMinor?:number}[]} input.conversions one row per converted cart
 * @returns aggregate rates + revenue per nudge type, plus an organic bucket and totals.
 */
export function buildAttributionReport({
  nudgeEvents = [],
  conversions = [],
} = {}) {
  const byNudgeType = {};
  for (const t of NUDGE_TYPES) {
    byNudgeType[t] = {
      sent: 0,
      converted: 0,
      revenueMinor: 0,
      conversionRate: 0,
    };
  }

  for (const ev of Array.isArray(nudgeEvents) ? nudgeEvents : []) {
    const t = normalizeType(ev?.nudgeType);
    if (t) byNudgeType[t].sent += 1;
  }

  const organic = { converted: 0, revenueMinor: 0 };
  for (const c of Array.isArray(conversions) ? conversions : []) {
    const t = normalizeType(c?.nudgeType);
    const amount = toMinor(c?.amountMinor);
    if (t) {
      byNudgeType[t].converted += 1;
      byNudgeType[t].revenueMinor += amount;
    } else {
      organic.converted += 1;
      organic.revenueMinor += amount;
    }
  }

  for (const t of NUDGE_TYPES) {
    const b = byNudgeType[t];
    b.conversionRate = b.sent > 0 ? b.converted / b.sent : 0;
  }

  const nudgeConverted = NUDGE_TYPES.reduce(
    (n, t) => n + byNudgeType[t].converted,
    0,
  );
  const nudgeRevenueMinor = NUDGE_TYPES.reduce(
    (n, t) => n + byNudgeType[t].revenueMinor,
    0,
  );

  return {
    byNudgeType,
    organic,
    totals: {
      sent: NUDGE_TYPES.reduce((n, t) => n + byNudgeType[t].sent, 0),
      nudgeConverted,
      nudgeRevenueMinor,
      totalConverted: nudgeConverted + organic.converted,
      totalRevenueMinor: nudgeRevenueMinor + organic.revenueMinor,
    },
  };
}

/** Format minor units (pence/cents) as a human string, e.g. 4999 -> "49.99". */
export function formatMinor(amountMinor) {
  const n = toMinor(amountMinor);
  return (n / 100).toFixed(2);
}

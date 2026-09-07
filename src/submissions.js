// src/submissions.js
// Structured, repeatable customer submissions (race splits, weight logs,
// surveys…) for any tenant. Pure helpers: validate a submission against the
// tenant's whitelist, and summarise a set of payloads as anonymous per-field
// statistics (count / median / quartiles) so the public never sees an
// individual's row. No IO.

import { sanitizeProfile } from "./lead-profile.js";

const KIND_RE = /^[a-z][a-z0-9_]{1,39}$/;

/** Kinds a tenant accepts, from tenants.json → submissions.kinds. */
export function allowedKinds(tenant) {
  const kinds = tenant?.submissions?.kinds;
  return Array.isArray(kinds)
    ? kinds.map((k) => String(k || "").trim()).filter((k) => KIND_RE.test(k))
    : [];
}

/**
 * Validate a raw request body into { kind, payload } or { error }.
 * Payload reuses the lead-profile sanitiser (snake_case keys, scalar values).
 */
export function validateSubmission(tenant, body) {
  const kind = String(body?.kind || "")
    .trim()
    .toLowerCase();
  if (!KIND_RE.test(kind)) return { error: "Invalid kind" };
  if (!allowedKinds(tenant).includes(kind)) {
    return { error: "Unknown submission kind" };
  }
  const payload = sanitizeProfile(body?.payload);
  if (!Object.keys(payload).length) return { error: "Empty payload" };
  return { kind, payload };
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Anonymous per-field stats over a list of payloads. Only numeric fields are
 * summarised; fields with fewer than `minCount` values are dropped so small
 * groups cannot be reverse-engineered. Optionally filter rows by one
 * string field first (e.g. { division: "Women Open" }).
 */
export function summarizePayloads(
  payloads,
  { minCount = 5, filter = null } = {},
) {
  const rows = (Array.isArray(payloads) ? payloads : []).filter((p) => {
    if (!p || typeof p !== "object") return false;
    if (!filter) return true;
    return Object.entries(filter).every(
      ([k, v]) =>
        String(p[k] ?? "").toLowerCase() === String(v ?? "").toLowerCase(),
    );
  });
  const byKey = new Map();
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k).push(v);
    }
  }
  const fields = {};
  for (const [k, vals] of byKey) {
    if (vals.length < minCount) continue;
    const sorted = vals.slice().sort((a, b) => a - b);
    fields[k] = {
      n: sorted.length,
      p25: quantile(sorted, 0.25),
      median: quantile(sorted, 0.5),
      p75: quantile(sorted, 0.75),
      best: sorted[0],
    };
  }
  return { rows: rows.length, fields };
}

/** Where a value sits among peers: 0 = best, 1 = slowest. Null if no peers. */
export function percentileRank(sortedAsc, value) {
  if (!Array.isArray(sortedAsc) || !sortedAsc.length) return null;
  let below = 0;
  for (const v of sortedAsc) if (v < value) below += 1;
  return below / sortedAsc.length;
}

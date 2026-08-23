// src/interest-report.js
// Pure aggregation of email-capture "interest" by source label (e.g.
// "segment:breeders" from a kit-interest form). No IO here so it can be
// unit-tested and reused by a CLI/dashboard. Captures with no source are
// bucketed under DIRECT (e.g. the cart email-capture, which sends none).

export const DIRECT = "direct"; // captured without a source label

/**
 * Summarise capture events by their `source` label.
 *
 * @param {{source?:string}[]} events one row per capture (email_events.data)
 * @returns {{ total:number, bySource: {source:string,count:number}[] }}
 *   total count and per-source counts sorted by count desc, then source asc.
 */
export function summarizeInterest(events = []) {
  const counts = new Map();
  let total = 0;

  for (const ev of Array.isArray(events) ? events : []) {
    const source = String(ev?.source || "").trim() || DIRECT;
    counts.set(source, (counts.get(source) || 0) + 1);
    total += 1;
  }

  const bySource = [...counts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  return { total, bySource };
}

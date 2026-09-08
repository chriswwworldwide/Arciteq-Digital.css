// src/analytics.js
// First-party, cookie-free page-view analytics for any tenant. Pure helpers:
// validate a browser beacon into a row, and roll rows up into the numbers a
// non-technical owner wants (views/visitors by day, top pages, top sources).
// No IO.

const PATH_MAX = 200;
const SHORT_MAX = 80;
const VISITOR_RE = /^[a-f0-9]{8,32}$/i;

/** True when the tenant has switched page-view logging on. */
export function pageviewsEnabled(tenant) {
  return tenant?.analytics?.pageviews === true;
}

function short(v) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, SHORT_MAX) : null;
}

/** Hostname of a referrer URL, or null for same-site / empty / garbage. */
export function referrerHost(referrer, ownHost) {
  const s = String(referrer || "").trim();
  if (!s) return null;
  try {
    const host = new URL(s).hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return null;
    const own = String(ownHost || "")
      .toLowerCase()
      .split(":")[0]
      .replace(/^www\./, "");
    return own && host === own ? null : host.slice(0, SHORT_MAX);
  } catch {
    return null;
  }
}

/**
 * Turn a beacon body into a page_views row, or { error }.
 * Only the path part of the URL is kept (query strings can hold personal data).
 */
export function validatePageview(body, { ownHost = "" } = {}) {
  let path = String(body?.path || "").trim();
  if (!path.startsWith("/")) return { error: "Invalid path" };
  path = path.split(/[?#]/)[0].slice(0, PATH_MAX);
  const utm = body?.utm && typeof body.utm === "object" ? body.utm : {};
  const visitor = String(body?.visitor || "").trim();
  return {
    row: {
      path,
      referrer_host: referrerHost(body?.referrer, ownHost),
      utm_source: short(utm.source ?? utm.utm_source),
      utm_medium: short(utm.medium ?? utm.utm_medium),
      utm_campaign: short(utm.campaign ?? utm.utm_campaign),
      visitor: VISITOR_RE.test(visitor) ? visitor.toLowerCase() : null,
    },
  };
}

function dayKey(at) {
  const d = at instanceof Date ? at : new Date(at);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

function topN(counter, n) {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

/**
 * Roll page-view rows ({ path, referrer_host, utm_source, visitor, at }) into
 * an owner-friendly summary. Visitors are counted per day (the browser's
 * visitor token rotates daily), so 'visitors' is a sum of daily uniques.
 * Paths containing `/out/` are outbound clicks (sponsor/partner links): they
 * are kept out of the page list and reported separately, uncapped.
 */
export function summarizePageviews(rows, { top = 10 } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const byDay = new Map();
  const pages = new Map();
  const sources = new Map();
  const outbound = new Map();
  let identified = 0;
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const day = dayKey(r.at);
    if (!day) continue;
    const d = byDay.get(day) || { day, views: 0, visitors: new Set() };
    d.views += 1;
    if (r.visitor) d.visitors.add(String(r.visitor));
    byDay.set(day, d);
    const path = String(r.path || "/");
    const out = path.indexOf("/out/");
    if (out >= 0) {
      const id = path.slice(out + 5).replace(/\/+$/, "") || "unknown";
      outbound.set(id, (outbound.get(id) || 0) + 1);
    } else {
      pages.set(path, (pages.get(path) || 0) + 1);
    }
    const src =
      short(r.utm_source) ||
      (r.referrer_host ? String(r.referrer_host) : null) ||
      "direct / typed";
    sources.set(src, (sources.get(src) || 0) + 1);
    if (r.email) identified += 1;
  }
  const days = [...byDay.values()]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({ day: d.day, views: d.views, visitors: d.visitors.size }));
  return {
    views: list.length,
    visitors: days.reduce((n, d) => n + d.visitors, 0),
    identified,
    days,
    pages: topN(pages, top),
    sources: topN(sources, top),
    outbound: topN(outbound, 200),
  };
}

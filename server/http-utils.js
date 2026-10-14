// server/http-utils.js
// Small request helpers shared by route modules.

export function rangeDays(req, fallback = 30) {
  const n = Number.parseInt(String(req.query?.days || ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 365) : fallback;
}

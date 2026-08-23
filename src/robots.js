// src/robots.js
// Pure generator for robots.txt so crawl rules + the sitemap reference stay in
// one place and can be produced per-tenant/host later. No IO here.

// Private/no-index surfaces: admin, account/order views, API/webhook paths, and
// legacy asset galleries kept in the repo but not part of the storefront.
export const DEFAULT_DISALLOW = [
  "/admin.html",
  "/admin-suppliers.html",
  "/orders.html",
  "/api/",
  "/stripe/",
  "/success.html",
  "/checkout-cancel.html",
  "/returns.html",
  "/eturns.html",
  "/theme-gallery.html",
  "/images2/",
];

/**
 * Build robots.txt text. Allows general crawling, blocks private surfaces, and
 * (when a site URL is given) points crawlers at the sitemap.
 */
export function generateRobotsTxt({
  siteUrl = "",
  disallow = DEFAULT_DISALLOW,
} = {}) {
  const base = String(siteUrl || "")
    .trim()
    .replace(/\/+$/, "");
  const rules = (Array.isArray(disallow) ? disallow : [])
    .map((d) => String(d || "").trim())
    .filter(Boolean);

  const lines = [
    "User-agent: *",
    "Allow: /",
    ...rules.map((r) => `Disallow: ${r}`),
  ];
  if (base) lines.push("", `Sitemap: ${base}/sitemap.xml`);
  return lines.join("\n") + "\n";
}

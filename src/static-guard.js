// src/static-guard.js
// Decides which repo files the static handler must never serve: server
// code, docs, migrations, scripts, ops ledgers and internal data. Public
// root data files the storefront fetches are allow-listed explicitly.

import path from "node:path";

export const PUBLIC_ROOT_DATA_FILES = new Set([
  "/data/products.json",
  "/data/reviews.json",
  "/data/supplier-assignments.json",
  "/data/suppliers.json",
  "/data/category-faqs.json",
]);

const PRIVATE_STATIC_RE = [
  /\.(md|sql|sh|log|plist|properties|lock|ts|map)$/i,
  /^\/(migrations|scripts|server|middleware|tests|src|archive|coverage|node_modules|backups)\//i,
  /\.(gz|dump|bak)$/i,
  /^\/api\/.*\.js$/i,
  /^\/(server|db|vitest\.config|eslint\.config|service-worker-build)\.js$/i,
  /^\/(package|package-lock|tsconfig)\.json$/i,
  /^\/(_redirects|sonar-project\.properties|\.snyk)$/i,
  /^\/[^/]+\/data\/inbox\.json$/i,
];

export function isPrivateStaticPath(p) {
  let decoded = String(p || "");
  try {
    for (let i = 0; i < 3; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return true;
  }
  if (decoded.includes("\0")) return true;
  const pathName = path.posix
    .normalize("/" + decoded.replace(/\\/g, "/"))
    .replace(/^\/+/, "/")
    .toLowerCase();
  if (/(^|\/)\.[^/]/.test(pathName)) return true;
  if (pathName.startsWith("/data/") && !PUBLIC_ROOT_DATA_FILES.has(pathName)) {
    return true;
  }
  return PRIVATE_STATIC_RE.some((re) => re.test(pathName));
}

export function publicTenantConfig(tenants) {
  return {
    tenants: tenants.map((tenant) => ({
      tenant_id: String(tenant.tenant_id || ""),
      hostnames: (Array.isArray(tenant.hostnames)
        ? tenant.hostnames
        : []
      ).filter((value) => typeof value === "string"),
      catalog: {
        heroProductIds: (Array.isArray(tenant.catalog?.heroProductIds)
          ? tenant.catalog.heroProductIds
          : []
        ).filter((value) => typeof value === "string"),
      },
    })),
  };
}

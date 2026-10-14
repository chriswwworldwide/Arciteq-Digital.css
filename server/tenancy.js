// server/tenancy.js
// Who is asking, and for which site: platform admin auth, tenant
// resolution (by hostname, or by the page path for shared-domain sites),
// and the trusted base URL used in emailed links.
// Settings are read from process.env at call time (server.js loads
// .env.local after its imports run).

import crypto from "node:crypto";
import { loadTenantsData } from "./data-files.js";

const adminKey = () => String(process.env.ADMIN_API_KEY || "").trim();
const publicBase = () => String(process.env.PUBLIC_BASE_URL || "").trim();
const port = () => process.env.PORT || 3000;

// Constant-time comparison so response timing can't reveal the key.
function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function requireAdmin(req, res) {
  const adminApiKey = adminKey();
  if (!adminApiKey) {
    return res
      .status(500)
      .json({ error: "ADMIN_API_KEY is not set on the server" });
  }

  const provided = String(
    req.headers["x-admin-key"] || req.headers["x-admin-api-key"] || "",
  );
  if (!provided || !sameSecret(provided, adminApiKey)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return null;
}

export function resolveTenantFromRequest(req) {
  const hostHeader = String(req.headers.host || "");
  const hostname = hostHeader.split(":")[0].toLowerCase();

  let tenants = [];
  try {
    tenants = loadTenantsData().list;
  } catch {
    tenants = [];
  }

  const match = tenants.find((t) =>
    Array.isArray(t?.hostnames)
      ? t.hostnames.map((h) => String(h).toLowerCase()).includes(hostname)
      : false,
  );

  if (match?.tenant_id) return match;
  return { tenant_id: "default", currency: "eur", language: "en" };
}

// Path-mounted tenants (e.g. yourdomain.com/pacegym/) share a hostname, so
// the Host header alone resolves them to "default". When the host gives no
// specific tenant, accept a client-claimed tenant_id ONLY if it is a real
// registered tenant AND the page it came from (Referer) is under that
// tenant's path. A host-resolved tenant always wins over any claim.
export function resolveTenantForPublicWrite(req, claimedTenantId) {
  const byHost = resolveTenantFromRequest(req);
  if (byHost?.tenant_id !== "default") return byHost;
  let refPath = "";
  try {
    refPath = new URL(String(req.headers.referer || "")).pathname;
  } catch {
    refPath = "";
  }
  // No explicit claim → the first path segment of the page is the claim.
  const claimed =
    String(claimedTenantId || "").trim() ||
    String(refPath.split("/")[1] || "").trim();
  if (!claimed || claimed === "default") return byHost;
  let tenants = [];
  try {
    tenants = loadTenantsData().list;
  } catch {
    tenants = [];
  }
  const match = tenants.find((t) => String(t?.tenant_id || "") === claimed);
  if (!match) return byHost;
  return refPath === `/${claimed}` || refPath.startsWith(`/${claimed}/`)
    ? match
    : byHost;
}

// Base URL for links we email out. Comes from server config only — the
// tenant's first real (non-localhost) hostname, else PUBLIC_BASE_URL —
// never from request headers, which the requester controls.
export function trustedBaseUrlForTenant(tenantId) {
  let tenants = [];
  try {
    tenants = loadTenantsData().list;
  } catch {
    tenants = [];
  }
  const t = tenants.find((x) => String(x?.tenant_id || "") === tenantId);
  const host = (Array.isArray(t?.hostnames) ? t.hostnames : [])
    .map((h) => String(h || "").toLowerCase())
    .find((h) => h && !h.includes("localhost") && !/^\d+\.\d+\.\d+\.\d+$/.test(h));
  if (host) return `https://${host}`;
  return String(publicBase() || `http://localhost:${port()}`).replace(/\/$/, "");
}

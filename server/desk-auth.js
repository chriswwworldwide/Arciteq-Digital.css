// server/desk-auth.js
// Access control for coach/gym desks. Two kinds of key:
//   - the platform ADMIN_API_KEY (us): any site, chosen by ?tenant= or by
//     the desk page's own path (Referer /<site>/...);
//   - a per-site desk key (the coach): locked to that one site, whatever
//     the request claims.
// Desk pages send the key in the existing x-admin-key header, so the old
// desks keep working unchanged.

import crypto from "node:crypto";

export function hashDeskKey(key) {
  return crypto.createHash("sha256").update(String(key)).digest("hex");
}

export function newDeskKey() {
  return `desk_${crypto.randomBytes(24).toString("hex")}`;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function createDeskAuth({
  dbQuery,
  adminApiKey,
  ensureTables,
  loadTenants,
  resolveTenantFromPage,
}) {
  const findTenant = (id) =>
    loadTenants().find((t) => String(t?.tenant_id || "") === String(id || ""));

  // Resolves to { tenant, role } or sends 401/400 and resolves to null.
  return async function requireDeskAccess(req, res) {
    const provided = String(
      req.headers["x-admin-key"] || req.headers["x-desk-key"] || "",
    ).trim();
    if (!provided) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }

    if (adminApiKey && safeEqual(provided, adminApiKey)) {
      const explicit = String(req.query?.tenant || "").trim();
      const tenant = explicit ? findTenant(explicit) : resolveTenantFromPage(req);
      if (!tenant) {
        res.status(400).json({ error: "Unknown tenant" });
        return null;
      }
      return { tenant, role: "admin" };
    }

    if (!provided.startsWith("desk_")) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    await ensureTables();
    const found = await dbQuery(
      "UPDATE desk_keys SET last_used_at = now() WHERE key_hash = $1 AND revoked_at IS NULL RETURNING tenant_id",
      [hashDeskKey(provided)],
    );
    const tenantId = found?.rows?.[0]?.tenant_id;
    const tenant = tenantId ? findTenant(tenantId) : null;
    if (!tenant) {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    }
    return { tenant, role: "coach" };
  };
}

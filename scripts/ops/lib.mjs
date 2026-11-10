// Shared helpers for the per-tenant ops automation (scripts/ops/*.mjs).
// Reads tenants from data/tenants.json, resolves each tenant's data dir,
// and posts approval candidates to the site's owner inbox.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SITE_URL = String(process.env.SITE_URL || '').replace(/\/+$/, '');
export const ADMIN_KEY = String(process.env.ADMIN_API_KEY || '');

export function loadTenants() {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'data/tenants.json'), 'utf8'));
  return d.tenants || d.list || [];
}

export function getTenant(id) {
  const t = loadTenants().find((x) => x.tenant_id === id);
  if (!t) throw new Error(`unknown tenant: ${id}`);
  return t;
}

// Every coaching tenant that has an inbox wired — the default --all set.
export function opsTenants() {
  return loadTenants().filter(
    (t) => t?.vertical === 'coaching' && t?.automation?.inbox,
  );
}

export function dataDirFor(tenant) {
  const rel = tenant.automation?.inbox || `${tenant.tenant_id}/data/inbox.json`;
  return path.join(root, path.dirname(rel));
}

export function readTenantJson(tenant, file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDirFor(tenant), file), 'utf8'));
  } catch {
    return fallback;
  }
}

export async function postInbox(tenantId, candidates) {
  const r = await fetch(`${SITE_URL}/admin/inbox`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: JSON.stringify({ tenant: tenantId, candidates }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`inbox ${r.status}: ${JSON.stringify(body)}`);
  return body;
}

export async function sendDigest(tenantId, days = 7) {
  const r = await fetch(`${SITE_URL}/admin/digest/send?days=${days}&tenant=${tenantId}`, {
    method: 'POST',
    headers: { 'x-admin-key': ADMIN_KEY },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`digest ${r.status}: ${JSON.stringify(body)}`);
  console.log(
    `${tenantId} digest: ${body.sent ? 'sent' : `not sent (${body.reason || body.error || '?'})`} — ${body.subject || ''}`,
  );
}

// Tenant selection from argv: --tenant <id>[,<id>] or --all
export function tenantArgs(argv = process.argv) {
  const i = argv.indexOf('--tenant');
  if (i > -1 && argv[i + 1]) return argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean);
  if (argv.includes('--all')) return opsTenants().map((t) => t.tenant_id);
  return null;
}

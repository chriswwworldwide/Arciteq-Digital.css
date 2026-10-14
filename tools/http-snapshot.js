// tools/http-snapshot.js
// Behaviour snapshot for refactors: requests every parameter-free GET route
// (from a route snapshot file) with and without the admin key, every
// coaching site's pages, and a set of security/edge cases, then writes
// "METHOD path [auth] → status type fingerprint" lines. Volatile values
// (timestamps, cache-busters, random ids) are stripped before hashing so
// two runs of the same code produce the same file.
// Usage: BASE=http://localhost:3000 ADMIN_KEY=... ROUTES=/tmp/routes.before.txt \
//        OUT=/tmp/http.before.txt node tools/http-snapshot.js

import fs from "node:fs";
import crypto from "node:crypto";

const BASE = process.env.BASE || "http://localhost:3000";
const KEY = process.env.ADMIN_KEY || "";
const OUT = process.env.OUT || "/tmp/http.txt";
const routes = fs.readFileSync(process.env.ROUTES || "/tmp/routes.txt", "utf8").split("\n");
const tenants = JSON.parse(fs.readFileSync("data/tenants.json", "utf8")).tenants || [];
const sites = tenants.filter((t) => t.vertical === "coaching").map((t) => t.tenant_id);

const VOLATILE_KEYS = /^(updatedAt|createdAt|created_at|updated_at|at|now|lastRunAt|last_run_at|generatedAt|ts|time|timestamp|uptime|id|token|lastWebhookAt|last_webhook_at|nextRunAt|startedAt|date)$/i;

function scrubJson(v) {
  if (Array.isArray(v)) return v.map(scrubJson);
  if (v && typeof v === "object") {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = VOLATILE_KEYS.test(k) ? "~" : scrubJson(v[k]);
    return o;
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return "~ts";
  return v;
}

function scrubText(s) {
  return s
    .replace(/\?v=\d+/g, "?v=~")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, "~ts")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "~uuid");
}

async function probe({ method = "GET", path, auth = false, headers = {}, body }) {
  const h = { ...headers };
  if (auth) h["x-admin-key"] = KEY;
  if (body !== undefined) h["content-type"] = "application/json";
  let status = "ERR";
  let type = "";
  let fp = "";
  try {
    const r = await fetch(BASE + path, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    status = r.status;
    type = (r.headers.get("content-type") || "").split(";")[0];
    const loc = r.headers.get("location");
    const text = await r.text();
    let norm;
    if (type.includes("json")) {
      try {
        norm = JSON.stringify(scrubJson(JSON.parse(text)));
      } catch {
        norm = scrubText(text);
      }
    } else {
      norm = scrubText(text);
    }
    fp = crypto.createHash("sha1").update(norm).digest("hex").slice(0, 10);
    if (loc) fp += ` → ${loc}`;
  } catch (err) {
    fp = String(err.message || err);
  }
  return `${method} ${path} ${auth ? "[admin]" : "[anon]"} → ${status} ${type} ${fp}`;
}

const cases = [];
const getPaths = routes
  .filter((l) => l.startsWith("ROUTE ") && /\bGET\b/.test(l.split(" ")[1]))
  .map((l) => l.split(" ")[2])
  .filter((p) => !p.includes(":") && !p.includes("*") && !p.includes("("));
for (const p of [...new Set(getPaths)]) {
  // Skip side-effect GETs that send email / mutate.
  if (/unsubscribe|track|open\b|newsletter-open/.test(p)) continue;
  cases.push({ path: p }, { path: p, auth: true });
}
for (const s of sites) {
  for (const sub of ["", "/", "/coach/", "/money/", "/money", "/events/", "/guides/", "/nope-404/"]) {
    cases.push({ path: `/${s}${sub}` });
  }
  cases.push({ path: `/desk/accounts/overview?tenant=${s}`, auth: true });
  cases.push({ path: `/admin/traffic?tenant=${s}`, auth: true });
}
cases.push(
  { path: "/server.js" }, { path: "/PROSPECTS.md" }, { path: "/data/alerts.json" },
  { path: "/data/products.json" }, { path: "/roxjaya/data/faq.json" }, { path: "/hq" },
  { path: "/desk/accounts/overview" },
  { path: "/desk/accounts/overview", headers: { "x-admin-key": "desk_nope" } },
  { path: "/admin/tax-report?tenant=all", auth: true },
  { path: "/admin/tax-report?tenant=all&format=csv", auth: true },
  { path: "/admin/platform-payments?tenant=all&aggregate=1", auth: true },
  { path: "/admin/hq/summary", auth: true },
  { path: "/admin/hq/gyms", auth: true },
  { path: "/admin/exceptions", auth: true },
  { method: "POST", path: "/stripe/webhook", body: {} },
  { method: "POST", path: "/create-checkout-session", body: { tenant_id: "roxjaya", items: [] }, headers: { referer: `${BASE}/roxjaya/` } },
  { method: "POST", path: "/create-checkout-session", body: { tenant_id: "roxjaya", items: [] }, headers: { referer: `${BASE}/pacegym/` } },
  { method: "POST", path: "/api/account/link", body: { email: "" } },
  { method: "POST", path: "/admin/hq/gyms", auth: true, body: { name: "" } },
  { method: "POST", path: "/desk/accounts/entries", auth: true, body: {}, headers: { referer: `${BASE}/roxjaya/money/` } },
  { method: "POST", path: "/desk/accounts/import/preview", auth: true, body: { csv: "" }, headers: { referer: `${BASE}/roxjaya/money/` } },
  { path: "/robots.txt" }, { path: "/sitemap.xml" }, { path: "/" }, { path: "/index.html" },
  { path: "/hq.html" }, { path: "/does-not-exist" }, { path: "/pet-safety-essentials" },
);

const lines = [];
for (const c of cases) lines.push(await probe(c));
fs.writeFileSync(OUT, `${lines.join("\n")}\n`);
console.log(`http snapshot: ${lines.length} probes → ${OUT}`);

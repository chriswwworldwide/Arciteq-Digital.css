// tools/compare-base.js — old-vs-new behaviour check for refactors.
// Sends the same requests to the pre-refactor server (BASE_OLD, a git
// worktree of the last commit before the refactor) and the current server
// (BASE_NEW), and reports any difference in status or body. Requests are
// chosen to be harmless: validation failures or no-ops on an empty DB —
// nothing that sends email, spawns imports or edits product files.
// Usage: BASE_OLD=http://localhost:3200 BASE_NEW=http://localhost:3000 node tools/compare-base.js
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });
const OLD = process.env.BASE_OLD || "http://localhost:3200";
const NEW = process.env.BASE_NEW || "http://localhost:3000";
const KEY = String(process.env.ADMIN_API_KEY || "");

const scrub = (s) =>
  s.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g, "~ts")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "~uuid")
    .replace(/"(startedAt|lastRunAt|now|updatedAt|generatedAt)":"[^"]*"/g, '"$1":"~"');

const A = { "x-admin-key": KEY };
const J = { "content-type": "application/json" };
const cases = [
  ["POST", "/admin/guides", { ...A, ...J }, {}],
  ["POST", "/admin/unpublish-product", { ...A, ...J }, {}],
  ["POST", "/admin/publish-draft", { ...A, ...J }, {}],
  ["POST", "/api/capture-email", J, { email: "not-an-email" }],
  ["POST", "/api/submissions", J, { kind: "nope" }],
  ["POST", "/api/pageview", J, {}],
  ["POST", "/admin/inbox", { ...A, ...J }, {}],
  ["POST", "/admin/inbox/does-not-exist", { ...A, ...J, referer: `${NEW}/roxjaya/coach/` }, { action: "approve" }],
  ["GET", "/admin/digest", A],
  ["POST", "/admin/orders/cleanup-stale", A],
  ["GET", "/admin/reconcile?order_id=nope", A],
  ["POST", "/admin/orders/nope/fulfil", { ...A, ...J }, {}],
  ["POST", "/admin/orders/nope/refund", { ...A, ...J }, {}],
  ["POST", "/admin/discounts", { ...A, ...J }, {}],
  ["POST", "/admin/inventory", { ...A, ...J }, {}],
  ["POST", "/admin/ad-spend", { ...A, ...J }, {}],
  ["POST", "/admin/ad-guardrails", { ...A, ...J }, {}],
  ["POST", "/admin/platform-payments", { ...A, ...J }, {}],
  ["POST", "/checkout/cancel", J, {}],
  ["GET", "/checkout/cancel"],
  ["POST", "/create-checkout-session", { ...J, referer: `${NEW}/roxjaya/` }, { tenant_id: "roxjaya", items: [] }],
  ["POST", "/create-checkout-session", J, { items: [{ productId: "x", quantity: 1 }] }],
  ["POST", "/api/account/link", J, { email: "" }],
  ["GET", "/api/stock?ids=a,b"],
  ["GET", "/api/shipping-estimate?productId=x"],
  ["GET", "/api/free-shipping-progress?subtotal=100"],
  ["GET", "/api/related-products?productId=x"],
  ["GET", "/api/tenant"],
  ["GET", "/api/submissions", A],
  ["GET", "/api/submissions/stats", A],
  ["GET", "/admin/traffic", { ...A, referer: `${NEW}/pacegym/coach/` }],
  ["GET", "/admin/people", { ...A, referer: `${NEW}/pacegym/coach/` }],
  ["GET", "/admin/inbox", { ...A, referer: `${NEW}/roxjaya/coach/` }],
  ["GET", "/admin/ops-health", A],
  ["GET", "/admin/ops-trends", A],
  ["GET", "/admin/attribution-summary", A],
  ["GET", "/admin/heartbeat", A],
  ["GET", "/admin/env", A],
  ["GET", "/product.html?id=nope"],
  ["GET", "/account/nobody"],
  ["GET", "/guides"],
];

let diffs = 0;
for (const [method, path, headers = {}, body] of cases) {
  const opts = { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" };
  const fix = (base) => ({ ...opts, headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v).replace(NEW, base)])) });
  const [a, b] = await Promise.all([OLD, NEW].map(async (base) => {
    try {
      const r = await fetch(base + path, fix(base));
      return `${r.status} ${scrub(await r.text()).slice(0, 2000)}`;
    } catch (e) {
      return `ERR ${e.message}`;
    }
  }));
  if (a !== b) {
    diffs += 1;
    console.log(`❌ ${method} ${path}\n   old: ${a.slice(0, 200)}\n   new: ${b.slice(0, 200)}`);
  }
}
fs.writeFileSync("/tmp/compare-base.txt", `${cases.length} requests, ${diffs} differences\n`);
console.log(diffs ? `❌ ${diffs} of ${cases.length} requests differ` : `✅ old vs new: ${cases.length} POST/admin requests identical`);
process.exit(diffs ? 1 : 0);

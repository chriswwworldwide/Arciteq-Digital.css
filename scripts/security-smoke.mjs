import http from "node:http";
import assert from "node:assert/strict";

const base = new URL(process.env.SECURITY_TEST_URL || "http://127.0.0.1:3000");
if (
  base.protocol !== "http:" ||
  !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
)
  throw new Error(
    "Security smoke checks require an isolated local HTTP server",
  );
const request = (pathname, method = "GET", headers = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: base.hostname.replace(/^\[|\]$/g, ""),
        port: base.port || 80,
        path: pathname,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(10000, () =>
      req.destroy(new Error("Smoke request timed out")),
    );
    req.end();
  });
const home = await request("/", "HEAD");
assert.equal(home.status, 200);
assert.equal(home.headers["x-powered-by"], undefined);
assert.equal(home.headers["x-content-type-options"], "nosniff");
assert.equal(home.headers["x-frame-options"], "SAMEORIGIN");
assert.ok(
  home.headers["content-security-policy"].includes("frame-ancestors 'self'"),
);
for (const pathname of [
  "/server.js",
  "/server/pitch.js",
  "/public/../server/pitch.js",
  "/public/%2e%2e/server/pitch.js",
  "/public/%252e%252e/server/pitch.js",
  "/data/alerts.json",
]) {
  const result = await request(pathname, "HEAD");
  assert.equal(result.status, 404, `Private path exposed: ${pathname}`);
}
const tenants = await request("/data/tenants.json");
assert.equal(tenants.status, 200);
const payload = JSON.parse(tenants.body);
assert.ok(Array.isArray(payload.tenants));
for (const tenant of payload.tenants)
  assert.deepEqual(Object.keys(tenant).sort(), [
    "catalog",
    "hostnames",
    "tenant_id",
  ]);
assert.equal((await request("/pitch-views?key=not-a-real-key")).status, 404);
assert.equal(
  (await request("/desk/accounts/entries?tenant=roxjaya")).status,
  401,
);
console.log(
  "Security smoke passed: headers, private-path aliases, safe tenant projection and unauthenticated private routes",
);

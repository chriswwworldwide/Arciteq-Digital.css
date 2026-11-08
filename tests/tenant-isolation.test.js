import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import { createAccountsRouter } from "../server/accounts.js";
import { createDeskAuth, hashDeskKey } from "../server/desk-auth.js";

let server;
let base;
let query;
let ensure;
const key = "desk_example_alpha_test_only";
beforeEach(async () => {
  query = vi.fn(async (sql, params) => {
    if (sql.startsWith("UPDATE desk_keys"))
      return {
        rows: params[0] === hashDeskKey(key) ? [{ tenant_id: "alpha" }] : [],
      };
    if (sql.includes("UPDATE ledger_entries")) return { rows: [] };
    return { rows: [{ id: "alpha-only-entry" }] };
  });
  ensure = vi.fn(async () => {});
  const tenants = [
    { tenant_id: "alpha", currency: "gbp" },
    { tenant_id: "beta", currency: "gbp" },
  ];
  const requireDeskAccess = createDeskAuth({
    dbQuery: query,
    ensureTables: ensure,
    adminApiKey: "test-platform-only",
    loadTenants: () => tenants,
    resolveTenantFromPage: () => tenants[1],
  });
  const app = express();
  app.use(express.json());
  app.use(
    createAccountsRouter({
      dbQuery: query,
      requireDeskAccess,
      ensureTables: ensure,
    }),
  );
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("private account route tenant isolation", () => {
  it("caps repeated authentication requests before querying the database", async () => {
    for (let i = 0; i < 120; i++)
      expect((await fetch(base + "/desk/accounts/entries")).status).toBe(401);
    const response = await fetch(base + "/desk/accounts/entries");
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated requests before touching tables or data", async () => {
    const response = await fetch(base + "/desk/accounts/entries?tenant=beta");
    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
    expect(ensure).not.toHaveBeenCalled();
  });
  it("ignores forged tenant parameters and page headers when reading with a coach key", async () => {
    const response = await fetch(base + "/desk/accounts/entries?tenant=beta", {
      headers: { "x-desk-key": key, referer: "https://example.test/beta/" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const [, params] = query.mock.calls.find(([sql]) =>
      sql.includes("FROM ledger_entries"),
    );
    expect(params[0]).toBe("alpha");
    expect(params).not.toContain("beta");
  });
  it("does not void another tenant's record using a forged request body", async () => {
    const response = await fetch(
      base + "/desk/accounts/entries/123/void?tenant=beta",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-desk-key": key },
        body: JSON.stringify({ tenant_id: "beta", reason: "test only" }),
      },
    );
    expect(response.status).toBe(404);
    const [, params] = query.mock.calls.find(([sql]) =>
      sql.includes("UPDATE ledger_entries"),
    );
    expect(params).toEqual([123, "alpha", "test only"]);
  });
  it("rejects unknown or revoked coach keys without accessing ledger data", async () => {
    const response = await fetch(base + "/desk/accounts/entries", {
      headers: { "x-desk-key": "desk_unknown_test_only" },
    });
    expect(response.status).toBe(401);
    expect(
      query.mock.calls.some(([sql]) => sql.includes("FROM ledger_entries")),
    ).toBe(false);
  });
});

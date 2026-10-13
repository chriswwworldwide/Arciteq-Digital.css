import { describe, it, expect, vi } from "vitest";
import {
  validateEntry,
  reservationAmountMinor,
  csvCell,
} from "../server/accounts.js";
import { createDeskAuth, hashDeskKey, newDeskKey } from "../server/desk-auth.js";

describe("validateEntry", () => {
  const ok = {
    direction: "income",
    category: "membership",
    entry_date: "2026-10-01",
    amount_minor: 85000000,
    method: "qris",
  };

  it("accepts a valid income entry and stamps the site currency", () => {
    const { entry, error } = validateEntry(ok, { currency: "idr" });
    expect(error).toBeUndefined();
    expect(entry).toMatchObject({ direction: "income", amount_minor: 85000000, tax_minor: 0, currency: "idr" });
  });

  it.each([
    [{ ...ok, direction: "sideways" }, "direction must be income or expense"],
    [{ ...ok, category: "venue" }, "invalid category"],
    [{ ...ok, direction: "expense" }, "invalid category"],
    [{ ...ok, entry_date: "1/10/2026" }, "entry_date must be YYYY-MM-DD"],
    [{ ...ok, amount_minor: 0 }, "amount must be more than zero"],
    [{ ...ok, tax_minor: 90000000 }, "tax must be between zero and the amount"],
    [{ ...ok, method: "crypto" }, "invalid method"],
  ])("rejects %j", (body, message) => {
    expect(validateEntry(body, { currency: "idr" }).error).toBe(message);
  });
});

describe("reservationAmountMinor", () => {
  it("reads rupiah and pound reservation payloads", () => {
    expect(reservationAmountMinor({ amount_idr: 850000 })).toBe(85000000);
    expect(reservationAmountMinor({ amount_gbp: 55 })).toBe(5500);
    expect(reservationAmountMinor({})).toBeNull();
  });
});

describe("csvCell", () => {
  it("quotes values and neutralises spreadsheet formulas", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell("+44 7000")).toBe(`"'+44 7000"`);
    expect(csvCell(null)).toBe('""');
  });
});

describe("desk auth", () => {
  const tenants = [{ tenant_id: "pacegym" }, { tenant_id: "roxjaya" }];
  const makeRes = () => {
    const res = { statusCode: 200 };
    res.status = (c) => ((res.statusCode = c), res);
    res.json = vi.fn(() => res);
    return res;
  };
  const deskKey = newDeskKey();
  const dbQuery = vi.fn(async (sql, params) =>
    params?.[0] === hashDeskKey(deskKey) ? { rows: [{ tenant_id: "pacegym" }] } : { rows: [] },
  );
  const requireDeskAccess = createDeskAuth({
    dbQuery,
    adminApiKey: "master-key",
    ensureTables: async () => {},
    loadTenants: () => tenants,
    resolveTenantFromPage: () => tenants[1],
  });

  it("locks a desk key to its own site whatever the request asks for", async () => {
    const access = await requireDeskAccess(
      { headers: { "x-admin-key": deskKey }, query: { tenant: "roxjaya" } },
      makeRes(),
    );
    expect(access).toEqual({ tenant: tenants[0], role: "coach" });
  });

  it("lets the platform key pick a site", async () => {
    const access = await requireDeskAccess(
      { headers: { "x-admin-key": "master-key" }, query: { tenant: "pacegym" } },
      makeRes(),
    );
    expect(access.role).toBe("admin");
    expect(access.tenant.tenant_id).toBe("pacegym");
  });

  it("rejects missing, unknown and non-desk keys", async () => {
    for (const key of ["", "desk_nope", "random"]) {
      const res = makeRes();
      const access = await requireDeskAccess({ headers: { "x-admin-key": key }, query: {} }, res);
      expect(access).toBeNull();
      expect(res.statusCode).toBe(401);
    }
  });

  it("makes long random keys and never stores them in plain text", () => {
    expect(deskKey).toMatch(/^desk_[0-9a-f]{48}$/);
    expect(hashDeskKey(deskKey)).not.toContain(deskKey);
  });
});

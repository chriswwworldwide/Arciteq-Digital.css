import { describe, it, expect, vi } from "vitest";
import {
  validateEntry,
  reservationAmountMinor,
  csvCell,
  recordsInfo,
} from "../server/accounts.js";

describe("recordsInfo", () => {
  it("Indonesia: every year since the first record, 10-year rule, reminds until the owner saves last year", () => {
    const base = { country: "ID", firstDate: "2024-03-10", today: "2026-10-14" };
    const r = recordsInfo({ ...base, exports: [] });
    expect(r.years).toEqual([2026, 2025, 2024]);
    expect(r.retention).toMatchObject({ years: 10, keepInCountry: true, keepUntil: "2035-12-31" });
    expect(r.last_period).toMatchObject({ from: "2025-01-01", to: "2025-12-31" });
    expect(r.needs_saving).toBe(true);
    // Our own (admin) download doesn't count as the owner's copy.
    expect(recordsInfo({ ...base, exports: [{ role: "admin", period_from: "2024-01-01", period_to: "2026-10-14" }] }).needs_saving).toBe(true);
    // The owner's all-years download covers it; a download of a different year doesn't.
    expect(recordsInfo({ ...base, exports: [{ role: "coach", period_from: "2024-03-10", period_to: "2026-10-14" }] }).needs_saving).toBe(false);
    expect(recordsInfo({ ...base, exports: [{ role: "coach", period_from: "2026-01-01", period_to: "2026-12-31" }] }).needs_saving).toBe(true);
  });

  it("UK: last finished tax year and HMRC keep-until date", () => {
    const r = recordsInfo({ country: "GB", firstDate: "2025-01-05", today: "2026-10-14", exports: [] });
    expect(r.last_period).toMatchObject({ label: "2025/26 tax year", from: "2025-04-06", to: "2026-04-05" });
    expect(r.retention.keepUntil).toBe("2032-01-31");
    expect(r.needs_saving).toBe(true);
  });

  it("doesn't nag a brand-new business with nothing in the last period", () => {
    const r = recordsInfo({ country: "ID", firstDate: "2026-09-01", today: "2026-10-14", exports: [] });
    expect(r.needs_saving).toBe(false);
    expect(r.years).toEqual([2026]);
  });
});
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

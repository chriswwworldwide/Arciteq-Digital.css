import { describe, it, expect } from "vitest";
import {
  accountingProfile,
  idPphFinal,
  ukTaxYear,
  nextMtdDeadline,
  gbVatStatus,
  mtdThresholdFor,
  ukKeepUntil,
  idKeepUntil,
} from "../src/tax-rules.js";

describe("record keeping", () => {
  it("matches gov.uk's example: 2022/23 records kept until end of January 2029", () => {
    expect(ukKeepUntil(2022)).toBe("2029-01-31");
    expect(ukKeepUntil(2026)).toBe("2033-01-31");
  });
  it("keeps Indonesian records for 10 years", () => {
    expect(idKeepUntil(2026)).toBe("2036-12-31");
  });
});

const rp = (n) => n * 100; // rupiah → minor units

describe("accountingProfile", () => {
  it("infers Indonesia from IDR and UK from GBP", () => {
    expect(accountingProfile({ currency: "idr" }).country).toBe("ID");
    expect(accountingProfile({ currency: "gbp" }).country).toBe("GB");
  });
  it("lets an explicit accounting block override", () => {
    const p = accountingProfile({
      currency: "gbp",
      accounting: { vatRegistered: true, taxpayer: "pt_perorangan" },
    });
    expect(p.vatRegistered).toBe(true);
    expect(p.taxpayer).toBe("pt_perorangan");
  });
});

describe("idPphFinal", () => {
  it("matches DJP's worked example: Rp700jt turnover → Rp1jt tax", () => {
    // pajak.go.id: 700jt − 500jt = 200jt × 0.5% = Rp1,000,000
    const months = Array(12).fill(0);
    months[0] = rp(700_000_000);
    const r = idPphFinal({ year: 2026, monthlyGrossMinor: months });
    expect(r.ytdTaxMinor).toBe(rp(1_000_000));
    expect(r.months[0].dueDate).toBe("2026-02-15");
  });

  it("charges nothing while under the Rp500jt allowance", () => {
    const r = idPphFinal({
      year: 2026,
      monthlyGrossMinor: Array(12).fill(rp(40_000_000)), // 480jt/yr
    });
    expect(r.ytdTaxMinor).toBe(0);
    expect(r.status).toBe("under_allowance");
    expect(r.allowanceRemainingMinor).toBe(rp(20_000_000));
  });

  it("only taxes the part of the crossing month above the allowance", () => {
    const months = Array(12).fill(rp(60_000_000)); // crosses 500jt in Sep
    const r = idPphFinal({ year: 2026, monthlyGrossMinor: months });
    // Jan–Aug cumulative 480jt; Sep adds 60jt → 40jt above allowance.
    expect(r.months[7].taxMinor).toBe(0);
    expect(r.months[8].taxMinor).toBe(rp(200_000)); // 0.5% × 40jt
    expect(r.months[9].taxMinor).toBe(rp(300_000)); // 0.5% × 60jt
    expect(r.months[11].dueDate).toBe("2027-01-15");
    expect(r.status).toBe("paying");
  });

  it("gives PT Perorangan no allowance", () => {
    const months = Array(12).fill(0);
    months[0] = rp(10_000_000);
    const r = idPphFinal({ year: 2026, monthlyGrossMinor: months, taxpayer: "pt_perorangan" });
    expect(r.ytdTaxMinor).toBe(rp(50_000));
  });

  it("flags turnover near and over the Rp4.8bn ceiling", () => {
    const near = Array(12).fill(0);
    near[0] = rp(4_000_000_000);
    expect(idPphFinal({ year: 2026, monthlyGrossMinor: near }).status).toBe("near_ceiling");
    const over = Array(12).fill(0);
    over[0] = rp(5_000_000_000);
    expect(idPphFinal({ year: 2026, monthlyGrossMinor: over }).status).toBe("over_ceiling");
  });
});

describe("UK helpers", () => {
  it("finds the tax year either side of 6 April", () => {
    expect(ukTaxYear("2026-04-05").label).toBe("2025/26");
    expect(ukTaxYear("2026-04-06").label).toBe("2026/27");
    expect(ukTaxYear("2026-10-13")).toEqual({
      start: "2026-04-06",
      end: "2027-04-05",
      label: "2026/27",
    });
  });

  it("finds the next MTD quarterly deadline", () => {
    expect(nextMtdDeadline("2026-10-13")).toBe("2026-11-07");
    expect(nextMtdDeadline("2026-11-08")).toBe("2027-02-07");
    expect(nextMtdDeadline("2026-08-07")).toBe("2026-08-07");
  });

  it("grades the rolling-12-month VAT position against £90k", () => {
    expect(gbVatStatus(60_000 * 100).status).toBe("ok");
    expect(gbVatStatus(70_000 * 100).status).toBe("watch");
    expect(gbVatStatus(85_000 * 100).status).toBe("near");
    expect(gbVatStatus(90_001 * 100).status).toBe("over");
  });

  it("returns the MTD threshold for each tax year", () => {
    expect(mtdThresholdFor("2025-04-06")).toBeNull();
    expect(mtdThresholdFor("2026-04-06")).toBe(50_000 * 100);
    expect(mtdThresholdFor("2027-04-06")).toBe(30_000 * 100);
    expect(mtdThresholdFor("2029-04-06")).toBe(20_000 * 100);
  });
});

import { describe, it, expect } from "vitest";
import {
  parseCsv,
  parseDate,
  parseAmount,
  guessMapping,
  categorise,
  buildImportRows,
  importFingerprint,
} from "../src/csv-import.js";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, newlines in quotes, BOM and blank lines", () => {
    const rows = parseCsv('\uFEFFa,b,c\n"x, y","say ""hi""","line1\nline2"\n\n1,2,3\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["x, y", 'say "hi"', "line1\nline2"],
      ["1", "2", "3"],
    ]);
  });
  it("detects semicolon and tab delimiters", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseDate", () => {
  it.each([
    ["2026-09-05", "2026-09-05"],
    ["2026-09-05T10:00:00Z", "2026-09-05"],
    ["05/09/2026", "2026-09-05"],
    ["5-9-26", "2026-09-05"],
    ["05.09.2026", "2026-09-05"],
    ["5 Sep 2026", "2026-09-05"],
    ["05 Agu 2026", "2026-08-05"],
    ["13 Okt 2026", "2026-10-13"],
    ["Sep 5, 2026", "2026-09-05"],
  ])("reads %s", (raw, iso) => {
    expect(parseDate(raw)).toBe(iso);
  });
  it("supports month-first when asked", () => {
    expect(parseDate("09/05/2026", { order: "mdy" })).toBe("2026-09-05");
  });
  it("rejects impossible dates and pending rows", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("PEND")).toBeNull();
    expect(parseDate("Total")).toBeNull();
  });
  it("uses inferred year for day/month-only dates", () => {
    expect(parseDate("15/09", { inferYear: () => 2026 })).toBe("2026-09-15");
    expect(parseDate("15/09")).toBeNull();
  });
});

describe("parseAmount", () => {
  it.each([
    ["£1,234.56", 123456, 1],
    ["-12.50", 1250, -1],
    ["(12.50)", 1250, -1],
    ["12.50-", 1250, -1],
    ["10,000,000.00", 1000000000, 1],
    ["850,000.00 CR", 85000000, 1],
    ["1,500,000.00 DB", 150000000, -1],
    ["Rp 1.234.567,00", 123456700, 1],
    ["Rp850.000", 85000000, 1],
    ["1.234", 123400, 1],
    ["12,50", 1250, 1],
    ["55", 5500, 1],
    ["+30.00", 3000, 1],
  ])("reads %s", (raw, minor, sign) => {
    expect(parseAmount(raw)).toEqual({ minor, sign });
  });
  it("rejects non-numbers", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("n/a")).toBeNull();
  });
});

describe("guessMapping", () => {
  it("maps a UK money-in/money-out export", () => {
    const m = guessMapping(["Date", "Description", "Money In", "Money Out", "Balance"]);
    expect(m).toMatchObject({ date: 0, description: 1, credit: 2, debit: 3, amount: -1 });
  });
  it("spots an unlabelled CR/DB flow column", () => {
    const m = guessMapping(
      ["Date", "Description", "Branch", "Amount", "", "Balance"],
      [["15/09", "TRSF", "0000", "850,000.00", "CR", "1,000.00"]],
    );
    expect(m).toMatchObject({ date: 0, description: 1, amount: 3, flow: 4 });
  });
});

describe("categorise", () => {
  it("suggests sensible categories and flags Stripe payouts", () => {
    expect(categorise("STRIPE PAYMENTS UK", "income")).toBe("site_payout");
    expect(categorise("PT session Sarah", "income")).toBe("coaching");
    expect(categorise("Sewa studio Kemang", "expense")).toBe("venue");
    expect(categorise("GRAB* RIDE", "expense")).toBe("travel");
    expect(categorise("FACEBK ADS", "expense")).toBe("marketing");
    expect(categorise("TESCO STORES", "expense")).toBe("other_expense");
    expect(categorise("META PLATFORMS", "expense")).toBe("marketing");
    expect(categorise("J SMITH", "income")).toBe("membership");
  });
});

describe("buildImportRows", () => {
  it("imports a UK bank export with separate in/out columns", () => {
    const csv = [
      "Date,Description,Money In,Money Out,Balance",
      "01/10/2026,GOCARDLESS LTD,1250.00,,5000.00",
      "02/10/2026,DECATHLON,,89.99,4910.01",
      "03/10/2026,STRIPE PAYMENTS UK,300.00,,5210.01",
    ].join("\n");
    const r = buildImportRows(csv, { today: "2026-10-14" });
    expect(r.skipped).toEqual([]);
    expect(r.rows.map((x) => [x.date, x.direction, x.amount_minor, x.category])).toEqual([
      ["2026-10-01", "income", 125000, "membership"],
      ["2026-10-02", "expense", 8999, "equipment"],
      ["2026-10-03", "income", 30000, "site_payout"],
    ]);
  });

  it("imports a BCA-style export: preamble, period year, CR/DB flow, PEND and totals", () => {
    const csv = [
      "Account No.,=,'2311992009",
      "Name,=,IDA ROSDIANA",
      "Period,=,01/12/2026 - 05/01/2027",
      "Currency,=,IDR",
      "Date,Description,Branch,Amount,,Balance",
      "'28/12,TRSF E-BANKING CR 2812/FTSCY/WS95031 850000.00 RJ-AB12 BUDI SANTOSO,0000,850000.00,CR,1850000.00",
      "'30/12,TRSF E-BANKING DB SEWA STUDIO KEMANG,0000,1500000.00,DB,350000.00",
      "'02/01,KR OTOMATIS LLG-ANDI,0000,599000.00,CR,949000.00",
      "PEND,TRSF E-BANKING CR PENDING,0000,100000.00,CR,1049000.00",
      "Starting Balance,=,1000000.00",
      "Credit,=,1449000.00",
    ].join("\n");
    const r = buildImportRows(csv, { today: "2027-01-06" });
    expect(r.rows.map((x) => [x.date, x.direction, x.amount_minor, x.category])).toEqual([
      ["2026-12-28", "income", 85000000, "membership"],
      ["2026-12-30", "expense", 150000000, "venue"],
      ["2027-01-02", "income", 59900000, "membership"],
    ]);
    expect(r.skipped.map((s) => s.reason)).toEqual([
      "pending (not cleared yet)",
      "no date",
      "no date",
    ]);
  });

  it("imports a signed single-amount export and counts identical rows separately", () => {
    const csv = "Date,Name,Amount\n2026-10-01,Cash class,10.00\n2026-10-01,Cash class,10.00\n2026-10-02,Venue,-200";
    const r = buildImportRows(csv);
    expect(r.rows.map((x) => x.occurrence)).toEqual([1, 2, 1]);
    expect(r.rows[2]).toMatchObject({ direction: "expense", amount_minor: 20000 });
  });

  it("explains files it can't read", () => {
    expect(buildImportRows("hello,world\nfoo,bar").error).toMatch(/date and amount/);
  });
});

describe("importFingerprint", () => {
  it("is stable per tenant and occurrence", () => {
    const row = { date: "2026-10-01", direction: "income", amount_minor: 1000, description: "A  B" };
    const a = importFingerprint("pacegym", row, 1);
    expect(importFingerprint("pacegym", { ...row, description: "a b" }, 1)).toBe(a);
    expect(importFingerprint("pacegym", row, 2)).not.toBe(a);
    expect(importFingerprint("roxjaya", row, 1)).not.toBe(a);
  });
});

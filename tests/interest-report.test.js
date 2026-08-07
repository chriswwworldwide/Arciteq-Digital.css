// tests/interest-report.test.js
import { describe, it, expect } from "vitest";
import { summarizeInterest, DIRECT } from "../src/interest-report.js";

describe("summarizeInterest", () => {
  it("tallies captures by source, sorted by count desc", () => {
    const report = summarizeInterest([
      { source: "segment:breeders" },
      { source: "segment:show-dogs" },
      { source: "segment:breeders" },
      { source: "segment:breeders" },
      { source: "segment:show-dogs" },
    ]);
    expect(report.total).toBe(5);
    expect(report.bySource).toEqual([
      { source: "segment:breeders", count: 3 },
      { source: "segment:show-dogs", count: 2 },
    ]);
  });

  it("buckets missing/blank sources under DIRECT", () => {
    const report = summarizeInterest([
      { source: "" },
      {},
      { source: "  " },
      { source: "segment:breeders" },
    ]);
    const direct = report.bySource.find((r) => r.source === DIRECT);
    expect(direct.count).toBe(3);
    expect(report.total).toBe(4);
  });

  it("breaks count ties by source name asc", () => {
    const report = summarizeInterest([
      { source: "segment:zebra" },
      { source: "segment:alpha" },
    ]);
    expect(report.bySource.map((r) => r.source)).toEqual([
      "segment:alpha",
      "segment:zebra",
    ]);
  });

  it("handles non-array input", () => {
    expect(summarizeInterest(null)).toEqual({ total: 0, bySource: [] });
  });
});

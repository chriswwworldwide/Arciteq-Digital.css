// tests/attribution.test.js
import { describe, it, expect } from "vitest";
import {
  buildAttributionReport,
  buildExperimentReport,
  formatMinor,
  NUDGE_TYPES,
} from "../src/attribution.js";

describe("buildAttributionReport", () => {
  it("returns zeroed buckets for empty input", () => {
    const r = buildAttributionReport();
    for (const t of NUDGE_TYPES) {
      expect(r.byNudgeType[t]).toEqual({
        sent: 0,
        converted: 0,
        revenueMinor: 0,
        conversionRate: 0,
      });
    }
    expect(r.totals.totalConverted).toBe(0);
  });

  it("tolerates non-array inputs", () => {
    const r = buildAttributionReport({ nudgeEvents: null, conversions: null });
    expect(r.totals.sent).toBe(0);
    expect(r.totals.totalConverted).toBe(0);
  });

  it("counts sends and credits conversions to the last nudge (with rate + revenue)", () => {
    const r = buildAttributionReport({
      nudgeEvents: [
        { nudgeType: "nudge1" },
        { nudgeType: "nudge1" },
        { nudgeType: "nudge1" },
        { nudgeType: "nudge1" },
        { nudgeType: "nudge2" },
        { nudgeType: "winback" },
        { nudgeType: "winback" },
      ],
      conversions: [
        { nudgeType: "nudge1", amountMinor: 4999 },
        { nudgeType: "winback", amountMinor: 12900 },
      ],
    });
    expect(r.byNudgeType.nudge1.sent).toBe(4);
    expect(r.byNudgeType.nudge1.converted).toBe(1);
    expect(r.byNudgeType.nudge1.revenueMinor).toBe(4999);
    expect(r.byNudgeType.nudge1.conversionRate).toBeCloseTo(0.25, 5);
    expect(r.byNudgeType.winback.conversionRate).toBeCloseTo(0.5, 5);
    expect(r.totals.sent).toBe(7);
    expect(r.totals.nudgeConverted).toBe(2);
    expect(r.totals.nudgeRevenueMinor).toBe(17899);
  });

  it("buckets un-nudged conversions as organic and normalizes unknown types", () => {
    const r = buildAttributionReport({
      nudgeEvents: [{ nudgeType: "NUDGE1" }, { nudgeType: "bogus" }],
      conversions: [
        { nudgeType: "", amountMinor: 1000 },
        { nudgeType: null, amountMinor: 500 },
        { nudgeType: "unknown", amountMinor: 250 },
      ],
    });
    // "NUDGE1" normalizes; "bogus" is ignored.
    expect(r.byNudgeType.nudge1.sent).toBe(1);
    expect(r.organic.converted).toBe(3);
    expect(r.organic.revenueMinor).toBe(1750);
    expect(r.totals.totalConverted).toBe(3);
    expect(r.totals.totalRevenueMinor).toBe(1750);
  });

  it("ignores non-integer amounts (guards against float/minor-unit mistakes)", () => {
    const r = buildAttributionReport({
      nudgeEvents: [{ nudgeType: "nudge2" }],
      conversions: [{ nudgeType: "nudge2", amountMinor: 49.99 }],
    });
    expect(r.byNudgeType.nudge2.converted).toBe(1);
    expect(r.byNudgeType.nudge2.revenueMinor).toBe(0);
  });
});

describe("buildExperimentReport", () => {
  it("counts exposures, conversions, revenue and rate per variant", () => {
    const report = buildExperimentReport({
      exposures: [
        { experimentKey: "trust", variant: "a" },
        { experimentKey: "trust", variant: "a" },
        { experimentKey: "trust", variant: "b" },
        { experimentKey: "trust", variant: "b" },
      ],
      conversions: [
        { experimentKey: "trust", variant: "a", amountMinor: 4999 },
        { experimentKey: "trust", variant: "b", amountMinor: 1000 },
        { experimentKey: "trust", variant: "b", amountMinor: 2000 },
      ],
    });
    expect(report.byExperiment.trust.variants.a).toEqual({
      exposed: 2,
      converted: 1,
      revenueMinor: 4999,
      conversionRate: 0.5,
    });
    expect(report.byExperiment.trust.variants.b).toEqual({
      exposed: 2,
      converted: 2,
      revenueMinor: 3000,
      conversionRate: 1,
    });
  });

  it("ignores rows with a missing key or variant and non-integer revenue", () => {
    const report = buildExperimentReport({
      exposures: [
        { experimentKey: "", variant: "a" },
        { experimentKey: "x", variant: "" },
        { experimentKey: "x", variant: "v" },
      ],
      conversions: [{ experimentKey: "x", variant: "v", amountMinor: 9.99 }],
    });
    expect(Object.keys(report.byExperiment)).toEqual(["x"]);
    expect(report.byExperiment.x.variants.v).toEqual({
      exposed: 1,
      converted: 1,
      revenueMinor: 0,
      conversionRate: 1,
    });
  });

  it("returns an empty map for no input", () => {
    expect(buildExperimentReport()).toEqual({ byExperiment: {} });
  });
});

describe("formatMinor", () => {
  it("formats minor units to a 2dp string", () => {
    expect(formatMinor(4999)).toBe("49.99");
    expect(formatMinor(0)).toBe("0.00");
    expect(formatMinor(12.5)).toBe("0.00"); // non-integer guarded to 0
  });
});

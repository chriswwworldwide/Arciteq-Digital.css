// tests/data-stitch.test.js
import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  isValidEmail,
  nudgeTypeForCount,
  orderTotalsDelta,
  pickFirstTouch,
  sanitizeExperiments,
} from "../src/data-stitch.js";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  it("handles nullish input", () => {
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(null)).toBe("");
  });
});

describe("isValidEmail", () => {
  it("accepts a normal address", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
  });
  it("rejects malformed / empty addresses", () => {
    expect(isValidEmail("no-at-sign")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

describe("nudgeTypeForCount", () => {
  it("maps counts to stable labels", () => {
    expect(nudgeTypeForCount(0)).toBe("nudge1");
    expect(nudgeTypeForCount(1)).toBe("nudge2");
    expect(nudgeTypeForCount(2)).toBe("winback");
  });
  it("caps beyond the win-back nudge", () => {
    expect(nudgeTypeForCount(3)).toBeNull();
    expect(nudgeTypeForCount(99)).toBeNull();
  });
  it("coerces string counts", () => {
    expect(nudgeTypeForCount("0")).toBe("nudge1");
  });
});

describe("orderTotalsDelta", () => {
  it("counts one order and the integer minor-unit amount", () => {
    expect(orderTotalsDelta(4999)).toEqual({ orders: 1, spendMinor: 4999 });
  });
  it("treats non-integer amounts as zero spend but still one order", () => {
    expect(orderTotalsDelta(49.99)).toEqual({ orders: 1, spendMinor: 0 });
    expect(orderTotalsDelta(null)).toEqual({ orders: 1, spendMinor: 0 });
    expect(orderTotalsDelta(undefined)).toEqual({ orders: 1, spendMinor: 0 });
  });
});

describe("pickFirstTouch", () => {
  it("keeps an existing attribution", () => {
    expect(pickFirstTouch("google", "tiktok")).toBe("google");
  });
  it("uses the incoming value when none exists", () => {
    expect(pickFirstTouch("", "tiktok")).toBe("tiktok");
    expect(pickFirstTouch(null, "  tiktok ")).toBe("tiktok");
  });
  it("returns null when both are empty", () => {
    expect(pickFirstTouch("", "")).toBeNull();
    expect(pickFirstTouch(null, undefined)).toBeNull();
  });
});

describe("sanitizeExperiments", () => {
  it("maps { variant } objects (browser shape) to experimentKey -> variantId", () => {
    expect(
      sanitizeExperiments({
        trust_strip_headline_v1: { variant: "peace_of_mind", at: "2026-01-01" },
      }),
    ).toEqual({ trust_strip_headline_v1: "peace_of_mind" });
  });
  it("accepts flat string variant values", () => {
    expect(sanitizeExperiments({ exp_a: "b" })).toEqual({ exp_a: "b" });
  });
  it("trims keys/values and drops empty ones", () => {
    expect(
      sanitizeExperiments({
        "  exp  ": "  v  ",
        empty: "",
        blank: { variant: "" },
      }),
    ).toEqual({ exp: "v" });
  });
  it("caps the number of experiments", () => {
    const raw = {};
    for (let i = 0; i < 30; i++) raw[`e${i}`] = `v${i}`;
    expect(
      Object.keys(sanitizeExperiments(raw, { maxExperiments: 5 })),
    ).toHaveLength(5);
  });
  it("returns null for non-objects, arrays, and empty results", () => {
    expect(sanitizeExperiments(null)).toBeNull();
    expect(sanitizeExperiments("x")).toBeNull();
    expect(sanitizeExperiments(["a"])).toBeNull();
    expect(sanitizeExperiments({})).toBeNull();
    expect(sanitizeExperiments({ a: "" })).toBeNull();
  });
});

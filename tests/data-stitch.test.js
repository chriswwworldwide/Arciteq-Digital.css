// tests/data-stitch.test.js
import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  isValidEmail,
  nudgeTypeForCount,
  orderTotalsDelta,
  pickFirstTouch,
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

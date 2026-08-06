import { describe, it, expect } from "vitest";
import { formatMoney, freeShippingProgress } from "../src/free-shipping.js";

describe("formatMoney", () => {
  it("formats known currencies with symbols", () => {
    expect(formatMoney(810, "GBP")).toBe("\u00A38.10");
    expect(formatMoney(12900, "EUR")).toBe("\u20AC129.00");
    expect(formatMoney(500, "USD")).toBe("$5.00");
  });
  it("falls back to a code suffix for unknown currencies", () => {
    expect(formatMoney(1000, "JPY")).toBe("10.00 JPY");
  });
  it("treats invalid amounts as zero", () => {
    expect(formatMoney("x", "GBP")).toBe("\u00A30.00");
    expect(formatMoney(-5, "GBP")).toBe("\u00A30.00");
  });
});

describe("freeShippingProgress", () => {
  it("is disabled when the threshold is missing or zero", () => {
    const r = freeShippingProgress(5000, { thresholdMinor: 0 });
    expect(r.enabled).toBe(false);
    expect(r.qualified).toBe(false);
    expect(r.message).toBe("");
  });

  it("reports remaining amount below the threshold", () => {
    const r = freeShippingProgress(4190, {
      thresholdMinor: 5000,
      currency: "GBP",
    });
    expect(r.qualified).toBe(false);
    expect(r.remainingMinor).toBe(810);
    expect(r.remainingLabel).toBe("\u00A38.10");
    expect(r.message).toBe("Add \u00A38.10 more for free shipping");
    expect(r.progress).toBeCloseTo(0.838);
  });

  it("qualifies at or above the threshold and caps progress at 1", () => {
    const at = freeShippingProgress(5000, { thresholdMinor: 5000 });
    expect(at.qualified).toBe(true);
    expect(at.remainingMinor).toBe(0);
    expect(at.progress).toBe(1);
    expect(at.message).toBe("You've unlocked free shipping!");

    const over = freeShippingProgress(9000, { thresholdMinor: 5000 });
    expect(over.qualified).toBe(true);
    expect(over.progress).toBe(1);
  });

  it("defaults currency to GBP and guards invalid subtotal", () => {
    const r = freeShippingProgress("nonsense", { thresholdMinor: 5000 });
    expect(r.subtotalMinor).toBe(0);
    expect(r.remainingMinor).toBe(5000);
    expect(r.remainingLabel).toBe("\u00A350.00");
  });
});

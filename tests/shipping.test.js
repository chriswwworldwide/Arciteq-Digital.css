import { describe, it, expect } from "vitest";
import {
  REGIONS,
  normalizeRegion,
  resolveRegion,
  originRegion,
  deliveryEstimate,
  estimateForProduct,
  shipsFromLabel,
  formatEstimate,
} from "../src/shipping.js";

describe("normalizeRegion", () => {
  it("recognises known regions case-insensitively", () => {
    expect(normalizeRegion("uk")).toBe("UK");
    expect(normalizeRegion(" EU ")).toBe("EU");
    expect(normalizeRegion("US")).toBe("US");
  });
  it("falls back to Other", () => {
    expect(normalizeRegion("CA")).toBe("Other");
    expect(normalizeRegion(null)).toBe("Other");
  });
});

describe("resolveRegion", () => {
  it("maps ISO country codes to regions", () => {
    expect(resolveRegion("GB")).toBe("UK");
    expect(resolveRegion("de")).toBe("EU");
    expect(resolveRegion("US")).toBe("US");
  });
  it("passes through region tokens and defaults unknown to Other", () => {
    expect(resolveRegion("EU")).toBe("EU");
    expect(resolveRegion("JP")).toBe("Other");
    expect(resolveRegion(undefined)).toBe("Other");
  });
});

describe("originRegion", () => {
  it("prefers warehouseLocation, then shippingOrigin", () => {
    expect(originRegion({ warehouseLocation: "UK" })).toBe("UK");
    expect(originRegion({ shippingOrigin: "US" })).toBe("US");
    expect(originRegion({})).toBe("Other");
  });
});

describe("deliveryEstimate", () => {
  it("is fastest domestically", () => {
    expect(deliveryEstimate("UK", "UK")).toEqual({ minDays: 1, maxDays: 3 });
    expect(deliveryEstimate("US", "US")).toEqual({ minDays: 2, maxDays: 5 });
  });
  it("is slower cross-region", () => {
    const uk = deliveryEstimate("UK", "UK");
    const cross = deliveryEstimate("UK", "US");
    expect(cross.maxDays).toBeGreaterThan(uk.maxDays);
  });
  it("normalizes unknown regions to Other", () => {
    expect(deliveryEstimate("XX", "YY")).toEqual({ minDays: 10, maxDays: 21 });
  });
});

describe("estimateForProduct", () => {
  it("combines product origin and destination country", () => {
    const product = { warehouseLocation: "UK" };
    expect(estimateForProduct(product, "GB")).toEqual({
      minDays: 1,
      maxDays: 3,
    });
    expect(estimateForProduct(product, "US")).toEqual({
      minDays: 5,
      maxDays: 9,
    });
  });
});

describe("shipsFromLabel", () => {
  it("renders a trust label", () => {
    expect(shipsFromLabel({ warehouseLocation: "EU" })).toBe("Ships from EU");
    expect(shipsFromLabel({})).toBe("Ships from Other");
  });
});

describe("formatEstimate", () => {
  it("formats a range and a single value", () => {
    expect(formatEstimate({ minDays: 1, maxDays: 3 })).toBe(
      "1\u20133 business days",
    );
    expect(formatEstimate({ minDays: 4, maxDays: 4 })).toBe("4 business days");
  });
  it("returns empty string for invalid input", () => {
    expect(formatEstimate()).toBe("");
    expect(formatEstimate({ minDays: NaN, maxDays: 3 })).toBe("");
  });
});

describe("REGIONS", () => {
  it("exposes the canonical region list", () => {
    expect(REGIONS).toEqual(["UK", "EU", "US", "Other"]);
  });
});

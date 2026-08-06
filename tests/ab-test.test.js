import { describe, it, expect } from "vitest";
import {
  hashToUnit,
  normalizeVariants,
  assignVariant,
} from "../src/ab-test.js";

describe("hashToUnit", () => {
  it("is deterministic and within [0,1)", () => {
    const a = hashToUnit("abc");
    expect(a).toBe(hashToUnit("abc"));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
  it("differs for different inputs", () => {
    expect(hashToUnit("abc")).not.toBe(hashToUnit("abd"));
  });
});

describe("normalizeVariants", () => {
  it("accepts string variants as weight 1", () => {
    expect(normalizeVariants(["a", "b"])).toEqual([
      { id: "a", weight: 1 },
      { id: "b", weight: 1 },
    ]);
  });
  it("drops null, empty-id, and non-positive weights", () => {
    const out = normalizeVariants([
      null,
      { id: "", weight: 5 },
      { id: "a", weight: 0 },
      { id: "b", weight: -2 },
      { id: "c", weight: 3 },
    ]);
    expect(out).toEqual([{ id: "c", weight: 3 }]);
  });
  it("returns [] for non-array input", () => {
    expect(normalizeVariants(undefined)).toEqual([]);
  });
});

describe("assignVariant", () => {
  it("returns null when there are no valid variants", () => {
    expect(
      assignVariant({ experimentKey: "x", visitorId: "v", variants: [] }),
    ).toBeNull();
  });

  it("returns the only variant without hashing", () => {
    expect(
      assignVariant({ experimentKey: "x", visitorId: "v", variants: ["only"] }),
    ).toBe("only");
  });

  it("is stable for the same visitor + experiment", () => {
    const args = {
      experimentKey: "headline",
      visitorId: "user-123",
      variants: ["A", "B"],
    };
    const first = assignVariant(args);
    expect(assignVariant(args)).toBe(first);
    expect(["A", "B"]).toContain(first);
  });

  it("distributes roughly according to weights", () => {
    const variants = [
      { id: "A", weight: 90 },
      { id: "B", weight: 10 },
    ];
    let b = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) {
      if (
        assignVariant({
          experimentKey: "price",
          visitorId: `visitor-${i}`,
          variants,
        }) === "B"
      ) {
        b++;
      }
    }
    const share = b / n;
    // Expect ~10% in B; allow a generous band for hash noise.
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.15);
  });

  it("assigns every visitor to a defined variant", () => {
    const variants = ["A", "B", "C"];
    for (let i = 0; i < 200; i++) {
      const v = assignVariant({
        experimentKey: "trust",
        visitorId: `v${i}`,
        variants,
      });
      expect(variants).toContain(v);
    }
  });
});

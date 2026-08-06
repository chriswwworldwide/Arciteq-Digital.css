// tests/abandoned-cart-recovery.test.js
import { describe, it, expect } from "vitest";
import {
  loadProductsMap,
  getNudgeWindowMs,
  buildRecoveryEmail,
} from "../scripts/abandoned-cart-recovery.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const products = new Map([
  [
    "p1",
    { title: "Self-Warming Pet Mat", price: { amount: 2500, currency: "gbp" } },
  ],
  [
    "p2",
    { title: "Chew-Safe Puzzle Toy", price: { amount: 999, currency: "usd" } },
  ],
]);

describe("getNudgeWindowMs", () => {
  it("returns the first-nudge window (1 day) for nudgeCount 0", () => {
    expect(getNudgeWindowMs(0)).toBe(1 * DAY_MS);
  });

  it("returns the second-nudge window (7 days) for nudgeCount 1", () => {
    expect(getNudgeWindowMs(1)).toBe(7 * DAY_MS);
  });

  it("returns Infinity once the max nudges are exhausted", () => {
    expect(getNudgeWindowMs(2)).toBe(Infinity);
    expect(getNudgeWindowMs(5)).toBe(Infinity);
  });
});

describe("buildRecoveryEmail", () => {
  it("formats line items with quantity, title, and price in major units", () => {
    const { body } = buildRecoveryEmail(
      [
        { id: "p1", qty: 2 },
        { id: "p2", qty: 1 },
      ],
      products,
      0,
    );
    expect(body).toContain("2x Self-Warming Pet Mat — 50.00 GBP");
    expect(body).toContain("1x Chew-Safe Puzzle Toy — 9.99 USD");
  });

  it("defaults quantity to 1 and drops unknown product ids", () => {
    const { body } = buildRecoveryEmail(
      [{ id: "p1" }, { id: "does-not-exist", qty: 3 }],
      products,
      0,
    );
    expect(body).toContain("1x Self-Warming Pet Mat — 25.00 GBP");
    expect(body).not.toContain("does-not-exist");
  });

  it("uses the first-nudge subject and copy for nudgeCount 0", () => {
    const { subject, body } = buildRecoveryEmail(
      [{ id: "p1", qty: 1 }],
      products,
      0,
    );
    expect(subject).toBe("You left something behind for your pet");
    expect(body).toContain("You started shopping but didn't finish");
  });

  it("uses the last-chance subject and copy for later nudges", () => {
    const { subject, body } = buildRecoveryEmail(
      [{ id: "p1", qty: 1 }],
      products,
      1,
    );
    expect(subject).toBe("Your pet's cart is still waiting — last chance");
    expect(body).toContain("This is a friendly last nudge");
  });

  it("produces an empty item list when the cart is empty", () => {
    const { body } = buildRecoveryEmail([], products, 0);
    expect(body).toContain("Here's what you left in your cart:");
  });
});

describe("loadProductsMap", () => {
  it("loads data/products.json into a Map keyed by productId", () => {
    const map = loadProductsMap();
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBeGreaterThan(0);
    for (const [key, value] of map) {
      expect(typeof key).toBe("string");
      expect(String(value.productId)).toBe(key);
    }
  });
});

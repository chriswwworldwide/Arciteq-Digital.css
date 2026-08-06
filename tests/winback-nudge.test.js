// tests/winback-nudge.test.js
import { describe, it, expect } from "vitest";
import {
  getNudgeWindowMs,
  buildRecoveryEmail,
} from "../scripts/abandoned-cart-recovery.js";

const DAY = 24 * 60 * 60 * 1000;

describe("getNudgeWindowMs (with win-back)", () => {
  it("schedules nudge 1 and nudge 2 with increasing delays", () => {
    expect(getNudgeWindowMs(0)).toBe(1 * DAY);
    expect(getNudgeWindowMs(1)).toBe(7 * DAY);
  });
  it("adds a much later win-back window for the 3rd touch", () => {
    expect(getNudgeWindowMs(2)).toBe(30 * DAY);
    expect(getNudgeWindowMs(2)).toBeGreaterThan(getNudgeWindowMs(1));
  });
  it("caps beyond the win-back touch", () => {
    expect(getNudgeWindowMs(3)).toBe(Infinity);
  });
});

describe("buildRecoveryEmail", () => {
  const products = new Map([
    ["p1", { title: "Calming Bed", price: { amount: 4999, currency: "gbp" } }],
  ]);
  const items = [{ id: "p1", qty: 1 }];

  it("nudge 1 (count 0) uses the cart-recovery framing", () => {
    const { subject, body } = buildRecoveryEmail(items, products, 0);
    expect(subject).toMatch(/left something behind/i);
    expect(body).toContain("cart.html");
    expect(body).toContain("Calming Bed");
  });

  it("nudge 2 (count 1) is the last-chance cart nudge", () => {
    const { subject, body } = buildRecoveryEmail(items, products, 1);
    expect(subject).toMatch(/last chance/i);
    expect(body).toContain("cart.html");
  });

  it("win-back (count 2) is reframed, not a stale-cart last chance", () => {
    const { subject, body } = buildRecoveryEmail(items, products, 2);
    expect(subject).not.toMatch(/last chance/i);
    expect(subject).not.toMatch(/cart/i);
    // no false urgency, no discount
    expect(body).not.toMatch(/cleared/i);
    expect(body).not.toMatch(/%|discount|coupon/i);
    expect(body).toMatch(/no rush|no pressure|peace of mind/i);
    // still lists the items and points somewhere useful
    expect(body).toContain("Calming Bed");
    expect(body).toContain("shop.html");
  });
});

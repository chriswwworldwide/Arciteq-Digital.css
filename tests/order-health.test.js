import { describe, it, expect } from "vitest";
import {
  detectOrderIssues,
  toEpochMs,
  DEFAULT_THRESHOLDS,
} from "../src/order-health.js";

const NOW = Date.parse("2026-08-05T12:00:00Z");
const minsAgo = (m) => new Date(NOW - m * 60 * 1000).toISOString();
const hoursAgo = (h) => new Date(NOW - h * 60 * 60 * 1000).toISOString();

describe("toEpochMs", () => {
  it("parses Date, epoch-ms, and ISO string", () => {
    const d = new Date(NOW);
    expect(toEpochMs(d)).toBe(NOW);
    expect(toEpochMs(NOW)).toBe(NOW);
    expect(toEpochMs("2026-08-05T12:00:00Z")).toBe(NOW);
  });
  it("returns NaN for unparseable input", () => {
    expect(Number.isNaN(toEpochMs("not-a-date"))).toBe(true);
    expect(Number.isNaN(toEpochMs(null))).toBe(true);
  });
});

describe("detectOrderIssues", () => {
  it("flags pending orders older than the threshold as stuck (missed webhook)", () => {
    const orders = [
      { order_id: "a", status: "pending", created_at: minsAgo(90) },
      { order_id: "b", status: "pending", created_at: minsAgo(5) },
    ];
    const r = detectOrderIssues(orders, { now: NOW });
    expect(r.counts.pendingStuck).toBe(1);
    expect(r.pendingStuck[0].order_id).toBe("a");
    expect(r.ok).toBe(false);
  });

  it("flags paid orders untouched beyond the fulfilment window", () => {
    const orders = [
      { order_id: "a", status: "paid", updated_at: hoursAgo(72) },
      { order_id: "b", status: "paid", updated_at: hoursAgo(1) },
    ];
    const r = detectOrderIssues(orders, { now: NOW });
    expect(r.counts.paidUnfulfilled).toBe(1);
    expect(r.paidUnfulfilled[0].order_id).toBe("a");
  });

  it("collects failed payments regardless of age", () => {
    const orders = [
      { order_id: "x", status: "failed", created_at: minsAgo(1) },
    ];
    const r = detectOrderIssues(orders, { now: NOW });
    expect(r.counts.failed).toBe(1);
  });

  it("returns ok when everything is healthy", () => {
    const orders = [
      { order_id: "a", status: "paid", updated_at: hoursAgo(1) },
      { order_id: "b", status: "pending", created_at: minsAgo(2) },
      { order_id: "c", status: "abandoned", created_at: hoursAgo(200) },
    ];
    const r = detectOrderIssues(orders, { now: NOW });
    expect(r.ok).toBe(true);
    expect(r.counts).toEqual({
      pendingStuck: 0,
      paidUnfulfilled: 0,
      failed: 0,
    });
  });

  it("normalizes status case and honours custom thresholds", () => {
    const orders = [
      { order_id: "a", status: "PENDING", created_at: minsAgo(20) },
    ];
    expect(detectOrderIssues(orders, { now: NOW }).counts.pendingStuck).toBe(0);
    expect(
      detectOrderIssues(orders, { now: NOW, pendingStuckMinutes: 10 }).counts
        .pendingStuck,
    ).toBe(1);
  });

  it("guards non-array input and exposes default thresholds", () => {
    expect(detectOrderIssues(null).ok).toBe(true);
    expect(detectOrderIssues(undefined).counts.failed).toBe(0);
    expect(DEFAULT_THRESHOLDS.pendingStuckMinutes).toBe(60);
    expect(DEFAULT_THRESHOLDS.paidUnfulfilledHours).toBe(48);
  });
});

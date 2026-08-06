// tests/perf-budget.test.js
import { describe, it, expect } from "vitest";
import {
  classifyAsset,
  checkAssets,
  formatBytes,
  DEFAULT_BUDGET,
} from "../src/perf-budget.js";

describe("classifyAsset", () => {
  it("classifies by extension", () => {
    expect(classifyAsset("/images2/screenshot-1.PNG")).toBe("image");
    expect(classifyAsset("hero.webp")).toBe("image");
    expect(classifyAsset("script.js")).toBe("script");
    expect(classifyAsset("mod.mjs")).toBe("script");
    expect(classifyAsset("styles/styles.css")).toBe("style");
    expect(classifyAsset("data/products.json")).toBe("other");
    expect(classifyAsset("")).toBe("other");
    expect(classifyAsset(undefined)).toBe("other");
  });
});

describe("checkAssets", () => {
  it("passes when everything is within budget", () => {
    const r = checkAssets([
      { path: "a.png", bytes: 100_000 },
      { path: "script.js", bytes: 50_000 },
      { path: "s.css", bytes: 10_000 },
    ]);
    expect(r.ok).toBe(true);
    expect(r.violations).toEqual([]);
    expect(r.totalBytes).toBe(160_000);
  });

  it("flags over-budget assets, worst first, and never budgets 'other'", () => {
    const r = checkAssets([
      { path: "small.png", bytes: 1000 },
      { path: "huge.png", bytes: 690_000 },
      { path: "big.js", bytes: 131_000 },
      { path: "data.json", bytes: 9_999_999 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.violations.map((v) => v.path)).toEqual(["huge.png", "big.js"]);
    expect(r.violations[0]).toMatchObject({
      type: "image",
      limit: DEFAULT_BUDGET.maxImageBytes,
    });
    expect(r.byType.other.count).toBe(1); // json counted but not a violation
  });

  it("respects a custom budget and guards missing byte counts", () => {
    const r = checkAssets([{ path: "a.css", bytes: undefined }], {
      maxStyleBytes: 5,
    });
    expect(r.byType.style.bytes).toBe(0);
    expect(r.ok).toBe(true);
  });

  it("tolerates non-array input and items without a path", () => {
    expect(checkAssets(null).totalBytes).toBe(0);
    const r = checkAssets([{ bytes: 10 }]);
    expect(r.ok).toBe(true);
    expect(r.byType.other.count).toBe(1);
  });
});

describe("formatBytes", () => {
  it("formats B / KB / MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(689717)).toBe("673.6 KB");
    expect(formatBytes(2_500_000)).toBe("2.38 MB");
    expect(formatBytes(undefined)).toBe("0 B");
  });
});

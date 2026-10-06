import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const scene = JSON.parse(
  readFileSync(new URL("../roxjaya/data/scene.json", import.meta.url), "utf8"),
);

const TYPES = ["race", "sim", "brand", "venue"];
const MODES = ["race", "watch", "both"];

describe("roxjaya/data/scene.json", () => {
  it("has well-formed, unique items with confirmed-or-blank dates", () => {
    expect(Array.isArray(scene.items)).toBe(true);
    expect(scene.items.length).toBeGreaterThan(0);
    const ids = new Set();
    for (const i of scene.items) {
      expect(ids.has(i.id)).toBe(false);
      ids.add(i.id);
      expect(TYPES).toContain(i.type);
      expect(MODES).toContain(i.mode);
      expect(i.name.length).toBeGreaterThan(3);
      expect(i.blurb.length).toBeGreaterThan(20);
      expect(i.date === "" || /^\d{4}-\d{2}-\d{2}$/.test(i.date)).toBe(true);
      if (i.date) expect(i.when).toBeTruthy();
      expect(/^(https?:\/\/|\/roxjaya\/)/.test(i.link)).toBe(true);
    }
  });
});

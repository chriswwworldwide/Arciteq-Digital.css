import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  scoreRelatedness,
  rankRelated,
  relatedProducts,
  WEIGHTS,
} from "../src/related-products.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(
  readFileSync(path.join(__dirname, "..", "data", "products.json"), "utf8"),
);
const catalog = Array.isArray(raw) ? raw : raw.products || [];

const make = (over = {}) => ({
  productId: "p",
  title: "P",
  nicheCategory: { slug: "senior-pet-care" },
  productType: { slug: "mobility-comfort" },
  petType: ["Dog"],
  lifeStage: ["Senior"],
  tags: ["comfort"],
  ...over,
});

describe("scoreRelatedness", () => {
  it("returns 0 for missing inputs", () => {
    expect(scoreRelatedness(null, make())).toBe(0);
    expect(scoreRelatedness(make(), undefined)).toBe(0);
  });

  it("adds category + type + shared audience + tags", () => {
    const a = make();
    const b = make({ productId: "q" });
    const expected =
      WEIGHTS.nicheCategory +
      WEIGHTS.productType +
      WEIGHTS.petType +
      WEIGHTS.lifeStage +
      WEIGHTS.tag;
    expect(scoreRelatedness(a, b)).toBeCloseTo(expected);
  });

  it("is symmetric", () => {
    const a = make();
    const b = make({
      productId: "q",
      tags: ["comfort", "senior"],
      petType: ["Cat"],
    });
    expect(scoreRelatedness(a, b)).toBeCloseTo(scoreRelatedness(b, a));
  });

  it("scores unrelated products at 0", () => {
    const a = make();
    const b = make({
      productId: "q",
      nicheCategory: { slug: "walking" },
      productType: { slug: "leashes" },
      petType: ["Cat"],
      lifeStage: ["Adult"],
      tags: ["reflective"],
    });
    expect(scoreRelatedness(a, b)).toBe(0);
  });

  it("accepts category/type given as plain string slugs", () => {
    const a = make({
      nicheCategory: "senior-pet-care",
      productType: "mobility-comfort",
      petType: [],
      lifeStage: [],
      tags: [],
    });
    const b = make({
      productId: "q",
      nicheCategory: "senior-pet-care",
      productType: "mobility-comfort",
      petType: [],
      lifeStage: [],
      tags: [],
    });
    expect(scoreRelatedness(a, b)).toBeCloseTo(
      WEIGHTS.nicheCategory + WEIGHTS.productType,
    );
  });

  it("treats scalar / null audience fields safely", () => {
    const a = make({ petType: "Dog", lifeStage: null, tags: null });
    const b = make({
      productId: "q",
      petType: "Dog",
      lifeStage: null,
      tags: null,
    });
    // shared category + type + one petType overlap; null lifeStage/tags contribute 0
    expect(scoreRelatedness(a, b)).toBeCloseTo(
      WEIGHTS.nicheCategory + WEIGHTS.productType + WEIGHTS.petType,
    );
  });

  it("weights category higher than a single tag", () => {
    const a = make();
    const sameCat = make({
      productId: "c",
      productType: { slug: "x" },
      petType: [],
      lifeStage: [],
      tags: [],
    });
    const sameTag = make({
      productId: "t",
      nicheCategory: { slug: "x" },
      productType: { slug: "x" },
      petType: [],
      lifeStage: [],
    });
    expect(scoreRelatedness(a, sameCat)).toBeGreaterThan(
      scoreRelatedness(a, sameTag),
    );
  });
});

describe("rankRelated / relatedProducts", () => {
  it("excludes the target itself", () => {
    const target = make({ productId: "self" });
    const list = [target, make({ productId: "other" })];
    const ids = relatedProducts(target, list).map((p) => p.productId);
    expect(ids).not.toContain("self");
  });

  it("respects the limit and sorts best-first", () => {
    const target = make({ productId: "t" });
    const strong = make({ productId: "strong" });
    const weak = make({
      productId: "weak",
      productType: { slug: "x" },
      petType: [],
      lifeStage: [],
      tags: ["comfort"],
    });
    const ranked = rankRelated(target, [strong, weak], { limit: 1 });
    expect(ranked).toHaveLength(1);
    expect(ranked[0].product.productId).toBe("strong");
  });

  it("drops zero-score products", () => {
    const target = make({ productId: "t" });
    const unrelated = make({
      productId: "u",
      nicheCategory: { slug: "z" },
      productType: { slug: "z" },
      petType: ["Cat"],
      lifeStage: ["Adult"],
      tags: ["reflective"],
    });
    expect(relatedProducts(target, [unrelated])).toEqual([]);
  });

  it("breaks score ties alphabetically by title", () => {
    const target = make({ productId: "t" });
    const b = make({ productId: "b", title: "Beta" });
    const a = make({ productId: "a", title: "Alpha" });
    const ranked = rankRelated(target, [b, a]);
    expect(ranked.map((r) => r.product.title)).toEqual(["Alpha", "Beta"]);
  });

  it("handles non-array catalog input", () => {
    expect(relatedProducts(make(), null)).toEqual([]);
  });

  it("tie-breaks safely when titles are missing", () => {
    const target = make({ productId: "t" });
    const x = make({ productId: "x", title: undefined });
    const y = make({ productId: "y", title: undefined });
    const ranked = rankRelated(target, [x, y]);
    expect(ranked).toHaveLength(2);
  });

  it("finds sensible relations in the real catalog", () => {
    const target = catalog.find((p) => p.productId === "pet-demo-heatpad-001");
    const related = relatedProducts(target, catalog, { limit: 4 });
    expect(related.length).toBeGreaterThan(0);
    expect(related.map((p) => p.productId)).not.toContain(target.productId);
  });
});

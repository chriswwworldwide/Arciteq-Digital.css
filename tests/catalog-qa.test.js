// tests/catalog-qa.test.js
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateProduct,
  validateCatalog,
  isTechProduct,
  isServiceProduct,
  isRecurringProduct,
  WAREHOUSE_LOCATIONS,
} from "../src/catalog-qa.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function validProduct(overrides = {}) {
  return {
    productId: "p1",
    tenant_id: "default",
    title: "Calming Bed",
    description: "A cosy non-ingestible bed.",
    price: { amount: 4999, currency: "gbp" },
    petType: ["Dog"],
    lifeStage: ["Adult"],
    sizeRequirement: ["Medium"],
    warehouseLocation: "UK",
    materials: ["Memory foam"],
    productType: { slug: "calming-anxiety", name: "Calming" },
    attributes: { coverWashable: true },
    seo: { slug: "calming-bed", canonicalPath: "/calming-anxiety/calming-bed" },
    images: [{ src: "/i.png", alt: "Calming bed" }],
    marketing_hooks: { emotionalPainPoints: ["Help your pet settle"] },
    ...overrides,
  };
}

describe("isTechProduct", () => {
  it("flags connected/safety types", () => {
    expect(isTechProduct({ productType: { slug: "smart-monitoring" } })).toBe(
      true,
    );
    expect(isTechProduct({ productType: { slug: "safety-essentials" } })).toBe(
      true,
    );
  });
  it("flags electronic attributes", () => {
    expect(isTechProduct({ attributes: { batteryLife: "10d" } })).toBe(true);
    expect(isTechProduct({ attributes: { rechargeable: true } })).toBe(true);
  });
  it("does not flag plain comfort items", () => {
    expect(
      isTechProduct({
        productType: { slug: "calming-anxiety" },
        attributes: {},
      }),
    ).toBe(false);
  });
});

describe("validateProduct", () => {
  it("passes a well-formed product", () => {
    const r = validateProduct(validProduct());
    expect(r.errors).toEqual([]);
  });

  it("flags a non-integer / non-minor price", () => {
    const r = validateProduct(
      validProduct({ price: { amount: 49.99, currency: "gbp" } }),
    );
    expect(r.errors).toContain(
      "price.amount must be a positive integer (minor units)",
    );
  });

  it("requires the full pet layer", () => {
    const r = validateProduct(
      validProduct({ petType: [], lifeStage: undefined, sizeRequirement: [] }),
    );
    expect(r.errors).toContain("missing petType");
    expect(r.errors).toContain("missing lifeStage");
    expect(r.errors).toContain("missing sizeRequirement");
  });

  it("rejects an unknown warehouse location", () => {
    const r = validateProduct(validProduct({ warehouseLocation: "Mars" }));
    expect(r.errors.some((e) => e.startsWith("warehouseLocation"))).toBe(true);
  });

  it("requires a materials list (non-ingestible v1)", () => {
    const r = validateProduct(validProduct({ materials: [] }));
    expect(r.errors).toContain("missing materials");
  });

  it("requires safetyDisclaimer only for tech products", () => {
    const tech = validateProduct(
      validProduct({
        productType: { slug: "safety-essentials" },
        safetyDisclaimer: "",
      }),
    );
    expect(tech.errors).toContain("tech product missing safetyDisclaimer");

    const nonTech = validateProduct(validProduct({ safetyDisclaimer: "" }));
    expect(nonTech.errors).not.toContain(
      "tech product missing safetyDisclaimer",
    );
  });

  it("requires a slug-first canonical path and image alt", () => {
    const r = validateProduct(
      validProduct({
        seo: { slug: "", canonicalPath: "no-leading-slash" },
        images: [{ src: "/i.png" }],
      }),
    );
    expect(r.errors).toContain("missing seo.slug");
    expect(r.errors).toContain("seo.canonicalPath must start with '/'");
    expect(r.errors).toContain("no image has alt text");
  });

  it("flags missing core fields, currency, images, and a zero price", () => {
    const r = validateProduct({
      title: "x",
      price: { amount: 0 },
      warehouseLocation: "UK",
      materials: ["foam"],
      petType: ["Dog"],
      lifeStage: ["Adult"],
      sizeRequirement: ["Small"],
      seo: { slug: "x", canonicalPath: "/x/x" },
      images: [],
    });
    expect(r.errors).toContain("missing productId");
    expect(r.errors).toContain("missing tenant_id");
    expect(r.errors).toContain(
      "price.amount must be a positive integer (minor units)",
    );
    expect(r.errors).toContain("missing price.currency");
    expect(r.errors).toContain("missing images");
    expect(r.productId).toBe("(unknown)");
  });

  it("does not throw on an empty/undefined product", () => {
    const r = validateProduct();
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("warns (not errors) on missing description and marketing hooks", () => {
    const r = validateProduct(
      validProduct({ description: "", marketing_hooks: {} }),
    );
    expect(r.warnings).toContain("missing description");
    expect(r.warnings).toContain("missing marketing_hooks.emotionalPainPoints");
    expect(r.errors).toEqual([]);
  });
});

describe("validateCatalog", () => {
  it("aggregates errors across products", () => {
    const report = validateCatalog([
      validProduct(),
      validProduct({ warehouseLocation: "Mars" }),
    ]);
    expect(report.total).toBe(2);
    expect(report.ok).toBe(false);
    expect(report.errorCount).toBeGreaterThan(0);
  });

  it("counts warnings across products", () => {
    const report = validateCatalog([validProduct({ marketing_hooks: {} })]);
    expect(report.ok).toBe(true);
    expect(report.warningCount).toBeGreaterThan(0);
  });

  it("the live data/products.json catalog currently passes all required checks", () => {
    const file = path.join(__dirname, "..", "data", "products.json");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const report = validateCatalog(parsed.products);
    // Guardrail: keeps future product additions honest.
    expect(report.ok).toBe(true);
  });
});

describe("service + recurring products", () => {
  const servicePlan = (overrides = {}) => ({
    productId: "plan-1",
    tenant_id: "coach",
    kind: "service",
    title: "Monthly Program",
    description: "Programming delivered weekly.",
    price: { amount: 599000, currency: "idr" },
    billing: { interval: "month" },
    seo: { slug: "monthly-program", canonicalPath: "/plans/monthly-program" },
    images: [{ src: "/i.png", alt: "Monthly program" }],
    marketing_hooks: { emotionalPainPoints: ["Train with structure"] },
    ...overrides,
  });

  it("classifies kind=service and billing.interval", () => {
    expect(isServiceProduct(servicePlan())).toBe(true);
    expect(isServiceProduct(validProduct())).toBe(false);
    expect(isRecurringProduct(servicePlan())).toBe(true);
    expect(isRecurringProduct(validProduct())).toBe(false);
  });

  it("skips pet layer, warehouse, materials and safety rules for services", () => {
    expect(validateProduct(servicePlan()).errors).toEqual([]);
  });

  it("still enforces price, seo and images for services", () => {
    const r = validateProduct(
      servicePlan({ price: { amount: 1.5, currency: "idr" }, images: [] }),
    );
    expect(r.errors).toContain(
      "price.amount must be a positive integer (minor units)",
    );
    expect(r.errors).toContain("missing images");
  });

  it("rejects unknown billing intervals and bad interval counts", () => {
    expect(
      validateProduct(servicePlan({ billing: { interval: "fortnight" } }))
        .errors,
    ).toContain("billing.interval must be one of day/week/month/year");
    expect(
      validateProduct(
        servicePlan({ billing: { interval: "month", intervalCount: 0 } }),
      ).errors,
    ).toContain("billing.intervalCount must be a positive integer");
  });

  it("physical goods with billing still need the pet layer", () => {
    const r = validateProduct(
      validProduct({ billing: { interval: "month" }, petType: [] }),
    );
    expect(r.errors).toContain("missing petType");
  });
});

describe("WAREHOUSE_LOCATIONS", () => {
  it("covers the allowed regions", () => {
    expect(WAREHOUSE_LOCATIONS).toEqual(["UK", "EU", "US", "Other"]);
  });
});

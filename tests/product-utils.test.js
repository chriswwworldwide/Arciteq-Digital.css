// tests/product-utils.test.js
import { describe, it, expect } from "vitest";
import {
  scoreDraftProduct,
  normalizeToSlug,
  buildDedupeKey,
  findDuplicateProductId,
  buildProductFromSupplierItem,
  getBaseUrl,
  xmlEscape,
} from "../src/product-utils.js";

describe("normalizeToSlug", () => {
  it("lowercases, trims, and hyphenates non-alphanumerics", () => {
    expect(normalizeToSlug("  Calm Cat Bed!  ")).toBe("calm-cat-bed");
    expect(normalizeToSlug("Dog & Co.")).toBe("dog-co");
  });

  it("returns an empty string for empty/nullish input", () => {
    expect(normalizeToSlug("")).toBe("");
    expect(normalizeToSlug(null)).toBe("");
    expect(normalizeToSlug(undefined)).toBe("");
  });
});

describe("buildDedupeKey", () => {
  it("joins normalized brand and title with '::'", () => {
    expect(buildDedupeKey({ brand: "PawSense", title: "Calm Bed" })).toBe(
      "pawsense::calm-bed",
    );
  });

  it("returns '' when either brand or title is missing", () => {
    expect(buildDedupeKey({ brand: "", title: "Calm Bed" })).toBe("");
    expect(buildDedupeKey({ brand: "PawSense", title: "" })).toBe("");
  });
});

describe("findDuplicateProductId", () => {
  const products = [
    { productId: "p1", dedupeKey: "pawsense::calm-bed" },
    { productId: "p2", brand: "PawSense", title: "Safety Gate" },
  ];

  it("matches on an existing dedupeKey", () => {
    expect(
      findDuplicateProductId({
        products,
        nextProduct: { dedupeKey: "pawsense::calm-bed" },
      }),
    ).toBe("p1");
  });

  it("derives the key from brand/title when dedupeKey is absent", () => {
    expect(
      findDuplicateProductId({
        products,
        nextProduct: { dedupeKey: "pawsense::safety-gate" },
      }),
    ).toBe("p2");
  });

  it("returns '' when there is no match or no key", () => {
    expect(
      findDuplicateProductId({ products, nextProduct: { dedupeKey: "x::y" } }),
    ).toBe("");
    expect(findDuplicateProductId({ products, nextProduct: {} })).toBe("");
  });
});

describe("scoreDraftProduct", () => {
  it("gives a complete product a perfect score with no reasons", () => {
    const result = scoreDraftProduct({
      petType: ["dog"],
      lifeStage: ["adult"],
      sizeRequirement: ["m"],
      materials: ["cotton"],
      safetyDisclaimer: "Supervise use.",
      warehouseLocation: "EU",
      availability: "https://schema.org/InStock",
    });
    expect(result).toEqual({ score: 100, reasons: [] });
  });

  it("zeroes the score and flags out-of-stock items", () => {
    const result = scoreDraftProduct({ availability: "OutOfStock" });
    expect(result.score).toBe(0);
    expect(result.reasons).toContain("Out of stock at supplier");
  });

  it("deducts per missing field and never goes below zero", () => {
    const result = scoreDraftProduct({});
    expect(result.score).toBe(0);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "Missing petType",
        "Missing lifeStage",
        "Missing sizeRequirement",
        "Missing safetyDisclaimer",
        "Missing warehouseLocation",
        "Missing materials",
      ]),
    );
  });
});

describe("buildProductFromSupplierItem", () => {
  const validItem = {
    title: "Calm Cat Bed",
    supplierSku: "SKU-123",
    price: { amount: 1999, currency: "EUR" },
  };

  it("maps a valid supplier item into a product record", () => {
    const product = buildProductFromSupplierItem(validItem, "acme");
    expect(product.productId).toBe("imp-acme-sku-123");
    expect(product.title).toBe("Calm Cat Bed");
    expect(product.brand).toBe("PawSense");
    expect(product.dedupeKey).toBe("pawsense::calm-cat-bed");
    expect(product.price).toEqual({ amount: 1999, currency: "eur" });
    expect(product.seo.canonicalPath).toBe(
      "/pet-safety-essentials/calm-cat-bed",
    );
    expect(product.availability).toBe("https://schema.org/InStock");
  });

  it("throws on missing/invalid required fields", () => {
    expect(() => buildProductFromSupplierItem({}, "acme")).toThrow(
      "Missing title",
    );
    expect(() => buildProductFromSupplierItem({ title: "X" }, "acme")).toThrow(
      "Missing supplierSku",
    );
    expect(() =>
      buildProductFromSupplierItem(
        {
          title: "X",
          supplierSku: "S",
          price: { amount: -1, currency: "eur" },
        },
        "acme",
      ),
    ).toThrow("Invalid price.amount");
    expect(() =>
      buildProductFromSupplierItem(
        { title: "X", supplierSku: "S", price: { amount: 100 } },
        "acme",
      ),
    ).toThrow("Missing price.currency");
  });
});

describe("getBaseUrl", () => {
  it("uses x-forwarded-proto when present", () => {
    const req = {
      headers: { host: "shop.example.com", "x-forwarded-proto": "https,http" },
      protocol: "http",
    };
    expect(getBaseUrl(req)).toBe("https://shop.example.com");
  });

  it("falls back to req.protocol and localhost", () => {
    expect(getBaseUrl({ headers: {}, protocol: "http" })).toBe(
      "http://localhost",
    );
  });
});

describe("xmlEscape", () => {
  it("escapes XML-special characters", () => {
    expect(xmlEscape(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;",
    );
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  formatPrice,
  availabilityLabel,
  buildFeedItem,
  buildProductFeed,
  feedToXml,
  DEFAULT_SITE_URL,
} from "../src/product-feed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(
  readFileSync(path.join(__dirname, "..", "data", "products.json"), "utf8"),
);
const catalog = Array.isArray(raw) ? raw : raw.products || [];

const make = (over = {}) => ({
  productId: "p1",
  title: "Test Mat",
  description: "A comfy mat",
  seo: { canonicalPath: "/senior-pet-care/test-mat" },
  price: { amount: 12900, currency: "eur" },
  images: [{ src: "/images2/x.png" }],
  availability: "https://schema.org/InStock",
  brand: "Acme",
  nicheCategory: { name: "Senior Pet Care" },
  ...over,
});

describe("formatPrice", () => {
  it("formats minor units to GMC price", () => {
    expect(formatPrice(12900, "eur")).toBe("129.00 EUR");
    expect(formatPrice(999, "gbp")).toBe("9.99 GBP");
  });
  it("returns null for invalid amount or missing currency", () => {
    expect(formatPrice("x", "eur")).toBeNull();
    expect(formatPrice(100, "")).toBeNull();
  });
});

describe("availabilityLabel", () => {
  it("maps schema.org states", () => {
    expect(availabilityLabel("https://schema.org/InStock")).toBe("in_stock");
    expect(availabilityLabel("https://schema.org/OutOfStock")).toBe(
      "out_of_stock",
    );
    expect(availabilityLabel("https://schema.org/PreOrder")).toBe("preorder");
    expect(availabilityLabel("https://schema.org/BackOrder")).toBe("backorder");
    expect(availabilityLabel(undefined)).toBe("in_stock");
  });
});

describe("buildFeedItem", () => {
  it("builds a complete item with absolute URLs", () => {
    const item = buildFeedItem(make(), { siteUrl: "https://shop.test" });
    expect(item).toMatchObject({
      id: "p1",
      title: "Test Mat",
      link: "https://shop.test/senior-pet-care/test-mat",
      image_link: "https://shop.test/images2/x.png",
      price: "129.00 EUR",
      availability: "in_stock",
      brand: "Acme",
      condition: "new",
      product_type: "Senior Pet Care",
    });
  });

  it("uses the default site URL and title as description fallback", () => {
    const item = buildFeedItem(make({ description: "" }));
    expect(item.link.startsWith(DEFAULT_SITE_URL)).toBe(true);
    expect(item.description).toBe("Test Mat");
  });

  it("keeps already-absolute image URLs", () => {
    const item = buildFeedItem(
      make({ images: [{ src: "https://cdn.test/a.png" }] }),
    );
    expect(item.image_link).toBe("https://cdn.test/a.png");
  });

  it("returns null when required fields are missing", () => {
    expect(buildFeedItem(null)).toBeNull();
    expect(
      buildFeedItem(make({ price: { amount: null, currency: "eur" } })),
    ).toBeNull();
    expect(buildFeedItem(make({ seo: {} }))).toBeNull();
    expect(buildFeedItem(make({ images: [] }))).toBeNull();
  });
});

describe("buildProductFeed", () => {
  it("skips invalid products and handles non-array input", () => {
    const feed = buildProductFeed([make(), { productId: "bad" }, null]);
    expect(feed).toHaveLength(1);
    expect(buildProductFeed(null)).toEqual([]);
  });

  it("builds items for the whole real catalog", () => {
    const feed = buildProductFeed(catalog);
    expect(feed.length).toBe(catalog.length);
    feed.forEach((i) => {
      expect(i.price).toMatch(/^\d+\.\d{2} [A-Z]{3}$/);
      expect(i.link.startsWith("https://")).toBe(true);
    });
  });
});

describe("feedToXml", () => {
  it("wraps items in GMC RSS with g: namespace and escapes values", () => {
    const xml = feedToXml([buildFeedItem(make({ title: "Mat & <Pad>" }))], {
      title: "Feed",
    });
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain("<g:id>p1</g:id>");
    expect(xml).toContain("<g:price>129.00 EUR</g:price>");
    expect(xml).toContain("<title>Mat &amp; &lt;Pad&gt;</title>");
    expect(xml).toContain("<g:availability>in_stock</g:availability>");
  });

  it("handles non-array input and uses default meta", () => {
    const xml = feedToXml(undefined);
    expect(xml).toContain("<title>Product feed</title>");
    expect(xml).toContain("<channel>");
  });
});

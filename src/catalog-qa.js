// src/catalog-qa.js
// Pure catalog quality-assurance rules for the Pet Tech & Wellness pivot.
// Encodes the product source-of-truth guardrails (pet layer, integer prices,
// warehouse, safety/materials, marketing hooks) so bad products can be caught
// before publish. No IO here — callers pass in parsed product objects.

export const WAREHOUSE_LOCATIONS = ["UK", "EU", "US", "Other"];

// Product types we treat as "tech" (electronics / battery / connected), which
// must carry a safety disclaimer. Wellness/comfort items don't require one.
export const TECH_TYPE_SLUGS = new Set([
  "smart-monitoring",
  "safety-essentials",
]);
const TECH_ATTR_HINTS = [
  "battery",
  "rechargeable",
  "waterresistant",
  "power",
  "charge",
  "led",
  "gps",
  "wifi",
  "bluetooth",
  "qr",
  "smart",
];

const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const isNonEmptyArray = (v) => Array.isArray(v) && v.length > 0;

/** Classify a product as tech (needs a safety disclaimer) via type + attributes. */
export function isTechProduct(product) {
  const typeSlug = String(product?.productType?.slug || "").toLowerCase();
  if (TECH_TYPE_SLUGS.has(typeSlug)) return true;
  const attrKeys = Object.keys(product?.attributes || {}).map((k) =>
    k.toLowerCase(),
  );
  return attrKeys.some((k) => TECH_ATTR_HINTS.some((hint) => k.includes(hint)));
}

/**
 * Validate one product. Returns { productId, errors, warnings }.
 * `errors` should block publish; `warnings` are non-blocking quality nudges.
 */
export function validateProduct(product) {
  const errors = [];
  const warnings = [];
  const p = product || {};

  if (!isNonEmptyString(p.productId)) errors.push("missing productId");
  if (!isNonEmptyString(p.tenant_id)) errors.push("missing tenant_id");
  if (!isNonEmptyString(p.title)) errors.push("missing title");
  if (!isNonEmptyString(p.description)) warnings.push("missing description");

  // Price must be integer minor units (cents/pence) and positive.
  const amount = p?.price?.amount;
  if (!Number.isInteger(amount) || amount <= 0) {
    errors.push("price.amount must be a positive integer (minor units)");
  }
  if (!isNonEmptyString(p?.price?.currency))
    errors.push("missing price.currency");

  // Required pet layer.
  if (!isNonEmptyArray(p.petType)) errors.push("missing petType");
  if (!isNonEmptyArray(p.lifeStage)) errors.push("missing lifeStage");
  if (!isNonEmptyArray(p.sizeRequirement))
    errors.push("missing sizeRequirement");

  // Logistics.
  if (!WAREHOUSE_LOCATIONS.includes(String(p.warehouseLocation || ""))) {
    errors.push(
      `warehouseLocation must be one of ${WAREHOUSE_LOCATIONS.join("/")}`,
    );
  }

  // Wellness pivot is non-ingestible in v1 → every product needs a materials list.
  if (!isNonEmptyArray(p.materials)) errors.push("missing materials");

  // Tech items must carry a safety disclaimer.
  if (isTechProduct(p) && !isNonEmptyString(p.safetyDisclaimer)) {
    errors.push("tech product missing safetyDisclaimer");
  }

  // SEO.
  if (!isNonEmptyString(p?.seo?.slug)) errors.push("missing seo.slug");
  const canonical = String(p?.seo?.canonicalPath || "");
  if (!canonical.startsWith("/"))
    errors.push("seo.canonicalPath must start with '/'");

  // At least one image with alt text (accessibility + SEO).
  const images = Array.isArray(p.images) ? p.images : [];
  if (images.length === 0) {
    errors.push("missing images");
  } else if (!images.some((img) => isNonEmptyString(img?.alt))) {
    errors.push("no image has alt text");
  }

  // Marketing hooks for automated exports.
  if (!isNonEmptyArray(p?.marketing_hooks?.emotionalPainPoints)) {
    warnings.push("missing marketing_hooks.emotionalPainPoints");
  }

  return { productId: String(p.productId || "(unknown)"), errors, warnings };
}

/**
 * Validate a whole catalog. Returns aggregate ok flag, per-product results,
 * and totals so a CLI/dashboard can report and gate on it.
 */
export function validateCatalog(products) {
  const list = Array.isArray(products) ? products : [];
  const results = list.map(validateProduct);
  const productsWithErrors = results.filter((r) => r.errors.length > 0);
  const productsWithWarnings = results.filter((r) => r.warnings.length > 0);
  return {
    ok: productsWithErrors.length === 0,
    total: results.length,
    errorCount: productsWithErrors.reduce((n, r) => n + r.errors.length, 0),
    warningCount: productsWithWarnings.reduce(
      (n, r) => n + r.warnings.length,
      0,
    ),
    results,
  };
}

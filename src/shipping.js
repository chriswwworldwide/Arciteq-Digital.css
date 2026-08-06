// src/shipping.js
// Pure shipping/dispatch helpers driven by each product's warehouseLocation
// (UK / EU / US / Other). Powers real "ships from" trust signals and honest
// delivery-window estimates — the kind of concrete logistics signal that makes
// local landing pages and product pages convert. No IO here.

export const REGIONS = ["UK", "EU", "US", "Other"];

// Minimal ISO-3166 alpha-2 -> region map (extend as markets are added).
const COUNTRY_REGION = {
  GB: "UK",
  IE: "EU",
  FR: "EU",
  DE: "EU",
  ES: "EU",
  IT: "EU",
  NL: "EU",
  BE: "EU",
  PT: "EU",
  US: "US",
};

// Business-day delivery windows [min, max] by origin -> destination region.
// Domestic is fastest; cross-region is slower; "Other" is the catch-all.
const DELIVERY_MATRIX = {
  UK: { UK: [1, 3], EU: [3, 6], US: [5, 9], Other: [7, 14] },
  EU: { UK: [3, 6], EU: [2, 5], US: [5, 10], Other: [7, 14] },
  US: { UK: [5, 9], EU: [5, 10], US: [2, 5], Other: [8, 16] },
  Other: { UK: [7, 14], EU: [7, 14], US: [8, 16], Other: [10, 21] },
};

/** Normalize an arbitrary region/warehouse value to a known region. */
export function normalizeRegion(value) {
  const v = String(value || "")
    .trim()
    .toUpperCase();
  if (v === "UK") return "UK";
  if (v === "EU") return "EU";
  if (v === "US") return "US";
  return "Other";
}

/** Map an ISO alpha-2 country code (or region string) to a shipping region. */
export function resolveRegion(country) {
  const c = String(country || "")
    .trim()
    .toUpperCase();
  if (c === "UK" || c === "EU" || c === "US") return c;
  return COUNTRY_REGION[c] || "Other";
}

/** The origin region a product dispatches from. */
export function originRegion(product) {
  return normalizeRegion(product?.warehouseLocation || product?.shippingOrigin);
}

/**
 * Estimated delivery window in business days.
 * @param {string} origin region (UK/EU/US/Other)
 * @param {string} destination region (UK/EU/US/Other)
 * @returns {{ minDays, maxDays }}
 */
export function deliveryEstimate(origin, destination) {
  const from = normalizeRegion(origin);
  const to = normalizeRegion(destination);
  const [minDays, maxDays] = DELIVERY_MATRIX[from][to];
  return { minDays, maxDays };
}

/** Estimate for a product shipping to a given destination country/region. */
export function estimateForProduct(product, destination) {
  return deliveryEstimate(originRegion(product), resolveRegion(destination));
}

/** "Ships from UK" style label. */
export function shipsFromLabel(product) {
  return `Ships from ${originRegion(product)}`;
}

/** Human-friendly window, e.g. "1–3 business days" or "3 business days". */
export function formatEstimate({ minDays, maxDays } = {}) {
  if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) return "";
  const unit = "business days";
  return minDays === maxDays
    ? `${minDays} ${unit}`
    : `${minDays}\u2013${maxDays} ${unit}`;
}

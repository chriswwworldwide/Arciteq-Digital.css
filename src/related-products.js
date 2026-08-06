// src/related-products.js
// Pure "related products" ranking for internal linking + cross-sell.
// Strong internal linking is a core SEO lever (clear product/category graph),
// and related-product blocks lift AOV. No IO here — callers pass the catalog in.

// Relatedness weights: category is the strongest signal, then product type,
// then shared audience (petType / lifeStage) and tags.
export const WEIGHTS = {
  nicheCategory: 3,
  productType: 2,
  petType: 1,
  lifeStage: 0.5,
  tag: 0.5,
};

function slug(node) {
  return node && typeof node === "object"
    ? String(node.slug || "")
    : String(node || "");
}

function asSet(value) {
  const arr = Array.isArray(value) ? value : value == null ? [] : [value];
  return new Set(arr.map((v) => String(v).toLowerCase()).filter(Boolean));
}

function overlapCount(a, b) {
  let n = 0;
  for (const v of a) if (b.has(v)) n++;
  return n;
}

/**
 * Score how related product `b` is to `a` (higher = more related).
 * Symmetric and always >= 0.
 */
export function scoreRelatedness(a, b) {
  if (!a || !b) return 0;
  let score = 0;
  if (
    slug(a.nicheCategory) &&
    slug(a.nicheCategory) === slug(b.nicheCategory)
  ) {
    score += WEIGHTS.nicheCategory;
  }
  if (slug(a.productType) && slug(a.productType) === slug(b.productType)) {
    score += WEIGHTS.productType;
  }
  score += overlapCount(asSet(a.petType), asSet(b.petType)) * WEIGHTS.petType;
  score +=
    overlapCount(asSet(a.lifeStage), asSet(b.lifeStage)) * WEIGHTS.lifeStage;
  score += overlapCount(asSet(a.tags), asSet(b.tags)) * WEIGHTS.tag;
  return score;
}

/**
 * Rank the catalog by relatedness to `target`.
 * @param {object} target
 * @param {Array} catalog
 * @param {object} opts { limit?, minScore? }
 * @returns {Array<{ product, score }>} sorted best-first (ties: title A→Z)
 */
export function rankRelated(target, catalog, opts = {}) {
  const limit = opts.limit ?? 4;
  const minScore = opts.minScore ?? 0.0001;
  const targetId = target?.productId;
  const scored = (Array.isArray(catalog) ? catalog : [])
    .filter((p) => p && p.productId !== targetId)
    .map((product) => ({ product, score: scoreRelatedness(target, product) }))
    .filter((entry) => entry.score >= minScore);

  scored.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    return String(x.product.title || "").localeCompare(
      String(y.product.title || ""),
    );
  });
  return scored.slice(0, limit);
}

/** Convenience: just the related products (no scores), best-first. */
export function relatedProducts(target, catalog, opts = {}) {
  return rankRelated(target, catalog, opts).map((entry) => entry.product);
}

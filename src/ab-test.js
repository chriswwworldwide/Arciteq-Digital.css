// src/ab-test.js
// Deterministic A/B assignment primitive for headlines, prices, and trust strips.
// Pure + stateless: the same (experimentKey, visitorId) always maps to the same
// variant, so a visitor sees a stable experience across page loads and devices
// without any server round-trip or stored assignment. Weighting is honoured so
// experiments can ramp (e.g. 90/10) before a full rollout.

// FNV-1a 32-bit hash -> unit float in [0, 1). Stable across runs/machines.
export function hashToUnit(input) {
  const str = String(input);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV prime multiply (kept in unsigned range)
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0) / 0x100000000;
}

/** Normalize variants to [{ id, weight }] with positive weights only. */
export function normalizeVariants(variants) {
  const list = Array.isArray(variants) ? variants : [];
  const normalized = [];
  for (const v of list) {
    if (v == null) continue;
    const id = typeof v === "string" ? v : v.id;
    if (id == null || id === "") continue;
    const weight = typeof v === "string" ? 1 : Number(v.weight ?? 1);
    if (!Number.isFinite(weight) || weight <= 0) continue;
    normalized.push({ id: String(id), weight });
  }
  return normalized;
}

/**
 * Assign a visitor to a variant deterministically.
 * @param {object} args { experimentKey, visitorId, variants }
 *   variants: array of ids (strings) or { id, weight } objects.
 * @returns {string|null} the chosen variant id, or null if no valid variants.
 */
export function assignVariant({ experimentKey, visitorId, variants } = {}) {
  const normalized = normalizeVariants(variants);
  if (normalized.length === 0) return null;
  if (normalized.length === 1) return normalized[0].id;

  const total = normalized.reduce((sum, v) => sum + v.weight, 0);
  const point = hashToUnit(`${experimentKey}:${visitorId}`) * total;

  let cursor = 0;
  for (const v of normalized) {
    cursor += v.weight;
    if (point < cursor) return v.id;
  }
  // Floating-point safety: fall back to the last variant.
  return normalized[normalized.length - 1].id;
}

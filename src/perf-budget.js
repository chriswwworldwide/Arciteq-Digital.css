// src/perf-budget.js
// Pure performance-budget rules. Site-wide speed is a hard requirement
// (LCP < 2.0s, CLS < 0.1, INP < 200ms), and oversized assets are the most
// common cause of slow LCP. This flags client assets that bust their byte
// budget so regressions get caught before merge. No IO here.

// Byte budgets for client-shipped assets (server/Node code is not scanned).
export const DEFAULT_BUDGET = {
  maxImageBytes: 500_000, // ~500 KB; heavy hero/product images hurt LCP
  maxScriptBytes: 100_000, // ~100 KB per client JS file (parse/exec cost -> INP)
  maxStyleBytes: 60_000, // ~60 KB per stylesheet
};

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "avif", "svg"]);

/** Classify an asset by extension into a budget category. */
export function classifyAsset(filePath) {
  const ext = String(filePath || "")
    .toLowerCase()
    .split(".")
    .pop();
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === "js" || ext === "mjs") return "script";
  if (ext === "css") return "style";
  return "other";
}

function limitFor(type, budget) {
  if (type === "image") return budget.maxImageBytes;
  if (type === "script") return budget.maxScriptBytes;
  if (type === "style") return budget.maxStyleBytes;
  return null; // "other" is not budgeted
}

/**
 * Check assets against a budget.
 * @param {{path:string, bytes:number}[]} assets
 * @param {object} budget
 * @returns {{ ok:boolean, violations:Array, totalBytes:number, byType:object }}
 */
export function checkAssets(assets, budget = DEFAULT_BUDGET) {
  const list = Array.isArray(assets) ? assets : [];
  const violations = [];
  const byType = {
    image: { count: 0, bytes: 0 },
    script: { count: 0, bytes: 0 },
    style: { count: 0, bytes: 0 },
    other: { count: 0, bytes: 0 },
  };
  let totalBytes = 0;

  for (const a of list) {
    const bytes = Number.isFinite(a?.bytes) ? a.bytes : 0;
    const type = classifyAsset(a?.path);
    byType[type].count += 1;
    byType[type].bytes += bytes;
    totalBytes += bytes;

    const limit = limitFor(type, budget);
    if (limit != null && bytes > limit) {
      violations.push({ path: String(a?.path || ""), type, bytes, limit });
    }
  }

  // Worst offenders first.
  violations.sort((x, y) => y.bytes - x.bytes);
  return { ok: violations.length === 0, violations, totalBytes, byType };
}

/** Human-friendly byte size, e.g. 689717 -> "673.6 KB". */
export function formatBytes(bytes) {
  const n = Number.isFinite(bytes) ? bytes : 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

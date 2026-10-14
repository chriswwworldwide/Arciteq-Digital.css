// server/data-files.js
// The engine's JSON data files (products, reviews, tenants) plus small safe
// read/write helpers. Product and tenant data used to be re-read and
// re-parsed from disk several times per request; they are now cached and
// re-read automatically whenever the file changes on disk (mtime/size), so
// edits still apply instantly with no restart. Callers must treat the
// returned objects as read-only (code that edits products.json reads its own
// fresh copy via safeReadJsonFile).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const dataPath = (...parts) => path.join(ROOT_DIR, "data", ...parts);

const cache = new Map();

// Parses a JSON file once per on-disk version. Throws like readFileSync if
// the file is missing or invalid (same behaviour as before caching).
function readJsonCached(filePath, build) {
  const st = fs.statSync(filePath);
  const stamp = `${st.mtimeMs}:${st.size}`;
  const hit = cache.get(filePath);
  if (hit && hit.stamp === stamp) return hit.value;
  const value = build(JSON.parse(fs.readFileSync(filePath, "utf8")));
  cache.set(filePath, { stamp, value });
  return value;
}

export function loadProductsData() {
  return readJsonCached(dataPath("products.json"), (parsed) => {
    const list = Array.isArray(parsed?.products) ? parsed.products : [];
    const generatedAt = parsed?.generatedAt ? String(parsed.generatedAt) : "";
    const byId = new Map();
    for (const p of list) {
      if (p?.productId) byId.set(String(p.productId), p);
    }
    return { list, byId, generatedAt };
  });
}

export function loadReviewsData() {
  return readJsonCached(dataPath("reviews.json"), (parsed) => {
    const list = Array.isArray(parsed?.reviews) ? parsed.reviews : [];
    const generatedAt = parsed?.generatedAt ? String(parsed.generatedAt) : "";
    return { list, generatedAt };
  });
}

export function loadTenantsData() {
  return readJsonCached(dataPath("tenants.json"), (parsed) => ({
    list: Array.isArray(parsed?.tenants) ? parsed.tenants : [],
  }));
}

export function safeReadJsonFile(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function safeWriteJsonFile(filePath, value) {
  const body = JSON.stringify(value, null, 2) + "\n";
  fs.writeFileSync(filePath, body, "utf8");
}

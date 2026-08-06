// scripts/catalog-qa.js
// CLI: run catalog QA over data/products.json, print a report, and exit non-zero
// if any product has blocking errors (so it can gate publish/CI later).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "../src/catalog-qa.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadProducts() {
  const file = path.join(__dirname, "..", "data", "products.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(parsed?.products) ? parsed.products : [];
}

export function main() {
  const report = validateCatalog(loadProducts());
  console.log(
    `[catalog-qa] ${report.total} products | ${report.errorCount} error(s) | ${report.warningCount} warning(s)`,
  );
  for (const r of report.results) {
    for (const e of r.errors) console.log(`[error] ${r.productId}: ${e}`);
    for (const w of r.warnings) console.log(`[warn]  ${r.productId}: ${w}`);
  }
  if (!report.ok) {
    console.log("[catalog-qa] FAILED: fix the errors above before publishing.");
    process.exit(1);
  }
  console.log("[catalog-qa] OK: all products pass required checks.");
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) main();

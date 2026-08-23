// scripts/build-segment-pages.js
// CLI: render the segment landing pages (breeders, show dogs/cats, dog walkers,
// pet sitters, multi-pet) from data/segments.json + data/products.json into
// /segments/*.html plus a /segments/index.html hub. Re-runnable and idempotent,
// so a scheduled rebuild also flips show events from "upcoming" to "recent".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderSegmentPage, renderSegmentsIndex } from "../src/segment-page.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");

export function loadSegments() {
  const file = path.join(rootDir, "data", "segments.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(parsed?.segments) ? parsed.segments : [];
}

export function loadProducts() {
  const file = path.join(rootDir, "data", "products.json");
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(parsed?.products) ? parsed.products : [];
}

export function build({ today = new Date() } = {}) {
  const segments = loadSegments();
  const products = loadProducts();
  const outDir = path.join(rootDir, "segments");
  fs.mkdirSync(outDir, { recursive: true });

  const written = [];
  for (const segment of segments) {
    const slug = String(segment?.slug || "").trim();
    if (!slug) continue;
    const html = renderSegmentPage(segment, {
      products,
      today,
      allSegments: segments,
    });
    const outPath = path.join(outDir, `${slug}.html`);
    fs.writeFileSync(outPath, html, "utf8");
    written.push(`/segments/${slug}.html`);
  }

  const indexHtml = renderSegmentsIndex(segments);
  fs.writeFileSync(path.join(outDir, "index.html"), indexHtml, "utf8");
  written.push("/segments/index.html");

  return written;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  const written = build();
  console.log(`[segments] built ${written.length} pages:`);
  for (const p of written) console.log(`  ${p}`);
}

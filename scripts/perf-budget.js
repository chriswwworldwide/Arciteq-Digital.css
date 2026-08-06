// scripts/perf-budget.js
// Scans client-shipped assets and reports byte-budget violations. Report-only
// by default (exit 0) so it never surprises CI; set PERF_BUDGET_STRICT=true to
// fail on violations once the catalog images are optimised.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkAssets, classifyAsset, formatBytes } from "../src/perf-budget.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

// Directories that hold browser-shipped assets. Node code (server.js, scripts/,
// db.js, src/) and dependencies are intentionally excluded.
const SCAN_DIRS = ["images", "images2", "styles", "themes", "public"];
const ROOT_FILES = ["script.js"];
const SKIP_DIRS = new Set(["node_modules", ".git", "coverage"]);

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // directory may not exist in every tenant checkout
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(full, out);
    } else if (e.isFile()) {
      out.push(full);
    }
  }
}

export function collectAssets() {
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  for (const f of ROOT_FILES) {
    const full = path.join(ROOT, f);
    if (fs.existsSync(full)) files.push(full);
  }
  return files
    .filter((f) => classifyAsset(f) !== "other")
    .map((f) => ({ path: path.relative(ROOT, f), bytes: fs.statSync(f).size }));
}

export function main() {
  const strict = process.env.PERF_BUDGET_STRICT === "true";
  const report = checkAssets(collectAssets());

  console.log(
    `[perf-budget] scanned client assets: ${formatBytes(report.totalBytes)} total ` +
      `(images ${formatBytes(report.byType.image.bytes)}, ` +
      `js ${formatBytes(report.byType.script.bytes)}, ` +
      `css ${formatBytes(report.byType.style.bytes)})`,
  );

  if (report.ok) {
    console.log("[perf-budget] OK: all client assets within budget.");
    return;
  }

  console.log(
    `[perf-budget] ${report.violations.length} over-budget asset(s):`,
  );
  for (const v of report.violations) {
    console.log(
      `  [over] ${v.path} (${v.type}): ${formatBytes(v.bytes)} > ${formatBytes(v.limit)}`,
    );
  }
  if (strict) {
    console.log("[perf-budget] FAILED (strict mode).");
    process.exit(1);
  }
  console.log(
    "[perf-budget] report-only (set PERF_BUDGET_STRICT=true to fail on these).",
  );
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) main();

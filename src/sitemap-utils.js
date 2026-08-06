// src/sitemap-utils.js
// Pure sitemap helpers extracted from scripts/update-sitemap.js so they can be
// unit-tested (and coverage-counted) without the script's network/CLI side effects.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Directories and URLs ---
export const publicDir = path.join(__dirname, "../public");
export const siteURL = "https://lartdelaseduction.com";

// --- Folders to exclude from sitemap ---
export const EXCLUDED_DIRS = [
  "themes",
  "styles",
  "scripts",
  "server",
  ".husky",
  "api",
  "node_modules",
  "admin",
];

// --- Priority rules ---
export function getPriority(urlPath) {
  if (urlPath === "" || urlPath === "/") return "1.0"; // homepage
  if (urlPath.startsWith("product") || urlPath.startsWith("store"))
    return "0.8";
  if (urlPath.startsWith("blog") || urlPath.startsWith("article")) return "0.6";
  return "0.5";
}

/**
 * Recursively scan /public for .html files while excluding internal dirs
 */
export function getHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(publicDir, fullPath);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.some((ex) => relPath.startsWith(ex))) continue;
      files = files.concat(getHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      if (!EXCLUDED_DIRS.some((ex) => relPath.startsWith(ex)))
        files.push(fullPath);
    }
  }
  return files;
}

/**
 * Build <url> entries for each HTML page
 */
export function buildUrlEntries(files) {
  const today = new Date().toISOString().split("T")[0];
  return files
    .map((filePath) => {
      const relative = path.relative(publicDir, filePath);
      const locPath = relative
        .replace(/\\/g, "/")
        .replace(/index\.html$/, "")
        .replace(/\.html$/, "");
      const priority = getPriority(locPath);
      return `  <url>
    <loc>${siteURL}/${locPath}</loc>
    <lastmod>${today}</lastmod>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n");
}

/**
 * Compose the full sitemap.xml
 */
export function generateSitemap(files) {
  const urls = buildUrlEntries(files);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

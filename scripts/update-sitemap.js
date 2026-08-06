/**
 * update-sitemap.js
 * ------------------
 * Automatically generates sitemap.xml from site HTML pages.
 * Excludes internal folders, assigns priorities, and pings search engines.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Directories and URLs ---
const publicDir = path.join(__dirname, "../public");
const sitemapPath = path.join(publicDir, "sitemap.xml");
const siteURL = "https://lartdelaseduction.com";
const sitemapURL = `${siteURL}/sitemap.xml`;

// --- Environment flag: ping only in production ---
const ENABLE_PING = process.env.NODE_ENV === "production";

// --- Folders to exclude from sitemap ---
const EXCLUDED_DIRS = [
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

/**
 * Ping search engines
 */
function pingSearchEngines() {
  const engines = {
    Google: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapURL)}`,
    Bing: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapURL)}`,
  };

  Object.entries(engines).forEach(([name, url]) => {
    https
      .get(url, (res) => {
        if (res.statusCode === 200) {
          console.log(`🌍  Pinged ${name} successfully`);
        } else {
          console.warn(`⚠️  ${name} ping responded with ${res.statusCode}`);
        }
      })
      .on("error", (err) => {
        console.warn(`⚠️  ${name} ping failed:`, err.message);
      });
  });
}

/**
 * Main sitemap build process
 */
function updateSitemap() {
  try {
    if (!fs.existsSync(publicDir)) {
      console.error("❌  Public directory not found:", publicDir);
      process.exit(1);
    }

    const files = getHtmlFiles(publicDir);
    if (!files.length) {
      console.warn("⚠️  No .html files found in /public, nothing to include.");
      process.exit(0);
    }

    const xml = generateSitemap(files);
    fs.writeFileSync(sitemapPath, xml, "utf-8");

    console.log(`✅  Sitemap built successfully with ${files.length} pages`);
    console.log(`🗺️  Location: ${sitemapPath}`);
    console.log(`🚫  Excluded folders: ${EXCLUDED_DIRS.join(", ")}`);

    if (ENABLE_PING) {
      pingSearchEngines();
    } else {
      console.log("💤  Skipping search engine pings (local environment).");
    }
  } catch (err) {
    console.error("❌  Error generating sitemap:", err);
    process.exit(1);
  }
}

// --- Run the process (only when invoked directly, not when imported) ---
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  updateSitemap();
}

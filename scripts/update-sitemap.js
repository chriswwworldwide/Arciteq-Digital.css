/**
 * update-sitemap.js
 * ------------------
 * Automatically generates sitemap.xml from site HTML pages.
 * Excludes internal folders, assigns priorities, and pings search engines.
 *
 * Pure helpers (priority rules, file scanning, XML generation) live in
 * ../src/sitemap-utils.js so they can be unit-tested independently of the
 * network/filesystem side effects below.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import {
  publicDir,
  siteURL,
  EXCLUDED_DIRS,
  getHtmlFiles,
  generateSitemap,
} from "../src/sitemap-utils.js";

const __filename = fileURLToPath(import.meta.url);

// --- Derived paths / URLs ---
const sitemapPath = path.join(publicDir, "sitemap.xml");
const sitemapURL = `${siteURL}/sitemap.xml`;

// --- Environment flag: ping only in production ---
const ENABLE_PING = process.env.NODE_ENV === "production";

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
          console.log(`[ok] Pinged ${name} successfully`);
        } else {
          console.warn(`[warn] ${name} ping responded with ${res.statusCode}`);
        }
      })
      .on("error", (err) => {
        console.warn(`[warn] ${name} ping failed:`, err.message);
      });
  });
}

/**
 * Main sitemap build process
 */
function updateSitemap() {
  try {
    if (!fs.existsSync(publicDir)) {
      console.error("[error] Public directory not found:", publicDir);
      process.exit(1);
    }

    const files = getHtmlFiles(publicDir);
    if (!files.length) {
      console.warn(
        "[warn] No .html files found in /public, nothing to include.",
      );
      process.exit(0);
    }

    const xml = generateSitemap(files);
    fs.writeFileSync(sitemapPath, xml, "utf-8");

    console.log(`[ok] Sitemap built successfully with ${files.length} pages`);
    console.log(`[info] Location: ${sitemapPath}`);
    console.log(`[info] Excluded folders: ${EXCLUDED_DIRS.join(", ")}`);

    if (ENABLE_PING) {
      pingSearchEngines();
    } else {
      console.log("[info] Skipping search engine pings (local environment).");
    }
  } catch (err) {
    console.error("[error] Error generating sitemap:", err);
    process.exit(1);
  }
}

// --- Run the process (only when invoked directly, not when imported) ---
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  updateSitemap();
}

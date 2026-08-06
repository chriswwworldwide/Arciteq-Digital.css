// tests/update-sitemap.test.js
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPriority,
  buildUrlEntries,
  generateSitemap,
  getHtmlFiles,
} from "../scripts/update-sitemap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Mirrors the module's internal publicDir (repoRoot/public).
const publicDir = path.resolve(__dirname, "../public");
const SITE_URL = "https://lartdelaseduction.com";
const today = new Date().toISOString().split("T")[0];

describe("getPriority", () => {
  it("gives the homepage top priority", () => {
    expect(getPriority("")).toBe("1.0");
    expect(getPriority("/")).toBe("1.0");
  });

  it("prioritises product and store pages at 0.8", () => {
    expect(getPriority("product/foo")).toBe("0.8");
    expect(getPriority("store")).toBe("0.8");
  });

  it("prioritises blog and article pages at 0.6", () => {
    expect(getPriority("blog/post")).toBe("0.6");
    expect(getPriority("article/x")).toBe("0.6");
  });

  it("falls back to 0.5 for everything else", () => {
    expect(getPriority("about")).toBe("0.5");
  });
});

describe("buildUrlEntries", () => {
  it("strips index.html/.html, maps priorities, and stamps lastmod", () => {
    const files = [
      path.join(publicDir, "index.html"),
      path.join(publicDir, "product", "mat.html"),
      path.join(publicDir, "blog", "senior-dogs.html"),
    ];
    const xml = buildUrlEntries(files);

    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(xml).toContain("<priority>1.0</priority>");
    expect(xml).toContain(`<loc>${SITE_URL}/product/mat</loc>`);
    expect(xml).toContain("<priority>0.8</priority>");
    expect(xml).toContain(`<loc>${SITE_URL}/blog/senior-dogs</loc>`);
    expect(xml).toContain("<priority>0.6</priority>");
    expect(xml).toContain(`<lastmod>${today}</lastmod>`);
  });

  it("returns an empty string when given no files", () => {
    expect(buildUrlEntries([])).toBe("");
  });
});

describe("generateSitemap", () => {
  it("wraps entries in a valid urlset document", () => {
    const xml = generateSitemap([path.join(publicDir, "index.html")]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
  });
});

describe("getHtmlFiles", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sitemap-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("recursively collects .html files and ignores non-html files", () => {
    fs.writeFileSync(path.join(tmpDir, "a.html"), "<html></html>");
    fs.writeFileSync(path.join(tmpDir, "notes.txt"), "ignore me");
    fs.mkdirSync(path.join(tmpDir, "sub"));
    fs.writeFileSync(path.join(tmpDir, "sub", "b.html"), "<html></html>");

    const found = getHtmlFiles(tmpDir).sort();
    expect(found).toEqual(
      [path.join(tmpDir, "a.html"), path.join(tmpDir, "sub", "b.html")].sort(),
    );
  });
});
